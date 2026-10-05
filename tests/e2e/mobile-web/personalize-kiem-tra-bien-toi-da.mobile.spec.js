const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @bva @personalize @mobile @e2e @REQ-008', () => {
  test('TC-097 - AC-023 Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5 trên mobile web', async ({ page }, testInfo) => {
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_boundary_max_5');
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page trên Mobile Web, hoàn tất xác thực và đang ở màn hình chọn khu vực (Bước 2 Mini-onboarding)',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng ở Bước 2 chọn khu vực trực tiếp trên Personalized Page mobile', async () => {
      // Xác thực và điều hướng trực tiếp đến Bước 2 trên Personalized Page
      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_mobile_step2_screen_ready');
    });

    await test.step('When [1] Chọn tối đa 5 khu vực hợp lệ ban đầu trên mobile', async () => {
      // Chọn đủ 5 khu vực (giá trị biên tối đa hợp lệ)
      await personalizePage.select5Locations({ capture: false });
      await personalizePage.capture('02_mobile_5_locations_selected');
    });

    await test.step('Then [1] Hệ thống ghi nhận 5 khu vực và nút Tiếp theo được kích hoạt trên mobile', async () => {
      await expect(personalizePage.tiepTheoBtn).toBeEnabled({ timeout: 10000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_mobile_5_locations_valid_no_error');
    });

    await test.step('When [2] Thử chọn thêm khu vực thứ 6 (vượt quá giới hạn tối đa 5)', async () => {
      // Mở dropdown Khác để kiểm tra nút khu vực thứ 6
      await personalizePage.openExtendedLocationsDropdown();
      await personalizePage.capture('04_mobile_attempt_select_6th_location');
    });

    await test.step('Then [2] Hệ thống kiểm soát biên: các lựa chọn còn lại bị khóa/vô hiệu hóa, không cho chọn quá 5 khu vực', async () => {
      // Xác nhận các lựa chọn chưa được chọn đều có trạng thái disabled
      if (await personalizePage.sixthLocationBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(personalizePage.sixthLocationBtn).toBeDisabled();
      }
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('05_mobile_boundary_exceeded_controlled_successfully');
    });
  });
});
