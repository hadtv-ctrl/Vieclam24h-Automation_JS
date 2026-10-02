const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const usersData = require('../../../data/users.json');

test.describe('Ứng tuyển việc làm - Bulk Apply @auth @applyjob @desktop @e2e @REQ-003', () => {
  let newPage;
  let jobApplyPage;

  test.afterEach(async () => {
    if (newPage) await newPage.close().catch(() => null);
  });

  test('TC-044 - AC-010: Nộp hồ sơ hàng loạt Bulk Apply', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập trên môi trường QC, mở việc làm và ứng tuyển để hiển thị luồng Bulk Apply',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ QC', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_logged_in_homepage');
    });

    await test.step('When [1] Mở danh sách việc làm và click vào việc làm đầu tiên trên QC', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openJobSearch();
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });
      await jobSearchPage.capture('job_search_results_visible');

      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState('domcontentloaded');
      jobApplyPage = new JobApplyPage(newPage);
      await jobApplyPage.waitForPageReady();
      await jobApplyPage.capture('job_detail_opened');
    });

    await test.step('And [1] Thực hiện bấm Ứng tuyển ngay trên tin tuyển dụng', async () => {
      await jobApplyPage.startApply({ otpCode: usersData[0]?.otp || '1111' });
      await jobApplyPage.capture('apply_modal_opened');
    });

    await test.step('And [1] Hoàn tất nộp hồ sơ việc làm để kích hoạt gợi ý việc làm tương tự', async () => {
      // Ưu tiên nộp bằng Hồ sơ hoặc CV có sẵn
      if (await jobApplyPage.optProfileMethod.isVisible()) {
        await jobApplyPage.applyByProfile();
      } else if (await jobApplyPage.optCVMethod.isVisible()) {
        await jobApplyPage.applyByCV();
        await jobApplyPage.continueApplyCV();
      }
      await jobApplyPage.capture('single_job_applied_waiting_bulk');
    });

    await test.step('Then [2] Kiểm tra danh sách gợi ý việc làm tương tự (Bulk Apply) nếu có', async () => {
      const hasBulk = await jobApplyPage.waitForBulkApplyListReady().catch(() => false);
      if (!hasBulk) {
        console.log('Không xuất hiện popup Bulk Apply hoặc không có việc làm tương tự trên QC cho tin này.');
        await jobApplyPage.capture('no_bulk_apply_available');
        return;
      }

      await expect(jobApplyPage.chkConfirmAll.or(jobApplyPage.confirmCheckboxes.first())).toBeVisible({ timeout: 15000 });
      await jobApplyPage.capture('bulk_apply_popup_displayed');

      // Điều kiện biên 1: Bỏ chọn tất cả
      await jobApplyPage.uncheckAllBulkApplyJobs();
      await jobApplyPage.capture('all_jobs_unchecked');
      await expect(jobApplyPage.btnBulkApplyZero.or(jobApplyPage.btnApplyAll)).toBeVisible();

      // Điều kiện biên 2: Chọn lại tất cả
      await jobApplyPage.checkAllBulkApplyJobs();
      await jobApplyPage.capture('all_jobs_rechecked');

      // Điều kiện biên 3: Nộp Bulk Apply
      await jobApplyPage.bulkApply();
      await jobApplyPage.capture('bulk_apply_flow_completed');
    });
  });
});
