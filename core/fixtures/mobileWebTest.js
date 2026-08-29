const { test: baseTest, expect } = require('./baseTest');
const { MobileHomePage } = require('../../pages/mobile-web/MobileHomePage');
const { MobileJobApplyNoCVPage } = require('../../pages/mobile-web/MobileJobApplyNoCVPage');
const { MobileJobSearchPage } = require('../../pages/mobile-web/MobileJobSearchPage');
const { MobileLoginPopup } = require('../../pages/mobile-web/MobileLoginPopup');
const { MobileOnboardingPopup } = require('../../pages/mobile-web/MobileOnboardingPopup');
const { MobilePopupConsent } = require('../../pages/mobile-web/MobilePopupConsent');
const { loginUserFromDataForPrecondition } = require('../utils/authSetup');

const test = baseTest.extend({
  homePage: async ({ page, featureName }, use) => {
    await use(new MobileHomePage(page, featureName));
  },
  jobApplyNoCVPage: async ({ page }, use) => {
    await use(new MobileJobApplyNoCVPage(page));
  },
  createJobApplyNoCVPage: async ({}, use) => {
    await use((targetPage) => new MobileJobApplyNoCVPage(targetPage));
  },
  jobSearchPage: async ({ page, featureName }, use) => {
    await use(new MobileJobSearchPage(page, featureName));
  },
  loginPopup: async ({ page, featureName }, use) => {
    await use(new MobileLoginPopup(page, featureName));
  },
  onboardingPopup: async ({ page }, use) => {
    await use(new MobileOnboardingPopup(page));
  },
  popupConsent: async ({ page, featureName }, use) => {
    await use(new MobilePopupConsent(page, featureName));
  },
  pageClasses: async ({}, use) => {
    await use({
      LoginPopupClass: MobileLoginPopup,
      HomePageClass: MobileHomePage,
      PopupConsentClass: MobilePopupConsent,
    });
  },
  authenticatedUser: async ({ page, workerUserData, pageClasses }, use) => {
    const user = await loginUserFromDataForPrecondition(page, workerUserData.user, pageClasses);
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },
});

module.exports = { test, expect };
