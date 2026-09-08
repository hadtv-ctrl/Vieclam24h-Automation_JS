const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const applyData = require('../../../data/userProfileData.json');

test.describe('Mobile Feature: Cập nhật chi tiết hồ sơ cá nhân trên Mobile Web @profile @mobile @e2e', () => {
  test('Người dùng mobile hoàn thành các mục trong hồ sơ cá nhân', async ({
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

    await test.step('And Người dùng mobile thêm kinh nghiệm làm việc', async () => {
      await userProfilePage.clickAddExperience();
      await userProfilePage.fillExperience(applyData.experience);
      await userProfilePage.capture('and_mobile_experience_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile điền thông tin Giới thiệu bản thân', async () => {
      await userProfilePage.clickAddIntroduction();
      await userProfilePage.fillIntroduction(applyData.intro);
      await userProfilePage.capture('and_mobile_intro_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile điền thông tin Học vấn', async () => {
      await userProfilePage.clickAddEducation();
      await userProfilePage.fillEducation(applyData.education);
      await userProfilePage.capture('and_mobile_education_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile thêm Thành tựu', async () => {
      await userProfilePage.clickAddAchievement();
      await userProfilePage.fillAchievement(applyData.achievement);
      await userProfilePage.capture('and_mobile_achievement_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile thêm Kỹ năng', async () => {
      await userProfilePage.clickAddSkill();
      await userProfilePage.fillSkill(applyData.skill);
      await userProfilePage.capture('and_mobile_skill_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile thêm Chứng chỉ', async () => {
      await userProfilePage.clickAddCertificate();
      await userProfilePage.fillCertificate(applyData.certificate);
      await userProfilePage.capture('and_mobile_certificate_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng mobile thêm Ngoại ngữ', async () => {
      await userProfilePage.clickAddForeignLanguage();
      await userProfilePage.fillForeignLanguage(applyData.language.language, applyData.language.level);
      await userProfilePage.capture('and_mobile_language_filled');
      await userProfilePage.saveSection();
      await userProfilePage.capture('and_mobile_language_saved', true);
    });
  });
});
