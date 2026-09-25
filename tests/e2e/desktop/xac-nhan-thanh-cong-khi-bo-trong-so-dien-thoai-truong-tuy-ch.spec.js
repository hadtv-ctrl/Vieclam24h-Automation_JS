const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomEmail } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Đăng ký tài khoản người tìm việc @register @desktop @e2e @REQ-001', () => {
  test('TC-026 - AC-001 Xác nhận thành công khi bỏ trống số điện thoại (trường tùy chọn theo quyết định)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Người dùng đang ở màn hình đăng ký / nhập liệu)',
    });

    const randomEmail = generateRandomEmail();
    const user = userData[0];

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình đăng ký / nhập liệu', async () => {
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
      await loginPopup.capture('register_form_displayed');
    });

    await test.step('When [1] Nhập đầy đủ các trường thông tin bắt buộc khác', async () => {
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.fillPassword(user.password || 'Test@1234');
      await loginPopup.capture('mandatory_fields_filled');
    });

    await test.step('Then [1] Các trường bắt buộc hợp lệ', async () => {
      await expect(loginPopup.nameInput).toHaveValue(user.fullName || 'Automation Tester');
      await expect(loginPopup.passwordInput).toHaveValue(user.password || 'Test@1234');
      await expect(loginPopup.passwordError).toBeHidden();
      await loginPopup.capture('mandatory_fields_valid');
    });

    await test.step('When [2] Để trống trường số điện thoại và bấm gửi form', async () => {
      await loginPopup.clearRegisterPhone();
      await loginPopup.capture('phone_field_kept_empty');
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
    });

    await test.step('Then [2] Hệ thống xử lý thành công, không báo lỗi thiếu số điện thoại', async () => {
      await expect(loginPopup.phoneError).toBeHidden();
      await loginPopup.capture('after_submit_without_phone');
    });
  });
});
