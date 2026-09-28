// master-process-disable-size-check: AI agent service module, queued for modular decomposition
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { maskSecrets } = require('./copilotService');
const { callAi, resolveConfig: resolveGatewayConfig } = require('./gateway/index');
const { getUsageStatus } = require('./gateway/usage');

const execFileAsync = promisify(execFile);
const MAX_PROMPT = 8000;
const MAX_EVENTS = 240;
const MAX_TEXT = 12000;
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

function openAiToolDefinitions() {
  return [
    { type: 'function', function: { name: 'list_files', description: 'List files in a repository directory.', parameters: { type: 'object', properties: { directory: { type: 'string' } } } } },
    { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 text file in the repository.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, startLine: { type: 'integer' }, endLine: { type: 'integer' } } } } },
    { type: 'function', function: { name: 'write_file', description: 'Write a UTF-8 text file in the repository. Do not write secrets.', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } } },
    { type: 'function', function: { name: 'run_command', description: 'Run a finite non-interactive repository command.', parameters: { type: 'object', required: ['command'], properties: { command: { type: 'string' } } } } },
  ];
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

function createAgentService({ root = process.cwd(), env = process.env } = {}) {
  const workspace = path.resolve(root || process.cwd());
  const historyDir = path.join(workspace, '.tmp', 'agent-sessions');
  const sessions = new Map();
  const sessionControllers = new Map();
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
        baseURL: String(clientConfig.baseURL || (provider === '9router' ? 'http://localhost:20128/v1' : '')).trim(),
        model: overrideModel || clientConfig.model || (provider === 'gemini' ? DEFAULT_MODEL : provider === 'deepseek' ? 'deepseek-chat' : provider === '9router' ? 'myCombo' : 'gpt-4o-mini'),
        source: 'client',
      };
    }
    if (!env.GEMINI_API_KEY && !env.AI_API_KEY && !env.OPENAI_API_KEY && !env.DEEPSEEK_API_KEY) reloadEnv();
    const provider = String(env.AI_PROVIDER || (env.AI_BASE_URL?.includes('20128') ? '9router' : (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini'))).toLowerCase();
    const apiKey = env.AI_API_KEY || (provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'openai' || provider === '9router' ? env.OPENAI_API_KEY : provider === 'deepseek' ? env.DEEPSEEK_API_KEY : (env.GEMINI_API_KEY || env.OPENAI_API_KEY));
    const baseURL = String(env.AI_BASE_URL || (provider === '9router' ? 'http://localhost:20128/v1' : '')).trim();
    const model = overrideModel || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || DEFAULT_MODEL) : provider === 'deepseek' ? 'deepseek-chat' : provider === '9router' ? 'myCombo' : 'gpt-4o-mini');
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

  function getQuotaStatus(config, session = null) {
    const budget = Number(process.env.AI_TOKEN_BUDGET_5H || 1000000);
    const usage = getUsageStatus({ root: workspace, budget });
    const sessionTokens = session?.tokenUsage ? {
      promptTokens: session.tokenUsage.promptTokens || 0,
      completionTokens: session.tokenUsage.completionTokens || 0,
      totalTokens: session.tokenUsage.totalTokens || 0,
    } : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
      remainingPercent: usage.remainingPercent,
      usedTokens: usage.usedTokens,
      limitTokens: usage.budget,
      remainingTokens: usage.remainingTokens,
      sessionTokens,
      totalAllTimeTokens: usage.usedTokens,
      rpmLimit: 15,
      rpmUsed: usage.activeEntryCount,
      rpmRemaining: Math.max(0, 15 - usage.activeEntryCount),
      modelName: config?.model || '',
      providerName: config?.provider || 'gemini',
      limitLabel: '1.000.000 TPM / 5h',
      resetsAt: usage.resetsAt,
      isBlocked: usage.isBlocked,
      blockedUntil: usage.blockedUntil,
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

  async function runAgent(session, config, signal) {
    const isTestEnv = Boolean(typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.argv?.some(arg => arg.includes('test'))));
    const systemPrompt = [
      'Bạn là coding agent của Automation Dashboard (Playwright E2E). Trả lời bằng tiếng Việt.',
      'Môi trường chạy: Hệ điều hành Windows (shell cmd.exe). TUYỆT ĐỐI KHÔNG dùng các lệnh Linux như find, grep, ls, cat, touch trong run_command. Ưu tiên dùng các tool list_files và read_file để duyệt/đọc file.',
      'Cấu trúc dự án:',
      '- Page Objects: thư mục pages/ (desktop và mobile-web)',
      '- Test specs E2E: tests/e2e/desktop/*.spec.js (desktop) và tests/e2e/mobile-web/*.spec.js (mobile)',
      '- Test fixtures: core/fixtures/baseTest.js',
      '- Test data: data/*.json',
      'QUY TẮC BẮT BUỘC KHI TẠO HOẶC VIẾT SCRIPT TEST E2E / BDD:',
      '- Khi người dùng yêu cầu tạo, viết hoặc cập nhật script test, bạn BẮT BUỘC PHẢI DÙNG TOOL write_file để ghi file .spec.js thực tế vào tests/e2e/desktop/... hoặc tests/e2e/mobile-web/....',
      '- TUYỆT ĐỐI KHÔNG CHỈ IN CODE DẠNG MARKDOWN TRONG CHAT! Tab "Kịch bản BDD" trên Dashboard chỉ hiển thị các file .spec.js thực sự tồn tại trong thư mục tests/e2e/. Bắt buộc phải gọi write_file để lưu file.',
      '- Luôn dùng cấu trúc chuẩn Playwright Test: require(\'../../../core/fixtures/baseTest\'), test.describe, test.step(\'Given/When/Then ...\') và Page Objects tương ứng.',
      'Được phép đọc/sửa/chạy kiểm thử trong workspace bằng tools. Không đọc secret, không commit/push/install.',
      'Hoàn thành yêu cầu, kiểm tra kết quả và báo cáo rõ đường dẫn file đã tạo/sửa đổi.'
    ].join('\n\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: session.prompt }
    ];

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      if (signal?.aborted) throw fail('Agent đã bị người dùng dừng.', 499);
      if (turn > 0 && !isTestEnv) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const callRes = await callAi({
        task: 'agentCoding',
        messages,
        tools: openAiToolDefinitions(),
        clientConfig: config,
        root: workspace,
        signal,
        tier: 'deep',
        timeoutMs: 60000,
      });

      if (!callRes.ok) {
        if (callRes.error?.code === 'CANCELLED' || signal?.aborted) {
          throw fail('Agent đã bị người dùng dừng.', 499);
        }
        throw fail(callRes.error?.message || callRes.message || 'Lỗi từ nhà cung cấp AI.', 503);
      }

      if (callRes.usage && session.tokenUsage) {
        session.tokenUsage.promptTokens += (callRes.usage.prompt || 0);
        session.tokenUsage.completionTokens += (callRes.usage.completion || 0);
        session.tokenUsage.totalTokens += (callRes.usage.total || 0);
      }

      const calls = callRes.toolCalls || [];
      if (!calls.length) {
        session.summary = clean(callRes.text || '');
        return;
      }

      messages.push(callRes.rawMessage || { role: 'assistant', content: callRes.text, tool_calls: calls });

      for (const call of calls) {
        if (signal?.aborted) throw fail('Agent đã bị người dùng dừng.', 499);
        const fn = call.function || {};
        let args = {};
        try { args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {}); } catch {}
        addEvent(session, { type: 'status', text: `Agent đang gọi tool: ${fn.name}` });
        try {
          const result = await executeTool(workspace, fn.name, args);
          if (fn.name === 'write_file') {
            session.changedFiles.push(result);
            addEvent(session, { type: 'file_change', text: 'Thay đổi file', files: [result] });
          } else if (fn.name === 'run_command') {
            addEvent(session, { type: 'command', text: 'Kết quả lệnh', command: clean(args.command, 2000), output: result.output, exitCode: result.exitCode });
          }
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
    sessions.set(session.id, session);
    const controller = new AbortController();
    sessionControllers.set(session.id, controller);
    active = { session };
    persist(session);
    addEvent(session, { type: 'status', text: `Đang kết nối ${config.provider}…` });
    starting = false;

    const runner = runAgent(session, config, controller.signal);
    runner.then(() => {
      session.status = 'completed';
      addEvent(session, { type: 'status', text: `${config.provider} đã hoàn tất tác vụ.` });
    }).catch(error => {
      if (controller.signal.aborted || error.statusCode === 499) {
        session.status = 'stopped';
        addEvent(session, { type: 'status', text: 'Phiên Agent đã dừng.' });
      } else {
        session.status = 'failed';
        session.error = clean(error.message);
        addEvent(session, { type: 'error', text: session.error });
      }
    }).finally(() => {
      sessionControllers.delete(session.id);
      session.finishedAt = new Date().toISOString();
      persist(session);
      active = null;
    });

    return snapshot(session);
  }

  function stop(id) {
    const session = sessions.get(id);
    if (!session) throw fail('Không tìm thấy phiên Agent.', 404);
    const ctrl = sessionControllers.get(id);
    if (ctrl) {
      ctrl.abort();
      sessionControllers.delete(id);
    }
    session.status = 'stopped';
    session.finishedAt = new Date().toISOString();
    addEvent(session, { type: 'status', text: 'Đã dừng Agent.' });
    if (active?.session.id === id) {
      active = null;
    }
    persist(session);
    return snapshot(session);
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
    const start = Date.now();
    const targetModel = model || (provider === 'gemini' ? DEFAULT_MODEL : 'gpt-4o-mini');
    const testConfig = { provider, apiKey, baseURL, model: targetModel };
    const res = await callAi({
      task: 'inlineSuggest',
      messages: [{ role: 'user', content: 'Ping' }],
      clientConfig: testConfig,
      root: workspace,
      tier: 'fast',
      timeoutMs: 8000,
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      const msg = res.error?.message || res.message || 'Kiểm tra kết nối thất bại.';
      throw fail(`Kiểm tra ${provider} thất bại: ${msg}`, 400);
    }
    return {
      success: true,
      provider: provider === 'gemini' ? 'Google Gemini' : provider,
      model: res.model || targetModel,
      latencyMs: latency,
      message: `Kết nối thành công tới ${provider} (${latency}ms)!`
    };
  }

  async function inlineSuggest({ prefix = '', suffix = '', language = 'javascript', clientConfig = null, model = null, signal = null } = {}) {
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

    const res = await callAi({
      task: 'inlineSuggest',
      messages: [{ role: 'user', content: promptText }],
      clientConfig: config,
      root: workspace,
      signal,
      tier: 'fast',
      timeoutMs: 10000,
      temperature: 0.1,
    });

    if (!res.ok) throw fail(res.error?.message || res.message || 'Lỗi gợi ý AI.', 500);

    let suggestion = (res.text || '').replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '').trimEnd();
    const tokensUsed = res.usage?.total || 0;

    // Post-processing for comment alignment
    if (isCommentLine) {
      if (commentBody.length >= 15) {
        if (!suggestion.startsWith('\n') && /^\s*(await|const|let|var|expect|test|if|for|while|try|return)\b/.test(suggestion)) {
          suggestion = '\n' + indent + suggestion.trimStart();
        }
      } else {
        suggestion = suggestion.replace(/^\s*\/\/\s*/, '');
      }
    } else {
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
      model: res.model,
      provider: config.provider,
    };
  }

  function shutdown() {
    closing = true;
    if (active) stop(active.session.id);
  }

  return { start, stop, status, testConnection, inlineSuggest, get, list, shutdown, isRunning: () => starting || Boolean(active) };
}

module.exports = { createAgentService, MAX_PROMPT, clean };
