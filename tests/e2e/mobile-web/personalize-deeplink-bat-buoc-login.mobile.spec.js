const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @guest @no-auth @personalize @deeplink @mobile @e2e @REQ-008', () => {
  test('TC-104 - AC-023: Khách vãng lai truy cập deep link Personalized Page bắt buộc đăng nhập trên mobile web', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_deeplink_auth');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai chưa đăng nhập truy cập trực tiếp URL trang Việc làm dành riêng cho bạn trên Mobile Web',
    });

    await test.step('Given Tiền điều kiện: Khách vãng lai truy cập trực tiếp deep link Personalized Page trên Mobile Web', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.capture('01_mobile_personalized_page_loaded');
    });

    await test.step('When Khách vãng lai xem giao diện trang khi chưa đăng nhập trên mobile', async () => {
      // Xác nhận URL đúng trang Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_mobile_personalized_page_url_verified');
    });

    await test.step('Then Hệ thống bắt buộc đăng nhập trên mobile: hiển thị form xác thực và không hiển thị danh sách việc làm', async () => {
      // Tiêu đề cá nhân hóa hiển thị
      await expect(personalizePage.personalizedHeading).toBeVisible({ timeout: 15000 });

      // Form bắt buộc đăng nhập hoặc đăng ký hiển thị rõ ràng
      await expect(personalizePage.loginOrRegisterHeading).toBeVisible({ timeout: 10000 });
      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 10000 });
      await expect(personalizePage.tiepTucBtn).toBeVisible({ timeout: 10000 });

      // Không hiển thị danh sách việc làm gợi ý
      expect(await personalizePage.getJobCardsCount()).toBe(0);

      await personalizePage.capture('03_mobile_guest_required_login_screen_verified');
    });
  });
});
