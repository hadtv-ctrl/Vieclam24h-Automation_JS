const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SummaryReporter = require('./summaryReporter');

test('summary reporter writes non-zero counts from test results', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-reporter-'));
  const reporter = new SummaryReporter({ outputFolder: tempDir });

  reporter.onBegin();
  reporter.onTestEnd({}, { status: 'passed' });
  reporter.onTestEnd({}, { status: 'failed' });
  reporter.onTestEnd({}, { status: 'skipped' });
  reporter.onEnd({ stats: {} });

  const html = fs.readFileSync(path.join(tempDir, 'summary.html'), 'utf8');

  assert.match(html, /Total scripts<\/span><span class="value">3<\/span>/);
  assert.match(html, /Passed<\/span><span class="value passed">1<\/span>/);
  assert.match(html, /Failed<\/span><span class="value failed">1<\/span>/);
  assert.match(html, /Skipped<\/span><span class="value skipped">1<\/span>/);
  assert.match(html, /<span>33%<\/span>/);
});
