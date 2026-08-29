const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WorkerHtmlReporter = require('./workerHtmlReporter');

test('worker reporter writes an isolated html report for every parallel index', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-html-reporter-'));
  const reporter = new WorkerHtmlReporter({ outputFolder: tempDir, runId: 'run-123-abc' });
  const parent = { project: () => ({ name: 'Desktop Chrome' }) };

  reporter.onBegin();
  reporter.onTestEnd(
    { title: 'worker zero test', titlePath: () => ['suite', 'worker zero test'], parent },
    { status: 'passed', duration: 1000, parallelIndex: 0 }
  );
  reporter.onTestEnd(
    { title: 'worker one test', titlePath: () => ['suite', 'worker one test'], parent },
    { status: 'failed', duration: 2000, parallelIndex: 1, error: { message: 'expected failure' } }
  );

  await reporter.onEnd();

  const workerZero = path.join(tempDir, 'worker-0', 'index.html');
  const workerOne = path.join(tempDir, 'worker-1', 'index.html');
  assert.equal(fs.existsSync(workerZero), true);
  assert.equal(fs.existsSync(workerOne), true);
  assert.match(fs.readFileSync(workerZero, 'utf8'), /worker zero test/);
  assert.match(fs.readFileSync(workerOne, 'utf8'), /expected failure/);
});
