const { test: baseTest } = require('@playwright/test');
const { BasePage } = require('../pages/BasePage');

// Extend basic test by providing custom fixtures like "basePage".
// This allows auto-injecting pages into your tests.
const test = baseTest.extend({
  basePage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await use(basePage);
  },
});

module.exports = { test, expect: baseTest.expect };
