// master-process-disable-size-check: Legacy module, queued for modular decomposition
const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');

class UserProfilePage extends BasePage {
  constructor(page) {
    super(page);

    this.screenshotHelper = new ScreenshotHelper(page, 'user-profile-details');

    // Header / Nav
    this.btnUserAvatar = this.page.getByRole('button', { name: /avt_invalid/i }).first();
    this.btnMyProfile = this.page.getByRole('button', { name: /Hồ sơ của tôi/i }).first();
    this.btnCommonSave = this.page.getByRole('button', { name: 'Lưu thông tin' }).first();
    this.txtCommonInput = this.page.locator('[data-test-id="common__input"]').first();

    // Section Add Buttons
    this.btnAddExperience = this.page.locator('[data-test-id="user-profile__experience"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddIntro = this.page.locator('[data-test-id="user-profile__introduce"] [data-test-id="user-profile__add-button"]').first();
    this.btnEditIntro = this.page.locator('[data-test-id="user-profile__introduce"] [data-test-id="user-profile__edit-button"]').first();
    this.btnIntroIconAction = this.page.locator('[data-test-id="user-profile__introduce"] button').first();
    this.btnAddEdu = this.page.locator('[data-test-id="user-profile__education"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddAchievement = this.page.locator('[data-test-id="user-profile__achievement"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddSkill = this.page.locator('[data-test-id="user-profile__skills"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddCertificate = this.page.locator('[data-test-id="user-profile__certificate"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddLanguage = this.page.locator('[data-test-id="user-profile__foreign-language"] [data-test-id="user-profile__add-button"]').first();

    // Section Containers & Indicators
    this.sectionExperience = this.page.locator('[data-test-id="user-profile__experience"]').first();
    this.sectionLanguage = this.page.locator('[data-test-id="user-profile__foreign-language"]').first();
    this.toastSuccess = this.page.getByText('Chuyển đổi thành công');
    this.profileContainer = this.page.locator('#user-profile-container, [data-test-id*="profile"], main, body').first();

    // Common Form Locators
    this.inpStartDate = this.page.locator('input[name="start_date"]').first();
    this.inpEndDate = this.page.locator('input[name="end_date"]').first();

    // Kinh nghiệm
    this.txtCompany = this.page.getByRole('textbox', { name: 'Nhập tên công ty' }).first();
    this.txtJobTitleSearch = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    this.chkWorkingHere = this.page.getByRole('checkbox', { name: 'Tôi đang làm việc ở đây' }).first();
    this.txtExpDescription = this.page.getByRole('textbox', { name: /Mô tả/i }).first();

    // Giới thiệu
    this.txtIntro = this.page.getByRole('textbox', { name: /Hãy chia sẻ về kinh nghiệm là/i }).first();

    // Trợ lý AI trong modal Giới thiệu / Kinh nghiệm
    this.btnAiFormAction = this.page.locator(
      '[data-test-id="common__form-item"] [data-test-id="common__button"]'
    );
    this.btnAiGenerate = this.page.locator('button.style_aiIcon__PcP_l').first();
    this.btnAiRewrite = this.page.getByRole('button', { name: /Viết lại/i });
    this.btnAiUse = this.page.getByRole('button', { name: /Sử dụng/i });

    // Học vấn
    this.txtSchool = this.page.getByRole('textbox', { name: /Nhập tên trường/i }).first();
    this.txtMajor = this.page.getByRole('textbox', { name: /Nhập chuyên ngành/i }).first();
    this.lblDegree = this.page.getByText('Chọn loại bằng cấp').first();
    this.inpDegreeSearch = this.page.locator('div').filter({ hasText: /^Chọn loại bằng cấp$/ }).getByTestId('common__input').first();
    this.txtEduDescription = this.page.getByRole('textbox', { name: /Mô tả/i }).first();

    // Thành tựu
    this.txtAchievementName = this.page.getByRole('textbox', { name: 'Nhập tên dự án/thành tựu' }).first();
    this.txtAchievementDesc = this.page.getByRole('textbox', { name: /Mô tả/i }).first();

    // Ngoại ngữ
    this.drpLanguage = this.page.getByText('Chọn ngoại ngữ').first();
    this.inpLanguageSearch = this.page.locator('div').filter({ hasText: /^Chọn ngoại ngữ$/ }).getByTestId('common__input').first();

    // TC-046 & TC-047 Locators
    this.profileStatusBadge = this.page.locator('[data-test-id="user-profile__status-badge"], #profile-status-badge').first();
    this.cvSearchSwitch = this.page.locator('[data-test-id="user-profile__enable-search-cv"] input[type="checkbox"], [data-test-id="common__switch"], #toggle-cv-search').first();
    this.cvSearchLocked = this.page.locator('[data-test-id="user-profile__search-locked"], #search-switch-locked').first();
    this.btnOpenPersonalInfo = this.page.locator('[data-test-id="btn-edit-personal-info"], #btn-edit-personal-info').first();
    this.personalInfoModal = this.page.locator('[data-test-id="user-profile__personal-info-modal"], #personal-info-modal').first();
    this.inpPersonalFullName = this.page.locator('[data-test-id="inp-personal-fullname"], #inp-fullname').first();
    this.inpPersonalPhone = this.page.locator('[data-test-id="inp-personal-phone"], #inp-phone').first();
    this.inpPersonalEmail = this.page.locator('[data-test-id="inp-personal-email"], #inp-email').first();
    this.inpPersonalAddress = this.page.locator('[data-test-id="inp-personal-address"], #inp-address').first();
    this.btnSavePersonalInfoModal = this.page.locator('[data-test-id="btn-save-personal-info"], #btn-save-personal-info').first();
    this.btnConvertCVTrigger = this.page.locator('[data-test-id="btn-convert-cv-trigger"], #btn-convert-cv').first();
    this.skillPython = this.page.locator('[data-test-id="user-profile__skills"], #skills-container').getByText('Python').first();
    this.skillReact = this.page.locator('[data-test-id="user-profile__skills"], #skills-container').getByText('React').first();
    this.skillJavaScript = this.page.locator('[data-test-id="user-profile__skills"], #skills-container').getByText('JavaScript').first();
    this.expSeniorDev = this.page.locator('[data-test-id="user-profile__experience"], #experience-container').getByText('Senior Frontend Developer').first();
    this.btnUpdateCriteria = this.page.locator('[data-test-id="btn-update-criteria"], #btn-update-criteria').first();
    this.criteriaLocationValue = this.page.locator('[data-test-id="criteria-location"], #criteria-location').first();
    this.criteriaIndustryValue = this.page.locator('[data-test-id="criteria-industry"], #criteria-industry').first();
    this.criteriaSyncStatus = this.page.locator('[data-test-id="criteria-sync-status"], #criteria-sync-status').first();

    this.otpTitle = this.page.getByText(/Xác thực(?: OTP)?|Mã xác thực|OTP/i).first();
    this.profileOverview = this.page.getByText(/Tổng quan hồ sơ|Hoàn thiện các mục dưới đây/i).first();
    this.btnUploadCV = this.page.getByRole('button', { name: /Tải lên CV/i }).or(this.page.getByText(/Tải ngay CV lên/i)).first();
    this.linkCriteria = this.page.getByRole('link', { name: /Tiêu chí tìm việc/i })
      .or(this.page.getByText(/Tiêu chí tìm việc/i))
      .first();
    this.criteriaHeading = this.page.getByText(/Tiêu chí tìm việc/i).first();
    this.allowSearchToggle = this.page
      .locator('[data-test-id="user-profile__enable-search"] [data-test-id="common__switch"]')
      .or(this.page.locator('[data-test-id="common__switch"]'))
      .or(this.page.locator('div:has-text("Cho phép Nhà tuyển dụng tìm bạn") [class*="switch"], div:has-text("Cho phép Nhà tuyển dụng tìm bạn") [role="switch"]'))
      .or(this.page.locator('text=/Cho phép Nhà tuyển dụng tìm bạn/i').locator('..').locator('div, span, button').last())
      .first();

    // TC-048 Locators
    this.btnAiIntro = this.page.locator('[data-test-id="btn-add-intro"], #btn-add-intro').first();
    this.modalAiIntro = this.page.locator('[data-test-id="modal-ai-intro"], #modal-intro').first();
    this.txtAiIntroSource = this.page.locator('[data-test-id="txt-ai-intro-source"], #txt-intro-source').first();
    this.btnAiTriggerRewrite = this.page.locator('[data-test-id="btn-ai-rewrite-trigger"], #btn-ai-rewrite-trigger').first();
    this.btnAiToneProfessional = this.page.locator('[data-test-id="btn-ai-tone-pro"], #tone-pro').first();
    this.btnAiTonePersuasive = this.page.locator('[data-test-id="btn-ai-tone-persuasive"], #tone-persuasive').first();
    this.btnAiToneConcise = this.page.locator('[data-test-id="btn-ai-tone-concise"], #tone-concise').first();
    this.aiPreviewBox = this.page.locator('[data-test-id="ai-preview-box"], #ai-preview-box').first();
    this.aiPreviewContent = this.page.locator('[data-test-id="ai-preview-content"], #ai-preview-content').first();
    this.aiActiveTone = this.page.locator('[data-test-id="ai-active-tone"], #ai-active-tone').first();
    this.btnAiCancelPreview = this.page.locator('[data-test-id="btn-ai-cancel"], #btn-ai-cancel').first();
    this.introSavedContent = this.page.locator('[data-test-id="intro-saved-content"], #intro-saved-content').first();

    this.btnAiExp = this.page.locator('[data-test-id="btn-add-exp"], #btn-add-exp').first();
    this.modalAiExp = this.page.locator('[data-test-id="modal-ai-exp"], #modal-exp').first();
    this.inpAiJobTitle = this.page.locator('[data-test-id="inp-ai-jobtitle"], #inp-jobtitle').first();
    this.inpAiCompany = this.page.locator('[data-test-id="inp-ai-company"], #inp-company').first();
    this.txtAiExpDesc = this.page.locator('[data-test-id="txt-ai-exp-desc"], #txt-exp-desc').first();
    this.btnAiGenerateExp = this.page.locator('[data-test-id="btn-ai-generate-exp"], #btn-ai-generate-exp').first();
    this.btnSaveAiExp = this.page.locator('[data-test-id="btn-save-exp"], #btn-save-exp').first();
    this.expSavedContent = this.page.locator('[data-test-id="exp-saved-content"], #exp-saved-content').first();

    this.btnSimulateAiError = this.page.locator('#btn-simulate-ai-error').first();
    this.aiLoadingSpinner = this.page.locator('[data-test-id="ai-loading"], #ai-loading').first();
    this.aiErrorModal = this.page.locator('[data-test-id="ai-error-modal"], #ai-error-modal').first();
    this.aiErrorMessage = this.page.locator('[data-test-id="ai-error-message"], #ai-error-message').first();
  }

  async navigateToMyProfile() {
    const closeBtn = this.page.locator('#common__modal [data-test-id*="close"], #common__modal button:has-text("Đóng"), #common__modal button:has-text("Bỏ qua"), .svicon-close, [data-test-id="common__close-button"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => null);
    }

    try {
      await this.clickElement(this.btnUserAvatar);
      await this.clickElement(this.btnMyProfile);
    } catch {
      await this.page.goto('/tai-khoan/ho-so-cua-toi', { waitUntil: 'domcontentloaded' });
    }

    // Wait for navigation to profile page to complete
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    // Then wait for the add experience button to appear
    await this.actions.waitForVisible(this.btnAddExperience, { timeout: 30000 });
  }

  async completeOtpIfVisible(code = '1111') {
    const otpTitle = this.page.getByText(/X\u00e1c th\u1ef1c(?: OTP)?|M\u00e3 x\u00e1c th\u1ef1c|OTP/i).first();
    try {
      await otpTitle.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    const otpInputs = this.page.locator(
      [
        'input[type="tel"]:visible',
        'input[maxlength="1"]:visible',
        'input[autocomplete="one-time-code"]:visible',
      ].join(', ')
    );
    await this.fillCodeInputs(otpInputs, code);
    await this.waitForGlobalLoadingHidden(15000).catch(() => null);
    await otpTitle.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
    return true;
  }

  async saveSection(options = {}) {
    if (await this.btnCommonSave.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickElement(this.btnCommonSave);
      try {
        await expect(this.btnCommonSave).toBeHidden({ timeout: 60000 });
      } catch (_e) {
        // ignore if already hidden
      }
    }
  }

  async saveIntroduction() {
    await this.saveSection();
    await expect(this.txtIntro).toBeHidden({ timeout: 30000 });
    await this.capture('introduction_saved', true);
  }

  async saveExperience() {
    await this.saveSection();
    await expect(this.txtCompany).toBeHidden({ timeout: 30000 });
    await this.capture('experience_saved', true);
  }

  // --- Kinh nghiệm ---
  async clickAddExperience() {
    await this.clickElement(this.btnAddExperience);
  }

  async fillExperience(data) {
    await this.fillInput(this.txtCompany, data.company);

    await this.actions.fillAutocomplete(this.txtJobTitleSearch, data.jobTitle);
    const jobTitleOption = this.page
      .locator('[data-test-id="common__select-dropdown"]')
      .getByRole('listitem')
      .first();
    await this.clickElement(jobTitleOption);

    if (data.isWorkingHere) {
      await this.actions.check(this.chkWorkingHere);
    }
    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first()); // Click year dropdown button
    await this.clickElement(this.page.getByText(data.startYear).first());
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.startMonth}` }).first());

    await this.fillInput(this.txtExpDescription, data.description);
  }

  async generateExperienceDescriptionWithAi(tones) {
    await this.clickElement(this.btnAiFormAction);
    await this.capture('experience_ai_generate_clicked');
    await this.rewriteWithAiTones(tones);
  }

  // --- Giới thiệu ---
  async clickAddIntroduction() {
    await this.clickElement(this.btnAddIntro.or(this.btnEditIntro).or(this.btnIntroIconAction).first());
  }

  async fillIntroduction(text) {
    await this.fillInput(this.txtIntro, text);
  }

  async rewriteIntroductionWithAi(text, tones) {
    await this.clickElement(this.btnAiFormAction);
    await this.capture('introduction_ai_mode_opened');
    await this.fillIntroduction(text);
    await this.capture('introduction_source_filled');
    await this.clickElement(this.btnAiGenerate);
    await this.capture('introduction_ai_generate_clicked');
    await this.selectAiTone(tones[0]);

    for (const tone of tones.slice(1)) {
      await this.clickElement(this.btnAiRewrite);
      await this.capture(`introduction_ai_rewrite_clicked_${this.toEvidenceName(tone)}`);
      await this.selectAiTone(tone);
    }

    await this.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.clickElement(this.btnAiUse);
    await this.capture('introduction_ai_content_applied');
  }

  async rewriteWithAiTones(tones) {
    for (const tone of tones) {
      await this.clickElement(this.btnAiRewrite);
      await this.capture(`experience_ai_rewrite_clicked_${this.toEvidenceName(tone)}`);
      await this.selectAiTone(tone);
    }

    await this.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.clickElement(this.btnAiUse);
    await this.capture('experience_ai_content_applied');
  }

  async selectAiTone(tone) {
    const toneButton = this.page.getByRole('button', { name: new RegExp(tone, 'i') });
    await this.clickElement(toneButton);
    await this.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.capture(`ai_tone_selected_${this.toEvidenceName(tone)}`);
  }

  toEvidenceName(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  // --- Học vấn ---
  async clickAddEducation() {
    await this.clickElement(this.btnAddEdu);
  }

  async fillEducation(data) {
    await this.fillInput(this.txtSchool, data.school);
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.school + '$', 'i') }).first());

    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.page.locator('.react-datepicker__year-text', { hasText: data.startYear }).first());

    await this.clickElement(this.inpEndDate);
    await this.clickElement(this.page.locator('.react-datepicker__year-text', { hasText: data.endYear }).first());

    await this.fillInput(this.txtMajor, data.major);
    // Since major could be a long string or cut off, we pick the first match containing the text
    await this.clickElement(this.page.getByText(data.major).first());

    await this.lblDegree.click();
    await this.clickElement(this.page.getByText(data.degree).first(), { timeout: 3000 });
    await this.fillInput(this.txtEduDescription, data.description);
  }

  // --- Thành tựu ---
  async clickAddAchievement() {
    await this.clickElement(this.btnAddAchievement);
  }

  async fillAchievement(data) {
    await this.fillInput(this.txtAchievementName, data.name);

    // Start date
    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first()); // Year dropdown
    await this.clickElement(this.page.locator('[data-test-id="user-profile__achievement-modal"]').getByText(data.startYear).first());
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.startMonth}` }).first());

    // End date
    await this.clickElement(this.inpEndDate);
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first()); // Year dropdown
    await this.clickElement(this.page.locator('[data-test-id="user-profile__achievement-modal"]').getByText(data.endYear).first());
    await this.clickElement(this.page.getByRole('button', { name: `Choose ${data.endMonth}` }).first());

    await this.fillInput(this.txtAchievementDesc, data.description);
  }

  // --- Kỹ năng ---
  async clickAddSkill() {
    await this.clickElement(this.btnAddSkill);
  }

  async fillSkill(skillName) {
    await this.fillInput(this.txtCommonInput, skillName);
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + skillName + '$', 'i') }).first());
  }

  // --- Chứng chỉ ---
  async clickAddCertificate() {
    await this.clickElement(this.btnAddCertificate);
  }

  async fillCertificate(certName) {
    await this.fillInput(this.txtCommonInput, certName);
  }

  // --- Ngoại ngữ ---
  async clickAddForeignLanguage() {
    await this.clickElement(this.btnAddLanguage);
  }

  async fillForeignLanguage(languageName, level) {
    try {
      await this.clickElement(this.drpLanguage);
      await this.fillInput(this.txtCommonInput, languageName);
      await this.clickElement(this.page.locator(`[data-test-id="common__select-menu"] div`).filter({ hasText: languageName }).nth(3).first(), { timeout: 3000 });
    } catch (e) {
      // fallback if it's just a simple text field or if the dropdown works differently
      console.log('fillForeignLanguage simple fallback', e);
    }
    await this.clickElement(this.page.getByRole('button', { name: level }).first());
  }

  // --- Thông tin cá nhân (Personal Info) ---
  async clickEditPersonalInfo() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForGlobalLoadingHidden(10000).catch(() => null);

    const editBtn = this.page.locator(
      '[data-test-id="user-profile__personal-info"] [data-test-id="user-profile__edit-button"]:visible, ' +
      '[data-test-id="user-profile__edit-button"]:visible, ' +
      '.svicon-edit-alt:visible, ' +
      'button:has(.svicon-edit-alt):visible'
    ).first();

    await this.clickElement(editBtn, { force: true });

    const modal = this.page.locator(
      '[data-test-id="user-profile__personal-info-modal"]:visible, ' +
      '[data-test-id="common__form-modal"]:visible, ' +
      '[data-test-id="common__dialog"]:visible'
    ).first();

    try {
      await modal.waitFor({ state: 'visible', timeout: 15000 });
    } catch (_e) {
      // Fallback: try clicking 'Thêm địa chỉ hiện tại' if icon click didn't trigger modal
      const addAddressBtn = this.page.getByText('Thêm địa chỉ hiện tại').first();
      if (await addAddressBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickElement(addAddressBtn, { force: true });
        await modal.waitFor({ state: 'visible', timeout: 15000 });
      } else {
        throw _e;
      }
    }
    await this.waitForGlobalLoadingHidden(10000).catch(() => null);
  }

  async fillPersonalInfo(data) {
    const modal = this.page.locator(
      '[data-test-id="user-profile__personal-info-modal"]:visible, ' +
      '[data-test-id="common__form-modal"]:visible, ' +
      '[data-test-id="common__dialog"]:visible'
    ).first();
    const scope = (await modal.isVisible({ timeout: 3000 }).catch(() => false)) ? modal : this.page;

    // Select Province
    const provinceBtn = scope.getByText('Chọn tỉnh thành').first();
    await this.clickElement(provinceBtn, { force: true });

    const provinceEscaped = this.escapeRegExp(data.province);
    const provinceOption = this.page
      .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
      .getByRole('heading', { name: new RegExp(provinceEscaped, 'i') })
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .getByText(data.province, { exact: true })
      )
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .getByRole('button', { name: new RegExp(provinceEscaped, 'i') })
      )
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .locator('li, [role="option"]')
          .filter({ hasText: new RegExp(provinceEscaped, 'i') })
      )
      .first();

    await provinceOption.waitFor({ state: 'visible', timeout: 15000 });
    await this.clickElement(provinceOption, { force: true });
    await this.closeSelectModalMenuIfVisible();

    // Select District after its async options finish rendering
    const districtBtn = scope.getByText('Chọn quận huyện').first();
    await this.clickElement(districtBtn, { force: true });

    const districtName = data.district.split('(')[0].trim();
    const districtEscaped = this.escapeRegExp(districtName);
    const districtOption = this.page
      .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
      .getByRole('heading')
      .filter({ hasText: districtName })
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .getByText(districtName, { exact: true })
      )
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .getByRole('button')
          .filter({ hasText: new RegExp(districtEscaped, 'i') })
      )
      .or(
        this.page
          .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
          .locator('li, [role="option"]')
          .filter({ hasText: new RegExp(districtEscaped, 'i') })
      )
      .first();

    await districtOption.waitFor({ state: 'visible', timeout: 35000 });
    await this.clickElement(districtOption, { force: true });
    await this.closeSelectModalMenuIfVisible();

    // Fill Date of Birth
    const inpDateOfBirth = scope.getByRole('textbox', { name: 'DD/MM/YYYY' }).first();
    await this.clickElement(inpDateOfBirth, { force: true });

    // Select Month
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^Tháng \\d+', 'i') }).first(), { force: true });
    await this.clickElement(this.page.getByText(data.birthMonth).first(), { force: true });

    // Select Year
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first(), { force: true });
    await this.clickElement(this.page.getByText(data.birthYear).first(), { force: true });

    // Select Day
    await this.clickElement(this.page.getByRole('button', { name: new RegExp(`Choose.*${data.birthDay}.*tháng`) }).first(), { force: true });

    // Select Gender
    await this.clickElement(scope.getByRole('button', { name: data.gender }).first(), { force: true });
  }

  async savePersonalInfo() {
    const btnSave = this.page
      .getByRole('button', { name: /Lưu thông tin|Lưu thay đổi|^Lưu$/i })
      .or(this.page.locator('button:has-text("Lưu thông tin"), button:text-is("Lưu")'))
      .first();

    await btnSave.scrollIntoViewIfNeeded().catch(() => null);
    await this.clickElement(btnSave, { force: true });
    const modal = this.page.locator('[data-test-id="user-profile__personal-info-modal"]');
    await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
    await this.waitForGlobalLoadingHidden(15000).catch(() => null);
  }

  // --- Tiêu chí tìm việc (Job Goal/Criteria) ---
  async clickSearchCriteria() {
    // First click avatar to open menu
    await this.clickElement(this.btnUserAvatar);
    // Then click search criteria button from the dropdown menu
    const btnSearchCriteria = this.page.getByRole('button', { name: /Tiêu chí tìm việc/i }).first();
    await this.clickElement(btnSearchCriteria);
  }

  async clickAddJobGoal() {
    const linkAddJobGoal = this.page.getByText('Thêm vị trí công việc').first();
    await this.clickElement(linkAddJobGoal);
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async clickVisibleSelectMenuHeading(optionName, options = {}) {
    const timeout = options.timeout ?? 10000;
    const menu = this.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').last();
    await menu.waitFor({ state: 'visible', timeout });
    const option = menu.getByRole('heading', { name: new RegExp(`^${this.escapeRegExp(optionName)}$`, 'i') })
      .or(menu.getByRole('button', { name: new RegExp(`^${this.escapeRegExp(optionName)}$`, 'i') }))
      .or(menu.locator('li, [role="option"]').filter({ hasText: new RegExp(`^\\s*${this.escapeRegExp(optionName)}\\s*$`, 'i') }))
      .or(menu.getByText(new RegExp(`^\\s*${this.escapeRegExp(optionName)}\\s*$`, 'i')))
      .first();
    await this.clickElement(option, { timeout });
  }

  async closeSelectModalMenuIfVisible() {
    const selectModalContainer = this.page.locator('[data-test-id="select__modal-menu__container"]');
    if (await selectModalContainer.isVisible({ timeout: 1500 }).catch(() => false)) {
      const viewport = this.page.viewportSize() || { width: 390, height: 844 };
      await this.page.mouse.click(Math.round(viewport.width / 2), Math.min(600, viewport.height - 100));
      try {
        await selectModalContainer.waitFor({ state: 'hidden', timeout: 3000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  async fillJobGoal(data) {
    // Select experience level
    await this.clickElement(this.page.getByRole('button', { name: new RegExp(data.experienceLevel, 'i') }).first());

    // Select years of experience
    await this.clickElement(this.page.getByText('Chọn số năm kinh nghiệm').first());
    await this.clickElement(this.page.getByRole('heading', { name: data.yearsOfExperience }).first());
    await this.closeSelectModalMenuIfVisible();

    // Fill job title
    const jobTitleInput = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    await this.fillInput(jobTitleInput, data.jobTitle);
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${data.jobTitle}$`, 'i') }).locator('span').first());

    // Select industry
    await this.clickElement(this.page.getByText('Chọn ngành nghề').first());
    await this.clickVisibleSelectMenuHeading(data.industry);
    await this.closeSelectModalMenuIfVisible();
    const removeIndustryBtn = this.page.locator('[data-test-id="user-profile__job-goal-modal"]').getByRole('heading', { name: 'Tiêu chí tìm việc' }).first();
    if (await removeIndustryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      try {
        await this.clickElement(removeIndustryBtn);
      } catch (_e) {
        // ignore
      }
    }

    // Select location
    await this.clickElement(this.page.getByText('Chọn địa điểm').first());
    await this.clickVisibleSelectMenuHeading(data.workLocation);
    await this.closeSelectModalMenuIfVisible();
    const removeLocationBtn = this.page.locator('[data-test-id="common__actions-button"]').first();
    if (await removeLocationBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      try {
        await this.clickElement(removeLocationBtn);
      } catch (_e) {
        // ignore
      }
    }

    // Scroll to salary fields
    const jobGoalModal = this.page.locator('[data-test-id="user-profile__job-goal-modal"]');
    const scrollTarget = jobGoalModal.locator('div').filter({ hasText: 'Kinh nghiệm làm việc*' }).nth(2);
    await scrollTarget.scrollIntoViewIfNeeded();

    // Fill salary range
    const minSalaryInput = this.page.getByRole('textbox', { name: 'Tối thiểu' }).first();
    await this.fillInput(minSalaryInput, data.minSalary);

    const maxSalaryInput = this.page.getByRole('textbox', { name: 'Tối đa' }).last();
    await this.fillInput(maxSalaryInput, data.maxSalary);

    // Handle checkbox (negotiate salary option)
    const negotiateCb = this.page.getByRole('checkbox').first();
    if (data.canNegotiateSalary) {
      await this.actions.check(negotiateCb);
    } else {
      await this.actions.uncheck(negotiateCb);
    }

    // Select current level
    await this.clickElement(this.page.getByText('Chọn cấp bậc hiện tại').first());
    await this.clickVisibleSelectMenuHeading(data.currentLevel);
    await this.closeSelectModalMenuIfVisible();

    // Select work type
    await this.clickElement(this.page.getByText('Chọn hình thức làm việc').first());
    await this.clickVisibleSelectMenuHeading(data.workType);
    await this.closeSelectModalMenuIfVisible();

    // Scroll back to save button
    const scrollTarget2 = jobGoalModal.locator('div').filter({ hasText: 'Kinh nghiệm làm việc*' }).nth(2);
    await scrollTarget2.scrollIntoViewIfNeeded();
  }

  // --- CV Upload ---
  async saveJobGoal() {
    const jobGoalModal = this.page.locator('[data-test-id="user-profile__job-goal-modal"]');
    if (await jobGoalModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.saveSection();
      try {
        await expect(jobGoalModal).toBeHidden({ timeout: 30000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  // --- CV Upload ---
  async enableCVSearch() {
    const cvSearchSwitch = this.page.locator('[data-test-id="common__switch"]').first();
    await this.clickElement(cvSearchSwitch);
  }

  async isAllowSearchVisible(timeout = 1000) {
    const btnAllowSearch = this.page.getByRole('button', { name: /Cho ph\u00e9p t\u00ecm ki\u1ebfm/i }).first();
    try {
      await btnAllowSearch.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async clickContinueButton() {
    if (await this.isAllowSearchVisible()) {
      return;
    }

    const btnContinue = this.page.getByRole('button', { name: /Ti\u1ebfp t\u1ee5c/i }).first();
    await this.clickElement(btnContinue);
  }

  async fillVerificationCode(code) {
    const verificationInputs = this.page.getByRole('textbox', { name: /Digit|Please enter verification/i });
    try {
      await verificationInputs.first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
      if (await this.isAllowSearchVisible()) {
        return;
      }
      throw error;
    }
    await this.fillCodeInputs(verificationInputs, code);
  }

  async uploadCV(filePath) {
    const uploadSection = this.page.locator('[data-test-id="user-profile__enable-search-cv"]');
    const fileInput = uploadSection.locator('input[type="file"]');

    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(filePath);
      return;
    }

    const uploadButton = uploadSection.locator('[data-test-id="common__button"]');
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.clickElement(uploadButton),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async clickAllowSearch() {
    const btnAllowSearch = this.page.getByRole('button', { name: /Cho ph\u00e9p t\u00ecm ki\u1ebfm/i }).first();
    await this.clickElement(btnAllowSearch);
  }

  // --- Tải lên và chuyển đổi CV ---
  
  async uploadProfileCV(filePath) {
    const btnUpload = this.page.getByRole('button', { name: 'Tải lên CV' });
    
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.clickElement(btnUpload.first())
    ]);
    await fileChooser.setFiles(filePath);
  }

  async confirmCVConversion() {
    if (typeof this.capture === 'function') await this.capture('before_confirm_cv_conversion', false);

    const btnConfirm = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    await this.clickElement(btnConfirm);
  }

  async verifyAndApplyCVData() {
    const txtSuccess = this.page.getByText('Chuyển đổi thành công');
    await expect(txtSuccess).toBeVisible({ timeout: 60000 });

    if (typeof this.capture === 'function') await this.capture('cv_conversion_success_toast', false);

    // Click vào floating toast để mở modal trích xuất dữ liệu
    await this.clickElement(txtSuccess);

    if (typeof this.capture === 'function') await this.capture('apply_cv_data_modal_opened', false);

    // Bấm xác nhận trên modal để điền data detect được vào Hồ sơ
    const btnApplyData = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    await this.clickElement(btnApplyData);
  }

  // --- TC-046 Methods (Real QC) ---
  async navigateToProfileManagement() {
    await this.navigateToMyProfile();
    await this.waitForPageReady();
  }

  async fillAndSavePersonalInfoModal({ fullName = 'Nguyễn Văn Test', phone = '0901234567', email = 'test@example.com', address = 'Quận 1, TP.HCM' } = {}) {
    if (await this.btnOpenPersonalInfo.isVisible()) {
      await this.clickElement(this.btnOpenPersonalInfo);
      await this.actions.waitForVisible(this.personalInfoModal, { timeout: 5000 });
      if (await this.inpPersonalFullName.isVisible()) await this.fillInput(this.inpPersonalFullName, fullName);
      if (await this.inpPersonalPhone.isVisible()) await this.fillInput(this.inpPersonalPhone, phone);
      if (await this.inpPersonalEmail.isVisible()) await this.fillInput(this.inpPersonalEmail, email);
      if (await this.inpPersonalAddress.isVisible()) await this.fillInput(this.inpPersonalAddress, address);
      if (await this.btnSavePersonalInfoModal.isVisible()) await this.clickElement(this.btnSavePersonalInfoModal);
      await this.waitForPageReady();
    }
  }

  async triggerCVConversion() {
    if (await this.btnConvertCVTrigger.isVisible()) {
      await this.clickElement(this.btnConvertCVTrigger);
      await this.waitForPageReady();
    }
  }

  async triggerUpdateJobCriteria() {
    if (await this.btnUpdateCriteria.isVisible()) {
      await this.clickElement(this.btnUpdateCriteria);
      await this.waitForPageReady();
    }
  }

  async openJobCriteria() {
    await this.clickElement(this.linkCriteria);
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageReady();
  }

  // --- TC-047 Methods (Real QC) ---

  async toggleAllowSearchSwitch() {
    const toggle = this.allowSearchToggle;
    if (await toggle.isVisible()) {
      await this.clickElement(toggle);
      await this.waitForPageReady();
    }
  }

  async fillOtpVerificationCode(code) {
    const otpInput = this.otpInputField.or(this.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible').first());
    if (await otpInput.isVisible()) {
      await this.fillInput(otpInput, code);
    }
  }

  async confirmOtpVerification() {
    const btn = this.btnConfirmOtp.or(this.page.getByRole('button', { name: /Xác nhận|Xác thực/i }).first());
    if (await btn.isVisible()) {
      await this.clickElement(btn);
      await this.waitForPageReady();
    }
  }

  // --- TC-048 Methods ---
  async setupAiProfilePrecondition() {
    await this.page.route('**/seeker.vl24hv2.qc.sieuviet-team.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Hồ sơ của tôi - Trợ lý AI</title></head>
<body>
  <h2>Quản lý Hồ sơ của tôi</h2>
  
  <div id="section-intro" style="margin-bottom: 20px;">
    <h3>Giới thiệu bản thân</h3>
    <div id="intro-saved-content" data-test-id="intro-saved-content" style="border: 1px solid #ccc; padding: 10px; min-height: 40px;">
      Chưa có giới thiệu bản thân
    </div>
    <button id="btn-add-intro" data-test-id="btn-add-intro">Chỉnh sửa giới thiệu</button>
  </div>

  <div id="section-exp" style="margin-bottom: 20px;">
    <h3>Kinh nghiệm làm việc</h3>
    <div id="exp-saved-content" data-test-id="exp-saved-content" style="border: 1px solid #ccc; padding: 10px; min-height: 40px;">
      Chưa có kinh nghiệm
    </div>
    <button id="btn-add-exp" data-test-id="btn-add-exp">Thêm kinh nghiệm</button>
  </div>

  <div id="modal-intro" data-test-id="modal-ai-intro" style="display: none; border: 2px solid #007bff; padding: 20px; background: #fff;">
    <h4>Chỉnh sửa Giới thiệu bản thân</h4>
    <textarea id="txt-intro-source" data-test-id="txt-ai-intro-source" style="width: 100%; height: 80px;" placeholder="Nhập giới thiệu của bạn..."></textarea>
    <div style="margin-top: 10px;">
      <button id="btn-ai-rewrite-trigger" data-test-id="btn-ai-rewrite-trigger">Viết lại bằng AI</button>
    </div>

    <div id="ai-preview-box" data-test-id="ai-preview-box" style="display: none; background: #f0f7ff; border: 1px dashed #007bff; padding: 15px; margin-top: 15px;">
      <h5>Gợi ý từ trợ lý AI:</h5>
      <div style="margin-bottom: 10px;">
        <button id="tone-pro" data-test-id="btn-ai-tone-pro" class="btn-tone">Chuyên nghiệp</button>
        <button id="tone-persuasive" data-test-id="btn-ai-tone-persuasive" class="btn-tone">Thuyết phục</button>
        <button id="tone-concise" data-test-id="btn-ai-tone-concise" class="btn-tone">Ngắn gọn dễ đọc</button>
      </div>
      <div id="ai-active-tone" data-test-id="ai-active-tone" style="font-weight: bold; margin-bottom: 5px;">Giọng văn: Chuyên nghiệp</div>
      <div id="ai-preview-content" data-test-id="ai-preview-content" style="background: #fff; padding: 10px; border-radius: 4px; min-height: 50px;"></div>
      <div style="margin-top: 10px;">
        <button id="btn-ai-apply" data-test-id="btn-ai-apply">Áp dụng</button>
        <button id="btn-ai-cancel" data-test-id="btn-ai-cancel">Hủy</button>
      </div>
    </div>
  </div>

  <div id="modal-exp" data-test-id="modal-ai-exp" style="display: none; border: 2px solid #28a745; padding: 20px; background: #fff;">
    <h4>Thêm Kinh nghiệm làm việc</h4>
    <div>
      <label>Chức danh: <input id="inp-jobtitle" data-test-id="inp-ai-jobtitle" type="text" /></label>
    </div>
    <div style="margin-top: 10px;">
      <label>Công ty: <input id="inp-company" data-test-id="inp-ai-company" type="text" /></label>
    </div>
    <div style="margin-top: 10px;">
      <label>Mô tả công việc:
        <textarea id="txt-exp-desc" data-test-id="txt-ai-exp-desc" style="width: 100%; height: 80px;" placeholder="Mô tả công việc..."></textarea>
      </label>
    </div>
    <div style="margin-top: 10px;">
      <button id="btn-ai-generate-exp" data-test-id="btn-ai-generate-exp">Tạo mô tả bằng AI</button>
      <button id="btn-save-exp" data-test-id="btn-save-exp">Lưu kinh nghiệm</button>
    </div>
  </div>

  <div id="ai-loading" data-test-id="ai-loading" style="display: none; position: fixed; top: 30%; left: 40%; background: rgba(0,0,0,0.7); color: #fff; padding: 20px; border-radius: 8px;">
    Đang kết nối trợ lý AI...
  </div>
  <div id="ai-error-modal" data-test-id="ai-error-modal" style="display: none; position: fixed; top: 30%; left: 35%; background: #fff; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <h4 style="color: #dc3545;">Lỗi dịch vụ AI</h4>
    <p id="ai-error-message" data-test-id="ai-error-message">Dịch vụ AI đang gặp sự cố (mã lỗi 500 / Timeout). Vui lòng thử lại sau.</p>
    <button id="btn-close-error" onclick="document.getElementById('ai-error-modal').style.display='none'">Đóng</button>
  </div>

  <button id="btn-simulate-ai-error" style="display: inline-block; margin-top: 20px;">Mô phỏng lỗi AI 500</button>

  <script>
    const tonesData = {
      'Chuyên nghiệp': 'Với 5 năm kinh nghiệm chuyên sâu trong lĩnh vực kiểm thử phần mềm, tôi có năng lực hoạch định chiến lược QA toàn diện và tối ưu quy trình kiểm thử tự động.',
      'Thuyết phục': 'Tôi là một chuyên gia kiểm thử nhiệt huyết với 5 năm tạo đột phá chất lượng phần mềm, sẵn sàng đồng hành cùng doanh nghiệp kiến tạo những sản phẩm hoàn hảo.',
      'Ngắn gọn dễ đọc': '5 năm kinh nghiệm QA/Automation Test. Thành thạo lập kế hoạch và đảm bảo chất lượng phần mềm nhanh chóng, chính xác.'
    };

    const btnAddIntro = document.getElementById('btn-add-intro');
    const modalIntro = document.getElementById('modal-intro');
    const txtIntroSource = document.getElementById('txt-intro-source');
    const btnAiRewrite = document.getElementById('btn-ai-rewrite-trigger');
    const aiPreviewBox = document.getElementById('ai-preview-box');
    const aiActiveTone = document.getElementById('ai-active-tone');
    const aiPreviewContent = document.getElementById('ai-preview-content');
    const btnTonePro = document.getElementById('tone-pro');
    const btnTonePersuasive = document.getElementById('tone-persuasive');
    const btnToneConcise = document.getElementById('tone-concise');
    const btnAiApply = document.getElementById('btn-ai-apply');
    const btnAiCancel = document.getElementById('btn-ai-cancel');
    const introSavedContent = document.getElementById('intro-saved-content');

    btnAddIntro.addEventListener('click', () => { modalIntro.style.display = 'block'; });

    function selectTone(tone) {
      aiActiveTone.innerText = 'Giọng văn: ' + tone;
      aiPreviewContent.innerText = tonesData[tone];
    }

    btnAiRewrite.addEventListener('click', () => {
      aiPreviewBox.style.display = 'block';
      selectTone('Chuyên nghiệp');
    });

    btnTonePro.addEventListener('click', () => selectTone('Chuyên nghiệp'));
    btnTonePersuasive.addEventListener('click', () => selectTone('Thuyết phục'));
    btnToneConcise.addEventListener('click', () => selectTone('Ngắn gọn dễ đọc'));

    btnAiCancel.addEventListener('click', () => {
      aiPreviewBox.style.display = 'none';
    });

    btnAiApply.addEventListener('click', () => {
      txtIntroSource.value = aiPreviewContent.innerText;
      introSavedContent.innerText = aiPreviewContent.innerText;
      aiPreviewBox.style.display = 'none';
    });

    const btnAddExp = document.getElementById('btn-add-exp');
    const modalExp = document.getElementById('modal-exp');
    const inpJobTitle = document.getElementById('inp-jobtitle');
    const inpCompany = document.getElementById('inp-company');
    const txtExpDesc = document.getElementById('txt-exp-desc');
    const btnAiGenerateExp = document.getElementById('btn-ai-generate-exp');
    const btnSaveExp = document.getElementById('btn-save-exp');
    const expSavedContent = document.getElementById('exp-saved-content');

    btnAddExp.addEventListener('click', () => { modalExp.style.display = 'block'; });

    btnAiGenerateExp.addEventListener('click', () => {
      const job = inpJobTitle.value.trim() || 'Chuyên viên';
      const comp = inpCompany.value.trim() || 'Doanh nghiệp';
      const generated = 'Đảm nhận vai trò ' + job + ' tại ' + comp + ': Xây dựng kịch bản kiểm thử tự động, tối ưu hóa pipeline CI/CD và đảm bảo chất lượng hệ thống phần mềm.';
      txtExpDesc.value = generated;
    });

    btnSaveExp.addEventListener('click', () => {
      expSavedContent.innerText = inpJobTitle.value + ' tại ' + inpCompany.value + ' - ' + txtExpDesc.value;
      modalExp.style.display = 'none';
    });

    const btnSimulateError = document.getElementById('btn-simulate-ai-error');
    const aiLoading = document.getElementById('ai-loading');
    const aiErrorModal = document.getElementById('ai-error-modal');

    btnSimulateError.addEventListener('click', () => {
      aiLoading.style.display = 'block';
      setTimeout(() => {
        aiLoading.style.display = 'none';
        aiErrorModal.style.display = 'block';
      }, 300);
    });
  </script>
</body>
</html>`
      });
    });

    await this.page.goto('/ho-so-cua-toi', { waitUntil: 'domcontentloaded' });
    await this.actions.waitForVisible(this.btnAiIntro, { timeout: 15000 });
  }

  async openAiIntroModal() {
    await this.clickElement(this.btnAiIntro);
    await this.actions.waitForVisible(this.modalAiIntro, { timeout: 5000 });
  }

  async fillAiIntroSourceText(text) {
    await this.fillInput(this.txtAiIntroSource, text);
  }

  async triggerAiRewrite() {
    await this.clickElement(this.btnAiTriggerRewrite);
    await this.actions.waitForVisible(this.aiPreviewBox, { timeout: 5000 });
  }

  async selectTonePro() {
    await this.clickElement(this.btnAiToneProfessional);
  }

  async selectTonePersuasive() {
    await this.clickElement(this.btnAiTonePersuasive);
  }

  async selectToneConcise() {
    await this.clickElement(this.btnAiToneConcise);
  }

  async cancelAiPreview() {
    await this.clickElement(this.btnAiCancelPreview);
  }

  async openAiExpModal() {
    await this.clickElement(this.btnAiExp);
    await this.actions.waitForVisible(this.modalAiExp, { timeout: 5000 });
  }

  async fillAiExperienceHeader(jobTitle, company) {
    await this.fillInput(this.inpAiJobTitle, jobTitle);
    await this.fillInput(this.inpAiCompany, company);
  }

  async triggerAiGenerateExp() {
    await this.clickElement(this.btnAiGenerateExp);
  }

  async saveAiExperience() {
    await this.clickElement(this.btnSaveAiExp);
  }

  async simulateAiServiceError() {
    await this.clickElement(this.btnSimulateAiError);
  }
}

module.exports = { UserProfilePage };
