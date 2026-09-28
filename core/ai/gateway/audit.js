/**
 * core/ai/gateway/audit.js
 * Asynchronous, privacy-safe audit logging for AI Gateway invocations.
 * Logs SHA-256 hashes of prompts (never raw text), rotates logs (>30d or >50MB).
 * Strict ceiling <= 150 lines.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let writeCounter = 0;

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function getAuditDir(root = process.cwd()) {
  return path.join(root, '.tmp', 'ai-audit');
}

function cleanOldAuditFiles(auditDir) {
  try {
    if (!fs.existsSync(auditDir)) return;
    const files = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'));
    const now = Date.now(), maxAge = 30 * 24 * 60 * 60 * 1000;
    let totalBytes = 0;
    const statsList = [];
    for (const f of files) {
      const fullPath = path.join(auditDir, f);
      const stat = fs.statSync(fullPath);
      totalBytes += stat.size;
      statsList.push({ fullPath, mtime: stat.mtimeMs, size: stat.size });
      if (now - stat.mtimeMs > maxAge) fs.unlinkSync(fullPath);
    }
    const MAX_BYTES = 50 * 1024 * 1024;
    if (totalBytes > MAX_BYTES) {
      statsList.sort((a, b) => a.mtime - b.mtime);
      for (const item of statsList) {
        if (totalBytes <= 40 * 1024 * 1024) break;
        if (fs.existsSync(item.fullPath)) {
          fs.unlinkSync(item.fullPath);
          totalBytes -= item.size;
        }
      }
    }
  } catch (_) {}
}

function appendAuditRecord({
  root = process.cwd(), requestId = '', task = 'unknown', provider = 'unknown',
  model = 'unknown', tier = 'deep', aliasFallback = false, promptText = '',
  inputChars = 0, usage = null, durationMs = 0, outcome = 'ok', errorCode = null
} = {}) {
  try {
    const auditDir = getAuditDir(root);
    if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(auditDir, `${today}.jsonl`);
    const record = {
      ts: new Date().toISOString(), requestId, task, provider, model, tier,
      aliasFallback: Boolean(aliasFallback), promptHash: sha256(promptText),
      inputChars: Number(inputChars) || (promptText ? promptText.length : 0),
      usage: usage || null, durationMs: Math.round(durationMs), outcome,
      errorCode: errorCode || null, project: path.basename(root)
    };
    fs.appendFileSync(logFilePath, JSON.stringify(record) + '\n', 'utf8');
    if (++writeCounter % 100 === 0) cleanOldAuditFiles(auditDir);
  } catch (_) {}
}


function readRecentAuditRecords({ root = process.cwd(), limit = 50 } = {}) {
  try {
    const auditDir = getAuditDir(root);
    if (!fs.existsSync(auditDir)) return [];
    const files = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl')).sort().reverse();
    const records = [];
    for (const f of files) {
      const fullPath = path.join(auditDir, f);
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          records.push(JSON.parse(lines[i]));
          if (records.length >= limit) return records;
        } catch (_) {}
      }
    }
    return records;
  } catch (_) {
    return [];
  }
}

function clearAuditLogs({ root = process.cwd() } = {}) {
  try {
    const auditDir = getAuditDir(root);
    if (fs.existsSync(auditDir)) {
      for (const f of fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'))) {
        fs.unlinkSync(path.join(auditDir, f));
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  appendAuditRecord,
  cleanOldAuditFiles,
  readRecentAuditRecords,
  clearAuditLogs,
  sha256
};
