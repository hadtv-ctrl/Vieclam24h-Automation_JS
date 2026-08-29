const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../../core/utils/commonUtils');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Email @register @smoke @e2e', () => {
  test('Kiểm tra luồng đăng ký bằng Email', async ({ loginPopup, homePage }) => {
    test.setTimeout(120000);
    const randomEmail = generateRandomEmail();

    await test.step('Given Tôi truy cập vào trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('And Tôi tắt tất cả các popup quảng cáo nếu có', async () => {
      try {
        await homePage.closeAdsIfVisible();
      } catch (e) {
        await homePage.capture('no_popup_found');
      }
    });

    await test.step('When Tôi bấm vào nút "Đăng ký/Đăng nhập" trên Header', async () => {
      await loginPopup.capture('before_click_login_header');
      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.capture('after_login_modal_opened');
    });

    await test.step('And Tôi bấm nút Đăng ký bằng Email', async () => {
      try {
        await loginPopup.clickEmailLoginOption();
      } catch (e) {
        // Bỏ qua nếu UI hiển thị sẵn form nhập email
      }
    });

    await test.step('And Tôi nhập email mới chưa tồn tại và bấm Tiếp tục', async () => {
      await loginPopup.capture('before_fill_email');
      await loginPopup.fillEmail(randomEmail);
      await loginPopup.capture('after_fill_email');
      await loginPopup.clickContinue();
    });

    await test.step('Then Tôi phải thấy form "Tạo tài khoản mới" xuất hiện', async () => {
      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.capture('after_register_form_opened');
    });

    await test.step('And Tôi điền đầy đủ thông tin (Họ tên, SĐT, Mật khẩu)', async () => {
      const user = userData[0];
      await loginPopup.fillName(user.fullName || 'Automation Tester');

      const randomPhone = generateRandomVNPhone();
      if (await loginPopup.registerPhoneInput.isVisible()) {
        await loginPopup.fillRegisterPhone(randomPhone);
      }

      await loginPopup.fillPassword(user.password || 'Test@1234');
      await loginPopup.capture('after_fill_register_details');
    });

    await test.step('And Tôi bấm nút Đăng ký để hoàn tất', async () => {
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
      await loginPopup.capture('after_register_successfully');
    });
  });
});
