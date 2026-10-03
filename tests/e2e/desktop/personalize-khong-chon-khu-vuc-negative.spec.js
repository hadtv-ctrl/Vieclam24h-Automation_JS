const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @personalize @bva @negative @desktop @e2e @REQ-008', () => {
  test('TC-102 - AC-024 Không chọn khu vực làm việc nào và tiếp tục (Giá trị biên dưới - Negative)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc',
    });

    const testPhone = generateRandomVNPhone();

    await test.step('Given Tiền điều kiện: Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);

      await personalizePage.reachOnboardingStep2Locations(testPhone, '1111', 'Hà Đinh');
      await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('step2_empty_locations_ready');
    });

    await test.step('When [1] Để trống, không chọn bất kỳ khu vực làm việc nào', async () => {
      // Để trống, không click chọn bất kỳ tỉnh thành nào
      await personalizePage.capture('no_locations_selected');
    });

    await test.step('Then [1] Nút Tiếp tục bị vô hiệu hóa hoặc khi bấm vào sẽ hiển thị thông báo lỗi yêu cầu chọn ít nhất 1 khu vực', async () => {
      // Kiểm tra nút Tiếp theo: hoặc bị vô hiệu hóa (disabled), hoặc bấm vào không chuyển bước
      const isNextDisabled = await personalizePage.tiepTheoBtn.isDisabled().catch(() => false);
      if (isNextDisabled) {
        expect(isNextDisabled).toBeTruthy();
      } else {
        await personalizePage.actions.click(personalizePage.tiepTheoBtn);
        // Khẳng định hệ thống chặn lại, vẫn ở màn hình Bước 2 (Khu vực làm việc)
        await expect(personalizePage.chonToiDa5Text).toBeVisible({ timeout: 5000 });
        await expect(personalizePage.minSalaryInput).toBeHidden();
      }
      await personalizePage.capture('empty_locations_prevented_successfully');
    });
  });
});
