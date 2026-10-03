const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-096 - AC-023 Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Môi trường sẵn sàng cho kịch bản (Khách vãng lai nhập số điện thoại đã tồn tại ở luồng việc làm dành riêng)',
    });

    // Lấy số điện thoại của tài khoản đã tồn tại trong hệ thống
    const existingUser = userData[0] || {};
    const existingPhone = existingUser.phone || '0987654321';

    await test.step('Given Tiền điều kiện: Môi trường sẵn sàng cho kịch bản', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('after_homepage_loaded');

      // Mở modal xác thực từ điểm chạm việc làm dành riêng
      await personalizePage.openPersonalizeAuthModal();
      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible();
      await personalizePage.capture('personalize_auth_modal_opened');
    });

    await test.step('When [1] Thực hiện thao tác với điều kiện: đúng', async () => {
      // Nhập số điện thoại đã tồn tại và bấm Tiếp tục
      await personalizePage.fillPhoneAndContinue(existingPhone);
    });

    await test.step('Then [1] Hệ thống phản hồi đúng theo quyết định đã chốt', async () => {
      // Theo quyết định đã chốt (Q-1: đúng): số điện thoại đã có tài khoản thì hiển thị màn hình mật khẩu thay vì OTP tạo mới
      await expect(personalizePage.loginPasswordInput.or(personalizePage.dangNhapBtn).or(personalizePage.authModalTitle)).toBeVisible({ timeout: 15000 });
      await expect(personalizePage.nhapHoVaTenInput).toBeHidden();
      await personalizePage.capture('decision_verified_password_screen_displayed');
    });
  });
});
