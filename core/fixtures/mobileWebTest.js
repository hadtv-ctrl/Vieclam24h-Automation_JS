const { test: baseTest, expect } = require('./baseTest');
const { loginUserFromDataForPrecondition } = require('../utils/authSetup');
const {
  dumpPageHtml,
  trackTestFailure,
  trackTestSuccess,
} = require('../utils/failureDebugHelper');

/**
 * Core Framework Mobile Web Fixture
 * Kế thừa baseTest và tự động hook theo dõi trạng thái test (Failure Tracing)
 */
const test = baseTest.extend({
  authenticatedUser: async ({ page, workerUserData }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã xác thực Mobile Web (authSetup: ${workerUserData.user?.phone || workerUserData.user?.username || 'Test User'})`,
    });
    const user = await test.step('[Precondition] Khởi tạo tài khoản xác thực Mobile Web (authSetup)', async () => {
      return await loginUserFromDataForPrecondition(page, workerUserData.user);
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
