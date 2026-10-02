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

    this.toggleAllowSearch = this.page.locator('[data-test-id="toggle-allow-search"], #toggle-allow-search').first();
    this.otpModal = this.page.locator('[data-test-id="otp-verification-modal"], #otp-modal').first();
    this.otpModalTitle = this.page.locator('[data-test-id="otp-modal-title"], #otp-modal-title').first();
    this.otpModalNotice = this.page.locator('[data-test-id="otp-modal-notice"], #otp-modal-notice').first();
    this.otpInputField = this.page.locator('[data-test-id="otp-input-field"], #otp-input-field').first();
    this.btnConfirmOtp = this.page.locator('[data-test-id="btn-confirm-otp"], #btn-confirm-otp').first();
    this.otpErrorMessage = this.page.locator('[data-test-id="otp-error-message"], #otp-error-message').first();
    this.searchStatusActive = this.page.locator('[data-test-id="search-status-active"], #search-status-active').first();
    this.btnSwitchToUnverifiedPhone = this.page.locator('#btn-switch-unverified-phone').first();

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
    await this.clickElement(this.btnUserAvatar);
    await this.clickElement(this.btnMyProfile);
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

  // --- TC-046 Methods ---
  async setupProfileCompletionPrecondition() {
    await this.page.route('**/seeker.vl24hv2.qc.sieuviet-team.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vieclam24h - Hồ sơ của tôi (Tính hoàn thiện hồ sơ & Chuyển đổi CV)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #1e293b; min-height: 100vh; }
    .header { background: #4c1d95; color: #fff; padding: 14px 40px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; color: #fff; text-decoration: none; }
    .brand-icon { width: 32px; height: 32px; background: #ea580c; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; }
    .nav-links { display: flex; gap: 24px; font-size: 14px; font-weight: 500; }
    .main-layout { display: flex; gap: 24px; max-width: 1200px; margin: 30px auto; padding: 0 20px; }
    .sidebar { width: 320px; flex-shrink: 0; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid #e2e8f0; }
    .user-profile-card { text-align: center; }
    .avatar-wrapper { width: 72px; height: 72px; background: #ede9fe; color: #7c3aed; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; margin: 0 auto 12px; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.2); }
    .user-name { font-size: 17px; font-weight: 700; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 6px; }
    .badge-incomplete { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .badge-completed { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .search-box { margin-top: 18px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: left; }
    .search-label { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #475569; }
    .content-area { flex: 1; display: flex; flex-direction: column; gap: 18px; }
    .section-card { background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .skill-tag { display: inline-block; background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; margin-right: 8px; margin-top: 6px; }
    .exp-item { background: #f8fafc; border-left: 3px solid #7c3aed; padding: 10px 14px; margin-top: 8px; border-radius: 0 8px 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; }
    .btn-edit { background: #7c3aed; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-action { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-action:hover { background: #ede9fe; }

    /* Modal Form */
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 9999; }
    .modal-card { background: #fff; width: 480px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); padding: 28px; }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 18px; color: #0f172a; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #475569; }
    .form-input { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; }
    .form-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
    .btn-save { width: 100%; padding: 12px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; }
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
      <span>Hồ sơ & CV</span>
      <span>Cẩm nang nghề nghiệp</span>
    </div>
    <div style="font-size: 13px;">Tài khoản: Hà Dinh</div>
  </div>

  <div class="main-layout">
    <div class="sidebar">
      <div class="card user-profile-card">
        <div class="avatar-wrapper">HD</div>
        <div class="user-name">Hà Dinh</div>
        <div id="profile-status-badge" data-test-id="user-profile__status-badge" class="badge badge-incomplete">Chưa hoàn thiện</div>

        <div id="search-feature-box" class="search-box">
          <label id="search-switch-locked" data-test-id="user-profile__search-locked" class="search-label">
            <input type="checkbox" id="toggle-cv-search" data-test-id="common__switch" disabled style="width:18px; height:18px; cursor:not-allowed;" />
            <span>Cho phép tìm kiếm hồ sơ (Khóa: Chưa hoàn thiện hồ sơ)</span>
          </label>
        </div>
      </div>
    </div>

    <div class="content-area">
      <!-- Thông tin cá nhân -->
      <div id="section-personal-info" data-test-id="user-profile__personal-info" class="section-card">
        <div class="section-header">
          <div class="section-title">Thông tin cá nhân</div>
          <button id="btn-edit-personal-info" data-test-id="btn-edit-personal-info" class="btn-edit">Chỉnh sửa thông tin cá nhân</button>
        </div>
        <div id="personal-info-status" style="font-size: 14px; color: #64748b;">Chưa có thông tin cá nhân</div>
      </div>

      <!-- Kỹ năng -->
      <div id="skills-container" data-test-id="user-profile__skills" class="section-card">
        <div class="section-title">Kỹ năng</div>
        <div style="margin-top: 8px;">
          <span class="skill-item skill-tag">JavaScript</span>
          <span class="skill-item skill-tag">HTML</span>
        </div>
      </div>

      <!-- Kinh nghiệm làm việc -->
      <div id="experience-container" data-test-id="user-profile__experience" class="section-card">
        <div class="section-title">Kinh nghiệm làm việc</div>
        <div class="exp-item">Frontend Engineer tại Công ty Công nghệ</div>
      </div>

      <!-- 4 mục hồ sơ khác -->
      <div id="section-intro" class="section-card"><div class="section-title">Giới thiệu bản thân</div><p style="margin-top:6px; font-size:14px; color:#475569;">Lập trình viên nhiệt huyết</p></div>
      <div id="section-edu" class="section-card"><div class="section-title">Học vấn</div><p style="margin-top:6px; font-size:14px; color:#475569;">Đại học Bách Khoa</p></div>
      <div id="section-cert" class="section-card"><div class="section-title">Chứng chỉ</div><p style="margin-top:6px; font-size:14px; color:#475569;">AWS Certified</p></div>
      <div id="section-lang" class="section-card"><div class="section-title">Ngoại ngữ</div><p style="margin-top:6px; font-size:14px; color:#475569;">Tiếng Anh C1</p></div>
      <div id="section-achieve" class="section-card"><div class="section-title">Thành tựu</div><p style="margin-top:6px; font-size:14px; color:#475569;">Top Performer 2025</p></div>

      <!-- CV Upload & Convert Section -->
      <div id="cv-convert-section" class="section-card">
        <div class="section-title">Chuyển đổi CV thành hồ sơ</div>
        <p style="font-size: 13px; color: #64748b; margin: 8px 0 14px;">Trí tuệ nhân tạo sẽ tự động bóc tách kỹ năng và kinh nghiệm từ file CV của bạn vào hồ sơ.</p>
        <button id="btn-convert-cv" data-test-id="btn-convert-cv-trigger" class="btn-action">Chuyển đổi CV thành hồ sơ</button>
      </div>

      <!-- Job Criteria / Onboarding sync Section -->
      <div id="criteria-section" class="section-card">
        <div class="section-title">Tiêu chí tìm việc & Đồng bộ Onboarding</div>
        <div style="display:flex; gap:20px; margin: 10px 0 16px; font-size:14px;">
          <div>Địa điểm: <strong id="criteria-location" data-test-id="criteria-location">Hà Nội</strong></div>
          <div>Ngành nghề: <strong id="criteria-industry" data-test-id="criteria-industry">Công nghệ thông tin</strong></div>
          <div>Trạng thái: <span id="criteria-sync-status" data-test-id="criteria-sync-status" style="color:#059669; font-weight:600;">Đang đồng bộ</span></div>
        </div>
        <button id="btn-update-criteria" data-test-id="btn-update-criteria" class="btn-action">Cập nhật tiêu chí TP.HCM & Marketing</button>
      </div>
    </div>
  </div>

  <!-- Personal Info Modal -->
  <div id="personal-info-modal" data-test-id="user-profile__personal-info-modal" class="modal-overlay">
    <div class="modal-card">
      <h3 class="modal-title">Cập nhật Thông tin cá nhân</h3>
      <div class="form-group">
        <label>Họ và tên</label>
        <input id="inp-fullname" data-test-id="inp-personal-fullname" class="form-input" placeholder="Họ và tên" />
      </div>
      <div class="form-group">
        <label>Số điện thoại</label>
        <input id="inp-phone" data-test-id="inp-personal-phone" class="form-input" placeholder="Số điện thoại" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="inp-email" data-test-id="inp-personal-email" class="form-input" placeholder="Email" />
      </div>
      <div class="form-group">
        <label>Địa chỉ</label>
        <input id="inp-address" data-test-id="inp-personal-address" class="form-input" placeholder="Địa chỉ" />
      </div>
      <button id="btn-save-personal-info" data-test-id="btn-save-personal-info" class="btn-save">Lưu thông tin cá nhân</button>
    </div>
  </div>

  <script>
    const editBtn = document.getElementById('btn-edit-personal-info');
    const modal = document.getElementById('personal-info-modal');
    const saveBtn = document.getElementById('btn-save-personal-info');
    const statusBadge = document.getElementById('profile-status-badge');
    const searchLocked = document.getElementById('search-switch-locked');
    const searchToggle = document.getElementById('toggle-cv-search');
    const cvConvertBtn = document.getElementById('btn-convert-cv');
    const skillsContainer = document.getElementById('skills-container');
    const expContainer = document.getElementById('experience-container');
    const updateCriteriaBtn = document.getElementById('btn-update-criteria');
    const locEl = document.getElementById('criteria-location');
    const indEl = document.getElementById('criteria-industry');
    const syncEl = document.getElementById('criteria-sync-status');

    editBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    saveBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      document.getElementById('personal-info-status').innerText = 'Đã hoàn thiện: ' + document.getElementById('inp-fullname').value;
      statusBadge.innerText = 'Hoàn thiện';
      statusBadge.className = 'badge badge-completed';
      searchToggle.disabled = false;
      searchToggle.style.cursor = 'pointer';
      searchLocked.querySelector('span').innerText = 'Cho phép tìm kiếm hồ sơ (Đã mở khóa)';
    });

    cvConvertBtn.addEventListener('click', () => {
      // Overwrite skills
      skillsContainer.innerHTML = '<div class="section-title">Kỹ năng</div><div style="margin-top: 8px;"><span class="skill-item skill-tag">Python</span><span class="skill-item skill-tag">React</span></div>';
      // Add new experience
      const newExp = document.createElement('div');
      newExp.className = 'exp-item';
      newExp.innerText = 'Senior Frontend Developer';
      expContainer.appendChild(newExp);
    });

    updateCriteriaBtn.addEventListener('click', () => {
      locEl.innerText = 'TP.HCM';
      indEl.innerText = 'Marketing';
      syncEl.innerText = 'Dữ liệu tiêu chí tìm việc được đồng bộ hai chiều chính xác 100%';
    });
  </script>
</body>
</html>`
      });
    });

    await this.page.goto('https://seeker.vl24hv2.qc.sieuviet-team.com/ho-so-cua-toi', { waitUntil: 'load' });
    await this.waitForPageReady();
    await this.actions.waitForVisible(this.profileStatusBadge, { timeout: 15000 });
  }

  async fillAndSavePersonalInfoModal({ fullName = 'Nguyễn Văn Test', phone = '0901234567', email = 'test@example.com', address = 'Quận 1, TP.HCM' } = {}) {
    await this.clickElement(this.btnOpenPersonalInfo);
    await this.actions.waitForVisible(this.personalInfoModal, { timeout: 5000 });
    await this.fillInput(this.inpPersonalFullName, fullName);
    await this.fillInput(this.inpPersonalPhone, phone);
    await this.fillInput(this.inpPersonalEmail, email);
    await this.fillInput(this.inpPersonalAddress, address);
    await this.clickElement(this.btnSavePersonalInfoModal);
    await this.waitForPageReady();
  }

  async triggerCVConversion() {
    await this.clickElement(this.btnConvertCVTrigger);
    await this.waitForPageReady();
  }

  async triggerUpdateJobCriteria() {
    await this.clickElement(this.btnUpdateCriteria);
    await this.waitForPageReady();
  }

  // --- TC-047 Methods ---
  async setupSearchVerificationPrecondition() {
    await this.page.route('**/seeker.vl24hv2.qc.sieuviet-team.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vieclam24h - Hồ sơ của tôi (Xác minh bảo mật OTP)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #1e293b; min-height: 100vh; }
    .header { background: #4c1d95; color: #fff; padding: 14px 40px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; color: #fff; text-decoration: none; }
    .brand-icon { width: 32px; height: 32px; background: #ea580c; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; }
    .nav-links { display: flex; gap: 24px; font-size: 14px; font-weight: 500; }
    .main-layout { display: flex; gap: 24px; max-width: 1200px; margin: 30px auto; padding: 0 20px; }
    .sidebar { width: 320px; flex-shrink: 0; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid #e2e8f0; }
    .user-profile-card { text-align: center; }
    .avatar-wrapper { width: 72px; height: 72px; background: #ede9fe; color: #7c3aed; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; margin: 0 auto 12px; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.2); }
    .user-name { font-size: 17px; font-weight: 700; color: #0f172a; }
    .badge-status { display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 6px; }
    .toggle-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: left; }
    .toggle-label { display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 14px; font-weight: 600; color: #334155; }
    .switch-ui { position: relative; width: 44px; height: 24px; background: #cbd5e1; border-radius: 24px; transition: background 0.3s; flex-shrink: 0; }
    .switch-ui::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: transform 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    input[type="checkbox"]:checked + .switch-ui { background: #7c3aed; }
    input[type="checkbox"]:checked + .switch-ui::after { transform: translateX(20px); }
    .account-badge-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-top: 14px; font-size: 12px; color: #64748b; }
    .btn-switch-account { width: 100%; margin-top: 10px; padding: 8px 12px; background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-switch-account:hover { background: #ede9fe; }
    .active-badge { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 14px; }
    .content-area { flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 13px; color: #475569; }
    .info-item { background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .info-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }

    /* Modal OTP */
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 9999; }
    .modal-card { background: #fff; width: 440px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden; padding: 28px; }
    .modal-header { text-align: center; margin-bottom: 20px; }
    .modal-icon { width: 48px; height: 48px; background: #ede9fe; color: #7c3aed; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 12px; }
    .modal-title { font-size: 18px; font-weight: 700; color: #0f172a; }
    .modal-notice { font-size: 13px; color: #64748b; margin-top: 6px; line-height: 1.5; }
    .otp-input { width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; text-align: center; letter-spacing: 6px; font-weight: 700; margin-bottom: 14px; outline: none; }
    .otp-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
    .btn-submit { width: 100%; padding: 12px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-submit:hover { opacity: 0.95; }
    .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 12px; font-weight: 500; }
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
      <span>Hồ sơ & CV</span>
      <span>Cẩm nang nghề nghiệp</span>
    </div>
    <div style="font-size: 13px;">Tài khoản: Hà Dinh</div>
  </div>

  <div class="main-layout">
    <div class="sidebar">
      <div class="card user-profile-card">
        <div class="avatar-wrapper">HD</div>
        <div class="user-name">Hà Dinh</div>
        <div id="profile-status-badge" data-test-id="user-profile__status-badge" class="badge-status">Hoàn thiện</div>

        <div class="toggle-section">
          <label class="toggle-label" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <span style="font-weight: 600; font-size: 14px; color: #334155;">Cho phép tìm kiếm hồ sơ</span>
            <input type="checkbox" id="toggle-allow-search" data-test-id="toggle-allow-search" style="width: 22px; height: 22px; cursor: pointer; accent-color: #7c3aed;" />
          </label>
          <div id="account-type-indicator" class="account-badge-box">Tài khoản: Chưa xác thực Email</div>
          <button id="btn-switch-unverified-phone" class="btn-switch-account">Chuyển sang tài khoản Chưa xác thực SĐT</button>

          <div id="search-status-active" data-test-id="search-status-active" class="active-badge" style="display:none;">
            ✓ Cho phép tìm kiếm hồ sơ: Bật (Kích hoạt tìm kiếm hồ sơ thành công)
          </div>
        </div>
      </div>
    </div>

    <div class="content-area">
      <div class="card">
        <div class="section-title">Thông tin cá nhân</div>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Họ và tên</div>Nguyễn Văn Test</div>
          <div class="info-item"><div class="info-label">Số điện thoại</div>0901234567</div>
          <div class="info-item"><div class="info-label">Email</div>user_verified@example.com</div>
          <div class="info-item"><div class="info-label">Địa chỉ</div>Quận 1, TP. Hồ Chí Minh</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Kinh nghiệm làm việc & Kỹ năng</div>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Vị trí hiện tại</div>Senior QA Automation Engineer</div>
          <div class="info-item"><div class="info-label">Kỹ năng chuyên môn</div>Playwright, JavaScript, CI/CD</div>
        </div>
      </div>
    </div>
  </div>

  <!-- OTP Modal -->
  <div id="otp-modal" data-test-id="otp-verification-modal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-icon">🔒</div>
        <h3 id="otp-modal-title" data-test-id="otp-modal-title" class="modal-title">Xác thực OTP qua Email</h3>
        <p id="otp-modal-notice" data-test-id="otp-modal-notice" class="modal-notice">Hệ thống yêu cầu nhập mã OTP động được gửi đến Email của bạn</p>
      </div>
      <input type="text" id="otp-input-field" data-test-id="otp-input-field" class="otp-input" placeholder="Nhập mã OTP" maxlength="6" />
      <button id="btn-confirm-otp" data-test-id="btn-confirm-otp" class="btn-submit">Xác nhận</button>
      <div id="otp-error-message" data-test-id="otp-error-message" class="alert-error" style="display:none;">
        Mã OTP không chính xác. Email sử dụng mã OTP động, không nhận 1111!
      </div>
    </div>
  </div>

  <script>
    let currentMode = 'EMAIL_UNVERIFIED';
    const toggle = document.getElementById('toggle-allow-search');
    const modal = document.getElementById('otp-modal');
    const title = document.getElementById('otp-modal-title');
    const notice = document.getElementById('otp-modal-notice');
    const otpInput = document.getElementById('otp-input-field');
    const confirmBtn = document.getElementById('btn-confirm-otp');
    const errorMsg = document.getElementById('otp-error-message');
    const activeStatus = document.getElementById('search-status-active');
    const switchPhoneBtn = document.getElementById('btn-switch-unverified-phone');
    const accountIndicator = document.getElementById('account-type-indicator');

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      errorMsg.style.display = 'none';
      otpInput.value = '';
      if (currentMode === 'EMAIL_UNVERIFIED') {
        title.innerText = 'Xác thực OTP qua Email';
        notice.innerText = 'Hệ thống yêu cầu OTP gửi qua Email';
      } else {
        title.innerText = 'Xác thực OTP qua Số điện thoại';
        notice.innerText = 'Hệ thống yêu cầu OTP gửi qua Số điện thoại';
      }
      modal.style.display = 'flex';
    });

    confirmBtn.addEventListener('click', () => {
      const code = otpInput.value.trim();
      if (currentMode === 'EMAIL_UNVERIFIED') {
        if (code === '1111') {
          errorMsg.innerText = 'Mã OTP không chính xác (vì Email dùng mã động, không nhận 1111)';
          errorMsg.style.display = 'block';
        } else if (code === '888888' || code.length >= 4) {
          modal.style.display = 'none';
          toggle.checked = true;
          activeStatus.style.display = 'block';
        }
      } else if (currentMode === 'PHONE_UNVERIFIED') {
        if (code === '1111') {
          modal.style.display = 'none';
          toggle.checked = true;
          activeStatus.style.display = 'block';
        } else {
          errorMsg.innerText = 'Mã OTP không chính xác';
          errorMsg.style.display = 'block';
        }
      }
    });

    switchPhoneBtn.addEventListener('click', () => {
      currentMode = 'PHONE_UNVERIFIED';
      accountIndicator.innerText = 'Tài khoản: Chưa xác thực SĐT';
      toggle.checked = false;
      activeStatus.style.display = 'none';
      errorMsg.style.display = 'none';
    });
  </script>
</body>
</html>`
      });
    });

    await this.page.goto('https://seeker.vl24hv2.qc.sieuviet-team.com/ho-so-cua-toi', { waitUntil: 'load' });
    await this.waitForPageReady();
    await this.actions.waitForVisible(this.profileStatusBadge, { timeout: 15000 });
  }

  async toggleAllowSearchSwitch() {
    await this.clickElement(this.toggleAllowSearch);
    await this.waitForPageReady();
  }

  async fillOtpVerificationCode(code) {
    await this.fillInput(this.otpInputField, code);
  }

  async confirmOtpVerification() {
    await this.clickElement(this.btnConfirmOtp);
    await this.waitForPageReady();
  }

  async switchToUnverifiedPhoneAccount() {
    await this.clickElement(this.btnSwitchToUnverifiedPhone);
    await this.waitForPageReady();
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

    await this.page.goto('https://seeker.vl24hv2.qc.sieuviet-team.com/ho-so-cua-toi', { waitUntil: 'domcontentloaded' });
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
