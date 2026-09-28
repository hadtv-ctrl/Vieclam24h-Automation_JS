'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  validateSyntax,
  scannerAvailable,
  findMissingAwaitAt,
  isResolved,
} = require('./qaFixValidate');

test('validateSyntax: CommonJS hợp lệ, có BOM, shebang, return ở top-level', () => {
  assert.deepEqual(validateSyntax('a.spec.js', "const { test } = require('x');\ntest('a', async () => {});\n"), { ok: true });
  assert.deepEqual(validateSyntax('a.spec.js', '﻿#!/usr/bin/env node\nmodule.exports = 1;\nreturn;\n'), { ok: true });
});

test('validateSyntax: await trong callback không async bị chặn (BATCH-08)', () => {
  const code = [
    "test('x', async ({ page }) => {",
    '  items.forEach((item) => {',
    '    await expect(page.locator(item)).toBeVisible();',
    '  });',
    '});',
  ].join('\n');
  const res = validateSyntax('tests/e2e/a.spec.js', code);
  assert.equal(res.ok, false);
  assert.equal(res.reasonCode, 'SYNTAX_INVALID');
});

test('validateSyntax: ESM kiểm qua node --check, file tạm được dọn', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-validate-'));
  try {
    assert.deepEqual(validateSyntax('a.spec.mjs', "import { test } from 'x';\ntest('a', async () => {});\n", { root }), { ok: true });
    const bad = validateSyntax('a.spec.js', "import { test } from 'x';\nconst = 1;\n", { root });
    assert.equal(bad.ok, false);
    assert.equal(bad.reasonCode, 'SYNTAX_INVALID');
    assert.deepEqual(fs.readdirSync(path.join(root, '.dashboard-drafts', 'qa-batch')), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validateSyntax: .md bỏ qua, loại file không kiểm được thì từ chối', () => {
  assert.deepEqual(validateSyntax('test-cases/REQ-001.md', '| a |'), { ok: true });
  assert.equal(validateSyntax('a.spec.ts', 'const a: number = 1;').reasonCode, 'UNSUPPORTED_FILE');
});

test('findMissingAwaitAt: trả occurrence đúng dòng kèm column từ scanner', () => {
  assert.equal(scannerAvailable(), true);
  const lines = [
    "test('x', async ({ page }) => {",
    "  doWork();expect(a).toBe(1); expect(page.locator('#x')).toBeVisible();",
    '});',
  ];
  const hit = findMissingAwaitAt(lines, 2);
  assert.equal(hit.column, lines[1].lastIndexOf('expect('));
  assert.equal(findMissingAwaitAt(lines, 1), null);
});

test('isResolved: đo đúng rule cho 3 kind quick', () => {
  const awaitFixed = ["test('x', async ({ page }) => {", "  await expect(page.locator('#x')).toBeVisible();", '});'];
  assert.equal(isResolved('assertion-thieu-await', awaitFixed, { line: 2 }), true);
  const awaitMissing = ["test('x', async ({ page }) => {", "  expect(page.locator('#x')).toBeVisible();", '});'];
  assert.equal(isResolved('assertion-thieu-await', awaitMissing, { line: 2 }), false);

  assert.equal(isResolved('test-bi-skip-am-tham', ["test.skip('x @wip', async () => {});"], { line: 1 }), true);
  assert.equal(isResolved('test-bi-skip-am-tham', ["test('x', async () => {});"], { line: 1 }), true);
  assert.equal(isResolved('test-bi-skip-am-tham', ["test.skip('x', async () => {});"], { line: 1 }), false);

  const tagged = ["test.describe('Đăng nhập @REQ-001', () => {", "  test('TC-002 - AC-002 lỗi', async () => {});", '});'];
  assert.equal(isResolved('test-thieu-tag-req', tagged, { tag: '@REQ-001', tagLine: 1, tagOnDescribe: true }), true);
  assert.equal(isResolved('test-thieu-tag-req', tagged, { tag: '@REQ-002', tagLine: 1, tagOnDescribe: true }), false);
  assert.equal(isResolved('kind-khac', tagged, { line: 1 }), false);
});
