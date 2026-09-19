const path = require('path');
const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');

test.describe('Feature: Ứng tuyển việc làm @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;
  let newPage; // Page của tab chi tiết việc làm

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('TC-009 - AC-008 Ứng tuyển việc làm bằng file CV tải lên', async ({
    page,
    authenticatedUser,
    pages,
  }) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(600000); // Tăng timeout cho luồng rất dài

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
