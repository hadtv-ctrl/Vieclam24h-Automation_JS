const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { BasePage } = require('../../pages/BasePage');
const {
  createRuntimeUserData,
  loginUserFromDataForPrecondition,
  removeRuntimeUserData,
} = require('../utils/authSetup');

/**
 * Core Framework Base Fixture
 * Quản lý vòng đời kiểm thử, cô lập worker session và nạp BasePage nền tảng
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
});

module.exports = { test, expect };
