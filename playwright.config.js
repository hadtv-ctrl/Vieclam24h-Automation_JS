const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const { randomBytes } = require('crypto');
const envConfig = require('./core/config/env');

const reportRunDate = new Date();
const reportDate = [
  String(reportRunDate.getFullYear()).slice(-2),
  String(reportRunDate.getMonth() + 1).padStart(2, '0'),
  String(reportRunDate.getDate()).padStart(2, '0'),
].join('-');
const reportTime = [
  String(reportRunDate.getHours()).padStart(2, '0'),
  String(reportRunDate.getMinutes()).padStart(2, '0'),
  String(reportRunDate.getSeconds()).padStart(2, '0'),
  String(reportRunDate.getMilliseconds()).padStart(3, '0'),
].join('-');
const runRandomId = randomBytes(3).toString('hex');
const runId = `${reportDate}-${reportTime}-${runRandomId}`;
process.env.QA_RUN_ID = runId;
const requestedWorkers = Number.parseInt(process.env.PW_WORKERS || '2', 10);
const workerCount = Number.isInteger(requestedWorkers) && requestedWorkers > 0
  ? requestedWorkers
  : 2;
const reportDir = path.join(
  'playwright-report',
  reportDate,
  `[${reportDate} ${reportTime} ${runRandomId}] report`
);

module.exports = defineConfig({
  metadata: { runId },
  timeout: 60000,
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Chạy lại các test thất bại 2 lần trên CI, không chạy lại trên local
  workers: workerCount,
  reporter: [
    ['json'],
    [
      'html',
      {
        outputFolder: reportDir,
        open: 'never',
      },
    ],
    [
      './core/reporters/htmlSummaryReporter.js',
      {
        outputFolder: reportDir,
      },
    ],
    [
      './core/reporters/workerHtmlReporter.js',
      {
        outputFolder: path.join(reportDir, 'workers'),
        runId,
      },
    ],
  ],
  use: {
    baseURL: envConfig.baseURL,
    navigationTimeout: 60000,
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Smoke Tests',
      testMatch: 'e2e/**/*.spec.js',
      grep: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Regression Tests',
      testMatch: 'e2e/**/*.spec.js',
      grep: /@e2e/, // Chỉ chạy các test có tag @e2e
      grepInvert: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'API Tests',
      testMatch: 'api/**/*.spec.js',
      grep: /@api/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
