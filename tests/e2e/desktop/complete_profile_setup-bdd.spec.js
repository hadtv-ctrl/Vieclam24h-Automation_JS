const { test, expect } = require('../../../core/fixtures/baseTest');
const profileData = require('../../../data/userProfileData.json');

test.describe('Feature: Hoàn thành hồ sơ với thông tin cá nhân, tiêu chí tìm việc và CV @profile @e2e', () => {

  test('Người dùng cập nhật thông tin cá nhân, tiêu chí tìm việc và tải lên CV', async ({
    authenticatedUser,
    onboardingPopup,
    userProfilePage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    await test.step('Given Người dùng đã truy cập trang chủ và đăng nhập bằng thông tin từ authSetup', async () => {
      // authenticatedUser fixture đã hoàn tất precondition đăng nhập.
    });

    await test.step('And Người dùng thấy popup Onboarding và đóng popup này', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
    });

    await test.step('When Người dùng vào trang Hồ sơ của tôi', async () => {
      await userProfilePage.navigateToMyProfile();
    });

    await test.step('And Người dùng click vào nút Tiêu chí tìm việc', async () => {
      await userProfilePage.capture('when_search_criteria_start', true);
      await userProfilePage.clickSearchCriteria();
    });

    await test.step('And Người dùng chỉnh sửa thông tin cá nhân (tỉnh thành, quận huyện, ngày sinh, giới tính)', async () => {
      await userProfilePage.capture('and_personal_info_start', true);
      await userProfilePage.clickEditPersonalInfo();
      await userProfilePage.capture('and_personal_info_modal_opened');
      await userProfilePage.fillPersonalInfo(profileData.personalInfo);
      await userProfilePage.capture('and_personal_info_filled');
      await userProfilePage.savePersonalInfo();
    });

    await test.step('And Người dùng thêm vị trí công việc mới', async () => {
      await userProfilePage.capture('and_add_job_goal_start', true);
      await userProfilePage.clickAddJobGoal();
    });

    await test.step('And Người dùng điền các tiêu chí tìm việc (kinh nghiệm, số năm, vị trí, ngành, địa điểm, mức lương, cấp bậc, hình thức làm việc)', async () => {
      await userProfilePage.capture('and_job_goal_filling_start');
      await userProfilePage.fillJobGoal(profileData.jobCriteria);
      await userProfilePage.capture('and_job_goal_filled');
      await userProfilePage.saveJobGoal();
    });

    await test.step('And Người dùng bật tính năng cho phép tìm kiếm hồ sơ CV', async () => {
      await userProfilePage.capture('and_cv_search_enable_start', true);
      await userProfilePage.enableCVSearch();
      await userProfilePage.capture('and_cv_search_enabled');
    });

    await test.step('And Người dùng click nút Tiếp tục để xác minh', async () => {
      await userProfilePage.clickContinueButton();
      await userProfilePage.capture('and_continue_clicked');
    });

    await test.step('And Người dùng nhập mã xác minh (4 chữ số)', async () => {
      await userProfilePage.fillVerificationCode('1111');
    });

    await test.step('And Người dùng tải lên file CV từ thư mục data', async () => {
      await userProfilePage.capture('and_cv_upload_start');
      const cvFilePath = 'data/TemplateCV.pdf';
      await userProfilePage.uploadCV(cvFilePath);
    });

    await test.step('Then Người dùng click nút "Cho phép tìm kiếm" để hoàn tất', async () => {
      await userProfilePage.capture('then_allow_search_start');
      await userProfilePage.clickAllowSearch();
      await userProfilePage.waitForGlobalLoadingHidden(30000);
      await userProfilePage.capture('then_profile_setup_complete', true);
    });

  });

});
