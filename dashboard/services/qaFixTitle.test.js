'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  locateTitle,
  titleTags,
  appendTitleTag,
  unskipDeclaration,
  locateEnclosingDescribe,
  reqTagsInRange,
} = require('./qaFixTitle');

test('locateTitle: tìm title của test và describe, bỏ qua test.step và obj.test', () => {
  assert.equal(locateTitle("  test('TC-001 - AC-001 vào trang', async () => {").value, 'TC-001 - AC-001 vào trang');
  assert.equal(locateTitle("test.skip('bị skip', async () => {").value, 'bị skip');
  assert.equal(locateTitle("test.describe('Đăng nhập', () => {", { describe: true }).value, 'Đăng nhập');
  assert.equal(locateTitle("test.describe.serial('Chuỗi', () => {", { describe: true }).value, 'Chuỗi');
  assert.equal(locateTitle("test.describe('Đăng nhập', () => {").error, 'TITLE_NOT_ON_LINE');
  assert.equal(locateTitle("await test.step('bước 1', async () => {").error, 'TITLE_NOT_ON_LINE');
  assert.equal(locateTitle("helpers.test('x')").error, 'TITLE_NOT_ON_LINE');
});

test('locateTitle: quote lồng, ký tự escape, template literal, title xuống dòng (BATCH-11)', () => {
  assert.equal(locateTitle('test("user\'s cart", async () => {').value, "user's cart");
  assert.equal(locateTitle("test('it\\'s ok', async () => {").value, "it\\'s ok");
  assert.equal(locateTitle('test(`plain template`, async () => {').value, 'plain template');
  assert.equal(locateTitle('test(`TC ${id}`, async () => {').error, 'TEMPLATE_TITLE');
  assert.equal(locateTitle('test(').error, 'TITLE_NOT_ON_LINE');
  assert.equal(locateTitle("test('chưa đóng").error, 'TITLE_NOT_ON_LINE');
});

test('titleTags: lấy mọi token @', () => {
  assert.deepEqual(titleTags('TC-001 - AC-001 vào trang @smoke @REQ-001'), ['@smoke', '@REQ-001']);
  assert.deepEqual(titleTags('email a@b.com'), []);
});

test('appendTitleTag: thêm tag cuối title, idempotent, giữ phần còn lại của dòng', () => {
  const line = "  test('TC-002 - AC-002 hiện lỗi chung ', async ({ page }) => {";
  const out = appendTitleTag(line, '@wip');
  assert.equal(out.line, "  test('TC-002 - AC-002 hiện lỗi chung @wip', async ({ page }) => {");
  assert.equal(appendTitleTag(out.line, '@wip').error, 'ALREADY_FIXED');
  const describe = appendTitleTag("test.describe('Đăng nhập sai', () => {", '@REQ-001', { describe: true });
  assert.equal(describe.line, "test.describe('Đăng nhập sai @REQ-001', () => {");
  assert.equal(appendTitleTag('test(`TC ${id}`, () => {', '@wip').error, 'TEMPLATE_TITLE');
  assert.equal(appendTitleTag("test('', () => {", '@wip').line, "test('@wip', () => {");
});

test('unskipDeclaration: chỉ gỡ skip/fixme ở dạng khai báo (BATCH-10)', () => {
  assert.equal(unskipDeclaration("  test.skip('x', async () => {").line, "  test('x', async () => {");
  assert.equal(unskipDeclaration("  test.fixme('x', async () => {").line, "  test('x', async () => {");
  assert.equal(unskipDeclaration("    test.skip(browserName === 'webkit', 'lý do');").error, 'CONDITIONAL_SKIP');
  assert.equal(unskipDeclaration("  test('x', async () => {").error, 'CONDITIONAL_SKIP');
});

const SPEC = [
  "const { test, expect } = require('@playwright/test');",
  '',
  "test.describe('Đăng nhập @REQ-001', () => {",
  "  test('TC-001 - AC-001 vào trang', async ({ page }) => {",
  '    await page.goto("/");',
  '  });',
  '',
  '  // ghi chú ở giữa',
  "  test('TC-002 - AC-002 lỗi', async () => {});",
  '});',
  '',
  "test('ngoài describe', async () => {});",
  'for (const x of [1, 2]) {',
  "  test(`lặp ${x}`, async () => {});",
  '}',
];

test('locateEnclosingDescribe: tìm describe và dòng đóng; ngoài describe; khối không phải describe', () => {
  assert.deepEqual(locateEnclosingDescribe(SPEC, 3), { line: 2, end: 9 });
  assert.deepEqual(locateEnclosingDescribe(SPEC, 8), { line: 2, end: 9 });
  assert.deepEqual(locateEnclosingDescribe(SPEC, 11), { none: true });
  assert.deepEqual(locateEnclosingDescribe(SPEC, 13), { error: 'DESCRIBE_NOT_RESOLVED' });
});

test('reqTagsInRange: gom tag REQ trong title describe và test', () => {
  const lines = [...SPEC];
  lines[8] = "  test('TC-002 - AC-002 lỗi @REQ-002', async () => {});";
  assert.deepEqual([...reqTagsInRange(lines, 2, 9)].sort(), ['@REQ-001', '@REQ-002']);
  assert.deepEqual([...reqTagsInRange(SPEC, 3, 6)], []);
});
