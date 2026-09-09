const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { CleanupRegistry, cleanupQueueFixture } = require('./cleanupRegistry');
const { loadCustomFixtures } = require('./custom');

test('CleanupRegistry executes tasks in LIFO order and handles errors fail-safe', async () => {
  const registry = new CleanupRegistry();
  const order = [];

  registry.register(() => {
    order.push('first_task');
  });
  registry.register(() => {
    throw new Error('Lỗi dọn dẹp giả lập');
  });
  registry.register(() => {
    order.push('third_task');
  });

  const errors = await registry.runAll();
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Lỗi dọn dẹp giả lập/);
  // Thứ tự thực thi LIFO: third_task chạy trước first_task
  assert.deepEqual(order, ['third_task', 'first_task']);
});

test('cleanupQueueFixture executes registered tasks in finally block even on error', async () => {
  let cleanedUp = false;
  let errorCaught = false;

  try {
    await cleanupQueueFixture({}, async (cleanupQueue) => {
      cleanupQueue(async () => {
        cleanedUp = true;
      });
      // Giả lập test case bị fail
      throw new Error('Test case failed assertion!');
    });
  } catch (err) {
    errorCaught = true;
    assert.match(err.message, /Test case failed/);
  }

  assert.equal(errorCaught, true);
  assert.equal(cleanedUp, true, 'cleanup task phải luôn luôn được thực thi trong finally');
});

test('loadCustomFixtures dynamically loads fixtures from custom directory', () => {
  const tmpCustomDir = path.join(process.cwd(), '.tmp', 'test_custom_fixtures');
  fs.mkdirSync(tmpCustomDir, { recursive: true });

  const fixtureCode = `module.exports = {
  sampleCustomFixture: async ({}, use) => {
    await use({ data: 'custom_fixture_active' });
  }
};`;
  fs.writeFileSync(path.join(tmpCustomDir, 'sampleCustom.fixture.js'), fixtureCode, 'utf8');

  try {
    const loaded = loadCustomFixtures(tmpCustomDir);
    assert.ok(loaded.sampleCustomFixture);
    assert.equal(typeof loaded.sampleCustomFixture, 'function');
  } finally {
    fs.rmSync(tmpCustomDir, { recursive: true, force: true });
  }
});
