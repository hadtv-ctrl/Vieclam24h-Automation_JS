const { BasePage } = require('../BasePage');

class LoginPopup extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.loginHeaderBtn = page.locator('#btn-login-header');
    // Hỗ trợ nhiều variant text của modal title
    this.modalTitle = page.getByText(/Đăng nhập hoặc Đăng ký/i).first();
    this.modalTitleAlt = page.locator(
      '[class*="modal"] [class*="title"], [class*="popup"] [class*="title"], [role="dialog"] [class*="title"]'
    ).first();
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

    this.passwordLengthError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /8 ký tự|tối thiểu 8|ít nhất 8/i,
    }).or(page.getByText(/8 ký tự|tối thiểu 8|ít nhất 8/i)).first();

    this.passwordDigitError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /chữ số|ít nhất 1.*số|cả chữ và số/i,
    }).or(page.getByText(/chữ số|ít nhất 1.*số|cả chữ và số/i)).first();

    this.passwordLetterError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /chữ cái|ít nhất 1.*chữ|cả chữ và số/i,
    }).or(page.getByText(/chữ cái|ít nhất 1.*chữ|cả chữ và số/i)).first();

    this.phoneError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /số điện thoại/i,
    }).first();

    this.passwordError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /mật khẩu|8 ký tự|tối thiểu|chữ số|chữ cái|chữ và số/i,
    }).first();

    this.emailError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /email.*không hợp lệ|đúng định dạng|email/i,
    }).or(page.getByText(/email.*không hợp lệ|đúng định dạng/i)).first();

    this.otpError = page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /mã xác thực|otp.*không đúng|không chính xác/i,
    }).or(page.getByText(/mã xác thực.*không đúng|otp.*không đúng|không chính xác/i)).first();

    this.loginPasswordInput = page.getByPlaceholder(/nhập mật khẩu của bạn|nhập mật khẩu/i).first();

    this.resendOtpBtn = page.getByRole('button', { name: /Gửi lại mã|Gửi lại OTP|Gửi lại/i }).or(page.getByText(/Gửi lại mã/i)).first();
    this.otpCountdown = page.locator('[class*="countdown"], [class*="timer"], span:has-text("s")').first();
  }

  async clickLoginHeader() {
    await this.actions.click(this.loginHeaderBtn, { force: true });
    await this.phoneInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
  }

  async clickEmailLoginOption() {
    return this.actions.click(this.emailLoginOption);
  }

  async clickContinue(options = {}) {
    return this.actions.click(this.continueBtn, options);
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

  async waitForModalVisible(timeout = 20000) {
    // Chờ dialog/modal login thực sự mở (có input email bên trong)
    const loginModal = this.page.locator(
      '[role="dialog"]:has(input[type="email"]), ' +
      '[role="dialog"]:has(input[placeholder*="email" i]), ' +
      '[class*="login"][class*="modal"], [class*="auth"][class*="modal"], ' +
      '[class*="login"][class*="popup"]'
    ).first();

    // Thử chờ title chính xác hoặc loginModal container
    const deadline = Date.now() + timeout;
    let lastErr;
    while (Date.now() < deadline) {
      try {
        await Promise.race([
          this.modalTitle.waitFor({ state: 'visible', timeout: 5000 }),
          loginModal.waitFor({ state: 'visible', timeout: 5000 }),
        ]);
        return; // modal đã mở
      } catch (e) {
        lastErr = e;
        // Kiểm tra nhanh xem có email input không — tức modal đã render
        const emailInput = this.page.getByPlaceholder(/email/i).first();
        if (await emailInput.isVisible({ timeout: 500 }).catch(() => false)) return;
      }
    }
    throw new Error(`Login modal không mở sau ${timeout}ms. Chi tiết: ${lastErr?.message}`);
  }

  async waitForOtpVisible(options = {}) {
    const { timeout = 30000 } = options;
    await this.otpModalTitle.or(this.otpInputs.first()).first().waitFor({ state: 'visible', timeout });
  }

  async isRegisterFormVisible(timeout = 1000) {
    try {
      await this.registerFormTitle.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
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
      await this.clickContinue({ timeout: 15000 });

      try {
        await this.waitForOtpVisible({ timeout: otpTimeout });
        return;
      } catch (error) {
        lastOtpError = error;
      }

      if (await this.isRegisterFormVisible(1000)) {
        throw new Error('Login precondition account was not found; register form appeared instead of OTP screen.');
      }

      await this.waitForGlobalLoadingHidden(loadingTimeout);

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

  async clearPassword() {
    await this.passwordInput.fill('');
  }

  async clearRegisterPhone() {
    if (await this.registerPhoneInput.isVisible()) {
      await this.registerPhoneInput.fill('');
    }
  }

  async isSubmitEnabled() {
    return this.submitBtn.isEnabled();
  }

  async openEmailRegisterModal(email) {
    await this.clickLoginHeader();
    await this.waitForModalVisible();
    try {
      await this.clickEmailLoginOption();
    } catch {
      // Bỏ qua nếu form email hiển thị sẵn
    }
    await this.fillEmail(email);
    await this.clickContinue();
    await this.waitForRegisterFormVisible();
  }

  async clickResendOtp() {
    return this.actions.click(this.resendOtpBtn);
  }
}

module.exports = { LoginPopup };
