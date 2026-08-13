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
      if (process.env.DEBUG_OPTIONAL_POPUPS === '1') {
        console.log('Popup Consent không xuất hiện, bỏ qua bước này.');
      }
    }
  }

  async waitForConsentOrHomepageReady(homePage) {
    try {
      await this.actions.waitForVisible(this.popupTitle, { timeout: 15000 });
      if (this.screenshotHelper) {
        await this.screenshotHelper.waitForPageStable({ maxWaitMs: 10000, stableFrameCount: 5 });
      }
      return 'consent';
    } catch (error) {
      if (!homePage || typeof homePage.expectHomepageContentLoaded !== 'function') {
        throw error;
      }

      await homePage.expectHomepageContentLoaded();
      return 'homepage';
    }
  }
}

module.exports = { PopupConsent };
