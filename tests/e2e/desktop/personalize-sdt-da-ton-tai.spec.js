const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-096 - AC-023 Số điện thoại đã tồn tại ở luồng việc làm riêng: sau khi nhập OTP không hiển thị popup thêm thông tin Họ tên / Email', async ({ page, workerUserData }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_phone_exists_password');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, nhập số điện thoại đã tồn tại trong hệ thống, nhập OTP và kiểm tra không hiển thị popup thêm thông tin Họ tên / Email',
    });

    // Lấy số điện thoại của tài khoản đã tồn tại trong hệ thống từ fixture cô lập workerUserData
    const existingPhone = workerUserData?.user?.phone || '0988888888';

    await test.step('Given Tiền điều kiện: Người dùng truy cập trực tiếp Personalized Page và ở form đăng nhập / đăng ký', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_personalized_page_auth_screen_displayed');
    });

    await test.step('When [1] Nhập số điện thoại đã tồn tại trong hệ thống và bấm Tiếp tục', async () => {
      // Nhập số điện thoại đã tồn tại và bấm Tiếp tục (chụp ảnh SĐT đã điền trước khi submit)
      await personalizePage.fillPhoneAndContinue(existingPhone);
    });

    await test.step('And [2] Hệ thống gửi OTP và người dùng thực hiện nhập mã xác thực OTP', async () => {
      // Chờ màn hình nhập mã OTP hiển thị
      await expect(personalizePage.otpInputIndicator).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('02_otp_screen_for_existing_user');

      // Nhập 4 chữ số OTP và chụp bằng chứng ngay khi nhập đủ 4 số
      await personalizePage.fillOtpDigits('1111', { captureStep: '03_otp_digits_filled_for_existing_user' });
    });

    await test.step('Then [3] Hệ thống nhận diện số điện thoại đã tồn tại: KHÔNG hiển thị popup thêm thông tin Họ tên / Email mà chuyển thẳng vào hệ thống', async () => {
      // Xác nhận sau khi nhập OTP, hệ thống KHÔNG hiển thị popup yêu cầu nhập Họ tên / Email (chỉ dành cho tài khoản chưa tồn tại)
      await expect(personalizePage.nhapHoVaTenInput).toBeHidden({ timeout: 15000 });
      await expect(personalizePage.emailInput).toBeHidden();

      // Khẳng định vẫn đang ở đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_existing_user_logged_in_without_name_popup');
    });
  });
});
