const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { ScreenshotHelper } = require('../core/utils/commonUtils');

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
    this.btnAddEdu = this.page.locator('[data-test-id="user-profile__education"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddAchievement = this.page.locator('[data-test-id="user-profile__achievement"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddSkill = this.page.locator('[data-test-id="user-profile__skills"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddCertificate = this.page.locator('[data-test-id="user-profile__certificate"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddLanguage = this.page.locator('[data-test-id="user-profile__foreign-language"] [data-test-id="user-profile__add-button"]').first();

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
  }

  async navigateToMyProfile() {
    await this.clickElement(this.btnUserAvatar);
    await this.clickElement(this.btnMyProfile);
    // Wait for navigation to profile page to complete
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    // Then wait for the add experience button to appear
    await this.actions.waitForVisible(this.btnAddExperience, { timeout: 30000 });
  }

  async saveSection() {
    await this.clickElement(this.btnCommonSave);
    await this.waitForGlobalLoadingHidden(30000);
  }

  // --- Kinh nghiệm ---
  async clickAddExperience() {
    await this.clickElement(this.btnAddExperience);
  }

  async fillExperience(data) {
    await this.fillInput(this.txtCompany, data.company);

    await this.fillInput(this.txtJobTitleSearch, data.jobTitle);
    const jobTitleOption = this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.jobTitle + '$', 'i') }).locator('span').first();
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

  // --- Giới thiệu ---
  async clickAddIntroduction() {
    try {
      await this.clickElement(this.btnAddIntro, { timeout: 5000 });
    } catch (e) {
      console.log('data-test-id for Intro failed, trying fallback...');
      try {
        await this.clickElement(this.page.getByRole('button', { name: 'Thêm giới thiệu bản thân' }).first(), { timeout: 3000 });
      } catch (e2) {
        await this.clickElement(this.page.locator('xpath=//div[contains(text(), "Giới thiệu bản thân") or h3/text()="Giới thiệu bản thân" or span/text()="Giới thiệu bản thân"]/ancestor::div[1]//button').first());
      }
    }
  }

  async fillIntroduction(text) {
    await this.fillInput(this.txtIntro, text);
  }

  // --- Học vấn ---
  async clickAddEducation() {
    await this.clickElement(this.btnAddEdu);
  }

  async fillEducation(data) {
    await this.fillInput(this.txtSchool, data.school);
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.school + '$', 'i') }).first());

    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.page.getByText(data.startYear, { exact: true }).first());

    await this.clickElement(this.inpEndDate);
    await this.clickElement(this.page.getByText(data.endYear).first());

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
    const btnEditPersonalInfo = this.page.locator('[data-test-id="user-profile__personal-info"] [data-test-id="user-profile__edit-button"]').first();
    await this.clickElement(btnEditPersonalInfo);
  }

  async fillPersonalInfo(data) {
    // Select Province
    await this.clickElement(this.page.getByText('Chọn tỉnh thành').first());
    await this.clickElement(this.page.locator('[data-test-id="common__select-menu"] div').filter({ hasText: data.province }).nth(3).first());

    // Select District after its async options finish rendering
    await this.clickElement(this.page.getByText('Chọn quận huyện').first());

    const districtName = data.district.split('(')[0].trim();
    const districtOption = this.page
      .locator('[data-test-id="common__select-menu"]')
      .getByRole('heading')
      .filter({ hasText: districtName })
      .first();

    await districtOption.waitFor({ state: 'visible', timeout: 35000 });
    await this.clickElement(districtOption);

    // Fill Date of Birth
    const inpDateOfBirth = this.page.getByRole('textbox', { name: 'DD/MM/YYYY' }).first();
    await this.clickElement(inpDateOfBirth);

    // Select Month
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^Tháng \\d+', 'i') }).first());
    await this.clickElement(this.page.getByText(data.birthMonth).first());

    // Select Year
    await this.clickElement(this.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first());
    await this.clickElement(this.page.getByText(data.birthYear).first());

    // Select Day
    await this.clickElement(this.page.getByRole('button', { name: new RegExp(`Choose.*${data.birthDay}.*tháng`) }).first());

    // Select Gender
    await this.clickElement(this.page.getByRole('button', { name: data.gender }).first());
  }

  async savePersonalInfo() {
    // Save personal info
    await this.saveSection();
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

  async fillJobGoal(data) {
    // Select experience level
    await this.clickElement(this.page.getByRole('button', { name: new RegExp(data.experienceLevel, 'i') }).first());

    // Select years of experience
    await this.clickElement(this.page.getByText('Chọn số năm kinh nghiệm').first());
    await this.clickElement(this.page.getByRole('heading', { name: data.yearsOfExperience }).first());

    // Fill job title
    const jobTitleInput = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    await this.fillInput(jobTitleInput, data.jobTitle);
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${data.jobTitle}$`, 'i') }).locator('span').first());

    // Select industry
    await this.clickElement(this.page.getByText('Chọn ngành nghề').first());
    await this.clickElement(this.page.getByRole('heading', { name: new RegExp(data.industry, 'i') }).first());
    const removeIndustryBtn = this.page.locator('[data-test-id="user-profile__job-goal-modal"]').getByRole('heading', { name: 'Tiêu chí tìm việc' }).first();
    await this.clickElement(removeIndustryBtn);

    // Select location
    await this.clickElement(this.page.getByText('Chọn địa điểm').first());
    await this.clickElement(this.page.getByRole('heading', { name: data.workLocation }).first());
    const removeLocationBtn = this.page.locator('[data-test-id="common__actions-button"]').first();
    await this.clickElement(removeLocationBtn);

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
    await this.clickElement(this.page.locator('[data-test-id="common__select-menu"] div').filter({ hasText: data.currentLevel }).nth(3).first());

    // Select work type
    await this.clickElement(this.page.getByText('Chọn hình thức làm việc').first());
    await this.clickElement(this.page.getByRole('heading', { name: data.workType }).first());
    const removeWorkTypeBtn = this.page.locator('[data-test-id="common__actions-button"]').first();
    await this.clickElement(removeWorkTypeBtn);

    // Scroll back to save button
    const scrollTarget2 = jobGoalModal.locator('div').filter({ hasText: 'Kinh nghiệm làm việc*' }).nth(2);
    await scrollTarget2.scrollIntoViewIfNeeded();
  }

  // --- CV Upload ---
  async saveJobGoal() {
    // Save job goal
    await this.saveSection();
  }

  // --- CV Upload ---
  async enableCVSearch() {
    const cvSearchSwitch = this.page.locator('[data-test-id="common__switch"]').first();
    await this.clickElement(cvSearchSwitch);
  }

  async clickContinueButton() {
    const btnContinue = this.page.getByRole('button', { name: 'Tiếp tục' }).first();
    await this.clickElement(btnContinue);
  }

  async fillVerificationCode(code) {
    const verificationInputs = this.page.getByRole('textbox', { name: /Digit|Please enter verification/i });
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
    const btnAllowSearch = this.page.getByRole('button', { name: 'Cho phép tìm kiếm' }).first();
    await this.clickElement(btnAllowSearch);
  }
}

module.exports = { UserProfilePage };
