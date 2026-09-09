const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { BasePage } = require('../../pages/BasePage');
const {
  createRuntimeUserData,
  loginUserFromDataForPrecondition,
  removeRuntimeUserData,
} = require('../utils/authSetup');
const { createPageContainer } = require('./pagesFactory');
const { cleanupQueueFixture } = require('./cleanupRegistry');
const { customFixtures } = require('./custom');

/**
 * Core Framework Base Fixture
 * Quản lý vòng đời kiểm thử, cô lập worker session, nạp BasePage nền tảng
 * và cung cấp Lazy Page Container (pages) đạt chuẩn 10/10.
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
  pageObjectsRoot: [undefined, { option: true }],
  pageObjectsPlatform: [undefined, { option: true }],
  pages: async ({ page, featureName, pageObjectsRoot, pageObjectsPlatform, isMobile }, use, testInfo) => {
    const container = createPageContainer(page, {
      rootDir: pageObjectsRoot,
      platform: pageObjectsPlatform || (isMobile ? 'mobile-web' : 'desktop'),
      featureName,
    });
    await use(container);
  },
  authenticatedUser: async ({ page, workerUserData }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã xác thực tài khoản kiểm thử (authSetup: ${workerUserData.user?.phone || workerUserData.user?.username || 'Test User'})`,
    });
    const user = await test.step('[Precondition] Khởi tạo tài khoản xác thực (authSetup)', async () => {
      return await loginUserFromDataForPrecondition(page, workerUserData.user);
    });
    await use({ ...user, runtimeDataPath: workerUserData.filePath });
  },
  cleanupQueue: cleanupQueueFixture,
  ...customFixtures,
});

module.exports = { test, expect };
