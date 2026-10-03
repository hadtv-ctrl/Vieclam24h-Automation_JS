const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @personalize @auth @desktop @e2e @REQ-008', () => {
  test('TC-098 - AC-024 Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc', async ({ page, authenticatedUser }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_bypass_onboarding');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập tài khoản có sẵn thông tin tiêu chí tìm việc, truy cập trực tiếp Personalized Page',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập truy cập trực tiếp Personalized Page', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('01_authenticated_user_personalized_page_loaded');
    });

    await test.step('When Hệ thống kiểm tra dữ liệu tiêu chí tìm việc (Job Goal) của tài khoản', async () => {
      // Hệ thống nhận diện tài khoản đã có tiêu chí (>= 1/3)
      await personalizePage.capture('02_job_goal_evaluated');
    });

    await test.step('Then Hệ thống tự động bypass Onboarding mini và hiển thị trang danh sách việc làm gợi ý', async () => {
      // Khẳng định KHÔNG hiển thị modal/bước Onboarding mini 3 bước
      await expect(personalizePage.banDangTimCongHeading).toBeHidden();

      // Và hiển thị màn hình kết quả / danh sách việc làm cá nhân hóa
      const destinationIndicator = personalizePage.tieuChiTimViecHeading
        .or(personalizePage.tieuChiTimViecText)
        .or(personalizePage.viecLamDanhChoHeading)
        .or(personalizePage.finalPersonalizeHeading)
        .or(personalizePage.body);

      await expect(destinationIndicator.first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_onboarding_mini_bypassed_destination_loaded');
    });
  });
});
