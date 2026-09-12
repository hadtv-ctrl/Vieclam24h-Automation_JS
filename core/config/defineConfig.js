const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const { randomBytes } = require('crypto');
const envConfig = require('./env');
const { getDashboardConfig } = require('./dashboardConfig');

function readIntegerEnv(name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function readOptionEnv(name, fallback, allowed) {
  const value = process.env[name];
  return allowed.includes(value) ? value : fallback;
}

function defineQaConfig(customConfig = {}) {
  const dashboardConfig = getDashboardConfig();
  const runtimeConfig = dashboardConfig.runtime || {};

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

  const workerCount = readIntegerEnv('PW_WORKERS', runtimeConfig.workers || 2, 1, 8);
  const retries = readIntegerEnv('PW_RETRIES', process.env.CI ? (runtimeConfig.retriesCI ?? 2) : (runtimeConfig.retriesLocal ?? 0), 0, 5);
  const testTimeout = readIntegerEnv('PW_TEST_TIMEOUT', runtimeConfig.testTimeout || 60000, 5000, 600000);
  const navigationTimeout = readIntegerEnv('PW_NAVIGATION_TIMEOUT', runtimeConfig.navigationTimeout || 60000, 5000, 600000);
  const actionTimeout = readIntegerEnv('PW_ACTION_TIMEOUT', runtimeConfig.actionTimeout || 0, 0, 600000);

  const defaultVp = runtimeConfig.viewport || { width: 1920, height: 1080 };
  const viewport = {
    width: readIntegerEnv('PW_VIEWPORT_WIDTH', defaultVp.width, 320, 7680),
    height: readIntegerEnv('PW_VIEWPORT_HEIGHT', defaultVp.height, 320, 4320),
  };

  const trace = readOptionEnv('PW_TRACE', runtimeConfig.trace || 'on-first-retry', ['off', 'on', 'retain-on-failure', 'on-first-retry']);
  const screenshot = readOptionEnv('PW_SCREENSHOT', runtimeConfig.screenshot || 'only-on-failure', ['off', 'on', 'only-on-failure']);
  const video = readOptionEnv('PW_VIDEO', runtimeConfig.video || 'retain-on-failure', ['off', 'on', 'retain-on-failure', 'on-first-retry']);

  const specArg = process.argv.find((arg) => arg.endsWith('.spec.js'));
  const scriptFolder = specArg ? path.basename(specArg).replace(/\.spec\.js$/, '') : 'all-scripts';
  const normalizedSpecArg = specArg ? specArg.replace(/\\/g, '/').toLowerCase() : '';

  let platformDir = 'all';
  const argsStr = process.argv.join(' ').toLowerCase();

  if (normalizedSpecArg.includes('/mobile-web/') || normalizedSpecArg.includes('.mobile.')) {
    platformDir = 'mobile-web';
  } else if (normalizedSpecArg.includes('/desktop/')) {
    platformDir = 'desktop';
  } else if (normalizedSpecArg.includes('/api/')) {
    platformDir = 'api';
  } else if (argsStr.includes('mobile-web') || argsStr.includes('mobile chrome') || argsStr.includes('mobile safari')) {
    platformDir = 'mobile-web';
  } else if (argsStr.includes('desktop')) {
    platformDir = 'desktop';
  } else if (argsStr.includes('api')) {
    platformDir = 'api';
  } else if (process.env.TEST_PLATFORM) {
    platformDir = process.env.TEST_PLATFORM;
  }

  // ─── Suite-grouped report structure ────────────────────────────────────────
  // When launched from a suite (QA_SUITE_NAME is set), reports are grouped:
  //   playwright-report / [date] / [suite-name] / [HH-MM-SS] / [script]
  // When launched standalone, keep the original structure:
  //   playwright-report / [date] / [platform] / [script] / [timestamp] report
  const suiteName = process.env.QA_SUITE_NAME || '';
  const safeStartTime = reportTime.slice(0, 8); // HH-MM-SS only
  const reportDir = suiteName
    ? path.join(
        'playwright-report',
        reportDate,
        suiteName,
        safeStartTime,
        scriptFolder
      )
    : path.join(
        'playwright-report',
        reportDate,
        platformDir,
        scriptFolder,
        `[${reportDate} ${reportTime} ${runRandomId}] report`
      );

  // Dynamic absolute resolution for internal reporters to prevent missing module errors in client projects
  let htmlSummaryReporterPath = path.resolve(__dirname, '../reporters/htmlSummaryReporter.js');
  let workerHtmlReporterPath = path.resolve(__dirname, '../reporters/workerHtmlReporter.js');
  let suiteReporterPath = path.resolve(__dirname, '../reporters/suiteReporter.js');

  const baseConfig = {
    outputDir: suiteName
      ? path.join('test-results', reportDate, suiteName, safeStartTime, scriptFolder)
      : path.join('test-results', reportDate, platformDir, scriptFolder),
    metadata: { runId },
    timeout: testTimeout,
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries,
    workers: workerCount,
    reporter: [
      ['list'],
      ['json', { outputFile: path.join(reportDir, 'results.json') }],
      [
        'html',
        {
          outputFolder: reportDir,
          open: 'never',
        },
      ],
      [
        htmlSummaryReporterPath,
        {
          outputFolder: reportDir,
        },
      ],
      [
        workerHtmlReporterPath,
        {
          outputFolder: path.join(reportDir, 'workers'),
          runId,
        },
      ],
      // Suite-level aggregated report: only active when QA_SUITE_NAME is set
      ...(suiteName ? [[
        suiteReporterPath,
        {
          // Output to the time folder (parent of the per-script folders)
          outputFolder: suiteName
            ? path.join('playwright-report', reportDate, suiteName, safeStartTime)
            : reportDir,
          suiteName,
          suiteLabel: process.env.QA_SUITE_LABEL || suiteName,
        },
      ]] : []),
    ],
    use: {
      baseURL: envConfig.baseURL || 'https://example.com',
      navigationTimeout,
      actionTimeout,
      trace,
      screenshot,
      video,
      ...(customConfig.use || {}),
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
  };

  return defineConfig({
    ...baseConfig,
    ...customConfig,
    use: {
      ...baseConfig.use,
      ...(customConfig.use || {}),
    },
  });
}

module.exports = {
  defineQaConfig,
};
