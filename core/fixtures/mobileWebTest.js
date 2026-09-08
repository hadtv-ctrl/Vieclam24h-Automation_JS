const { test: baseTest, expect } = require('./baseTest');
const { MobileHomePage } = require('../../pages/mobile-web/MobileHomePage');
const { MobileJobApplyNoCVPage } = require('../../pages/mobile-web/MobileJobApplyNoCVPage');
const { MobileJobApplyPage } = require('../../pages/mobile-web/MobileJobApplyPage');
const { MobileJobSearchPage } = require('../../pages/mobile-web/MobileJobSearchPage');
const { MobileLoginPopup } = require('../../pages/mobile-web/MobileLoginPopup');
const { MobileOnboardingPopup } = require('../../pages/mobile-web/MobileOnboardingPopup');
const { MobilePopupConsent } = require('../../pages/mobile-web/MobilePopupConsent');
const { MobileUserProfilePage } = require('../../pages/mobile-web/MobileUserProfilePage');
const { loginUserFromDataForPrecondition } = require('../utils/authSetup');
const {
  dumpPageHtml,
  trackTestFailure,
  trackTestSuccess,
} = require('../utils/failureDebugHelper');

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
  jobApplyPage: async ({ page, featureName }, use) => {
    await use(new MobileJobApplyPage(page, featureName));
  },
  createJobApplyPage: async ({ featureName }, use) => {
    await use((targetPage) => new MobileJobApplyPage(targetPage, featureName));
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
  createPopupConsent: async ({ featureName }, use) => {
    await use((targetPage) => new MobilePopupConsent(targetPage, featureName));
  },
  userProfilePage: async ({ page, featureName }, use) => {
    await use(new MobileUserProfilePage(page, featureName));
  },
  pageClasses: async ({}, use) => {
    await use({
      LoginPopupClass: MobileLoginPopup,
      HomePageClass: MobileHomePage,
      PopupConsentClass: MobilePopupConsent,
    });
  },
  authenticatedUser: async ({ page, workerUserData, pageClasses }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập Mobile Web (authSetup: ${workerUserData.user?.phone || 'Test User'})`,
    });
    const user = await test.step('[Precondition] Đăng nhập tự động Mobile Web (authSetup)', async () => {
      return await loginUserFromDataForPrecondition(page, workerUserData.user, pageClasses);
    });
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },
});

// Hook tự động dump HTML DOM khi test fail và ghi nhận vào failure tracker (phát hiện lỗi 3 lần liên tiếp)
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    let dumpPath = null;
    try {
      dumpPath = await dumpPageHtml(page, testInfo, 'on_failure');
    } catch (e) {
      // Ignored: dump failure should not mask original test error
    }
    try {
      await trackTestFailure(testInfo, testInfo.error, dumpPath);
    } catch (e) {
      // Ignored
    }
  } else {
    try {
      await trackTestSuccess(testInfo);
    } catch (e) {
      // Ignored
    }
  }
});

module.exports = { test, expect };
