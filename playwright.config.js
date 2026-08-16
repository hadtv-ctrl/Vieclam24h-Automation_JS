const { defineConfig, devices } = require('@playwright/test');
const envConfig = require('./core/config/env');

const reportDir = `playwright-report/report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

module.exports = defineConfig({
  timeout: 60000,
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['json'],
    ['html', {
      outputFolder: reportDir,
      open: 'never'
    }],
    ['./core/reporters/summaryReporter.js', {
      outputFolder: reportDir
    }]
  ],
  use: {
    baseURL: envConfig.baseURL,
    navigationTimeout: 60000,
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
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
    }
  ],
});
