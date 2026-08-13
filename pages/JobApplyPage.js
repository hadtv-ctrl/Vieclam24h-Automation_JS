const { BasePage } = require('./BasePage');
const { ScreenshotHelper } = require('../core/utils/commonUtils');

class JobApplyPage extends BasePage {
  constructor(page) {
    super(page);

    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-details');

    // --- Locators (Các element trong page) ---
    this.btnApplyNow = this.page.getByRole('button', { name: 'Ứng tuyển ngay' }).first();
    this.optProfileMethod = this.page.locator('[data-test-id="apply-method-selector__option-profile"]').first();
    this.btnContinueProfile = this.page.locator('[data-test-id="apply-profile-completion-content__action"]').first();
    this.btnCommonSave = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    this.txtCommonInput = this.page.locator('[data-test-id="common__input"]').first();

    // Giới thiệu
    this.btnAddIntro = this.page.locator('[data-test-id="apply-job__introduce"] [data-test-id="user-profile__add-button"]').first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Hãy chia sẻ về kinh nghiệm/i }).first();

    // Kinh nghiệm
    this.btnHasExperience = this.page.getByRole('button', { name: /Đã có/i }).first();
    this.btnAddExperience = this.page.locator('[data-test-id="apply-job__experience"] [data-test-id="user-profile__add-button"]').first();
    this.txtCompany = this.page.getByRole('textbox', { name: /Nhập tên công ty/i }).first();
    this.txtJobTitleSearch = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    this.optJobTitleFirst = this.page.locator('[data-test-id="common__select-dropdown"] .text-se-accent').first();
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
    this.chkConfirmAll = this.page.locator('[data-test-id="common__checkall"]').first();
    this.confirmCheckboxes = this.page.locator('[data-test-id="common__checkbox-group"] [data-test-id="common__checkbox"]');
    this.btnConfirmPopup = this.page.getByRole('button', { name: /Nộp hồ sơ ngay/i }).first();

    this.btnApplyAll = this.page.locator('[data-test-id="common__button"]').first();
    this.btnSeeMoreJobs = this.page.getByRole('button', { name: /Xem thêm việc gợi ý/i }).first();
  }

  // --- Actions ---
  async startApply() {
    await this.clickElement(this.btnApplyNow);
    await this.actions.waitForVisible(this.optProfileMethod);
  }

  async applyByProfile() {
    await this.clickElement(this.optProfileMethod);
  }

  async continueApply() {
    await this.clickElement(this.btnContinueProfile);
  }

  async saveSection() {
    await this.clickElement(this.btnCommonSave);
  }

  // --- Introduction Actions ---
  async clickAddIntroduction() {
    await this.clickElement(this.btnAddIntro);
  }

  async fillIntroduction(text) {
    await this.fillInput(this.txtIntro, text);
  }

  // --- Experience Actions ---
  async clickAddExperience() {
    await this.btnAddExperience.evaluate(element => element.scrollIntoView());
    await this.clickElement(this.btnAddExperience);
  }
  async fillExperience(data) {
    await this.fillInput(this.txtCompany, data.company);
    await this.fillInput(this.txtJobTitleSearch, data.jobTitle);
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
  }
  async fillSkill(skillName) {
    await this.fillInput(this.txtCommonInput, skillName);
    await this.clickElement(this.page.getByText(skillName, { exact: true }));
  }

  // --- Achievement Actions ---
  async clickAddAchievement() {
    await this.btnAddAchievement.scrollIntoViewIfNeeded();
    await this.clickElement(this.btnAddAchievement);
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
  }

  async fillCertificate(certName) {
    await this.fillInput(this.txtCommonInput, certName);
  }

  // --- Language Actions ---
  async clickAddForeignLanguage() {
    await this.btnAddLanguage.scrollIntoViewIfNeeded();
    await this.clickElement(this.btnAddLanguage);
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

  async bulkApply() {
    // Chờ cho page xác nhận cuối cùng hiển thị
    await this.actions.waitForVisible(this.chkConfirmAll, { timeout: 15000 });

    // Checkbox là tín hiệu nghiệp vụ cho biết danh sách bulk apply đã sẵn sàng.
    await this.actions.waitForVisible(this.chkConfirmAll, { timeout: 15000 });
    await this.capture('before_bulk_apply');
    await this.clickElement(this.chkConfirmAll); // Check all checkbox để xác nhận thông tin
    await this.capture('after_bulk_apply');

    await this.clickElement(this.btnApplyAll);
    await this.capture('after_click_apply_all');

    await this.clickElement(this.btnCommonSave);

    // Wait for loading icon to disappear
    await this.waitForGlobalLoadingHidden(15000);
    // Wait for the popup and its button to be visible
    await this.actions.waitForVisible(this.btnSeeMoreJobs, { timeout: 15000 });
    await this.capture('after_click_submit_all');
    await this.clickElement(this.btnSeeMoreJobs);
  }

}

module.exports = { JobApplyPage };
