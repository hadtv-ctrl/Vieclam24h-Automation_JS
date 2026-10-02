const { test, expect } = require('../../../core/fixtures/baseTest');
const { UserProfilePage } = require('../../../pages/desktop/UserProfilePage');

test.describe('Feature: Quản lý hồ sơ cá nhân - Chu trình xác minh bảo mật OTP khi bật tìm kiếm hồ sơ @auth @profile @desktop @e2e @REQ-005', () => {
  let userProfilePage;

  test('TC-047 - AC-017: Kiểm thử chu trình xác minh bảo mật (OTP Email / SĐT) khi kích hoạt tính năng Cho phép tìm kiếm hồ sơ', async ({
    page,
  }, testInfo) => {
    userProfilePage = new UserProfilePage(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Hồ sơ người dùng đã đạt trạng thái hoàn thiện',
    });

    await test.step('Given Tiền điều kiện: Hồ sơ người dùng đã đạt trạng thái hoàn thiện', async () => {
      await userProfilePage.setupSearchVerificationPrecondition();
      await expect(userProfilePage.profileStatusBadge).toHaveText('Hoàn thiện', { timeout: 15000 });
      await expect(userProfilePage.toggleAllowSearch).toBeVisible();
      await expect(userProfilePage.toggleAllowSearch).not.toBeChecked();
      await userProfilePage.capture('precondition_profile_completed_search_off');
    });

    await test.step('When [1] Dùng tài khoản chưa xác thực Email, bật công tắc \'Cho phép tìm kiếm hồ sơ\'', async () => {
      await userProfilePage.toggleAllowSearchSwitch();
      await userProfilePage.capture('toggle_search_clicked_unverified_email');
    });

    await test.step('Then [1] Hệ thống yêu cầu OTP gửi qua Email', async () => {
      await expect(userProfilePage.otpModal).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.otpModalTitle).toContainText('Email');
      await expect(userProfilePage.otpModalNotice).toContainText('Email');
      await userProfilePage.capture('email_otp_modal_displayed');
    });

    await test.step('When [2] Thử nhập mã OTP \'1111\'', async () => {
      await userProfilePage.fillOtpVerificationCode('1111');
      await userProfilePage.confirmOtpVerification();
      await userProfilePage.capture('email_otp_1111_submitted');
    });

    await test.step('Then [2] Hệ thống báo lỗi OTP không chính xác (vì Email dùng mã động, không nhận 1111)', async () => {
      await expect(userProfilePage.otpErrorMessage).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.otpErrorMessage).toContainText('không chính xác');
      await expect(userProfilePage.toggleAllowSearch).not.toBeChecked();
      await userProfilePage.capture('email_otp_error_verified');
    });

    await test.step('When [3] Nhập mã OTP chính xác từ Email', async () => {
      await userProfilePage.fillOtpVerificationCode('888888');
      await userProfilePage.confirmOtpVerification();
      await userProfilePage.capture('valid_email_otp_submitted');
    });

    await test.step('Then [3] Xác minh thành công, công tắc Cho phép tìm kiếm hồ sơ chuyển sang Bật', async () => {
      await expect(userProfilePage.otpModal).toBeHidden({ timeout: 5000 });
      await expect(userProfilePage.toggleAllowSearch).toBeChecked();
      await expect(userProfilePage.searchStatusActive).toBeVisible();
      await userProfilePage.capture('search_enabled_after_email_otp');
    });

    await test.step('When [4] Dùng tài khoản chưa xác thực SĐT, bật tìm kiếm hồ sơ và nhập OTP test \'1111\'', async () => {
      await userProfilePage.switchToUnverifiedPhoneAccount();
      await userProfilePage.toggleAllowSearchSwitch();
      await expect(userProfilePage.otpModal).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.otpModalTitle).toContainText('Số điện thoại');
      await userProfilePage.fillOtpVerificationCode('1111');
      await userProfilePage.confirmOtpVerification();
      await userProfilePage.capture('phone_otp_1111_submitted');
    });

    await test.step('Then [4] Hệ thống chấp nhận mã 1111, kích hoạt tìm kiếm hồ sơ thành công', async () => {
      await expect(userProfilePage.otpModal).toBeHidden({ timeout: 5000 });
      await expect(userProfilePage.toggleAllowSearch).toBeChecked();
      await expect(userProfilePage.searchStatusActive).toBeVisible();
      await userProfilePage.capture('search_enabled_after_phone_otp');
    });
  });
});
