'use strict';

/** PLAN-18 Phase 2 — lập kế hoạch sửa hàng loạt: vị trí vá, lý do bỏ qua, đổi lựa chọn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan, applyInput } = require('./qaBatchPlanService');
const { makeWorkspace, finding, indexOf, keyOf } = require('../../tests/dashboard/support/batchTestUtils');

const AWAIT_REL = 'tests/e2e/await.spec.js';
const AWAIT_SPEC = [
  "const { test, expect } = require('@playwright/test');",
  '',
  "test.describe('Đăng nhập @REQ-001', () => {",
  "  test('TC-001 - AC-001 vào trang', async ({ page }) => {",
  "    expect(page.locator('#a')).toBeVisible();",
  "    expect(page.locator('#a')).toBeVisible();",
  "    expect.soft(page.locator('#b')).toHaveText('x');",
  "    doWork();expect(1).toBe(1); expect(page.locator('#c')).toBeVisible();",
  "    await Promise.all([expect(page.locator('#d')).toBeVisible()]);",
  '    expect(page.getByRole("alert", {',
  '      name: "Lỗi",',
  '    })).toBeVisible();',
  "    [1].forEach(() => { expect(page.locator('#e')).toBeVisible(); });",
  '  });',
  '});',
  '',
].join('\n');

const SKIP_REL = 'tests/e2e/skip.spec.js';
const SKIP_SPEC = [
  "const { test } = require('@playwright/test');",
  "test.describe('Bỏ qua @REQ-001', () => {",
  "  test.skip('TC-001 - AC-001 tạm tắt', async () => {});",
  "  test.fixme('TC-003 - AC-003 đang sửa', async () => {});",
  '  test.skip(',
  "    'TC-002 - AC-002 title xuống dòng', async () => {});",
  '});',
  '',
].join('\n');

const TAG_REL = 'tests/e2e/tag.spec.js';
const TAG_SPEC = [
  "const { test } = require('@playwright/test');",
  "test.describe('Đăng nhập sai', () => {",
  "  test('TC-002 - AC-002 hiện lỗi chung', async () => {});",
  "  test('TC-003 - AC-003 chặn trang', async () => {});",
  '});',
  "test.describe('Hỗn hợp', () => {",
  "  test('TC-001 - AC-001 vào trang @REQ-002', async () => {});",
  "  test('TC-002 - AC-002 lỗi', async () => {});",
  '});',
  "test('TC-001 - AC-001 ngoài describe', async () => {});",
  'for (const x of [1]) {',
  "  test('TC-002 - AC-002 trong vòng lặp', async () => {});",
  '}',
  "test('TC-009 - AC-001 không có trong bảng', async () => {});",
  "test(`TC-001 - AC-001 ${'x'}`, async () => {});",
  '',
].join('\n');

function plan(ws, findings, keys) {
  const index = indexOf(findings);
  const res = buildPlan(ws.root, keys ? keys(index) : index.list.map((f) => f.findingKey), { findingsIndex: index });
  const patches = new Map(res.cards.flatMap((c) => c.patches.map((p) => [`${c.relPath}:${p.line}:${p.kind}`, p])));
  const skipped = new Map(res.skipped.map((s) => [`${s.where}:${s.kind}`, s]));
  return { res, index, patches, skipped };
}

const changed = (patch) => patch.hunk.after[patch.hunk.changedLines[0] - patch.hunk.startLine];

test('await: vá đúng cột kể cả dòng trùng, soft, cùng dòng với expect đồng bộ, nhiều dòng (BATCH-02, 04, 05, 06)', () => {
  const ws = makeWorkspace({ [AWAIT_REL]: AWAIT_SPEC });
  try {
    const lines = [5, 6, 7, 8, 9, 10, 13];
    const { patches, skipped, res } = plan(ws, lines.map((l) => finding('assertion-thieu-await', `${AWAIT_REL}:${l}`)));
    const at = (line) => changed(patches.get(`${AWAIT_REL}:${line}:assertion-thieu-await`));
    assert.equal(at(5), "    await expect(page.locator('#a')).toBeVisible();");
    assert.equal(at(6), "    await expect(page.locator('#a')).toBeVisible();");
    assert.equal(at(7), "    await expect.soft(page.locator('#b')).toHaveText('x');");
    assert.equal(at(8), "    doWork();expect(1).toBe(1); await expect(page.locator('#c')).toBeVisible();");
    assert.equal(at(10), '    await expect(page.getByRole("alert", {');
    assert.equal(skipped.get(`${AWAIT_REL}:9:assertion-thieu-await`).reasonCode, 'IN_EXPRESSION');
    assert.equal(skipped.get(`${AWAIT_REL}:13:assertion-thieu-await`).reasonCode, 'SYNTAX_INVALID');
    assert.deepEqual(res.totals, { patches: 5, files: 1, skipped: 2 });
    assert.equal(ws.read(AWAIT_REL), AWAIT_SPEC, 'lập kế hoạch không ghi file');
  } finally {
    ws.cleanup();
  }
});

test('skip: mặc định @wip, xử lý cả fixme; title xuống dòng bị bỏ qua; đổi sang kích hoạt lại qua batch-input (BATCH-10)', () => {
  const ws = makeWorkspace({ [SKIP_REL]: SKIP_SPEC });
  try {
    const { res, patches, skipped, index } = plan(ws, [3, 4, 5].map((l) => finding('test-bi-skip-am-tham', `${SKIP_REL}:${l}`)));
    assert.equal(changed(patches.get(`${SKIP_REL}:3:test-bi-skip-am-tham`)), "  test.skip('TC-001 - AC-001 tạm tắt @wip', async () => {});");
    assert.equal(changed(patches.get(`${SKIP_REL}:4:test-bi-skip-am-tham`)), "  test.fixme('TC-003 - AC-003 đang sửa @wip', async () => {});");
    assert.equal(skipped.get(`${SKIP_REL}:5:test-bi-skip-am-tham`).reasonCode, 'TITLE_NOT_ON_LINE');

    const key = keyOf(index, 'test-bi-skip-am-tham', `${SKIP_REL}:3`);
    const { sessionId, revision } = res.session;
    const out = applyInput(ws.root, { sessionId, revision, findingKey: key, input: { skipMode: 'unskip' } });
    assert.equal(out.revision, revision + 1);
    const patch = out.card.patches.find((p) => p.findingKey === key);
    assert.equal(patch.risk, 'behavior');
    assert.deepEqual(patch.choice, { skipMode: 'unskip' });
    assert.equal(changed(patch), "  test('TC-001 - AC-001 tạm tắt', async () => {});");

    assert.throws(() => applyInput(ws.root, { sessionId, revision, findingKey: key, input: { skipMode: 'wip' } }), { code: 'REVISION_STALE' });
    assert.throws(() => applyInput(ws.root, { sessionId, revision: out.revision, findingKey: key, input: { skipMode: 'x' } }), { code: 'INVALID_INPUT' });
    assert.throws(() => applyInput(ws.root, { sessionId: 'qb-zzzzzz-000000', revision: 1, findingKey: key, input: {} }), { code: 'SESSION_NOT_FOUND' });
  } finally {
    ws.cleanup();
  }
});

test('REQ: gắn lên describe, test ngoài describe, mọi lý do bỏ qua (BATCH-11)', () => {
  const ws = makeWorkspace({
    [TAG_REL]: TAG_SPEC,
    'tests/e2e/REQ-002-x.spec.js': "test('TC-001 - AC-001 mơ hồ', async () => {});\n",
    'tests/e2e/REQ-005-y.spec.js': "test('không có TC', async () => {});\n",
  });
  try {
    const where = [3, 4, 8, 10, 12, 14, 15].map((l) => `${TAG_REL}:${l}`)
      .concat(['tests/e2e/REQ-002-x.spec.js:1', 'tests/e2e/REQ-005-y.spec.js:1']);
    const { patches, skipped } = plan(ws, where.map((w) => finding('test-thieu-tag-req', w)));
    const onDescribe = patches.get(`${TAG_REL}:3:test-thieu-tag-req`);
    assert.equal(changed(onDescribe), "test.describe('Đăng nhập sai @REQ-001', () => {");
    assert.deepEqual(onDescribe.hunk.changedLines, [2]);
    assert.deepEqual(patches.get(`${TAG_REL}:4:test-thieu-tag-req`).hunk, onDescribe.hunk, 'cùng describe -> cùng bản vá');
    assert.equal(changed(patches.get(`${TAG_REL}:10:test-thieu-tag-req`)), "test('TC-001 - AC-001 ngoài describe @REQ-001', async () => {});");
    const reason = (w) => skipped.get(`${w}:test-thieu-tag-req`).reasonCode;
    assert.equal(reason(`${TAG_REL}:8`), 'DESCRIBE_MIXED_REQ');
    assert.equal(reason(`${TAG_REL}:12`), 'DESCRIBE_NOT_RESOLVED');
    assert.equal(reason(`${TAG_REL}:14`), 'REQ_UNKNOWN');
    assert.equal(reason(`${TAG_REL}:15`), 'TEMPLATE_TITLE');
    assert.equal(reason('tests/e2e/REQ-002-x.spec.js:1'), 'REQ_AMBIGUOUS');
    assert.equal(reason('tests/e2e/REQ-005-y.spec.js:1'), 'REQ_NOT_FOUND');
  } finally {
    ws.cleanup();
  }
});

test('route không tự động, key đã cũ, đường dẫn thoát project, body sai (BATCH-13, 14, 26)', () => {
  const ws = makeWorkspace({ [TAG_REL]: TAG_SPEC });
  try {
    const findings = [
      finding('spec-thieu-assertion', `${TAG_REL}:3`),
      finding('khong-doc-duoc-requirement', 'requirements/'),
      finding('script-khong-co-trong-test-case', `${TAG_REL}:3`),
      finding('ma-tc-trung', 'test-cases/REQ-001.md (REQ-001/AC-001), test-cases/REQ-001.md (REQ-001/AC-002)'),
      finding('assertion-thieu-await', '../outside.spec.js:3'),
    ];
    const { skipped, res } = plan(ws, findings, (index) => [...index.list.map((f) => f.findingKey), 'khong-ton-tai']);
    assert.equal(res.cards.length, 0);
    const byKind = Object.fromEntries(res.skipped.map((s) => [s.kind || 'unknown', s]));
    assert.deepEqual(byKind['spec-thieu-assertion'].nextAction, { type: 'detail' });
    assert.deepEqual(byKind['khong-doc-duoc-requirement'].nextAction, { type: 'scaffold' });
    assert.deepEqual(byKind['script-khong-co-trong-test-case'].nextAction, { type: 'autofix' });
    assert.deepEqual(byKind['ma-tc-trung'].nextAction, { type: 'openDoc', target: 'test-cases/REQ-001.md' });
    assert.equal(byKind['assertion-thieu-await'].reasonCode, 'PATH_REJECTED');
    assert.equal(byKind.unknown.reasonCode, 'NOT_IN_LATEST_SCAN');
    assert.ok(skipped.size >= 5);

    const index = indexOf(findings);
    for (const bad of [[], 'x', [1], Array.from({ length: 201 }, (_, i) => `k${i}`)]) {
      assert.throws(() => buildPlan(ws.root, bad, { findingsIndex: index }), { status: 400, code: 'INVALID_BODY' });
    }
  } finally {
    ws.cleanup();
  }
});
