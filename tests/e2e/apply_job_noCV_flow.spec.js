const { test } = require('@playwright/test');
const { JobApplyNoCVPage } = require('../../pages/JobApplyNoCVPage');
const { HomePage } = require('../../pages/HomePage');
const { OnboardingPopup } = require('../../pages/OnboardingPopup');
const applyData = require('../../data/applyJobData.json');
const usersData = require('../../data/users.json');
const { loginUserFromDataForPrecondition } = require('../../core/utils/authSetup');

test.describe('Feature: Hoàn thành profile mini và ứng tuyển job không cần CV @applyjob @e2e', () => {

  test('Người dùng hoàn thành tạo profile và ứng tuyển job không cần CV', async ({ page }) => {
    test.slow();
    test.setTimeout(600000);

    let jobApplyNoCVPage;
    const onboardingPopup = new OnboardingPopup(page);
    const homePage = new HomePage(page);

    await test.step('Given Người dùng đã truy cập trang chủ và đăng nhập bằng thông tin từ authSetup', async () => {
      await loginUserFromDataForPrecondition(page);
    });

    await test.step('And Người dùng thấy popup Onboarding và đóng popup này', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
    });

    await test.step('When Người dùng chọn Xem việc không cần CV và mở chi tiết việc làm', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.clickNoCVJobLink();
      const { JobSearchPage } = require('../../pages/JobSearchPage');
      const jobSearchPage = new JobSearchPage(page);

      // Wait for the job list to appear instead of hard sleep
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });

      const newPage = await jobSearchPage.clickFirstJob();

      jobApplyNoCVPage = new JobApplyNoCVPage(newPage);
      await jobApplyNoCVPage.capture('job_detail_opened', true);
      await jobApplyNoCVPage.startApplyNoCV({ otpCode: usersData[0]?.otp });
    });

    await test.step('And Người dùng điền thông tin Profile mini cho Job đầu tiên', async () => {
      await jobApplyNoCVPage.capture('and_profile1_start');
      await jobApplyNoCVPage.fillMiniProfile(applyData.noCVApply.job1);
      await jobApplyNoCVPage.capture('and_profile1_end');
      await jobApplyNoCVPage.submitProfile();
      await jobApplyNoCVPage.capture('and_profile1_submitted');
    });

    await test.step('And Người dùng apply tất cả các công việc', async () => {
      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2);
      if (didBulkApply) {
        await jobApplyNoCVPage.capture('and_finish_end');
      }
    });

    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển', async () => {
      await jobApplyNoCVPage.openAppliedJobs();
      await jobApplyNoCVPage.expectAppliedJobsVisible();
      await jobApplyNoCVPage.capture('applied_jobs_list_visible', true);
    });
  });
});
