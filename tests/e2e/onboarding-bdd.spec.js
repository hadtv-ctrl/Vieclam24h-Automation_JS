const { test, expect } = require('../../core/fixtures/baseTest');
const onboardingData = require('../../data/onboardingData.json'); // Nạp dữ liệu từ file JSON

test.describe('Feature: Cập nhật thông tin Onboarding sau khi đăng nhập @onboarding @e2e', () => {
  test('Kiểm tra luồng Onboarding của người dùng đã đăng nhập', async ({ authenticatedUser, onboardingPopup }) => {
    test.setTimeout(240000);

    await test.step('Given Người dùng thấy modal Onboarding (Bước 1) sau khi đăng nhập', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 30000 }); // Chờ input khu vực hiển thị
      // await onboardingPopup.capture('after_login_onboarding_shown');
    });

    await test.step('When Tôi chọn khu vực tìm việc', async () => {
      await expect(onboardingPopup.locationInput).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_select_location');
      await onboardingPopup.selectLocationButton(onboardingData.location.button); // Sử dụng dữ liệu
      await onboardingPopup.capture('after_select_location');
      await onboardingPopup.selectLocationOption(onboardingData.location.option); // Sử dụng dữ liệu
      await onboardingPopup.capture('after_select_location');
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step2Title);
    });

    await test.step('And Tôi chọn ngành nghề quan tâm', async () => {
      await expect(onboardingPopup.industryDropdown).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_select_industry');
      // Chờ màn hình load xong rồi mới action
      await onboardingPopup.selectIndustry(onboardingData.industry); // Sử dụng dữ liệu
      await onboardingPopup.capture('after_select_industry');
      // Click ra ngoài để đóng dropdown, giúp kịch bản ổn định hơn
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step3Title);
    });

    await test.step('And Tôi nhập công việc mong muốn', async () => {
      await expect(onboardingPopup.jobTitleInput).toBeVisible({ timeout: 15000 });
      await onboardingPopup.capture('before_input_job_title');
      await onboardingPopup.inputJobTitle(onboardingData.jobTitle); // Sử dụng dữ liệu
      await expect(onboardingPopup.selectItem).toBeVisible({ timeout: 10000 });
      await onboardingPopup.capture('after_input_job_title');
      await onboardingPopup.selectSuggestedJobTitle();
      await expect(onboardingPopup.selectItem).toBeHidden({ timeout: 10000 });
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step4Title);
    });

    await test.step('And Tôi chọn mức lương mong muốn', async () => {
      await onboardingPopup.capture('before_select_salary');
      // Chờ màn hình load xong rồi mới action
      const step4Visible = await onboardingPopup.step4Title.isVisible({ timeout: 5000 }).catch(() => false);
      if (!step4Visible) {
        await onboardingPopup.capture('onboarding_modal_already_closed');
        return;
      }
      await onboardingPopup.selectSalary(onboardingData.salary); // Sử dụng dữ liệu
      await onboardingPopup.capture('after_select_salary');
      await onboardingPopup.clickNextAndWaitForNextStep(onboardingPopup.step5Title);
    });

    await test.step('And Tôi chọn số năm kinh nghiệm', async () => {
      await expect(onboardingPopup.step5Title).toBeVisible({ timeout: 15000 });
      // Chờ màn hình load xong rồi mới action
      const step5Visible = await onboardingPopup.step5Title.isVisible({ timeout: 5000 }).catch(() => false);
      if (!step5Visible) {
        await onboardingPopup.capture('onboarding_modal_already_closed');
        return;
      }
      await onboardingPopup.capture('before_select_years');
      await onboardingPopup.selectYears(onboardingData.experience); // Sử dụng dữ liệu
      await expect(onboardingPopup.submitBtn).toBeVisible({ timeout: 15000 }); // Chờ nút submit hiển thị
      await onboardingPopup.capture('after_select_years');
      // Bấm submit và chờ trang điều hướng đến trang tìm kiếm việc làm
      await onboardingPopup.clickSubmit();
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 10000 });
      await onboardingPopup.capture('after_onboarding_completed');
    });
  });
});
