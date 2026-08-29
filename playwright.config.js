const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const { randomBytes } = require('crypto');
const envConfig = require('./core/config/env');
const { getDashboardConfig } = require('./core/config/dashboardConfig');

const dashboardConfig = getDashboardConfig();
const runtimeConfig = dashboardConfig.runtime;

function readIntegerEnv(name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function readOptionEnv(name, fallback, allowed) {
  const value = process.env[name];
  return allowed.includes(value) ? value : fallback;
}

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
const workerCount = readIntegerEnv('PW_WORKERS', runtimeConfig.workers, 1, 8);
const retries = readIntegerEnv('PW_RETRIES', process.env.CI ? runtimeConfig.retriesCI : runtimeConfig.retriesLocal, 0, 5);
const testTimeout = readIntegerEnv('PW_TEST_TIMEOUT', runtimeConfig.testTimeout, 5000, 600000);
const navigationTimeout = readIntegerEnv('PW_NAVIGATION_TIMEOUT', runtimeConfig.navigationTimeout, 5000, 600000);
const actionTimeout = readIntegerEnv('PW_ACTION_TIMEOUT', runtimeConfig.actionTimeout, 0, 600000);
const viewport = {
  width: readIntegerEnv('PW_VIEWPORT_WIDTH', runtimeConfig.viewport.width, 320, 7680),
  height: readIntegerEnv('PW_VIEWPORT_HEIGHT', runtimeConfig.viewport.height, 320, 4320),
};
const trace = readOptionEnv('PW_TRACE', runtimeConfig.trace, ['off', 'on', 'retain-on-failure', 'on-first-retry']);
const screenshot = readOptionEnv('PW_SCREENSHOT', runtimeConfig.screenshot, ['off', 'on', 'only-on-failure']);
const video = readOptionEnv('PW_VIDEO', runtimeConfig.video, ['off', 'on', 'retain-on-failure', 'on-first-retry']);
let platformDir = 'all';
const argsStr = process.argv.join(' ').toLowerCase();
if (argsStr.includes('desktop')) {
  platformDir = 'desktop';
} else if (argsStr.includes('mobile-web') || argsStr.includes('mobile chrome') || argsStr.includes('mobile safari')) {
  platformDir = 'mobile-web';
} else if (argsStr.includes('mobile-app')) {
  platformDir = 'mobile-app';
} else if (process.env.TEST_PLATFORM) {
  platformDir = process.env.TEST_PLATFORM;
}

const specArg = process.argv.find(arg => arg.endsWith('.spec.js'));
const scriptFolder = specArg ? path.basename(specArg).replace(/\.spec\.js$/, '') : 'all-scripts';

const reportDir = path.join(
  'playwright-report',
  reportDate,
  platformDir,
  scriptFolder,
  `[${reportDate} ${reportTime} ${runRandomId}] report`
);

module.exports = defineConfig({
  outputDir: path.join('test-results', reportDate, platformDir, scriptFolder),
  metadata: { runId },
  timeout: testTimeout,
  testDir: './tests',
  fullyParallel: false, // Chạy các test trong cùng một file theo tuần tự, nhưng các file test khác nhau có thể chạy song song
  forbidOnly: !!process.env.CI, // Không cho phép sử dụng test.only trên CI
  retries,
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
    navigationTimeout,
    actionTimeout,
    trace,
    screenshot,
    video,
  },
  projects: [
    {
      name: 'Desktop Smoke Tests',
      testMatch: 'e2e/desktop/**/*.spec.js',
      grep: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        viewport,
      },
    },
    {
      name: 'Desktop Regression Tests',
      testMatch: 'e2e/desktop/**/*.spec.js',
      grep: /@e2e/,
      grepInvert: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        viewport,
      },
    },
    {
      name: 'Mobile Chrome Smoke Tests',
      testMatch: 'e2e/mobile-web/**/*.spec.js',
      grep: /@smoke/,
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'Mobile Chrome Regression Tests',
      testMatch: 'e2e/mobile-web/**/*.spec.js',
      grep: /@e2e/,
      grepInvert: /@smoke/,
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'Mobile Safari Smoke Tests',
      testMatch: 'e2e/mobile-web/**/*.spec.js',
      grep: /@smoke/,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'Mobile Safari Regression Tests',
      testMatch: 'e2e/mobile-web/**/*.spec.js',
      grep: /@e2e/,
      grepInvert: /@smoke/,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'API Tests',
      testMatch: 'api/**/*.spec.js',
      grep: /@api/,
      use: {
        ...devices['Desktop Chrome'],
        viewport,
      },
    },
  ],
});
