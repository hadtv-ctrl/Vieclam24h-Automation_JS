const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const testData = require('../../../data/personalizeJobData.json');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @desktop @e2e @record @REQ-008', () => {

  test('TC-095 - AC-023 AC-024 AC-025 AC-026: Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation_e2e');

    // Khai báo Precondition hiển thị trên header của Playwright Report
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai truy cập trực tiếp Personalized Page, đăng ký tài khoản mới và hoàn tất khảo sát 3 bước',
    });

    // Tạo số điện thoại kiểm thử ngẫu nhiên đảm bảo luồng OTP đăng ký mới chạy ổn định
    const testPhone = generateRandomVNPhone();
    const { otp, fullName } = testData.user;
    const testJobTitle = 'nhân viên bán hàng';
    const testLocations = ['TP.HCM', 'Hà Nội'];
    const minSalary = '10';
    const maxSalary = '15';

    await test.step('Given Tiền điều kiện: Người dùng truy cập trực tiếp Personalized Page và mở form đăng ký', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await expect(personalizePage.nhapSoDienThoaiInput).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_personalized_page_auth_ready');
    });

    await test.step('When [1] Đăng ký số điện thoại mới và nhập mã xác thực OTP', async () => {
      await personalizePage.registerPhoneAndOtp(testPhone, otp || '1111');
    });

    await test.step('When [2] Nhập Họ tên và chấp thuận điều khoản xử lý dữ liệu cá nhân', async () => {
      await personalizePage.enterFullNameAndAcceptConsent(fullName || 'Hà Đinh');
    });

    await test.step('When [Bước 1 Mini-onboarding] Nhập và chọn vị trí công việc mong muốn', async () => {
      await personalizePage.completeStep1JobTitle(testJobTitle);
    });

    await test.step('When [Bước 2 Mini-onboarding] Chọn khu vực làm việc mong muốn', async () => {
      await personalizePage.completeStep2Locations(testLocations);
    });

    await test.step('When [Bước 3 Mini-onboarding] Thiết lập khoảng mức lương mong muốn và Hoàn tất', async () => {
      await personalizePage.completeStep3Salary(minSalary, maxSalary);
    });

    await test.step('Then Kiểm tra danh sách việc làm gợi ý và trạng thái hoàn tất thành công trên Personalized Page', async () => {
      // Khẳng định trang đích đúng là Personalized Page
      expect(page.url()).toContain(personalizePage.personalizedPath);

      // Xác nhận widget tiêu chí tìm việc và danh sách việc làm gợi ý hiển thị
      await personalizePage.verifyPersonalizedPageAfterOnboarding({
        jobTitle: testJobTitle,
        location: testLocations[0],
        salary: `${minSalary} - ${maxSalary} triệu`,
      });
      await expect(personalizePage.finalPersonalizeHeading).toBeVisible({ timeout: 20000 });
    });
  });

});
