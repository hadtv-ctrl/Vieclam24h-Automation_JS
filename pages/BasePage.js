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
    // Chờ mạng cơ bản ổn định (không bắt buộc, catch lỗi timeout để không gián đoạn)
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    // Chờ các Skeleton loaders (nếu có) biến mất khỏi DOM
    await this.page.waitForFunction(
      () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"]'),
      null,
      { timeout: 15000 }
    ).catch(() => null);
    
    // Chờ giao diện (body) hết các hiệu ứng chuyển động/animation (ví dụ như Skeleton loader dùng animation)
    await this.waitForElementStable(this.page.locator('body'), { timeout: 5000 }).catch(() => null);

    return this._capture(stepName, '', fullPage, options);
  }

  async isElementInViewport(locator) {
    return locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth
      );
    });
  }

  async scrollToElementIfOutsideViewport(locator) {
    const isInViewport = await this.isElementInViewport(locator);
    if (!isInViewport) {
      await locator.scrollIntoViewIfNeeded();
    }
  }

  async waitForElementStable(locatorOrSelector, options = {}) {
    const {
      timeout = 10000,
      stableFrameCount = 8,
      maxElements = 120,
    } = options;

    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout });

    await locator.evaluate(
      async (element, { timeout, stableFrameCount, maxElements }) => {
        const startedAt = performance.now();
        let previousSignature = '';
        let stableFrames = 0;

        const isVisible = (target) => {
          const rect = target.getBoundingClientRect();
          const style = window.getComputedStyle(target);
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

        const hasRunningAnimations = () => {
          if (typeof element.getAnimations !== 'function') return false;
          return element
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === 'running' || animation.pending);
        };

        const getSignature = () => {
          const targets = [element, ...Array.from(element.querySelectorAll('*')).slice(0, maxElements)];
          const parts = [];

          for (const target of targets) {
            if (!isVisible(target)) continue;

            const rect = target.getBoundingClientRect();
            const style = window.getComputedStyle(target);
            parts.push(
              Math.round(rect.left * 2) / 2,
              Math.round(rect.top * 2) / 2,
              Math.round(rect.width * 2) / 2,
              Math.round(rect.height * 2) / 2,
              style.transform,
              style.opacity
            );
          }

          return parts.join('|');
        };

        while (performance.now() - startedAt < timeout) {
          await new Promise((resolve) => requestAnimationFrame(resolve));

          const signature = getSignature();
          if (signature === previousSignature && !hasRunningAnimations()) {
            stableFrames += 1;
            if (stableFrames >= stableFrameCount) return;
          } else {
            stableFrames = 0;
            previousSignature = signature;
          }
        }

        throw new Error('Element did not become visually stable before timeout.');
      },
      { timeout, stableFrameCount, maxElements }
    );

    return locator;
  }

  async clickElement(locatorOrSelector, options = {}) {
    // await this._capture('click');
    const locator = await this.actions.waitForVisible(locatorOrSelector, { timeout: 30000 });
    // Cuộn đến element nếu cần thiết, phương thức này đã tự kiểm tra
    await this.scrollToElementIfOutsideViewport(locator);
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
    await this.scrollToElementIfOutsideViewport(locator);
    return this.actions.fill(locator, text, options);
  }

  async fillCodeInputs(inputLocator, code) {
    const codeText = String(code);
    await this.waitForElement(inputLocator.first());

    const inputCount = await inputLocator.count();
    const fillCount = Math.min(inputCount, codeText.length);

    for (let i = 0; i < fillCount; i++) {
      await this.fillInput(inputLocator.nth(i), codeText.charAt(i));
    }
  }

  getPhoneVerificationLocators() {
    return {
      title: this.page.getByText(/Xác thực số điện thoại/i).first(),
      phoneInput: this.page.getByRole('textbox', { name: /Số điện thoại|Nhập số điện thoại/i }).first(),
      codeInputs: this.page.locator(
        [
          'input[maxlength="1"]:visible',
          'input[autocomplete="one-time-code"]:visible',
          'input[aria-label*="Digit"]:visible',
          'input[name*="otp"]:visible',
          'input[id*="otp"]:visible',
        ].join(', ')
      ),
      telCodeInputs: this.page.locator('input[type="tel"]:visible'),
      codeTextboxes: this.page.getByRole('textbox', { name: /Digit|Please enter verification|OTP|Mã xác thực/i }),
      submitButton: this.page.getByRole('button', { name: /Xác thực|Xác nhận|Tiếp tục|Hoàn tất/i }).first(),
    };
  }

  async handlePhoneVerificationAfterApplyIfVisible(otpCode) {
    const locators = this.getPhoneVerificationLocators();

    try {
      await locators.title.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    await this.capture('phone_verification_visible');

    if (!otpCode) {
      throw new Error('Phone verification appeared after clicking apply, but no otpCode was provided.');
    }

    await this.continuePhoneVerificationPhoneStepIfNeeded(locators);
    await this.capture('phone_verification_code_step');
    await this.fillPhoneVerificationCode(locators, otpCode);
    await this.clickPhoneVerificationSubmitIfVisible(locators);
    await this.waitForGlobalLoadingHidden(15000);
    return true;
  }

  async continuePhoneVerificationPhoneStepIfNeeded(locators, options = {}) {
    const {
      maxAttempts = 3,
      codeStepTimeout = 10000,
      loadingTimeout = 15000,
    } = options;

    if (await this.isPhoneVerificationCodeInputVisible(locators, 1500)) {
      return false;
    }

    let lastCodeStepError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const hasPhoneStep = await this.isPhoneVerificationPhoneStepVisible(locators, 1500);
      const hasContinueButton = await this.isPhoneVerificationSubmitVisible(locators, 1500);

      if (!hasPhoneStep && !hasContinueButton) {
        break;
      }

      await this.clickElement(locators.submitButton);
      await this.waitForGlobalLoadingHidden(loadingTimeout);

      try {
        await this.waitForPhoneVerificationCodeStepVisible(locators, codeStepTimeout);
        return true;
      } catch (error) {
        lastCodeStepError = error;
      }

      const canRetry = await this.isPhoneVerificationSubmitVisible(locators, 1500);
      if (!canRetry || attempt === maxAttempts) {
        break;
      }

      console.warn(`Phone verification code step did not appear after Continue attempt ${attempt}; retrying.`);
    }

    throw new Error(
      `Phone verification code step did not appear after clicking Continue ${maxAttempts} time(s). ` +
      `Last wait error: ${lastCodeStepError?.message || 'unknown'}`
    );
  }

  async isPhoneVerificationPhoneStepVisible(locators, timeout = 5000) {
    try {
      await locators.phoneInput.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      try {
        await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
        return (await locators.telCodeInputs.count()) === 1;
      } catch {
        return false;
      }
    }
  }

  async isPhoneVerificationCodeInputVisible(locators, timeout = 5000) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      try {
        await locators.codeInputs.first().waitFor({ state: 'visible', timeout });
        return true;
      } catch {
        try {
          await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
          return (await locators.telCodeInputs.count()) > 1;
        } catch {
          return false;
        }
      }
    }
  }

  async isPhoneVerificationSubmitVisible(locators, timeout = 5000) {
    try {
      await locators.submitButton.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async waitForPhoneVerificationCodeStepVisible(locators, timeout = 10000) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout });
      return;
    } catch {
      // Try the next supported OTP locator shape.
    }

    try {
      await locators.codeInputs.first().waitFor({ state: 'visible', timeout });
      return;
    } catch {
      // Try grouped tel inputs as a final OTP fallback.
    }

    await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
    const telInputCount = await locators.telCodeInputs.count();
    if (telInputCount <= 1) {
      throw new Error('Phone verification code step was not visible after continuing phone verification.');
    }
  }

  async fillPhoneVerificationCode(locators, otpCode) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout: 10000 });
      await this.fillCodeInputs(locators.codeTextboxes, otpCode);
      return;
    } catch {
      // Try the next supported OTP locator shape.
    }

    try {
      await locators.codeInputs.first().waitFor({ state: 'visible', timeout: 10000 });
      await this.fillCodeInputs(locators.codeInputs, otpCode);
      return;
    } catch {
      // Try grouped tel inputs as a final OTP fallback.
    }

    await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout: 10000 });
    const telInputCount = await locators.telCodeInputs.count();
    if (telInputCount <= 1) {
      throw new Error('Phone verification OTP inputs were not visible after continuing phone verification.');
    }

    await this.fillCodeInputs(locators.telCodeInputs, otpCode);
  }

  async clickPhoneVerificationSubmitIfVisible(locators) {
    try {
      await locators.submitButton.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    await this.clickElement(locators.submitButton);
    return true;
  }
}

module.exports = { BasePage };
