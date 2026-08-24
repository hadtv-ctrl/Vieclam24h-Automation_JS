const { test, expect } = require('../../core/fixtures/baseTest');
const userData = require('../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../core/utils/commonUtils');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Số điện thoại @register @e2e', () => {
  test('Kiểm tra luồng đăng ký bằng Số điện thoại', async ({ loginPopup, homePage, popupConsent }) => {
    test.setTimeout(120000);
    const randomEmail = generateRandomEmail();
    let randomPhone;

    await test.step('Given Tôi truy cập vào trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('And Tôi tắt tất cả các popup quảng cáo nếu có', async () => {
      try {
        await homePage.closeAdsIfVisible();
        await homePage.capture('after_close_popup');
      } catch (e) {
        await homePage.capture('no_popup_found');
      }
    });

    await test.step('When Tôi bấm vào nút "Đăng ký/Đăng nhập" trên Header', async () => {
      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.capture('after_login_modal_opened');
    });

    await test.step('And Tôi nhập số điện thoại mới chưa tồn tại và bấm Tiếp tục', async () => {
      randomPhone = generateRandomVNPhone();
      await loginPopup.fillPhone(randomPhone);
      await loginPopup.capture('after_fill_phone');
      await loginPopup.clickContinueUntilOtpVisible({ maxAttempts: 3 });
      // await loginPopup.capture('after_click_continue');
    });

    await test.step('And Tôi nhập mã OTP (nếu có)', async () => {
      await loginPopup.waitForOtpVisible();
      await loginPopup.capture('before_fill_otp');
      const testOtpCode = '1111';
      await loginPopup.fillOtpCode(testOtpCode);
      // await loginPopup.capture('after_fill_otp');
    });

    await test.step('Then Tôi phải thấy form "Tạo tài khoản mới" xuất hiện', async () => {
      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.capture('after_register_form_opened');
    });

    await test.step('And Tôi điền đầy đủ thông tin (Họ tên, SĐT, Mật khẩu)', async () => {
      const user = userData[0];
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.fillRegisterEmail(randomEmail);
      if (await loginPopup.passwordInput.isVisible()) {
        await loginPopup.fillPassword(user.password || 'Test@1234');
      }
      await loginPopup.capture('after_fill_register_details');
    });

    await test.step('And Tôi bấm nút Đăng ký để hoàn tất', async () => {
      await expect(loginPopup.submitBtn).toBeVisible();
      // await loginPopup.capture('before_submit_registration');
      await loginPopup.clickSubmit();
      await popupConsent.waitForConsentOrHomepageReady(homePage);
      // await loginPopup.capture('after_register_successfully');
    });

    await test.step('And Tôi đồng ý với Consent', async () => {
      await popupConsent.agreeIfVisible();
      await homePage.expectHomepageContentLoaded();
      await popupConsent.capture('after_Agree_Consent_successfully');
    });
  });
});
