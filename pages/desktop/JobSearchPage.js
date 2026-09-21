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

    // Chop AI chatbot entry point
    this.chopIntroBtn = page.getByRole('img', { name: 'Chop Introduction' });
  }

  async navigate() {
    await super.navigate('/tim-kiem-viec-lam-nhanh');
  }

  async open() {
    await this.navigate();
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

  async closeGuestPromptModalIfVisible() {
    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2500 }).catch(() => false)) {
      const closeBtn = dialog.locator('button, [class*="close" i], i, svg, [cursor="pointer"]').last();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => null);
      } else {
        await this.page.keyboard.press('Escape').catch(() => null);
      }
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {
        return this.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => el.remove());
        }).catch(() => null);
      });
    }
  }

  /**
   * Click vào nút Chop Introduction và trả về popup page của chatbot.
   * Nếu popup đầu tiên là trang intro trung gian, phương thức này vẫn trả về
   * popup page đó và để ChopChatbotPage.dismissIntroIfVisible() xử lý tiếp.
   * @returns {Promise<import('@playwright/test').Page>} popup page của Chop chatbot
   */
  async openChopChatbot() {
    await this.closeGuestPromptModalIfVisible();
    const popupPromise = this.page.waitForEvent('popup');
    try {
      await this.clickElement(this.chopIntroBtn, { timeout: 5000 });
    } catch (err) {
      // Nếu bị dialog chặn click, đóng dialog rồi click lại
      await this.closeGuestPromptModalIfVisible();
      await this.clickElement(this.chopIntroBtn);
    }
    const chatbotPopup = await popupPromise;
    await chatbotPopup.waitForLoadState('domcontentloaded');
    return chatbotPopup;
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
