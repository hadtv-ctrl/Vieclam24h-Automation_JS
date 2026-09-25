const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomEmail } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Kiểm tra điều kiện mật khẩu khi đăng ký @register @desktop @e2e @REQ-001', () => {
  test('TC-027 - AC-001 Kiểm tra thất bại khi mật khẩu có 7 ký tự (dưới biên tối thiểu 8)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Người dùng đang ở màn hình nhập liệu)',
    });

    const randomEmail = generateRandomEmail();
    const user = userData[0];
    const password7Chars = 'Pass123'; // 7 ký tự (dưới biên 8)

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
      await loginPopup.capture('register_form_ready');
    });

    await test.step('When [1] Nhập các trường thông tin hợp lệ khác', async () => {
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.capture('valid_name_filled');
    });

    await test.step('Then [1] Không có lỗi trên các trường hợp lệ', async () => {
      await expect(loginPopup.nameInput).toHaveValue(user.fullName || 'Automation Tester');
      await loginPopup.capture('valid_name_verified');
    });

    await test.step('When [2] Nhập mật khẩu có đúng 7 ký tự', async () => {
      await loginPopup.fillPassword(password7Chars);
      await loginPopup.capture('password_7_chars_entered');
    });

    await test.step('Then [2] Hệ thống hiển thị thông báo lỗi yêu cầu tối thiểu 8 ký tự', async () => {
      await expect(loginPopup.passwordLengthError.or(loginPopup.passwordError)).toBeVisible();
      await loginPopup.capture('error_minimum_8_chars_shown');
    });

    await test.step('When [3] Thử bấm xác nhận / submit', async () => {
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
      await loginPopup.capture('after_submit_attempt');
    });

    await test.step('Then [3] Hệ thống chặn gửi form thành công', async () => {
      await expect(loginPopup.registerFormTitle).toBeVisible();
      await loginPopup.capture('form_submission_blocked');
    });
  });
});
