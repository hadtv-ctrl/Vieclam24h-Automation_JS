const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const onboardingData = require('../../../data/onboardingData.json');

test.describe('Mobile Feature: Cập nhật thông tin Onboarding sau khi đăng nhập trên Mobile Web @onboarding @mobile @e2e', () => {
  test('Kiểm tra luồng Onboarding của người dùng mobile đã đăng nhập', async ({
    authenticatedUser,
    onboardingPopup,
  }) => {
    test.setTimeout(240000);

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và thấy modal Onboarding (Bước 1)', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 30000 });
      await onboardingPopup.capture('precondition_mobile_onboarding_modal_shown');
    });

    await test.step('When Tôi chọn khu vực tìm việc trên mobile', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_mobile_select_location');
      await onboardingPopup.selectLocationButton(onboardingData.location.button);
      await onboardingPopup.selectLocationOption(onboardingData.location.option);
      await onboardingPopup.capture('after_mobile_select_location_opt');
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step2Title);
    });

    await test.step('And Tôi chọn ngành nghề quan tâm trên mobile', async () => {
      await expect(onboardingPopup.industryDropdown).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_mobile_select_industry');
      await onboardingPopup.selectIndustry(onboardingData.industry);
      await onboardingPopup.capture('after_mobile_select_industry');
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step3Title);
    });

    await test.step('And Tôi nhập công việc mong muốn trên mobile', async () => {
      await expect(onboardingPopup.jobTitleInput).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_mobile_input_job_title');
      await onboardingPopup.inputJobTitle(onboardingData.jobTitle);
      await expect(onboardingPopup.selectItem).toBeVisible({ timeout: 10000 });
      await onboardingPopup.capture('after_mobile_input_job_title');
      await onboardingPopup.selectSuggestedJobTitle();
      await expect(onboardingPopup.selectItem).toBeHidden({ timeout: 10000 });
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step4Title);
    });

    await test.step('And Tôi chọn mức lương mong muốn trên mobile', async () => {
      await onboardingPopup.capture('before_mobile_select_salary');
      const step4Visible = await onboardingPopup.step4Title.isVisible({ timeout: 5000 }).catch(() => false);
      if (!step4Visible) {
        await onboardingPopup.capture('mobile_onboarding_modal_already_closed');
        return;
      }
      await onboardingPopup.selectSalary(onboardingData.salary);
      await onboardingPopup.capture('after_mobile_select_salary');
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step5Title);
    });

    await test.step('And Tôi chọn số năm kinh nghiệm trên mobile', async () => {
      await expect(onboardingPopup.step5Title).toBeVisible({ timeout: 15000 });
      const step5Visible = await onboardingPopup.step5Title.isVisible({ timeout: 5000 }).catch(() => false);
      if (!step5Visible) {
        await onboardingPopup.capture('mobile_onboarding_modal_already_closed_step5');
        return;
      }
      await onboardingPopup.capture('before_mobile_select_years');
      await onboardingPopup.selectYears(onboardingData.experience);
      await expect(onboardingPopup.submitBtn).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('after_mobile_select_years');
      await onboardingPopup.clickSubmit();
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 10000 });
      await onboardingPopup.capture('after_mobile_onboarding_completed');
    });
  });
});
