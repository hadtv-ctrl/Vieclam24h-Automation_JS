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

/**
 * Core Framework Mobile Web Fixture
 * Kế thừa baseTest, cung cấp Mobile Page Objects và tự động hook theo dõi trạng thái test (Failure Tracing)
 */
const test = baseTest.extend({
  pageObjectsPlatform: ['mobile-web', { option: true }],
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
      OnboardingPopupClass: MobileOnboardingPopup,
    });
  },
  pages: async ({ page, featureName, pageObjectsRoot, pageObjectsPlatform }, use) => {
    const platform = (pageObjectsPlatform || 'mobile-web').toLowerCase();
    if (platform === 'desktop') {
      throw new Error(
        `[mobileWebTest] Cấu hình pageObjectsPlatform='desktop' không hợp lệ khi chạy mobileWebTest. Vui lòng sử dụng fixture baseTest cho các kịch bản Desktop Web.`
      );
    }
    const { createPageContainer } = require('./pagesFactory');
    await use(createPageContainer(page, {
      rootDir: pageObjectsRoot,
      platform: 'mobile-web',
      featureName,
    }));
  },
  authenticatedUser: async ({ page, workerUserData, pageClasses, featureName }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã xác thực Mobile Web (authSetup: ${workerUserData.user?.phone || workerUserData.user?.username || 'Test User'})`,
    });
    const user = await test.step('[Precondition] Khởi tạo tài khoản xác thực Mobile Web (authSetup)', async () => {
      return await loginUserFromDataForPrecondition(page, workerUserData.user, {
        ...pageClasses,
        skipCloseOnboarding: Boolean(featureName && featureName.toLowerCase().includes('onboarding')),
      });
    });
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },

  // Auto fixture để dump HTML DOM khi test fail và ghi nhận vào failure tracker
  failureTrackerHook: [async ({ page }, use, testInfo) => {
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      let dumpPath = null;
      try {
        dumpPath = await dumpPageHtml(page, testInfo, 'on_failure');
      } catch (e) {
        // Ignored
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
  }, { auto: true }],
});

module.exports = { test, expect };

