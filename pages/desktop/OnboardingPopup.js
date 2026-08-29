const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');

class OnboardingPopup extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'onboarding-flow');

    this.nextBtn = page.locator('button:has-text("Tiếp theo")').first();
    this.submitBtn = page.locator('button:has-text("Xem công việc phù hợp")').first();
    this.modal = page.locator('#common__modal, [data-test-id="common__form-modal"], [role="dialog"]').filter({
      hasText: /Bạn đang tìm việc ở khu vực nào\?|Bạn đang quan tâm đến ngành nghề nào\?|Bạn đang muốn tìm công việc gì\?/i,
    }).first();
    this.closeBtn = page.locator('#common__modal [data-test-id="common__close-button"], [data-test-id="common__form-modal"] [data-test-id="common__close-button"], [role="dialog"] [data-test-id="common__close-button"]').first();
    this.overlayLoading = page.locator('.overlay-loading'); // Thêm locator cho overlay loading

    this.step1Title = this.modal.getByText('Bạn đang tìm việc ở khu vực nào?');
    this.locationInput = this.modal.getByText('Tìm khu vực tỉnh thành');
    this.hcmLocationBtn = this.modal.getByRole('button', { name: 'TP.HCM', exact: true });
    this.hnLocationBtn = this.modal.getByRole('button', { name: 'Hà Nội' });
    this.anGiangLocationOption = page.locator('.custom-scrollbar').getByRole('heading', { name: 'An Giang' });

    this.step2Title = this.modal.getByText('Bạn đang quan tâm đến ngành nghề nào?');
    this.industryDropdown = this.modal.getByText(/Chọn ngành nghề/i);
    this.adminIndustryOption = page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: 'Hành chính - Thư ký' });

    this.step3Title = this.modal.getByText('Bạn đang muốn tìm công việc gì?');
    this.jobTitleInput = this.modal.getByPlaceholder('VD: Nhân viên bán hàng; Thu ngân,...');
    this.selectItem = page.locator('[data-test-id="common__select-dropdown"] li').filter({ hasText: /^nhân viên văn phòng$/i });

    this.step4Title = this.modal.getByText('Mức lương mong muốn của bạn?');
    this.salaryOption1 = this.modal.getByRole('button', { name: '10 - 15 triệu', exact: true });
    this.salaryOption2 = this.modal.getByRole('button', { name: '15 - 20 triệu', exact: true });

    this.step5Title = this.modal.getByText('Bạn đã có bao nhiêu năm kinh nghiệm?');
    this.yearsOption1 = this.modal.getByRole('button', { name: '1 năm', exact: true });
    this.yearsOption2 = this.modal.getByRole('button', { name: '2 năm', exact: true });
  }

  async clickLocationInput() {
    return this.clickElement(this.locationInput, { force: true });
  }

  async clickNext() {
    return this.clickElement(this.nextBtn);
  }

  async clickNextAndWaitForNextStep(nextStepElement, opts = {}) {
    await this.clickNext();

    // If overlay appears, wait for it to hide. If it doesn't appear within a short window, continue.
    try {
      const detectTimeout = opts.detectTimeout ?? 2000; // short wait to see if overlay shows up
      const waitHiddenTimeout = opts.overlayTimeout ?? 30000;
      if (await this.overlayLoading.isVisible({ timeout: detectTimeout })) {
        await this.overlayLoading.waitFor({ state: 'hidden', timeout: waitHiddenTimeout });
      }
    } catch (err) {
      // Don't fail the whole step just because overlay didn't hide — continue to wait for the next step element.
      // Log for diagnostics; avoid throwing so tests can continue and surface the real failure on the next-step check.
      console.warn('Overlay loading did not hide within expected time:', err.message || err);
    }

    await this.waitForElement(nextStepElement); // Chờ element của bước tiếp theo ổn định
  }

  async clickSubmit() {
    return this.clickElement(this.submitBtn);
  }

  async clickClose() {
    return this.clickElement(this.closeBtn);
  }

  async closeIfVisible(captureName, opts = {}) {
    const modal = this.modal;
    const closeButton = this.closeBtn;
    const modalTimeout = opts.modalTimeout ?? 15000;
    const closeBtnTimeout = opts.closeBtnTimeout ?? 5000;
    const modalHiddenTimeout = opts.modalHiddenTimeout ?? 5000;

    try {
      await modal.waitFor({ state: 'visible', timeout: modalTimeout });
    } catch (err) {
      return;
    }

    if (captureName) {
      await this.capture(captureName);
    }

    const attempts = opts.attempts ?? 3;
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.actions.waitForVisible(closeButton, { timeout: closeBtnTimeout });

        try {
          await closeButton.click();
        } catch (clickErr) {
          await closeButton.click({ force: true });
        }

        try {
          await modal.waitFor({ state: 'hidden', timeout: modalHiddenTimeout });
        } catch (hiddenErr) {
          try {
            if (await this.overlayLoading.isVisible({ timeout: 1000 }).catch(() => false)) {
              await this.overlayLoading.waitFor({ state: 'hidden', timeout: opts.overlayTimeout ?? 15000 });
            }
          } catch (ovErr) {
            console.warn('Overlay did not hide promptly after close click:', ovErr.message || ovErr);
          }
          await this.page.keyboard.press('Escape');
          await modal.waitFor({ state: 'hidden', timeout: modalHiddenTimeout });
        }

        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`Attempt ${i + 1} to close onboarding modal failed:`, err.message || err);
      }
    }

    if (lastErr) {
      throw lastErr;
    }
  }

  async selectLocationButton(location) {
    await expect(this.step1Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step1Title);
    const locationBtn = this.modal.getByRole('button', { name: location });
    return this.clickElement(locationBtn);
  }

  async selectLocationOption(location) {
    await this.actions.waitForVisible(this.step1Title);
    await expect(this.locationInput).toBeVisible({ timeout: 15000 });
    await this.clickElement(this.locationInput, { force: true });
    const locationOption = this.page.locator('.custom-scrollbar').getByRole('heading', { name: location });
    return this.clickElement(locationOption);
  }

  async selectIndustry(industry) {
    await this.actions.waitForVisible(this.step2Title);
    await this.clickElement(this.industryDropdown);
    const industryOption = this.page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: industry });
    return this.clickElement(industryOption);
  }

  async inputJobTitle(jobTitle) {
    await expect(this.step3Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step3Title);
    return this.fillInput(this.jobTitleInput, jobTitle);
  }

  async selectSuggestedJobTitle() {
    await expect(this.step3Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.selectItem);
    return this.clickElement(this.selectItem, { force: true });
  }

  async selectSalary(salary) {
    await expect(this.step4Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step4Title);
    const salaryBtn = this.modal.getByRole('button', { name: salary });
    return this.clickElement(salaryBtn);
  }

  async selectYears(years) {
    await expect(this.step5Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step5Title);
    const yearsBtn = this.modal.getByRole('button', { name: years });
    return this.clickElement(yearsBtn);
  }

  /**
   * Debug helper: returns visibility, counts and bounding boxes for key onboarding elements.
   * Useful when close doesn't work to inspect why the element isn't clickable (overlay, iframe, etc.).
   */
  async debugState() {
    const info = {};
    try {
      info.closeBtnCount = await this.page.locator('[data-test-id="common__close-button"]').count();
      info.closeBtnVisible = info.closeBtnCount > 0 ? await this.page.locator('[data-test-id="common__close-button"]').first().isVisible() : false;
      info.modalCount = await this.page.locator('form:has(h2:has-text("Bạn đang tìm việc ở khu vực nào?"))').count();
      info.modalVisible = info.modalCount > 0 ? await this.page.locator('form:has(h2:has-text("Bạn đang tìm việc ở khu vực nào?"))').first().isVisible() : false;

      const cbLoc = await this.page.locator('[data-test-id="common__close-button"]').first();
      info.closeBtnBox = null;
      try {
        const box = await cbLoc.boundingBox();
        if (box) info.closeBtnBox = { x: box.x, y: box.y, width: box.width, height: box.height };
      } catch (e) {
        info.closeBtnBox = 'boundingBox-error';
      }

      info.overlayCount = await this.page.locator('.overlay-loading').count();
      info.overlayVisible = info.overlayCount > 0 ? await this.page.locator('.overlay-loading').first().isVisible() : false;

      // Get outerHTML snippets (truncated) for diagnosis
      info.closeBtnOuter = await this.page.locator('[data-test-id="common__close-button"]').first().evaluate((el) => el.outerHTML.slice(0, 1000)).catch(() => null);
      info.modalOuter = await this.page.locator('form:has(h2:has-text("Bạn đang tìm việc ở khu vực nào?"))').first().evaluate((el) => el.outerHTML.slice(0, 2000)).catch(() => null);

      // Frames info — list frame urls and names
      info.frames = this.page.frames().map(f => ({ name: f.name(), url: f.url() }));
    } catch (err) {
      info.error = String(err.message || err);
    }
    return info;
  }
}

module.exports = { OnboardingPopup };
