const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Ứng tuyển việc làm @applyjob @desktop @e2e @REQ-003', () => {
  test('TC-037 - AC-011 Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển)', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và có việc làm trong danh sách đã ứng tuyển',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('When [1] Tôi mở danh sách Việc làm đã ứng tuyển từ tài khoản cá nhân', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openAppliedJobs();
      await homePage.capture('applied_jobs_menu_opened');
    });

    await test.step('Then [1] Danh sách việc làm đã ứng tuyển hiển thị trạng thái hồ sơ đã nộp thành công', async () => {
      await homePage.expectAppliedJobsVisible();
      await expect(homePage.appliedJobsList).toBeVisible({ timeout: 30000 });
      await homePage.capture('applied_jobs_list_verified');
    });
  });
});
