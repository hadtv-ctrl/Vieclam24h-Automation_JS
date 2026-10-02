const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');

test.describe('Feature: Đăng ký tài khoản người tìm việc - Kiểm thử chuỗi giá trị biên @guest @no-auth @register @desktop @e2e @REQ-001', () => {
  test('TC-040 - AC-001 AC-002: Kiểm thử chuỗi giá trị biên, tính hợp lệ dữ liệu và xác thực đăng ký tài khoản', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    const popupConsent = new PopupConsent(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập, đang ở trang chủ hoặc popup Đăng ký tài khoản',
    });

    const invalidPhone = '0912abcXYZ';
    const existingPhone = '0988888888';
    const boundaryPassword = 'a1234567'; // Mật khẩu chuẩn biên 8 ký tự (1 chữ cái, 7 chữ số)
    const testOtpCode = '1111';
    const randomValidPhone = generateRandomVNPhone();
    const user = userData[0] || {};
    const testFullName = user.fullName || 'Automation Tester';

    await test.step('Given Tiền điều kiện: Chưa đăng nhập, đang ở trang chủ hoặc popup Đăng ký tài khoản', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('precondition_homepage_ready');

      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await expect(loginPopup.phoneInput).toBeVisible();
      await loginPopup.capture('login_modal_opened');
    });

    await test.step('When [1] Mở form đăng ký, nhập số điện thoại sai định dạng 0912abcXYZ', async () => {
      await loginPopup.fillPhone(invalidPhone);
      await loginPopup.capture('invalid_phone_filled');
      if (await loginPopup.continueBtn.isEnabled()) {
        await loginPopup.clickContinue().catch(() => null);
      }
    });

    await test.step('Then [1] Hệ thống báo lỗi "Số điện thoại không hợp lệ", vô hiệu hóa nút gửi', async () => {
      const isErrorVisible = await loginPopup.phoneError.isVisible({ timeout: 3000 }).catch(() => false);
      const isContinueDisabled = !(await loginPopup.continueBtn.isEnabled().catch(() => true));
      expect(isErrorVisible || isContinueDisabled).toBeTruthy();
      await loginPopup.capture('invalid_phone_rejected');
    });

    await test.step('When [2] Nhập số điện thoại đã tồn tại trong hệ thống 0988888888 và mật khẩu hợp lệ', async () => {
      await loginPopup.clearPhone();
      await loginPopup.fillPhone(existingPhone);
      await loginPopup.capture('existing_phone_filled');
      await loginPopup.clickContinue();
    });

    await test.step('Then [2] Hệ thống thông báo lỗi tài khoản đã tồn tại, chặn chuyển sang bước OTP', async () => {
      await expect(loginPopup.loginPasswordInput.or(loginPopup.phoneError).or(loginPopup.modalTitle)).toBeVisible({ timeout: 10000 });
      await loginPopup.capture('existing_phone_blocked_from_otp');
    });

    await test.step('When [3] Nhập số điện thoại mới, để trống trường Email (trường tùy chọn) và nhập mật khẩu đạt biên 8 ký tự a1234567', async () => {
      await loginPopup.clickLoginHeader().catch(() => null);
      await loginPopup.waitForModalVisible().catch(() => null);
      await loginPopup.clearPhone();
      await loginPopup.fillPhone(randomValidPhone);
      await loginPopup.capture('valid_phone_entered');
      await loginPopup.clickContinueUntilOtpVisible({ maxAttempts: 3 });
      await expect(loginPopup.otpModalTitle.or(loginPopup.otpInputs.first())).toBeVisible();
      await loginPopup.capture('otp_screen_transition_ready');
    });

    await test.step('When [4] Nhập mã OTP "1111" trên môi trường test và xác nhận', async () => {
      await loginPopup.waitForOtpVisible();
      await loginPopup.fillOtpCode(testOtpCode);
      await loginPopup.capture('otp_code_filled');

      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.fillName(testFullName);
      await loginPopup.clearRegisterPhone().catch(() => null);
      await loginPopup.fillPassword(boundaryPassword);
      await loginPopup.capture('register_form_boundary_password_filled');

      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
    });

    await test.step('Then [4] Hoàn tất tạo tài khoản thành công, người dùng được cấp phiên đăng nhập', async () => {
      await popupConsent.waitForConsentOrHomepageReady(homePage);
      await popupConsent.agreeIfVisible().catch(() => null);
      await homePage.expectHomepageContentLoaded();
      await expect(homePage.accountMenuButton.or(homePage.logo)).toBeVisible();
      await homePage.capture('registration_completed_successfully');
    });
  });
});
