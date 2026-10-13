'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  slugify,
  parseArgs,
  generateStarterFiles,
} = require('./create-satellite');

test('slugify chuyển đổi tên dự án thành npm package name hợp lệ', () => {
  assert.equal(slugify('Automation_DuAnMoi'), 'automation_duanmoi');
  assert.equal(slugify('Vieclam 24h & App'), 'vieclam-24h-app');
  assert.equal(slugify('My-Special-Project!'), 'my-special-project');
});

test('generateStarterFiles sinh đầy đủ cấu trúc nghiệp vụ và file starter hợp lệ', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sat-test-'));

  try {
    // Tạo các thư mục cơ bản
    const dirs = [
      'pages/desktop',
      'tests/e2e/desktop',
      'tests/api',
      'data',
      'requirements',
      'test-cases',
      'core/local',
      'core/config',
    ];
    for (const d of dirs) fs.mkdirSync(path.join(tmpDir, d), { recursive: true });

    generateStarterFiles(tmpDir, {
      name: 'Automation_TestApp',
      url: 'https://qc.testapp.vn',
      title: 'Test App Automation',
    });

    // 1. Kiểm tra package.json
    const pkgPath = path.join(tmpDir, 'package.json');
    assert.ok(fs.existsSync(pkgPath));
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.name, 'automation_testapp');
    assert.ok(pkg.scripts.test);
    assert.ok(pkg.scripts.dashboard);
    assert.ok(pkg.scripts['check:framework']);

    // 2. Kiểm tra playwright.config.js
    const pwPath = path.join(tmpDir, 'playwright.config.js');
    assert.ok(fs.existsSync(pwPath));
    assert.ok(fs.readFileSync(pwPath, 'utf8').includes('defineQaConfig'));

    // 3. Kiểm tra dashboardConfig.json
    const cfgPath = path.join(tmpDir, 'dashboardConfig.json');
    assert.ok(fs.existsSync(cfgPath));
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(cfg.environments.qc.baseURL, 'https://qc.testapp.vn');
    assert.equal(cfg.branding.projectName, 'Test App Automation');

    // 4. Kiểm tra Page Objects & Specs
    assert.ok(fs.existsSync(path.join(tmpDir, 'pages', 'BasePage.js')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'pages', 'desktop', 'HomePage.js')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'tests', 'e2e', 'desktop', 'smoke.spec.js')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'tests', 'api', 'health.spec.js')));

    // 5. Kiểm tra core/local
    assert.ok(fs.existsSync(path.join(tmpDir, 'core', 'local', 'README.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'core', 'local', 'commonUtils.local.js')));

    // 6. Kiểm tra ai/ lessons
    assert.ok(fs.existsSync(path.join(tmpDir, 'ai', 'shared', 'TEST_AUTOMATION_LESSONS.md')));
    const lessonContent = fs.readFileSync(path.join(tmpDir, 'ai', 'shared', 'TEST_AUTOMATION_LESSONS.md'), 'utf8');
    assert.ok(lessonContent.includes('This file belongs to THIS project'));

    // 7. Kiểm tra .env & .gitignore
    assert.ok(fs.existsSync(path.join(tmpDir, '.env')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.gitignore')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
