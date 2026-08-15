const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.closeAdsBtns = page.locator('//button[./i[contains(@class,"svicon-close")]]');
    this.mobileEntryPopup = page.locator('.mbep-popup');
    this.mobileEntryPopupCloseBtn = this.mobileEntryPopup.getByRole('button').first();
    this.allLinks = page.locator('a[href]');
    this.logo = page.locator('a[href="/"] svg').first();

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

  async navigate() {
    await super.navigate('/');
  }

  async closeAdsIfVisible() {
    if (await this.mobileEntryPopup.isVisible()) {
      await this.actions.click(this.mobileEntryPopupCloseBtn, { force: true });
      await this.mobileEntryPopup.waitFor({ state: 'hidden', timeout: 10000 });
    }

    try {
      await this.actions.waitForVisible(this.closeAdsBtns.first(), { timeout: 8000 });
      const count = await this.closeAdsBtns.count();
      for (let i = 0; i < count; i++) {
        if (await this.closeAdsBtns.nth(i).isVisible()) {
          await this.actions.click(this.closeAdsBtns.nth(i), { force: true });
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
