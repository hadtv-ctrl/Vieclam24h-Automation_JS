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

  async waitForOtpVisible() {
    try {
      await this.otpModalTitle.waitFor({ state: 'visible', timeout: 15000 });
      return;
    } catch (error) {
      await this.otpInputs.first().waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  async waitForRegisterFormVisible() {
    return this.waitForElement(this.registerFormTitle);
  }

  async fillOtpCode(code) {
    for (let i = 0; i < code.length; i++) {
      const otpBox = this.otpInputs.nth(i);
      await this.waitForElement(otpBox);
      await this.actions.fill(otpBox, code[i]);
    }
  }
}

module.exports = { LoginPopup };
