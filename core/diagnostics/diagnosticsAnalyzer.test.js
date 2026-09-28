const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeDiagnostics, extractLocatorFromError } = require('./diagnosticsAnalyzer');

test('Diagnostics classifies an overlay failure deterministically without a false locator finding', () => {
  const input = { stepTitle: 'Người dùng bấm nút', error: 'Timeout waiting for locator button.submit: element is covered by overlay' };
  const first = analyzeDiagnostics(input);
  const second = analyzeDiagnostics(input);
  assert.deepEqual(first, second);
  assert.equal(first.topFinding.code, 'covered-by-overlay');
  assert.equal(first.findings.some((f) => f.code === 'locator-not-found'), false);
  assert.equal(first.deterministic, true);
  assert.equal(first.findings[0].suggestedFix.requiresConfirmation, true);
});

test('Diagnostics masks sensitive values and reports unknown evidence gaps with a next step', () => {
  const result = analyzeDiagnostics({ error: 'password=secret123 token=abc123', trace: 'trace.zip' });
  assert.equal(result.findings[0].code, 'unknown');
  assert.match(result.findings[0].suggestedFix.preview, /trace/);
  assert.doesNotMatch(JSON.stringify(result), /secret123|abc123/);
  assert.equal(result.masked, true);
});

const CASES = [
  ['connection refused → environment', 'Error: connect ECONNREFUSED 127.0.0.1:3000', 'network-unreachable', 'environment'],
  ['DNS failure → environment', 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://staging.example.vn', 'network-unreachable', 'environment'],
  ['502/503/504 → environment', 'Error: Request failed: 503 Service Unavailable', 'gateway-unavailable', 'environment'],
  ['500 → product bug', 'Server responded with 500 Internal Server Error', 'server-error', 'product_bug'],
  ['strict mode → test bug', "Error: locator.click: strict mode violation: getByRole('button', { name: 'Lưu' }) resolved to 2 elements", 'strict-mode-violation', 'test_bug'],
  ['page crash → environment', 'Error: Page crashed', 'page-crashed', 'environment'],
  ['closed target → test bug', 'Error: page.click: Target page, context or browser has been closed', 'target-closed', 'test_bug'],
];

for (const [name, error, code, category] of CASES) {
  test(`Diagnostics rule: ${name}`, () => {
    const result = analyzeDiagnostics({ error });
    assert.equal(result.topFinding.code, code);
    assert.equal(result.topCategory, category);
  });
}

test('Diagnostics marks a test that passed on retry as flaky with the highest confidence', () => {
  const result = analyzeDiagnostics({ error: 'Timeout 5000ms exceeded', status: 'passed', retry: 1 });
  assert.equal(result.topFinding.code, 'flaky-retry');
  assert.equal(result.topCategory, 'flaky');
  assert.equal(analyzeDiagnostics({ error: 'x', status: 'flaky' }).topCategory, 'flaky');
  assert.notEqual(analyzeDiagnostics({ error: 'Timeout 5000ms exceeded', status: 'failed', retry: 1 }).topCategory, 'flaky');
});

test('extractLocatorFromError pulls the Playwright locator out of the log', () => {
  assert.equal(extractLocatorFromError("waiting for getByRole('button', { name: 'Thêm xe' }) to be visible"), "getByRole('button', { name: 'Thêm xe' })");
  assert.equal(extractLocatorFromError("waiting for page.locator('#submit')"), "locator('#submit')");
  assert.equal(extractLocatorFromError('no locator here'), '');
  assert.equal(analyzeDiagnostics({ error: "strict mode violation: locator('.row') resolved to 3 elements" }).locator, "locator('.row')");
});
