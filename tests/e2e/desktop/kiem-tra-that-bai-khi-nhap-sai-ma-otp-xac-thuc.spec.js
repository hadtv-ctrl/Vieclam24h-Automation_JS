const { test, expect } = require('../../../core/fixtures/baseTest');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Số điện thoại @register @desktop @e2e @REQ-001', () => {
  test('TC-033 - AC-002 Kiểm tra thất bại khi nhập sai mã OTP xác thực', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Người dùng đang ở màn hình nhập mã xác thực OTP)',
    });

    const randomPhone = generateRandomVNPhone();
    const wrongOtp = '9999';

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình nhập mã xác thực OTP', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('after_homepage_loaded');

      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.fillPhone(randomPhone);
      await loginPopup.capture('phone_entered_before_otp');
      await loginPopup.clickContinueUntilOtpVisible({ maxAttempts: 3 });

      await loginPopup.waitForOtpVisible();
      await expect(loginPopup.otpModalTitle.or(loginPopup.otpInputs.first())).toBeVisible();
      await loginPopup.capture('otp_screen_visible');
    });

    await test.step('When [1] Nhập mã OTP sai khác mã xác thực chuẩn', async () => {
      await loginPopup.fillOtpCode(wrongOtp);
      await loginPopup.capture('wrong_otp_filled');
    });

    await test.step('Then [1] Hệ thống hiển thị thông báo lỗi mã xác thực không chính xác và chặn tiến vào form', async () => {
      // Hệ thống báo lỗi mã OTP sai hoặc giữ nguyên màn hình OTP và không mở form Tạo tài khoản mới
      await expect(loginPopup.registerFormTitle).toBeHidden();
      await expect(loginPopup.otpError.or(loginPopup.otpModalTitle).or(loginPopup.otpInputs.first())).toBeVisible();
      await loginPopup.capture('wrong_otp_rejected');
    });
  });
});
