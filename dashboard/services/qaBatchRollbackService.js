'use strict';

/**
 * dashboard/services/qaBatchRollbackService.js
 * Hoàn tác batch gần nhất (PLAN-18 mục 5.8) từ manifest trên đĩa — không phụ thuộc RAM nên
 * chạy được sau restart. Không ghi đè thay đổi phát sinh sau batch (so postHash) trừ khi người
 * dùng xác nhận từng file; khi đó bản hiện tại được sao lưu trước.
 */

const fs = require('node:fs');
const path = require('node:path');
const { invalidateQaSummaryCache } = require('./qaService');
const { hashNormalized } = require('./qaFixText');
const { httpError, isValidSessionId, withWriteLock } = require('./qaBatchSessionStore');
const {
  TMP_SUFFIX,
  insideRoot,
  writeAtomic,
  readManifest,
  writeManifest,
  snapshotPath,
  preRollbackPath,
  listManifests,
  removeBatch,
} = require('./qaBatchManifest');

const KEEP_BATCHES = 20;
const KEEP_DAYS = 7;
const recoveredRoots = new Map();

function latestManifest(root) {
  return listManifests(root)
    .filter((m) => m.committedAt)
    .sort((a, b) => String(b.committedAt).localeCompare(String(a.committedAt)))[0] || null;
}

function currentHash(root, relPath) {
  const abs = insideRoot(root, relPath);
  return fs.existsSync(abs) ? hashNormalized(fs.readFileSync(abs, 'utf8')) : null;
}

/** POST batch-rollback. */
async function rollbackBatch(root, { sessionId, forceFiles = [] } = {}) {
  if (!isValidSessionId(sessionId) || !Array.isArray(forceFiles)) {
    throw httpError(400, 'INVALID_BODY', 'Cần sessionId hợp lệ và forceFiles là mảng.');
  }
  return withWriteLock(root, async () => {
    const manifest = readManifest(root, sessionId);
    if (!manifest) throw httpError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy batch để hoàn tác.');
    if (manifest.status === 'ROLLED_BACK') return { ok: true, alreadyRolledBack: true, restoredFiles: [], removedFiles: [] };
    if (manifest.status !== 'COMMITTED') throw httpError(409, 'INVALID_STATE', `Batch đang ở trạng thái ${manifest.status}.`);
    const latest = latestManifest(root);
    if (!latest || latest.sessionId !== sessionId) {
      throw httpError(409, 'NOT_LATEST_BATCH', 'Chỉ hoàn tác được batch gần nhất.');
    }
    const force = new Set(forceFiles);
    const changed = manifest.files.filter((f) => currentHash(root, f.relPath) !== f.postHash).map((f) => f.relPath);
    const blocking = changed.filter((rel) => !force.has(rel));
    if (blocking.length) {
      throw httpError(409, 'ROLLBACK_CONFLICT', 'Các file sau đã bị sửa sau batch; hoàn tác sẽ ghi đè thay đổi đó.', { files: blocking });
    }

    manifest.status = 'ROLLING_BACK';
    await writeManifest(root, manifest);
    for (const rel of changed) {
      const abs = insideRoot(root, rel);
      if (!fs.existsSync(abs)) continue;
      const backup = preRollbackPath(root, sessionId, rel);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(abs, backup);
    }
    const restoredFiles = [];
    const removedFiles = [];
    for (const file of manifest.files) {
      const abs = insideRoot(root, file.relPath);
      if (file.action === 'created') {
        fs.rmSync(abs, { force: true });
        removedFiles.push(file.relPath);
      } else {
        await writeAtomic(abs, fs.readFileSync(snapshotPath(root, sessionId, file.relPath), 'utf8'));
        restoredFiles.push(file.relPath);
      }
    }
    manifest.status = 'ROLLED_BACK';
    manifest.rolledBackAt = new Date().toISOString();
    await writeManifest(root, manifest);
    invalidateQaSummaryCache();
    return { ok: true, alreadyRolledBack: false, restoredFiles, removedFiles };
  });
}

/** GET batch-last: batch commit gần nhất (kể cả đã hoàn tác) để UI biết còn hoàn tác được không. */
function getLatestBatch(root) {
  const latest = latestManifest(root);
  if (!latest) return null;
  return {
    sessionId: latest.sessionId,
    status: latest.status,
    committedAt: latest.committedAt,
    files: latest.files.map((f) => f.relPath),
    appliedCount: (latest.appliedFindingKeys || []).length,
  };
}

/**
 * Batch bị dừng giữa lúc ghi (process chết khi manifest còn APPLYING): trả file về snapshot,
 * xoá file tạm, đánh dấu RECOVERED. Chạy một lần cho mỗi root trong vòng đời process.
 */
async function recoverInterrupted(root) {
  const key = path.resolve(root);
  if (recoveredRoots.has(key)) return recoveredRoots.get(key);
  const recovered = [];
  for (const manifest of listManifests(root).filter((m) => m.status === 'APPLYING')) {
    for (const file of manifest.files) {
      const abs = insideRoot(root, file.relPath);
      const snapshot = snapshotPath(root, manifest.sessionId, file.relPath);
      if (fs.existsSync(snapshot)) await writeAtomic(abs, fs.readFileSync(snapshot, 'utf8'));
      fs.rmSync(`${abs}${TMP_SUFFIX}`, { force: true });
    }
    manifest.status = 'RECOVERED';
    manifest.recoveredAt = new Date().toISOString();
    await writeManifest(root, manifest);
    recovered.push(manifest.sessionId);
  }
  recoveredRoots.set(key, recovered);
  return recovered;
}

/** Giữ 20 batch mới nhất trong 7 ngày; luôn giữ batch commit gần nhất. */
function pruneBackups(root, now = Date.now()) {
  const latest = latestManifest(root);
  const all = listManifests(root).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  all.forEach((manifest, i) => {
    if (latest && manifest.sessionId === latest.sessionId) return;
    const age = now - Date.parse(manifest.createdAt || 0);
    if (i >= KEEP_BATCHES || age > KEEP_DAYS * 86_400_000) removeBatch(root, manifest.sessionId);
  });
}

/** Chỉ dùng trong test. */
function resetRecovery() {
  recoveredRoots.clear();
}

module.exports = { rollbackBatch, getLatestBatch, recoverInterrupted, pruneBackups, resetRecovery };
