const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

class JobSearchPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} specName
   */
  constructor(page, specName) {
    super(page, specName);

    this.firstJobLink = page.locator('[data-job-id]').first();
    this.firstUnappliedJobLink = page
      .locator('[data-job-id]')
      .filter({ hasNotText: /\u0110\u00e3 \u1ee9ng tuy\u1ec3n|B\u1ea1n v\u1eeba \u1ee9ng tuy\u1ec3n/i })
      .first();
    this.jobSearchResultTitle = page.getByRole('heading', { level: 1, name: /việc làm/i });
    this.jobCheckboxes = page.locator('.job-item-checkbox'); // Giả định selector cho checkbox
    this.bulkApplyBtn = page.getByRole('button', { name: 'Ứng tuyển hàng loạt' });
    this.confirmBulkApplyBtn = page.locator('.bulk-apply-modal').getByRole('button', { name: 'Xác nhận' }); // Giả định selector
    this.bulkApplySuccessMsg = page.getByText('Bạn đã ứng tuyển hàng loạt thành công'); // Giả định selector
  }

  async clickFirstJob() {
    const pagePromise = this.page.waitForEvent('popup');
    const targetJob = await this.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.firstUnappliedJobLink
      : this.firstJobLink;
    await this.clickElement(targetJob);
    const jobPage = await pagePromise;
    await jobPage.waitForLoadState('domcontentloaded');
    return jobPage;
  }

  async expectJobSearchPageVisible() {
    await expect(this.jobSearchResultTitle).toBeVisible();
  }

  /**
   * Chọn một số lượng job để ứng tuyển hàng loạt
   * @param {number} numberOfJobs - Số lượng job cần chọn từ trên xuống
   */
  async selectJobsForBulkApply(numberOfJobs) {
    const allCheckboxes = await this.jobCheckboxes.all();
    for (let i = 0; i < Math.min(numberOfJobs, allCheckboxes.length); i++) {
      await allCheckboxes[i].check();
    }
  }

  async clickBulkApplyButton() {
    await this.clickElement(this.bulkApplyBtn);
  }

  async confirmBulkApply() {
    await this.clickElement(this.confirmBulkApplyBtn);
  }

  async expectBulkApplySuccessMessageVisible() {
    await expect(this.bulkApplySuccessMsg).toBeVisible({ timeout: 15000 });
  }
}

module.exports = { JobSearchPage };
