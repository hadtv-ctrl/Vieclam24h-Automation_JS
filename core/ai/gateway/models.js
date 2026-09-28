/**
 * core/ai/gateway/models.js
 * Model tier resolution (fast -> qaFast, deep -> qaDeep), 9Router alias caching (5 mins), and fallback.
 * Strict ceiling <= 150 lines.
 */
let aliasCache = {
  models: new Set(),
  expiresAt: 0,
  baseURL: ''
};

async function fetchNineRouterModels(baseURL, apiKey, signal) {
  const now = Date.now();
  if (aliasCache.baseURL === baseURL && aliasCache.expiresAt > now) {
    return aliasCache.models;
  }

  try {
    const targetUrl = `${baseURL.replace(/\/+$/, '')}/models`;
    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: signal || AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      const modelSet = new Set(list.map((m) => (typeof m === 'string' ? m : m.id)));
      aliasCache = {
        models: modelSet,
        expiresAt: now + 5 * 60 * 1000,
        baseURL
      };
      return modelSet;
    }
  } catch (_) {
    // If fetching models fails, fallback smoothly
  }
  return aliasCache.models;
}

function clearAliasCache() {
  aliasCache = { models: new Set(), expiresAt: 0, baseURL: '' };
}

async function pickModel({ tier = 'deep', config = {}, env = process.env, signal } = {}) {
  const fastAlias = env.AI_MODEL_FAST || 'qaFast';
  const deepAlias = env.AI_MODEL_DEEP || 'qaDeep';
  const preferredAlias = tier === 'fast' ? fastAlias : (tier === 'deep' ? deepAlias : null);

  // If tier is specific or provider is not 9Router, use config.model
  if (!preferredAlias || !config.isNineRouter || !config.baseURL) {
    return {
      model: config.model || (config.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
      isAlias: false,
      tier
    };
  }

  // Check if 9Router exposes this alias
  const availableModels = await fetchNineRouterModels(config.baseURL, config.apiKey, signal);
  if (availableModels.has(preferredAlias)) {
    return {
      model: preferredAlias,
      isAlias: true,
      tier
    };
  }

  // Alias not found in 9Router list -> fallback to config.model
  return {
    model: config.model || 'gpt-4o-mini',
    isAlias: false,
    tier
  };
}

module.exports = {
  clearAliasCache,
  fetchNineRouterModels,
  pickModel
};
