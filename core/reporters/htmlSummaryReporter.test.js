const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HtmlSummaryReporter = require('./htmlSummaryReporter');

test('html summary reporter injects dashboard into index html only', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-summary-reporter-'));
  const indexPath = path.join(tempDir, 'index.html');
  fs.writeFileSync(indexPath, '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>');

  const reporter = new HtmlSummaryReporter({ outputFolder: tempDir });
  reporter.onBegin();
  reporter.onTestEnd({ id: 'one' }, { status: 'passed' });
  reporter.onTestEnd({ id: 'two' }, { status: 'failed' });
  reporter.onTestEnd({ id: 'three' }, { status: 'skipped' });

  await reporter.onEnd();
  await reporter.onEnd();

  const html = fs.readFileSync(indexPath, 'utf8');

  assert.match(html, /qa-summary-dashboard/);
  assert.match(html, /Total scripts<\/span>\s*<span class="qa-summary-dashboard__value">3<\/span>/);
  assert.match(html, /Passed<\/span>\s*<span class="qa-summary-dashboard__value qa-summary-dashboard__value--passed">1<\/span>/);
  assert.match(html, /Failed<\/span>\s*<span class="qa-summary-dashboard__value qa-summary-dashboard__value--failed">1<\/span>/);
  assert.match(html, /Skipped<\/span>\s*<span class="qa-summary-dashboard__value qa-summary-dashboard__value--skipped">1<\/span>/);
  assert.match(html, /<div class="qa-summary-dashboard__percent">33%<\/div>/);
  assert.equal((html.match(/qa-summary-dashboard:start/g) || []).length, 1);
  assert.equal(fs.existsSync(path.join(tempDir, 'summary.html')), false);
});
