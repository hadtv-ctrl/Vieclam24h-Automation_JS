'use strict';

const fs = require('fs');
const path = require('path');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildPackageJson(name, projectName) {
  return {
    name: slugify(name),
    version: '1.0.0',
    description: `${projectName} - Playwright Automation Suite`,
    main: 'index.js',
    scripts: {
      test: 'playwright test',
      'test:e2e': 'playwright test --project="Desktop Smoke Tests" --project="Desktop Regression Tests"',
      'test:ui': 'playwright test --ui',
      'test:headed': 'playwright test --headed',
      dashboard: 'node dashboard/server.js',
      'dashboard:start': 'node dashboard/start-server.js',
      'dashboard:stop': 'node dashboard/stop-server.js',
      'suite:smoke': 'playwright test --project="Desktop Smoke Tests"',
      'suite:regression': 'playwright test --project="Desktop Regression Tests"',
      'suite:desktop': 'playwright test --project="Desktop Smoke Tests"',
      'suite:api': 'playwright test --project="API Tests"',
      report: 'playwright show-report',
      'check:framework': 'node scripts/check-framework-structure.js',
      'update:framework': 'node scripts/update-framework.js',
      'cleanup:reports': 'node scripts/cleanup-reports.js',
    },
    devDependencies: {
      '@playwright/test': '^1.40.0',
    },
    dependencies: {
      dotenv: '^16.3.1',
    },
  };
}

function buildDashboardConfig(projectName, url, port = 'auto') {
  const serverPort = port === 'auto' ? 'auto' : (Number.parseInt(port, 10) || 'auto');
  const apiBaseURL = url.replace(/\/$/, '') + '/api';
  return {
    branding: {
      projectName,
      projectSubtitle: 'Playwright Automation Studio',
      pageTitle: `${projectName} Dashboard`,
      primaryColor: '#0A65CC',
      fontSize: '14px',
    },
    server: { port: serverPort },
    environments: {
      qc: { label: 'QC', baseURL: url, apiBaseURL },
      stg: { label: 'Staging', baseURL: url, apiBaseURL },
      prod: { label: 'Production', baseURL: url, apiBaseURL },
    },
  };
}

function generateStarterFiles(targetDir, config) {
  const { name, url, title, port = 'auto' } = config;
  const projectName = title || name.replace(/[_-]/g, ' ');

  // 1. package.json & playwright.config.js
  const pkg = buildPackageJson(name, projectName);
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  const pwConfig = "const { defineQaConfig } = require('./core/config/defineConfig');\n\nmodule.exports = defineQaConfig();\n";
  fs.writeFileSync(path.join(targetDir, 'playwright.config.js'), pwConfig, 'utf8');

  // 2. dashboardConfig.json
  const dashCfg = buildDashboardConfig(projectName, url, port);
  const cfgStr = JSON.stringify(dashCfg, null, 2) + '\n';
  fs.mkdirSync(path.join(targetDir, 'core', 'config'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'core', 'config', 'dashboardConfig.json'), cfgStr, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'dashboardConfig.json'), cfgStr, 'utf8');

  // 3. pages/BasePage.js & pages/desktop/HomePage.js
  const basePageCode = [
    'class BasePage {',
    '  constructor(page) { this.page = page; }',
    '  async navigate(path = "") { await this.page.goto(path); }',
    '  async getTitle() { return await this.page.title(); }',
    '}',
    'module.exports = { BasePage };',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, 'pages', 'BasePage.js'), basePageCode, 'utf8');

  const homePageCode = [
    "const { BasePage } = require('../BasePage');",
    'class HomePage extends BasePage {',
    '  constructor(page) {',
    '    super(page);',
    "    this.header = page.locator('header, h1, nav').first();",
    '  }',
    '  async isHeaderVisible() { return await this.header.isVisible(); }',
    '}',
    'module.exports = { HomePage };',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, 'pages', 'desktop', 'HomePage.js'), homePageCode, 'utf8');

  // 4. specs (tests/e2e/desktop/smoke.spec.js & tests/api/health.spec.js)
  const smokeSpecCode = [
    "const { test, expect } = require('@playwright/test');",
    "const { HomePage } = require('../../../pages/desktop/HomePage');",
    "test.describe('Desktop Smoke Tests', () => {",
    "  test('Kiểm tra tải trang chủ thành công @smoke', async ({ page }) => {",
    '    const homePage = new HomePage(page);',
    "    await homePage.navigate('/');",
    '    await expect(page).toHaveTitle(/./);',
    '  });',
    '});',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, 'tests', 'e2e', 'desktop', 'smoke.spec.js'), smokeSpecCode, 'utf8');

  const apiSpecCode = [
    "const { test, expect } = require('@playwright/test');",
    "test.describe('API Health Check', () => {",
    "  test('Kiểm tra API readiness @api', async ({ request }) => {",
    "    const response = await request.get('/');",
    '    expect(response.status()).toBeLessThan(500);',
    '  });',
    '});',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, 'tests', 'api', 'health.spec.js'), apiSpecCode, 'utf8');

  // 5. core/local (README & commonUtils.local.js)
  const localReadme = '# core/local\nThư mục này thuộc dự án vệ tinh, Hub KHÔNG BAO GIỜ ghi đè.\n';
  fs.writeFileSync(path.join(targetDir, 'core', 'local', 'README.md'), localReadme, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'core', 'local', 'commonUtils.local.js'), 'module.exports = {};\n', 'utf8');

  // 6. .env & .gitignore
  const envContent = `DASHBOARD_PORT=${port}\nPORT=${port}\nBASE_URL=${url}\n`;
  fs.writeFileSync(path.join(targetDir, '.env'), envContent, 'utf8');
  fs.writeFileSync(path.join(targetDir, '.gitignore'), 'node_modules/\ntest-results/\nplaywright-report/\n.tmp/\n.env\n', 'utf8');

  // 7. ai/ lessons
  const lessonHead = `> **This file belongs to THIS project. The Hub never overwrites it.**\n`;
  fs.mkdirSync(path.join(targetDir, 'ai', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'ai', 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'ai', 'shared', 'TEST_AUTOMATION_LESSONS.md'), `# Lessons - ${projectName}\n${lessonHead}`, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'ai', 'dashboard', 'AI_LESSONS.md'), `# Dashboard Lessons - ${projectName}\n${lessonHead}`, 'utf8');
}

module.exports = {
  slugify,
  buildPackageJson,
  buildDashboardConfig,
  generateStarterFiles,
};
