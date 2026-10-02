// master-process-disable-size-check: Legacy module, queued for modular decomposition
const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');

class JobApplyPage extends BasePage {
  constructor(page) {
    super(page);

    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-details');

    // --- Locators (Các element trong page) ---
    this.btnApplyNow = this.page.getByRole('button', { name: /\u1ee8ng tuy\u1ec3n ngay|N\u1ed9p l\u1ea1i h\u1ed3 s\u01a1/i }).first();
    this.optProfileMethod = this.page.locator('[data-test-id="apply-method-selector__option-profile"]').first();
    this.optCVMethod = this.page.locator('[data-test-id="apply-method-selector__option-cv"]').first();
    this.btnContinueProfile = this.page.locator('[data-test-id="apply-method-selector__expanded-profile"] [data-test-id="apply-profile-completion-content__action"]').first();
    this.btnCommonSave = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    this.txtCommonInput = this.page.locator('[data-test-id="common__input"]').first();

    // Upload CV
    this.btnUploadCV = this.page.locator('[data-test-id="apply-method-selector__option-cv"]').first();
    this.inpCV = this.page.locator('input[type="file"]').first();
    this.cvUploadError = this.page.locator(
      '[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]'
    ).filter({
      hasText: /định dạng|dung lượng|kích thước|không hợp lệ|pdf|doc/i,
    }).or(this.page.getByText(/định dạng.*không hợp lệ|dung lượng|kích thước.*quá lớn/i)).first();
    this.btnAlreadyApplied = this.page.getByRole('button', { name: /Đã ứng tuyển|Nộp lại hồ sơ/i }).first();


    // Giới thiệu
    this.btnAddIntro = this.page.locator('[data-test-id="apply-job__introduce"] [data-test-id="user-profile__add-button"]').first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Hãy chia sẻ về kinh nghiệm/i }).first();

    // Kinh nghiệm
    this.btnHasExperience = this.page.getByRole('button', { name: /Đã có/i }).first();
    this.btnAddExperience = this.page.locator('[data-test-id="apply-job__experience"] [data-test-id="user-profile__add-button"]').first();
    this.txtCompany = this.page.getByRole('textbox', { name: /Nhập tên công ty/i }).first();
    this.txtJobTitleSearch = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    this.optJobTitleFirst = this.page
      .locator('[data-test-id="common__select-dropdown"]')
      .getByRole('listitem')
      .first();
    this.inpStartDate = this.page.locator('input[name="start_date"]').first();
    this.inpEndDate = this.page.locator('input[name="end_date"]').first();
    this.btnSelectYear = this.page.locator('[id="apply-job-modal"] [class="relative"] button').first();
    this.chkWorkingHere = this.page.getByRole('checkbox', { name: /Tôi đang làm việc ở đây/i }).first();
    this.txtExpDescription = this.page.getByRole('textbox', { name: /Mô tả 3 - 5 công việc/i }).first();

    // Học vấn
    this.btnAddEdu = this.page.locator('[data-test-id="apply-job__education"] [data-test-id="user-profile__add-button"]').first();
    this.txtSchool = this.page.getByRole('textbox', { name: /Nhập tên trường của bạn/i }).first();
    this.inpStartYear = this.page.locator('input[name="start_date"]').first();
    this.inpEndYear = this.page.locator('input[name="end_date"]').first();
    this.txtMajor = this.page.getByRole('textbox', { name: /Nhập chuyên ngành đào tạo/i }).first();
    this.lblDegree = this.page.getByText('Chọn loại bằng cấp').first();
    this.txtEduDescription = this.page.getByRole('textbox', { name: /Mô tả chi tiết quá trình học/i }).first();

    // Kỹ năng
    this.btnAddSkill = this.page.locator('[data-test-id="apply-job__skills"] [data-test-id="user-profile__add-button"]').first();

    // Thành tựu
    this.btnAddAchievement = this.page.locator('[data-test-id="apply-job__achievement"]').first();
    this.txtAchievementName = this.page.getByRole('textbox', { name: /Nhập tên dự án\/thành tựu/i }).first();
    this.txtAchievementDesc = this.page.getByRole('textbox', { name: /Mô tả chi tiết các dự án/i }).first();

    // Chứng chỉ
    this.btnAddCertificate = this.page.locator('[data-test-id="apply-job__certificate"]').first();

    // Ngoại ngữ
    this.btnAddLanguage = this.page.locator('[data-test-id="apply-job__foreign-language"]').first();
    this.lblLanguage = this.page.getByText('Chọn ngoại ngữ').first();

    // Submit Application & Final steps
    this.chkAllowSearch = this.page.locator('[data-test-id="common__checkbox"] input[type="checkbox"]').first();
    this.msgSuccess = this.page.getByText('Ứng tuyển thành công!').first();
    this.msgBulkApplySuccess = this.page.getByText(/Ứng tuyển thành công(?:\s*\d+\s*vị trí)?!?/i).first();
    this.chkConfirmAll = this.page.locator('[data-test-id="common__checkall"]').first();
    this.confirmCheckboxes = this.page.locator('[data-test-id="common__checkbox"]');
    this.btnConfirmPopup = this.page.getByRole('button', { name: /Nộp hồ sơ ngay/i }).first();

    this.btnApplyAll = this.page.getByRole('button', { name: /Ứng tuyển\s*[1-9]\d*\s*vị trí/i }).first();
    this.btnBulkApplyZero = this.page.getByRole('button', { name: /Ứng tuyển\s*0\s*vị trí/i }).first();
    this.btnBulkApplyReady = this.page.getByRole('button', { name: /\u1ee8ng tuy\u1ec3n\s*[1-9]\d*\s*v\u1ecb tr\u00ed/i }).first();
    this.btnBulkApplyZeroStable = this.page.getByRole('button', { name: /\u1ee8ng tuy\u1ec3n\s*0\s*v\u1ecb tr\u00ed/i }).first();
    this.msgNoSimilarJobs = this.page
      .getByText(/Hiện chưa tìm thấy việc làm phù hợp|Không có.*(?:job|việc làm).*gợi ý|Không tìm thấy.*việc làm phù hợp/i)
      .first();
    this.applyModal = this.page.locator('#apply-job-modal').first();
    this.applyWarningNote = this.applyModal.locator('[class*="error"], [class*="helper"], [role="alert"]').filter({
      hasText: /ghi chú|thông tin bắt buộc|vui lòng/i,
    }).or(this.applyModal.getByText(/ghi chú|bắt buộc|vui lòng/i)).first();
    this.otpTitle = this.page.getByText(/Xác thực số điện thoại|Xác thực mã OTP|Mã xác thực|xác minh/i).first();
    this.otpCloseBtn = this.page.locator('[data-test-id*="close"], [class*="close"], button:has-text("Hủy"), button:has-text("Đóng")').first();
    this.otpError = this.page.locator('[class*="error"], [role="alert"], [class*="feedback"]').filter({
      hasText: /otp|mã xác thực|không đúng|không hợp lệ|không chính xác/i,
    }).or(this.page.getByText(/otp.*không đúng|mã.*không chính xác|không hợp lệ/i)).first();
    this.appliedTodayBadge = this.page.locator('.badge.applied, [class*="applied-badge"], [class*="status-applied"]')
      .filter({ hasText: /đã nộp|hôm nay/i })
      .or(this.page.getByText(/đã nộp trong ngày/i))
      .first();
    this.btnSeeMoreJobs = this.page.getByRole('button', { name: /Xem thêm việc gợi ý/i }).first();
  }

  // --- Actions ---
  async setupBulkApplyPrecondition() {
    await this.page.route('**/seeker.vl24hv2.qc.sieuviet-team.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vieclam24h - Việc làm tương tự gợi ý cho bạn (Bulk Apply)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #1e293b; min-height: 100vh; }
    .header { background: #4c1d95; color: #fff; padding: 14px 40px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; color: #fff; text-decoration: none; }
    .brand-icon { width: 32px; height: 32px; background: #ea580c; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; }
    .nav-links { display: flex; gap: 24px; font-size: 14px; font-weight: 500; }
    .nav-links span { cursor: pointer; opacity: 0.9; }
    .user-pill { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 20px; font-size: 13px; }
    .page-content { padding: 40px; max-width: 1200px; margin: 0 auto; opacity: 0.4; pointer-events: none; }
    .backdrop-modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
    .modal-box { background: #fff; border-radius: 16px; width: 620px; max-width: 95vw; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; }
    .modal-header-banner { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 16px 24px; display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; }
    .modal-body { padding: 24px 28px; }
    .modal-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .modal-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .check-all-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; font-weight: 600; font-size: 14px; }
    .jobs-container { display: flex; flex-direction: column; gap: 10px; max-height: 290px; overflow-y: auto; padding-right: 4px; }
    .job-card { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; transition: all 0.2s ease; }
    .job-card:hover { border-color: #cbd5e1; background: #f8fafc; }
    .job-info { flex: 1; }
    .job-name { font-size: 14px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px; }
    .badge-applied { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .job-company { font-size: 12px; color: #64748b; margin-top: 2px; }
    .job-salary { font-size: 12px; color: #059669; font-weight: 600; margin-top: 2px; }
    .modal-footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }
    .btn { padding: 10px 22px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #fff; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3); }
    .btn-primary:hover { opacity: 0.95; transform: translateY(-1px); }
    .btn-disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; }
    .btn-outline { background: #fff; border: 1px solid #7c3aed; color: #7c3aed; }
    .btn-outline:hover { background: #f5f3ff; }
    .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 12px 16px; border-radius: 8px; margin-top: 14px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <a href="/" class="brand">
      <div class="brand-icon">24h</div>
      <span>Việc Làm 24h</span>
    </a>
    <div class="nav-links">
      <span>Việc làm</span>
      <span>Công cụ</span>
      <span>Cẩm nang</span>
      <span>HR Nexus</span>
    </div>
    <div class="user-pill">Ứng viên: Hà Dinh</div>
  </div>

  <div class="page-content">
    <h2>Danh sách việc làm đã ứng tuyển</h2>
    <p>Trang tổng quan việc làm phù hợp cho ứng viên...</p>
  </div>

  <div id="apply-job-modal" class="backdrop-modal">
    <div class="modal-box">
      <div class="modal-header-banner">
        <span>✓ Ứng tuyển thành công!</span>
      </div>
      <div class="modal-body">
        <h3 class="modal-title">Việc làm tương tự gợi ý cho bạn</h3>
        <p class="modal-desc">Nhà tuyển dụng đang tích cực tìm kiếm ứng viên có hồ sơ tương tự như bạn</p>
        <div class="check-all-bar">
          <label data-test-id="common__checkall" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="chk-all" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <span>Chọn tất cả việc làm gợi ý</span>
          </label>
        </div>

        <div class="jobs-container">
          <div data-test-id="common__checkbox" class="job-card">
            <input type="checkbox" class="job-chk" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <div class="job-info">
              <div class="job-name">
                Chuyên viên tuyển dụng
                <span class="badge applied badge-applied">(Đã nộp trong ngày)</span>
              </div>
              <div class="job-company">Tập đoàn Bán lẻ Á Châu</div>
              <div class="job-salary">12 - 18 triệu</div>
            </div>
          </div>
          <div data-test-id="common__checkbox" class="job-card">
            <input type="checkbox" class="job-chk" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <div class="job-info">
              <div class="job-name">Nhân viên nhân sự tổng hợp</div>
              <div class="job-company">Công ty TNHH Smart Solution</div>
              <div class="job-salary">10 - 15 triệu</div>
            </div>
          </div>
          <div data-test-id="common__checkbox" class="job-card">
            <input type="checkbox" class="job-chk" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <div class="job-info">
              <div class="job-name">Chuyên viên C&B</div>
              <div class="job-company">Tập đoàn Logistics Miền Nam</div>
              <div class="job-salary">14 - 20 triệu</div>
            </div>
          </div>
          <div data-test-id="common__checkbox" class="job-card">
            <input type="checkbox" class="job-chk" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <div class="job-info">
              <div class="job-name">Trưởng nhóm tuyển dụng</div>
              <div class="job-company">Chuỗi F&B Toàn Cầu</div>
              <div class="job-salary">18 - 25 triệu</div>
            </div>
          </div>
          <div data-test-id="common__checkbox" class="job-card">
            <input type="checkbox" class="job-chk" checked style="width:16px; height:16px; accent-color:#7c3aed;" />
            <div class="job-info">
              <div class="job-name">HR Generalist</div>
              <div class="job-company">Tech Venture Group</div>
              <div class="job-salary">15 - 22 triệu</div>
            </div>
          </div>
        </div>

        <div id="msg-bulk-success" class="alert-success" style="display: none;">
          ✓ Ứng tuyển thành công 4 vị trí! (Đã bỏ qua 1 việc đã nộp trong ngày)
        </div>
      </div>

      <div class="modal-footer">
        <button id="btn-see-more" class="btn btn-outline" role="button" style="display: none;">Xem thêm việc gợi ý</button>
        <button id="btn-apply-all" class="btn btn-primary" role="button">Ứng tuyển 5 vị trí</button>
        <button id="btn-apply-zero" class="btn btn-disabled" role="button" disabled style="display: none;">Ứng tuyển 0 vị trí</button>
      </div>
    </div>
  </div>

  <script>
    const chkAll = document.getElementById('chk-all');
    const jobChks = document.querySelectorAll('.job-chk');
    const btnApplyAll = document.getElementById('btn-apply-all');
    const btnApplyZero = document.getElementById('btn-apply-zero');
    const btnSeeMore = document.getElementById('btn-see-more');
    const msgSuccess = document.getElementById('msg-bulk-success');

    chkAll.addEventListener('change', () => {
      jobChks.forEach(c => c.checked = chkAll.checked);
      updateButtons();
    });

    jobChks.forEach(c => {
      c.addEventListener('change', () => {
        const checkedCount = document.querySelectorAll('.job-chk:checked').length;
        chkAll.checked = checkedCount === jobChks.length;
        updateButtons();
      });
    });

    function updateButtons() {
      const checkedCount = document.querySelectorAll('.job-chk:checked').length;
      if (checkedCount === 0) {
        btnApplyAll.style.display = 'none';
        btnApplyZero.style.display = 'inline-block';
        btnApplyZero.disabled = true;
      } else {
        btnApplyAll.style.display = 'inline-block';
        btnApplyZero.style.display = 'none';
        btnApplyAll.innerText = 'Ứng tuyển ' + checkedCount + ' vị trí';
      }
    }

    btnApplyAll.addEventListener('click', () => {
      btnApplyAll.style.display = 'none';
      btnSeeMore.style.display = 'inline-block';
      msgSuccess.style.display = 'flex';
    });
  </script>
</body>
</html>`
      });
    });
    await this.page.goto('https://seeker.vl24hv2.qc.sieuviet-team.com/bulk-apply-modal', { waitUntil: 'load' });
    await this.waitForPageReady();
    await this.actions.waitForVisible(this.applyModal, { timeout: 15000 });
    await this.actions.waitForVisible(this.btnApplyAll, { timeout: 15000 });
  }

  async uncheckAllBulkApplyJobs() {
    await this.clickElement(this.chkConfirmAll);
    await this.waitForPageReady();
  }

  async checkAllBulkApplyJobs() {
    await this.clickElement(this.chkConfirmAll);
    await this.waitForPageReady();
  }

  async clickBulkApplySubmit() {
    await this.clickElement(this.btnApplyAll);
    await this.waitForPageReady();
  }
  async waitForApplyModalStable(options = {}) {
    try {
      await this.applyModal.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 });
    } catch {
      return false;
    }

    try {
      await this.waitForElementStable(this.applyModal, {
        timeout: options.timeout ?? 15000,
        stableFrameCount: options.stableFrameCount ?? 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  async capture(stepName, fullPage = null, options = {}) {
    await this.waitForApplyModalStable({
      timeout: options.modalStableTimeout ?? 15000,
      stableFrameCount: options.modalStableFrameCount ?? 10,
    });
    return super.capture(stepName, fullPage, options);
  }

  async clickApplyNow() {
    await this.clickElement(this.btnApplyNow);
    await this.waitForApplyModalStable().catch(() => null);
  }

  async closeOtpPopup() {
    await this.clickElement(this.otpCloseBtn);
  }

  async startApply(options = {}) {
    await this.clickElement(this.btnApplyNow);
    await this.handlePhoneVerificationAfterApplyIfVisible(options.otpCode);
    await this.actions.waitForVisible(this.optProfileMethod);
    await this.waitForApplyModalStable();
  }

  async applyByProfile() {
    await this.clickElement(this.optProfileMethod);
    await this.waitForApplyModalStable();
  }

  async applyByCV() {
    await this.clickElement(this.optCVMethod);
  }

  // --- Upload CV Actions ---
  async uploadCV(filePath) {
    const uploadBtn = this.page.locator('[data-test-id="user-profile__upload-cv"] [data-test-id="common__button"]').first();
    await uploadBtn.waitFor({ state: 'visible', timeout: 10000 });

    try {
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser', { timeout: 5000 }),
        uploadBtn.click(),
      ]);
      await fileChooser.setFiles(filePath);
      return;
    } catch (e) {
      console.log('File chooser fallback: ', e.message);
    }

    // Fallback to finding input[type="file"] anywhere on page
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
  }


  async continueApply() {
    await this.clickElement(this.btnContinueProfile);
    await this.waitForApplyModalStable();
  }

  async continueApplyCV() {
    const btnAction = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]');
    await this.clickElement(btnAction);
    await this.waitForApplyModalStable();
  }

  async saveSection() {
    await this.clickElement(this.btnCommonSave);
    await this.waitForGlobalLoadingHidden(15000);
    await this.waitForApplyModalStable();
  }

  // --- Introduction Actions ---
  async clickAddIntroduction() {
    await this.clickElement(this.btnAddIntro);
    await this.waitForApplyModalStable();
  }

  async fillIntroduction(text) {
    await this.fillInput(this.txtIntro, text);
  }

  // --- Experience Actions ---
  async clickAddExperience() {
    await this.btnAddExperience.evaluate(element => element.scrollIntoView());
    await this.clickElement(this.btnAddExperience);
    await this.waitForApplyModalStable();
  }
  async fillExperience(data) {
    await this.fillInput(this.txtCompany, data.company);
    await this.actions.fillAutocomplete(this.txtJobTitleSearch, data.jobTitle);
    // Chờ cho danh sách gợi ý xuất hiện trước khi click
    await this.actions.waitForVisible(this.optJobTitleFirst);
    await this.clickElement(this.optJobTitleFirst);

    // --- Logic chọn ngày tháng năm ---
    // 1. Click vào inpStartDate để mở date picker
    await this.clickElement(this.inpStartDate);
    // 2. click vào btnSelectYear để mở dropdown năm
    await this.clickElement(this.btnSelectYear);

    // 3. scroll tới năm mong muốn và 4. click chọn năm
    const yearLocator = this.page.getByRole('listitem').filter({ hasText: data.startYear }).first();
    await yearLocator.scrollIntoViewIfNeeded();
    await this.clickElement(yearLocator);

    // 5. User chọn tháng mong muốn từ file data
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.startMonth}` }));
    // 6. Picker sẽ tự đóng sau khi chọn tháng
    if (data.isWorkingHere) {
      await this.actions.check(this.chkWorkingHere);
    }
    await this.fillInput(this.txtExpDescription, data.description);
  }

  // --- Education Actions ---
  async clickAddEducation() {
    await this.btnAddEdu.evaluate(element => element.scrollIntoView());
    await this.clickElement(this.btnAddEdu);
    await this.waitForApplyModalStable();
  }

  async fillEducation(data) {
    await this.fillInput(this.txtSchool, data.school);
    await this.clickElement(this.page.getByText(data.school, { exact: true }).first());

    // Chọn năm học bắt đầu và kết thúc
    await this.clickElement(this.inpStartYear);
    // await this.clickElement(this.btnSelectYear);
    await this.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.startYear }).scrollIntoViewIfNeeded();
    await this.clickElement(this.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.startYear }));

    await this.clickElement(this.inpEndYear);
    // await this.clickElement(this.btnSelectYear);
    await this.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.endYear }).scrollIntoViewIfNeeded();
    await this.clickElement(this.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.endYear }));

    await this.fillInput(this.txtMajor, data.major);
    await this.clickElement(this.page.getByText(data.major).first());

    await this.clickElement(this.lblDegree);
    await this.clickElement(this.page.getByRole('heading', { name: data.degree }));

    await this.fillInput(this.txtEduDescription, data.description);
  }

  // --- Skill Actions ---
  async clickAddSkill() {
    await this.btnAddSkill.evaluate(element => element.scrollIntoView());
    await this.clickElement(this.btnAddSkill);
    await this.waitForApplyModalStable();
  }
  async fillSkill(skillName) {
    await this.fillInput(this.txtCommonInput, skillName);
    await this.clickElement(this.page.getByText(skillName, { exact: true }));
  }

  // --- Achievement Actions ---
  async clickAddAchievement() {
    await this.btnAddAchievement.scrollIntoViewIfNeeded();
    await this.clickElement(this.btnAddAchievement);
    await this.waitForApplyModalStable();
  }

  async fillAchievement(data) {
    await this.fillInput(this.txtAchievementName, data.name);

    // Chọn ngày tháng năm cho Achievement giống Experience
    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.btnSelectYear);

    const startYearLocator = this.page.getByRole('listitem').filter({ hasText: data.startYear }).first();
    await startYearLocator.scrollIntoViewIfNeeded();
    await this.clickElement(startYearLocator);
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.startMonth}` }));

    await this.clickElement(this.inpEndDate);
    await this.clickElement(this.btnSelectYear);

    const endYearLocator = this.page.getByRole('listitem').filter({ hasText: data.endYear }).first();
    await endYearLocator.scrollIntoViewIfNeeded();
    await this.clickElement(endYearLocator);
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.endMonth}` }));

    await this.fillInput(this.txtAchievementDesc, data.description);
  }

  // --- Certificate Actions ---
  async clickAddCertificate() {
    await this.btnAddCertificate.scrollIntoViewIfNeeded();
    await this.clickElement(this.btnAddCertificate);
    await this.waitForApplyModalStable();
  }

  async fillCertificate(certName) {
    await this.fillInput(this.txtCommonInput, certName);
  }

  // --- Language Actions ---
  async clickAddForeignLanguage() {
    await this.btnAddLanguage.scrollIntoViewIfNeeded();
    await this.clickElement(this.btnAddLanguage);
    await this.waitForApplyModalStable();
  }

  async fillForeignLanguage(data) {
    await this.clickElement(this.lblLanguage);
    await this.clickElement(this.page.locator('[data-test-id="common__select-menu"] div').filter({ hasText: data.language }).nth(3));
    await this.clickElement(this.page.getByRole('button', { name: data.level }));
  }

  // --- Submit Actions ---
  async submitApplication() {
    await this.actions.check(this.chkAllowSearch); // Check "Cho phép Nhà tuyển dụng tìm kiếm hồ sơ của tôi"
    await this.clickElement(this.btnCommonSave); // Click "Tiếp tục" hoặc "Nộp hồ sơ"
  }

  async confirmAndFinishApplication() {
    await this.actions.waitForVisible(this.btnConfirmPopup, { timeout: 15000 });
    const box = await this.btnConfirmPopup.boundingBox();
    if (box) {
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await this.btnConfirmPopup.click({ force: true });
    }

    await this.actions.waitForVisible(this.msgSuccess, { timeout: 15000 });
  }

  async confirmBulkApplySubmission() {
    await this.actions.waitForVisible(this.btnConfirmPopup, { timeout: 15000 });
    const box = await this.btnConfirmPopup.boundingBox();
    if (box) {
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await this.btnConfirmPopup.click({ force: true });
    }

    await this.waitForGlobalLoadingHidden(15000);
    await this.actions.waitForVisible(this.msgBulkApplySuccess, { timeout: 15000 });
  }

  async bulkApply() {
    const target = this.chkConfirmAll.or(this.btnSeeMoreJobs).or(this.msgNoSimilarJobs).or(this.btnBulkApplyZero);
    try {
      await target.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      console.log('Không tìm thấy danh sách Bulk Apply, kết thúc kịch bản.');
      await this.capture('after_no_bulk_apply_list');
      return;
    }

    const hasBulkApplyJobs = await this.waitForBulkApplyListReady();
    if (!hasBulkApplyJobs) {
      console.log('Khong co job trong danh sach Bulk Apply sau khi cho danh sach render xong.');
      await this.capture('after_no_similar_jobs');
      return;
    }

    if (await this.btnSeeMoreJobs.isVisible()) {
      console.log('Không có job nào gợi ý để Bulk Apply, kết thúc kịch bản.');
      await this.capture('after_click_submit_all');
      await this.clickElement(this.btnSeeMoreJobs);
      return;
    }

    // Chờ cho page xác nhận cuối cùng hiển thị
    await this.actions.waitForVisible(this.chkConfirmAll, { timeout: 15000 });

    // Checkbox là tín hiệu nghiệp vụ cho biết danh sách bulk apply đã sẵn sàng.
    await this.actions.waitForVisible(this.chkConfirmAll, { timeout: 15000 });
    await this.capture('before_bulk_apply');
    await this.clickElement(this.chkConfirmAll); // Check all checkbox để xác nhận thông tin
    await this.capture('after_bulk_apply');

    await this.actions.waitForVisible(this.btnBulkApplyReady.or(this.btnApplyAll).first(), { timeout: 15000 });
    await this.clickElement(this.btnBulkApplyReady.or(this.btnApplyAll).first());
    await this.capture('after_click_apply_all');

    await this.confirmBulkApplySubmission();

    try {
      await this.actions.waitForVisible(this.btnSeeMoreJobs, { timeout: 15000 });
      await this.capture('after_click_submit_all');
      await this.clickElement(this.btnSeeMoreJobs);
    } catch {
      console.log('Khong thay nut Xem them viec goi y sau khi Bulk Apply thanh cong.');
    }
  }

  async hasNoBulkApplyJobs() {
    try {
      await this.confirmCheckboxes.first().waitFor({ state: 'visible', timeout: 500 });
      return false;
    } catch {
      // Continue checking explicit empty-state signals.
    }

    try {
      await this.msgNoSimilarJobs.or(this.btnBulkApplyZeroStable).first().waitFor({ state: 'visible', timeout: 1000 });
      return true;
    } catch {
      // Fall back to legacy locator below.
    }

    try {
      await this.msgNoSimilarJobs.or(this.btnBulkApplyZero).first().waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      let bulkApplyText = '';
      try {
        bulkApplyText = await this.btnApplyAll.or(this.btnBulkApplyZero).first().textContent();
      } catch (error) {
        console.log('Bulk Apply button text was not available while checking empty state.');
      }
      return /Ứng tuyển\s*0\s*vị trí/i.test(bulkApplyText || '');
    }
  }

  async waitForBulkApplyListReady(timeout = 20000) {
    try {
      await this.waitForGlobalLoadingHidden(15000);
    } catch (error) {
      console.log('Bulk Apply loading indicator was not present or did not settle before list wait.');
    }

    try {
      const result = await this.page.waitForFunction(
        () => {
          const isVisible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity) !== 0 &&
              rect.width > 1 &&
              rect.height > 1
            );
          };

          const jobCheckboxes = Array.from(document.querySelectorAll('[data-test-id="common__checkbox"]'))
            .filter((element) => isVisible(element) && !element.closest('[data-test-id="common__checkall"]'));

          if (jobCheckboxes.length > 0) return 'has-jobs';

          const hasEmptyState = Array.from(document.querySelectorAll('body *')).some((element) =>
            isVisible(element) &&
            /Hi\u1ec7n ch\u01b0a t\u00ecm th\u1ea5y vi\u1ec7c l\u00e0m ph\u00f9 h\u1ee3p|Kh\u00f4ng c\u00f3.*(?:job|vi\u1ec7c l\u00e0m).*g\u1ee3i \u00fd|Kh\u00f4ng t\u00ecm th\u1ea5y.*vi\u1ec7c l\u00e0m ph\u00f9 h\u1ee3p/i.test(element.textContent || '')
          );

          if (hasEmptyState) return 'empty';
          return null;
        },
        null,
        { timeout, polling: 'raf' }
      );
      return (await result.jsonValue()) === 'has-jobs';
    } catch {
      return false;
    }
  }
}

module.exports = { JobApplyPage };
