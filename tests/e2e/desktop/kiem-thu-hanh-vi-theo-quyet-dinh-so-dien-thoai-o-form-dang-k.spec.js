const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomEmail } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Quy tắc nghiệp vụ trường định danh đăng ký @register @desktop @e2e @REQ-001', () => {
  test('TC-030 - AC-001 Kiểm thử hành vi theo quyết định: Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Môi trường sẵn sàng cho kịch bản (Khách vãng lai kiểm tra quy tắc đăng ký)',
    });

    const randomEmail = generateRandomEmail();
    const user = userData[0];

    await test.step('Given Tiền điều kiện: Môi trường sẵn sàng cho kịch bản', async () => {
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
      await loginPopup.capture('register_screen_opened');
    });

    await test.step('When [1] Thực hiện thao tác với điều kiện: khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắ', async () => {
      // 1. Điền các trường bắt buộc trên form đăng ký email
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.fillPassword(user.password || 'Test@1234');

      // 2. Để trống trường số điện thoại
      await loginPopup.clearRegisterPhone();
      await loginPopup.capture('email_register_form_without_phone');

      // 3. Bấm xác nhận gửi form
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
    });

    await test.step('Then [1] Hệ thống phản hồi đúng theo quyết định đã chốt', async () => {
      // Xác nhận hệ thống không báo lỗi bắt buộc số điện thoại khi đăng ký bằng email
      await expect(loginPopup.phoneError).toBeHidden();
      await loginPopup.capture('decision_verified_phone_optional');
    });
  });
});
