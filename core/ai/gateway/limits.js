/**
 * core/ai/gateway/limits.js
 * In-flight AI concurrency limiter (max 2 parallel calls) and task input size guard.
 * Strict ceiling <= 150 lines.
 */
const { createAiError } = require('./errors');

const MAX_CONCURRENT_CALLS = 2;
let activeCalls = 0;

const TASK_LIMITS = {
  inferTestCases: { maxChars: 12000, maxTokensEst: 3000 },
  extractScaffold: { maxChars: 12000, maxTokensEst: 3000 },
  analyzeRequirement: { maxChars: 12000, maxTokensEst: 3000 },
  arbitrateConflict: { maxChars: 6000, maxTokensEst: 1500 },
  inlineSuggest: { maxChars: 2000, maxTokensEst: 500 },
  agentTurn: { maxChars: 32000, maxTokensEst: 8000 }
};

function acquireSlot() {
  if (activeCalls >= MAX_CONCURRENT_CALLS) {
    return {
      acquired: false,
      error: createAiError('BUSY')
    };
  }

  activeCalls++;
  let released = false;

  const release = () => {
    if (!released) {
      released = true;
      activeCalls = Math.max(0, activeCalls - 1);
    }
  };

  return {
    acquired: true,
    release
  };
}

function getActiveCallsCount() {
  return activeCalls;
}

function checkInputSize(task, messages = []) {
  const limits = TASK_LIMITS[task] || TASK_LIMITS.agentTurn;
  let totalChars = 0;

  for (const m of messages) {
    if (m && typeof m.content === 'string') {
      totalChars += m.content.length;
    }
  }

  if (totalChars > limits.maxChars) {
    const estTokens = Math.ceil(totalChars / 4);
    return {
      ok: false,
      error: createAiError('TOO_LARGE', {
        tokens: estTokens
      })
    };
  }

  return { ok: true, totalChars };
}

module.exports = {
  acquireSlot,
  checkInputSize,
  getActiveCallsCount,
  MAX_CONCURRENT_CALLS,
  TASK_LIMITS
};
