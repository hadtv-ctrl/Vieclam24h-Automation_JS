const { PersonalizePage } = require('../desktop/PersonalizePage');

class MobilePersonalizePage extends PersonalizePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [featureName]
   */
  constructor(page, featureName) {
    super(page, featureName);

    // Popup mời cài app đặc thù trên Mobile Web
    this.appInstallPopup = page.locator('.mbep-popup');
    this.appInstallPopupCloseBtn = this.appInstallPopup.locator('button:has(.svicon-close), button.close, [class*="close"]');

    // Input mức lương tối thiểu trên mobile
    this.minSalaryInput = page.locator('input[placeholder*="VD" i], input[role="textbox"]').first().or(page.getByRole('textbox', { name: /VD/i }));
  }

  /**
   * Đóng popup cài app trên mobile nếu xuất hiện
   */
  async closeAppInstallPopupIfVisible() {
    try {
      const popup = this.appInstallPopup.first();
      if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
        const btn = this.appInstallPopupCloseBtn.first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true }).catch(() => null);
        }
      }
    } catch (_) { }
  }

  /**
   * Đóng banner quảng cáo cản trở trên mobile nhưng bảo toàn form xác thực
   */
  async closeBannerIfVisible() {
    try {
      await this.closeAppInstallPopupIfVisible();
      const promoClose = this.page.locator('.ReactModalPortal .svicon-close, [class*="close-banner"], .absolute.top-1.right-1').first();
      if (await promoClose.isVisible({ timeout: 1500 }).catch(() => false)) {
        await promoClose.click({ force: true }).catch(() => null);
      }
    } catch (_) { }
  }

  /**
   * Điều hướng đến Personalized Page và chỉ dọn dẹp các banner quảng cáo/app popup
   * Tuyệt đối không đóng dialog/modal đăng nhập vì Personalized Page cho khách bắt buộc hiển thị form này
   */
  async navigateToPersonalizedPage() {
    await super.navigateToPersonalizedPage();
    await this.closeBannerIfVisible();
  }

  async navigate() {
    await this.navigateToPersonalizedPage();
  }

  /**
   * Hoàn tất Bước 1 Onboarding mini trên Mobile Web:
   * Trên Mobile Web, nút "Nhập vị trí công việc" cần được click trước để mở input nhập liệu
   */
  async completeStep1JobTitle(jobTitle = 'nhân viên bán hàng') {
    const openJobTitleBtn = this.page.getByRole('button', { name: /Nhập vị trí công việc/i })
      .or(this.page.locator('button').filter({ hasText: /Nhập vị trí công việc/i }))
      .first();

    if (await openJobTitleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(openJobTitleBtn);
    }

    const input = this.page.locator('input[name="job_title"], input[placeholder*="vị trí công việc" i], [data-test-id="common__input"], input[placeholder*="Tìm" i]').first();
    await this.waitForElement(input, 15000);
    await this.capture('onboarding_01_job_title_before_input');
    await this.actions.click(input);
    await this.actions.fill(input, jobTitle);

    // Tìm item gợi ý và click với force: true để tránh overlay chặn pointer events
    const suggestionItem = this.page.locator('[role="listitem"], li, [data-test-id*="select-dropdown"] li, [data-test-id*="select-dropdown"] div')
      .filter({ hasText: new RegExp(`^${jobTitle}`, 'i') })
      .first();
    await suggestionItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null);

    if (await suggestionItem.isVisible().catch(() => false)) {
      await suggestionItem.click({ force: true }).catch(() => null);
    }

    // Đóng drawer nếu còn che màn hình
    const closeDrawerBtn = this.page.locator('.dialog_bodyTouchPanY__SL4Bq, [data-test-id="common__dialog"]')
      .locator('button, [cursor="pointer"]')
      .filter({ hasText: /|close/i })
      .first();
    if (await closeDrawerBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeDrawerBtn.click({ force: true }).catch(() => null);
    }

    await this.capture('onboarding_02_job_title_entered');

    const nextBtn = this.page.getByRole('button', { name: /Tiếp theo|Tiếp tục/i }).first();
    await nextBtn.click({ force: true });
  }

  /**
   * Hoàn tất Bước 2 Onboarding mini trên Mobile Web:
   * Chọn các khu vực mong muốn và click Tiếp theo
   */
  async completeStep2Locations(locations = ['TP.HCM']) {
    const step2Indicator = this.chonToiDa5Text.or(this.page.getByText(/Chọn tối đa 5 khu vực/i)).first();
    await this.waitForElement(step2Indicator, 15000);
    await this.capture('onboarding_03_locations_before_select');

    for (const loc of locations) {
      const btn = this.page.getByRole('button', { name: new RegExp(`^${loc}`, 'i') })
        .or(this.page.locator('button, [role="button"]').filter({ hasText: new RegExp(`^${loc}`, 'i') }))
        .first();
      await this.waitForElement(btn, 10000);
      await btn.click({ force: true });
    }
    await this.capture('onboarding_04_locations_selected');

    const nextBtn = this.page.getByRole('button', { name: /Tiếp theo|Tiếp tục/i }).first();
    await nextBtn.click({ force: true });
  }

  /**
   * Hoàn tất Bước 3 Onboarding mini trên Mobile Web:
   * Điền khoảng mức lương mong muốn và click Hoàn tất
   */
  async completeStep3Salary(minSalary = '10', maxSalary = '15') {
    await this.capture('onboarding_05_salary_before_input');
    const salaryInput = this.page.locator('input[placeholder*="VD" i], input[role="textbox"]').first();
    await this.waitForElement(salaryInput, 10000);

    const inputs = this.page.locator('input[placeholder*="VD" i], input[role="textbox"]');
    if (await inputs.count() >= 2) {
      await inputs.nth(0).fill(minSalary);
      await inputs.nth(1).fill(maxSalary);
    }
    await this.capture('onboarding_05_step3_salary_range_entered');

    const submitBtn = this.page.getByRole('button', { name: /Hoàn tất/i }).first();
    await submitBtn.click({ force: true });
  }

  /**
   * Điều hướng trực tiếp đến Personalized Page và hoàn tất xác thực đến Bước 1 trên Mobile
   */
  async reachOnboardingStep1JobTitle(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    await this.navigateToPersonalizedPage();
    await this.closeBannerIfVisible();
    await this.registerPhoneAndOtp(phone || generateRandomVNPhone(), otp);
    await this.enterFullNameAndAcceptConsent(fullName);

    const step1Indicator = this.page.getByRole('button', { name: /Nhập vị trí công việc/i })
      .or(this.page.locator('button').filter({ hasText: /Nhập vị trí công việc/i }))
      .or(this.jobTitleInput)
      .first();
    await this.waitForElement(step1Indicator, 15000);
    await this.capture('onboarding_step1_job_title_ready');
  }

  /**
   * Điều hướng trực tiếp đến Personalized Page và hoàn tất xác thực để đến Bước 2 (Khu vực) trên Mobile
   */
  async reachOnboardingStep2Locations(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    await this.reachOnboardingStep1JobTitle(phone, otp, fullName);
    await this.completeStep1JobTitle('nhân viên bán hàng');
    await this.waitForElement(this.chonToiDa5Text, 15000);
    await this.capture('onboarding_step2_locations_ready');
  }

  /**
   * Chọn lần lượt 5 khu vực hợp lệ ban đầu trên Mobile Web
   */
  async select5Locations(options = {}) {
    await this.waitForElement(this.chonToiDa5Text, 15000);
    const locationNames = ['TP.HCM', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Cần Thơ'];
    for (const name of locationNames) {
      const btn = this.page.getByRole('button', { name: new RegExp(`^${name}`, 'i') })
        .or(this.page.locator('button, [role="button"]').filter({ hasText: new RegExp(`^${name}`, 'i') }))
        .first();
      await this.waitForElement(btn, 10000);
      await btn.click({ force: true });
    }
    if (options.capture !== false) {
      await this.capture('step2_5_locations_selected');
    }
  }

  /**
   * Bỏ chọn một khu vực làm việc trên Mobile Web
   */
  async deselectLocation(btnName = 'Cần Thơ', options = {}) {
    const btn = this.page.getByRole('button', { name: new RegExp(`^${btnName}`, 'i') })
      .or(this.page.locator('button, [role="button"]').filter({ hasText: new RegExp(`^${btnName}`, 'i') }))
      .first();
    await btn.click({ force: true });
    if (options.capture) {
      await this.capture('location_deselected');
    }
  }

  /**
   * Chọn lại một khu vực làm việc trên Mobile Web
   */
  async selectSingleLocation(btnName = 'Cần Thơ', options = {}) {
    const btn = this.page.getByRole('button', { name: new RegExp(`^${btnName}`, 'i') })
      .or(this.page.locator('button, [role="button"]').filter({ hasText: new RegExp(`^${btnName}`, 'i') }))
      .first();
    await btn.click({ force: true });
    if (options.capture) {
      await this.capture('location_selected');
    }
  }

  /**
   * Mở danh sách khu vực mở rộng trên mobile
   */
  async openExtendedLocationsDropdown() {
    const khacBtn = this.page.getByRole('button', { name: /Khác/i }).first();
    if (await khacBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await khacBtn.click({ force: true });
      await this.sixthLocationBtn.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
    }
  }

  /**
   * Thử chọn khu vực thứ 6 vượt biên tối đa 5 trên mobile và đóng drawer bằng nút 'Áp dụng'
   */
  async select6thLocationIfAvailable() {
    try {
      const khacBtn = this.page.getByRole('button', { name: /Khác/i }).first();
      if (await khacBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await khacBtn.click({ force: true });
        const sixthLocation = this.page.getByRole('button', { name: /An Giang/i }).first();
        await sixthLocation.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
        if (await sixthLocation.isVisible().catch(() => false)) {
          const isDisabled = await sixthLocation.isDisabled().catch(() => false);
          if (!isDisabled) {
            await sixthLocation.click({ force: true }).catch(() => null);
          }
        }
      }
    } catch (_) {
    } finally {
      await this.capture('step2_6th_location_boundary_checked');
      // Đóng drawer Khác trên mobile bằng nút "Áp dụng" hoặc phím Escape
      const applyBtn = this.page.getByRole('button', { name: /Áp dụng/i })
        .or(this.page.locator('button:has-text("Áp dụng")'))
        .first();
      if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await applyBtn.click({ force: true }).catch(() => null);
      } else {
        await this.page.keyboard.press('Escape').catch(() => null);
      }
      await applyBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
      await this.tiepTheoBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
  }
}

module.exports = { MobilePersonalizePage, PersonalizePage: MobilePersonalizePage };
