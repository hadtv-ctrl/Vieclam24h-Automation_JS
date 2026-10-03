const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @bva @desktop @e2e @REQ-008', () => {
  test('TC-101 - AC-024 Chọn chính xác 5 khu vực làm việc (Giá trị biên tối đa)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);

      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('step2_locations_screen_ready');
    });

    await test.step('When [1] Chọn lần lượt đúng 5 khu vực làm việc khác nhau', async () => {
      // Chọn lần lượt đúng 5 khu vực: TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang
      await personalizePage.select5Locations();
    });

    await test.step('Then [1] Hệ thống cho phép chọn thành công cả 5 khu vực. Các khu vực còn lại bị vô hiệu hóa hoặc đạt giới hạn', async () => {
      // Xác nhận 5 khu vực được chọn thành công, thử chọn thêm khu vực thứ 6
      await personalizePage.select6thLocationIfAvailable();
      await personalizePage.capture('5_locations_selected_boundary_reached');
    });

    await test.step('When [2] Bấm Tiếp tục hoặc Lưu', async () => {
      // Nhấn Tiếp theo để lưu 5 khu vực đã chọn
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [2] Hệ thống lưu thành công 5 khu vực và chuyển sang bước tiếp theo', async () => {
      // Hệ thống lưu thành công và chuyển sang Bước 3 (Mức lương mong muốn)
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('step3_salary_displayed_successfully');
    });
  });
});
