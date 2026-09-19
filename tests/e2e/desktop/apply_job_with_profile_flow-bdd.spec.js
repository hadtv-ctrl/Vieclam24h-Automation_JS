const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');

test.describe('Feature: Ứng tuyển việc làm @applyjob @desktop @e2e', () => {
  let jobApplyPage;
  let newPage; // Page của tab chi tiết việc làm

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('Người dùng hoàn thành tạo profile và ứng tuyển thành công', async ({
    page,
    authenticatedUser,
    pages,
  }) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(600000); // Luồng điền nhiều section và capture evidence

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('When Tôi mở một việc làm chi tiết và bấm "Ứng tuyển ngay"', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_click_first_job');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState();
      jobApplyPage = new JobApplyPage(newPage);

      await jobApplyPage.capture('after_job_detail_opened');
      await jobApplyPage.startApply({ otpCode: usersData[0]?.otp });
      await jobApplyPage.capture('after_start_apply');
      await jobApplyPage.applyByProfile();
      await jobApplyPage.capture('after_apply_by_profile');
      await jobApplyPage.continueApply();
      await jobApplyPage.capture('after_continue_to_profile_form');
    });

    await test.step('And Tôi điền thông tin Giới thiệu bản thân', async () => {
      await jobApplyPage.clickAddIntroduction();
      await jobApplyPage.capture('before_fill_introduction');
      await jobApplyPage.fillIntroduction(applyData.intro);
      await jobApplyPage.capture('before_save_introduction');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_introduction');
    });

    await test.step('And Tôi điền Kinh nghiệm làm việc', async () => {
      await jobApplyPage.clickAddExperience();
      await jobApplyPage.capture('before_fill_experience');
      await jobApplyPage.fillExperience(applyData.experience);
      await jobApplyPage.capture('before_save_experience');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_experience');
    });

    await test.step('And Tôi điền thông tin Học vấn', async () => {
      await jobApplyPage.clickAddEducation();
      await jobApplyPage.capture('before_fill_education');
      await jobApplyPage.fillEducation(applyData.education);
      await jobApplyPage.capture('before_save_education');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_education');
    });

    await test.step('And Tôi thêm Kỹ năng', async () => {
      await jobApplyPage.clickAddSkill();
      await jobApplyPage.capture('before_fill_skill');
      await jobApplyPage.fillSkill(applyData.skill);
      await jobApplyPage.capture('before_save_skill');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_skill');
    });

    await test.step('And Tôi thêm Thành tựu', async () => {
      await jobApplyPage.clickAddAchievement();
      await jobApplyPage.capture('before_fill_achievement');
      await jobApplyPage.fillAchievement(applyData.achievement);
      await jobApplyPage.capture('before_save_achievement');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_achievement');
    });

    await test.step('And Tôi thêm Chứng chỉ', async () => {
      await jobApplyPage.clickAddCertificate();
      await jobApplyPage.capture('before_fill_certificate');
      await jobApplyPage.fillCertificate(applyData.certificate);
      await jobApplyPage.capture('before_save_certificate');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_certificate');
    });

    await test.step('And Tôi thêm Ngoại ngữ', async () => {
      await jobApplyPage.clickAddForeignLanguage();
      await jobApplyPage.capture('before_fill_language');
      await jobApplyPage.fillForeignLanguage(applyData.language);
      await jobApplyPage.capture('before_save_language');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_save_language');
    });

    await test.step('Then Tôi xác nhận nộp hồ sơ và thấy thông báo thành công', async () => {
      await jobApplyPage.submitApplication();
      await jobApplyPage.capture('after_submit_application');
      await jobApplyPage.confirmAndFinishApplication();
      await expect(jobApplyPage.msgSuccess).toBeVisible({ timeout: 15000 });
    });

    await test.step('Then Tôi click bulk apply', async () => {
      await jobApplyPage.bulkApply();
      await jobApplyPage.capture('after_bulk_apply', true);
    });

    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển', async () => {
      await jobApplyPage.openAppliedJobs();
      await jobApplyPage.expectAppliedJobsVisible();
      await jobApplyPage.capture('applied_jobs_list_visible', true);
    });
  });
});
