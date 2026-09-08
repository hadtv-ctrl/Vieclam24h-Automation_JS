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
      '[data-test-id="common__close-button"], [aria-label*="close" i], button:has(.svicon-close), .svicon-close, button:has-text("Để sau")'
    );
    this.fullscreenPopup = page
      .locator('.fixed.inset-0:visible')
      .filter({ has: page.locator('.svicon-close, [data-test-id="common__close-button"]') });
    this.fullscreenPopupCloseBtn = this.fullscreenPopup.locator(
      '[data-test-id="common__close-button"], [aria-label*="close" i], button:has(.svicon-close), .svicon-close, button:has-text("Để sau")'
    );

    // Mobile specific search button or link
    this.mobileSearchLink = page.getByRole('link', { name: /Tìm việc làm/i })
      .or(page.locator('a[href*="tim-kiem-viec-lam-nhanh"]'))
      .first();
  }

  async navigate(relativeUrl = '/') {
    await super.navigate(relativeUrl);
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
    if (!(await visiblePopup.isVisible().catch(() => false))) return false;

    const visibleCloseButton = closeButton.first();
    await this.actions.click(visibleCloseButton, { force: true, timeout: 10000 });
    try {
      await visiblePopup.waitFor({ state: 'hidden', timeout: 10000 });
    } catch (error) {
      throw new Error(`Không thể đóng ${popupName} đang che màn hình: ${error.message}`);
    }
    return true;
  }

  /**
   * Mở trang tìm kiếm việc làm trên Mobile:
   * Click link tìm việc hoặc điều hướng URL tương đối
   */
  async openJobSearch() {
    await this.closeNavigationPopups();
    try {
      if (await this.mobileSearchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await Promise.all([
          this.page.waitForURL(/\/tim-kiem-viec-lam-nhanh(?:[/?#]|$)/i, { timeout: 30000 }),
          this.actions.click(this.mobileSearchLink),
        ]);
        return;
      }
    } catch (e) {
      // Tiếp tục fallback
    }

    await this.navigate('/tim-kiem-viec-lam-nhanh.html');
  }
}

module.exports = { MobileHomePage };
