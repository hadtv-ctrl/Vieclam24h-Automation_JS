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

  async waitForPageStable(options = {}) {
    const {
      maxWaitMs = 5000,
      stableFrameCount = 5,
    } = options;

    try {
      await this.page.evaluate(async ({ maxWaitMs, stableFrameCount }) => {
        const startedAt = performance.now();
        let previousSignature = '';
        let stableFrames = 0;

        const hasRunningAnimations = () => {
          if (typeof document.getAnimations !== 'function') return false;
          return document
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === 'running' || animation.pending);
        };

        const getLayoutSignature = () => {
          const elements = Array.from(document.querySelectorAll('body, body *'));
          const parts = [
            window.scrollX,
            window.scrollY,
            document.documentElement.scrollWidth,
            document.documentElement.scrollHeight,
          ];

          for (const element of elements) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible =
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity) !== 0 &&
              rect.width > 1 &&
              rect.height > 1 &&
              rect.bottom >= 0 &&
              rect.right >= 0 &&
              rect.top <= window.innerHeight &&
              rect.left <= window.innerWidth;

            if (!isVisible) continue;

            parts.push(
              Math.round(rect.left * 2) / 2,
              Math.round(rect.top * 2) / 2,
              Math.round(rect.width * 2) / 2,
              Math.round(rect.height * 2) / 2
            );

            if (parts.length > 1200) break;
          }

          return parts.join('|');
        };

        while (performance.now() - startedAt < maxWaitMs) {
          await new Promise((resolve) => requestAnimationFrame(resolve));

          const signature = getLayoutSignature();
          if (signature === previousSignature && !hasRunningAnimations()) {
            stableFrames += 1;
            if (stableFrames >= stableFrameCount) return;
          } else {
            stableFrames = 0;
            previousSignature = signature;
          }
        }
      }, { maxWaitMs, stableFrameCount });
    } catch (error) {
      // Ignore if the page navigates or closes while evidence is stabilizing.
    }
  }

  async waitForVisualLoadingHidden(options = {}) {
    const {
      timeout = 15000,
    } = options;

    try {
      await this.page.waitForFunction(
        () => {
          const loadingSelectors = [
            '.overlay-loading',
            '.ant-skeleton',
            '.ant-spin',
            '.skeleton',
            '.skeleton-loading',
            '.react-loading-skeleton',
            '[class*="skeleton"]',
            '[class*="Skeleton"]',
            '[class*="shimmer"]',
            '[class*="animate-pulse"]',
            '[aria-busy="true"]',
            '[role="progressbar"]',
          ];

          const isVisible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity) !== 0 &&
              rect.width > 1 &&
              rect.height > 1 &&
              rect.bottom >= 0 &&
              rect.right >= 0 &&
              rect.top <= window.innerHeight &&
              rect.left <= window.innerWidth
            );
          };

          return !loadingSelectors.some((selector) =>
            Array.from(document.querySelectorAll(selector)).some(isVisible)
          );
        },
        null,
        { timeout }
      );
    } catch (error) {
      // Continue so evidence capture does not hide the underlying test result.
    }
  }

  async takeScreenshot(stepName, fullPage = false, options = {}) {
    const captureSequence = ++globalScreenshotSequence;
    this.screenshotCount = captureSequence;

    const {
      waitForNetworkIdle = false,
      scrollDuringStabilization = fullPage,
      waitForAnimations = true,
      stabilizationMs = 0,
      waitForLoadState = true,
      loadState = 'domcontentloaded',
      waitForDomContentLoaded = true,
      maxStabilizationMs = 5000,
      stableFrameCount = 5,
      waitForVisualLoading = true,
      visualLoadingTimeout = 15000,
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

    if (waitForVisualLoading) {
      await this.waitForVisualLoadingHidden({ timeout: visualLoadingTimeout });
    }

    try {
      if (waitForAnimations) {
        await this.waitForPageStable({ maxWaitMs: maxStabilizationMs, stableFrameCount });

        if (stabilizationMs > 0) {
          await this.page.evaluate(
            (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
            stabilizationMs
          );
          await this.waitForPageStable({ maxWaitMs: maxStabilizationMs, stableFrameCount });
        }
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
      await this.page.screenshot({ path, fullPage, animations: 'disabled' });
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
    if (options.timeout !== undefined) clickOptions.timeout = options.timeout;
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

  async fillAutocomplete(locatorOrSelector, value, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.fill('');
    await locator.pressSequentially(String(value));
    return locator;
  }

  async check(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.check({ force: options.force });
    return locator;
  }

  async uncheck(locatorOrSelector, options = {}) {
    const locator = await this.waitForVisible(locatorOrSelector, options);
    await locator.uncheck({ force: options.force });
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
