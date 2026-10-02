const { test, expect } = require('../../../core/fixtures/baseTest');
const { UserProfilePage } = require('../../../pages/desktop/UserProfilePage');

test.describe('Feature: Quản lý hồ sơ cá nhân - Tính hoàn thiện, chuyển đổi CV và đồng bộ tiêu chí @auth @profile @desktop @e2e @REQ-005', () => {
  let userProfilePage;

  test('TC-046 - AC-015 AC-016 AC-019: Kiểm thử tính hoàn thiện hồ sơ, logic chuyển đổi CV và đồng bộ hai chiều với Onboarding', async ({
    page,
  }, testInfo) => {
    userProfilePage = new UserProfilePage(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập, đang ở trang Hồ sơ của tôi',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập, đang ở trang Hồ sơ của tôi', async () => {
      await userProfilePage.setupProfileCompletionPrecondition();
      await expect(userProfilePage.profileStatusBadge).toBeVisible({ timeout: 15000 });
      await userProfilePage.capture('precondition_my_profile_loaded');
    });

    await test.step('When [1] Điền đủ 6 mục hồ sơ nhưng bỏ trống mục \'Thông tin cá nhân\'', async () => {
      // 6 profile sections (Education, Experience, Skills, Language, Certificate, Achievement) are loaded without personal info
      await expect(userProfilePage.profileStatusBadge).toBeVisible();
      await userProfilePage.capture('profile_six_sections_filled_personal_info_missing');
    });

    await test.step('Then [1] Hồ sơ ở trạng thái \'Chưa hoàn thiện\', khóa tính năng bật tìm kiếm hồ sơ', async () => {
      await expect(userProfilePage.profileStatusBadge).toHaveText('Chưa hoàn thiện');
      await expect(userProfilePage.cvSearchLocked).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.cvSearchSwitch).toBeDisabled();
      await userProfilePage.capture('profile_incomplete_search_locked');
    });

    await test.step('When [2] Nhập và lưu mục \'Thông tin cá nhân\'', async () => {
      await userProfilePage.fillAndSavePersonalInfoModal({
        fullName: 'Nguyễn Văn Test',
        phone: '0901234567',
        email: 'user_tc046@example.com',
        address: 'Quận 1, TP.HCM',
      });
      await userProfilePage.capture('personal_info_filled_and_saved');
    });

    await test.step('Then [2] Trạng thái hồ sơ được công nhận là \'Hoàn thiện\' thành công', async () => {
      await expect(userProfilePage.profileStatusBadge).toHaveText('Hoàn thiện');
      await expect(userProfilePage.cvSearchSwitch).toBeEnabled();
      await userProfilePage.capture('profile_status_completed');
    });

    await test.step('When [3] Tải lên file CV mới và kích hoạt tính năng \'Chuyển đổi CV thành hồ sơ\'', async () => {
      await userProfilePage.triggerCVConversion();
      await userProfilePage.capture('cv_conversion_triggered');
    });

    await test.step('Then [3] Trường Kỹ năng đã có bị ghi đè, trường Kinh nghiệm làm việc mới được bổ sung', async () => {
      await expect(userProfilePage.skillPython).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.skillReact).toBeVisible();
      await expect(userProfilePage.skillJavaScript).toBeHidden();
      await expect(userProfilePage.expSeniorDev).toBeVisible();
      await userProfilePage.capture('cv_data_overwritten_and_added');
    });

    await test.step('When [4] Cập nhật tiêu chí tìm việc mới tại trang Hồ sơ và kiểm tra lại luồng gợi ý', async () => {
      await userProfilePage.triggerUpdateJobCriteria();
      await userProfilePage.capture('job_criteria_updated_in_profile');
    });

    await test.step('Then [4] Dữ liệu tiêu chí tìm việc được đồng bộ hai chiều chính xác 100%', async () => {
      await expect(userProfilePage.criteriaLocationValue).toHaveText('TP.HCM');
      await expect(userProfilePage.criteriaIndustryValue).toHaveText('Marketing');
      await expect(userProfilePage.criteriaSyncStatus).toContainText('100%');
      await userProfilePage.capture('criteria_two_way_sync_verified');
    });
  });
});
