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
}

module.exports = { JobDetailPage };
