const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.closeAdsBtns = page.locator('//button[./i[contains(@class,"svicon-close")]]');
    this.allLinks = page.locator('a[href]');
    this.logo = page.locator('a[href="/"] svg').first();

    this.jobMenuBtn = page.getByRole('button', { name: /Việc làm/ });
    this.findJobSubMenuBtn = page.getByRole('button', { name: 'Tìm việc làm' });
  }

  async clickJobMenu() {
    await this.clickElement(this.jobMenuBtn);
  }

  async clickFindJobSubMenu() {
    await this.clickElement(this.findJobSubMenuBtn);
  }

  async navigate() {
    await this.page.goto('/');
  }

  async closeAdsIfVisible() {
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
