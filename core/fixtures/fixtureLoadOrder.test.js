const test = require('node:test');
const assert = require('node:assert/strict');

// Nạp baseTest.js TRƯỚC custom/index.js — đúng thứ tự Playwright nạp khi chạy spec.
// Để ở file riêng vì node --test chạy mỗi file trong một process, module cache sạch;
// file test khác require './custom' trước sẽ che mất lỗi require vòng.
const { RESERVED_FIXTURE_NAMES } = require('./baseTest');
const { customFixtures } = require('./custom');

test('baseTest nạp trước custom/index.js vẫn nhận đủ custom fixture', () => {
  assert.ok(RESERVED_FIXTURE_NAMES instanceof Set);
  assert.equal(typeof customFixtures.ephemeralUser, 'function');
});

test('Loader không nạp file .js ở gốc dự án như custom fixture', () => {
  assert.equal(customFixtures.projects, undefined);
  assert.equal(customFixtures.reporter, undefined);
});
