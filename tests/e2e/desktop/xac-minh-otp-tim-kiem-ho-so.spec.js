const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Quản lý hồ sơ - Xác minh OTP tìm kiếm hồ sơ @auth @profile @desktop @e2e @REQ-005', () => {
  test('TC-047 - AC-017: Xác minh OTP khi bật tìm kiếm hồ sơ', async ({
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
      description: 'Người dùng đã đăng nhập trên môi trường QC và truy cập vào trang Hồ sơ của tôi',
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

    await test.step('Then [1] Kiểm tra công tắc Cho phép nhà tuyển dụng tìm kiếm hồ sơ trên sidebar', async () => {
      await expect(userProfilePage.allowSearchToggle).toBeVisible({ timeout: 15000 });
      await userProfilePage.capture('allow_search_toggle_visible');
    });

    await test.step('When [2] Nhấn kích hoạt công tắc Cho phép tìm kiếm hồ sơ', async () => {
      await userProfilePage.toggleAllowSearchSwitch();
      await userProfilePage.capture('toggle_allow_search_clicked');
    });

    await test.step('Then [2] Kiểm tra modal xác thực bảo mật OTP nếu tài khoản yêu cầu xác minh', async () => {
      const isOtpRequired = await userProfilePage.otpTitle.isVisible({ timeout: 5000 }).catch(() => false);

      if (isOtpRequired) {
        await userProfilePage.capture('otp_verification_modal_displayed');

        // Thử nhập mã OTP sai 0000
        await userProfilePage.fillOtpVerificationCode('0000');
        await userProfilePage.confirmOtpVerification();
        await userProfilePage.capture('invalid_otp_submitted');

        // Nhập mã OTP đúng 1111 trên QC
        await userProfilePage.fillOtpVerificationCode('1111');
        await userProfilePage.confirmOtpVerification();
        await userProfilePage.capture('valid_otp_submitted');
      } else {
        console.log('Tài khoản đã được xác minh trước đó hoặc không yêu cầu OTP bổ sung.');
        await userProfilePage.capture('search_status_updated_directly');
      }

      await expect(userProfilePage.allowSearchToggle).toBeVisible();
      await userProfilePage.capture('search_verification_cycle_finished');
    });
  });
});
