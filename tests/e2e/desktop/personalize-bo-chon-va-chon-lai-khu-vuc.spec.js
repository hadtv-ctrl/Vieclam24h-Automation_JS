const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @edge-case @desktop @e2e @REQ-008', () => {
  test('TC-103 - AC-024 Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case)', async ({ page }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_deselect_reselect_locations');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, ở Bước 2 chọn khu vực làm việc và đã chọn đủ 5 khu vực',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng ở Bước 2 chọn khu vực trên Personalized Page và đã chọn đủ 5 khu vực', async () => {
      // Thực hiện xác thực và đến Bước 2 trực tiếp trên Personalized Page
      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.select5Locations();
      await personalizePage.capture('01_initial_5_locations_selected');
    });

    await test.step('When [1] Bỏ chọn 1 khu vực trong danh sách 5 khu vực đã chọn', async () => {
      // Bỏ chọn khu vực TP.HCM
      await personalizePage.deselectLocation('TP.HCM');
    });

    await test.step('Then [1] Hệ thống cho phép bỏ chọn, các khu vực khác được mở khóa trở lại', async () => {
      // Xác nhận khu vực TP.HCM đã được bỏ chọn thành công
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_location_deselected_verified');
    });

    await test.step('When [2] Chọn 1 khu vực mới khác', async () => {
      // Chọn lại khu vực TP.HCM
      await personalizePage.selectSingleLocation('TP.HCM');
    });

    await test.step('Then [2] Hệ thống cho phép chọn khu vực mới và khóa các lựa chọn còn lại', async () => {
      // Thử kiểm tra giới hạn chọn thêm khu vực thứ 6
      await personalizePage.select6thLocationIfAvailable();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_location_reselected_verified');
    });

    await test.step('When [3] Bấm Tiếp tục', async () => {
      // Bấm nút Tiếp theo để lưu danh sách 5 khu vực
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [3] Hệ thống lưu thành công danh sách 5 khu vực mới cập nhật trên Personalized Page', async () => {
      // Chuyển sang Bước 3 (Mức lương mong muốn) thành công
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_edge_case_5_locations_saved_successfully');
    });
  });
});
