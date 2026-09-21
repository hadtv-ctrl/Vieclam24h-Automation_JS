const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { LoginPopup } = require('./LoginPopup');

/**
 * ChopChatbotPage — Page Object cho cửa sổ popup Chop AI chatbot.
 * Nhận `page` là popup page (context khác với main page), không phải main page.
 */
class ChopChatbotPage extends BasePage {
  constructor(page, featureName) {
    super(page, featureName);

    // Chat controls
    this.chatInput = page.getByRole('textbox', { name: 'Nhập nội dung' });
    this.sendBtn = page.locator('[data-test-id="ai-chatbot__send-button"]');

    // Intro / skip panel
    this.introPanel = page.locator('.relative.flex.w-full.bg-white').first();

    // City picker: TP.HCM
    this.btnCityHCM = page.getByRole('button', { name: 'TP.HCM' })
      .or(page.locator('[data-test-id="common__button"]').filter({ hasText: /^TP\.HCM$/ }))
      .first();

    // Salary picker: "Từ ... triệu trở lên"
    this.salaryOptions = page.getByRole('button', { name: /Từ \d+ triệu trở lên/i });

    // Job count button (text động)
    this.jobCountBtn = page.getByRole('button', { name: /Có \d+ công việc phù hợp/i });

    // Drawer triggers
    this.occupationTrigger = page.locator('[data-test-id="ai-chatbot__occupation-select__trigger"]');
    this.locationFilterTrigger = page.locator('[data-test-id="ai-chatbot__location-select__trigger"]');
    this.locationDropdown = page.locator('[data-test-id="select-dropdown__option-list"]');
    this.applyLocationBtn = page.getByRole('button', { name: 'Áp dụng' });
    this.salaryFilterTrigger = page.locator('[data-test-id="ai-chatbot__salary-select__trigger"]');
    this.experienceFilterTrigger = page.locator('[data-test-id="ai-chatbot__experience-range-select__trigger"]');

    // Shared filter controls
    this.doneBtn = page.getByRole('button', { name: 'Hoàn tất' });
    this.clearSingleFilterBtn = page.getByRole('button', { name: 'Xoá bộ lọc' });
    this.clearAllFiltersBtn = page.locator('[data-test-id="ai-chatbot__clear-filter"]');

    // Job detail modal
    this.jobDetailCloseBtn = page.locator('[data-test-id="common__close-button"]');
  }

  /**
   * Đăng nhập trên popup chatbot bằng tài khoản tạo từ API nếu xuất hiện modal login
   * @param {Object} user - Thông tin tài khoản { phone, email, otp }
   */
  async loginIfVisible(user) {
    if (!user) return;
    const loginPopup = new LoginPopup(this.page, this.featureName);
    if (await loginPopup.phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const phone = user.phone || user.username;
      await loginPopup.fillPhone(phone);
      await loginPopup.clickContinueUntilOtpVisible({
        maxAttempts: 3,
        otpTimeout: 10000,
        loadingTimeout: 15000,
      });
      const otpCode = user.otp || '1111';
      await loginPopup.fillOtpCode(otpCode);

      const consentAgreeBtn = this.page.getByRole('button', { name: 'Đồng ý' });
      if (await consentAgreeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await consentAgreeBtn.click({ force: true }).catch(() => null);
      }

      await loginPopup.otpInputs.first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    }
  }

  async dismissIntroIfVisible() {
    if (await this.introPanel.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.introPanel.click({ force: true }).catch(() => null);
    }
  }

  async enterChatMessage(message) {
    await this.actions.waitForVisible(this.chatInput, { timeout: 10000 });
    await this.chatInput.click();
    await this.chatInput.fill(message);
  }

  async clickSendMessage() {
    await this.actions.waitForVisible(this.sendBtn, { timeout: 5000 });
    await this.sendBtn.click();
  }

  async sendChatMessage(message) {
    await this.enterChatMessage(message);
    await this.clickSendMessage();
  }

  async selectCityHCM() {
    await this.actions.waitForVisible(this.btnCityHCM, { timeout: 15000 });
    await this.clickElement(this.btnCityHCM);
  }

  async selectInitialSalaryAndSend() {
    await this.actions.waitForVisible(this.salaryOptions.first(), { timeout: 15000 });
    // Chọn option đầu tiên (ví dụ 9tr) để sau này lọc 15tr không bị disable
    await this.clickElement(this.salaryOptions.first());
    await this.clickElement(this.sendBtn);
  }

  async viewJobResults() {
    const btn = this.jobCountBtn.last();
    await this.actions.waitForVisible(btn, { timeout: 25000 });
    await btn.click();
    const suggestedJobsTitle = this.page.getByText(/Công việc gợi ý cho bạn/i).first();
    await suggestedJobsTitle.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
  }

  // Industry / Occupation filter
  async openIndustryFilter() {
    const trigger = this.occupationTrigger.last();
    await this.actions.waitForVisible(trigger, { timeout: 15000 });
    await trigger.click();
  }

  async selectIndustry(industryName) {
    const option = this.page.getByRole('button', { name: industryName }).first();
    await this.actions.waitForVisible(option, { timeout: 10000 });
    await option.click();
  }

  async confirmFilter() {
    await this.actions.waitForVisible(this.doneBtn, { timeout: 10000 });
    await this.doneBtn.click();
  }

  async clearActiveFilter() {
    await this.actions.waitForVisible(this.clearSingleFilterBtn, { timeout: 10000 });
    await this.clearSingleFilterBtn.click();
  }

  // Location filter
  async openLocationFilter() {
    const trigger = this.locationFilterTrigger.last();
    await this.actions.waitForVisible(trigger, { timeout: 15000 });
    await trigger.click();
  }

  async selectLocationOption(name) {
    const trimmed = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dropdown = this.page.locator('[data-test-id="select-dropdown__option-list"]');
    const option = dropdown.getByRole('button', { name: new RegExp(`^${trimmed}\\s*$`, 'i') })
      .or(dropdown.locator('button').filter({ hasText: new RegExp(`^${trimmed}\\s*$`, 'i') }))
      .first();
    await this.actions.waitForVisible(option, { timeout: 15000 });
    await option.click();
  }

  async applyLocationFilter() {
    const applyBtn = this.page.getByRole('button', { name: 'Áp dụng' }).last();
    await this.actions.waitForVisible(applyBtn, { timeout: 10000 });
    await applyBtn.click();
  }

  async clearLocationFilter() {
    await this.openLocationFilter();
    const clearBtn = this.page.getByRole('button', { name: 'Xoá bộ lọc' }).last();
    await this.actions.waitForVisible(clearBtn, { timeout: 10000 });
    await clearBtn.click();
  }

  // Salary filter
  async openSalaryFilterAfterScroll() {
    const scrollRight = this.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
    const salaryTrigger = this.salaryFilterTrigger.last();
    await this.actions.waitForVisible(salaryTrigger, { timeout: 15000 });
    await salaryTrigger.click();
  }

  async selectSalaryOption(salaryOption) {
    const validOption = this.page.locator('button:not([disabled])').filter({ hasText: new RegExp(`^${salaryOption.trim()}$`, 'i') })
      .or(this.page.locator('.text-secondary-100, span').filter({ hasText: new RegExp(`^${salaryOption.trim()}$`, 'i') }))
      .last();
    await this.actions.waitForVisible(validOption, { timeout: 10000 });
    await validOption.click();
  }

  async confirmFilter() {
    const doneBtn = this.page.getByRole('button', { name: 'Hoàn tất' }).last();
    await this.actions.waitForVisible(doneBtn, { timeout: 10000 });
    await doneBtn.click();
  }

  async clearSalaryFilter() {
    await this.openSalaryFilterAfterScroll();
    const clearBtn = this.page.getByRole('button', { name: 'Xoá bộ lọc' }).last();
    await this.actions.waitForVisible(clearBtn, { timeout: 10000 });
    await clearBtn.click();
  }

  // Experience filter
  async scrollToExperienceFilterBar() {
    const scrollRight = this.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
  }

  async openExperienceFilter() {
    const scrollRight = this.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
    const expTrigger = this.experienceFilterTrigger.last();
    await this.actions.waitForVisible(expTrigger, { timeout: 15000 });
    await expTrigger.click();
  }

  async selectExperienceOption(expOption) {
    const validOption = this.page.locator('button:not([disabled])').filter({ hasText: new RegExp(`^${expOption.trim()}$`, 'i') })
      .or(this.page.locator('.text-secondary-100, span').filter({ hasText: new RegExp(`^${expOption.trim()}$`, 'i') }))
      .last();
    await this.actions.waitForVisible(validOption, { timeout: 10000 });
    await validOption.click();
  }

  async clearAllFilters() {
    const btn = this.clearAllFiltersBtn.last();
    await this.actions.waitForVisible(btn, { timeout: 10000 });
    await btn.click();
  }

  // Job card
  async openFirstJobCard() {
    const jobCards = this.page.locator('.flex.flex-col.gap-3 > .flex.items-center.justify-between')
      .or(this.page.locator('div').filter({ hasText: /Còn \d+ ngày/i }));
    await this.actions.waitForVisible(jobCards.first(), { timeout: 15000 });
    await jobCards.first().click();
  }

  async closeJobDetailModal() {
    const closeBtn = this.page.locator('[data-test-id="common__modal__close-btn"], [data-test-id="common__close-button"], button:has(svg)').last();
    await this.actions.waitForVisible(closeBtn, { timeout: 10000 });
    await closeBtn.click();
  }

  // Assertions
  async expectJobCountVisible() {
    const btn = this.jobCountBtn.last();
    await expect(btn).toBeVisible({ timeout: 25000 });
  }

  async expectLocationFilterDisplayed(locationDisplay) {
    await expect(this.page.getByText(new RegExp(locationDisplay, 'i')).first()).toBeVisible({ timeout: 10000 });
  }

  async expectSalaryFilterDisplayed(salaryDisplay) {
    const chip = this.salaryFilterTrigger.last();
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText(salaryDisplay);
  }

  async expectExperienceFilterDisplayed(expDisplay) {
    const chip = this.experienceFilterTrigger.last();
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText(expDisplay);
  }
}

module.exports = { ChopChatbotPage };
