/**
 * core/ai/gateway/config.js
 * Resolves AI provider, baseURL, apiKey, and model from personal clientConfig or server .env.
 * Enforces key containment policy: server key never leaks to unapproved endpoints.
 * Strict ceiling <= 150 lines.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_9ROUTER_BASE,
  isNineRouter: checkIsNineRouter,
  mayUseServerKey,
  parseHttpUrl,
  sameEndpoint,
  serverBaseUrl
} = require('./endpointPolicy');
const { createAiError } = require('./errors');

function readEnvFile(root) {
  if (!root) return {};
  try {
    const envPath = path.join(root, '.env');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const result = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function resolveConfig({ clientConfig = null, env = process.env, root = null } = {}) {
  const rootEnv = root ? readEnvFile(root) : {};
  const effectiveEnv = { ...env, ...rootEnv };

  // 1. Personal client configuration has priority if an API key is provided
  if (clientConfig && clientConfig.apiKey && String(clientConfig.apiKey).trim()) {
    const rawProvider = String(clientConfig.provider || effectiveEnv.AI_PROVIDER || 'openai').toLowerCase();
    const rawBaseUrl = clientConfig.baseURL ? String(clientConfig.baseURL).trim() : '';
    const baseURL = rawBaseUrl || (rawProvider === '9router' ? DEFAULT_9ROUTER_BASE : '');
    const apiKey = String(clientConfig.apiKey).trim();
    const model = clientConfig.model || effectiveEnv.AI_MODEL || '';

    const parsed = baseURL ? parseHttpUrl(baseURL) : null;
    const isNineRouter = rawProvider === '9router' || (parsed ? checkIsNineRouter(parsed) : false);

    return {
      ok: true,
      provider: isNineRouter ? '9router' : rawProvider,
      baseURL,
      apiKey,
      model,
      isNineRouter,
      scope: 'personal'
    };
  }

  // 2. Server configuration fallback
  const rawProvider = String(effectiveEnv.AI_PROVIDER || 'gemini').toLowerCase();
  const savedBase = serverBaseUrl(effectiveEnv);
  const requestedBase = clientConfig?.baseURL ? String(clientConfig.baseURL).trim() : savedBase;

  // Server key only travels to its saved endpoint
  if (!mayUseServerKey(requestedBase, effectiveEnv)) {
    return {
      ok: false,
      error: createAiError('AUTH', {
        customMessage: 'Chưa cấu hình API Key: Không thể sử dụng API Key máy chủ cho endpoint lạ không được cấp quyền.'
      })
    };
  }

  const parsedBase = requestedBase ? parseHttpUrl(requestedBase) : null;
  const isNineRouter = rawProvider === '9router' || (parsedBase ? checkIsNineRouter(parsedBase) : false);
  const provider = isNineRouter ? '9router' : rawProvider;

  const apiKey = effectiveEnv.AI_API_KEY || (provider === 'gemini'
    ? effectiveEnv.GEMINI_API_KEY
    : provider === 'openai' || provider === '9router'
      ? (effectiveEnv.OPENAI_API_KEY || effectiveEnv.AI_API_KEY)
      : (effectiveEnv.DEEPSEEK_API_KEY || effectiveEnv.AI_API_KEY)) || '';

  if (!apiKey || !apiKey.trim()) {
    return {
      ok: false,
      error: createAiError('NOT_CONFIGURED')
    };
  }

  const model = clientConfig?.model || effectiveEnv.AI_MODEL || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');

  return {
    ok: true,
    provider,
    baseURL: requestedBase || (isNineRouter ? DEFAULT_9ROUTER_BASE : ''),
    apiKey: apiKey.trim(),
    model,
    isNineRouter,
    scope: 'server'
  };
}

module.exports = {
  readEnvFile,
  resolveConfig
};
