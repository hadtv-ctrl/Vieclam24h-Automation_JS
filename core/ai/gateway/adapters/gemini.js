/**
 * core/ai/gateway/adapters/gemini.js
 * Transport adapter for Google Gemini native API format.
 * Strict ceiling <= 150 lines.
 */
const { createAiError } = require('../errors');

function convertMessagesToGemini(messages = []) {
  const contents = [];
  let systemInstruction = null;

  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'system') {
      systemInstruction = { parts: [{ text: String(m.content || '') }] };
    } else {
      const role = m.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: String(m.content || '') }]
      });
    }
  }

  return { contents, systemInstruction };
}

function convertToolsToGemini(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  if (tools[0]?.functionDeclarations) return tools;
  const decls = tools.map((t) => t.function || t).filter(Boolean);
  return decls.length > 0 ? [{ functionDeclarations: decls }] : null;
}

async function sendGeminiContent({
  baseURL = '',
  apiKey,
  model = 'gemini-2.5-flash',
  messages = [],
  tools = null,
  signal = null,
  timeoutMs = 60000
} = {}) {
  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  const base = baseURL ? baseURL.replace(/\/+$/, '') : 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey || '')}`;
  const { contents, systemInstruction } = convertMessagesToGemini(messages);

  const payload = { contents };
  if (systemInstruction) payload.systemInstruction = systemInstruction;
  const geminiTools = convertToolsToGemini(tools);
  if (geminiTools) payload.tools = geminiTools;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        error: createAiError('PROVIDER_DOWN', {
          customMessage: `Gemini API trả mã ${res.status}: ${errText.slice(0, 150)}`
        })
      };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || '';
    const calls = (candidate?.content?.parts || []).filter((p) => p.functionCall).map((p) => ({
      id: p.functionCall.name,
      function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) }
    }));

    const meta = data.usageMetadata;
    const usage = meta ? {
      prompt: meta.promptTokenCount || 0,
      completion: meta.candidatesTokenCount || 0,
      total: meta.totalTokenCount || 0,
      estimated: false
    } : null;

    return {
      ok: true,
      text: textPart,
      toolCalls: calls.length > 0 ? calls : null,
      rawMessage: candidate?.content,
      usage,
      model
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
        customMessage: err.message || 'Không thể kết nối tới Google Generative Language API.'
      })
    };
  }
}

module.exports = {
  convertMessagesToGemini,
  sendGeminiContent
};
