const { BasePage } = require('../BasePage');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.closeAdsBtns = page.locator('[data-test-id="common__close-button"], .svicon-close, [class*="svicon-close"], button:has(.svicon-close), [aria-label*="close" i]');
    this.mobileEntryPopup = page.locator('.mbep-popup');
    this.mobileEntryPopupCloseBtn = this.mobileEntryPopup.getByRole('button').first();
    this.genericModalCloseBtn = page.locator(
      '#common__modal [data-test-id="common__close-button"], [data-test-id="common__form-modal"] [data-test-id="common__close-button"]'
    ).first();
    this.allLinks = page.locator('a[href]');
    this.logo = page.locator('a[href="/"] img, a[href="/"] svg').first();
    this.privacyConsentAgreeBtn = page.getByRole('button', { name: 'Đồng ý', exact: true });

    this.jobMenuBtn = page.getByRole('button', { name: /Việc làm/ });
    this.findJobSubMenuBtn = page.getByRole('button', { name: 'Tìm việc làm' });
    this.noCVJobLink = page.getByRole('link', { name: 'Việc không cần CV' });
    this.lotteJobLink = page.getByRole('link', { name: 'Nhân Viên Bán Hàng - Lotte' });
  }

  async clickNoCVJobLink() {
    await this.clickElement(this.noCVJobLink);
  }

  async clickLotteJobLink() {
    await this.clickElement(this.lotteJobLink);
  }

  async clickJobMenu() {
    await this.clickElement(this.jobMenuBtn);
  }

  async clickFindJobSubMenu() {
    await this.clickElement(this.findJobSubMenuBtn);
  }

  async openJobSearch() {
    await this.clickJobMenu();
    await Promise.all([
      this.page.waitForURL(/\/tim-kiem-viec-lam-nhanh(?:[/?#]|$)/i, { timeout: 30000 }),
      this.clickFindJobSubMenu(),
    ]);
  }

  async closeBlockingModalIfVisible() {
    if (await this.privacyConsentAgreeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.privacyConsentAgreeBtn, { force: true });
      await this.privacyConsentAgreeBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }

    if (await this.genericModalCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.genericModalCloseBtn, { force: true });
      await this.genericModalCloseBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }

    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeEl = dialog.locator('i, svg, button, [class*="close" i]').last();
      if (await closeEl.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeEl.click({ force: true }).catch(() => null);
      }
      await this.page.keyboard.press('Escape').catch(() => null);
      if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => el.remove());
        }).catch(() => null);
      }
    }
  }

  async navigate() {
    await super.navigate('/');
  }

  async closeAdsIfVisible() {
    try {
      await this.closeBlockingModalIfVisible();

      // Dismiss notification banner ("Tải app ngay", thông báo nâng cấp hệ thống...)
      // Banner này thường ở sticky top, không có nút X nhưng có button dẫn đến app
      const notificationBanner = this.page.locator(
        'div:has(img[alt*="notification" i]):has(button), ' +
        'div:has(img[alt*="mobile" i]):has(button), ' +
        '[class*="notification-bar"], [class*="notify-bar"], [class*="app-banner"], ' +
        '[class*="top-bar"]:has(button)'
      ).first();
      if (await notificationBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Tìm nút X / close trong banner
        const bannerClose = notificationBanner.locator(
          'button:not(:has-text("Tải app")):not(:has-text("Download")), [class*="close" i], i.svicon-close'
        ).first();
        if (await bannerClose.isVisible({ timeout: 1000 }).catch(() => false)) {
          await bannerClose.click({ force: true }).catch(() => null);
        } else {
          // Nếu không có nút close, ẩn bằng JS
          await this.page.evaluate(() => {
            document.querySelectorAll(
              'div:has(img[alt*="notification"]), div:has(img[alt*="mobile"]), [class*="notification-bar"], [class*="app-banner"]'
            ).forEach(el => { if (el.offsetHeight < 100) el.style.display = 'none'; });
          }).catch(() => null);
        }
      }

      if (await this.mobileEntryPopup.isVisible({ timeout: 2000 }).catch(() => false)) {
        const mbepClose = this.mobileEntryPopup.locator('button:has(.svicon-close), [class*="close" i], button, i, svg').first();
        if (await mbepClose.isVisible({ timeout: 1000 }).catch(() => false)) {
          await mbepClose.click({ force: true }).catch(() => null);
        }
        await this.mobileEntryPopup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
        if (await this.mobileEntryPopup.isVisible().catch(() => false)) {
          await this.page.evaluate(() => {
            document.querySelectorAll('.mbep-popup').forEach(el => el.remove());
          }).catch(() => null);
        }
      }

      const count = await this.closeAdsBtns.count();
      for (let i = 0; i < count; i++) {
        const btn = this.closeAdsBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true }).catch(() => null);
        }
      }
    } catch (error) {
      // Bỏ qua nếu không có popup
    }
  }

  async getAllLinksHrefs() {
    const count = await this.allLinks.count();
    const hrefs = [];
    for (let i = 0; i < count; i++) {
      const href = await this.allLinks.nth(i).getAttribute('href');
      if (href) {
        hrefs.push(href);
      }
    }
    return hrefs;
  }

  async expectHomepageVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.actions.waitForVisible(this.logo, { timeout: 20000 });
  }

  async expectHomepageContentLoaded() {
    await this.expectHomepageVisible();
    await this.page.waitForFunction(
      () => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) !== 0 &&
            rect.width > 1 &&
            rect.height > 1 &&
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
          );
        };

        const hasVisibleText = (text) =>
          Array.from(document.querySelectorAll('body *')).some((element) =>
            isVisible(element) && element.innerText && element.innerText.includes(text)
          );

        return (
          hasVisibleText('Tìm việc') &&
          hasVisibleText('Việc đi làm ngay') &&
          hasVisibleText('Việc không cần CV')
        );
      },
      null,
      { timeout: 30000 }
    );

    if (this.screenshotHelper) {
      await this.screenshotHelper.waitForVisualLoadingHidden({ timeout: 30000 });
      await this.screenshotHelper.waitForPageStable({ maxWaitMs: 10000, stableFrameCount: 5 });
    }
  }

  async expectLoginAreaVisible() {
    const loginBtn = this.page.locator('#btn-login-header');
    await this.actions.waitForVisible(loginBtn, { timeout: 20000 });
    return loginBtn;
  }

  async expectEmployerSectionVisible() {
    const employerLink = this.page.locator('#qc-menu-item-employer');
    await this.actions.waitForVisible(employerLink, { timeout: 20000 });
    return employerLink;
  }

  async expectUrgentJobsSectionVisible() {
    const urgentJobsSection = this.page.getByText(/Việc làm tuyển gấp/i).first();
    await this.actions.waitForVisible(urgentJobsSection, { timeout: 20000 });
    return urgentJobsSection;
  }

  async expectImmediateJobsSectionVisible() {
    const immediateJobsSection = this.page.getByText(/Việc đi làm ngay/i).first();
    await this.actions.waitForVisible(immediateJobsSection, { timeout: 20000 });
    return immediateJobsSection;
  }
}

module.exports = { HomePage };
