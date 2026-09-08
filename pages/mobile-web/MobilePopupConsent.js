const { PopupConsent } = require('../desktop/PopupConsent');

class MobilePopupConsent extends PopupConsent {
  constructor(page, featureName) {
    super(page, featureName);
    this.scrollableContent = page.locator(
      '[data-test-id="consent-dialog"] .overflow-auto, [data-test-id="consent-dialog"] [style*="overflow"], .overflow-auto'
    );
  }

  async scrollContentToEndIfDisabled() {
    try {
      if (await this.agreeBtn.isDisabled({ timeout: 1500 })) {
        if (await this.scrollableContent.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.scrollableContent.first().evaluate((el) => {
            el.scrollTop = el.scrollHeight;
            el.dispatchEvent(new Event('scroll', { bubbles: true }));
          });
        }
      }
    } catch (e) {
      // Ignored: proceed to click agree button directly
    }
  }

  async agreeIfVisible() {
    try {
      await this.actions.waitForVisible(this.popupTitle, { timeout: 5000 });
      await this.capture('popup_consent_visible');
      await this.scrollContentToEndIfDisabled();
      await this.actions.click(this.agreeBtn);
    } catch (error) {
      const { getDashboardConfig } = require('../../core/config/dashboardConfig');
      if (process.env.DEBUG_OPTIONAL_POPUPS === '1' || getDashboardConfig().runtime.debugOptionalPopups) {
        console.log('Popup Consent không xuất hiện, bỏ qua bước này.');
      }
    }
  }

  async agree() {
    await this.actions.waitForVisible(this.popupTitle, { timeout: 15000 });
    await this.capture('popup_consent_visible');
    await this.scrollContentToEndIfDisabled();
    await this.actions.click(this.agreeBtn);
    await this.popupTitle.waitFor({ state: 'hidden', timeout: 15000 });
  }
}

module.exports = { MobilePopupConsent };
