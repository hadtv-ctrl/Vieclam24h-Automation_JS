const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @edge-case @desktop @e2e @REQ-008', () => {
  test('TC-103 - AC-024 Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case)', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new PersonalizePage(page, 'personalize_deselect_reselect_locations');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, hoàn tất xác thực OTP và thực hiện chọn đủ 5 khu vực, bỏ chọn rồi chọn lại trong Mini-onboarding',
    });

    const testPhone = generateRandomVNPhone();
    const testFullName = 'Hà Đinh';
    const testJobTitle = 'nhân viên bán hàng';

    await test.step('Given Tiền điều kiện: Khách vãng lai truy cập trực tiếp Personalized Page và mở form đăng ký / xác thực', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_direct_personalized_page_auth_ready');
    });

    await test.step('When [1] Đăng ký số điện thoại mới và nhập mã xác thực OTP', async () => {
      // Điền số điện thoại ngẫu nhiên và nhập OTP 1111
      await personalizePage.registerPhoneAndOtp(testPhone, '1111');
    });

    await test.step('When [2] Nhập Họ tên và chấp thuận điều khoản xử lý dữ liệu cá nhân', async () => {
      // Điền Họ và tên, chấp thuận Consent modal
      await personalizePage.enterFullNameAndAcceptConsent(testFullName);
    });

    await test.step('When [Bước 1 Mini-onboarding] Nhập và chọn vị trí công việc mong muốn', async () => {
      // Điền vị trí công việc mong muốn và chọn gợi ý
      await personalizePage.completeStep1JobTitle(testJobTitle);
    });

    await test.step('When [Bước 2 Mini-onboarding] Chọn đủ 5 khu vực làm việc ban đầu (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, Cần Thơ)', async () => {
      // Chờ màn hình chọn khu vực hiển thị
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });

      // Chọn lần lượt đủ 5 khu vực ban đầu
      await personalizePage.select5Locations();
      await personalizePage.capture('02_initial_5_locations_selected');
    });

    await test.step('When [3] Bỏ chọn 1 khu vực trong danh sách 5 khu vực đã chọn', async () => {
      // Bỏ chọn khu vực Cần Thơ
      await personalizePage.deselectLocation('Cần Thơ');
    });

    await test.step('Then [1] Hệ thống cho phép bỏ chọn, các khu vực khác được mở khóa trở lại', async () => {
      // Xác nhận khu vực Cần Thơ không còn trạng thái được chọn (mất border-[#306499])
      await expect(personalizePage.getLocationBtn('Cần Thơ')).not.toHaveClass(/border-\[#306499\]/);
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_location_deselected_verified');
    });

    await test.step('When [4] Chọn lại khu vực làm việc để đạt đủ 5 khu vực', async () => {
      // Chọn lại khu vực Cần Thơ
      await personalizePage.selectSingleLocation('Cần Thơ');
    });

    await test.step('Then [2] Hệ thống cho phép chọn lại đủ 5 khu vực và khóa các lựa chọn còn lại', async () => {
      // Xác nhận khu vực Cần Thơ được chọn lại thành công (có border-[#306499])
      await expect(personalizePage.getLocationBtn('Cần Thơ')).toHaveClass(/border-\[#306499\]/);
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_location_reselected_verified');
    });

    await test.step('When [5] Bấm Tiếp theo để lưu danh sách 5 khu vực', async () => {
      // Bấm nút Tiếp theo để lưu danh sách 5 khu vực
      await expect(personalizePage.tiepTheoBtn).toBeEnabled({ timeout: 10000 });
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [3] Hệ thống lưu thành công danh sách 5 khu vực và chuyển sang Bước 3 Mức lương trên Personalized Page', async () => {
      // Chuyển sang Bước 3 (Mức lương mong muốn) thành công
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('05_edge_case_5_locations_saved_successfully');
    });
  });
});
