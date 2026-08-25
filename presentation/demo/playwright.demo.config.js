const { defineConfig } = require('@playwright/test');
const path = require('path');
const baseConfig = require('../../playwright.config');
const demoReportName = process.env.DEMO_REPORT_NAME || 'latest';

module.exports = defineConfig({
  ...baseConfig,
  testDir: path.resolve(__dirname, '../../tests'),
  outputDir: path.resolve(__dirname, 'results'),
  reporter: [
    ['line'],
    ['html', {
      outputFolder: path.resolve(__dirname, 'reports', demoReportName),
      open: 'never',
    }],
  ],
  use: {
    ...baseConfig.use,
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
  },
});
