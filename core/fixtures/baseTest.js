const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { BasePage } = require('../../pages/BasePage');
const { HomePage } = require('../../pages/HomePage');
const { LoginPopup } = require('../../pages/LoginPopup');
const { OnboardingPopup } = require('../../pages/OnboardingPopup');
const { PopupConsent } = require('../../pages/PopupConsent');
const { JobSearchPage } = require('../../pages/JobSearchPage');
const { JobApplyPage } = require('../../pages/JobApplyPage');
const { JobApplyNoCVPage } = require('../../pages/JobApplyNoCVPage');
const { UserProfilePage } = require('../../pages/UserProfilePage');
const { loginUserFromDataForPrecondition } = require('../utils/authSetup');

// Page Objects for the default page are injected directly. Factories bind a
// Page Object to a popup/new tab without leaking construction into the spec.
const test = base.extend({
  featureName: async ({}, use, testInfo) => {
    await use(path.basename(testInfo.file, path.extname(testInfo.file)));
  },
  basePage: async ({ page, featureName }, use) => {
    await use(new BasePage(page, featureName));
  },
  homePage: async ({ page, featureName }, use) => {
    await use(new HomePage(page, featureName));
  },
  loginPopup: async ({ page, featureName }, use) => {
    await use(new LoginPopup(page, featureName));
  },
  onboardingPopup: async ({ page }, use) => {
    await use(new OnboardingPopup(page));
  },
  popupConsent: async ({ page, featureName }, use) => {
    await use(new PopupConsent(page, featureName));
  },
  jobSearchPage: async ({ page, featureName }, use) => {
    await use(new JobSearchPage(page, featureName));
  },
  jobApplyPage: async ({ page, featureName }, use) => {
    await use(new JobApplyPage(page, featureName));
  },
  jobApplyNoCVPage: async ({ page }, use) => {
    await use(new JobApplyNoCVPage(page));
  },
  userProfilePage: async ({ page, featureName }, use) => {
    await use(new UserProfilePage(page, featureName));
  },
  createJobApplyPage: async ({ featureName }, use) => {
    await use((targetPage) => new JobApplyPage(targetPage, featureName));
  },
  createJobApplyNoCVPage: async ({}, use) => {
    await use((targetPage) => new JobApplyNoCVPage(targetPage));
  },
  createPopupConsent: async ({ featureName }, use) => {
    await use((targetPage) => new PopupConsent(targetPage, featureName));
  },
  authenticatedUser: async ({ page }, use) => {
    const user = await loginUserFromDataForPrecondition(page);
    await use(user);
  },
});

module.exports = { test, expect };
