const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @edge-case @mobile @e2e @REQ-008', () => {
  test('TC-103 - AC-024 Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case) trên mobile web', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_deselect_reselect_locations');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page trên Mobile Web, hoàn tất xác thực OTP và thực hiện chọn đủ 5 khu vực, bỏ chọn rồi chọn lại trong Mini-onboarding',
    });

    const testPhone = generateRandomVNPhone();
    const testFullName = 'Hà Đinh';
    const testJobTitle = 'nhân viên bán hàng';

    await test.step('Given Tiền điều kiện: Khách vãng lai truy cập trực tiếp Personalized Page và mở form đăng ký / xác thực trên mobile', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_mobile_direct_personalized_page_auth_ready');
    });

    await test.step('When [1] Đăng ký số điện thoại mới và nhập mã xác thực OTP trên mobile', async () => {
      await personalizePage.registerPhoneAndOtp(testPhone, '1111');
    });

    await test.step('When [2] Nhập Họ tên và chấp thuận điều khoản xử lý dữ liệu cá nhân', async () => {
      await personalizePage.enterFullNameAndAcceptConsent(testFullName);
    });

    await test.step('When [Bước 1 Mini-onboarding] Nhập và chọn vị trí công việc mong muốn trên mobile', async () => {
      await personalizePage.completeStep1JobTitle(testJobTitle);
    });

    await test.step('When [Bước 2 Mini-onboarding] Chọn đủ 5 khu vực làm việc ban đầu (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, Cần Thơ)', async () => {
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('02_mobile_step2_locations_before_selection');

      await personalizePage.select5Locations({ capture: false });
      await personalizePage.capture('03_mobile_initial_5_locations_selected');
    });

    await test.step('When [3] Bỏ chọn 1 khu vực trong danh sách 5 khu vực đã chọn trên mobile', async () => {
      // Bỏ chọn khu vực Cần Thơ
      await personalizePage.deselectLocation('Cần Thơ', { capture: false });
    });

    await test.step('Then [1] Hệ thống cho phép bỏ chọn, các khu vực khác được mở khóa trở lại', async () => {
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_mobile_can_tho_deselected_others_unlocked');
    });

    await test.step('When [4] Chọn 1 khu vực mới khác thay thế trên mobile', async () => {
      // Chọn lại khu vực Cần Thơ
      await personalizePage.selectSingleLocation('Cần Thơ', { capture: false });
    });

    await test.step('Then [2] Hệ thống cập nhật lại danh sách 5 khu vực và nút Tiếp theo sẵn sàng', async () => {
      await expect(personalizePage.tiepTheoBtn).toBeEnabled({ timeout: 10000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('05_mobile_new_location_selected_ready_to_continue');
    });

    await test.step('When [5] Bấm Tiếp theo để lưu danh sách 5 khu vực đã cập nhật trên mobile', async () => {
      await personalizePage.tiepTheoBtn.click({ force: true });
    });

    await test.step('Then [3] Hệ thống lưu thành công danh sách khu vực và chuyển sang Bước 3', async () => {
      await expect(personalizePage.minSalaryInput).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('06_mobile_step3_reached_after_reselect');
    });
  });
});
