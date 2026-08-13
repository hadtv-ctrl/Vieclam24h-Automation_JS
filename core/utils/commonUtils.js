const fs = require('fs');
const path = require('path');

let globalScreenshotSequence = 0;

function getFormattedDate(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return {
    dateStr: `${yy}-${mm}-${dd}`,
    timeStr: `${hh}-${min}-${ss}`
  };
}

let globalRunDateInfo = getFormattedDate(new Date());
let currentTestFile = '';

class ScreenshotHelper {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} featureName - Tên tính năng (vd: 'register-email', 'onboarding')
   */
  constructor(page, featureName) {
    this.page = page;
    this.featureName = featureName;

    // Check if we are in a new test file to reset sequence and timestamp
    try {
      const { test } = require('@playwright/test');
      const info = test.info();
      if (info && info.file && info.file !== currentTestFile) {
        currentTestFile = info.file;
        globalScreenshotSequence = 0;
        globalRunDateInfo = getFormattedDate(new Date());
      }
    } catch(e) {}

    this.runDateInfo = globalRunDateInfo;
    this.screenshotCount = 0;
  }

  getEvidenceDir() {
    let scriptName = '';
    try {
      const { test } = require('@playwright/test');
      const info = test.info();
      if (info && info.file) {
        scriptName = path.basename(info.file).replace(/\.spec\.js$|\.js$/, '');
      }
    } catch(e) {}

    if (!scriptName) {
      scriptName = String(this.featureName || 'unknown');
    }

    const safeName = scriptName.replace(/[^a-zA-Z0-9-_\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
    const dateStr = this.runDateInfo.dateStr;
    const timeStr = this.runDateInfo.timeStr;

    return `evidence/${dateStr}/[${dateStr} ${timeStr}] ${safeName}`;
  }

  async takeScreenshot(stepName, fullPage = false, options = {}) {
    const captureSequence = ++globalScreenshotSequence;
    this.screenshotCount = captureSequence;

    const {
      waitForNetworkIdle = fullPage,
      scrollDuringStabilization = fullPage,
      waitForAnimations = true,
      stabilizationMs = 400,
      waitForLoadState = true,
      loadState = 'networkidle',
      waitForDomContentLoaded = true,
    } = options;

    if (waitForDomContentLoaded) {
      try {
        await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      } catch (error) {
        // Bỏ qua nếu domcontentloaded không trả về trong thời gian ngắn
      }
    }

    if (waitForLoadState) {
      try {
        await this.page.waitForLoadState(loadState, { timeout: 10000 });
      } catch (error) {
        // Bỏ qua nếu page vẫn có request chạy nền hoặc load state không hoàn thành
      }
    }

    if (waitForNetworkIdle) {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        // Bỏ qua nếu trang vẫn có request chạy nền
      }
    }

    try {
      if (waitForAnimations) {
        await this.page.evaluate(async (ms) => {
          const hasAnimatingElements = () => {
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
              const style = window.getComputedStyle(el);
              const hasAnimation = style.animationDuration && style.animationDuration !== '0s';
              const hasTransition = style.transitionDuration && style.transitionDuration !== '0s';
              const transformState = style.transform && style.transform !== 'none';

              if (hasAnimation || hasTransition || transformState) {
                return true;
              }
            }
            return false;
          };

          const start = Date.now();
          while (Date.now() - start < 2000) {
            if (!hasAnimatingElements()) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          if (ms > 0) {
            await new Promise((resolve) => setTimeout(resolve, ms));
          }
        }, stabilizationMs);
      }
    } catch (error) {
      // Bỏ qua nếu page đã bị navigate/đóng trước khi ổn định
    }

    try {
      if (scrollDuringStabilization) {
        await this.page.evaluate(async () => {
          const scrollStep = 400;
          const delayMs = 150;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

          for (let position = 0; position <= maxScroll; position += scrollStep) {
            window.scrollTo(0, Math.min(position, maxScroll));
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          window.scrollTo(0, 0);
        });
      }
    } catch (error) {
      // Bỏ qua nếu page đã bị navigate/đóng trước khi cuộn
    }

    const dir = this.getEvidenceDir();
    const safeStepName = (stepName || 'step').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
    const path = `${dir}/step${String(captureSequence).padStart(3, '0')}_${safeStepName}.png`;

    fs.mkdirSync(dir, { recursive: true });
    try {
      await this.page.screenshot({ path, fullPage });
    } catch (error) {
      // Bỏ qua nếu không thể chụp ảnh do context đã bị hủy
    }
  }

  async takeFullPageScreenshot(stepName) {
    await this.takeScreenshot(stepName, true);
  }
}

class UiActions {
  constructor(page) {
    this.page = page;
  }

  resolveLocator(locatorOrSelector) {
    if (!locatorOrSelector) {
      return null;
    }

    if (typeof locatorOrSelector === 'string') {
      return this.page.locator(locatorOrSelector);
    }

    if (typeof locatorOrSelector === 'object') {
      if (typeof locatorOrSelector.waitFor === 'function') {
        return locatorOrSelector;
      }

      if (typeof locatorOrSelector.selector === 'string') {
        return this.page.locator(locatorOrSelector.selector);
      }

      if (typeof locatorOrSelector._selector === 'string') {
        return this.page.locator(locatorOrSelector._selector);
      }
    }

    return locatorOrSelector;
  }

  async waitForVisible(locatorOrSelector, options = {}) {
    if (typeof locatorOrSelector === 'function') {
      throw new TypeError(
        'UiActions.waitForVisible requires a Playwright Locator or a selector string, not a locator method like .first or .last. Call .first() / .last() before passing it in.'
      );
    }

    const locator = this.resolveLocator(locatorOrSelector);
    if (!locator || typeof locator.waitFor !== 'function') {
      throw new TypeError('UiActions.waitForVisible requires a Playwright Locator or a selector string. Received: ' + String(locatorOrSelector));
    }

    const { timeout = 15000, state = 'visible' } = options;
    await locator.waitFor({ state, timeout });
    return locator;
  }

  async click(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    const clickOptions = {};
    if (options.force !== undefined) clickOptions.force = options.force;
    if (options.button) clickOptions.button = options.button;
    if (options.position) clickOptions.position = options.position;
    if (options.delay !== undefined) clickOptions.delay = options.delay;
    await locator.click(clickOptions);
    return locator;
  }

  async fill(locatorOrSelector, value, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    const fillOptions = {};
    if (options.force !== undefined) fillOptions.force = options.force;
    await locator.fill(value, fillOptions);
    return locator;
  }

  async check(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.check({ force: options.force });
    return locator;
  }
}

const generateRandomVNPhone = () => {
  const prefixes = ['09', '03', '07', '08', '05'];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return randomPrefix + randomSuffix;
};

const generateRandomEmail = () => {
  return `test_auto_${Date.now()}@example.com`;
};

module.exports = { ScreenshotHelper, UiActions, generateRandomVNPhone, generateRandomEmail };
