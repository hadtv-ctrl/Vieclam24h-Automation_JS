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
    this.dataTestId = page.locator('[data-test-id="common__input"]').first();
    this.banDangTimCongHeading = page.getByRole('heading', { name: /Bạn đang tìm công việc gì/i }).first();
    this.nhanVienBanHangText = page.getByText(/nhân viên bán hàng/i).first();
    this.tiepTheoBtn = page.getByRole('button', { name: /Tiếp theo/i }).first();

    // Thiết lập tiêu chí: Bước 2 - Khu vực làm việc
    this.tphcmBtn = page.getByRole('button', { name: /TP\.HCM/i }).first();
    this.haNoiBtn = page.getByRole('button', { name: /Hà Nội/i }).first();
    this.binhDuongBtn = page.getByRole('button', { name: /Bình Dương/i }).first();
    this.dongNaiBtn = page.getByRole('button', { name: /Đồng Nai/i }).first();
    this.khacBtn = page.getByRole('button', { name: /Khác/i }).first();
    this.anGiangBtn = page.getByRole('button', { name: /An Giang/i }).first();
    this.chonToiDa5Text = page.getByText(/Chọn tối đa 5 khu vực/i).first();

    // Thiết lập tiêu chí: Bước 3 - Mức lương mong muốn
    this.vdInput = page.getByRole('textbox', { name: 'VD:' }).first();
    this.minSalaryInput = page.getByRole('textbox', { name: 'VD:' }).first();
    this.maxSalaryInput = page.getByRole('textbox', { name: 'VD:' }).nth(1);

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
  }

  /**
   * Mở trang chủ theo baseURL môi trường đã cấu hình trong core/config/env.js
   */
  async navigate() {
    await super.navigate('/');
  }

  /**
   * Đóng banner / popup cản trở nếu xuất hiện
   */
  async closeBannerIfVisible() {
    try {
      await this.closeAllPopupsIfVisible();
      if (await this.closeBannerBtn.isVisible({ timeout: 1500 })) {
        await this.actions.click(this.closeBannerBtn);
      }
    } catch (_) {}
  }

  /**
   * Mở modal xác thực tài khoản từ khối việc làm dành riêng
   */
  async openPersonalizeAuthModal() {
    await this.closeBannerIfVisible();
    if (await this.xemViecLamDanhBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.actions.click(this.xemViecLamDanhBtn);
    } else if (await this.item10ViecLamCoLink.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.actions.click(this.item10ViecLamCoLink);
    }
    await this.waitForElement(this.nhapSoDienThoaiInput);
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
    await this.waitForElement(this.tphcmBtn.or(this.chonToiDa5Text));
    if (await this.tphcmBtn.isVisible().catch(() => false)) await this.actions.click(this.tphcmBtn);
    if (await this.haNoiBtn.isVisible().catch(() => false)) await this.actions.click(this.haNoiBtn);
    if (await this.binhDuongBtn.isVisible().catch(() => false)) await this.actions.click(this.binhDuongBtn);
    if (await this.dongNaiBtn.isVisible().catch(() => false)) await this.actions.click(this.dongNaiBtn);
    if (await this.khacBtn.isVisible().catch(() => false)) {
      await this.actions.click(this.khacBtn);
      if (await this.anGiangBtn.isVisible().catch(() => false)) await this.actions.click(this.anGiangBtn);
    }
    await this.capture('selected_5_locations');
  }

  /**
   * Thử chọn khu vực thứ 6 vượt biên tối đa 5
   */
  async select6thLocationIfAvailable() {
    if (await this.extraCityBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.actions.click(this.extraCityBtn);
      await this.capture('attempted_select_6th_location');
    }
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
