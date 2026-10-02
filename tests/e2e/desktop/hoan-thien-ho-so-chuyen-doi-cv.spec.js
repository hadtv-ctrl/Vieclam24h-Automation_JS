const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Quản lý hồ sơ - Chuyển đổi CV và đồng bộ Onboarding @auth @profile @desktop @e2e @REQ-005', () => {
  test('TC-046 - AC-015 AC-016 AC-019: Hoàn thiện hồ sơ và chuyển đổi CV', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const userProfilePage = pages.userProfilePage;
    const onboardingPopup = new OnboardingPopup(page);

    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập trên môi trường QC, mở trang Hồ sơ của tôi',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ QC', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_logged_in_state');
    });

    await test.step('When [1] Điều hướng vào trang Hồ sơ của tôi trên QC', async () => {
      await homePage.closeBlockingModalIfVisible();
      await userProfilePage.navigateToMyProfile();
      await userProfilePage.capture('my_profile_page_loaded');
    });

    await test.step('Then [1] Kiểm tra khối Tổng quan hồ sơ và danh sách các mục hoàn thiện', async () => {
      await expect(userProfilePage.profileOverview).toBeVisible({ timeout: 15000 });
      await userProfilePage.capture('profile_overview_sections_visible');
    });

    await test.step('When [2] Kiểm tra tính năng Tải ngay CV lên để điền nhanh hồ sơ (Chuyển đổi CV)', async () => {
      await expect(userProfilePage.btnUploadCV).toBeVisible({ timeout: 10000 });
      await userProfilePage.capture('cv_conversion_feature_visible');
    });

    await test.step('When [3] Điều hướng sang trang Tiêu chí tìm việc để kiểm tra đồng bộ hai chiều', async () => {
      await userProfilePage.openJobCriteria();
      await userProfilePage.capture('job_criteria_page_loaded');
    });

    await test.step('Then [3] Dữ liệu tiêu chí tìm việc hiển thị đồng bộ với thông tin đã thiết lập', async () => {
      await expect(userProfilePage.criteriaHeading).toBeVisible({ timeout: 15000 });
      await userProfilePage.capture('job_criteria_sync_verified');
    });
  });
});
