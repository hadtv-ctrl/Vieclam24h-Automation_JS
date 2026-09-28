/**
 * core/ai/gateway/usage.js
 * Rolling 5-hour AI token usage ledger and 429 temporary lock tracker.
 * Thread-safe promise-queue mutex and atomic tmp-file rename.
 * Strict ceiling <= 150 lines.
 */
const fs = require('fs');
const path = require('path');

const ROLLING_WINDOW_MS = 5 * 60 * 60 * 1000;
let fileMutex = Promise.resolve();

function getUsageFilePath(root = process.cwd()) {
  return path.join(root, '.tmp', 'ai-usage.json');
}

function readUsageData(root) {
  const filePath = getUsageFilePath(root);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        blockedUntil: Number(data.blockedUntil) || 0
      };
    }
  } catch (_) {}
  return { entries: [], blockedUntil: 0 };
}

function writeUsageDataAtomic(root, data) {
  const filePath = getUsageFilePath(root);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch {
    fs.copyFileSync(tmpPath, filePath);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

async function recordUsage({ root = process.cwd(), task = 'unknown', tokens = 0, estimated = false, blockedUntil = 0 } = {}) {
  fileMutex = fileMutex.then(async () => {
    const data = readUsageData(root);
    const now = Date.now();
    const cutoff = now - ROLLING_WINDOW_MS;

    // Prune entries older than 5 hours
    const freshEntries = data.entries.filter((e) => e && e.t && e.t >= cutoff);

    if (tokens > 0) {
      freshEntries.push({
        t: now,
        task,
        tokens: Number(tokens) || 0,
        estimated: Boolean(estimated)
      });
    }

    const newBlockedUntil = blockedUntil ? Math.max(data.blockedUntil || 0, blockedUntil) : (data.blockedUntil || 0);

    writeUsageDataAtomic(root, {
      entries: freshEntries,
      blockedUntil: newBlockedUntil
    });
  }).catch(() => {});

  return fileMutex;
}

function getUsageStatus({ root = process.cwd(), budget = 1000000, now = Date.now() } = {}) {
  const data = readUsageData(root);
  const cutoff = now - ROLLING_WINDOW_MS;
  const activeEntries = data.entries.filter((e) => e && e.t && e.t >= cutoff);

  let totalTokens = 0;
  let estimatedTokens = 0;
  let oldestEntryAt = null;

  for (const entry of activeEntries) {
    const tok = Number(entry.tokens) || 0;
    totalTokens += tok;
    if (entry.estimated) estimatedTokens += tok;
    if (!oldestEntryAt || entry.t < oldestEntryAt) {
      oldestEntryAt = entry.t;
    }
  }

  const blockedUntil = Number(data.blockedUntil) || 0;
  const isBlocked = blockedUntil > now;
  const remainingTokens = Math.max(0, budget - totalTokens);
  const remainingPercent = budget > 0 ? Math.round((remainingTokens / budget) * 100) : 100;
  const estimatedShare = totalTokens > 0 ? Math.round((estimatedTokens / totalTokens) * 100) : 0;
  const resetsAt = oldestEntryAt ? oldestEntryAt + ROLLING_WINDOW_MS : null;

  return {
    usedTokens: totalTokens,
    budget,
    remainingTokens,
    remainingPercent,
    oldestEntryAt,
    resetsAt,
    estimatedShare,
    blockedUntil,
    isBlocked,
    activeEntryCount: activeEntries.length
  };
}

module.exports = {
  getUsageStatus,
  recordUsage,
  ROLLING_WINDOW_MS
};
