const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Onboarding tiêu chí tìm việc sau khi đăng nhập @onboarding @desktop @e2e @REQ-002', () => {
  test('TC-035 - AC-005 Kiểm tra đóng modal onboarding giữa chừng và kiểm tra trạng thái trang chủ', async ({ page, pages, authenticatedUser }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và thấy modal Onboarding (Bước 1)',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và thấy modal Onboarding', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 30000 });
      await onboardingPopup.capture('precondition_onboarding_shown');
    });

    await test.step('When [1] Bấm nút đóng modal onboarding giữa chừng', async () => {
      await onboardingPopup.skipOrClose();
      await onboardingPopup.capture('after_close_onboarding_clicked');
    });

    await test.step('Then [1] Modal onboarding đóng lại thành công và hiển thị trang chủ không bị chặn', async () => {
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 15000 });
      await homePage.expectHomepageVisible();
      await homePage.capture('homepage_accessible_after_onboarding_closed');
    });
  });
});
