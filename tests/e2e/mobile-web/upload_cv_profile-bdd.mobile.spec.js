const { test, expect } = require('../../../core/fixtures/mobileWebTest');

test.describe('Mobile Feature: Tải lên và chuyển đổi CV tại Hồ sơ của tôi trên Mobile Web @profile @mobile @e2e', () => {
  test('Người dùng mobile tải lên và chuyển đổi CV thành công', async ({ authenticatedUser, userProfilePage }) => {
    test.setTimeout(180000);

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và sẵn sàng tại trang Hồ sơ', async () => {
      await userProfilePage.navigateToMyProfile();
      await userProfilePage.capture('precondition_mobile_ho_so_cua_toi_loaded', true);
    });

    await test.step('When Tôi nhấn nút Tải lên CV và chọn file template trên mobile', async () => {
      await userProfilePage.uploadProfileCV('data/TemplateCV.pdf');
    });

    await test.step('And Tôi xác nhận đính kèm CV trên mobile', async () => {
      await userProfilePage.confirmCVConversion();
      await userProfilePage.capture('after_mobile_confirm_cv_conversion');
    });

    await test.step('Then Hệ thống báo Chuyển đổi thành công và cập nhật vào Hồ sơ trên mobile', async () => {
      await userProfilePage.verifyAndApplyCVData();
      await userProfilePage.capture('after_mobile_cv_data_applied', true);
    });

    await test.step('And Tôi có thể chuyển sang cập nhật Tiêu chí tìm việc trên mobile', async () => {
      await userProfilePage.clickSearchCriteria();
      await userProfilePage.capture('mobile_search_criteria_opened', true);
    });
  });
});
