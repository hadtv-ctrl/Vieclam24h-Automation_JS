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

test('CleanupRegistry safely handles non-Error throws (throw null / string) without aborting remaining tasks (R07)', async () => {
  const registry = new CleanupRegistry();
  const executed = [];

  registry.register(() => {
    executed.push('task_1');
  }, { label: 'Task 1' });

  registry.register(() => {
    // Cố ý throw null
    throw null;
  }, { label: 'Task Null Throw' });

  registry.register(() => {
    // Cố ý throw string
    throw 'Non-Error string exception';
  }, { label: 'Task String Throw' });

  registry.register(() => {
    executed.push('task_4');
  }, { label: 'Task 4' });

  const errors = await registry.runAll();
  assert.equal(errors.length, 2, 'Cả hai task ném lỗi phải được ghi nhận');
  assert.ok(errors[0] instanceof Error);
  assert.ok(errors[1] instanceof Error);
  assert.equal(errors[0].label, 'Task String Throw');
  assert.equal(errors[1].label, 'Task Null Throw');
  // LIFO: task_4 chạy trước task_1
  assert.deepEqual(executed, ['task_4', 'task_1'], 'Các task còn lại vẫn phải chạy đầy đủ');
});

test('cleanupQueueFixture respects testInfo.status to avoid false positive when test timed out or failed (R07)', async () => {
  const mockTestInfo = { status: 'timedOut' };
  let cleanupRun = false;

  // Khi testInfo.status === 'timedOut' và cleanup bị fail:
  // Không được throw "Kịch bản chính thành công nhưng dọn dẹp thất bại" (TeardownFailureError)
  await cleanupQueueFixture({}, async (cleanupQueue) => {
    cleanupQueue(async () => {
      cleanupRun = true;
      throw new Error('Cleanup API failed');
    });
  }, mockTestInfo);

  assert.equal(cleanupRun, true);
});
