const { JobSearchPage } = require('../desktop/JobSearchPage');

class MobileJobSearchPage extends JobSearchPage {
  constructor(page, featureName) {
    super(page, featureName);
    this.firstJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).first();
    this.firstUnappliedJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).filter({ hasNotText: /Đã ứng tuyển|Bạn vừa ứng tuyển/i }).first();
  }

  async expectJobsVisible() {
    await this.closeBlockingDialogsIfVisible();
    await this.waitForElement(this.firstJobLink);
  }

  /**
   * Đóng dialog chặn màn hình như "Khám phá việc quanh tôi" trên Mobile Web
   */
  async closeBlockingDialogsIfVisible() {
    const dialog = this.page.locator('[data-test-id="common__dialog"]');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = dialog.locator('button:has(.svicon-close), button:has(.svicon-x), i.svicon-close, button:has-text("Bỏ lọc vị trí"), button:has-text("Đóng")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await this.clickElement(closeBtn);
      } else {
        try {
          await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true });
        } catch (_e) {
          // ignore
        }
      }
      try {
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * Click vào công việc đầu tiên trên mobile:
   * Tự động đóng popup cản trở, hỗ trợ cả trường hợp mở tab mới (popup) hoặc điều hướng tại chỗ (in-tab/SPA)
   */
  async clickFirstJob() {
    await this.closeBlockingDialogsIfVisible();

    const targetJob = await this.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.firstUnappliedJobLink
      : this.firstJobLink;

    const href = await targetJob.getAttribute('href').catch(() => null);

    let popup = null;
    const popupPromise = this.page.waitForEvent('popup', { timeout: 3000 }).catch((_err) => null);
    await this.clickElement(targetJob);
    popup = await popupPromise;

    if (popup) {
      await popup.waitForLoadState('domcontentloaded');
      return popup;
    }

    // Nếu không mở popup, đợi trang hiện tại chuyển sang trang chi tiết việc làm
    try {
      await this.page.waitForURL(/(?:id\d+\.html|\/viec-lam\/|\/tin-tuyen-dung\/)/, { timeout: 10000 });
    } catch (_e) {
      if (href && !this.page.url().includes(href)) {
        await this.navigate(href);
      }
    }

    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }
}

module.exports = { MobileJobSearchPage };
