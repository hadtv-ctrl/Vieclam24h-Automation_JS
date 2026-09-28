'use strict';

/**
 * PLAN-18 Phase 4 — gán mã TC có hướng dẫn: chọn AC, vá title + bảng Traceability cùng giao dịch,
 * giữ chỗ TC giữa các session, TC bị chiếm lúc apply, tràn TC-999, thiếu bảng Traceability.
 * Chạy scanner thật (playwright --list) trên fixture.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFixtureWorkspace } = require('../../tests/dashboard/support/fixtureWorkspace');
const { seedBatchFixture, TC_DOC } = require('../../tests/dashboard/support/batchFixtureSeed');
const { getQaSummary, invalidateQaSummaryCache } = require('./qaService');
const { buildPlan, applyInput } = require('./qaBatchPlanService');
const { commitPlan } = require('./qaBatchCommitService');
const { resetSessions } = require('./qaBatchSessionStore');
const { buildRow, nextTcNumber } = require('./qaGuidedFixes');

const LOGIN = 'tests/e2e/login.spec.js';

function setup() {
  const ws = createFixtureWorkspace();
  seedBatchFixture(ws.rootPath);
  resetSessions();
  invalidateQaSummaryCache();
  const summary = getQaSummary(ws.rootPath, { force: true });
  const key = summary.findings.find((f) => f.kind === 'test-khong-co-ma-tc').findingKey;
  const read = (rel) => fs.readFileSync(path.join(ws.rootPath, rel), 'utf8');
  const write = (rel, text) => fs.writeFileSync(path.join(ws.rootPath, rel), text, 'utf8');
  return { ws, root: ws.rootPath, key, read, write };
}

const patchOf = (plan, key) => plan.cards.flatMap((c) => c.patches).find((p) => p.findingKey === key);

test('chọn AC rồi áp dụng: title + tag + dòng traceability; quét lại không phát sinh lỗi truy vết (BATCH-40)', async () => {
  const { ws, root, key, read } = setup();
  try {
    const plan = buildPlan(root, [key]);
    const pending = patchOf(plan, key);
    assert.equal(pending.needsInput, true);
    assert.equal(pending.defaultSelected, false);
    assert.equal(pending.hunk, null);
    assert.equal(pending.choice.reqId, 'REQ-001');
    assert.equal(pending.choice.tcId, 'TC-004', 'TC lớn nhất đang dùng là TC-003');
    assert.deepEqual(pending.choice.acs.map((a) => a.id), ['AC-001', 'AC-002', 'AC-003']);

    assert.throws(() => applyInput(root, { sessionId: plan.session.sessionId, revision: 1, findingKey: key, input: { acId: 'AC-009' } }), { code: 'INVALID_INPUT' });
    const input = applyInput(root, { sessionId: plan.session.sessionId, revision: 1, findingKey: key, input: { acId: 'AC-002' } });
    assert.deepEqual(input.cards.map((c) => c.relPath), [LOGIN, 'test-cases/REQ-001.md']);
    const row = input.cards[1].patches[0];
    assert.deepEqual(row.hunk.insertedLines, [10], 'chèn ngay sau dòng TC-003 (dòng 9)');
    assert.equal(row.hunk.after[10 - row.hunk.startLine], '| REQ-001 | AC-002 | TC-004 | Yes | tests/e2e/login.spec.js | P2 |');

    const res = await commitPlan(root, { sessionId: plan.session.sessionId, revision: input.revision, acceptedFindingKeys: [key] });
    assert.deepEqual(res.appliedFindingKeys, [key]);
    assert.equal(res.files.length, 2);
    assert.equal(read(LOGIN).split('\n')[14], "  test('TC-004 - AC-002 kiểm tra tiêu đề trang', async ({ page }) => {");
    assert.ok(read('test-cases/REQ-001.md').includes('| REQ-001 | AC-002 | TC-004 | Yes | tests/e2e/login.spec.js | P2 |'));

    const after = getQaSummary(root, { force: true }).findings;
    const bad = after.filter((f) => ['test-khong-co-ma-tc', 'script-khong-co-trong-test-case', 'test-thieu-tag-req',
      'test-tro-toi-ac-khong-ton-tai', 'spec-khong-ton-tai'].includes(f.kind) && String(f.where).startsWith(`${LOGIN}:15`));
    assert.deepEqual(bad, []);
    assert.ok(!after.some((f) => f.kind === 'test-khong-co-ma-tc'));
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});

test('hai session mở cùng lúc giữ chỗ TC khác nhau; TC bị dùng nơi khác thì 409 TC_TAKEN (BATCH-41)', async () => {
  const { ws, root, key, read, write } = setup();
  try {
    const first = buildPlan(root, [key]);
    const second = buildPlan(root, [key]);
    assert.equal(patchOf(first, key).choice.tcId, 'TC-004');
    assert.equal(patchOf(second, key).choice.tcId, 'TC-005');

    const input = applyInput(root, { sessionId: second.session.sessionId, revision: 1, findingKey: key, input: { acId: 'AC-001' } });
    write('tests/e2e/crlf.spec.js', read('tests/e2e/crlf.spec.js').replace("'TC-001 - AC-001 bản CRLF'", "'TC-005 - AC-001 bản CRLF'"));
    await assert.rejects(
      commitPlan(root, { sessionId: second.session.sessionId, revision: input.revision, acceptedFindingKeys: [key] }),
      (err) => err.status === 409 && err.code === 'STALE_FILES' && err.details.reason === 'TC_TAKEN' && err.details.tcs[0] === 'TC-005',
    );
    assert.ok(!read(LOGIN).includes('TC-005 - AC-001 kiểm tra'), 'không ghi gì khi TC bị chiếm');
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});

test('REQ không có bảng Traceability thì bỏ qua có lý do (BATCH-43)', () => {
  const { ws, root, key, write } = setup();
  try {
    write('test-cases/REQ-001.md', TC_DOC.replace('## Traceability', '## Ghi chú'));
    const plan = buildPlan(root, [key]);
    assert.equal(plan.cards.length, 0);
    assert.equal(plan.skipped[0].reasonCode, 'NO_TRACEABILITY_TABLE');
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});

test('đã dùng tới TC-999 thì bỏ qua với TC_OVERFLOW, không tạo bản vá (BATCH-42)', () => {
  const { ws, root, key, write } = setup();
  try {
    write('test-cases/REQ-001.md', TC_DOC.replace(/TC-003/g, 'TC-999'));
    const plan = buildPlan(root, [key]);
    assert.equal(plan.cards.length, 0);
    assert.equal(plan.skipped[0].reasonCode, 'TC_OVERFLOW');
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});

test('nextTcNumber: bỏ số đã dùng/đang giữ chỗ, quá TC-999 thì null (BATCH-42)', () => {
  assert.equal(nextTcNumber(new Set([1, 2, 3]), new Set([4])), 5);
  assert.equal(nextTcNumber(new Set(), new Set()), 1);
  assert.equal(nextTcNumber(new Set([998]), new Set()), 999);
  assert.equal(nextTcNumber(new Set([999]), new Set()), null);
});

test('buildRow: dựng theo tên cột của bảng — REQ-trước và bảng tiếng Việt TC-trước', () => {
  const c = { reqId: 'REQ-001', acId: 'AC-002', tcId: 'TC-004', spec: 'tests/e2e/a.spec.js', title: 'mô tả | có gạch' };
  assert.equal(buildRow(['Requirement', 'Acceptance criterion', 'Test case', 'Automation', 'Spec', 'Priority'], c),
    '| REQ-001 | AC-002 | TC-004 | Yes | `tests/e2e/a.spec.js` | P2 |');
  assert.equal(buildRow(['Test case', 'AC', 'Mô tả', 'Ưu tiên', 'Automation', 'Spec'], c),
    '| TC-004 | AC-002 | mô tả / có gạch | P2 | Yes | `tests/e2e/a.spec.js` |');
  assert.equal(buildRow(['Requirement', 'Acceptance criterion', 'Test case', 'Automation', 'Spec', 'Priority'], c, { bareSpec: true }),
    '| REQ-001 | AC-002 | TC-004 | Yes | tests/e2e/a.spec.js | P2 |', 'bảng đang để đường dẫn trần thì dòng mới cũng trần');
});
