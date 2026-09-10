/**
 * dashboard/routes/aiRoutes.js
 * Handles AI configuration, Copilot suggestions, AI test connection, and diagnostics.
 */
const fs = require('fs');
const path = require('path');
const { createCopilotService } = require('../../core/ai/copilotService');
const { analyzeDiagnostics } = require('../../core/diagnostics/diagnosticsAnalyzer');
const { sendJson, parseBody } = require('./routeUtils');

const copilotService = createCopilotService({ quota: Number(process.env.DASHBOARD_AI_QUOTA || 20) });

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i !== -1) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
  return env;
}

function writeEnvFile(filePath, envObj) {
  fs.writeFileSync(filePath, Object.entries(envObj).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', 'utf8');
}

async function handleAiRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const agentService = context.agentService;

  if (request.method === 'GET' && url.pathname === '/api/ai/config') {
    const env = parseEnvFile(path.join(root, '.env'));
    const activeKey = env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY || '';
    const provider = env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
    const model = env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    return sendJson(response, 200, {
      provider, baseURL: env.AI_BASE_URL || '', model, hasKey: Boolean(activeKey),
      maskedKey: activeKey ? `${activeKey.slice(0, 6)}...${activeKey.slice(-4)}` : '',
    }) || true;
  }

  if ((request.method === 'PUT' || request.method === 'POST') && url.pathname === '/api/ai/config') {
    try {
      const body = await parseBody(request);
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
      let keyToTest = body.apiKey;
      if (!keyToTest || keyToTest.includes('...')) {
        const env = parseEnvFile(path.join(root, '.env'));
        keyToTest = env.AI_API_KEY || (body.provider === 'gemini' ? env.GEMINI_API_KEY : body.provider === 'openai' ? env.OPENAI_API_KEY : body.provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.GEMINI_API_KEY);
      }
      const result = await agentService.testConnection({
        provider: body.provider, apiKey: keyToTest, baseURL: body.baseURL, model: body.model,
      });
      sendJson(response, 200, result);
    } catch (e) { sendJson(response, 400, { error: e.message || 'Kiểm tra kết nối thất bại.' }); }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/inline-suggest') {
    try {
      const body = await parseBody(request, 64 * 1024);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await agentService.inlineSuggest({
        prefix: body.prefix, suffix: body.suffix, language: body.language, clientConfig, model: body.model,
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

  return false;
}

module.exports = { handleAiRoutes, parseEnvFile, writeEnvFile };
