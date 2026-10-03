const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @deeplink @desktop @e2e @REQ-008', () => {
  test('TC-104 - AC-023: Khách vãng lai truy cập deep link Personalized Page bắt buộc đăng nhập', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const personalizePage = new PersonalizePage(page, 'personalize_deeplink_auth');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai chưa đăng nhập truy cập trực tiếp đường dẫn URL trang Việc làm dành riêng cho bạn',
    });

    await test.step('Given Tiền điều kiện: Khách vãng lai truy cập trực tiếp deep link Personalized Page', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      await personalizePage.capture('personalized_page_loaded');
    });

    await test.step('When Khách vãng lai xem giao diện trang khi chưa đăng nhập', async () => {
      // Xác nhận URL đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('personalized_page_url_verified');
    });

    await test.step('Then Hệ thống bắt buộc đăng nhập: hiển thị form xác thực và không hiển thị danh sách việc làm', async () => {
      // Tiêu đề cá nhân hóa hiển thị
      await expect(personalizePage.personalizedHeading).toBeVisible({ timeout: 15000 });

      // Form bắt buộc đăng nhập hoặc đăng ký hiển thị rõ ràng
      await expect(personalizePage.loginOrRegisterHeading).toBeVisible({ timeout: 10000 });
      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 10000 });
      await expect(personalizePage.tiepTucBtn).toBeVisible({ timeout: 10000 });

      // Không hiển thị danh sách việc làm gợi ý
      expect(await personalizePage.getJobCardsCount()).toBe(0);

      await personalizePage.capture('guest_required_login_screen_verified');
    });
  });
});
