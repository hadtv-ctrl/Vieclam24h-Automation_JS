// master-process-disable-size-check: Legacy module, queued for modular decomposition
const { UiActions, ScreenshotHelper } = require('../core/utils/commonUtils');
const { expect } = require('@playwright/test');

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    this.page = page;
    this.actions = new UiActions(page);
    this.accountMenuButton = page.getByRole('button', { name: /avt_invalid|tài khoản/i })
      .or(page.getByAltText('avt_invalid'))
      .or(page.locator('figure img[alt="avt_invalid"]'))
      .first();
    this.appliedJobsButton = page.getByRole('button', { name: /Việc làm đã ứng tuyển/i })
      .or(page.getByRole('link', { name: /Việc làm đã ứng tuyển/i }))
      .or(page.getByText('Việc làm đã ứng tuyển'))
      .first();
    this.appliedJobsList = page.locator('[data-test-id="applied-job__list-jobs"]');
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
  /**
   * Phát hiện xem hiện tại trên màn hình có Modal / Popup / Dialog / Drawer đang mở không.
   * @returns {Promise<boolean>}
   */
  async isModalOrPopupVisible() {
    if (this.screenshotHelper && typeof this.screenshotHelper.isModalOrPopupVisible === 'function') {
      return this.screenshotHelper.isModalOrPopupVisible();
    }
    return false;
  }

  /**
   * Đăng ký Playwright Locator Handler để tự động đóng popup nếu xuất hiện sau 30s
   * hoặc bất kỳ lúc nào khi người dùng chưa đăng nhập.
   */
  async registerGuestPopupAutoHandlers() {
    try {
      // 1. Popup "Khoan đã, Hình như bạn chưa đăng nhập?" (sau ~30s)
      const guestLoginPopup = this.page.locator('.ReactModalPortal, [role="dialog"]')
        .filter({ hasText: /Khoan đã|chưa đăng nhập/i });

      await this.page.addLocatorHandler(guestLoginPopup, async (overlay) => {
        const closeBtn = overlay.locator('button:has(.svicon-close), button, [class*="close" i], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.page.keyboard.press('Escape').catch(() => null);
        }
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });

      // 2. Popup "TẢI APP NGAY" (Banner / mobileEntryPopup)
      const appBanner = this.page.locator('.mbep-popup, .ReactModalPortal')
        .filter({ hasText: /Tải app ngay/i });

      await this.page.addLocatorHandler(appBanner, async (overlay) => {
        const closeBtn = overlay.locator('button:has(.svicon-close), button, [class*="close" i], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        }
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });

      // 3. Popup Banner quảng cáo / chiến dịch (ví dụ: "Việc vững vàng, đón xuân SANG" có img[alt="Banner"])
      const campaignBanner = this.page.locator(
        '.ReactModalPortal img[alt*="Banner" i], [role="dialog"] img[alt*="Banner" i], dialog img[alt*="Banner" i], img[src*="popup-remind" i], .ReactModalPortal:has(.svicon-close)'
      ).first();

      await this.page.addLocatorHandler(campaignBanner, async (overlay) => {
        const closeBtn = this.page.locator(
          '.ReactModalPortal .svicon-close, .ReactModal__Content .svicon-close, [role="dialog"] .svicon-close, button:has(.svicon-close), [class*="close" i]'
        ).first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.page.keyboard.press('Escape').catch(() => null);
        }
        await this.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal, [role="dialog"], dialog').forEach((el) => {
            if (
              el.querySelector('img[alt*="Banner" i]') ||
              el.querySelector('img[src*="popup-remind" i]') ||
              el.querySelector('.svicon-close') ||
              (el.innerText && (el.innerText.includes('Khoan đã') || el.innerText.includes('đón xuân') || el.innerText.includes('SANG')))
            ) {
              const btn = el.querySelector('button, [class*="close" i], .svicon-close');
              if (btn) btn.click();
              el.remove();
            }
          });
          document.body.classList.remove('ReactModal__Body--open');
          document.body.style.overflow = 'auto';
        }).catch(() => null);
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });
    } catch (_err) {
      // Bỏ qua nếu context/page không hỗ trợ
    }
  }

  /**
   * Quét và đóng sạch tất cả các popup, banner, modal cản trở đang hiển thị trên màn hình
   * trước khi thực hiện flow test.
   */
  async closeAllPopupsIfVisible() {
    try {
      // 1. Đóng popup "Khoan đã, Hình như bạn chưa đăng nhập?"
      const guestLoginPopup = this.page.locator('.ReactModalPortal, [role="dialog"], dialog')
        .filter({ hasText: /Khoan đã|chưa đăng nhập/i });
      if (await guestLoginPopup.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = guestLoginPopup.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.page.keyboard.press('Escape').catch(() => null);
        }
        await guestLoginPopup.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      }

      // 2. Đóng popup "TẢI APP NGAY"
      const appModal = this.page.locator('.mbep-popup, .ReactModalPortal')
        .filter({ hasText: /Tải app ngay/i });
      if (await appModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = appModal.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        }
        await appModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      }

      // 3. Đóng popup Banner quảng cáo / chiến dịch (img[alt="Banner"] hoặc img[src*="popup-remind"])
      const bannerCloseBtn = this.page.locator(
        '.ReactModalPortal .svicon-close, ' +
        '.ReactModal__Content .svicon-close, ' +
        '[role="dialog"] .svicon-close, ' +
        '.ReactModalPortal:has(img) button:has(.svicon-close), ' +
        '.ReactModalPortal:has(img) [class*="close" i], ' +
        '.ReactModalPortal button:has-text("Đóng"), ' +
        '.ReactModalPortal button:has-text("Bỏ qua")'
      ).first();
      if (await bannerCloseBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await bannerCloseBtn.click({ force: true }).catch(() => null);
        await bannerCloseBtn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      } else {
        const bannerImg = this.page.locator('.ReactModalPortal img[alt*="Banner" i], img[src*="popup-remind" i], [role="dialog"] img[alt*="Banner" i]').first();
        if (await bannerImg.isVisible({ timeout: 1000 }).catch(() => false)) {
          await this.page.keyboard.press('Escape').catch(() => null);
        }
      }

      // 4. Đóng popup Đồng ý chính sách bảo mật
      const consentBtn = this.page.getByRole('button', { name: 'Đồng ý', exact: true });
      if (await consentBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.actions.click(consentBtn, { force: true });
        await consentBtn.waitFor({ state: 'hidden', timeout: 2500 }).catch(() => null);
      }

      // 5. Đóng generic modal / dialog nếu có
      const genericDialog = this.page.getByRole('dialog');
      if (await genericDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = genericDialog.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').last();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.page.keyboard.press('Escape').catch(() => null);
        }
      }

      // 6. Quét dọn các overlay còn sót bằng evaluate an toàn
      await this.page.evaluate(() => {
        document.querySelectorAll('.ReactModalPortal, [role="dialog"], dialog').forEach((el) => {
          if (
            el.querySelector('img[alt*="Banner" i]') ||
            el.querySelector('img[src*="popup-remind" i]') ||
            el.querySelector('.svicon-close') ||
            (el.innerText && (
              el.innerText.includes('chưa đăng nhập') ||
              el.innerText.includes('Tải app') ||
              el.innerText.includes('Khoan đã') ||
              el.innerText.includes('đón xuân') ||
              el.innerText.includes('SANG')
            ))
          ) {
            const closeBtn = el.querySelector('button, [class*="close" i], [cursor="pointer"], .svicon-close, svg, i');
            if (closeBtn) closeBtn.click();
            el.remove();
          }
        });
        document.querySelectorAll('.mbep-popup').forEach((el) => el.remove());
        document.querySelectorAll('[class*="notification-bar"], [class*="app-banner"]').forEach((el) => {
          if (el.offsetHeight < 100) el.style.display = 'none';
        });
        document.body.classList.remove('ReactModal__Body--open');
        document.body.style.overflow = 'auto';
      }).catch(() => null);
    } catch (_err) {
      // An toàn khi không có popup
    }
  }

  async _capture(actionName, details = '', fullPage = null, options = {}) {
    if (this.screenshotHelper) {
      const fileName = `${actionName}${details ? `-${details}` : ''}`;
      await this.screenshotHelper.takeScreenshot(fileName, fullPage, options);
    }
  }

  /**
   * Đảm bảo toàn bộ tài nguyên, mạng và khung giao diện đã load xong hoàn toàn và ổn định.
   */
  async waitForPageReady(options = {}) {
    const {
      waitForNetworkIdle = true,
      waitForVisualLoading = true,
      waitForStability = true,
      visualLoadingTimeout = 15000,
      stabilityTimeout = 5000,
    } = options;

    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (_) {}

    try {
      await this.page.waitForLoadState('load', { timeout: 10000 });
    } catch (_) {}

    if (waitForNetworkIdle) {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 4000 });
      } catch (_) {}
    }

    if (waitForVisualLoading) {
      await this.page.waitForFunction(
        () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"], [class*="overlay-loading"], [role="progressbar"], [aria-busy="true"]'),
        null,
        { timeout: visualLoadingTimeout }
      ).catch(() => null);
    }

    if (waitForStability && this.screenshotHelper) {
      await this.screenshotHelper.waitForPageStable({ maxWaitMs: stabilityTimeout, stableFrameCount: 5 });
    }
  }

  async capture(stepName, fullPage = null, options = {}) {
    // Chờ trang load xong hoàn toàn trước khi chụp
    await this.waitForPageReady(options);

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
    return this.actions.click(locator, { timeout: 15000, ...options });
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
      title: this.page.getByText(/Xác thực số điện thoại|Xác thực OTP|Mã OTP/i).first(),
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

      await this.clickElement(locators.submitButton, { timeout: 15000 });

      try {
        await this.waitForPhoneVerificationCodeStepVisible(locators, codeStepTimeout);
        return true;
      } catch (error) {
        lastCodeStepError = error;
      }

      await this.waitForGlobalLoadingHidden(loadingTimeout);

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

  async openAppliedJobs() {
    try {
      const applyModal = this.page.locator('#apply-job-modal');
      if (await applyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // First check if modal has a direct link/button to applied jobs
        const directAppliedLink = applyModal.locator('button, a').filter({ hasText: /Xem việc làm đã ứng tuyển|Việc làm đã ứng tuyển/i }).first();
        if (await directAppliedLink.isVisible({ timeout: 1000 }).catch(() => false)) {
          await Promise.all([
            this.page.waitForURL(/\/ntv-trang-quan-tri-viec-lam-da-ung-tuyen\.html(?:[?#]|$)/i, { timeout: 30000 }),
            this.clickElement(directAppliedLink),
          ]);
          return;
        }

        // Otherwise close or dismiss modal
        const modalCloseBtn = applyModal.locator('[data-test-id="common__close-button"], button:has(.svicon-close), .svicon-close, button:has-text("Đóng"), button:has-text("Xong")').first();
        if (await modalCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await modalCloseBtn.click({ force: true }).catch(() => null);
        } else {
          await this.page.keyboard.press('Escape');
        }

        try {
          await applyModal.waitFor({ state: 'hidden', timeout: 5000 });
        } catch (hideErr) {
          await this.page.evaluate(() => {
            const el = document.getElementById('apply-job-modal');
            if (el) el.style.display = 'none';
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.log('Notice while handling apply modal in openAppliedJobs:', err.message);
    }

    await this.clickElement(this.accountMenuButton);
    await this.capture('account_menu_opened');

    // On mobile web, "Quản lý việc làm" is an accordion menu that needs to be expanded first
    const jobManagementAccordion = this.page.getByRole('button', { name: /Quản lý việc làm/i })
      .or(this.page.getByText('Quản lý việc làm', { exact: true }))
      .first();
    if (await jobManagementAccordion.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isExpanded = (await jobManagementAccordion.getAttribute('aria-expanded').catch(() => 'false')) === 'true';
      if (!isExpanded) {
        await this.clickElement(jobManagementAccordion);
      }
    }

    const targetUrlPattern = /\/ntv-trang-quan-tri-viec-lam-da-ung-tuyen\.html(?:[?#]|$)/i;
    try {
      const appliedLink = this.page.locator('a[href*="ntv-trang-quan-tri-viec-lam-da-ung-tuyen"]')
        .or(this.appliedJobsButton)
        .first();

      if (await appliedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await Promise.all([
          this.page.waitForURL(targetUrlPattern, { timeout: 10000 }),
          this.clickElement(appliedLink, { timeout: 10000 }),
        ]);
      } else {
        await this.navigate('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html');
      }
    } catch (_err) {
      if (!targetUrlPattern.test(this.page.url())) {
        await this.navigate('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html');
      }
    }
  }

  async expectAppliedJobsVisible() {
    await expect(this.appliedJobsList).toBeVisible({ timeout: 30000 });
  }

  async submitPhoneVerificationOtp(otpCode, options = {}) {
    if (!otpCode) {
      throw new Error('OTP code is required to complete phone verification.');
    }

    const {
      codeStepTimeout = 15000,
      loadingTimeout = 15000,
      confirmButton,
    } = options;
    const locators = this.getPhoneVerificationLocators();

    await this.waitForPhoneVerificationCodeStepVisible(locators, codeStepTimeout);
    await this.fillPhoneVerificationCode(locators, otpCode);

    if (confirmButton) {
      await this.clickElement(confirmButton);
      await this.waitForGlobalLoadingHidden(loadingTimeout);
    }
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
