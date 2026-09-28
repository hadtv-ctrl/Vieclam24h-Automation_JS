'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findHardcodedSecrets, scanContent } = require('./secretScan');

// Built at runtime so this test file never contains a literal key for the scanner to flag.
const FAKE_OPENAI = `sk-${'a1b2c3d4'.repeat(4)}`;
const FAKE_GOOGLE = `AIza${'Xy9_'.repeat(8)}abc`;
const FAKE_GITHUB = `ghp_${'Ab3'.repeat(12)}`;

test('scanContent: bắt key dạng sk-, AIza và token GitHub, báo đúng dòng', () => {
  const content = `const a = 1;\nconst key = '${FAKE_OPENAI}';\nconst g = "${FAKE_GOOGLE}";\nconst t = '${FAKE_GITHUB}';\n`;
  const findings = scanContent('app.js', content);
  assert.equal(findings.length, 3);
  assert.match(findings[0], /^app\.js:2 .*sk-…/);
  assert.match(findings[1], /^app\.js:3 .*AIza…/);
  assert.match(findings[2], /^app\.js:4 .*GitHub token/);
});

test('scanContent: báo cáo không lặp lại toàn bộ key', () => {
  const [finding] = scanContent('app.js', `x = '${FAKE_OPENAI}'`);
  assert.equal(finding.includes(FAKE_OPENAI), false);
  assert.match(finding, /sk-a1b…\(35 ký tự\)/);
});

test('scanContent: placeholder và chuỗi ngắn không bị báo', () => {
  const content = [
    "keyPlaceholder: 'sk-... (để trống nếu 9Router không bật xác thực)'",
    "keyPlaceholder: 'sk-proj-... hoặc sk-...'",
    "keyPlaceholder: 'sk-ant-...'",
    "keyPlaceholder: 'AIzaSy...'",
    `const task = 'disk-${'0123456789abcdef0123456789'}';`,
    "const id = 'sk-short';",
  ].join('\n');
  assert.deepEqual(scanContent('app.js', content), []);
});

test('findHardcodedSecrets: quét thư mục nguồn, bỏ qua node_modules và đuôi không liên quan', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-'));
  try {
    fs.mkdirSync(path.join(root, 'dashboard', 'routes'), { recursive: true });
    fs.mkdirSync(path.join(root, 'core', 'node_modules', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dashboard', 'routes', 'ai.js'), `const k = '${FAKE_OPENAI}';\n`);
    fs.writeFileSync(path.join(root, 'dashboard', 'logo.png'), FAKE_OPENAI);
    fs.writeFileSync(path.join(root, 'core', 'node_modules', 'lib', 'x.js'), `'${FAKE_OPENAI}'`);
    fs.writeFileSync(path.join(root, 'data', 'users.json'), `{"k":"${FAKE_OPENAI}"}`);

    const findings = findHardcodedSecrets({ root });
    assert.equal(findings.length, 1);
    assert.match(findings[0], new RegExp(`^${path.join('dashboard', 'routes', 'ai.js').replace(/\\/g, '\\\\')}:1 `));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('findHardcodedSecrets: chế độ file chỉ định chỉ quét đúng các file đó', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-'));
  try {
    fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
    fs.writeFileSync(path.join(root, 'pages', 'clean.js'), 'module.exports = {};\n');
    fs.writeFileSync(path.join(root, 'pages', 'leak.js'), `'${FAKE_GOOGLE}'`);
    assert.deepEqual(findHardcodedSecrets({ root, files: [path.join('pages', 'clean.js')] }), []);
    assert.equal(findHardcodedSecrets({ root, files: [path.join('pages', 'leak.js')] }).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
