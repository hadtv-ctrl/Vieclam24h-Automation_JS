const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { BasePage } = require('../../pages/BasePage');
const { HomePage } = require('../../pages/desktop/HomePage');
const { LoginPopup } = require('../../pages/desktop/LoginPopup');
const { OnboardingPopup } = require('../../pages/desktop/OnboardingPopup');
const { PopupConsent } = require('../../pages/desktop/PopupConsent');
const { JobSearchPage } = require('../../pages/desktop/JobSearchPage');
const { JobApplyPage } = require('../../pages/desktop/JobApplyPage');
const { JobApplyNoCVPage } = require('../../pages/desktop/JobApplyNoCVPage');
const { UserProfilePage } = require('../../pages/desktop/UserProfilePage');
const {
  createRuntimeUserData,
  loginUserFromDataForPrecondition,
  removeRuntimeUserData,
} = require('../utils/authSetup');

// Page Objects for the default page are injected directly. Factories bind a
// Page Object to a popup/new tab without leaking construction into the spec.
const test = base.extend({
  workerUserData: async ({}, use, testInfo) => {
    const runtimeUserData = await createRuntimeUserData(testInfo.parallelIndex ?? testInfo.workerIndex ?? 0);
    try {
      await use(runtimeUserData);
    } finally {
      await removeRuntimeUserData(runtimeUserData.filePath);
    }
  },
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
  authenticatedUser: async ({ page, workerUserData }, use) => {
    const user = await loginUserFromDataForPrecondition(page, workerUserData.user);
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },
});

module.exports = { test, expect };
