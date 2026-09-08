const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Đăng ký tài khoản người tìm việc bằng Email trên Mobile Web @register @smoke @smoke-mobile @mobile @e2e', () => {
  test('Kiểm tra luồng đăng ký bằng Email trên mobile', async ({ loginPopup, homePage }, testInfo) => {
    test.setTimeout(120000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai mobile đăng ký email)',
    });

    const randomEmail = generateRandomEmail();

    await test.step('Given Tiền điều kiện: Người dùng mobile chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('after_mobile_homepage_loaded');
    });

    await test.step('And Tôi tắt tất cả các popup quảng cáo nếu có trên mobile', async () => {
      try {
        await homePage.closeAdsIfVisible();
      } catch (e) {
        await homePage.capture('no_mobile_popup_found');
      }
    });

    await test.step('When Tôi bấm vào nút "Đăng ký/Đăng nhập" trên Header mobile', async () => {
      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await loginPopup.capture('after_mobile_login_modal_opened');
    });

    await test.step('And Tôi bấm nút Đăng ký bằng Email trên mobile', async () => {
      try {
        await loginPopup.clickEmailLoginOption();
      } catch (e) {
        // Form có thể hiển thị sẵn input email
      }
    });

    await test.step('And Tôi nhập email mới chưa tồn tại và bấm Tiếp tục', async () => {
      await loginPopup.fillEmail(randomEmail);
      await loginPopup.capture('after_mobile_fill_email');
      await loginPopup.clickContinue();
    });

    await test.step('Then Tôi phải thấy form "Tạo tài khoản mới" xuất hiện trên mobile', async () => {
      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.capture('after_mobile_register_form_opened');
    });

    await test.step('And Tôi điền đầy đủ thông tin (Họ tên, SĐT, Mật khẩu) trên mobile', async () => {
      const user = userData[0];
      await loginPopup.fillName(user.fullName || 'Automation Tester');

      const randomPhone = generateRandomVNPhone();
      if (await loginPopup.registerPhoneInput.isVisible()) {
        await loginPopup.fillRegisterPhone(randomPhone);
      }

      await loginPopup.fillPassword(user.password || 'Test@1234');
      await loginPopup.capture('after_mobile_fill_register_details');
    });

    await test.step('And Tôi bấm nút Đăng ký để hoàn tất trên mobile', async () => {
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
      await loginPopup.capture('after_mobile_register_successfully', true);
    });
  });
});
