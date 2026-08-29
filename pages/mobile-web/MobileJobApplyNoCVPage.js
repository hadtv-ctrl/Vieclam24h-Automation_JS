const { JobApplyNoCVPage } = require('../desktop/JobApplyNoCVPage');

class MobileJobApplyNoCVPage extends JobApplyNoCVPage {
  constructor(page, featureName) {
    super(page, featureName);
    
    // Override locators for mobile where the actual input is hidden/intercepted by a wrapper button
    this.txtProvince = this.page.locator('div[data-test-id="common__form-item"]')
      .filter({ has: this.page.getByRole('textbox', { name: /Chọn tỉnh/i }) })
      .getByRole('button');
      
    this.txtDistrict = this.page.locator('div[data-test-id="common__form-item"]')
      .filter({ has: this.page.getByRole('textbox', { name: /Chọn quận/i }).or(this.page.getByText('Chọn quận', { exact: true })) })
      .getByRole('button');
      
    this.txtBirthYear = this.page.locator('div[data-test-id="common__form-item"]')
      .filter({ has: this.page.getByRole('textbox', { name: /Chọn năm sinh/i }) })
      .getByRole('button');
  }
}
module.exports = { MobileJobApplyNoCVPage };
