const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @mobile @e2e @REQ-008', () => {
  test('TC-096 - AC-023 Số điện thoại đã tồn tại ở luồng việc làm riêng: sau khi nhập OTP không hiển thị popup thêm thông tin Họ tên / Email trên mobile web', async ({ page, workerUserData }, testInfo) => {
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_phone_exists_password');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page trên Mobile Web, nhập số điện thoại đã tồn tại trong hệ thống, nhập OTP và kiểm tra không hiển thị popup thêm thông tin Họ tên / Email',
    });

    // Lấy số điện thoại của tài khoản đã tồn tại trong hệ thống từ fixture cô lập workerUserData
    const existingPhone = workerUserData?.user?.phone || '0988888888';

    await test.step('Given Tiền điều kiện: Người dùng truy cập trực tiếp Personalized Page và ở form đăng nhập / đăng ký trên mobile', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_mobile_personalized_page_auth_screen_displayed');
    });

    await test.step('When [1] Nhập số điện thoại đã tồn tại trong hệ thống và bấm Tiếp tục', async () => {
      await personalizePage.fillPhoneAndContinue(existingPhone);
    });

    await test.step('And [2] Hệ thống gửi OTP và người dùng thực hiện nhập mã xác thực OTP', async () => {
      await expect(personalizePage.otpInputIndicator).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('02_mobile_otp_screen_for_existing_user');

      await personalizePage.fillOtpDigits('1111', { captureStep: '03_mobile_otp_digits_filled_for_existing_user' });
    });

    await test.step('Then [3] Hệ thống nhận diện số điện thoại đã tồn tại: KHÔNG hiển thị popup thêm thông tin Họ tên / Email mà chuyển thẳng vào hệ thống', async () => {
      await expect(personalizePage.nhapHoVaTenInput).toBeHidden({ timeout: 15000 });
      await expect(personalizePage.emailInput).toBeHidden();

      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_mobile_existing_user_logged_in_without_name_popup');
    });
  });
});
