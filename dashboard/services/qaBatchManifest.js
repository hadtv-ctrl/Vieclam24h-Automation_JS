'use strict';

/**
 * dashboard/services/qaBatchManifest.js
 * Snapshot + manifest của mỗi batch trên đĩa (`.dashboard-backups/qa-batch/<sessionId>/`) và
 * ghi file an toàn (file tạm + rename). Manifest là nguồn sự thật sau commit: sống qua restart.
 */

const fs = require('node:fs');
const path = require('node:path');
const { httpError, isValidSessionId } = require('./qaBatchSessionStore');

const BACKUP_SUBDIR = path.join('.dashboard-backups', 'qa-batch');
const TMP_SUFFIX = '.qa-batch-tmp';
const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function batchesRoot(root) {
  return path.join(root, BACKUP_SUBDIR);
}

function batchDir(root, sessionId) {
  if (!isValidSessionId(sessionId)) throw httpError(400, 'INVALID_BODY', 'sessionId không hợp lệ.');
  return path.join(batchesRoot(root), sessionId);
}

/** Đường dẫn tuyệt đối của `relPath`, hoặc ném 403 nếu thoát khỏi project (manifest bị sửa tay...). */
function insideRoot(root, relPath) {
  const base = path.resolve(root);
  const abs = path.resolve(base, String(relPath || ''));
  if (!abs.startsWith(base + path.sep)) throw httpError(403, 'PATH_REJECTED', `Đường dẫn bị từ chối: ${relPath}`);
  return abs;
}

/**
 * Ghi qua file tạm cùng thư mục rồi rename, để một lần ghi hỏng không để lại file dở.
 * Windows hay trả EPERM/EBUSY khi editor/antivirus đang giữ file: thử lại 3 lần, cách 50ms.
 */
async function writeAtomic(absPath, content, fsOps = fs) {
  const tmp = `${absPath}${TMP_SUFFIX}`;
  fsOps.mkdirSync(path.dirname(absPath), { recursive: true });
  fsOps.writeFileSync(tmp, content, 'utf8');
  for (let attempt = 0; ; attempt++) {
    try {
      fsOps.renameSync(tmp, absPath);
      return;
    } catch (err) {
      if (attempt < 3 && RETRYABLE.has(err.code)) {
        await sleep(50);
        continue;
      }
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  }
}

function manifestPath(root, sessionId) {
  return path.join(batchDir(root, sessionId), 'manifest.json');
}

function readManifest(root, sessionId) {
  const file = manifestPath(root, sessionId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function writeManifest(root, manifest) {
  await writeAtomic(manifestPath(root, manifest.sessionId), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Bản gốc trước khi áp dụng batch. */
function snapshotPath(root, sessionId, relPath) {
  return insideRoot(path.join(batchDir(root, sessionId), 'files'), relPath);
}

/** Bản hiện tại của file bị ghi đè khi người dùng xác nhận hoàn tác dù file đã đổi sau batch. */
function preRollbackPath(root, sessionId, relPath) {
  return insideRoot(path.join(batchDir(root, sessionId), 'pre-rollback'), relPath);
}

function listManifests(root) {
  const dir = batchesRoot(root);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!isValidSessionId(name)) continue;
    try {
      const manifest = readManifest(root, name);
      if (manifest) out.push(manifest);
    } catch (_) { /* manifest hỏng: bỏ qua, không chặn các batch khác */ }
  }
  return out;
}

function removeBatch(root, sessionId) {
  fs.rmSync(batchDir(root, sessionId), { recursive: true, force: true });
}

module.exports = {
  TMP_SUFFIX,
  insideRoot,
  writeAtomic,
  readManifest,
  writeManifest,
  snapshotPath,
  preRollbackPath,
  listManifests,
  removeBatch,
};
