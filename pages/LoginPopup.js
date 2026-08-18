const { BasePage } = require('./BasePage');

class LoginPopup extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.loginHeaderBtn = page.locator('#btn-login-header');
    this.modalTitle = page.getByText(/Đăng nhập hoặc Đăng ký/i).first();
    this.emailLoginOption = page.locator('//button[./span[contains(text(),"Đăng nhập bằng Email")]]').first();
    this.emailInput = page.getByPlaceholder('Nhập email của bạn').last();
    this.phoneInput = page.getByPlaceholder('Nhập số điện thoại của bạn').last();
    this.continueBtn = page.locator('button:has-text("Tiếp tục")').first();
    this.otpModalTitle = page.getByText(/Xác thực(?: OTP)?|Mã xác thực|OTP/i).first();
    this.otpInputs = page.locator('input[type="tel"]');
    this.registerFormTitle = page.getByText(/Tạo tài khoản mới/i).first();
    this.nameInput = page.getByPlaceholder(/Nhập họ và tên/i).first();
    this.registerEmailInput = page.getByPlaceholder(/Nhập email/i).first();
    this.registerPhoneInput = page.getByPlaceholder(/Nhập số điện thoại/i).first();
    this.passwordInput = page.getByPlaceholder(/Nhập mật khẩu/i).first();
    this.submitBtn = page.locator('//button[@type="submit"]').last();
  }

  async clickLoginHeader() {
    return this.actions.click(this.loginHeaderBtn);
  }

  async clickEmailLoginOption() {
    return this.actions.click(this.emailLoginOption);
  }

  async clickContinue() {
    return this.actions.click(this.continueBtn);
  }

  async fillEmail(email) {
    return this.actions.fill(this.emailInput, email);
  }

  async fillPhone(phone) {
    return this.actions.fill(this.phoneInput, phone);
  }

  async fillName(name) {
    return this.actions.fill(this.nameInput, name);
  }

  async fillRegisterEmail(email) {
    return this.actions.fill(this.registerEmailInput, email);
  }

  async fillRegisterPhone(phone) {
    return this.actions.fill(this.registerPhoneInput, phone);
  }

  async fillPassword(password) {
    return this.actions.fill(this.passwordInput, password);
  }

  async clickSubmit() {
    return this.actions.click(this.submitBtn);
  }

  async waitForModalVisible() {
    return this.waitForElement(this.modalTitle);
  }

  async waitForOtpVisible(options = {}) {
    const { timeout = 30000 } = options;
    await this.otpModalTitle.or(this.otpInputs.first()).first().waitFor({ state: 'visible', timeout });
  }

  async clickContinueUntilOtpVisible(options = {}) {
    const {
      maxAttempts = 3,
      otpTimeout = 10000,
      loadingTimeout = 15000,
    } = options;

    let lastOtpError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.actions.waitForVisible(this.continueBtn, { timeout: 5000 });
      await this.clickContinue();
      await this.waitForGlobalLoadingHidden(loadingTimeout);

      try {
        await this.waitForOtpVisible({ timeout: otpTimeout });
        return;
      } catch (error) {
        lastOtpError = error;
      }

      let canRetry = false;
      try {
        canRetry = await this.continueBtn.isVisible();
      } catch (error) {
        canRetry = false;
      }

      if (!canRetry || attempt === maxAttempts) {
        break;
      }

      console.warn(`OTP screen did not appear after Continue attempt ${attempt}; retrying.`);
    }

    throw new Error(
      `OTP screen did not appear after clicking Continue ${maxAttempts} time(s). ` +
      `Last wait error: ${lastOtpError?.message || 'unknown'}`
    );
  }

  async waitForRegisterFormVisible() {
    return this.waitForElement(this.registerFormTitle);
  }

  async fillOtpCode(code) {
    await this.fillCodeInputs(this.otpInputs, code);
  }
}

module.exports = { LoginPopup };
