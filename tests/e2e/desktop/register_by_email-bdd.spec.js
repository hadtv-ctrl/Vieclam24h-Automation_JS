const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Email @register @smoke @smoke-desktop @desktop @e2e', () => {
  test('Kiểm tra luồng đăng ký bằng Email', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai đăng ký)',
    });

    const randomEmail = generateRandomEmail();

    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('And Tôi tắt tất cả các popup quảng cáo nếu có', async () => {
      try {
        await homePage.closeAdsIfVisible();
        await homePage.closeBlockingModalIfVisible();
      } catch (e) {
        await homePage.capture('no_popup_found');
      }
    });

    await test.step('When Tôi bấm vào nút "Đăng ký/Đăng nhập" trên Header', async () => {
      await homePage.closeBlockingModalIfVisible();
      await loginPopup.capture('before_click_login_header');

      // Retry: thử click tối đa 3 lần nếu modal chưa mở
      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        await loginPopup.clickLoginHeader();
        try {
          await loginPopup.waitForModalVisible(10000);
          opened = true;
        } catch {
          if (attempt < 3) {
            // Đóng thêm overlay nếu có rồi thử lại
            await homePage.closeAdsIfVisible().catch(() => null);
            await homePage.closeBlockingModalIfVisible().catch(() => null);
          }
        }
      }
      if (!opened) {
        await loginPopup.capture('login_modal_failed_to_open');
        throw new Error('Login modal không mở được sau 3 lần thử');
      }
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
