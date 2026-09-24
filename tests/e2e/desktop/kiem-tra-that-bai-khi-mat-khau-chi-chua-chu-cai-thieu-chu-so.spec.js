const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomEmail } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Kiểm tra điều kiện mật khẩu khi đăng ký @register @desktop @e2e @REQ-001', () => {
  test('TC-028 - AC-001 Kiểm tra thất bại khi mật khẩu chỉ chứa chữ cái (thiếu chữ số)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Người dùng đang ở màn hình nhập liệu)',
    });

    const randomEmail = generateRandomEmail();
    const user = userData[0];
    const passwordLettersOnly = 'Abcdefgh'; // 8 ký tự nhưng chỉ toàn chữ cái, thiếu chữ số

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình nhập liệu', async () => {
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
      await loginPopup.fillEmail(randomEmail);
      await loginPopup.clickContinue();
      await loginPopup.waitForRegisterFormVisible();
      await expect(loginPopup.registerFormTitle).toBeVisible();

      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.capture('register_screen_ready');
    });

    await test.step('When [1] Nhập mật khẩu chỉ gồm chữ cái hợp lệ nhưng không có số', async () => {
      await loginPopup.fillPassword(passwordLettersOnly);
      await loginPopup.capture('password_letters_only_entered');
      // Trigger validation bằng cách blur hoặc bấm submit
      await loginPopup.clickSubmit().catch(() => null);
    });

    await test.step('Then [1] Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ số', async () => {
      await expect(loginPopup.passwordDigitError.or(loginPopup.passwordError)).toBeVisible();
      await loginPopup.capture('error_missing_digit_shown');
    });
  });
});
