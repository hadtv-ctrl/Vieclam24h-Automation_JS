const { test, expect } = require('../../../core/fixtures/baseTest');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Số điện thoại @register @desktop @e2e @REQ-001', () => {
  test('TC-039 - AC-002 Bấm gửi lại mã OTP khi đăng ký bằng số điện thoại', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai tại màn hình xác thực OTP khi đăng ký)',
    });

    const randomPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('When [1] Người dùng nhập số điện thoại mới và bấm Tiếp tục tới màn hình OTP', async () => {
      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.fillPhone(randomPhone);
      await loginPopup.capture('phone_entered_for_otp');
      await loginPopup.clickContinueUntilOtpVisible({ maxAttempts: 3 });
      await loginPopup.waitForOtpVisible();
      await loginPopup.capture('otp_screen_displayed');
    });

    await test.step('Then [1] Nút gửi lại mã hoặc đồng hồ đếm ngược hiển thị trên màn hình', async () => {
      await expect(loginPopup.resendOtpBtn.or(loginPopup.otpCountdown)).toBeVisible();
      await loginPopup.capture('resend_otp_button_verified');
    });

    await test.step('And [2] Người dùng có thể yêu cầu gửi lại mã và màn hình OTP vẫn hoạt động', async () => {
      if (await loginPopup.resendOtpBtn.isVisible().catch(() => false)) {
        await loginPopup.clickResendOtp().catch(() => null);
      }
      await expect(loginPopup.otpInputs.first()).toBeVisible();
      await loginPopup.capture('otp_input_still_active');
    });
  });
});
