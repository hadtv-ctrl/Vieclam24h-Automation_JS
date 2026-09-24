const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc @register @desktop @e2e @REQ-001', () => {
  test('TC-032 - AC-001 Kiểm tra xử lý khi đăng ký bằng email đã tồn tại', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai tại màn hình nhập email đăng ký)',
    });

    // Sử dụng email tài khoản đã tồn tại trong hệ thống
    const existingUser = userData[0];
    const existingEmail = existingUser.email || 'candidate_test@example.com';

    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và mở popup Đăng ký', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('after_homepage_loaded');

      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      try {
        await loginPopup.clickEmailLoginOption();
      } catch {
        // Bỏ qua nếu form email hiển thị sẵn
      }
      await expect(loginPopup.emailInput).toBeVisible();
      await loginPopup.capture('email_input_screen_opened');
    });

    await test.step('When [1] Nhập email đã tồn tại trong hệ thống và bấm Tiếp tục', async () => {
      await loginPopup.fillEmail(existingEmail);
      await loginPopup.capture('existing_email_entered');
      await loginPopup.clickContinue();
    });

    await test.step('Then [1] Hệ thống nhận diện email đã tồn tại và không mở form tạo tài khoản mới', async () => {
      // Hệ thống nhận diện email đã tồn tại: không hiển thị form "Tạo tài khoản mới"
      // Mà chuyển sang màn hình đăng nhập (nhập mật khẩu hoặc OTP) hoặc hiển thị thông báo
      await expect(loginPopup.registerFormTitle).toBeHidden();
      await expect(loginPopup.loginPasswordInput.or(loginPopup.otpModalTitle).or(loginPopup.modalTitle)).toBeVisible();
      await loginPopup.capture('existing_email_handled_successfully');
    });
  });
});
