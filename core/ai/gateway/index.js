/**
 * core/ai/gateway/index.js
 * Unified AI Gateway entrance (callAi). Coordinates config, limits, model tiers,
 * transport adapters, schema verification, token usage ledger, and audit logging.
 * Strict ceiling <= 150 lines.
 */
const { appendAuditRecord } = require('./audit');
const { resolveConfig } = require('./config');
const { createAiError } = require('./errors');
const { extractJson, validateShape } = require('./json');
const { acquireSlot, checkInputSize } = require('./limits');
const { pickModel } = require('./models');
const { getUsageStatus, recordUsage } = require('./usage');
const { sendChatCompletion } = require('./adapters/openaiCompatible');
const { sendGeminiContent } = require('./adapters/gemini');

async function executeAdapterCall({ config, model, messages, tools, signal, timeoutMs, temperature }) {
  if (config.provider === 'gemini' && !config.isNineRouter) {
    return sendGeminiContent({ baseURL: config.baseURL, apiKey: config.apiKey, model, messages, tools, signal, timeoutMs });
  }
  return sendChatCompletion({ baseURL: config.baseURL, apiKey: config.apiKey, model, messages, tools, signal, timeoutMs, temperature });
}

async function callAi({
  task = 'inferTestCases',
  messages = [],
  schema = null,
  clientConfig = null,
  root = process.cwd(),
  signal = null,
  tools = null,
  tier = 'deep',
  timeoutMs = 60000,
  temperature = 0.2
} = {}) {
  const startTs = Date.now();
  const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const promptText = messages.map((m) => m?.content || '').join('\n');

  const sizeCheck = checkInputSize(task, messages);
  if (!sizeCheck.ok) {
    appendAuditRecord({ root, requestId, task, promptText, outcome: 'error', errorCode: sizeCheck.error.code });
    return sizeCheck.error;
  }

  const configRes = resolveConfig({ clientConfig, env: process.env, root });
  if (!configRes.ok) {
    appendAuditRecord({ root, requestId, task, promptText, outcome: 'error', errorCode: configRes.error.code });
    return configRes.error;
  }
  const config = configRes;

  const usageState = getUsageStatus({ root });
  if (usageState.isBlocked) {
    const err = createAiError('RATE_LIMITED', { seconds: Math.ceil((usageState.blockedUntil - Date.now()) / 1000) });
    appendAuditRecord({ root, requestId, task, promptText, outcome: 'error', errorCode: 'RATE_LIMITED' });
    return err;
  }

  const slot = acquireSlot();
  if (!slot.acquired) {
    appendAuditRecord({ root, requestId, task, promptText, outcome: 'error', errorCode: slot.error.code });
    return slot.error;
  }

  let aliasFallback = false;
  try {
    let picked = await pickModel({ tier, config, signal });
    let modelToCall = picked.model;
    let res = await executeAdapterCall({ config, model: modelToCall, messages, tools, signal, timeoutMs, temperature });

    // Handle 404 missing alias fallback to settings model
    if (!res.ok && res.notFound && picked.isAlias) {
      aliasFallback = true;
      modelToCall = config.model || 'gpt-4o-mini';
      res = await executeAdapterCall({ config, model: modelToCall, messages, tools, signal, timeoutMs, temperature });
    }

    if (!res.ok) {
      if (res.error.code === 'RATE_LIMITED' && res.error.retryAfterMs) {
        recordUsage({ root, task, tokens: 0, blockedUntil: Date.now() + res.error.retryAfterMs });
      }
      const outcome = res.error.code === 'CANCELLED' ? 'cancelled' : (res.error.code === 'TIMEOUT' ? 'timeout' : 'error');
      appendAuditRecord({ root, requestId, task, provider: config.provider, model: modelToCall, tier, promptText, durationMs: Date.now() - startTs, outcome, errorCode: res.error.code });
      return res.error;
    }

    let parsedData = null;
    if (schema) {
      const parseTry = () => {
        const extracted = extractJson(res.text);
        const check = validateShape(schema, extracted);
        if (!check.valid) throw new Error(check.error);
        return extracted;
      };
      try {
        parsedData = parseTry();
      } catch (_) {
        // Retry once with schema correction hint
        const retryMessages = [...messages, { role: 'assistant', content: res.text }, { role: 'user', content: 'Output strictly valid JSON matching schema.' }];
        const retryRes = await executeAdapterCall({ config, model: modelToCall, messages: retryMessages, tools, signal, timeoutMs, temperature });
        if (retryRes.ok) {
          try {
            res = retryRes;
            parsedData = parseTry();
          } catch { parsedData = null; }
        }
      }
      if (!parsedData) {
        appendAuditRecord({ root, requestId, task, provider: config.provider, model: modelToCall, tier, promptText, durationMs: Date.now() - startTs, outcome: 'bad_output', errorCode: 'BAD_OUTPUT' });
        return createAiError('BAD_OUTPUT');
      }
    }

    const durationMs = Date.now() - startTs;
    const estTokens = Math.ceil(((promptText.length + (res.text?.length || 0))) / 4);
    const finalUsage = res.usage || { prompt: Math.ceil(promptText.length / 4), completion: Math.ceil((res.text?.length || 0) / 4), total: estTokens, estimated: true };

    recordUsage({ root, task, tokens: finalUsage.total, estimated: finalUsage.estimated });
    appendAuditRecord({ root, requestId, task, provider: config.provider, model: modelToCall, tier, aliasFallback, promptText, inputChars: promptText.length, usage: finalUsage, durationMs, outcome: 'ok' });

    return {
      ok: true,
      data: parsedData,
      text: res.text,
      toolCalls: res.toolCalls,
      rawMessage: res.rawMessage,
      model: modelToCall,
      tier,
      aliasFallback,
      usage: finalUsage,
      requestId,
      durationMs
    };
  } finally {
    slot.release();
  }
}

module.exports = {
  callAi,
  resolveConfig
};
