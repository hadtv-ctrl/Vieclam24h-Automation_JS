const { test: baseTest, expect } = require('./baseTest');

/**
 * Core Framework API Test Fixture
 * Kế thừa baseTest nhưng bỏ các fixture phụ thuộc page UI.
 * Giữ nguyên: circuitBreakerGuard, cleanupQueue, featureName, workerUserData.
 *
 * Sử dụng trong API spec:
 *   const { test, expect } = require('../../core/fixtures/apiTest');
 *   test('API test @api', async ({ request, cleanupQueue }) => { ... });
 */
const test = baseTest.extend({
  // Override basePage thành no-op vì API test không cần Page Object UI
  basePage: [async ({}, use) => {
    await use(null);
  }, { scope: 'test' }],

  // Override pages container thành no-op
  pages: [async ({}, use) => {
    await use(null);
  }, { scope: 'test' }],

  // Override authenticatedUser thành no-op (API auth xử lý riêng qua token/header)
  authenticatedUser: [async ({}, use) => {
    await use(null);
  }, { scope: 'test' }],
});

module.exports = { test, expect };
