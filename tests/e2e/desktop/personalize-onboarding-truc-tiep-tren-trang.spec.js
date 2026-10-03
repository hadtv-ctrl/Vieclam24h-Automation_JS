const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @personalize @onboarding @deeplink @desktop @e2e @REQ-008', () => {
  test('TC-106 - AC-024: Thiết lập Mini-Onboarding 3 bước trực tiếp từ URL Personalized Page', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new PersonalizePage(page, 'personalize_direct_onboarding');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp URL trang Việc làm dành riêng cho bạn, xác thực tài khoản và làm 3 bước Mini-onboarding',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Truy cập trực tiếp Personalized Page và xác thực tài khoản', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();

      // Đăng ký xác thực tài khoản và chấp thuận Consent điều khoản
      await personalizePage.registerAndAcceptConsentOnPersonalizedPage(testPhone, '1111', 'Hà Đinh');
      await personalizePage.capture('authenticated_on_personalized_page');
    });

    await test.step('When Người dùng thực hiện tuần tự 3 bước Mini-onboarding trực tiếp trên trang', async () => {
      // Thực hiện trọn vẹn 3 bước: Vị trí -> Khu vực -> Mức lương
      await personalizePage.completeDirectMiniOnboarding('nhân viên bán hàng', '10', '15');
      await personalizePage.capture('step3_salary_completed');
    });

    await test.step('Then Hệ thống hoàn tất Mini-onboarding và cập nhật giao diện Personalized Page', async () => {
      // Xác nhận các thành phần của Personalized Page hoặc tiêu chí tìm việc hiển thị
      await expect(personalizePage.finalPersonalizeHeading).toBeVisible({ timeout: 20000 });
      await personalizePage.capture('direct_onboarding_completed_successfully');
    });
  });
});
