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
    await this.page.waitForLoadState('networkidle');
  }

  async saveSection() {
    await this.clickElement(this.btnCommonSave);
    await this.page.waitForLoadState('networkidle');
  }

  // --- Kinh nghiệm ---
  async clickAddExperience() {
    await this.clickElement(this.btnAddExperience);
  }

  async fillExperience(data) {
    await this.fillInput(this.txtCompany, data.company);
    await this.page.waitForTimeout(500); // Đợi dropdown hiển thị

    await this.fillInput(this.txtJobTitleSearch, data.jobTitle);
    await this.page.waitForTimeout(500); // Đợi dropdown hiển thị
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.jobTitle + '$', 'i') }).locator('span').first());

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
    await this.page.waitForTimeout(500); // Đợi dropdown hiển thị
    await this.clickElement(this.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.school + '$', 'i') }).first());

    await this.clickElement(this.inpStartDate);
    await this.clickElement(this.page.getByText(data.startYear, { exact: true }).first());

    await this.clickElement(this.inpEndDate);
    await this.clickElement(this.page.getByText(data.endYear).first());

    await this.fillInput(this.txtMajor, data.major);
    await this.page.waitForTimeout(500); // Đợi dropdown hiển thị
    // Since major could be a long string or cut off, we pick the first match containing the text
    await this.clickElement(this.page.getByText(data.major).first());

    await this.lblDegree.click();
    await this.page.waitForTimeout(500);
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
    await this.page.waitForTimeout(500); // Đợi dropdown hiển thị
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
}

module.exports = { UserProfilePage };
