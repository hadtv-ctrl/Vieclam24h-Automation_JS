const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @personalize @onboarding @deeplink @desktop @e2e @REQ-008', () => {
  test('TC-106 - AC-024: Thiết lập Mini-Onboarding 3 bước trực tiếp từ URL Personalized Page', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new PersonalizePage(page, 'personalize_direct_onboarding');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai truy cập trực tiếp URL trang Việc làm dành riêng cho bạn, đăng ký tài khoản mới và thiết lập tiêu chí tìm việc qua Mini-onboarding 3 bước',
    });

    const testPhone = generateRandomVNPhone();
    const testFullName = 'Hà Đinh';
    const testJobTitle = 'nhân viên bán hàng';
    const testMinSalary = '10';
    const testMaxSalary = '15';

    await test.step('Given Tiền điều kiện: Truy cập trực tiếp Personalized Page và mở form xác thực', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      await personalizePage.capture('01_direct_personalized_page_loaded');
    });

    await test.step('When [1] Đăng ký số điện thoại mới và nhập mã xác thực OTP', async () => {
      // Nhập SĐT và điền 4 số OTP
      await personalizePage.registerPhoneAndOtp(testPhone, '1111');
    });

    await test.step('When [2] Nhập Họ tên và chấp thuận điều khoản xử lý dữ liệu cá nhân', async () => {
      // Điền Họ và tên, chấp thuận modal Consent
      await personalizePage.enterFullNameAndAcceptConsent(testFullName);
    });

    await test.step('When [Bước 1 Mini-onboarding] Nhập và chọn vị trí công việc mong muốn', async () => {
      // Nhập vị trí công việc và chọn gợi ý
      await personalizePage.completeStep1JobTitle(testJobTitle);
    });

    await test.step('When [Bước 2 Mini-onboarding] Chọn khu vực làm việc mong muốn', async () => {
      // Chọn khu vực TP.HCM và chụp bằng chứng trước khi chuyển bước
      await personalizePage.completeStep2Locations(['TP.HCM']);
    });

    await test.step('When [Bước 3 Mini-onboarding] Thiết lập khoảng mức lương mong muốn và Hoàn tất', async () => {
      // Nhập khoảng lương 10 - 15 triệu và chụp bằng chứng trước khi hoàn tất
      await personalizePage.completeStep3Salary(testMinSalary, testMaxSalary);
    });

    await test.step('Then Hệ thống hoàn tất Mini-onboarding và cập nhật tiêu chí tìm việc trên Personalized Page', async () => {
      // Xác nhận widget tiêu chí tìm việc của tôi và danh sách việc làm gợi ý hiển thị
      await personalizePage.verifyPersonalizedPageAfterOnboarding({
        jobTitle: testJobTitle,
        location: 'TP.HCM',
        salary: '10 - 15 triệu',
      });
      await expect(personalizePage.finalPersonalizeHeading).toBeVisible({ timeout: 20000 });
    });
  });
});
