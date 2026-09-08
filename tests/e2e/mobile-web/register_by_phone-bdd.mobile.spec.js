const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Đăng ký tài khoản người tìm việc bằng Số điện thoại trên Mobile Web @register @smoke @smoke-mobile @mobile @e2e', () => {
  test('Kiểm tra luồng đăng ký bằng Số điện thoại trên mobile', async ({ loginPopup, homePage, popupConsent }, testInfo) => {
    test.setTimeout(120000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai mobile đăng ký SĐT)',
    });

    const randomEmail = generateRandomEmail();
    let randomPhone;

    await test.step('Given Tiền điều kiện: Người dùng mobile chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('after_mobile_homepage_loaded');
    });

    await test.step('And Tôi tắt tất cả các popup quảng cáo nếu có trên mobile', async () => {
      try {
        await homePage.closeAdsIfVisible();
        await homePage.capture('after_mobile_close_popup');
      } catch (e) {
        await homePage.capture('no_mobile_popup_found');
      }
    });

    await test.step('When Tôi bấm vào nút "Đăng ký/Đăng nhập" trên Header mobile', async () => {
      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.capture('after_mobile_login_modal_opened');
    });

    await test.step('And Tôi nhập số điện thoại mới chưa tồn tại và bấm Tiếp tục', async () => {
      randomPhone = generateRandomVNPhone();
      await loginPopup.fillPhone(randomPhone);
      await loginPopup.capture('after_mobile_fill_phone');
      await loginPopup.clickContinueUntilOtpVisible({ maxAttempts: 3 });
    });

    await test.step('And Tôi nhập mã OTP (nếu có)', async () => {
      await loginPopup.waitForOtpVisible();
      await loginPopup.capture('before_mobile_fill_otp');
      const testOtpCode = '1111';
      await loginPopup.fillOtpCode(testOtpCode);
    });

    await test.step('Then Tôi phải thấy form "Tạo tài khoản mới" xuất hiện trên mobile', async () => {
      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.capture('after_mobile_register_form_opened');
    });

    await test.step('And Tôi điền đầy đủ thông tin (Họ tên, SĐT, Mật khẩu) trên mobile', async () => {
      const user = userData[0];
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.fillRegisterEmail(randomEmail);
      if (await loginPopup.passwordInput.isVisible()) {
        await loginPopup.fillPassword(user.password || 'Test@1234');
      }
      await loginPopup.capture('after_mobile_fill_register_details');
    });

    await test.step('And Tôi bấm nút Đăng ký để hoàn tất trên mobile', async () => {
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
      await popupConsent.waitForConsentOrHomepageReady(homePage);
    });

    await test.step('And Tôi đồng ý với Consent trên mobile', async () => {
      await popupConsent.agreeIfVisible();
      await homePage.expectHomepageContentLoaded();
      await popupConsent.capture('after_mobile_agree_consent_successfully', true);
    });
  });
});
