'use strict';

/**
 * dashboard/services/qaBatchCommitService.js
 * Áp dụng kế hoạch (PLAN-18 mục 5.7): trong write lock, kiểm file chưa đổi (baseHash), dựng
 * nội dung cuối, snapshot + manifest APPLYING, ghi từng file (tạm + rename), manifest COMMITTED.
 * Lỗi ghi giữa chừng: trả lại nội dung gốc cho các file đã ghi, manifest FAILED, 500 restored.
 */

const fs = require('node:fs');
const path = require('node:path');
const { invalidateQaSummaryCache } = require('./qaService');
const { hashNormalized } = require('./qaFixText');
const { composeForCommit } = require('./qaBatchPlanService');
const {
  httpError,
  requireSession,
  requireRevision,
  transition,
  withWriteLock,
} = require('./qaBatchSessionStore');
const { writeAtomic, writeManifest, snapshotPath } = require('./qaBatchManifest');
const { pruneBackups } = require('./qaBatchRollbackService');
const { findTakenTcs } = require('./qaGuidedFixes');

function assertBody({ acceptedFindingKeys } = {}) {
  if (!Array.isArray(acceptedFindingKeys) || !acceptedFindingKeys.every((k) => typeof k === 'string')) {
    throw httpError(400, 'INVALID_BODY', 'acceptedFindingKeys phải là mảng findingKey.');
  }
}

function staleFiles(files) {
  return files
    .filter((file) => !fs.existsSync(file.absPath) || hashNormalized(fs.readFileSync(file.absPath, 'utf8')) !== file.baseHash)
    .map((file) => file.relPath);
}

/** POST batch-apply. `deps.fsOps` chỉ dùng trong test để giả lập lỗi ghi. */
async function commitPlan(root, body = {}, deps = {}) {
  assertBody(body);
  const { sessionId, revision } = body;
  const accepted = new Set(body.acceptedFindingKeys);
  return withWriteLock(root, async () => {
    const session = requireSession(root, sessionId);
    if (session.state !== 'PLANNED') throw httpError(409, 'INVALID_STATE', 'Kế hoạch đã được áp dụng hoặc đã huỷ.');
    requireRevision(session, revision);
    const targets = [...session.files.values()].filter((f) => [...f.patches.keys()].some((k) => accepted.has(k)));
    if (!targets.length) throw httpError(400, 'NO_PATCH_SELECTED', 'Chưa chọn bản vá nào để áp dụng.');
    const stale = staleFiles(targets);
    if (stale.length) {
      throw httpError(409, 'STALE_FILES', 'File đã thay đổi sau khi lập kế hoạch. Hãy lập lại kế hoạch.', { files: stale });
    }
    const tcIds = targets.flatMap((f) => [...f.patches.values()])
      .filter((p) => p.kind === 'test-khong-co-ma-tc' && accepted.has(p.findingKey) && p.choice.acId)
      .map((p) => p.choice.tcId);
    const taken = findTakenTcs(root, tcIds, session.specPaths || []);
    if (taken.length) {
      throw httpError(409, 'STALE_FILES', 'Mã TC đã giữ chỗ vừa bị dùng ở nơi khác. Hãy lập lại kế hoạch.', {
        files: [], tcs: taken, reason: 'TC_TAKEN',
      });
    }
    transition(session, 'PLANNED', 'APPLYING');

    const composed = composeForCommit(root, session, accepted);
    const notApplied = composed.flatMap((c) => c.notApplied).concat(composed.extraNotApplied || []);
    const writes = composed.filter((c) => c.content !== c.original);
    const appliedFindingKeys = [...new Set(writes.flatMap((c) => c.applied))];
    if (!writes.length) {
      session.state = 'PLANNED';
      return { ok: true, sessionId, appliedFindingKeys: [], notApplied, files: [] };
    }

    const manifest = {
      sessionId,
      status: 'APPLYING',
      createdAt: new Date(session.createdAt).toISOString(),
      appliedFindingKeys,
      files: [],
    };
    for (const write of writes) {
      const snapshot = snapshotPath(root, sessionId, write.file.relPath);
      fs.mkdirSync(path.dirname(snapshot), { recursive: true });
      fs.writeFileSync(snapshot, write.original, 'utf8');
      manifest.files.push({
        relPath: write.file.relPath,
        action: 'modified',
        snapshotRel: path.posix.join('files', write.file.relPath),
        baseHash: write.file.baseHash,
        postHash: hashNormalized(write.content),
      });
    }
    await writeManifest(root, manifest);

    const written = [];
    try {
      for (const write of writes) {
        await writeAtomic(write.file.absPath, write.content, deps.fsOps);
        written.push(write);
      }
    } catch (err) {
      for (const write of written) await writeAtomic(write.file.absPath, write.original);
      manifest.status = 'FAILED';
      manifest.error = err.message;
      await writeManifest(root, manifest);
      session.state = 'FAILED';
      throw httpError(500, 'WRITE_FAILED', `Ghi đĩa lỗi, đã khôi phục nguyên trạng: ${err.message}`, { restored: true });
    }

    manifest.status = 'COMMITTED';
    manifest.committedAt = new Date().toISOString();
    await writeManifest(root, manifest);
    session.state = 'COMMITTED';
    invalidateQaSummaryCache();
    pruneBackups(root);
    return {
      ok: true,
      sessionId,
      appliedFindingKeys,
      notApplied,
      files: writes.map((w) => ({ relPath: w.file.relPath, action: 'modified' })),
    };
  });
}

module.exports = { commitPlan };
