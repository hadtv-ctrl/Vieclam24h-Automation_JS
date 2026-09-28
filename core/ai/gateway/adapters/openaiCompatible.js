/**
 * core/ai/gateway/adapters/openaiCompatible.js
 * Transport adapter for OpenAI-compatible endpoints (including 9Router).
 * Handles timeouts, network errors, rate limits, usage parsing, and abort signals.
 * Strict ceiling <= 150 lines.
 */
const { createAiError } = require('../errors');

async function sendChatCompletion({
  baseURL,
  apiKey,
  model,
  messages = [],
  temperature = 0.2,
  tools = null,
  signal = null,
  timeoutMs = 60000
} = {}) {
  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const payload = {
    model,
    messages,
    temperature
  };
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: combinedSignal
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: createAiError('AUTH') };
    }

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const seconds = retryHeader ? Math.max(1, parseInt(retryHeader, 10) || 60) : 60;
      return {
        ok: false,
        error: createAiError('RATE_LIMITED', {
          seconds,
          retryAfterMs: seconds * 1000
        })
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        notFound: true,
        error: createAiError('PROVIDER_DOWN', {
          customMessage: `Model "${model}" không tìm thấy tại endpoint.`
        })
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        error: createAiError('PROVIDER_DOWN', {
          customMessage: `AI provider trả mã ${res.status}: ${errText.slice(0, 150)}`
        })
      };
    }

    const data = await res.json();
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
        return {
          ok: false,
          error: createAiError('TIMEOUT', { seconds: Math.round(timeoutMs / 1000) })
        };
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
