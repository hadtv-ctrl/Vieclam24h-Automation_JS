const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');

test.describe('Mobile Feature: Ứng tuyển việc làm bằng Profile trực tuyến trên Mobile Web @applyjob @mobile @e2e', () => {
  let jobApplyPage;
  let newPage;

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('Người dùng mobile hoàn thành tạo profile và ứng tuyển thành công', async ({
    authenticatedUser,
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyPage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và sẵn sàng tại trang chủ', async () => {
      await onboardingPopup.closeIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_mobile_homepage_loaded');
    });

    await test.step('When Tôi mở việc làm chi tiết trên mobile và bấm "Ứng tuyển ngay"', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_mobile_click_first_job');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState();
      jobApplyPage = createJobApplyPage(newPage);

      await jobApplyPage.capture('after_mobile_job_detail_opened');
      await jobApplyPage.startApply({ otpCode: usersData[0]?.otp });
      await jobApplyPage.applyByProfile();
      await jobApplyPage.continueApply();
      await jobApplyPage.capture('after_mobile_continue_to_profile_form');
    });

    await test.step('And Tôi điền thông tin Giới thiệu bản thân trên mobile', async () => {
      await jobApplyPage.clickAddIntroduction();
      await jobApplyPage.fillIntroduction(applyData.intro);
      await jobApplyPage.capture('before_mobile_save_introduction');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_introduction');
    });

    await test.step('And Tôi điền Kinh nghiệm làm việc trên mobile', async () => {
      await jobApplyPage.clickAddExperience();
      await jobApplyPage.fillExperience(applyData.experience);
      await jobApplyPage.capture('before_mobile_save_experience');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_experience');
    });

    await test.step('And Tôi điền thông tin Học vấn trên mobile', async () => {
      await jobApplyPage.clickAddEducation();
      await jobApplyPage.fillEducation(applyData.education);
      await jobApplyPage.capture('before_mobile_save_education');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_education');
    });

    await test.step('And Tôi thêm Kỹ năng trên mobile', async () => {
      await jobApplyPage.clickAddSkill();
      await jobApplyPage.fillSkill(applyData.skill);
      await jobApplyPage.capture('before_mobile_save_skill');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_skill');
    });

    await test.step('And Tôi thêm Thành tựu trên mobile', async () => {
      await jobApplyPage.clickAddAchievement();
      await jobApplyPage.fillAchievement(applyData.achievement);
      await jobApplyPage.capture('before_mobile_save_achievement');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_achievement');
    });

    await test.step('And Tôi thêm Chứng chỉ trên mobile', async () => {
      await jobApplyPage.clickAddCertificate();
      await jobApplyPage.fillCertificate(applyData.certificate);
      await jobApplyPage.capture('before_mobile_save_certificate');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_certificate');
    });

    await test.step('And Tôi thêm Ngoại ngữ trên mobile', async () => {
      await jobApplyPage.clickAddForeignLanguage();
      await jobApplyPage.fillForeignLanguage(applyData.language);
      await jobApplyPage.capture('before_mobile_save_language');
      await jobApplyPage.saveSection();
      await jobApplyPage.capture('after_mobile_save_language');
    });

    await test.step('Then Tôi xác nhận nộp hồ sơ và thấy thông báo thành công trên mobile', async () => {
      await jobApplyPage.submitApplication();
      await jobApplyPage.capture('after_mobile_submit_application');
      await jobApplyPage.confirmAndFinishApplication();
      await expect(jobApplyPage.msgSuccess).toBeVisible({ timeout: 15000 });
    });

    await test.step('Then Tôi click bulk apply trên mobile', async () => {
      await jobApplyPage.bulkApply();
      await jobApplyPage.capture('after_mobile_bulk_apply', true);
    });

    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển trên mobile', async () => {
      await jobApplyPage.openAppliedJobs();
      await jobApplyPage.expectAppliedJobsVisible();
      await jobApplyPage.capture('mobile_applied_jobs_list_visible', true);
    });
  });
});
