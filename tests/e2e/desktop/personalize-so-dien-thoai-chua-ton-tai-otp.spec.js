const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-100 - AC-023 Số điện thoại chưa tồn tại chuyển hướng sang luồng xác thực OTP', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đang ở màn hình nhập số điện thoại của luồng tiếp cận việc làm dành riêng',
    });

    // Tạo số điện thoại hợp lệ chưa từng đăng ký trên hệ thống
    const unregisteredPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình nhập số điện thoại của luồng tiếp cận việc làm dành riêng', async () => {
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

    await test.step('When [1] Nhập số điện thoại chưa đăng ký và bấm Tiếp tục', async () => {
      // Nhập số điện thoại chưa tồn tại và nhấn Tiếp tục
      await personalizePage.fillPhoneAndContinue(unregisteredPhone);
    });

    await test.step('Then [1] Hệ thống không hiển thị màn hình mật khẩu mà chuyển hướng sang màn hình nhập mã OTP để tạo tài khoản mới', async () => {
      // Xác nhận hệ thống chuyển sang màn hình nhập mã OTP
      await expect(personalizePage.otpInputIndicator).toBeVisible({ timeout: 15000 });

      // Khẳng định KHÔNG hiển thị trường nhập mật khẩu (luồng tài khoản đã tồn tại)
      await expect(personalizePage.loginPasswordInput).toBeHidden();
      await personalizePage.capture('otp_verification_screen_displayed');
    });
  });
});
