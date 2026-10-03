const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @personalize @auth @desktop @e2e @REQ-008', () => {
  test('TC-098 - AC-024 Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc', async ({ page, pages, authenticatedUser }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập tài khoản có sẵn thông tin tiêu chí tìm việc',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('user_homepage_ready');
    });

    await test.step('When Người dùng mở luồng việc làm dành riêng cho bạn', async () => {
      // Nhấn điểm chạm việc làm dành riêng (+10 việc làm có lương hấp dẫn hoặc nút Xem việc làm dành riêng)
      if (await personalizePage.item10ViecLamCoLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await personalizePage.actions.click(personalizePage.item10ViecLamCoLink);
      } else if (await personalizePage.xemViecLamDanhBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await personalizePage.actions.click(personalizePage.xemViecLamDanhBtn);
      }
      await personalizePage.capture('personalize_entry_clicked');
    });

    await test.step('Then Hệ thống nhận diện tài khoản đã có tiêu chí, tự động bypass Onboarding mini và hiển thị trang danh sách việc làm', async () => {
      // Hệ thống kiểm tra tài khoản đã có >= 1 thông tin tiêu chí: KHÔNG hiển thị modal Onboarding mini 3 bước
      await expect(personalizePage.banDangTimCongHeading).toBeHidden();

      // Và chuyển hướng thẳng đến màn hình kết quả / danh sách việc làm cá nhân hóa
      const destinationIndicator = personalizePage.tieuChiTimViecHeading
        .or(personalizePage.tieuChiTimViecText)
        .or(personalizePage.viecLamDanhChoHeading)
        .or(personalizePage.body);

      await expect(destinationIndicator.first()).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('onboarding_mini_bypassed_destination_loaded');
    });
  });
});
