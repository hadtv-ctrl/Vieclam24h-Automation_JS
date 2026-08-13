const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { ScreenshotHelper } = require('../core/utils/commonUtils');

class OnboardingPopup extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page); 
    this.screenshotHelper = new ScreenshotHelper(page, 'onboarding-flow');

    this.nextBtn = page.locator('button:has-text("Tiếp theo")').first();
    this.submitBtn = page.locator('button:has-text("Xem công việc phù hợp")').first();
    this.closeBtn = page.locator('[data-test-id="common__close-button"]').first();
    this.modal = page.locator('form, [role="dialog"], div').filter({
      hasText: /Bạn đang tìm việc ở khu vực nào\?|Bạn đang quan tâm đến ngành nghề nào\?|Bạn đang muốn tìm công việc gì\?/i,
    }).first();
    this.overlayLoading = page.locator('.overlay-loading'); // Thêm locator cho overlay loading

    this.step1Title = page.getByText('Bạn đang tìm việc ở khu vực nào?').first();
    this.locationInput = page.getByText('Tìm khu vực tỉnh thành').first();
    this.hcmLocationBtn = page.getByRole('button', { name: 'TP.HCM', exact: true }).first();
    this.hnLocationBtn = page.getByRole('button', { name: 'Hà Nội' }).first();
    this.anGiangLocationOption = page.locator('.custom-scrollbar').getByText('An Giang').first();

    this.step2Title = page.getByText('Bạn đang quan tâm đến ngành nghề nào?').first();
    this.industryDropdown = page.getByText(/Chọn ngành nghề/i).first();
    this.adminIndustryOption = page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: 'Hành chính - Thư ký' }).first();

    this.step3Title = page.getByText('Bạn đang muốn tìm công việc gì?').first();
    this.jobTitleInput = page.getByPlaceholder('VD: Nhân viên bán hàng; Thu ngân,...').first();
    this.selectItem = page.locator('[data-test-id="common__select-dropdown"]').getByText('nhân viên văn phòng').first();

    this.step4Title = page.getByText('Mức lương mong muốn của bạn?').first();
    this.salaryOption1 = page.getByRole('button', { name: '10 - 15 triệu', exact: true }).first();
    this.salaryOption2 = page.getByRole('button', { name: '15 - 20 triệu', exact: true }).first();

    this.step5Title = page.getByText('Bạn đã có bao nhiêu năm kinh nghiệm?').first();
    this.yearsOption1 = page.getByRole('button', { name: '1 năm', exact: true }).first();
    this.yearsOption2 = page.getByRole('button', { name: '2 năm', exact: true }).first();
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
      const waitHiddenTimeout = opts.overlayTimeout ?? 15000;
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
    const closeButton = modal.locator('[data-test-id="common__close-button"]').first();
    const modalTimeout = opts.modalTimeout ?? 15000;
    const closeBtnTimeout = opts.closeBtnTimeout ?? 5000;
    const modalHiddenTimeout = opts.modalHiddenTimeout ?? 5000;
    const modalDetachedTimeout = opts.modalDetachedTimeout ?? 5000;

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

        let clicked = false;
        try {
          await closeButton.click();
          clicked = true;
        } catch (clickErr) {
          try {
            await closeButton.click({ force: true });
            clicked = true;
          } catch (forceErr) {
            try {
              await closeButton.evaluate((el) => el.click());
              clicked = true;
            } catch (evalErr) {
              throw evalErr;
            }
          }
        }

        if (!clicked) throw new Error('Unable to click close button');

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
        }

        try {
          await modal.waitFor({ state: 'detached', timeout: modalDetachedTimeout });
        } catch (detachedErr) {
          console.warn('Modal did not detach within timeout:', detachedErr.message || detachedErr);
        }

        try {
          await this.page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (niErr) {
          // ignore networkidle timeouts — not critical
        }

        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`Attempt ${i + 1} to close onboarding modal failed:`, err.message || err);
        await this.page.waitForTimeout(500);
      }
    }

    if (lastErr) {
      try {
        await this.page.evaluate(() => {
          document.querySelectorAll('.overlay-loading').forEach(el => el.remove());
          document.querySelectorAll('form, [role="dialog"], div').forEach((f) => {
            try {
              if (f.innerText && /Bạn đang tìm việc ở khu vực nào\?|Bạn đang quan tâm đến ngành nghề nào\?|Bạn đang muốn tìm công việc gì\?/i.test(f.innerText)) {
                f.remove();
              }
            } catch (e) {
              // ignore
            }
          });
          document.querySelectorAll('[data-test-id="common__close-button"]').forEach(el => el.remove());
        });

        try {
          await this.page.waitForTimeout(500);
          await modal.waitFor({ state: 'detached', timeout: 2000 });
          await this.capture('onboarding_removed_by_dom', true);
          return;
        } catch (detErr) {
          console.warn('DOM removal fallback could not detach modal:', detErr.message || detErr);
        }
      } catch (domErr) {
        console.warn('Error during DOM removal fallback:', domErr.message || domErr);
      }

      try {
        await this.capture('onboarding_close_failure', true);
      } catch (capErr) {
        // ignore capture errors
      }
      throw lastErr;
    }
  }

  async selectLocationButton(location) {
    await expect(this.step1Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step1Title);
    const locationBtn = this.page.getByRole('button', { name: location }).first();
    return this.clickElement(locationBtn);
  }

  async selectLocationOption(location) {
    await this.actions.waitForVisible(this.step1Title);
    await expect(this.locationInput).toBeVisible({ timeout: 15000 });
    await this.clickElement(this.locationInput, { force: true });
    const locationOption = this.page.locator('.custom-scrollbar').getByText(location).first();
    return this.clickElement(locationOption);
  }

  async selectIndustry(industry) {
    await this.actions.waitForVisible(this.step2Title);
    await this.clickElement(this.industryDropdown);
    const industryOption = this.page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: industry }).first();
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
    const salaryBtn = this.page.getByRole('button', { name: salary }).first();
    return this.clickElement(salaryBtn);
  }

  async selectYears(years) {
    await expect(this.step5Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step5Title);
    const yearsBtn = this.page.getByRole('button', { name: years }).first();
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
