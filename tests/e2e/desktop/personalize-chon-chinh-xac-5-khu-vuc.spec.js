const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @bva @desktop @e2e @REQ-008', () => {
  test('TC-101 - AC-024 Chọn chính xác 5 khu vực làm việc (Giá trị biên tối đa)', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new PersonalizePage(page, 'personalize_5_locations_bva');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, hoàn tất xác thực OTP và thực hiện chọn đúng 5 khu vực làm việc trong Mini-onboarding',
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

    await test.step('When [Bước 2 Mini-onboarding] Chọn lần lượt đúng 5 khu vực làm việc (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, Cần Thơ)', async () => {
      // Kiểm tra màn hình chọn khu vực xuất hiện
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });

      // Chọn lần lượt đúng 5 khu vực làm việc
      await personalizePage.select5Locations();
      await personalizePage.capture('02_5_locations_selected_in_mini_onboarding');
    });

    await test.step('Then [1] Hệ thống cho phép chọn đủ 5 khu vực và kiểm soát biên tối đa 5', async () => {
      // Thử chọn thêm khu vực thứ 6 để kiểm tra biên tối đa 5
      await personalizePage.select6thLocationIfAvailable();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_max_5_locations_boundary_verified');
    });

    await test.step('When [3] Bấm Tiếp theo để lưu 5 khu vực đã chọn', async () => {
      // Xác nhận nút Tiếp theo đã kích hoạt sau khi chọn đủ 5 khu vực và nhấn để lưu
      await expect(personalizePage.tiepTheoBtn).toBeEnabled({ timeout: 10000 });
      await personalizePage.actions.click(personalizePage.tiepTheoBtn);
    });

    await test.step('Then [2] Hệ thống lưu thành công 5 khu vực và chuyển sang Bước 3 Mức lương trên Personalized Page', async () => {
      // Hệ thống chuyển tiếp sang Bước 3 (Mức lương mong muốn) thành công
      await expect(personalizePage.step3Indicator.first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('04_step3_salary_displayed_successfully');
    });
  });
});
