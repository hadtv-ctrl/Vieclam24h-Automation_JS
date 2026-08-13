const { BasePage } = require('./BasePage');

class PopupConsent extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.popupTitle = page.getByText('Đồng ý cho phép xử lý dữ liệu cá nhân');
    this.agreeBtn = page.getByRole('button', { name: 'Đồng ý' });
  }

  async agreeIfVisible() {
    try {
      await this.actions.waitForVisible(this.popupTitle, { timeout: 5000 });
      await this.capture('popup_consent_visible');
      await this.actions.click(this.agreeBtn);
    } catch (error) {
      console.log('Popup Consent không xuất hiện, bỏ qua bước này.');
    }
  }
}

module.exports = { PopupConsent };