'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  routeFor,
  createFindingKey,
  createMatchKey,
  enrichFindings,
} = require('./qaFindingCatalog');

const AWAIT = {
  kind: 'assertion-thieu-await',
  severity: 'major',
  where: 'tests/e2e/login.spec.js:6',
  message: 'TC-001 gọi matcher bất đồng bộ của Playwright mà thiếu "await".',
};

test('routeFor: 3 kind quick, các kind có công cụ sẵn, còn lại là manual', () => {
  assert.equal(routeFor('assertion-thieu-await'), 'quick');
  assert.equal(routeFor('test-bi-skip-am-tham'), 'quick');
  assert.equal(routeFor('test-thieu-tag-req'), 'quick');
  assert.equal(routeFor('khong-doc-duoc-requirement'), 'scaffold');
  assert.equal(routeFor('script-khong-co-trong-test-case'), 'autofix');
  assert.equal(routeFor('spec-thieu-assertion'), 'manual');
  assert.equal(routeFor('ma-tc-trung'), 'manual');
  assert.equal(routeFor('kind-chua-tung-thay'), 'manual');
  assert.equal(routeFor(undefined), 'manual');
});

test('createFindingKey: ổn định, không phụ thuộc dấu gạch chéo, khác nhau khi đổi dòng', () => {
  const key = createFindingKey(AWAIT);
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.equal(createFindingKey({ ...AWAIT }), key);
  assert.equal(createFindingKey({ ...AWAIT, where: 'tests\\e2e\\login.spec.js:6' }), key);
  assert.notEqual(createFindingKey({ ...AWAIT, where: 'tests/e2e/login.spec.js:7' }), key);
});

test('createFindingKey: finding từ parser dự phòng (id/detail) vẫn có key', () => {
  const key = createFindingKey({ kind: 'x', id: 'REQ-001', detail: 'thiếu AC' });
  assert.equal(key, createFindingKey({ kind: 'x', where: 'REQ-001', message: 'thiếu AC' }));
});

test('createMatchKey: bỏ số dòng nên không đổi khi dòng dịch chuyển', () => {
  const moved = { ...AWAIT, where: 'tests/e2e/login.spec.js:9' };
  assert.equal(createMatchKey(moved), createMatchKey(AWAIT));
  assert.notEqual(createMatchKey({ ...AWAIT, where: 'tests/e2e/other.spec.js:6' }), createMatchKey(AWAIT));
});

test('enrichFindings: gộp finding lặp theo project, giữ thứ tự, gắn key/route (BATCH-12)', () => {
  const skip = { kind: 'test-bi-skip-am-tham', where: 'tests/e2e/login.spec.js:11', message: 'skip' };
  const out = enrichFindings([AWAIT, skip, { ...AWAIT }, { ...AWAIT }, { ...AWAIT }, { ...skip }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'assertion-thieu-await');
  assert.equal(out[0].occurrences, 4);
  assert.equal(out[0].fixRoute, 'quick');
  assert.equal(out[0].findingKey, createFindingKey(AWAIT));
  assert.equal(out[0].matchKey, createMatchKey(AWAIT));
  assert.equal(out[0].severity, 'major');
  assert.equal(out[1].occurrences, 2);
});

test('enrichFindings: đầu vào không hợp lệ không làm hỏng', () => {
  assert.deepEqual(enrichFindings(undefined), []);
  assert.deepEqual(enrichFindings([null, 1, 'x']), []);
});
