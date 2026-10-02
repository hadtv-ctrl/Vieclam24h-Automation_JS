const { BasePage } = require('../BasePage');
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

class PopupConsent extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.popupTitle = page.getByText('Đồng ý cho phép xử lý dữ liệu cá nhân');
    this.agreeBtn = page.getByRole('button', { name: 'Đồng ý' });
    this.rejectBtn = page.getByRole('button', { name: /Từ chối|Không đồng ý|Đóng/i }).first();
    this.consentWarning = page.locator('#consent-warning, [class*="consent"] [class*="alert"], [class*="consent"] [class*="error"], [class*="consent-warning"]')
      .or(page.getByText(/yêu cầu đồng ý điều khoản|chấp thuận dữ liệu|đồng ý điều khoản dữ liệu|đồng ý.*để tiếp tục/i))
      .first();
  }

  async agreeIfVisible() {
    try {
      await this.actions.waitForVisible(this.popupTitle, { timeout: 5000 });
      await this.capture('popup_consent_visible');
      await this.actions.click(this.agreeBtn);
    } catch (error) {
      if (process.env.DEBUG_OPTIONAL_POPUPS === '1' || getDashboardConfig().runtime.debugOptionalPopups) {
        console.log('Popup Consent không xuất hiện, bỏ qua bước này.');
      }
    }
  }

  async reject() {
    await this.actions.waitForVisible(this.rejectBtn, { timeout: 15000 });
    await this.actions.click(this.rejectBtn);
    await this.capture('popup_consent_rejected');
  }

  async agree() {
    await this.actions.waitForVisible(this.popupTitle, { timeout: 15000 });
    await this.capture('popup_consent_visible');
    await this.actions.click(this.agreeBtn);
    await this.popupTitle.waitFor({ state: 'hidden', timeout: 15000 });
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
