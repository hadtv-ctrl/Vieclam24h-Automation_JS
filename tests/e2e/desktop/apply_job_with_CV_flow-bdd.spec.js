const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json'); // Giả sử file này tồn tại
const usersData = require('../../../data/users.json');

test.describe('Feature: Ứng tuyển việc làm @applyjob @e2e', () => {
  let jobApplyPage;
  let newPage; // Page của tab chi tiết việc làm

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('Người dùng hoàn thành tạo profile và ứng tuyển thành công', async ({
    authenticatedUser,
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyPage,
  }) => {
    test.setTimeout(360000); // Tăng timeout cho luồng rất dài

    await test.step('Given Tôi đang ở trang chủ sau khi đã đăng nhập', async () => {
      await onboardingPopup.closeIfVisible();
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
      jobApplyPage = createJobApplyPage(newPage);

      await jobApplyPage.capture('after_job_detail_opened');
      await jobApplyPage.startApply({ otpCode: usersData[0]?.otp });
    });

    await test.step('And Tôi chọn phương thức ứng tuyển bằng CV', async () => {
      await jobApplyPage.applyByCV();
    });

    await test.step('And Tôi tải lên file CV từ thư mục data', async () => {
      await jobApplyPage.capture('and_cv_upload_start');
      await jobApplyPage.uploadCV(applyData.cvPath);
    });

    await test.step('And Tôi tiếp tục', async () => {
      await jobApplyPage.capture('before_and_continue');
      await jobApplyPage.continueApplyCV();
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
