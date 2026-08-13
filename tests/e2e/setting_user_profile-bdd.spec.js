const { test, expect } = require('@playwright/test');
const { JobApplyPage } = require('../../pages/JobApplyPage');
const { OnboardingPopup } = require('../../pages/OnboardingPopup');
const { HomePage } = require('../../pages/HomePage');
const { PopupConsent } = require('../../pages/PopupConsent');
const { JobSearchPage } = require('../../pages/JobSearchPage');
const { UserProfilePage } = require('../../pages/UserProfilePage');
const applyData = require('../../data/userProfileData.json');
const { loginUserFromDataForPrecondition } = require('../../core/utils/authSetup');

test.describe('Feature: Hoàn thành profile và ứng tuyển job @applyjob', () => {

  test('Người dùng hoàn thành tạo profile và ứng tuyển', async ({ page }) => {
    test.slow();
    test.setTimeout(600000);

    let jobApplyPage;
    const onboardingPopup = new OnboardingPopup(page);
    const homePage = new HomePage(page);
    let jobSearchPage;
    const popupConsent = new PopupConsent(page);

    await test.step('Given Người dùng đã truy cập trang chủ và đăng nhập bằng thông tin từ authSetup', async () => {
      await loginUserFromDataForPrecondition(page);
    });

    await test.step('And Người dùng thấy popup Onboarding và đóng popup này', async () => {
      await onboardingPopup.closeIfVisible('and_onboarding_close_start', {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
    });

    let userProfilePage;

    await test.step('When Người dùng vào trang Hồ sơ của tôi', async () => {
      userProfilePage = new UserProfilePage(page);
      await userProfilePage.navigateToMyProfile();
    });

    await test.step('And Người dùng thêm kinh nghiệm làm việc', async () => {
      await userProfilePage.capture('and_experience_start', true);
      await userProfilePage.clickAddExperience();
      await userProfilePage.capture('and_experience_end');
      await userProfilePage.fillExperience(applyData.experience);
      await userProfilePage.capture('and_experience_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng điền thông tin Giới thiệu bản thân', async () => {
      await userProfilePage.capture('and_intro_start', true);
      await userProfilePage.clickAddIntroduction();
      await userProfilePage.capture('and_intro_end');
      await userProfilePage.fillIntroduction(applyData.intro);
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng điền thông tin Học vấn', async () => {
      await userProfilePage.capture('and_education_start', true);
      await userProfilePage.clickAddEducation();
      await userProfilePage.capture('and_education_end');
      await userProfilePage.fillEducation(applyData.education);
      await userProfilePage.capture('and_education_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng thêm Thành tựu', async () => {
      await userProfilePage.capture('and_achievement_start', true);
      await userProfilePage.clickAddAchievement();
      await userProfilePage.capture('and_achievement_end');
      await userProfilePage.fillAchievement(applyData.achievement);
      await userProfilePage.capture('and_achievement_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng thêm Kỹ năng', async () => {
      await userProfilePage.capture('and_skill_start', true);
      await userProfilePage.clickAddSkill();
      await userProfilePage.capture('and_skill_end');
      await userProfilePage.fillSkill(applyData.skill);
      await userProfilePage.capture('and_skill_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng thêm Chứng chỉ', async () => {
      await userProfilePage.capture('and_certificate_start', true);
      await userProfilePage.clickAddCertificate();
      await userProfilePage.capture('and_certificate_end');
      await userProfilePage.fillCertificate(applyData.certificate);
      await userProfilePage.capture('and_certificate_filled');
      await userProfilePage.saveSection();
    });

    await test.step('And Người dùng thêm Ngoại ngữ', async () => {
      await userProfilePage.capture('and_language_start', true);
      await userProfilePage.clickAddForeignLanguage();
      await userProfilePage.capture('and_language_end');
      await userProfilePage.fillForeignLanguage(applyData.language.language, applyData.language.level);
      await userProfilePage.capture('and_language_filled');
      await userProfilePage.saveSection();
      await userProfilePage.capture('and_language_saved', true);
    });
  });

});