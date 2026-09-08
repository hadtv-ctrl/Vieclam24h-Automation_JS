const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const profileData = require('../../../data/userProfileData.json');

test.describe('Mobile Feature: Hoàn thành hồ sơ với thông tin cá nhân, tiêu chí tìm việc và CV trên Mobile Web @profile @mobile @e2e', () => {
  test('Người dùng mobile cập nhật thông tin cá nhân, tiêu chí tìm việc và tải lên CV', async ({
    authenticatedUser,
    homePage,
    onboardingPopup,
    userProfilePage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và sẵn sàng tại trang chủ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_mobile_logged_in_state');
    });

    await test.step('And Người dùng mobile đảm bảo các modal chặn màn hình đã được đóng', async () => {
      await homePage.closeBlockingModalIfVisible();
    });

    await test.step('When Người dùng mobile vào trang Hồ sơ của tôi', async () => {
      await userProfilePage.navigateToMyProfile();
    });

    await test.step('And Người dùng mobile click vào nút Tiêu chí tìm việc', async () => {
      await userProfilePage.capture('when_mobile_search_criteria_start', true);
      await userProfilePage.clickSearchCriteria();
    });

    await test.step('And Người dùng mobile chỉnh sửa thông tin cá nhân', async () => {
      await userProfilePage.clickEditPersonalInfo();
      await userProfilePage.fillPersonalInfo(profileData.personalInfo);
      await userProfilePage.capture('and_mobile_personal_info_filled');
      await userProfilePage.savePersonalInfo();
    });

    await test.step('And Người dùng mobile thêm vị trí công việc mới', async () => {
      await userProfilePage.capture('and_mobile_add_job_goal_start', true);
      await userProfilePage.clickAddJobGoal();
    });

    await test.step('And Người dùng mobile điền các tiêu chí tìm việc', async () => {
      await userProfilePage.capture('and_mobile_job_goal_filling_start');
      await userProfilePage.fillJobGoal(profileData.jobCriteria);
      await userProfilePage.capture('and_mobile_job_goal_filled');
      await userProfilePage.saveJobGoal();
    });

    await test.step('And Người dùng mobile bật tính năng cho phép tìm kiếm hồ sơ CV', async () => {
      await userProfilePage.capture('and_mobile_cv_search_enable_start', true);
      await userProfilePage.enableCVSearch();
      await userProfilePage.capture('and_mobile_cv_search_enabled');
    });

    await test.step('And Người dùng mobile click nút Tiếp tục để xác minh', async () => {
      await userProfilePage.clickContinueButton();
      await userProfilePage.capture('and_mobile_continue_clicked');
    });

    await test.step('And Người dùng mobile nhập mã xác minh (4 chữ số)', async () => {
      await userProfilePage.fillVerificationCode('1111');
    });

    await test.step('And Người dùng mobile tải lên file CV từ thư mục data', async () => {
      await userProfilePage.capture('and_mobile_cv_upload_start');
      const cvFilePath = 'data/TemplateCV.pdf';
      await userProfilePage.uploadCV(cvFilePath);
    });

    await test.step('Then Người dùng mobile click nút "Cho phép tìm kiếm" để hoàn tất', async () => {
      await userProfilePage.capture('then_mobile_allow_search_start');
      await userProfilePage.clickAllowSearch();
      await userProfilePage.waitForGlobalLoadingHidden(30000);
      await userProfilePage.capture('then_mobile_profile_setup_complete', true);
    });
  });
});
