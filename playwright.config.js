const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
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
].join('-');
const reportDir = path.join(
  'playwright-report',
  reportDate,
  `[${reportDate} ${reportTime}] report`
);

module.exports = defineConfig({
  timeout: 60000,
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
      name: 'Desktop Chrome',
      testMatch: /.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'E2E Tests',
      grep: /@e2e/, // Chỉ chạy các test có tag @e2e
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'Apply Job Tests',
      grep: /@applyjob/, // Chỉ chạy các test có tag @applyjob
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
