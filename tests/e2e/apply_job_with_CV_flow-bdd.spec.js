const path = require('path');
const { test, expect } = require('@playwright/test');
const { JobApplyPage } = require('../../pages/JobApplyPage');
const { HomePage } = require('../../pages/HomePage');
const { JobSearchPage } = require('../../pages/JobSearchPage');
const { OnboardingPopup } = require('../../pages/OnboardingPopup');
const applyData = require('../../data/applyJobData.json'); // Giả sử file này tồn tại
const usersData = require('../../data/users.json');
const { loginUserFromDataForPrecondition } = require('../../core/utils/authSetup');

test.describe('Feature: Ứng tuyển việc làm @applyjob @e2e', () => {
  let page;
  let homePage;
  let jobApplyPage;
  let jobSearchPage;
  let newPage; // Page của tab chi tiết việc làm

  test.beforeEach(async ({ page: testPage }, testInfo) => {
    page = testPage;
    const specName = path.basename(testInfo.file, path.extname(testInfo.file));
    homePage = new HomePage(page, specName);
    jobSearchPage = new JobSearchPage(page, specName);
  });

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('Người dùng hoàn thành tạo profile và ứng tuyển thành công', async () => {
    test.setTimeout(360000); // Tăng timeout cho luồng rất dài

    await test.step('Given Tôi đang ở trang chủ sau khi đã đăng nhập', async () => {
      await loginUserFromDataForPrecondition(page);
      await new OnboardingPopup(page).closeIfVisible();
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
      const specName = path.basename(test.info().file, path.extname(test.info().file));
      jobApplyPage = new JobApplyPage(newPage, specName);

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
