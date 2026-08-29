const { test } = require('../../../core/fixtures/mobileWebTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');

test.describe('Mobile Feature: Hoàn thành profile mini và ứng tuyển job không cần CV @applyjob @mobile @e2e', () => {
  test('Người dùng mobile hoàn thành tạo profile và ứng tuyển job không cần CV', async ({
    authenticatedUser,
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyNoCVPage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    let jobApplyNoCVPage;

    await test.step('Given Người dùng mobile đã đăng nhập bằng thông tin từ authSetup', async () => {
      // authenticatedUser fixture đã hoàn tất precondition đăng nhập mobile.
    });

    await test.step('And Người dùng mobile đóng onboarding nếu popup hiển thị', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        modalHiddenTimeout: 10000,
      });
    });

    await test.step('When Người dùng mobile mở danh sách việc không cần CV và chi tiết việc làm', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.clickNoCVJobLink();
      await jobSearchPage.expectJobsVisible();

      const jobPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = createJobApplyNoCVPage(jobPage);
      await jobApplyNoCVPage.capture('mobile_job_detail_opened', true);
      await jobApplyNoCVPage.startApplyNoCV({ otpCode: usersData[0]?.otp });
    });

    await test.step('And Người dùng mobile điền và nộp Profile mini', async () => {
      await jobApplyNoCVPage.capture('mobile_profile1_started');
      await jobApplyNoCVPage.fillMiniProfile(applyData.noCVApply.job1);
      await jobApplyNoCVPage.capture('mobile_profile1_filled');
      await jobApplyNoCVPage.submitProfile();
      await jobApplyNoCVPage.capture('mobile_profile1_submitted');
    });

    await test.step('And Người dùng mobile ứng tuyển các công việc được gợi ý', async () => {
      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2);
      if (didBulkApply) {
        await jobApplyNoCVPage.capture('mobile_bulk_apply_completed');
      }
    });

    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển trên mobile', async () => {
      await jobApplyNoCVPage.openAppliedJobs();
      await jobApplyNoCVPage.expectAppliedJobsVisible();
      await jobApplyNoCVPage.capture('mobile_applied_jobs_visible', true);
    });
  });
});
