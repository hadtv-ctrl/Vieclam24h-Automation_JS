const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Onboarding tiêu chí tìm việc sau khi đăng nhập @auth @onboarding @desktop @e2e @REQ-002', () => {
  test('TC-041 - AC-005: Kiểm thử luồng Bỏ qua Onboarding (Skip flow) và duy trì trạng thái tài khoản khi đăng nhập lại', async ({ page, pages, authenticatedUser }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    const loginPopup = new LoginPopup(page);
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản người dùng mới tạo chưa từng onboarding, đang ở màn hình trang chủ sau khi đăng nhập lần đầu',
    });

    await test.step('Given Tiền điều kiện: Tài khoản người dùng mới tạo chưa từng onboarding, đang ở màn hình trang chủ sau khi đăng nhập lần đầu', async () => {
      // Fixture authenticatedUser tự động tạo tài khoản kiểm thử cô lập và thực hiện đăng nhập lần đầu
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_first_login_homepage_ready');
    });

    await test.step('When [1] Đăng nhập tài khoản mới vào hệ thống', async () => {
      // Khẳng định sau phiên đăng nhập đầu tiên, màn hình Onboarding hiển thị
      await expect(onboardingPopup.locationInput.or(onboardingPopup.step1Title)).toBeVisible({ timeout: 30000 });
      await onboardingPopup.capture('onboarding_modal_step1_displayed');
    });

    await test.step('Then [1] Modal Onboarding hiển thị tại Bước 1 kèm nút "Bỏ qua" (Skip)', async () => {
      await expect(onboardingPopup.step1Title.or(onboardingPopup.locationInput)).toBeVisible();
      await expect(onboardingPopup.skipBtn.or(onboardingPopup.closeBtn)).toBeVisible();
      await onboardingPopup.capture('onboarding_step1_with_skip_btn_verified');
    });

    await test.step('When [2] Nhấn nút "Bỏ qua" (Skip) trên modal Onboarding', async () => {
      await onboardingPopup.clickSkip();
      await onboardingPopup.capture('skip_onboarding_clicked');
    });

    await test.step('Then [2] Modal đóng lại ngay lập tức, overlay biến mất, người dùng truy cập trang chủ bình thường', async () => {
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 15000 });
      await homePage.expectHomepageVisible();
      await expect(homePage.accountMenuButton.or(homePage.logo)).toBeVisible();
      await homePage.capture('homepage_accessible_after_skip');
    });

    await test.step('When [3] Thực hiện Đăng xuất khỏi hệ thống', async () => {
      await homePage.logout();
      await homePage.capture('after_logout_invoked');
    });

    await test.step('Then [3] Đăng xuất thành công, chuyển hướng về trang Đăng nhập', async () => {
      await expect(loginPopup.loginHeaderBtn.or(loginPopup.modalTitle).or(loginPopup.phoneInput)).toBeVisible({ timeout: 15000 });
      await homePage.capture('logout_successfully_verified');
    });

    await test.step('When [4] Đăng nhập lại với tài khoản vừa thao tác', async () => {
      if (!(await loginPopup.phoneInput.isVisible().catch(() => false))) {
        await loginPopup.clickLoginHeader().catch(() => null);
        await loginPopup.waitForModalVisible().catch(() => null);
      }
      const userPhone = authenticatedUser.phone || authenticatedUser.username;
      const userEmail = authenticatedUser.email;
      if (userPhone) {
        await loginPopup.fillPhone(userPhone);
        await loginPopup.clickContinue();
        if (await loginPopup.loginPasswordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.loginPasswordInput.fill(authenticatedUser.password || 'Test@1234');
          await loginPopup.clickSubmit();
        } else if (await loginPopup.otpInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.fillOtpCode(authenticatedUser.otp || '1111');
        }
      } else if (userEmail) {
        await loginPopup.clickEmailLoginOption().catch(() => null);
        await loginPopup.fillEmail(userEmail);
        await loginPopup.clickContinue();
        if (await loginPopup.loginPasswordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.loginPasswordInput.fill(authenticatedUser.password || 'Test@1234');
          await loginPopup.clickSubmit();
        } else if (await loginPopup.otpInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.fillOtpCode(authenticatedUser.otp || '1111');
        }
      }
      await homePage.capture('re_login_submitted');
    });

    await test.step('Then [4] Đăng nhập thành công vào trang chủ, modal Onboarding KHÔNG tự động hiển thị lại', async () => {
      await homePage.expectHomepageVisible();
      await expect(homePage.accountMenuButton.or(homePage.logo)).toBeVisible();
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 10000 });
      await homePage.capture('onboarding_not_reappeared_verified');
    });
  });
});
