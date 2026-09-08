const { OnboardingPopup } = require('../desktop/OnboardingPopup');

class MobileOnboardingPopup extends OnboardingPopup {
  constructor(page) {
    super(page);
    this.selectModalContainer = page.locator('[data-test-id="select__modal-menu__container"]');
  }

  async selectIndustry(industry) {
    await this.actions.waitForVisible(this.step2Title);
    await this.clickElement(this.industryDropdown);

    // On mobile, industry dropdown opens a full-screen drawer modal
    const industryOption = this.page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: industry }).first();
    await this.clickElement(industryOption);

    // Close the full-screen selection modal by tapping outside the menu list so selection is preserved
    if (await this.selectModalContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      const viewport = this.page.viewportSize() || { width: 390, height: 844 };
      await this.page.mouse.click(Math.round(viewport.width / 2), Math.min(600, viewport.height - 100));
      await this.selectModalContainer.waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
        await this.page.mouse.click(10, 10).catch(() => {});
        await this.selectModalContainer.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      });
    }
  }
}

module.exports = { MobileOnboardingPopup };
