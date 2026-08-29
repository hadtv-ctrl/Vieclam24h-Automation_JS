const { JobSearchPage } = require('../desktop/JobSearchPage');

class MobileJobSearchPage extends JobSearchPage {
  constructor(page, featureName) {
    super(page, featureName);
    this.firstJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).first();
    this.firstUnappliedJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).filter({ hasNotText: /Đã ứng tuyển|Bạn vừa ứng tuyển/i }).first();
  }

  async expectJobsVisible() {
    await this.waitForElement(this.firstJobLink);
  }
}

module.exports = { MobileJobSearchPage };
