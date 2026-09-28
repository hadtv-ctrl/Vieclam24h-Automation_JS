'use strict';

/** PLAN-18 Phase 2 — hoàn tác, phục hồi sau khi process dừng giữa chừng, dọn snapshot. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPlan } = require('./qaBatchPlanService');
const { commitPlan } = require('./qaBatchCommitService');
const { rollbackBatch, getLatestBatch, recoverInterrupted, pruneBackups, resetRecovery } = require('./qaBatchRollbackService');
const { resetSessions } = require('./qaBatchSessionStore');
const { readManifest, listManifests } = require('./qaBatchManifest');
const { makeWorkspace, finding, indexOf } = require('../../tests/dashboard/support/batchTestUtils');

const spec = (name) => [
  `test.describe('${name} @REQ-001', () => {`,
  "  test('TC-001 - AC-001 x', async ({ page }) => {",
  `    expect(page.locator('#${name}')).toBeVisible();`,
  '  });',
  '});',
  '',
].join('\n');
const A = 'tests/e2e/a.spec.js';
const B = 'tests/e2e/b.spec.js';

async function commitOne(ws, rel) {
  const index = indexOf([finding('assertion-thieu-await', `${rel}:3`)]);
  const plan = buildPlan(ws.root, index.list.map((f) => f.findingKey), { findingsIndex: index });
  return commitPlan(ws.root, {
    sessionId: plan.session.sessionId,
    revision: plan.session.revision,
    acceptedFindingKeys: index.list.map((f) => f.findingKey),
  });
}

test('chỉ hoàn tác batch gần nhất; chạy được khi RAM trống; gọi lại không lỗi (BATCH-22, 24, 25)', async () => {
  const ws = makeWorkspace({ [A]: spec('a'), [B]: spec('b') });
  try {
    const first = await commitOne(ws, A);
    const second = await commitOne(ws, B);
    await assert.rejects(rollbackBatch(ws.root, { sessionId: first.sessionId }), { status: 409, code: 'NOT_LATEST_BATCH' });

    resetSessions();
    const res = await rollbackBatch(ws.root, { sessionId: second.sessionId });
    assert.deepEqual(res, { ok: true, alreadyRolledBack: false, restoredFiles: [B], removedFiles: [] });
    assert.equal(ws.read(B), spec('b'));
    assert.ok(ws.read(A).includes('await expect'), 'batch cũ hơn không bị động tới');
    assert.equal(readManifest(ws.root, second.sessionId).status, 'ROLLED_BACK');
    assert.equal(getLatestBatch(ws.root).status, 'ROLLED_BACK');

    const again = await rollbackBatch(ws.root, { sessionId: second.sessionId });
    assert.equal(again.alreadyRolledBack, true);
    await assert.rejects(rollbackBatch(ws.root, { sessionId: '../x' }), { status: 400 });
    await assert.rejects(rollbackBatch(ws.root, { sessionId: 'qb-000000-aaaaaa' }), { status: 404, code: 'SESSION_NOT_FOUND' });
  } finally {
    ws.cleanup();
  }
});

test('file bị sửa sau batch: 409 kèm danh sách; xác nhận thì sao lưu bản hiện tại rồi hoàn tác (BATCH-23)', async () => {
  const ws = makeWorkspace({ [A]: spec('a') });
  try {
    const batch = await commitOne(ws, A);
    const edited = `${ws.read(A)}// sửa sau batch\n`;
    ws.write(A, edited);
    await assert.rejects(rollbackBatch(ws.root, { sessionId: batch.sessionId }),
      (err) => err.status === 409 && err.code === 'ROLLBACK_CONFLICT' && err.details.files[0] === A);
    assert.equal(ws.read(A), edited, 'không ghi đè khi chưa xác nhận');

    const res = await rollbackBatch(ws.root, { sessionId: batch.sessionId, forceFiles: [A] });
    assert.deepEqual(res.restoredFiles, [A]);
    assert.equal(ws.read(A), spec('a'));
    const backup = path.join(ws.root, '.dashboard-backups', 'qa-batch', batch.sessionId, 'pre-rollback', A);
    assert.equal(fs.readFileSync(backup, 'utf8'), edited);
  } finally {
    ws.cleanup();
  }
});

test('manifest APPLYING còn sót: request đầu tiên trả file về snapshot, xoá file tạm (BATCH-21)', async () => {
  const ws = makeWorkspace({ [A]: 'đang ghi dở\n', [`${A}.qa-batch-tmp`]: 'tạm\n' });
  try {
    const sessionId = 'qb-000001-abcdef';
    const dir = path.join(ws.root, '.dashboard-backups', 'qa-batch', sessionId);
    fs.mkdirSync(path.join(dir, 'files', 'tests', 'e2e'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'files', A), spec('a'), 'utf8');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      sessionId,
      status: 'APPLYING',
      createdAt: new Date().toISOString(),
      files: [{ relPath: A, action: 'modified', snapshotRel: `files/${A}` }],
    }), 'utf8');

    resetRecovery();
    assert.deepEqual(await recoverInterrupted(ws.root), [sessionId]);
    assert.equal(ws.read(A), spec('a'));
    assert.equal(ws.exists(`${A}.qa-batch-tmp`), false);
    assert.equal(readManifest(ws.root, sessionId).status, 'RECOVERED');
    assert.deepEqual(await recoverInterrupted(ws.root), [sessionId], 'chỉ chạy một lần cho mỗi root');
  } finally {
    resetRecovery();
    ws.cleanup();
  }
});

test('dọn snapshot: giữ 20 batch mới nhất trong 7 ngày và luôn giữ batch commit gần nhất (BATCH-28)', () => {
  const ws = makeWorkspace();
  try {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const write = (n, ageHours, committed) => {
      const sessionId = `qb-${String(n).padStart(6, '0')}-abcdef`;
      const dir = path.join(ws.root, '.dashboard-backups', 'qa-batch', sessionId);
      fs.mkdirSync(dir, { recursive: true });
      const at = new Date(now - ageHours * 3_600_000).toISOString();
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
        sessionId, status: committed ? 'COMMITTED' : 'FAILED', createdAt: at, committedAt: committed ? at : undefined, files: [],
      }), 'utf8');
      return sessionId;
    };
    const latest = write(0, 200, true);
    for (let n = 1; n <= 22; n++) write(n, n, false);

    pruneBackups(ws.root, now);
    const kept = listManifests(ws.root).map((m) => m.sessionId);
    assert.ok(kept.includes(latest), 'batch commit gần nhất luôn được giữ dù quá 7 ngày');
    assert.equal(kept.length, 21);
    assert.ok(!kept.includes('qb-000022-abcdef') && !kept.includes('qb-000021-abcdef'));
  } finally {
    ws.cleanup();
  }
});
