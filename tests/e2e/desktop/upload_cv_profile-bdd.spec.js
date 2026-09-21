const path = require('path');
const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Tải lên và chuyển đổi CV tại Hồ sơ của tôi @profile @desktop @e2e @REQ-005', () => {
  test('TC-021 - AC-019 Tải lên và chuyển đổi CV tại trang Hồ sơ của tôi', async ({ page, authenticatedUser, pages }) => {
    const userProfilePage = pages.userProfilePage;
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(240000); // Tăng timeout cho luồng detect CV tốn thời gian

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang Hồ sơ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await userProfilePage.navigateToMyProfile();
      await userProfilePage.capture('precondition_ho_so_cua_toi_loaded', true);
    });

    await test.step('When Tôi nhấn nút Tải lên CV và chọn file template', async () => {
      const cvPath = path.resolve(__dirname, '../../../data/TemplateCV.pdf');
      await userProfilePage.uploadProfileCV(cvPath);
    });

    await test.step('And Tôi xác nhận đính kèm CV', async () => {
      await userProfilePage.confirmCVConversion();
      await userProfilePage.capture('after_confirm_cv_conversion');
    });

    await test.step('Then Hệ thống báo Chuyển đổi thành công và cập nhật vào Hồ sơ', async () => {
      await expect(userProfilePage.toastSuccess).toBeVisible({ timeout: 60000 });
      await userProfilePage.verifyAndApplyCVData();
      await userProfilePage.capture('after_cv_data_applied', true);
    });

    await test.step('And Tôi có thể chuyển sang cập nhật Tiêu chí tìm việc', async () => {
      await userProfilePage.clickSearchCriteria();
      await userProfilePage.capture('search_criteria_opened', true);
    });
  });
});
