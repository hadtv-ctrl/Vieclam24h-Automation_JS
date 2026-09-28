'use strict';

/** PLAN-18 Phase 2 — áp dụng kế hoạch: ghi một phần, file đã đổi, revision, đồng thời, lỗi ghi, hết hạn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildPlan } = require('./qaBatchPlanService');
const { commitPlan } = require('./qaBatchCommitService');
const { getLatestBatch } = require('./qaBatchRollbackService');
const { readManifest } = require('./qaBatchManifest');
const { makeWorkspace, finding, indexOf, keyOf } = require('../../tests/dashboard/support/batchTestUtils');

const A = 'tests/e2e/a.spec.js';
const A_SPEC = [
  "test.describe('A @REQ-001', () => {",
  "  test('TC-001 - AC-001 a', async ({ page }) => {",
  "    expect(page.locator('#x')).toBeVisible();",
  "    expect(page.locator('#y')).toBeVisible();",
  '  });',
  "  test.skip('TC-003 - AC-003 tắt', async () => {});",
  '});',
  '',
].join('\n');
const B = 'tests/e2e/b.spec.js';
const B_SPEC = `﻿${[
  "test.describe('B @REQ-001', () => {",
  "  test('TC-001 - AC-001 b', async ({ page }) => {",
  "    expect(page.locator('#z')).toBeVisible();",
  '  });',
  '});',
].join('\r\n')}`;

const FINDINGS = [
  finding('assertion-thieu-await', `${A}:3`),
  finding('assertion-thieu-await', `${A}:4`),
  finding('test-bi-skip-am-tham', `${A}:6`),
  finding('assertion-thieu-await', `${B}:3`),
];

function setup() {
  const ws = makeWorkspace({ [A]: A_SPEC, [B]: B_SPEC });
  const index = indexOf(FINDINGS);
  const planAll = (keys = index.list.map((f) => f.findingKey)) => buildPlan(ws.root, keys, { findingsIndex: index });
  const key = (kind, where) => keyOf(index, kind, where);
  return { ws, index, planAll, key };
}

const applyAll = (ws, plan, keys) => commitPlan(ws.root, {
  sessionId: plan.session.sessionId,
  revision: plan.session.revision,
  acceptedFindingKeys: keys || plan.cards.flatMap((c) => c.patches.map((p) => p.findingKey)),
});

test('áp dụng một phần, giữ BOM/CRLF/không newline cuối, manifest COMMITTED, chạy lại thì ALREADY_FIXED (BATCH-01, 03, 09, 15)', async () => {
  const { ws, planAll, key, index } = setup();
  try {
    const plan = planAll();
    const skipA4 = key('assertion-thieu-await', `${A}:4`);
    const keys = plan.cards.flatMap((c) => c.patches.map((p) => p.findingKey)).filter((k) => k !== skipA4);
    const res = await applyAll(ws, plan, keys);

    assert.equal(res.ok, true);
    assert.deepEqual(res.notApplied, []);
    assert.deepEqual(res.files.map((f) => f.relPath).sort(), [A, B]);
    assert.deepEqual(new Set(res.appliedFindingKeys), new Set(keys));
    const a = ws.read(A).split('\n');
    assert.equal(a[2], "    await expect(page.locator('#x')).toBeVisible();");
    assert.equal(a[3], "    expect(page.locator('#y')).toBeVisible();", 'bản vá không tick thì không ghi');
    assert.equal(a[5], "  test.skip('TC-003 - AC-003 tắt @wip', async () => {});");
    assert.equal(ws.read(B), B_SPEC.replace("    expect(page.locator('#z'))", "    await expect(page.locator('#z'))"));

    const manifest = readManifest(ws.root, res.sessionId);
    assert.equal(manifest.status, 'COMMITTED');
    assert.equal(manifest.files.length, 2);
    assert.ok(manifest.files.every((f) => f.postHash && f.baseHash && f.postHash !== f.baseHash));
    assert.equal(getLatestBatch(ws.root).sessionId, res.sessionId);

    const again = buildPlan(ws.root, [key('assertion-thieu-await', `${A}:3`)], { findingsIndex: index });
    assert.equal(again.skipped[0].reasonCode, 'ALREADY_FIXED');
    assert.ok(!ws.read(A).includes('await await'));
  } finally {
    ws.cleanup();
  }
});

test('file đổi sau khi lập kế hoạch, revision cũ, hai session cùng file, body sai (BATCH-16, 17, 19)', async () => {
  const { ws, planAll } = setup();
  try {
    const stalePlan = planAll();
    ws.write(A, `${A_SPEC}// sửa tay\n`);
    await assert.rejects(applyAll(ws, stalePlan), (err) => err.status === 409 && err.code === 'STALE_FILES' && err.details.files.includes(A));
    assert.equal(ws.read(A), `${A_SPEC}// sửa tay\n`);
    assert.equal(ws.read(B), B_SPEC, 'không file nào bị ghi khi có file stale');

    const plan = planAll();
    await assert.rejects(commitPlan(ws.root, { ...plan.session, revision: 99, acceptedFindingKeys: [] }), { code: 'REVISION_STALE' });
    await assert.rejects(applyAll(ws, plan, []), { status: 400, code: 'NO_PATCH_SELECTED' });
    await assert.rejects(commitPlan(ws.root, { sessionId: plan.session.sessionId, revision: 1 }), { status: 400, code: 'INVALID_BODY' });

    const first = planAll();
    const second = planAll();
    await applyAll(ws, first);
    await assert.rejects(applyAll(ws, second), { status: 409, code: 'STALE_FILES' });
    await assert.rejects(applyAll(ws, first), { status: 409, code: 'INVALID_STATE' });
  } finally {
    ws.cleanup();
  }
});

test('hai request apply đồng thời cùng session: đúng một request thành công (BATCH-18)', async () => {
  const { ws, planAll } = setup();
  try {
    const plan = planAll();
    const results = await Promise.allSettled([applyAll(ws, plan), applyAll(ws, plan)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected').reason;
    assert.equal(rejected.status, 409);
    assert.ok(['BATCH_LOCKED', 'INVALID_STATE'].includes(rejected.code));
  } finally {
    ws.cleanup();
  }
});

test('lỗi ghi ở file thứ hai: khôi phục nguyên trạng, manifest FAILED, 500 restored (BATCH-20)', async () => {
  const { ws, planAll } = setup();
  try {
    const plan = planAll();
    const fsOps = {
      ...fs,
      renameSync: (from, to) => {
        if (to.endsWith('b.spec.js')) throw Object.assign(new Error('ổ đĩa đầy'), { code: 'ENOSPC' });
        return fs.renameSync(from, to);
      },
    };
    const body = {
      sessionId: plan.session.sessionId,
      revision: plan.session.revision,
      acceptedFindingKeys: plan.cards.flatMap((c) => c.patches.map((p) => p.findingKey)),
    };
    await assert.rejects(commitPlan(ws.root, body, { fsOps }), (err) => err.status === 500
      && err.code === 'WRITE_FAILED' && err.details.restored === true);
    assert.equal(ws.read(A), A_SPEC);
    assert.equal(ws.read(B), B_SPEC);
    assert.equal(ws.exists(`${B}.qa-batch-tmp`), false);
    assert.equal(readManifest(ws.root, plan.session.sessionId).status, 'FAILED');
    assert.equal(getLatestBatch(ws.root), null);
  } finally {
    ws.cleanup();
  }
});

test('kế hoạch quá 15 phút thì hết hiệu lực (BATCH-27)', async () => {
  const { ws, planAll } = setup();
  const realNow = Date.now;
  try {
    const plan = planAll();
    Date.now = () => realNow() + 16 * 60_000;
    await assert.rejects(applyAll(ws, plan), { status: 404, code: 'SESSION_NOT_FOUND' });
  } finally {
    Date.now = realNow;
    ws.cleanup();
  }
});
