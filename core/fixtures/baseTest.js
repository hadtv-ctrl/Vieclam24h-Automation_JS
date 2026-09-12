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
const { createPageContainer } = require('./pagesFactory');
const { cleanupQueueFixture } = require('./cleanupRegistry');
const { customFixtures } = require('./custom');

const RESERVED_FIXTURE_NAMES = new Set([
  'test', 'expect', 'page', 'request', 'browser', 'context',
  'basePage', 'pages', 'workerUserData', 'authenticatedUser',
  'cleanupQueue', 'featureName', 'pageObjectsRoot', 'pageObjectsPlatform',
  'isMobile', 'viewport', 'browserName', 'storageState',
  'homePage', 'loginPopup', 'onboardingPopup', 'popupConsent',
  'jobSearchPage', 'jobApplyPage', 'jobApplyNoCVPage', 'userProfilePage',
  'createJobApplyPage', 'createJobApplyNoCVPage', 'createPopupConsent'
]);

function resolvePlatform({ pageObjectsPlatform, isMobile, testInfo }) {
  // 1. Explicit override option has highest precedence
  if (pageObjectsPlatform) {
    const p = String(pageObjectsPlatform).toLowerCase();
    if (!['desktop', 'mobile-web', 'mobile', 'auto'].includes(p)) {
      throw new Error(`[baseTest] Giá trị pageObjectsPlatform='${pageObjectsPlatform}' không hợp lệ. Chỉ chấp nhận 'desktop', 'mobile-web' hoặc 'auto'.`);
    }
    if (p === 'mobile') return 'mobile-web';
    if (p !== 'auto') return p;
  }

  // 2. Public Playwright device option isMobile
  if (typeof isMobile === 'boolean') {
    return isMobile ? 'mobile-web' : 'desktop';
  }

  // 3. Legacy hints: project name or spec file path
  const proj = (testInfo?.project?.name || '').toLowerCase();
  const file = (testInfo?.file || '').toLowerCase();
  if (proj.includes('mobile') || file.includes('mobile')) {
    return 'mobile-web';
  }

  // 4. Default fallback
  return 'desktop';
}

const safeCustomFixtures = {};
for (const [key, fixtureVal] of Object.entries(customFixtures || {})) {
  if (RESERVED_FIXTURE_NAMES.has(key)) {
    console.warn(`[baseTest Warning] Custom fixture '${key}' trùng với từ khóa hoặc fixture nền tảng đã được bảo vệ. Fixture này bị bỏ qua.`);
    continue;
  }
  safeCustomFixtures[key] = fixtureVal;
}

/**
 * Core Framework Base Fixture
 * Quản lý vòng đời kiểm thử, cô lập worker session, nạp BasePage nền tảng
 * và cung cấp Lazy Page Container (pages) đạt chuẩn 10/10 cùng Page Objects trực tiếp.
 */
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
  pageObjectsRoot: [undefined, { option: true }],
  pageObjectsPlatform: [undefined, { option: true }],
  pages: async ({ page, featureName, pageObjectsRoot, pageObjectsPlatform, isMobile }, use, testInfo) => {
    const platform = resolvePlatform({ pageObjectsPlatform, isMobile, testInfo });
    const container = createPageContainer(page, {
      rootDir: pageObjectsRoot,
      platform,
      featureName,
    });
    await use(container);
  },
  authenticatedUser: async ({ page, workerUserData, featureName }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã xác thực tài khoản kiểm thử (authSetup: ${workerUserData.user?.phone || workerUserData.user?.username || 'Test User'})`,
    });
    const user = await test.step('[Precondition] Khởi tạo tài khoản xác thực (authSetup)', async () => {
      return await loginUserFromDataForPrecondition(page, workerUserData.user, {
        skipCloseOnboarding: Boolean(featureName && featureName.toLowerCase().includes('onboarding')),
      });
    });
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },
  cleanupQueue: cleanupQueueFixture,
  ...safeCustomFixtures,
});

module.exports = {
  test,
  expect,
  resolvePlatform,
  RESERVED_FIXTURE_NAMES,
};
