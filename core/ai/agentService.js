const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { maskSecrets } = require('./copilotService');

const execFileAsync = promisify(execFile);
const MAX_PROMPT = 8000;
const MAX_EVENTS = 240;
const MAX_TEXT = 12000;
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_TURNS = 12;
const TOOL_TIMEOUT = 120000;

function fail(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function clean(value, limit = MAX_TEXT) {
  return maskSecrets(String(value || '')).replace(/\b(?:AIza[\w-]{20,}|sk-[\w-]{16,}|gh[pousr]_[\w-]{16,})\b/g, '[REDACTED]').slice(0, limit);
}
function safePath(root, requested) {
  const resolved = path.resolve(root, String(requested || ''));
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
function toolDefinitions() {
  return [{ functionDeclarations: [
    { name: 'list_files', description: 'List files in a repository directory.', parameters: { type: 'object', properties: { directory: { type: 'string' } } } },
    { name: 'read_file', description: 'Read a UTF-8 text file in the repository.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, startLine: { type: 'integer' }, endLine: { type: 'integer' } } } },
    { name: 'write_file', description: 'Write a UTF-8 text file in the repository. Do not write secrets.', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    { name: 'run_command', description: 'Run a finite non-interactive repository command.', parameters: { type: 'object', required: ['command'], properties: { command: { type: 'string' } } } },
  ] }];
}
async function executeTool(root, name, args) {
  if (name === 'list_files') {
    const target = safePath(root, args.directory || '.');
    if (!target) throw fail('Đường dẫn nằm ngoài workspace.');
    return fs.readdirSync(target, { withFileTypes: true }).slice(0, 200).map(entry => `${entry.isDirectory() ? 'dir' : 'file'} ${path.relative(root, path.join(target, entry.name)).split(path.sep).join('/')}`);
  }
  if (name === 'read_file') {
    const target = safePath(root, args.path);
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) throw fail('File không tồn tại hoặc không hợp lệ.');
    const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
    const start = Math.max(1, Number(args.startLine) || 1);
    const end = Math.min(lines.length, Number(args.endLine) || Math.min(lines.length, start + 240));
    return lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join('\n');
  }
  if (name === 'write_file') {
    const target = safePath(root, args.path);
    const relative = target ? path.relative(root, target) : '';
    if (!target || /(?:^|[\\/])(?:\.env[^\\/]*|\.git)(?:[\\/]|$)/i.test(relative)) throw fail('Không được ghi file secret hoặc metadata Git.');
    if (typeof args.content !== 'string' || args.content.length > 1_000_000) throw fail('Nội dung file vượt giới hạn.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, args.content, 'utf8');
    return { path: relative.split(path.sep).join('/'), kind: 'update' };
  }
  if (name === 'run_command') {
    if (typeof args.command !== 'string' || !args.command.trim() || args.command.length > 2000 || /(?:^|[;&|])\s*(?:del|rm|rmdir|format)\b/i.test(args.command)) throw fail('Lệnh không hợp lệ hoặc nguy hiểm.');
    try {
      const result = await execFileAsync(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', args.command] : ['-lc', args.command], { cwd: root, timeout: TOOL_TIMEOUT, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
      return { exitCode: 0, output: clean(`${result.stdout}\n${result.stderr}`) };
    } catch (error) { return { exitCode: error.code || 1, output: clean(`${error.stdout || ''}\n${error.stderr || error.message}`) }; }
  }
  throw fail(`Tool không được hỗ trợ: ${name}.`);
}

function openAiToolDefinitions() {
  return [
    { type: 'function', function: { name: 'list_files', description: 'List files in a repository directory.', parameters: { type: 'object', properties: { directory: { type: 'string' } } } } },
    { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 text file in the repository.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, startLine: { type: 'integer' }, endLine: { type: 'integer' } } } } },
    { type: 'function', function: { name: 'write_file', description: 'Write a UTF-8 text file in the repository. Do not write secrets.', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } } },
    { type: 'function', function: { name: 'run_command', description: 'Run a finite non-interactive repository command.', parameters: { type: 'object', required: ['command'], properties: { command: { type: 'string' } } } } },
  ];
}

function createAgentService({ root, fetchImpl = fetch, env = process.env } = {}) {
  const workspace = path.resolve(root);
  const historyDir = path.join(workspace, '.tmp', 'agent-sessions');
  const sessions = new Map();
  let active = null;
  let starting = false;
  let closing = false;

  function reloadEnv() {
    try {
      const envFile = path.join(workspace, '.env');
      if (fs.existsSync(envFile)) {
        require('dotenv').config({ path: envFile, override: true });
      }
    } catch {}
  }

  function resolveConfig(clientConfig = null, overrideModel = null) {
    if (clientConfig && clientConfig.apiKey) {
      const provider = String(clientConfig.provider || 'gemini').toLowerCase();
      return {
        provider,
        apiKey: String(clientConfig.apiKey).trim(),
        baseURL: String(clientConfig.baseURL || '').trim(),
        model: overrideModel || clientConfig.model || (provider === 'gemini' ? DEFAULT_MODEL : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
        source: 'client',
      };
    }
    if (!env.GEMINI_API_KEY && !env.AI_API_KEY && !env.OPENAI_API_KEY && !env.DEEPSEEK_API_KEY) reloadEnv();
    const provider = String(env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini')).toLowerCase();
    const apiKey = env.AI_API_KEY || (provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'openai' ? env.OPENAI_API_KEY : provider === 'deepseek' ? env.DEEPSEEK_API_KEY : (env.GEMINI_API_KEY || env.OPENAI_API_KEY));
    const baseURL = String(env.AI_BASE_URL || '').trim();
    const model = overrideModel || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || DEFAULT_MODEL) : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    return { provider, apiKey, baseURL, model, source: 'server' };
  }

  function persist(session) {
    fs.mkdirSync(historyDir, { recursive: true });
    const file = path.join(historyDir, `${session.id}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(session), 'utf8');
    fs.renameSync(`${file}.tmp`, file);
  }

  try {
    if (fs.existsSync(historyDir)) {
      for (const name of fs.readdirSync(historyDir).filter(name => /^[\da-f-]{36}\.json$/.test(name)).slice(-30)) {
        try {
          const session = JSON.parse(fs.readFileSync(path.join(historyDir, name), 'utf8'));
          if (session.status === 'running') {
            session.status = 'stopped';
            session.finishedAt = new Date().toISOString();
            session.error = 'Phiên bị gián đoạn khi Dashboard khởi động lại.';
            persist(session);
          }
          sessions.set(session.id, session);
        } catch {}
      }
    }
  } catch {}

  const MODEL_QUOTAS = {
    'gemini-2.5-flash': { tpm: 1000000, rpm: 15, rpd: 1500, label: '1.000.000 TPM' },
    'gemini-2.0-flash': { tpm: 1000000, rpm: 15, rpd: 1500, label: '1.000.000 TPM' },
    'gemini-1.5-flash': { tpm: 1000000, rpm: 15, rpd: 1500, label: '1.000.000 TPM' },
    'gemini-1.5-pro': { tpm: 32000, rpm: 2, rpd: 50, label: '32.000 TPM' },
    'gpt-4o-mini': { tpm: 200000, rpm: 500, label: '200.000 TPM' },
    'gpt-4o': { tpm: 30000, rpm: 500, label: '30.000 TPM' },
    'o3-mini': { tpm: 100000, rpm: 500, label: '100.000 TPM' },
    'deepseek-chat': { tpm: 60000, rpm: 60, label: '60.000 TPM' },
    'deepseek-coder': { tpm: 60000, rpm: 60, label: '60.000 TPM' },
  };

  const rollingEntries = [];
  let exactRateLimit = null;

  function pruneRolling() {
    const now = Date.now();
    while (rollingEntries.length && now - rollingEntries[0].timestamp > 60000) {
      rollingEntries.shift();
    }
  }

  function recordTokenUsage(tokens, promptTokens = 0, completionTokens = 0) {
    pruneRolling();
    rollingEntries.push({ timestamp: Date.now(), tokens: Number(tokens) || 0, promptTokens: Number(promptTokens) || 0, completionTokens: Number(completionTokens) || 0 });
  }

  function getQuotaStatus(config, session = null) {
    pruneRolling();
    const modelKey = String(config?.model || '').toLowerCase();
    const defaultQuota = config?.provider === 'gemini' ? { tpm: 1000000, rpm: 15, label: '1.000.000 TPM' }
      : config?.provider === 'deepseek' ? { tpm: 60000, rpm: 60, label: '60.000 TPM' }
      : { tpm: 200000, rpm: 500, label: '200.000 TPM' };
    const quotaSpec = MODEL_QUOTAS[modelKey] || defaultQuota;

    let limitTokens = quotaSpec.tpm;
    let usedTokens = rollingEntries.reduce((sum, e) => sum + e.tokens, 0);
    let remainingTokens = Math.max(0, limitTokens - usedTokens);
    let remainingPercent = Math.max(0, Math.min(100, Math.round((remainingTokens / limitTokens) * 100)));

    if (exactRateLimit && (Date.now() - exactRateLimit.updatedAt < 60000)) {
      if (exactRateLimit.limitTokens && exactRateLimit.remainingTokens !== undefined) {
        limitTokens = exactRateLimit.limitTokens;
        remainingTokens = exactRateLimit.remainingTokens;
        usedTokens = Math.max(0, limitTokens - remainingTokens);
        remainingPercent = Math.max(0, Math.min(100, Math.round((remainingTokens / limitTokens) * 100)));
      }
    }

    const sessionTokens = session?.tokenUsage ? {
      promptTokens: session.tokenUsage.promptTokens || 0,
      completionTokens: session.tokenUsage.completionTokens || 0,
      totalTokens: session.tokenUsage.totalTokens || 0,
    } : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    let totalAllTimeTokens = 0;
    for (const s of sessions.values()) {
      totalAllTimeTokens += (s.tokenUsage?.totalTokens || 0);
    }

    return {
      remainingPercent,
      usedTokens,
      limitTokens,
      remainingTokens,
      sessionTokens,
      totalAllTimeTokens,
      rpmLimit: quotaSpec.rpm,
      rpmUsed: rollingEntries.length,
      rpmRemaining: Math.max(0, quotaSpec.rpm - rollingEntries.length),
      modelName: config?.model || '',
      providerName: config?.provider || 'gemini',
      limitLabel: quotaSpec.label,
    };
  }

  const snapshot = session => {
    const snap = JSON.parse(JSON.stringify(session));
    const config = resolveConfig(null, session.model);
    snap.tokenQuota = getQuotaStatus(config, session);
    return snap;
  };
  function get(id) {
    const session = sessions.get(id);
    if (!session) throw fail('Không tìm thấy phiên Agent.', 404);
    return snapshot(session);
  }
  function list() {
    return [...sessions.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(({ events, summary, changedFiles, ...session }) => ({ ...session, changedFileCount: changedFiles.length }));
  }
  function addEvent(session, event) {
    session.events.push({ id: randomUUID(), ...event });
    if (session.events.length > MAX_EVENTS) session.events.splice(0, session.events.length - MAX_EVENTS);
    persist(session);
  }

  async function geminiCall(contents, config, session = null) {
    const key = config.apiKey;
    if (!key) throw fail('Chưa cấu hình GEMINI_API_KEY cho Dashboard.', 503);
    const targetModel = config.model || DEFAULT_MODEL;
    const base = config.baseURL || GEMINI_API;
    const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(key)}`;
    const isTestEnv = Boolean(typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.argv?.some(arg => arg.includes('test'))));
    const maxRetries = isTestEnv ? 0 : 3;

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents,
          tools: toolDefinitions(),
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });
      const data = await response.json();
      if (response.ok) return data;

      const isRateLimit = response.status === 429 || data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED' || /quota exceeded/i.test(data.error?.message || '');
      const rawMsg = data.error?.message || 'Gemini API trả về lỗi.';
      let userFriendlyMsg = rawMsg;
      if (isRateLimit) {
        const match = rawMsg.match(/retry in\s+([0-9.]+)\s*s/i);
        const retrySec = match ? Math.ceil(parseFloat(match[1])) : 60;
        userFriendlyMsg = `Đã chạm giới hạn tốc độ Gemini Free Tier (15-20 lượt/phút - quota exceeded). Vui lòng thử lại sau ${retrySec}s, hoặc chạy trực tiếp kịch bản từ tab "Bộ test" / Terminal mà không cần dùng AI. Chi tiết: ${rawMsg}`;
      }
      lastError = fail(userFriendlyMsg, isRateLimit ? 503 : 500);

      if (isRateLimit && attempt < maxRetries) {
        const match = (data.error?.message || '').match(/retry in\s+([0-9.]+)\s*s/i);
        const parsedSec = match ? Math.ceil(parseFloat(match[1])) : (15 * (attempt + 1));
        const waitSec = Math.max(3, Math.min(60, parsedSec));
        if (session) {
          addEvent(session, {
            type: 'status',
            text: `⏳ Chạm giới hạn tốc độ Gemini (Free Tier). Đang tạm nghỉ và tự động thử lại sau ${waitSec}s (Lần ${attempt + 1}/${maxRetries})...`
          });
        }
        await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
        continue;
      }
      throw lastError;
    }
    throw lastError || fail('Gemini API trả về lỗi.', 503);
  }

  async function openAiCall(messages, config, session = null) {
    const key = config.apiKey;
    if (!key) throw fail(`Chưa cấu hình API Key cho ${config.provider}.`, 503);
    const defaultBase = config.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const base = (config.baseURL || defaultBase).replace(/\/+$/, '');
    const url = `${base}/chat/completions`;
    const isTestEnv = Boolean(typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.argv?.some(arg => arg.includes('test'))));
    const maxRetries = isTestEnv ? 0 : 3;

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: openAiToolDefinitions(),
          tool_choice: 'auto',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        if (response.headers) {
          const remHeader = typeof response.headers.get === 'function' ? response.headers.get('x-ratelimit-remaining-tokens') : response.headers['x-ratelimit-remaining-tokens'];
          const limHeader = typeof response.headers.get === 'function' ? response.headers.get('x-ratelimit-limit-tokens') : response.headers['x-ratelimit-limit-tokens'];
          if (remHeader && limHeader) {
            exactRateLimit = {
              remainingTokens: Number(remHeader),
              limitTokens: Number(limHeader),
              updatedAt: Date.now(),
            };
          }
        }
        return data;
      }

      const isRateLimit = response.status === 429 || /rate limit|quota exceeded/i.test(data.error?.message || '');
      lastError = fail(data.error?.message || `${config.provider} API trả về lỗi: HTTP ${response.status}`, isRateLimit ? 503 : 500);

      if (isRateLimit && attempt < maxRetries) {
        const waitSec = 10 * (attempt + 1);
        if (session) {
          addEvent(session, {
            type: 'status',
            text: `⏳ Chạm giới hạn tốc độ ${config.provider} (Rate Limit). Đang tạm nghỉ và tự động thử lại sau ${waitSec}s (Lần ${attempt + 1}/${maxRetries})...`
          });
        }
        await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
        continue;
      }
      throw lastError;
    }
    throw lastError || fail(`${config.provider} API trả về lỗi.`, 503);
  }

  async function runGemini(session, config) {
    const isTestEnv = Boolean(typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.argv?.some(arg => arg.includes('test'))));
    const contents = [{ role: 'user', parts: [{ text: ['Bạn là coding agent của Automation Dashboard. Trả lời bằng tiếng Việt.', 'Được phép đọc/sửa/chạy kiểm thử trong workspace bằng tools. Không đọc secret, không commit/push/install.', 'Hoàn thành yêu cầu, kiểm tra kết quả và báo cáo file/lệnh đã thay đổi.', `Yêu cầu người dùng: ${session.prompt}`].join('\n\n') }] }];
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      if (turn > 0 && !isTestEnv) {
        // Giữ nhịp tối thiểu giữa các tool turns để không bị vượt quá 15 RPM của Gemini Free Tier
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
      const data = await geminiCall(contents, config, session);
      if (data.usageMetadata) {
        const promptTokens = Number(data.usageMetadata.promptTokenCount) || 0;
        const candidatesTokens = Number(data.usageMetadata.candidatesTokenCount) || 0;
        const totalTokens = Number(data.usageMetadata.totalTokenCount) || (promptTokens + candidatesTokens);
        recordTokenUsage(totalTokens, promptTokens, candidatesTokens);
        if (session.tokenUsage) {
          session.tokenUsage.promptTokens += promptTokens;
          session.tokenUsage.completionTokens += candidatesTokens;
          session.tokenUsage.totalTokens += totalTokens;
        }
      }
      const content = data.candidates?.[0]?.content;
      if (!content) throw fail('Gemini không trả về nội dung hợp lệ.', 503);
      contents.push(content);
      const calls = (content.parts || []).filter(part => part.functionCall);
      if (!calls.length) { session.summary = clean((content.parts || []).map(part => part.text || '').join('\n')); return; }
      const responses = [];
      for (const part of calls) {
        const call = part.functionCall;
        addEvent(session, { type: 'status', text: `Gemini đang gọi tool: ${call.name}` });
        try {
          const result = await executeTool(workspace, call.name, call.args || {});
          if (call.name === 'write_file') { session.changedFiles.push(result); addEvent(session, { type: 'file_change', text: 'Thay đổi file', files: [result] }); }
          else if (call.name === 'run_command') addEvent(session, { type: 'command', text: 'Kết quả lệnh', command: clean(call.args.command, 2000), output: result.output, exitCode: result.exitCode });
          responses.push({ functionResponse: { name: call.name, response: { result } } });
        } catch (error) { responses.push({ functionResponse: { name: call.name, response: { error: error.message } } }); addEvent(session, { type: 'error', text: error.message }); }
      }
      contents.push({ role: 'user', parts: responses });
    }
    throw fail('Agent vượt quá số lượt tool cho phép.', 503);
  }

  async function runOpenAI(session, config) {
    const isTestEnv = Boolean(typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.argv?.some(arg => arg.includes('test'))));
    const messages = [
      { role: 'system', content: ['Bạn là coding agent của Automation Dashboard. Trả lời bằng tiếng Việt.', 'Được phép đọc/sửa/chạy kiểm thử trong workspace bằng tools. Không đọc secret, không commit/push/install.', 'Hoàn thành yêu cầu, kiểm tra kết quả và báo cáo file/lệnh đã thay đổi.'].join('\n\n') },
      { role: 'user', content: session.prompt }
    ];
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      if (turn > 0 && !isTestEnv) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const data = await openAiCall(messages, config, session);
      if (data.usage) {
        const promptTokens = Number(data.usage.prompt_tokens) || 0;
        const completionTokens = Number(data.usage.completion_tokens) || 0;
        const totalTokens = Number(data.usage.total_tokens) || (promptTokens + completionTokens);
        recordTokenUsage(totalTokens, promptTokens, completionTokens);
        if (session.tokenUsage) {
          session.tokenUsage.promptTokens += promptTokens;
          session.tokenUsage.completionTokens += completionTokens;
          session.tokenUsage.totalTokens += totalTokens;
        }
      }
      const message = data.choices?.[0]?.message;
      if (!message) throw fail(`${config.provider} không trả về nội dung hợp lệ.`, 503);
      messages.push(message);
      const calls = message.tool_calls || [];
      if (!calls.length) { session.summary = clean(message.content || ''); return; }
      for (const call of calls) {
        const fn = call.function || {};
        let args = {};
        try { args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {}); } catch {}
        addEvent(session, { type: 'status', text: `${config.provider} đang gọi tool: ${fn.name}` });
        try {
          const result = await executeTool(workspace, fn.name, args);
          if (fn.name === 'write_file') { session.changedFiles.push(result); addEvent(session, { type: 'file_change', text: 'Thay đổi file', files: [result] }); }
          else if (fn.name === 'run_command') addEvent(session, { type: 'command', text: 'Kết quả lệnh', command: clean(args.command, 2000), output: result.output, exitCode: result.exitCode });
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        } catch (error) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: error.message }) });
          addEvent(session, { type: 'error', text: error.message });
        }
      }
    }
    throw fail('Agent vượt quá số lượt tool cho phép.', 503);
  }

  async function start(input = {}) {
    if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > MAX_PROMPT || input.prompt.includes('\0')) throw fail(`Nhập yêu cầu từ 1 đến ${MAX_PROMPT} ký tự.`);
    const config = resolveConfig(input.clientConfig, input.model);
    if (!config.apiKey) throw fail(`Chưa cấu hình API Key cho ${config.provider}. Hãy cài đặt trong tab Cấu hình hoặc file .env.`, 503);
    if (active || starting || closing) throw fail('Đang có một phiên Agent chạy. Hãy chờ hoặc dừng phiên đó.', 409);
    starting = true;
    const session = {
      id: randomUUID(),
      prompt: clean(input.prompt.trim(), MAX_PROMPT),
      model: config.model,
      provider: config.provider,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      events: [],
      summary: '',
      changedFiles: [],
      error: '',
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
    sessions.set(session.id, session); active = { session }; persist(session); addEvent(session, { type: 'status', text: `Đang kết nối ${config.provider === 'gemini' ? 'Gemini API' : config.provider}…` });
    starting = false;
    const runner = config.provider === 'gemini' ? runGemini(session, config) : runOpenAI(session, config);
    runner.then(() => { session.status = 'completed'; addEvent(session, { type: 'status', text: `${config.provider === 'gemini' ? 'Gemini' : config.provider} đã hoàn tất tác vụ.` }); }).catch(error => { session.status = 'failed'; session.error = clean(error.message); addEvent(session, { type: 'error', text: session.error }); }).finally(() => { session.finishedAt = new Date().toISOString(); persist(session); active = null; });
    return snapshot(session);
  }

  function stop(id) {
    const session = get(id);
    if (active?.session.id === id) {
      active.session.status = 'stopped';
      addEvent(active.session, { type: 'status', text: 'Đã dừng Agent.' });
      active = null;
    }
    return session;
  }

  function status({ refresh = false, clientConfig = null } = {}) {
    if (refresh) reloadEnv();
    const config = resolveConfig(clientConfig);
    const isGemini = config.provider === 'gemini';
    const knownModels = isGemini ? [
      { name: config.model, size: 0 },
      { name: 'gemini-2.5-flash', size: 0 },
      { name: 'gemini-2.0-flash', size: 0 },
      { name: 'gemini-1.5-pro', size: 0 },
      { name: 'gemini-1.5-flash', size: 0 },
    ].filter((item, index, self) => index === self.findIndex(t => t.name === item.name))
    : [
      { name: config.model, size: 0 },
      { name: 'gpt-4o-mini', size: 0 },
      { name: 'gpt-4o', size: 0 },
      { name: 'o3-mini', size: 0 },
      { name: 'deepseek-chat', size: 0 },
      { name: 'deepseek-coder', size: 0 },
    ].filter((item, index, self) => index === self.findIndex(t => t.name === item.name));

    const providerLabel = isGemini ? 'Gemini API' : config.provider === 'openai' ? 'OpenAI API' : config.provider === 'deepseek' ? 'DeepSeek API' : `${config.provider.toUpperCase()} API`;
    const hasKey = Boolean(config.apiKey);
    return {
      available: hasKey,
      authenticated: hasKey,
      provider: providerLabel,
      models: knownModels,
      selectedModel: config.model,
      maxPromptLength: MAX_PROMPT,
      message: hasKey ? `Sẵn sàng · ${providerLabel}.` : `Chưa cấu hình API Key cho ${providerLabel}.`,
      activeSessionId: active?.session.id || null,
      busy: starting || Boolean(active),
      source: config.source,
      tokenQuota: getQuotaStatus(config, active?.session || null),
    };
  }

  async function testConnection({ provider = 'gemini', apiKey, baseURL = '', model = '' } = {}) {
    if (!apiKey) throw fail('Vui lòng nhập API Key để kiểm tra kết nối.', 400);
    const targetProvider = String(provider).toLowerCase();
    const start = Date.now();
    if (targetProvider === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const isCustomGemini = baseURL && (baseURL.includes('generativelanguage') || baseURL.includes('googleapis') || baseURL.includes('gemini'));
      const base = isCustomGemini ? baseURL : GEMINI_API;
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(targetModel)}?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchImpl(url, { method: 'GET' });
      const latency = Date.now() - start;
      if (!response.ok) {
        let errText = `HTTP ${response.status}`;
        try { const errJson = await response.json(); errText = errJson.error?.message || errText; } catch {}
        throw fail(`Kiểm tra Gemini thất bại: ${errText}`, response.status === 400 || response.status === 401 ? 400 : 502);
      }
      return { success: true, provider: 'Google Gemini', model: targetModel, latencyMs: latency, message: `Kết nối thành công tới Google Gemini (${latency}ms)!` };
    } else {
      const defaultBase = targetProvider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
      const base = (baseURL || defaultBase).replace(/\/+$/, '');
      const url = `${base}/models`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const latency = Date.now() - start;
      if (!response.ok) {
        let errText = `HTTP ${response.status}`;
        try { const errJson = await response.json(); errText = errJson.error?.message || errText; } catch {}
        throw fail(`Kiểm tra ${provider} thất bại: ${errText}`, response.status === 401 ? 401 : 502);
      }
      return { success: true, provider, model: model || 'default', latencyMs: latency, message: `Kết nối thành công tới ${provider} (${latency}ms)!` };
    }
  }

  async function inlineSuggest({ prefix = '', suffix = '', language = 'javascript', clientConfig = null, model = null } = {}) {
    if (!prefix || !prefix.trim()) return { success: true, suggestion: '', tokensUsed: 0 };
    const config = resolveConfig(clientConfig, model);
    if (!config.apiKey) throw fail(`Chưa cấu hình API Key cho ${config.provider}.`, 503);

    const cleanPrefix = String(prefix).slice(-1200);
    const cleanSuffix = String(suffix).slice(0, 400);

    const lines = cleanPrefix.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    const isCommentLine = /^\s*\/\//.test(currentLine);
    const indent = currentLine.match(/^\s*/)?.[0] || '';
    const commentBody = currentLine.replace(/^\s*\/\/\s*/, '').trim();

    let contextRule = '';
    if (isCommentLine) {
      if (commentBody.length === 0 || commentBody.length < 15) {
        contextRule = 'The cursor is on a comment line. Complete the comment description in Vietnamese or English on the same line. Do NOT output code.';
      } else {
        contextRule = `The cursor is at the end of a comment: "${currentLine}". Generate the Playwright test code implementing this comment. CRITICAL: The code MUST begin with a newline and indentation ("\\n${indent}await ...") so it goes on the next line and does not get stuck inside the comment.`;
      }
    } else {
      contextRule = 'Complete the Playwright JavaScript code continuously from the cursor. Output ONLY the raw continuous characters to insert. Never repeat any characters already in PREFIX.';
    }

    const promptText = [
      `You are an ultra-low-latency AI autocompletion engine for Playwright test automation (${language}).`,
      contextRule,
      'Rules:',
      '1. Return RAW code or text ONLY. NEVER wrap in markdown code blocks (never use ```).',
      '2. Keep it concise: 1 to 2 lines maximum.',
      '3. Never output explanations or markdown formatting.',
      '4. If no completion is appropriate, return an empty string.',
      `<<<PREFIX>>>\n${cleanPrefix}\n<<<END_PREFIX>>>`,
      `<<<SUFFIX>>>\n${cleanSuffix}\n<<<END_SUFFIX>>>`,
      'Continuation at cursor:'
    ].join('\n');

    let suggestion = '';
    let tokensUsed = 0;
    let usedModel = config.model;

    if (config.provider === 'gemini') {
      const targetModel = (clientConfig?.model || model) ? (clientConfig?.model || model) : 'gemini-flash-lite-latest';
      usedModel = targetModel;
      const base = config.baseURL || GEMINI_API;
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      
      let response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            maxOutputTokens: 50,
            temperature: 0.1,
            stopSequences: ['<<<', '```']
          }
        }),
      });

      // Fallback to default configured model if flash-lite is not supported in this region
      if (!response.ok && targetModel !== (config.model || DEFAULT_MODEL)) {
        usedModel = config.model || DEFAULT_MODEL;
        const fallbackUrl = `${base.replace(/\/+$/, '')}/${encodeURIComponent(usedModel)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
        response = await fetchImpl(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              maxOutputTokens: 50,
              temperature: 0.1,
              stopSequences: ['<<<', '```']
            }
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) throw fail(data.error?.message || 'Gemini API trả về lỗi.', 500);
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      suggestion = raw.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '').trimEnd();
      const pCount = Number(data.usageMetadata?.promptTokenCount) || 0;
      const cCount = Number(data.usageMetadata?.candidatesTokenCount) || 0;
      tokensUsed = pCount + cCount;
      if (tokensUsed > 0) recordTokenUsage(tokensUsed, pCount, cCount);
    } else {
      const defaultBase = config.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
      const base = (config.baseURL || defaultBase).replace(/\/+$/, '');
      const url = `${base}/chat/completions`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: promptText }],
          max_tokens: 50,
          temperature: 0.1,
          stop: ['<<<', '```']
        }),
      });
      const data = await response.json();
      if (!response.ok) throw fail(data.error?.message || `${config.provider} API trả về lỗi`, 500);
      const raw = data.choices?.[0]?.message?.content || '';
      suggestion = raw.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '').trimEnd();
      tokensUsed = Number(data.usage?.total_tokens) || 0;
      if (tokensUsed > 0) recordTokenUsage(tokensUsed, data.usage?.prompt_tokens, data.usage?.completion_tokens);
    }

    // Post-processing for comment alignment
    if (isCommentLine) {
      if (commentBody.length >= 15) {
        // Complete comment describing action: code must be on next line with indentation
        if (!suggestion.startsWith('\n') && /^\s*(await|const|let|var|expect|test|if|for|while|try|return)\b/.test(suggestion)) {
          suggestion = '\n' + indent + suggestion.trimStart();
        }
      } else {
        // Incomplete comment: strip any redundant leading '//'
        suggestion = suggestion.replace(/^\s*\/\/\s*/, '');
      }
    } else {
      // Prevent duplicate word overlap with end of prefix (e.g. 'await ' + 'await ...')
      const lastWordMatch = cleanPrefix.match(/([a-zA-Z0-9_$]+)\s*$/);
      if (lastWordMatch && lastWordMatch[1]) {
        const lastWord = lastWordMatch[1];
        if (suggestion.startsWith(lastWord)) {
          suggestion = suggestion.slice(lastWord.length).trimStart();
        }
      }
    }

    return {
      success: true,
      suggestion,
      tokensUsed,
      model: usedModel,
      provider: config.provider,
    };
  }

  function shutdown() { closing = true; if (active) stop(active.session.id); }
  return { start, stop, status, testConnection, inlineSuggest, get, list, shutdown, isRunning: () => starting || Boolean(active) };
}

module.exports = { createAgentService, MAX_PROMPT, clean };
