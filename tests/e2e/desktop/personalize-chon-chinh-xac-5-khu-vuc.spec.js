const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @bva @desktop @e2e @REQ-008', () => {
  test('TC-101 - AC-024 Chọn chính xác 5 khu vực làm việc (Giá trị biên tối đa)', async ({ page }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_5_locations_bva');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, hoàn tất xác thực và đang ở Bước 2 chọn khu vực làm việc của Mini-onboarding',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng ở Bước 2 chọn khu vực làm việc trực tiếp trên Personalized Page', async () => {
      // Thực hiện xác thực và đến Bước 2 trực tiếp trên Personalized Page
      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_step2_locations_screen_ready');
    });

    await test.step('When [1] Chọn lần lượt đúng 5 khu vực làm việc khác nhau', async () => {
      // Chọn lần lượt đúng 5 khu vực: TP.HCM, Hà Nội, Bình Dương, Đồng Nai, Cần Thơ
      await personalizePage.select5Locations();
    });

    await test.step('Then [1] Hệ thống cho phép chọn thành công cả 5 khu vực. Các khu vực còn lại bị vô hiệu hóa hoặc đạt giới hạn', async () => {
      // Xác nhận 5 khu vực được chọn thành công, thử chọn thêm khu vực thứ 6
      await personalizePage.select6thLocationIfAvailable();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_5_locations_selected_boundary_reached');
    });

    await test.step('When [2] Bấm Tiếp tục hoặc Lưu', async () => {
      // Nhấn Tiếp theo để lưu 5 khu vực đã chọn
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [2] Hệ thống lưu thành công 5 khu vực và chuyển sang bước tiếp theo', async () => {
      // Hệ thống lưu thành công và chuyển sang Bước 3 (Mức lương mong muốn) ngay trên Personalized Page
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_step3_salary_displayed_successfully');
    });
  });
});
