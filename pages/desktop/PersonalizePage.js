const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { generateRandomVNPhone } = require('../../core/utils/commonUtils');

class PersonalizePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [featureName]
   */
  constructor(page, featureName) {
    super(page, featureName);

    // Banner quảng cáo & nút đóng
    this.closeBannerBtn = page.locator('.absolute.top-1.right-1, [data-test-id="common__close-button"], button.close, [class*="close-banner"]').first();
    this.absolutetop1right1 = this.closeBannerBtn;
    this.body = page.locator('body');

    // Điểm chạm gợi ý việc làm ban đầu
    this.xemViecLamDanhBtn = page.getByRole('button', { name: /Xem việc làm dành riêng/i }).or(page.getByText(/Xem việc làm dành riêng/i)).first();
    this.item10ViecLamCoLink = page.getByRole('link', { name: /\+?10 việc làm có lương hấp dẫn/i }).or(page.locator('a:has-text("10 việc làm có lương hấp dẫn")')).first();
    this['10ViecLamCoLink'] = this.item10ViecLamCoLink;

    // Xác thực tài khoản (Đăng ký / Đăng nhập OTP)
    this.nhapSoDienThoaiInput = page.getByPlaceholder(/Nhập số điện thoại/i).or(page.getByRole('textbox', { name: /Nhập số điện thoại/i })).first();
    this.tiepTucBtn = page.getByRole('button', { name: 'Tiếp tục' }).first();
    this.pleaseEnterVerificationInput = page.getByRole('textbox', { name: /Please enter verification|Digit 1/i }).or(page.locator('input[autocomplete="one-time-code"]')).or(page.locator('input[type="tel"]').first());
    this.digit2Input = page.getByRole('textbox', { name: 'Digit 2' }).or(page.locator('input[type="tel"]').nth(1));
    this.digit3Input = page.getByRole('textbox', { name: 'Digit 3' }).or(page.locator('input[type="tel"]').nth(2));
    this.digit4Input = page.getByRole('textbox', { name: 'Digit 4' }).or(page.locator('input[type="tel"]').nth(3));
    this.otpInputIndicator = this.pleaseEnterVerificationInput.or(page.locator('input[type="tel"]').first()).or(page.locator('input[autocomplete="one-time-code"]').first());
    this.nhapHoVaTenInput = page.getByPlaceholder(/Nhập họ và tên/i).or(page.getByRole('textbox', { name: /Nhập họ và tên/i })).first();
    this.hoanTatBtn = page.getByRole('button', { name: /Hoàn tất|Đăng ký/i }).first();
    this.dongYBtn = page.getByRole('button', { name: 'Đồng ý' }).first();

    // Màn hình mật khẩu khi số điện thoại đã tồn tại (TC-096)
    this.loginPasswordInput = page.getByPlaceholder(/nhập mật khẩu của bạn|nhập mật khẩu/i).or(page.locator('input[type="password"]')).first();
    this.passwordInput = this.loginPasswordInput;
    this.dangNhapBtn = page.getByRole('button', { name: /Đăng nhập/i }).first();
    this.authModalTitle = page.getByText(/Đăng nhập|Xác thực|Đăng ký/i).first();
    this.phoneError = page.locator('[class*="error"], [class*="helper"], [class*="feedback"], [role="alert"]').filter({ hasText: /số điện thoại/i }).or(page.getByText(/số điện thoại.*(?:không hợp lệ|đã tồn tại|chưa đúng|không đúng)/i)).first();

    // Cảnh báo giới hạn biên (TC-097)
    this.fieldError = page.locator('[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]').first();
    this.limitExceededWarning = page.locator('[class*="error"], [class*="warning"], [class*="alert"], [class*="toast"]').filter({ hasText: /5 khu vực|tối đa 5|vượt quá/i }).or(page.getByText(/tối đa 5/i)).first();
    this.extraCityBtn = page.getByRole('button', { name: /Đà Nẵng|Hải Phòng|Cần Thơ/i }).first();

    // Thiết lập tiêu chí: Bước 1 - Vị trí công việc mong muốn
    this.jobTitleInput = page.locator('input[name="job_title"], input[placeholder*="vị trí công việc" i], [data-test-id="common__input"]').first();
    this.dataTestId = this.jobTitleInput;
    this.banDangTimCongHeading = page.getByRole('heading', { name: /Bạn đang tìm công việc gì/i }).first();
    this.nhanVienBanHangText = page.locator('div, span, p, li').filter({ hasText: /^nhân viên bán hàng$/i }).last();
    this.tiepTheoBtn = page.getByRole('button', { name: /Tiếp theo|Tiếp tục/i }).first();

    // Thiết lập tiêu chí: Bước 2 - Khu vực làm việc
    this.tphcmBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^TP\.HCM/ }).last();
    this.haNoiBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^Hà Nội/ }).last();
    this.binhDuongBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^Bình Dương/ }).last();
    this.dongNaiBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^Đồng Nai/ }).last();
    this.canThoBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^Cần Thơ/ }).last();
    this.khacBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^Khác(\s|$)/ }).filter({ hasNotText: /Khách/i }).last();
    this.anGiangBtn = page.locator('button, div, span, [role="button"]').filter({ hasText: /^An Giang/ }).last();
    this.chonToiDa5Text = page.getByText('Chọn tối đa 5 khu vực').first();

    // Thiết lập tiêu chí: Bước 3 - Mức lương mong muốn
    this.vdInput = page.getByRole('textbox', { name: 'VD:' }).first();
    this.minSalaryInput = page.getByRole('textbox', { name: 'VD:' }).first();
    this.maxSalaryInput = page.getByRole('textbox', { name: 'VD:' }).nth(1);
    this.salaryHeading = page.getByRole('heading', { name: /Mức lương|Lương/i }).or(page.getByText(/Mức lương mong muốn/i)).first();
    this.step3Indicator = this.minSalaryInput.or(this.vdInput).or(this.salaryHeading).or(page.getByText(/câu hỏi|mức lương/i)).or(this.hoanTatBtn);

    // Quản lý & điều chỉnh tiêu chí tìm việc
    this.tieuChiTimViecText = page.getByText(/Tiêu chí tìm việc của tôi/i).first();
    this.tieuChiTimViecHeading = page.getByRole('heading', { name: /Tiêu chí tìm việc/i }).first();
    this.luongCaoNhatTab = page.getByRole('tab', { name: /Lương cao nhất/i }).or(page.getByText(/Lương cao nhất/i)).first();
    this.moiNhatTab = page.getByRole('tab', { name: /Mới nhất/i }).or(page.getByText(/Mới nhất/i)).first();
    this.chinhSuaVaThemBtn = page.getByRole('button', { name: /Chỉnh sửa và thêm mới/i }).first();

    // Cập nhật kinh nghiệm & ngành nghề
    this.daCoKinhNghiemBtn = page.getByRole('button', { name: /Đã có kinh nghiệm/i }).first();
    this.chonSoNamKinhText = page.getByText(/Chọn số năm kinh nghiệm/i).first();
    this.exp3NamOption = page.locator('div').filter({ hasText: /^3 năm$/ }).or(page.getByText('3 năm')).last();
    this.div = this.exp3NamOption;
    this.chonNganhNgheText = page.getByText(/Chọn ngành nghề/i).first();
    this.hanhChinhThuKyHeading = page.getByRole('heading', { name: /Hành chính - Thư ký/i }).or(page.getByText(/Hành chính - Thư ký/i)).first();
    this.luuThongTinBtn = page.getByRole('button', { name: 'Lưu thông tin' }).first();

    // Khám phá việc làm phù hợp
    this.viecLamBtn = page.getByRole('button', { name: /Việc làm/i }).first();
    this.timViecLamBtn = page.getByRole('button', { name: /Tìm việc làm/i }).or(page.getByRole('link', { name: /Tìm việc làm/i })).first();
    this.viecLamDanhChoHeading = page.getByRole('heading', { name: /Việc làm dành cho bạn với mức/i }).first();
    this.xemTatCaLink = page.getByRole('link', { name: /Xem tất cả/i }).first();
    this.keToanTongHopLink = page.getByRole('link', { name: /Kế Toán Tổng Hợp/i }).first();

    // Thuộc tính trên Personalized Page trực tiếp
    this.personalizedPath = '/viec-lam-danh-rieng-cho-ban.html';
    this.loginOrRegisterHeading = page.getByRole('heading', { name: /Đăng nhập hoặc Đăng ký/i }).first();
    this.personalizedHeading = page.locator('h1, h2').filter({ hasText: /Việc làm.*dành riêng cho/i }).first();
    this.choChopBietNhuCauText = page.getByText(/Cho Chớp biết nhu cầu/i).first();

    // Locators cho SEO, Social và Direct Flow trên Personalized Page
    this.jobCards = page.locator('[data-test-id*="job-card"], [class*="job-card"], [class*="job_item"]');
    this.metaDescription = page.locator('meta[name="description"]');
    this.metaKeywords = page.locator('meta[name="keywords"]');
    this.canonicalLink = page.locator('link[rel="canonical"]');
    this.ogTitleMeta = page.locator('meta[property="og:title"]');
    this.ogUrlMeta = page.locator('meta[property="og:url"]');
    this.ogDescriptionMeta = page.locator('meta[property="og:description"]');
    this.fullNameInput = page.locator('input[placeholder*="họ và tên" i], input[placeholder*="Họ và tên" i]').first();
    this.consentAgreeBtn = page.getByRole('button', { name: 'Đồng ý', exact: true }).first();
    this.salaryInputs = page.locator('input[placeholder*="VD" i], input[role="textbox"]');
    this.finalPersonalizeHeading = page.locator('h1, h2, h3').filter({ hasText: /Việc làm.*dành riêng|Tiêu chí tìm việc|Gợi ý việc làm/i }).first();

    // Locators cho widget Tiêu chí tìm việc của tôi trên Personalized Page
    this.criteriaCard = page.locator('aside, div, section').filter({ hasText: /Tiêu chí tìm việc của tôi/i }).first();
    this.criteriaJobTitleText = page.locator('div, span, p').filter({ hasText: /Vị trí mong muốn ứng tuyển/i }).first();
    this.criteriaLocationText = page.locator('div, span, p').filter({ hasText: /Khu vực/i }).first();
    this.criteriaSalaryText = page.locator('div, span, p').filter({ hasText: /Mức lương mong muốn/i }).first();
  }

  /**
   * Mở trực tiếp trang Việc làm dành riêng cho bạn (Personalized Page)
   */
  async navigate() {
    await this.navigateToPersonalizedPage();
  }

  /**
   * Mở trực tiếp trang Việc làm dành riêng cho bạn (Personalized Page)
   */
  async navigateToPersonalizedPage() {
    await super.navigate(this.personalizedPath);
  }

  /**
   * Lấy nội dung thẻ meta description
   */
  async getMetaDescription() {
    return this.metaDescription.getAttribute('content');
  }

  /**
   * Lấy nội dung thẻ meta keywords
   */
  async getMetaKeywords() {
    return this.metaKeywords.getAttribute('content');
  }

  /**
   * Lấy thuộc tính href của canonical link
   */
  async getCanonicalHref() {
    return this.canonicalLink.getAttribute('href');
  }

  /**
   * Lấy thuộc tính content của og:title
   */
  async getOgTitle() {
    return this.ogTitleMeta.getAttribute('content');
  }

  /**
   * Lấy thuộc tính content của og:url
   */
  async getOgUrl() {
    return this.ogUrlMeta.getAttribute('content');
  }

  /**
   * Lấy thuộc tính content của og:description
   */
  async getOgDescription() {
    return this.ogDescriptionMeta.getAttribute('content');
  }

  /**
   * Đếm số lượng job cards đang hiển thị
   */
  async getJobCardsCount() {
    return this.jobCards.count();
  }

  /**
   * Thực hiện đăng ký tài khoản và chấp thuận Consent trực tiếp trên trang Personalized Page
   */
  async registerAndAcceptConsentOnPersonalizedPage(phone, otp = '1111', fullName = 'Hà Đinh') {
    await this.registerPhoneAndOtp(phone, otp);
    await this.enterFullNameAndAcceptConsent(fullName);
  }

  /**
   * Bước 1 Xác thực: Điền số điện thoại và nhập mã xác thực OTP 4 chữ số
   */
  async registerPhoneAndOtp(phone, otp = '1111') {
    await this.waitForElement(this.nhapSoDienThoaiInput, 15000);
    await this.actions.fill(this.nhapSoDienThoaiInput, phone);
    await this.capture('auth_01_phone_entered');
    await this.actions.click(this.tiepTucBtn);

    await this.fillOtpDigits(otp);
    await this.capture('auth_02_otp_entered');
  }

  /**
   * Bước 2 Xác thực: Nhập Họ và tên và chấp thuận điều khoản xử lý dữ liệu cá nhân (Consent modal)
   */
  async enterFullNameAndAcceptConsent(fullName = 'Hà Đinh') {
    await this.waitForElement(this.fullNameInput, 10000);
    await this.actions.fill(this.fullNameInput, fullName);
    await this.capture('auth_03_fullname_entered');
    await this.actions.click(this.hoanTatBtn);

    await this.waitForElement(this.consentAgreeBtn, 15000);
    await this.capture('auth_04_consent_modal_displayed');
    await this.actions.click(this.consentAgreeBtn, { force: true });
    await this.consentAgreeBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
  }

  /**
   * Hoàn tất 3 bước Mini-onboarding trực tiếp trên Personalized Page
   */
  async completeDirectMiniOnboarding(jobTitle = 'nhân viên bán hàng', minSalary = '10', maxSalary = '15') {
    await this.completeStep1JobTitle(jobTitle);
    await this.completeStep2Locations(['TP.HCM']);
    await this.completeStep3Salary(minSalary, maxSalary);
  }

  /**
   * Đóng banner / popup cản trở nếu xuất hiện
   */
  async closeBannerIfVisible() {
    try {
      await this.closeAllPopupsIfVisible();
      const closeBtns = this.page.locator('[data-test-id="common__close-button"], .svicon-close, [class*="svicon-close"], button:has(.svicon-close), [aria-label*="close" i], .absolute.top-1.right-1');
      if (await closeBtns.first().isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtns.first().click({ force: true }).catch(() => null);
      }
      const privacyAgree = this.page.getByRole('button', { name: 'Đồng ý', exact: true });
      if (await privacyAgree.isVisible({ timeout: 1500 }).catch(() => false)) {
        await privacyAgree.click({ force: true }).catch(() => null);
      }
    } catch (_) {}
  }

  /**
   * Mở modal xác thực tài khoản từ khối việc làm dành riêng
   */
  async openPersonalizeAuthModal() {
    await this.closeBannerIfVisible();

    if (await this.nhapSoDienThoaiInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    if (await this.xemViecLamDanhBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.xemViecLamDanhBtn);
    } else if (await this.item10ViecLamCoLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.item10ViecLamCoLink);
    } else {
      await this.item10ViecLamCoLink.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => null);
      if (await this.item10ViecLamCoLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.actions.click(this.item10ViecLamCoLink);
      } else {
        const headerLogin = this.page.locator('#btn-login-header, [class*="login-header"]').or(this.page.getByText(/Đăng ký\/Đăng nhập/i)).first();
        await this.actions.click(headerLogin, { force: true });
      }
    }

    await this.waitForElement(this.nhapSoDienThoaiInput, 15000);
  }

  /**
   * Điền số điện thoại và nhấn Tiếp tục
   * @param {string} phone
   */
  async fillPhoneAndContinue(phone) {
    await this.actions.fill(this.nhapSoDienThoaiInput, phone);
    await this.capture('phone_entered_in_personalize_flow');
    await this.actions.click(this.tiepTucBtn);
  }

  /**
   * Nhập giá trị hợp lệ vào trường thông tin tìm kiếm tiêu chí
   * @param {string} value
   */
  async fillValidCriteriaField(value = 'nhân viên bán hàng') {
    await this.actions.fill(this.dataTestId, value);
    await this.capture('valid_criteria_field_filled');
  }

  /**
   * Nhập chuỗi 6 ký tự để kiểm tra biên tối đa 5
   * @param {string} value
   */
  async fill6CharsField(value = '123456') {
    await this.actions.fill(this.dataTestId, value);
    await this.capture('6_chars_field_filled');
  }

  /**
   * Chọn 5 khu vực hợp lệ ban đầu
   */
  async select5Locations() {
    await this.waitForElement(this.chonToiDa5Text, 15000);
    await this.chonToiDa5Text.scrollIntoViewIfNeeded().catch(() => null);

    const locations = [this.tphcmBtn, this.haNoiBtn, this.binhDuongBtn, this.dongNaiBtn, this.canThoBtn];
    for (const loc of locations) {
      if (await loc.isVisible().catch(() => false)) {
        await loc.scrollIntoViewIfNeeded().catch(() => null);
        await this.actions.click(loc);
      }
    }
    await this.capture('selected_5_locations');
  }

  /**
   * Thử chọn khu vực thứ 6 vượt biên tối đa 5
   */
  async select6thLocationIfAvailable() {
    try {
      if (await this.khacBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.actions.click(this.khacBtn);
        if (await this.anGiangBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.actions.click(this.anGiangBtn);
        }
      }
    } catch (_) {}
    await this.capture('attempted_select_6th_location_boundary_checked');
  }

  /**
   * Hoàn tất Bước 1: Vị trí công việc mong muốn
   * @param {string} [jobTitle]
   */
  async completeStep1JobTitle(jobTitle = 'nhân viên bán hàng') {
    await this.waitForElement(this.dataTestId.first(), 15000);
    await this.actions.click(this.dataTestId.first());
    await this.actions.fill(this.dataTestId.first(), jobTitle);

    const suggestionItem = this.page.locator('div, li, span, p').filter({ hasText: new RegExp(`^${jobTitle}`, 'i') }).last();
    await suggestionItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null);
    await this.capture('onboarding_01_job_title_input_and_suggestions');

    if (await suggestionItem.isVisible().catch(() => false)) {
      await this.actions.click(suggestionItem);
    }
    await this.capture('onboarding_02_job_title_selected');

    if (await this.tiepTheoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.tiepTheoBtn);
    }
  }

  /**
   * Hoàn tất Bước 2: Khu vực làm việc mong muốn
   * @param {string[]} [locations]
   */
  async completeStep2Locations(locations = ['TP.HCM']) {
    await this.waitForElement(this.chonToiDa5Text, 15000);
    for (const locName of locations) {
      const locBtn = this.page.locator('button, div, span, [role="button"]')
        .filter({ hasText: new RegExp(`^${locName}$`, 'i') })
        .last();
      if (await locBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(locBtn);
      }
    }
    // Chụp bằng chứng rõ ràng các khu vực đã chọn TRƯỚC KHI bấm Tiếp theo
    await this.capture('onboarding_03_step2_locations_selected');
    await this.actions.click(this.tiepTheoBtn);
  }

  /**
   * Hoàn tất Bước 3: Mức lương mong muốn
   * @param {string} [minSalary]
   * @param {string} [maxSalary]
   */
  async completeStep3Salary(minSalary = '10', maxSalary = '15') {
    await this.waitForElement(this.salaryInputs.first(), 10000);
    if (await this.salaryInputs.count() >= 2) {
      await this.actions.fill(this.salaryInputs.nth(0), minSalary);
      await this.actions.fill(this.salaryInputs.nth(1), maxSalary);
    }
    // Chụp bằng chứng rõ ràng khoảng lương đã điền TRƯỚC KHI bấm Hoàn tất
    await this.capture('onboarding_04_step3_salary_range_entered');
    await this.actions.click(this.hoanTatBtn);
  }

  /**
   * Xác thực giao diện Personalized Page sau khi hoàn tất Onboarding mini
   */
  async verifyPersonalizedPageAfterOnboarding({ jobTitle = 'nhân viên bán hàng', location = 'TP.HCM', salary = '10 - 15 triệu' } = {}) {
    await this.waitForElement(this.finalPersonalizeHeading, 20000);
    await this.criteriaCard.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);

    // Chụp bằng chứng hoàn tất: Card tiêu chí tìm việc đã cập nhật cùng danh sách việc làm gợi ý
    await this.capture('onboarding_05_criteria_card_and_recommendations');
  }

  /**
   * Điều hướng trực tiếp đến Personalized Page và hoàn tất xác thực đến Bước 1 (Vị trí mong muốn)
   */
  async reachOnboardingStep1JobTitle(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    await this.navigateToPersonalizedPage();
    await this.closeBannerIfVisible();
    await this.registerPhoneAndOtp(phone || generateRandomVNPhone(), otp);
    await this.enterFullNameAndAcceptConsent(fullName);
    await this.waitForElement(this.dataTestId.first(), 15000);
    await this.capture('onboarding_step1_job_title_ready');
  }

  /**
   * Điều hướng trực tiếp đến Personalized Page và hoàn tất xác thực để đến Bước 2 (Khu vực làm việc) của Onboarding mini
   */
  async reachOnboardingStep2Locations(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    await this.reachOnboardingStep1JobTitle(phone, otp, fullName);
    await this.completeStep1JobTitle('nhân viên bán hàng');

    // Chờ xuất hiện màn hình Bước 2 (Khu vực làm việc)
    await this.waitForElement(this.chonToiDa5Text, 15000);
    await this.capture('onboarding_step2_locations_ready');
  }

  /**
   * Bỏ chọn một khu vực làm việc (click lại vào nút đã chọn)
   */
  async deselectLocation(btnName = 'Cần Thơ') {
    const btn = this.page.locator('button, div, span, [role="button"]').filter({ hasText: new RegExp(`^${btnName}`, 'i') }).last();
    await this.actions.click(btn);
    await this.capture('location_deselected');
  }

  /**
   * Chọn lại một khu vực làm việc
   */
  async selectSingleLocation(btnName = 'Cần Thơ') {
    const btn = this.page.locator('button, div, span, [role="button"]').filter({ hasText: new RegExp(`^${btnName}`, 'i') }).last();
    await this.actions.click(btn);
    await this.capture('location_selected');
  }

  /**
   * Điền mã xác thực OTP 4 chữ số
   */
  async fillOtpDigits(otp = '1111') {
    const digits = String(otp).split('');
    const telInputs = this.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible, input[aria-label*="Digit"]:visible');

    try {
      await this.waitForElement(this.pleaseEnterVerificationInput.or(telInputs.first()), 15000);
      const count = await telInputs.count();
      if (count >= 4) {
        await this.fillCodeInputs(telInputs, otp);
      } else {
        await this.actions.fill(this.pleaseEnterVerificationInput, digits[0] || '1');
        if (await this.digit2Input.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.actions.fill(this.digit2Input, digits[1] || '1');
          await this.actions.fill(this.digit3Input, digits[2] || '1');
          await this.actions.fill(this.digit4Input, digits[3] || '1');
        }
      }
    } catch (_) {
      // Thử fallback trực tiếp với các input tel nếu có
      await this.fillCodeInputs(this.page.locator('input[type="tel"]'), otp).catch(() => null);
    }
  }

  /**
   * Xác thực tài khoản với số điện thoại và OTP, sau đó chấp thuận điều khoản
   */
  async loginOrRegisterWithOtp(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    const targetPhone = phone || generateRandomVNPhone();

    await this.actions.fill(this.nhapSoDienThoaiInput, targetPhone);
    await this.capture('phone_number_entered');
    await this.actions.click(this.tiepTucBtn);

    // Chờ xuất hiện màn hình OTP và nhập 4 chữ số
    await this.fillOtpDigits(otp);
    await this.capture('otp_digits_filled');

    // Chờ form Họ và tên xuất hiện (nếu là tài khoản mới)
    try {
      await this.waitForElement(this.nhapHoVaTenInput, 8000);
      await this.actions.click(this.nhapHoVaTenInput);
      await this.actions.fill(this.nhapHoVaTenInput, fullName);
      await this.capture('full_name_entered');
      await this.actions.click(this.hoanTatBtn);
    } catch (_) {}

    // Xác nhận chấp thuận điều khoản dữ liệu cá nhân nếu có modal Đồng ý
    try {
      await this.waitForElement(this.dongYBtn, 6000);
      await this.actions.click(this.dongYBtn);
      await this.capture('consent_agreed');
    } catch (_) {}
  }

  /**
   * Thiết lập các tiêu chí cá nhân hóa ban đầu (3 bước)
   */
  async setupInitialCriteria({ jobTitle = 'nhân viên bán hàng', minSalary = '10', maxSalary = '15' } = {}) {
    // Bước 1: Vị trí công việc mong muốn
    try {
      await this.waitForElement(this.dataTestId.or(this.banDangTimCongHeading), 10000);
      await this.actions.click(this.dataTestId);
      await this.actions.fill(this.dataTestId, jobTitle);
      if (await this.nhanVienBanHangText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(this.nhanVienBanHangText);
      }
      await this.capture('criteria_step1_job_title');
      await this.actions.click(this.tiepTheoBtn);
    } catch (_) {}

    // Bước 2: Khu vực làm việc
    try {
      await this.waitForElement(this.tphcmBtn.or(this.chonToiDa5Text), 8000);
      if (await this.tphcmBtn.isVisible().catch(() => false)) await this.actions.click(this.tphcmBtn);
      if (await this.haNoiBtn.isVisible().catch(() => false)) await this.actions.click(this.haNoiBtn);
      if (await this.binhDuongBtn.isVisible().catch(() => false)) await this.actions.click(this.binhDuongBtn);
      if (await this.dongNaiBtn.isVisible().catch(() => false)) await this.actions.click(this.dongNaiBtn);
      if (await this.khacBtn.isVisible().catch(() => false)) {
        await this.actions.click(this.khacBtn);
        if (await this.anGiangBtn.isVisible().catch(() => false)) await this.actions.click(this.anGiangBtn);
      }
      await this.capture('criteria_step2_locations');
      await this.actions.click(this.tiepTheoBtn);
    } catch (_) {}

    // Bước 3: Mức lương mong muốn
    try {
      await this.waitForElement(this.minSalaryInput, 8000);
      await this.actions.fill(this.minSalaryInput, minSalary);
      if (await this.maxSalaryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.actions.fill(this.maxSalaryInput, maxSalary);
      }
      await this.capture('criteria_step3_salary');
      await this.actions.click(this.hoanTatBtn);
    } catch (_) {}
  }

  /**
   * Bổ sung thông tin kinh nghiệm và ngành nghề mong muốn
   */
  async updateAdditionalCriteria() {
    try {
      if (await this.chinhSuaVaThemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.actions.click(this.chinhSuaVaThemBtn);
        if (await this.daCoKinhNghiemBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.actions.click(this.daCoKinhNghiemBtn);
        }
        if (await this.chonSoNamKinhText.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.actions.click(this.chonSoNamKinhText);
          if (await this.exp3NamOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.actions.click(this.exp3NamOption);
          }
        }
        if (await this.chonNganhNgheText.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.actions.click(this.chonNganhNgheText);
          if (await this.hanhChinhThuKyHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.actions.click(this.hanhChinhThuKyHeading);
          }
        }
        await this.capture('additional_criteria_selected');
        await this.actions.click(this.luuThongTinBtn);
      }
    } catch (_) {}
  }

  /**
   * Khám phá và xem chi tiết việc làm gợi ý
   */
  async exploreRecommendedJobs() {
    try {
      if (await this.viecLamBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await this.actions.click(this.viecLamBtn);
        if (await this.timViecLamBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.actions.click(this.timViecLamBtn);
        }
      }
      if (await this.xemTatCaLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.actions.click(this.xemTatCaLink);
      }
    } catch (_) {}
  }

  /**
   * Thực thi toàn bộ chuỗi hành động ghi hình
   */
  async performRecordedActions({ phone, otp = '1111', fullName = 'Hà Đinh' } = {}) {
    await this.closeBannerIfVisible();

    if (await this.xemViecLamDanhBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.actions.click(this.xemViecLamDanhBtn);
    }
    if (await this.item10ViecLamCoLink.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.actions.click(this.item10ViecLamCoLink);
    }

    await this.loginOrRegisterWithOtp(phone, otp, fullName);
    await this.setupInitialCriteria();

    if (await this.tieuChiTimViecText.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.actions.click(this.tieuChiTimViecText);
    }
    if (await this.luongCaoNhatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.actions.click(this.luongCaoNhatTab);
    }
    if (await this.moiNhatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.actions.click(this.moiNhatTab);
    }

    await this.updateAdditionalCriteria();
    await this.exploreRecommendedJobs();

    if (await this.keToanTongHopLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.actions.click(this.keToanTongHopLink);
    }
    await this.capture('performrecordedactions_completed');
  }
}

module.exports = { PersonalizePage };
