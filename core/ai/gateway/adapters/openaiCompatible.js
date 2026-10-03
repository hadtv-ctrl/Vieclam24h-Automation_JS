/**
 * core/ai/gateway/adapters/openaiCompatible.js
 * Transport adapter for OpenAI-compatible endpoints (including 9Router).
 * Handles timeouts, network errors, rate limits, usage parsing, and abort signals.
 * Strict ceiling <= 150 lines.
 */
const { createAiError } = require('../errors');

function parseResponseBody(rawText, defaultModel) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('data:')) {
    let content = '';
    let toolCalls = null;
    let modelName = defaultModel;
    for (const line of rawText.split(/\r?\n/)) {
      const l = line.trim();
      if (!l.startsWith('data:')) continue;
      const json = l.slice(5).trim();
      if (!json || json === '[DONE]') continue;
      try {
        const chunk = JSON.parse(json);
        if (chunk.model) modelName = chunk.model;
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.tool_calls) toolCalls = delta.tool_calls;
      } catch {}
    }
    return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }], model: modelName };
  }
  return JSON.parse(rawText);
}

async function sendChatCompletion({
  baseURL,
  apiKey,
  model,
  messages = [],
  temperature = 0.2,
  tools = null,
  signal = null,
  timeoutMs = 60000,
  fetchImpl = globalThis.fetch
} = {}) {
  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  const base = baseURL ? baseURL.replace(/\/+$/, '') : 'https://api.openai.com/v1';
  const endpoint = `${base}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const payload = {
    model,
    messages,
    temperature,
    stream: false
  };
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  try {
    const fetchFn = fetchImpl || globalThis.fetch;
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: combinedSignal
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: createAiError('AUTH') };
    }

    if (res.status === 429) {
      const retryHeader = res.headers?.get ? res.headers.get('retry-after') : null;
      const seconds = retryHeader ? Math.max(1, parseInt(retryHeader, 10) || 60) : 60;
      return { ok: false, error: createAiError('RATE_LIMITED', { seconds, retryAfterMs: seconds * 1000 }) };
    }

    if (res.status === 404) {
      return { ok: false, status: 404, notFound: true, error: createAiError('PROVIDER_DOWN', { customMessage: `Model "${model}" không tìm thấy tại endpoint.` }) };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: createAiError('PROVIDER_DOWN', { customMessage: `AI provider trả mã ${res.status}: ${errText.slice(0, 150)}` }) };
    }

    const rawText = await res.text();
    const data = parseResponseBody(rawText, model);
    const choice = data.choices?.[0];
    const message = choice?.message || {};
    const text = typeof message.content === 'string' ? message.content : '';

    const usage = data.usage ? {
      prompt: data.usage.prompt_tokens || 0,
      completion: data.usage.completion_tokens || 0,
      total: data.usage.total_tokens || 0,
      estimated: false
    } : null;

    return {
      ok: true,
      text,
      toolCalls: message.tool_calls || null,
      rawMessage: message,
      usage,
      model: data.model || model
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      const isTimeout = combinedSignal.reason?.name === 'TimeoutError' || err.name === 'TimeoutError';
      if (isTimeout) {
        return { ok: false, error: createAiError('TIMEOUT', { seconds: Math.round(timeoutMs / 1000) }) };
      }
      return { ok: false, error: createAiError('CANCELLED') };
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED') {
      return { ok: false, error: createAiError('PROVIDER_DOWN') };
    }

    return {
      ok: false,
      error: createAiError('PROVIDER_DOWN', {
        customMessage: err.message || 'Không thể kết nối tới nhà cung cấp AI.'
      })
    };
  }
}

module.exports = {
  sendChatCompletion
};
