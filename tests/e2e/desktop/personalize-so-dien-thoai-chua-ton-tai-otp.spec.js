const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-100 - AC-023 Số điện thoại chưa tồn tại chuyển hướng sang luồng xác thực OTP', async ({ page }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_phone_not_exist_otp');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page và đang ở màn hình nhập số điện thoại',
    });

    // Tạo số điện thoại hợp lệ chưa từng đăng ký trên hệ thống
    const unregisteredPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng truy cập trực tiếp Personalized Page và hiển thị form đăng nhập / đăng ký', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_personalized_page_auth_screen_displayed');
    });

    await test.step('When [1] Nhập số điện thoại chưa đăng ký và bấm Tiếp tục', async () => {
      // Nhập số điện thoại chưa tồn tại và nhấn Tiếp tục (chụp ảnh đã điền SĐT trước khi submit)
      await personalizePage.fillPhoneAndContinue(unregisteredPhone);
    });

    await test.step('Then [1] Hệ thống không hiển thị màn hình mật khẩu mà chuyển hướng sang màn hình nhập mã OTP để tạo tài khoản mới', async () => {
      // Xác nhận hệ thống chuyển sang màn hình nhập mã OTP
      await expect(personalizePage.otpInputIndicator).toBeVisible({ timeout: 15000 });

      // Khẳng định KHÔNG hiển thị trường nhập mật khẩu (luồng tài khoản đã tồn tại)
      await expect(personalizePage.loginPasswordInput).toBeHidden();

      // Khẳng định vẫn đang ở đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_otp_verification_screen_displayed');
    });
  });
});
