const { UiActions, ScreenshotHelper } = require('../core/utils/commonUtils');

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    this.page = page;
    this.actions = new UiActions(page);
    const resolvedFeatureName = featureName || this.constructor.name.toLowerCase();
    this.screenshotHelper = new ScreenshotHelper(page, resolvedFeatureName);
  }

  async navigate(url, options = {}) {
    // Prefer 'load' to ensure full page resources, but allow overriding via options
    const gotoOptions = Object.assign({ waitUntil: 'load', timeout: 120000 }, options);
    try {
      await this.page.goto(url, gotoOptions);
    } catch (err) {
      // try to capture a screenshot for diagnosis, but don't fail the error handling if capture itself errors
      try {
        const safeName = String(url).replace(/[:\/\?&=.#]/g, '_');
        await this._capture('navigate_error', safeName);
      } catch (captureErr) {
        // ignore capture errors
      }

      // Retry once with a less strict waitUntil and longer timeout — helps when 'load' hangs on third-party resources
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      } catch (err2) {
        // Log and rethrow the original (or second) error so caller sees failure
        console.error(`Navigation to ${url} failed after retry:`, err2);
        throw err2;
      }
    }
  }

  /**
   * Chờ một element hiển thị ổn định trên trang.
   * @param {import('@playwright/test').Locator} locator - Locator của element cần chờ.
   */
  async waitForElement(locator) {
    return locator.waitFor({ state: 'visible', timeout: 15000 });
  }

  async _capture(actionName, details = '', fullPage = false, options = {}) {
    if (this.screenshotHelper) {
      const fileName = `${actionName}${details ? `-${details}` : ''}`;
      await this.screenshotHelper.takeScreenshot(fileName, fullPage, options);
    }
  }

  async capture(stepName, fullPage = false, options = {}) {
    return this._capture(stepName, '', fullPage, options);
  }

  async clickElement(locatorOrSelector, options = {}) {
    // await this._capture('click');
    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await locator.scrollIntoViewIfNeeded();
    return this.actions.click(locator, options);
  }

  /**
   * Đợi một chút để UI render loading, sau đó chờ đến khi loading overlay thực sự biến mất
   * Hàm này giúp script chạy mượt hơn ở điều kiện mạng chậm, không bị lỗi race condition
   */
  async waitForGlobalLoadingHidden(timeout = 60000) {
    const loadingOverlay = this.page.locator('.overlay-loading');

    await loadingOverlay.waitFor({ state: 'hidden', timeout });
  }

  async fillInput(locatorOrSelector, text, options = {}) {
    const sanitizedText = String(text).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    // await this._capture('fill', sanitizedText);
    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await locator.scrollIntoViewIfNeeded();
    return this.actions.fill(locator, text, options);
  }
}

module.exports = { BasePage };
