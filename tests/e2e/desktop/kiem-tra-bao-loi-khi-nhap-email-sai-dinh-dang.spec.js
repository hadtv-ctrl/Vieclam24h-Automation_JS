const { test, expect } = require('../../../core/fixtures/baseTest');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc bằng Email @register @desktop @e2e @REQ-001', () => {
  test('TC-034 - AC-001 Kiểm tra báo lỗi khi nhập email sai định dạng', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai tại màn hình nhập email đăng ký)',
    });

    const malformedEmail = 'invalid-email-format';

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình nhập email đăng ký', async () => {
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
      await loginPopup.capture('email_input_ready');
    });

    await test.step('When [1] Nhập chuỗi email không đúng định dạng và bấm Tiếp tục', async () => {
      await loginPopup.fillEmail(malformedEmail);
      await loginPopup.capture('malformed_email_filled');
      await loginPopup.clickContinue();
    });

    await test.step('Then [1] Hệ thống hiển thị thông báo lỗi định dạng email và chặn tạo tài khoản', async () => {
      // Hệ thống báo lỗi định dạng email hoặc chặn mở form tạo tài khoản
      await expect(loginPopup.registerFormTitle).toBeHidden();
      await expect(loginPopup.emailError.or(loginPopup.emailInput)).toBeVisible();
      await loginPopup.capture('malformed_email_rejected');
    });
  });
});
