const { test, expect } = require('@playwright/test');
const { JobApplyPage } = require('../../pages/JobApplyPage');
const { OnboardingPopup } = require('../../pages/OnboardingPopup');
const { HomePage } = require('../../pages/HomePage');
const { PopupConsent } = require('../../pages/PopupConsent');
const { JobSearchPage } = require('../../pages/JobSearchPage');
const applyData = require('../../data/applyJobData.json');
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
      // await popupConsent.agreeIfVisible();
    });

    await test.step('And Người dùng thấy popup Onboarding và đóng popup này', async () => {
      await onboardingPopup.closeIfVisible('and_onboarding_close_start', {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
    });

    await test.step('When Người dùng mở chi tiết việc làm và bắt đầu ứng tuyển', async () => {
      await jobApplyPage?.capture('when_open_job_detail_start');
      await homePage.openJobSearch();

      jobSearchPage = new JobSearchPage(page);
      const page2Promise = page.waitForEvent('popup');
      await jobSearchPage.firstJobLink.click();
      const newPage = await page2Promise;
      await newPage.waitForLoadState();

      jobApplyPage = new JobApplyPage(newPage);
      await jobApplyPage.startApply();
      await jobApplyPage.applyByProfile();
      await jobApplyPage.continueApply();
    });

    await test.step('And Người dùng điền thông tin Giới thiệu bản thân', async () => {
      await jobApplyPage.capture('and_intro_start');
      await jobApplyPage.clickAddIntroduction();
      await jobApplyPage.capture('and_intro_end');
      await jobApplyPage.fillIntroduction(applyData.intro);
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng điền Kinh nghiệm làm việc', async () => {
      await jobApplyPage.capture('and_experience_start');
      await jobApplyPage.clickAddExperience();
      await jobApplyPage.capture('and_experience_end');
      await jobApplyPage.fillExperience(applyData.experience);
      await jobApplyPage.capture('and_experience_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng điền thông tin Học vấn', async () => {
      await jobApplyPage.capture('and_education_start');
      await jobApplyPage.clickAddEducation();
      await jobApplyPage.capture('and_education_end');
      await jobApplyPage.fillEducation(applyData.education);
      await jobApplyPage.capture('and_education_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng thêm Kỹ năng', async () => {
      await jobApplyPage.capture('and_skill_start');
      await jobApplyPage.clickAddSkill();
      await jobApplyPage.capture('and_skill_end');
      await jobApplyPage.fillSkill(applyData.skill);
      await jobApplyPage.capture('and_skill_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng thêm Thành tựu', async () => {
      await jobApplyPage.capture('and_achievement_start');
      await jobApplyPage.clickAddAchievement();
      await jobApplyPage.capture('and_achievement_end');
      await jobApplyPage.fillAchievement(applyData.achievement);
      await jobApplyPage.capture('and_achievement_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng thêm Chứng chỉ', async () => {
      await jobApplyPage.capture('and_certificate_start');
      await jobApplyPage.clickAddCertificate();
      await jobApplyPage.capture('and_certificate_end');
      await jobApplyPage.fillCertificate(applyData.certificate);
      await jobApplyPage.capture('and_certificate_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('And Người dùng thêm Ngoại ngữ', async () => {
      await jobApplyPage.capture('and_language_start');
      await jobApplyPage.clickAddForeignLanguage();
      await jobApplyPage.capture('and_language_end');
      await jobApplyPage.fillForeignLanguage(applyData.language);
      await jobApplyPage.capture('and_language_filled');
      await jobApplyPage.saveSection();
    });

    await test.step('Then Hồ sơ ứng tuyển được gửi để xác nhận', async () => {
      await jobApplyPage.capture('then_submit_start');
      await jobApplyPage.submitApplication();
    });

    await test.step('And Người dùng xác nhận nộp hồ sơ thành công', async () => {
      await jobApplyPage.capture('and_finish_start');
      await jobApplyPage.confirmAndFinishApplication();
    });

    await test.step('And Người dùng apply tất cả các công việc', async () => {
      await jobApplyPage.bulkApply();
      await jobApplyPage.capture('and_finish_end');
    });
  });

});
