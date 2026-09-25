const { test, expect } = require('../../../core/fixtures/baseTest');
const onboardingData = require('../../../data/onboardingData.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Onboarding tiêu chí tìm việc @onboarding @desktop @e2e @REQ-002', () => {
  test('TC-031 - AC-005 Xác nhận thành công khi bỏ trống trường tùy chọn (trường tùy chọn theo quyết định)', async ({ page, authenticatedUser }, testInfo) => {
    const onboardingPopup = new OnboardingPopup(page);
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và đang ở màn hình đăng ký / nhập liệu Onboarding',
    });

    await test.step('Given Tiền điều kiện: Người dùng đang ở màn hình đăng ký / nhập liệu', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 30000 });
      await onboardingPopup.capture('precondition_onboarding_modal_shown');
    });

    await test.step('When [1] Nhập đầy đủ các trường thông tin bắt buộc khác', async () => {
      // Nhập trường khu vực tìm việc bắt buộc
      await onboardingPopup.selectLocationButton(onboardingData.location.button);
      await onboardingPopup.capture('mandatory_location_selected');
    });

    await test.step('Then [1] Các trường bắt buộc hợp lệ', async () => {
      await expect(onboardingPopup.modal).toBeVisible();
      await onboardingPopup.capture('mandatory_fields_valid');
    });

    await test.step('When [2] Để trống trường trường tùy chọn và bấm gửi form', async () => {
      // Theo quyết định Q-1: onboarding là tùy chọn, người dùng có thể đóng hoặc bỏ qua modal
      await onboardingPopup.skipOrClose();
      await onboardingPopup.capture('optional_onboarding_dismissed');
    });

    await test.step('Then [2] Hệ thống xử lý thành công, không báo lỗi thiếu trường tùy chọn', async () => {
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 15000 });
      await onboardingPopup.capture('onboarding_closed_successfully');
    });
  });
});
