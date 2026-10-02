const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

class JobDetailPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [specName]
   */
  constructor(page, specName) {
    super(page, specName);

    // Tiêu đề việc làm
    this.jobTitleHeading = page.getByRole('heading', { level: 1 })
      .or(page.locator('h1, .job-detail__title, [class*="job-title" i], [class*="job_title" i]'))
      .first();

    // Thông tin công ty & mức lương
    this.companyName = page.locator('.job-detail__company, [data-test-id="company-name"]').first();
    this.salaryInfo = page.locator('.job-detail__salary, [data-test-id="job-salary"]').first();

    // Nút hành động
    this.btnApplyNow = page.getByRole('button', { name: /Ứng tuyển ngay|Nộp lại hồ sơ/i })
      .or(page.locator('button:has-text("Ứng tuyển")'))
      .first();
    this.btnAlreadyApplied = page.getByRole('button', { name: /Đã ứng tuyển|Nộp lại hồ sơ/i })
      .or(page.locator('button:has-text("Đã ứng tuyển"), button:has-text("Nộp lại hồ sơ")'))
      .first();
    this.txtAppliedNote = page.locator('[class*="applied"], [class*="note"], [class*="status"], [class*="badge"]')
      .filter({ hasText: /đã nộp|hôm nay|đã ứng tuyển|lượt/i })
      .or(page.getByText(/đã nộp hôm nay|đã ứng tuyển/i))
      .first();
    this.dailyApplyLimitWarning = page.locator('[class*="toast"], [class*="alert"], [class*="error"], [role="alert"], [class*="message"]')
      .filter({ hasText: /mỗi ngày chỉ được ứng tuyển 1 lần|chỉ được ứng tuyển 1 lần|đã ứng tuyển trong ngày|vui lòng quay lại vào ngày mai/i })
      .or(page.getByText(/mỗi ngày chỉ được ứng tuyển 1 lần|chỉ được ứng tuyển 1 lần|quay lại vào ngày mai/i))
      .first();
    this.applySuccessMessage = page.locator('[class*="toast"], [class*="success"], [role="alert"]')
      .filter({ hasText: /ứng tuyển thành công|nộp hồ sơ thành công/i })
      .or(page.getByText(/ứng tuyển thành công|nộp hồ sơ thành công/i))
      .first();
    this.btnSaveJob = page.getByRole('button', { name: /Lưu việc làm|Lưu tin/i }).first();
  }

  /**
   * Xác nhận trang chi tiết việc làm tải thành công
   */
  async verifyJobDetailPageLoaded() {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.jobTitleHeading).toBeVisible({ timeout: 15000 });
    await expect(this.btnApplyNow).toBeVisible({ timeout: 15000 });
  }

  /**
   * Bấm nút Ứng tuyển ngay trên trang chi tiết
   */
  async clickApplyNow() {
    await this.actions.click(this.btnApplyNow);
    await this.capture('apply_now_clicked');
  }

  /**
   * Bấm nút Nộp lại hồ sơ / Đã ứng tuyển
   */
  async clickReApply() {
    await this.actions.click(this.btnAlreadyApplied.or(this.btnApplyNow));
    await this.capture('re_apply_clicked');
  }

  /**
   * Chuyển mốc thời gian sang ngày tiếp theo để kiểm thử điểm biên thời gian
   */
  async advanceTimeToNextDay() {
    await this.page.evaluate(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const OriginalDate = window.Date;
      function MockDate(...args) {
        if (args.length === 0) {
          return new OriginalDate(tomorrow.getTime());
        }
        return new OriginalDate(...args);
      }
      MockDate.prototype = OriginalDate.prototype;
      MockDate.now = () => tomorrow.getTime();
      MockDate.parse = OriginalDate.parse;
      MockDate.UTC = OriginalDate.UTC;
      window.Date = MockDate;
    });
    await this.capture('time_advanced_to_next_day');
  }
}

module.exports = { JobDetailPage };
