'use strict';

/**
 * Canh fixture của PLAN-18: scanner thật (tools/qa, có `playwright --list`) chạy trên workspace
 * tạm phải sinh đúng 5 loại finding mà batch fixer xử lý, mỗi loại lặp theo 2 project.
 * Fixture lệch thì mọi test service/E2E của batch fixer phía sau đều mất ý nghĩa.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixtureWorkspace } = require('../../tests/dashboard/support/fixtureWorkspace');
const { seedBatchFixture } = require('../../tests/dashboard/support/batchFixtureSeed');
const { summary } = require('../../tools/qa/lib/commands');

test('Fixture batch sinh đúng các loại finding của PLAN-18, lặp theo 2 project', () => {
  const ws = createFixtureWorkspace();
  try {
    seedBatchFixture(ws.rootPath);
    const { findings } = summary(ws.rootPath, { json: true });
    const byKind = {};
    for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;

    assert.deepEqual(byKind, {
      'assertion-thieu-await': 6,
      'test-bi-skip-am-tham': 2,
      'spec-thieu-assertion': 2,
      'test-khong-co-ma-tc': 2,
      'test-thieu-tag-req': 2,
    });

    const wheres = findings.filter((f) => f.kind === 'assertion-thieu-await').map((f) => f.where).sort();
    assert.deepEqual(wheres, [
      'tests/e2e/crlf.spec.js:5',
      'tests/e2e/crlf.spec.js:5',
      'tests/e2e/login.spec.js:6',
      'tests/e2e/login.spec.js:6',
      'tests/e2e/login.spec.js:7',
      'tests/e2e/login.spec.js:7',
    ]);
  } finally {
    ws.cleanup();
  }
});
