const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');

test.describe('Mobile Feature: Ứng tuyển việc làm bằng CV trên Mobile Web @applyjob @mobile @e2e', () => {
  let jobApplyPage;
  let newPage;

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('Người dùng mobile hoàn thành tạo profile và ứng tuyển bằng CV thành công', async ({
    authenticatedUser,
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyPage,
  }) => {
    test.slow();
    test.setTimeout(480000);

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
    });

    await test.step('And Tôi chọn phương thức ứng tuyển bằng CV trên mobile', async () => {
      await jobApplyPage.applyByCV();
    });

    await test.step('And Tôi tải lên file CV từ thư mục data', async () => {
      await jobApplyPage.capture('and_mobile_cv_upload_start');
      await jobApplyPage.uploadCV(applyData.cvPath);
    });

    await test.step('And Tôi tiếp tục ứng tuyển', async () => {
      await jobApplyPage.capture('before_mobile_and_continue');
      await jobApplyPage.continueApplyCV();
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
