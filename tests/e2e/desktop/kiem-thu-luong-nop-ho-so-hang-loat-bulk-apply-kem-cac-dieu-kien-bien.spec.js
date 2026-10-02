const { test, expect } = require('../../../core/fixtures/baseTest');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');

test.describe('Feature: Ứng tuyển việc làm - Nộp hồ sơ hàng loạt @guest @no-auth @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;

  test('TC-044 - AC-010: Kiểm thử luồng nộp hồ sơ hàng loạt (Bulk Apply) kèm các điều kiện biên', async ({
    page,
  }, testInfo) => {
    jobApplyPage = new JobApplyPage(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Vừa ứng tuyển thành công 1 việc làm, popup gợi ý danh sách việc làm tương tự (5 công việc) hiển thị',
    });

    await test.step('Given Tiền điều kiện: Vừa ứng tuyển thành công 1 việc làm, popup gợi ý danh sách việc làm tương tự (5 công việc) hiển thị', async () => {
      await jobApplyPage.setupBulkApplyPrecondition();
      await expect(jobApplyPage.applyModal).toBeVisible({ timeout: 15000 });
      await expect(jobApplyPage.confirmCheckboxes).toHaveCount(5);
      await expect(jobApplyPage.btnApplyAll).toBeVisible();
      await jobApplyPage.capture('precondition_bulk_apply_popup_displayed');
    });

    await test.step('When [1] Bỏ chọn tất cả checkbox việc làm trong danh sách gợi ý', async () => {
      await jobApplyPage.uncheckAllBulkApplyJobs();
      await jobApplyPage.capture('all_jobs_unchecked');
    });

    await test.step('Then [1] Nút \'Nộp hồ sơ hàng loạt\' bị vô hiệu hóa hoặc báo lỗi yêu cầu chọn ít nhất 1 việc', async () => {
      await expect(jobApplyPage.btnBulkApplyZero).toBeVisible({ timeout: 5000 });
      await expect(jobApplyPage.btnBulkApplyZero).toBeDisabled();
      await jobApplyPage.capture('bulk_apply_disabled_when_zero_selected');
    });

    await test.step('When [2] Chọn lại tất cả 5 việc làm (bao gồm việc đã từng nộp trong ngày)', async () => {
      await jobApplyPage.checkAllBulkApplyJobs();
      await jobApplyPage.capture('all_5_jobs_rechecked');
    });

    await test.step('Then [2] Hệ thống tự động nhận diện hoặc đánh dấu việc đã nộp trong ngày', async () => {
      await expect(jobApplyPage.appliedTodayBadge).toBeVisible({ timeout: 5000 });
      await expect(jobApplyPage.btnApplyAll).toBeVisible();
      await jobApplyPage.capture('already_applied_job_marked_in_list');
    });

    await test.step('When [3] Nhấn \'Nộp hồ sơ hàng loạt\'', async () => {
      await jobApplyPage.clickBulkApplySubmit();
      await jobApplyPage.capture('bulk_apply_submitted');
    });

    await test.step('Then [3] Hệ thống xử lý nộp cho các việc hợp lệ, bỏ qua việc đã nộp và hiển thị báo cáo chi tiết', async () => {
      await expect(jobApplyPage.msgBulkApplySuccess).toBeVisible({ timeout: 10000 });
      await expect(jobApplyPage.btnSeeMoreJobs).toBeVisible();
      await jobApplyPage.capture('bulk_apply_completed_and_reported');
    });
  });
});
