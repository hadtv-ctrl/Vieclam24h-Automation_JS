/**
 * dashboard/routes/aiRoutes.js
 * Handles AI configuration, Copilot suggestions, AI test connection, and diagnostics.
 */
const fs = require('fs');
const path = require('path');
const { createCopilotService } = require('../../core/ai/copilotService');
const { analyzeDiagnostics } = require('../../core/diagnostics/diagnosticsAnalyzer');
const { sendJson, parseBody, abortSignalFor } = require('./routeUtils');
const { getUsageStatus } = require('../../core/ai/gateway/usage');
const { heuristicTriage } = require('../../core/ai/tasks/triageFailure');
const {
  isCrossSiteRequest, resolveModelsRequest, resolveTestConnection, validateConfigBody,
} = require('../services/aiEndpointPolicy');
const { handleAiFastWinsRoutes } = require('./aiFastWinsRoutes');
const { handleAiProductivityRoutes } = require('./aiProductivityRoutes');
const { handleAiExtendedRoutes } = require('./aiExtendedRoutes');

const copilotService = createCopilotService({ quota: Number(process.env.DASHBOARD_AI_QUOTA || 20) });

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((l) => {
    const t = l.trim();
    if (t && !t.startsWith('#') && t.includes('=')) {
      const i = t.indexOf('=');
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
  return env;
}

const writeEnvFile = (p, o) => fs.writeFileSync(p, Object.entries(o).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', 'utf8');

function readClientConfig(request) {
  if (!request.headers['x-ai-config']) return null;
  try { return JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch { return null; }
}

async function handleAiRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const agentService = context.agentService;

  if (url.pathname.startsWith('/api/ai/') && isCrossSiteRequest(request.headers)) {
    return sendJson(response, 403, { error: 'Yêu cầu tới cấu hình AI phải xuất phát từ chính Dashboard.' }) || true;
  }

  if (await handleAiFastWinsRoutes(request, response, url, context)) return true;
  if (await handleAiProductivityRoutes(request, response, url, readClientConfig(request))) return true;
  if (await handleAiExtendedRoutes(request, response, url, readClientConfig(request))) return true;

  if (request.method === 'GET' && url.pathname === '/api/ai/config') {
    const env = parseEnvFile(path.join(root, '.env'));
    const activeKey = env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY || '';
    const provider = env.AI_PROVIDER || (env.AI_BASE_URL && env.AI_BASE_URL.includes('20128') ? '9router' : (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini'));
    const model = env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : provider === '9router' ? 'myCombo' : 'gpt-4o-mini');
    return sendJson(response, 200, {
      provider, baseURL: env.AI_BASE_URL || (provider === '9router' ? 'http://localhost:20128/v1' : ''), model, hasKey: Boolean(activeKey),
      maskedKey: activeKey ? `${activeKey.slice(0, 6)}...${activeKey.slice(-4)}` : '',
    }) || true;
  }

  if (request.method === 'GET' && url.pathname === '/api/ai/models') {
    try {
      const env = parseEnvFile(path.join(root, '.env'));
      const target = resolveModelsRequest({
        baseURL: url.searchParams.get('baseURL'),
        queryKey: url.searchParams.get('apiKey'),
        clientKey: readClientConfig(request)?.apiKey,
        env,
      });
      if (!target.ok) return sendJson(response, target.status, { success: false, error: target.error, models: [] }) || true;
      const resp = await fetch(`${target.base}/models`, {
        method: 'GET',
        headers: target.key ? { 'Authorization': `Bearer ${target.key}` } : {},
        signal: AbortSignal.timeout(4000),
      });
      if (!resp.ok) return sendJson(response, 200, { success: false, error: `HTTP ${resp.status}`, models: [] }) || true;
      const data = await resp.json();
      const models = Array.isArray(data.data) ? data.data.map(m => m.id).filter(Boolean) : [];
      return sendJson(response, 200, { success: true, count: models.length, models }) || true;
    } catch (e) {
      return sendJson(response, 200, { success: false, error: e.message, models: [] }) || true;
    }
  }

  if ((request.method === 'PUT' || request.method === 'POST') && url.pathname === '/api/ai/config') {
    try {
      const body = await parseBody(request);
      const check = validateConfigBody(body);
      if (!check.ok) return sendJson(response, check.status, { error: check.error }) || true;
      const envPath = path.join(root, '.env');
      const current = parseEnvFile(envPath);
      if (body.provider) current.AI_PROVIDER = body.provider;
      if (body.baseURL !== undefined) {
        current.AI_BASE_URL = (body.provider === 'gemini' && body.baseURL && !body.baseURL.includes('googleapis') && !body.baseURL.includes('gemini')) ? '' : body.baseURL;
      }
      if (body.model) {
        current.AI_MODEL = body.model;
        if (body.provider === 'gemini') current.DASHBOARD_GEMINI_MODEL = body.model;
      }
      if (body.apiKey && !body.apiKey.includes('...')) {
        current.AI_API_KEY = body.apiKey;
        if (body.provider === 'gemini') current.GEMINI_API_KEY = body.apiKey;
        else if (body.provider === 'openai') current.OPENAI_API_KEY = body.apiKey;
        else if (body.provider === 'deepseek') current.DEEPSEEK_API_KEY = body.apiKey;
        else if (body.provider === '9router') current.OPENAI_API_KEY = body.apiKey;
      }
      writeEnvFile(envPath, current);
      try { require('dotenv').config({ path: envPath, override: true }); } catch {}
      sendJson(response, 200, { message: 'Đã lưu cấu hình AI vào file .env thành công!' });
    } catch (e) { sendJson(response, 400, { error: `Không thể lưu cấu hình AI: ${e.message}` }); }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/test-connection') {
    try {
      const body = await parseBody(request);
      const target = resolveTestConnection({ body, env: parseEnvFile(path.join(root, '.env')) });
      if (!target.ok) return sendJson(response, target.status, { error: target.error }) || true;
      const result = await agentService.testConnection({
        provider: target.provider, apiKey: target.apiKey, baseURL: target.baseURL, model: target.model,
      });
      sendJson(response, 200, result);
    } catch (e) { sendJson(response, 400, { error: e.message || 'Kiểm tra kết nối thất bại.' }); }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/ai/usage') {
    const budget = Number(process.env.AI_TOKEN_BUDGET_5H || 1_000_000);
    const usage = getUsageStatus({ root, budget });
    return sendJson(response, 200, usage) || true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/inline-suggest') {
    try {
      const body = await parseBody(request, 64 * 1024);
      const clientConfig = body.clientConfig || readClientConfig(request);
      const signal = abortSignalFor(request, response);
      const result = await agentService.inlineSuggest({
        prefix: body.prefix, suffix: body.suffix, language: body.language, clientConfig, model: body.model, signal,
      });
      sendJson(response, 200, result);
    } catch (e) { sendJson(response, 200, { success: false, suggestion: '', error: e.message }); }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/generate-state') {
    try {
      const body = await parseBody(request, 64 * 1024);
      const result = await copilotService.generateState({ prompt: body.prompt, context: body.context });
      sendJson(response, 200, result);
    } catch (e) { sendJson(response, 422, { error: e.message, valid: false }); }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/diagnostics/analyze') {
    try {
      const body = await parseBody(request, 128 * 1024);
      sendJson(response, 200, analyzeDiagnostics(body));
    } catch (e) { sendJson(response, 422, { error: e.message }); }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/diagnostics/triage') {
    try {
      const body = await parseBody(request, 128 * 1024);
      const result = heuristicTriage({
        errorText: [body.error, body.message, body.stack].filter(Boolean).join('\n'),
        testTitle: body.testTitle || '',
        locator: body.locator || '',
        snippet: body.snippet || '',
        consoleLogs: body.consoleLogs || '',
        url: body.url || '',
        status: body.status || '',
        retry: body.retry || 0,
      });
      sendJson(response, 200, result);
    } catch (e) { sendJson(response, 422, { error: e.message }); }
    return true;
  }

  return false;
}

module.exports = { handleAiRoutes, parseEnvFile, writeEnvFile };
