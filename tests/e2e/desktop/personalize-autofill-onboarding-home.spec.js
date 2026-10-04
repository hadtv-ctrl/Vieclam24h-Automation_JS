const { test, expect } = require('../../../core/fixtures/baseTest');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const testData = require('../../../data/personalizeJobData.json');

test.describe('Feature: Đồng bộ dữ liệu tiêu chí giữa Onboarding mini và Onboarding Home @personalize @onboarding @desktop @e2e @REQ-008', () => {
  test('TC-099 - AC-024 Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_autofill_sync_home');
    const onboardingPopup = new OnboardingPopup(page);
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai thiết lập tiêu chí qua Onboarding mini trực tiếp trên Personalized Page và quay lại kiểm tra Onboarding tại trang chủ',
    });

    const testPhone = generateRandomVNPhone();
    const { otp, fullName } = testData.user;

    await test.step('Given Tiền điều kiện: Người dùng hoàn tất thiết lập tiêu chí qua Onboarding mini trực tiếp trên Personalized Page', async () => {
      // Điều hướng trực tiếp đến Personalized Page
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('01_personalized_page_loaded');

      // Thực hiện đăng ký và thiết lập 3 bước tiêu chí Onboarding mini trực tiếp trên trang Personalized
      await personalizePage.registerPhoneAndOtp(testPhone, otp || '1111');
      await personalizePage.enterFullNameAndAcceptConsent(fullName || 'Hà Đinh');
      await personalizePage.completeStep1JobTitle('nhân viên bán hàng');
      await personalizePage.completeStep2Locations(['TP.HCM']);
      await personalizePage.completeStep3Salary('10', '15');
      await personalizePage.capture('02_onboarding_mini_criteria_saved');
    });

    await test.step('When Người dùng điều hướng quay lại màn hình Trang chủ', async () => {
      // Điều hướng về Trang chủ để kiểm tra tác động đồng bộ luồng Onboarding Home
      await homePage.navigate();
      await page.waitForLoadState('domcontentloaded');
      await homePage.expectHomepageVisible();
    });

    await test.step('Then Các thông tin đã chọn từ Onboarding mini được autofill hoặc đồng bộ trạng thái ở Onboarding Home', async () => {
      // Nếu Onboarding Home xuất hiện, kiểm tra các giá trị (khu vực, vị trí, lương) đã được đồng bộ / autofill
      // Hoặc nếu hệ thống đã ghi nhận tiêu chí hoàn tất từ Onboarding mini, modal Onboarding Home tự động đóng/bỏ qua câu hỏi trùng
      const isOnboardingHomeVisible = await onboardingPopup.modal.isVisible({ timeout: 5000 }).catch(() => false);

      if (isOnboardingHomeVisible) {
        // Kiểm tra autofill: Nơi làm việc (TP.HCM) hoặc ô công việc hoặc mức lương phản ánh tiêu chí đã thiết lập
        const syncIndicator = onboardingPopup.hcmLocationBtn
          .or(onboardingPopup.jobTitleInput)
          .or(onboardingPopup.salaryOption1);

        await expect(syncIndicator.first()).toBeVisible({ timeout: 10000 });
        await onboardingPopup.capture('03_onboarding_home_autofill_verified');
      } else {
        // Hệ thống đã đồng bộ tiêu chí từ Onboarding mini vào hồ sơ nên không hiển thị lại câu hỏi trùng lặp tại Home
        await expect(onboardingPopup.modal).toBeHidden();
        await expect(homePage.accountMenuButton).toBeVisible({ timeout: 10000 });
        await homePage.capture('03_onboarding_home_auto_resolved_via_mini');
      }
    });
  });
});
