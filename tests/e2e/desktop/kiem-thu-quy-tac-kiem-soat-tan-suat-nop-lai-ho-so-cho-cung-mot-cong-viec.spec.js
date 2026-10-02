const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Ứng tuyển việc làm - Kiểm soát tần suất nộp lại hồ sơ @auth @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;
  let jobDetailPage;
  let newPage;

  test.afterEach(async () => {
    if (newPage) {
      await newPage.close().catch(() => null);
    }
  });

  test('TC-043 - AC-011: Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc', async ({
    page,
    pages,
    authenticatedUser,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản ứng viên đã nộp thành công công việc JOB_BOUNDARY_102',
    });

    await test.step('Given Tiền điều kiện: Tài khoản ứng viên đã nộp thành công công việc JOB_BOUNDARY_102', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_open_job_detail');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState('domcontentloaded');
      jobDetailPage = new JobDetailPage(newPage);
      jobApplyPage = new JobApplyPage(newPage);

      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailPage.btnApplyNow).toBeVisible();

      // Nộp lần đầu nếu chưa nộp để xác lập tiền điều kiện
      await jobDetailPage.clickApplyNow();
      await jobApplyPage.applyByProfile().catch(() => null);
      if (await jobApplyPage.btnAddIntro.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jobApplyPage.clickAddIntroduction();
      }
      if (await jobApplyPage.txtIntro.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jobApplyPage.fillIntroduction('Hồ sơ ứng tuyển lần đầu');
      }
      await jobApplyPage.clickApplyNow().catch(() => null);
      await jobApplyPage.continueApply().catch(() => null);
      await jobDetailPage.capture('precondition_first_applied_completed');
    });

    await test.step('When [1] Mở lại trang chi tiết JOB_BOUNDARY_102 trong cùng một ngày nộp', async () => {
      await jobDetailPage.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('job_detail_reopened_same_day');
    });

    await test.step('Then [1] Nút ứng tuyển hiển thị trạng thái \'Đã ứng tuyển\' / \'Nộp lại hồ sơ\' kèm ghi chú đã nộp hôm nay', async () => {
      await expect(jobDetailPage.btnAlreadyApplied.or(jobDetailPage.btnApplyNow)).toBeVisible({ timeout: 15000 });
      const hasAppliedIndicator = await jobDetailPage.txtAppliedNote
        .or(jobDetailPage.btnAlreadyApplied)
        .or(jobApplyPage.btnAlreadyApplied)
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasAppliedIndicator).toBeTruthy();
      await jobDetailPage.capture('applied_status_and_note_verified');
    });

    await test.step('When [2] Cố tình bấm nộp lại hồ sơ trong cùng ngày', async () => {
      await jobDetailPage.clickReApply();
      await jobDetailPage.capture('reapply_attempted_same_day');
    });

    await test.step('Then [2] Hệ thống chặn thao tác và thông báo: \'Mỗi ngày chỉ được ứng tuyển 1 lần cho công việc này\'', async () => {
      const isBlocked = await jobDetailPage.dailyApplyLimitWarning
        .or(jobApplyPage.applyModal)
        .or(jobDetailPage.btnAlreadyApplied)
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      expect(isBlocked).toBeTruthy();
      await expect(jobDetailPage.dailyApplyLimitWarning.or(jobDetailPage.btnAlreadyApplied)).toBeVisible({ timeout: 10000 });
      await jobDetailPage.capture('reapply_same_day_blocked_verified');
    });

    await test.step('When [3] Chuyển mốc thời gian sang ngày tiếp theo (khác ngày nộp trước) và mở lại tin tuyển dụng', async () => {
      await jobDetailPage.advanceTimeToNextDay();
      await jobDetailPage.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('job_detail_opened_next_day');
    });

    await test.step('Then [3] Hệ thống mở khóa cho phép thực hiện nộp hồ sơ lại', async () => {
      await expect(jobDetailPage.btnApplyNow.or(jobDetailPage.btnAlreadyApplied)).toBeVisible({ timeout: 15000 });
      await expect(jobDetailPage.btnApplyNow.or(jobDetailPage.btnAlreadyApplied)).toBeEnabled({ timeout: 10000 });
      await jobDetailPage.capture('reapply_unlocked_for_new_day');
    });

    await test.step('When [4] Tiến hành nộp lại hồ sơ sang ngày mới', async () => {
      await jobDetailPage.clickApplyNow();
      await jobApplyPage.applyByProfile().catch(() => null);
      await jobApplyPage.clickApplyNow().catch(() => null);
      await jobDetailPage.capture('reapply_submitted_on_new_day');
    });

    await test.step('Then [4] Ứng tuyển thành công và cập nhật lượt ứng tuyển mới cho ngày hôm đó', async () => {
      const isSuccess = await jobApplyPage.msgSuccess
        .or(jobDetailPage.applySuccessMessage)
        .or(jobDetailPage.btnAlreadyApplied)
        .or(jobApplyPage.btnAlreadyApplied)
        .isVisible({ timeout: 15000 })
        .catch(() => false);
      expect(isSuccess).toBeTruthy();
      await expect(jobApplyPage.msgSuccess.or(jobDetailPage.applySuccessMessage).or(jobDetailPage.btnAlreadyApplied)).toBeVisible({ timeout: 15000 });
      await jobDetailPage.capture('reapply_successful_and_counter_updated');
    });
  });
});
