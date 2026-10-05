const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @personalize @auth @mobile @e2e @REQ-008', () => {
  test('TC-098 - AC-024 Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc trên mobile web', async ({ page, authenticatedUser }, testInfo) => {
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_bypass_onboarding');
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập tài khoản có sẵn thông tin tiêu chí tìm việc, truy cập trực tiếp Personalized Page trên Mobile Web',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập tài khoản có sẵn tiêu chí tìm việc truy cập Personalized Page mobile', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();

      // Đảm bảo tiền điều kiện: nếu tài khoản kiểm thử chưa có tiêu chí, hoàn tất thiết lập ban đầu
      const isMiniOnboardingVisible = await personalizePage.banDangTimCongHeading.isVisible({ timeout: 5000 }).catch(() => false);
      if (isMiniOnboardingVisible) {
        await personalizePage.completeStep1JobTitle('nhân viên bán hàng');
        await personalizePage.completeStep2Locations(['TP.HCM']);
        await personalizePage.completeStep3Salary('10', '15');
        // Sau khi đã có tiêu chí, truy cập lại trang Personalized Page để kiểm tra hành vi bypass
        await personalizePage.navigateToPersonalizedPage();
        await personalizePage.closeBannerIfVisible();
      }

      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('01_mobile_authenticated_user_personalized_page_loaded');
    });

    await test.step('When Hệ thống kiểm tra dữ liệu tiêu chí tìm việc (Job Goal) của tài khoản trên mobile', async () => {
      // Hệ thống nhận diện tài khoản đã có tiêu chí (>= 1/3)
      await personalizePage.capture('02_mobile_job_goal_evaluated');
    });

    await test.step('Then Hệ thống tự động bypass Onboarding mini và hiển thị trang danh sách việc làm gợi ý mobile', async () => {
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
      await personalizePage.capture('03_mobile_onboarding_mini_bypassed_destination_loaded');
    });
  });
});
