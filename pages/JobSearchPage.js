const { BasePage } = require('./BasePage');

class JobSearchPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.firstJobLink = page.locator('[data-job-id]').first();
  }

  async clickFirstJob() {
    await this.clickElement(this.firstJobLink);
  }
}

module.exports = { JobSearchPage };