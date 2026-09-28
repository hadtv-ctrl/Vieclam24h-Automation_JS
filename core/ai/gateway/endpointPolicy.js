/**
 * core/ai/gateway/endpointPolicy.js
 * Which AI endpoints the gateway/server may call, and which key may travel with the call.
 * Safe for use across core and dashboard.
 * Strict ceiling <= 150 lines.
 */
const DEFAULT_9ROUTER_BASE = 'http://localhost:20128/v1';
const NINE_ROUTER_PORT = '20128';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const OFFICIAL_ORIGINS = new Set([
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
  'https://api.deepseek.com',
  'https://api.anthropic.com',
]);
const UNSAFE_ENV_CHARS = /[\r\n\0]/;

function parseHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function endpointId(url) {
  const host = LOOPBACK_HOSTS.has(url.hostname) ? 'loopback' : url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  return `${url.protocol}//${host}:${port}`;
}

function sameEndpoint(a, b) {
  const left = typeof a === 'string' ? parseHttpUrl(a) : a;
  const right = typeof b === 'string' ? parseHttpUrl(b) : b;
  return Boolean(left && right) && endpointId(left) === endpointId(right);
}

function isNineRouter(url) {
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) && url.port === NINE_ROUTER_PORT;
}

function serverBaseUrl(env = {}) {
  if (env.AI_BASE_URL) return env.AI_BASE_URL;
  return String(env.AI_PROVIDER || '').toLowerCase() === '9router' ? DEFAULT_9ROUTER_BASE : '';
}

function mayUseServerKey(requestedBaseURL, env = {}) {
  return !requestedBaseURL || sameEndpoint(requestedBaseURL, serverBaseUrl(env));
}

function isAllowedModelsBase(url, env = {}) {
  return isNineRouter(url) || OFFICIAL_ORIGINS.has(url.origin) || sameEndpoint(url, serverBaseUrl(env));
}

function reject(status, error) {
  return { ok: false, status, error };
}

function resolveModelsRequest({ baseURL, queryKey, clientKey, env = {} } = {}) {
  if (queryKey) return reject(400, 'Không gửi API key qua URL. Dashboard đọc key từ cấu hình đã lưu.');
  const url = parseHttpUrl(baseURL || env.AI_BASE_URL || DEFAULT_9ROUTER_BASE);
  if (!url) return reject(400, 'Base URL không hợp lệ: chỉ nhận địa chỉ http:// hoặc https://.');
  if (!isAllowedModelsBase(url, env)) {
    return reject(400, 'Base URL không được phép. Chỉ nhận 9Router ở cổng 20128, API chính thức của nhà cung cấp, hoặc Base URL đã lưu trong Cấu hình AI.');
  }
  const serverKey = env.AI_API_KEY || env.OPENAI_API_KEY || '';
  const key = clientKey || (sameEndpoint(url, serverBaseUrl(env)) ? serverKey : '');
  return { ok: true, base: url.href.replace(/\/+$/, ''), key };
}

function isMaskedKey(value) {
  return !value || String(value).includes('...');
}

function resolveTestConnection({ body = {}, env = {} } = {}) {
  const provider = body.provider || env.AI_PROVIDER || 'gemini';
  const baseURL = body.baseURL ? String(body.baseURL).trim() : (env.AI_BASE_URL || '');
  const model = body.model || env.AI_MODEL || '';
  if (baseURL && !parseHttpUrl(baseURL)) return reject(400, 'Base URL không hợp lệ: chỉ nhận địa chỉ http:// hoặc https://.');
  if (!isMaskedKey(body.apiKey)) return { ok: true, provider, baseURL, model, apiKey: String(body.apiKey).trim() };

  const savedBase = serverBaseUrl(env);
  if (baseURL && !sameEndpoint(baseURL, savedBase)) {
    return reject(400, 'Base URL khác với cấu hình đã lưu. Hãy nhập API Key để kiểm tra endpoint mới.');
  }
  const apiKey = env.AI_API_KEY || (provider === 'gemini' ? env.GEMINI_API_KEY
    : provider === 'openai' ? env.OPENAI_API_KEY
      : provider === 'deepseek' ? env.DEEPSEEK_API_KEY
        : env.GEMINI_API_KEY);
  return { ok: true, provider, baseURL, model, apiKey };
}

function validateConfigBody(body = {}) {
  for (const field of ['provider', 'baseURL', 'model', 'apiKey']) {
    if (body[field] !== undefined && body[field] !== null && UNSAFE_ENV_CHARS.test(String(body[field]))) {
      return reject(400, `Giá trị "${field}" không được chứa ký tự xuống dòng.`);
    }
  }
  if (body.baseURL && !parseHttpUrl(body.baseURL)) {
    return reject(400, 'Base URL không hợp lệ: chỉ nhận địa chỉ http:// hoặc https://.');
  }
  return { ok: true };
}

function isCrossSiteRequest(headers = {}) {
  const site = headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return true;

  const host = parseHttpUrl(`http://${headers.host || ''}`);
  if (!host || !LOOPBACK_HOSTS.has(host.hostname)) return true;

  const origin = headers.origin;
  if (origin === undefined) return false;
  const originUrl = parseHttpUrl(origin);
  return !originUrl || originUrl.host !== host.host;
}

module.exports = {
  DEFAULT_9ROUTER_BASE,
  isCrossSiteRequest,
  isNineRouter,
  mayUseServerKey,
  parseHttpUrl,
  resolveModelsRequest,
  resolveTestConnection,
  sameEndpoint,
  serverBaseUrl,
  validateConfigBody,
};
