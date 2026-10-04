const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-100 - AC-023 Số điện thoại chưa tồn tại chuyển hướng sang luồng xác thực OTP và hiển thị popup thêm thông tin Họ tên / Email', async ({ page }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_phone_not_exist_otp');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, nhập số điện thoại chưa tồn tại, xác thực OTP và kiểm tra hiển thị popup bổ sung thông tin Họ tên / Email',
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

    await test.step('And [2] Hệ thống gửi OTP và người dùng thực hiện nhập mã xác thực OTP', async () => {
      // Chờ màn hình nhập mã OTP hiển thị
      await expect(personalizePage.otpInputIndicator).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('02_otp_screen_displayed');

      // Nhập 4 chữ số OTP và chụp bằng chứng ngay khi nhập đủ 4 số
      await personalizePage.fillOtpDigits('1111', { captureStep: '03_otp_digits_filled' });
    });

    await test.step('Then [3] Hệ thống nhận diện số điện thoại chưa tồn tại: hiển thị popup thêm thông tin Họ tên và Email để tạo tài khoản mới', async () => {
      // Xác nhận sau khi nhập OTP xong, hệ thống hiển thị form/popup Tạo tài khoản mới với trường Họ và tên và Email
      await expect(personalizePage.nhapHoVaTenInput).toBeVisible({ timeout: 15000 });
      await expect(personalizePage.emailInput).toBeVisible({ timeout: 15000 });

      // Khẳng định vẫn đang ở đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_new_user_info_popup_displayed');
    });
  });
});
