/**
 * Hợp đồng rule "không hard-code link/domain" của check:framework.
 * Chạy: node --test scripts/check-framework-structure.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runFrameworkCheck } = require('./check-framework-structure');

function checkSource(relativePath, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-url-'));
  try {
    fs.mkdirSync(path.join(root, path.dirname(relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), source);
    const result = runFrameworkCheck({ root, targetArgs: [relativePath] });
    return result.issues.filter((issue) => issue.includes('hard-codes a URL/domain'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('chặn domain thật trong Page Object và spec', () => {
  const pageIssues = checkSource('pages/desktop/LoginPage.js', "async open() { await this.navigate('https://seeker.qc.vieclam24h.vn/login'); }\n");
  assert.equal(pageIssues.length, 1);
  assert.match(pageIssues[0], /LoginPage\.js:1 /);

  const specIssues = checkSource('tests/e2e/desktop/login.spec.js', [
    "const { test } = require('@playwright/test');",
    'test("a", async ({ request }) => {',
    '  await request.get("http://api.carthings.vn/v1/me");',
    '  const next = `https://staging.carthings.vn/${"checkout"}`;',
    '});',
  ].join('\n'));
  assert.equal(specIssues.length, 2);
});

test('cho phép path tương đối, URL từ env, host dự phòng/loopback và comment', () => {
  const issues = checkSource('pages/desktop/SafePage.js', [
    "const env = require('../../core/config/env');",
    '// Tài liệu: https://www.saucedemo.com',
    "async function open(page) { await page.goto('/login'); }",
    "const portal = new URL('/dashboard', env.employerURL).href;",
    "const placeholder = 'https://example.com';",
    "const sub = 'https://qc.example.org/x';",
    'const mock = `http://127.0.0.1:${3000}/`;',
    "const local = 'http://localhost:8080';",
    'module.exports = { open, portal, placeholder, sub, mock, local };',
  ].join('\n'));
  assert.deepEqual(issues, []);
});

test('không nhận nhầm domain giả mạo có chứa example.com', () => {
  const issues = checkSource('pages/desktop/SpoofPage.js', "const u = 'https://example.com.evil.vn/login';\n");
  assert.equal(issues.length, 1);
});
