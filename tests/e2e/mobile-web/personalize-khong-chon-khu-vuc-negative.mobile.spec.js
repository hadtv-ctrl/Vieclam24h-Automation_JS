const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @bva @negative @mobile @e2e @REQ-008', () => {
  test('TC-102 - AC-024 Không chọn khu vực làm việc nào và tiếp tục (Giá trị biên dưới - Negative) trên mobile web', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_empty_locations_negative');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page trên Mobile Web, hoàn tất xác thực và đang ở Bước 2 chọn khu vực làm việc của Mini-onboarding nhưng để trống không chọn',
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

    await test.step('When [Bước 2 Mini-onboarding] Để trống, không chọn bất kỳ khu vực làm việc nào trên mobile', async () => {
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_mobile_step2_empty_locations_displayed');
    });

    await test.step('Then [1] Nút Tiếp theo bị vô hiệu hóa hoặc bị chặn không cho phép chuyển bước khi chưa chọn khu vực', async () => {
      await expect(personalizePage.tiepTheoBtn).toBeDisabled({ timeout: 10000 });

      // Khẳng định hệ thống không chuyển bước, vẫn ở màn hình Bước 2 trên Personalized Page
      await expect(personalizePage.chonToiDa5Text).toBeVisible();
      await expect(personalizePage.minSalaryInput).toBeHidden();
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await personalizePage.capture('03_mobile_empty_locations_blocked_successfully');
    });
  });
});
