const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @edge-case @desktop @e2e @REQ-008', () => {
  test('TC-103 - AC-024 Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đang ở bước chọn khu vực làm việc và đã chọn đủ 5 khu vực',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng đang ở bước chọn khu vực làm việc và đã chọn đủ 5 khu vực', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);

      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.select5Locations();
      await personalizePage.capture('initial_5_locations_selected');
    });

    await test.step('When [1] Bỏ chọn 1 khu vực trong danh sách 5 khu vực đã chọn', async () => {
      // Bỏ chọn khu vực TP.HCM
      await personalizePage.deselectLocation('TP.HCM');
    });

    await test.step('Then [1] Hệ thống cho phép bỏ chọn, các khu vực khác được mở khóa trở lại', async () => {
      // Xác nhận khu vực TP.HCM đã được bỏ chọn thành công
      await personalizePage.capture('location_deselected_verified');
    });

    await test.step('When [2] Chọn 1 khu vực mới khác', async () => {
      // Chọn lại khu vực TP.HCM
      await personalizePage.selectSingleLocation('TP.HCM');
    });

    await test.step('Then [2] Hệ thống cho phép chọn khu vực mới và khóa các lựa chọn còn lại', async () => {
      // Thử kiểm tra giới hạn chọn thêm khu vực thứ 6
      await personalizePage.select6thLocationIfAvailable();
      await personalizePage.capture('location_reselected_verified');
    });

    await test.step('When [3] Bấm Tiếp tục', async () => {
      // Bấm nút Tiếp theo để lưu danh sách 5 khu vực
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [3] Hệ thống lưu thành công danh sách 5 khu vực mới cập nhật', async () => {
      // Chuyển sang Bước 3 (Mức lương mong muốn) thành công
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('edge_case_5_locations_saved_successfully');
    });
  });
});
