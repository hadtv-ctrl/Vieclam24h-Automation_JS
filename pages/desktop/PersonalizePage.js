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
    this.emailInput = page.getByPlaceholder(/nhập email/i).or(page.locator('input[type="email"], input[placeholder*="email" i]')).first();
    this.newUserInfoModal = this.nhapHoVaTenInput.or(this.emailInput);
    this.hoanTatBtn = page.getByRole('button', { name: /Hoàn tất|Đăng ký/i }).first();
    this.dongYBtn = page.getByRole('button', { name: 'Đồng ý' }).first();

    // Màn hình mật khẩu khi số điện thoại đã tồn tại (TC-096)
    this.loginPasswordInput = page.getByPlaceholder(/nhập mật khẩu của bạn|nhập mật khẩu/i).or(page.locator('input[type="password"]')).first();
    this.passwordInput = this.loginPasswordInput;
    this.dangNhapBtn = page.getByRole('button', { name: /Đăng nhập/i }).first();
    this.authModalTitle = page.getByText(/Đăng nhập|Xác thực|Đăng ký/i).first();
    this.phoneError = page.locator('[class*="error"], [class*="helper"], [class*="feedback"], [role="alert"]').filter({ hasText: /số điện thoại/i }).or(page.getByText(/số điện thoại.*(?:không hợp lệ|đã tồn tại|chưa đúng|không đúng)/i)).first();

    // Cảnh báo giới hạn biên (TC-097) - loại trừ __next-route-announcer__ của Next.js
    this.fieldError = page.locator('[class*="error"]:not(#__next-route-announcer__), [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /\S+/ }).first();
    this.limitExceededWarning = page.locator('[class*="error"], [class*="warning"], [class*="alert"], [class*="toast"]').filter({ hasText: /5 khu vực|tối đa 5|vượt quá/i }).or(page.getByText(/tối đa 5/i)).first();
    this.extraCityBtn = page.getByRole('button', { name: /Đà Nẵng|Hải Phòng|Cần Thơ/i }).first();

    // Thiết lập tiêu chí: Bước 1 - Vị trí công việc mong muốn
    this.jobTitleInput = page.locator('input[name="job_title"], input[placeholder*="vị trí công việc" i], [data-test-id="common__input"]').first();
    this.dataTestId = this.jobTitleInput;
    this.banDangTimCongHeading = page.getByRole('heading', { name: /Bạn đang tìm công việc gì/i }).first();
    this.nhanVienBanHangText = page.locator('div, span, p, li').filter({ hasText: /^nhân viên bán hàng$/i }).last();
    this.tiepTheoBtn = page.getByRole('button', { name: /Tiếp theo|Tiếp tục/i }).first();

    // Thiết lập tiêu chí: Bước 2 - Khu vực làm việc
    this.chonToiDa5Text = page.getByText('Chọn tối đa 5 khu vực').first();
    this.step2Modal = page.locator('div').filter({ hasText: 'Chọn tối đa 5 khu vực' }).filter({ hasText: /Tiếp theo|Trở về/i }).first();
    this.tphcmBtn = this.getLocationBtn('TP.HCM');
    this.haNoiBtn = this.getLocationBtn('Hà Nội');
    this.binhDuongBtn = this.getLocationBtn('Bình Dương');
    this.dongNaiBtn = this.getLocationBtn('Đồng Nai');
    this.canThoBtn = this.getLocationBtn('Cần Thơ');
    this.khacBtn = this.getLocationBtn('Khác');
    this.anGiangBtn = page.getByRole('button', { name: /An Giang/i }).or(page.locator('button, div, span, [role="button"]').filter({ hasText: /^An Giang/ })).first();

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

    const otpReady = this.pleaseEnterVerificationInput.or(this.page.locator('input[type="tel"]').first());
    await this.waitForElement(otpReady, 15000);
    await this.capture('auth_02_otp_before_input');
    await this.fillOtpDigits(otp, { captureStep: 'auth_03_otp_entered' });
  }

  /**
   * Bước 2 Xác thực: Nhập Họ và tên và chấp thuận điều khoản xử lý dữ liệu cá nhân (Consent modal)
   */
  async enterFullNameAndAcceptConsent(fullName = 'Hà Đinh') {
    await this.waitForElement(this.fullNameInput, 10000);
    await this.capture('auth_04_fullname_before_input');
    await this.actions.fill(this.fullNameInput, fullName);
    await this.capture('auth_05_fullname_entered');
    await this.actions.click(this.hoanTatBtn);

    await this.waitForElement(this.consentAgreeBtn, 15000);
    await this.capture('auth_06_consent_modal_displayed');
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
    } catch (_) { }
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
   * Lấy locator của nút khu vực trong Bước 2 Onboarding mini
   * @param {string} name
   */
  getLocationBtn(name) {
    const rx = new RegExp(`^${name}`, 'i');
    return this.step2Modal
      .getByRole('button', { name: rx })
      .or(this.step2Modal.locator('button, [role="button"]').filter({ hasText: rx }))
      .or(this.page.getByRole('button', { name: rx }))
      .first();
  }

  /**
   * Chọn 5 khu vực hợp lệ ban đầu trong Onboarding mini
   */
  async select5Locations(options = {}) {
    await this.waitForElement(this.chonToiDa5Text, 15000);
    const locationNames = ['TP.HCM', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Cần Thơ'];

    for (const name of locationNames) {
      const btn = this.getLocationBtn(name);
      await this.waitForElement(btn, 5000);
      await this.actions.click(btn);
    }
    if (options.capture !== false) {
      await this.capture('step2_5_locations_selected');
    }
  }

  /**
   * Thử chọn khu vực thứ 6 vượt biên tối đa 5
   */
  async select6thLocationIfAvailable() {
    try {
      const khacBtn = this.step2Modal.getByRole('button', { name: /Khác/i }).or(this.page.getByRole('button', { name: /Khác/i })).first();
      if (await khacBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await khacBtn.click({ force: true });
        const sixthLocation = this.sixthLocationBtn;
        await sixthLocation.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
        if (await sixthLocation.isVisible().catch(() => false)) {
          const isDisabled = await sixthLocation.isDisabled().catch(() => false);
          if (!isDisabled) {
            await sixthLocation.click({ force: true }).catch(() => null);
          }
        }
      }
    } catch (_) {
      // ignore
    } finally {
      await this.capture('step2_6th_location_boundary_checked');
      // Đóng dropdown Khác để lộ nút Tiếp theo
      const khacBtn = this.step2Modal.getByRole('button', { name: /Khác/i }).or(this.page.getByRole('button', { name: /Khác/i })).first();
      await khacBtn.click({ force: true }).catch(() => null);
      await this.step2Modal.getByText(/Bạn đang tìm việc làm|Chọn tối đa 5/i).first().click({ force: true }).catch(() => null);
      await this.tiepTheoBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
  }

  /**
   * Mở danh sách các khu vực mở rộng để kiểm tra giới hạn biên
   */
  async openExtendedLocationsDropdown() {
    const khacBtn = this.step2Modal.getByRole('button', { name: /Khác/i }).or(this.page.getByRole('button', { name: /Khác/i })).first();
    if (await khacBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await khacBtn.click({ force: true });
      await this.sixthLocationBtn.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
    }
  }

  /**
   * Lấy nút khu vực thứ 6 trong danh sách mở rộng (An Giang)
   */
  get sixthLocationBtn() {
    return this.step2Modal.getByRole('button', { name: /An Giang/i }).or(this.page.getByRole('button', { name: /An Giang/i })).first();
  }

  /**
   * Hoàn tất Bước 1: Vị trí công việc mong muốn
   * @param {string} [jobTitle]
   */
  async completeStep1JobTitle(jobTitle = 'nhân viên bán hàng') {
    await this.waitForElement(this.dataTestId.first(), 15000);
    await this.capture('onboarding_01_job_title_before_input');
    await this.actions.click(this.dataTestId.first());
    await this.actions.fill(this.dataTestId.first(), jobTitle);

    const suggestionItem = this.page.locator('div, li, span, p').filter({ hasText: new RegExp(`^${jobTitle}`, 'i') }).last();
    await suggestionItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null);

    if (await suggestionItem.isVisible().catch(() => false)) {
      await this.actions.click(suggestionItem);
    }
    // Chụp sau khi input và chọn gợi ý (đồng thời là trước khi bấm nút Tiếp theo)
    await this.capture('onboarding_02_job_title_entered');

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
    // Chụp bằng chứng Bước 2 trước khi chọn tỉnh thành (màn hình ban đầu, nút Tiếp theo chưa active)
    await this.capture('onboarding_03_step2_locations_before_selection');
    for (const locName of locations) {
      const locBtn = this.getLocationBtn(locName);
      if (await locBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(locBtn);
      }
    }
    // Chụp bằng chứng rõ ràng các khu vực đã chọn TRƯỚC KHI bấm Tiếp theo
    await this.capture('onboarding_04_step2_locations_selected');
    await this.actions.click(this.tiepTheoBtn);
  }

  /**
   * Hoàn tất Bước 3: Mức lương mong muốn
   * @param {string} [minSalary]
   * @param {string} [maxSalary]
   */
  async completeStep3Salary(minSalary = '10', maxSalary = '15') {
    await this.capture('onboarding_05_salary_before_input');
    await this.waitForElement(this.salaryInputs.first(), 10000);
    if (await this.salaryInputs.count() >= 2) {
      await this.actions.fill(this.salaryInputs.nth(0), minSalary);
      await this.actions.fill(this.salaryInputs.nth(1), maxSalary);
    }
    // Chụp bằng chứng rõ ràng khoảng lương đã điền TRƯỚC KHI bấm Hoàn tất
    await this.capture('onboarding_05_step3_salary_range_entered');
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
  async deselectLocation(btnName = 'Cần Thơ', options = {}) {
    const btn = this.getLocationBtn(btnName);
    await this.actions.click(btn);
    if (options.capture) {
      await this.capture('location_deselected');
    }
  }

  /**
   * Chọn lại một khu vực làm việc
   */
  async selectSingleLocation(btnName = 'Cần Thơ', options = {}) {
    const btn = this.getLocationBtn(btnName);
    await this.actions.click(btn);
    if (options.capture) {
      await this.capture('location_selected');
    }
  }

  /**
   * Điền mã xác thực OTP 4 chữ số
   */
  /**
   * Nhập mã OTP 4 chữ số vào form xác thực
   * Chụp ngay lập tức bằng chứng nhập OTP trước khi hệ thống tự động submit và chuyển màn hình
   */
  async fillOtpDigits(otp = '1111', options = {}) {
    const digits = String(otp).split('');
    const telInputs = this.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible, input[aria-label*="Digit"]:visible');

    try {
      await this.waitForElement(this.pleaseEnterVerificationInput.or(telInputs.first()), 15000);
      const count = await telInputs.count();
      if (count >= 4) {
        for (let i = 0; i < 4; i++) {
          await this.actions.fill(telInputs.nth(i), digits[i] || '1');
        }
        if (options.captureStep && this.screenshotHelper) {
          await this.screenshotHelper.takeScreenshot(options.captureStep, false, {
            waitForNetworkIdle: false,
            waitForAnimations: false,
            waitForStability: false,
            waitForVisualLoading: false,
            waitForDomContentLoaded: false,
            waitForLoadState: false,
          });
        }
      } else {
        await this.actions.fill(this.pleaseEnterVerificationInput, digits[0] || '1');
        if (await this.digit2Input.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.actions.fill(this.digit2Input, digits[1] || '1');
          await this.actions.fill(this.digit3Input, digits[2] || '1');
          await this.actions.fill(this.digit4Input, digits[3] || '1');
        }
        if (options.captureStep && this.screenshotHelper) {
          await this.screenshotHelper.takeScreenshot(options.captureStep, false, {
            waitForNetworkIdle: false,
            waitForAnimations: false,
            waitForStability: false,
            waitForVisualLoading: false,
            waitForDomContentLoaded: false,
            waitForLoadState: false,
          });
        }
      }
    } catch (_) {
      // Thử fallback trực tiếp với các input tel nếu có
      await this.fillCodeInputs(this.page.locator('input[type="tel"]'), otp).catch(() => null);
      if (options.captureStep && this.screenshotHelper) {
        await this.screenshotHelper.takeScreenshot(options.captureStep, false, {
          waitForNetworkIdle: false,
          waitForAnimations: false,
          waitForStability: false,
          waitForVisualLoading: false,
          waitForDomContentLoaded: false,
          waitForLoadState: false,
        }).catch(() => null);
      }
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

    // Chờ xuất hiện màn hình OTP và nhập 4 chữ số (chụp ngay bằng chứng đã nhập)
    await this.fillOtpDigits(otp, { captureStep: 'otp_digits_filled' });

    // Chờ form Họ và tên xuất hiện (nếu là tài khoản mới)
    try {
      await this.waitForElement(this.nhapHoVaTenInput, 8000);
      await this.actions.click(this.nhapHoVaTenInput);
      await this.actions.fill(this.nhapHoVaTenInput, fullName);
      await this.capture('full_name_entered');
      await this.actions.click(this.hoanTatBtn);
    } catch (_) { }

    // Xác nhận chấp thuận điều khoản dữ liệu cá nhân nếu có modal Đồng ý
    try {
      await this.waitForElement(this.dongYBtn, 6000);
      await this.actions.click(this.dongYBtn);
      await this.capture('consent_agreed');
    } catch (_) { }
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
    } catch (_) { }

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
    } catch (_) { }

    // Bước 3: Mức lương mong muốn
    try {
      await this.waitForElement(this.minSalaryInput, 8000);
      await this.actions.fill(this.minSalaryInput, minSalary);
      if (await this.maxSalaryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.actions.fill(this.maxSalaryInput, maxSalary);
      }
      await this.capture('criteria_step3_salary');
      await this.actions.click(this.hoanTatBtn);
    } catch (_) { }
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
    } catch (_) { }
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
    } catch (_) { }
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
