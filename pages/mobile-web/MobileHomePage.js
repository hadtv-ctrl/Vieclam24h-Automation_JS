const { HomePage } = require('../desktop/HomePage');

class MobileHomePage extends HomePage {
  constructor(page, featureName) {
    super(page, featureName);
    this.appInstallPopup = page.locator('.mbep-popup');
    this.appInstallPopupCloseBtn = this.appInstallPopup.locator('button:has(.svicon-close)');
    this.commonPopup = page.locator('#common__modal:visible');
    this.commonPopupCloseBtn = this.commonPopup.locator(
      '[data-test-id="common__close-button"], button:has(.svicon-close), .svicon-close'
    );
    this.dialogPopup = page.locator('[role="dialog"]:visible');
    this.dialogPopupCloseBtn = this.dialogPopup.locator(
      '[data-test-id="common__close-button"], button:has(.svicon-close), button[aria-label*="close" i]'
    );
    this.fullscreenPopup = page
      .locator('.fixed.inset-0:visible')
      .filter({ has: page.locator('button:has(.svicon-close)') });
    this.fullscreenPopupCloseBtn = this.fullscreenPopup.locator('button:has(.svicon-close)');
  }

  async navigate() {
    await super.navigate();
    await this.closeNavigationPopups();
  }

  async closeNavigationPopups() {
    await this.closePopupIfVisible(this.appInstallPopup, this.appInstallPopupCloseBtn, 'popup mở app');
    await this.closePopupIfVisible(this.commonPopup, this.commonPopupCloseBtn, 'common modal');
    await this.closePopupIfVisible(this.dialogPopup, this.dialogPopupCloseBtn, 'dialog');
    await this.closePopupIfVisible(this.fullscreenPopup, this.fullscreenPopupCloseBtn, 'fullscreen popup');
  }

  async closePopupIfVisible(popup, closeButton, popupName) {
    const visiblePopup = popup.first();
    if (!(await visiblePopup.isVisible())) return false;

    const visibleCloseButton = closeButton.first();
    await this.actions.click(visibleCloseButton, { force: true, timeout: 10000 });
    try {
      await visiblePopup.waitFor({ state: 'hidden', timeout: 10000 });
    } catch (error) {
      throw new Error(`Không thể đóng ${popupName} đang che màn hình: ${error.message}`);
    }
    return true;
  }
}

module.exports = { MobileHomePage };
