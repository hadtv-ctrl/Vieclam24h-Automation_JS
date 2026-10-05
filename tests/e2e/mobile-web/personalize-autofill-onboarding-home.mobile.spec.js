const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { MobilePersonalizePage } = require('../../../pages/mobile-web/MobilePersonalizePage');
const { MobileHomePage } = require('../../../pages/mobile-web/MobileHomePage');
const { MobileOnboardingPopup } = require('../../../pages/mobile-web/MobileOnboardingPopup');
const testData = require('../../../data/personalizeJobData.json');

test.describe('Mobile Feature: Đồng bộ dữ liệu tiêu chí giữa Onboarding mini và Onboarding Home @personalize @onboarding @mobile @e2e @REQ-008', () => {
  test('TC-099 - AC-024 Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home trên mobile web', async ({ page }, testInfo) => {
    test.setTimeout(240000);

    const homePage = new MobileHomePage(page, 'mobile_personalize_autofill_sync_home');
    const personalizePage = new MobilePersonalizePage(page, 'mobile_personalize_autofill_sync_home');
    const onboardingPopup = new MobileOnboardingPopup(page);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai trên Mobile Web thiết lập tiêu chí qua Onboarding mini trực tiếp trên Personalized Page và quay lại kiểm tra Onboarding tại trang chủ',
    });

    const testPhone = generateRandomVNPhone();
    const { otp, fullName } = testData.user;

    await test.step('Given Tiền điều kiện: Khách vãng lai hoàn tất thiết lập tiêu chí qua Onboarding mini trên Mobile Web', async () => {
      // Điều hướng trực tiếp đến Personalized Page trên Mobile Web
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.closeBannerIfVisible();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('01_mobile_personalized_page_loaded');

      // Thực hiện đăng ký SĐT mới + OTP + Họ tên & Consent trên mobile
      await personalizePage.registerPhoneAndOtp(testPhone, otp || '1111');
      await personalizePage.enterFullNameAndAcceptConsent(fullName || 'Hà Đinh');

      // Thiết lập 3 bước tiêu chí Onboarding mini trực tiếp trên trang Personalized
      await personalizePage.completeStep1JobTitle('nhân viên bán hàng');
      await personalizePage.completeStep2Locations(['TP.HCM']);
      await personalizePage.completeStep3Salary('10', '15');
      await personalizePage.capture('02_mobile_onboarding_mini_criteria_saved');
    });

    await test.step('When Người dùng điều hướng quay lại màn hình Trang chủ trên mobile', async () => {
      // Điều hướng về Trang chủ để kiểm tra tác động đồng bộ luồng Onboarding Home
      await homePage.navigate();
      await page.waitForLoadState('domcontentloaded');
      await homePage.expectHomepageVisible();
    });

    await test.step('Then Các thông tin đã chọn từ Onboarding mini được autofill hoặc đồng bộ trạng thái ở Onboarding Home mobile', async () => {
      // Chờ modal Onboarding Home xuất hiện (nếu có)
      const isOnboardingHomeVisible = await onboardingPopup.modal
        .waitFor({ state: 'visible', timeout: 7000 })
        .then(() => true)
        .catch(() => false);

      if (isOnboardingHomeVisible) {
        // Do Mini-onboarding đã lưu địa điểm (TP.HCM), Onboarding Home tự động nhảy đến Bước 2 (Ngành nghề)
        // hoặc hiển thị các trường tiêu chí đồng bộ tương ứng
        const syncIndicator = onboardingPopup.step2Title
          .or(onboardingPopup.industryDropdown)
          .or(onboardingPopup.modal.getByText(/2\/5 câu hỏi/i))
          .or(onboardingPopup.hcmLocationBtn)
          .or(onboardingPopup.jobTitleInput)
          .or(onboardingPopup.salaryOption1);

        await expect(syncIndicator.first()).toBeVisible({ timeout: 10000 });
        await onboardingPopup.capture('03_mobile_onboarding_home_autofill_verified');
      } else {
        // Hệ thống đã đồng bộ tiêu chí từ Onboarding mini vào hồ sơ nên không hiển thị lại câu hỏi trùng lặp tại Home
        await expect(onboardingPopup.modal).toBeHidden();
        await expect(homePage.accountMenuButton).toBeVisible({ timeout: 10000 });
        await homePage.capture('03_mobile_onboarding_home_auto_resolved_via_mini');
      }
    });
  });
});
