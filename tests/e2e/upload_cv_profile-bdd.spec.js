const { test, expect } = require('@playwright/test');
const { UserProfilePage } = require('../../pages/UserProfilePage');
const { loginUserFromDataForPrecondition } = require('../../core/utils/authSetup');

test.describe('Feature: Tải lên và chuyển đổi CV tại Hồ sơ của tôi @profile @e2e', () => {
  let page;
  let userProfilePage;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    userProfilePage = new UserProfilePage(page);
  });

  test('Người dùng tải lên và chuyển đổi CV thành công', async () => {
    test.setTimeout(120000); // Tăng timeout cho luồng detect CV tốn thời gian

    await test.step('Given Tôi đang ở trang Hồ sơ của tôi', async () => {
      // Đăng nhập trước khi vào hồ sơ
      await loginUserFromDataForPrecondition(page);
      await page.goto('/ho-so-cua-toi.html');
      await userProfilePage.capture('ho_so_cua_toi_loaded', true);
    });

    await test.step('When Tôi nhấn nút Tải lên CV và chọn file template', async () => {
      await userProfilePage.uploadProfileCV('data/TemplateCV.pdf');
    });

    await test.step('And Tôi xác nhận đính kèm CV', async () => {
      await userProfilePage.confirmCVConversion();
      await userProfilePage.capture('after_confirm_cv_conversion');
    });

    await test.step('Then Hệ thống báo Chuyển đổi thành công và cập nhật vào Hồ sơ', async () => {
      await userProfilePage.verifyAndApplyCVData();
      await userProfilePage.capture('after_cv_data_applied', true);
    });

    await test.step('And Tôi có thể chuyển sang cập nhật Tiêu chí tìm việc', async () => {
      await userProfilePage.clickSearchCriteria();
      // clickSearchCriteria opens a menu/modal
      await userProfilePage.capture('search_criteria_opened', true);
    });
  });
});
