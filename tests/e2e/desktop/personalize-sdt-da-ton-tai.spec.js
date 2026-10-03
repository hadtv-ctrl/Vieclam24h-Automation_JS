const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @desktop @e2e @REQ-008', () => {
  test('TC-096 - AC-023 Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu', async ({ page, workerUserData }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_phone_exists_password');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page và nhập số điện thoại đã tồn tại trong hệ thống',
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

    await test.step('When [1] Nhập số điện thoại đã tồn tại và bấm Tiếp tục', async () => {
      // Nhập số điện thoại đã tồn tại và bấm Tiếp tục (chụp ảnh SĐT đã điền trước khi submit)
      await personalizePage.fillPhoneAndContinue(existingPhone);
    });

    await test.step('Then [1] Hệ thống phản hồi đúng theo quyết định đã chốt: xác thực tài khoản đã tồn tại mà không yêu cầu nhập lại Họ tên', async () => {
      // Hệ thống hiển thị trường mật khẩu hoặc xác thực tài khoản đã đăng ký
      const authIndicator = personalizePage.loginPasswordInput
        .or(personalizePage.otpInputIndicator)
        .first();

      await expect(authIndicator).toBeVisible({ timeout: 15000 });
      // Tài khoản đã tồn tại tuyệt đối KHÔNG hiển thị form nhập Họ và tên (vốn dành cho tài khoản mới)
      await expect(personalizePage.nhapHoVaTenInput).toBeHidden();

      // Khẳng định vẫn đang ở đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_auth_screen_displayed_for_existing_user');
    });
  });
});
