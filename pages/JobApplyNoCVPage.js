const { BasePage } = require('./BasePage');
const { ScreenshotHelper } = require('../core/utils/commonUtils');
const { expect } = require('@playwright/test');

class JobApplyNoCVPage extends BasePage {
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-nocv');
    
    // Locators
    this.btnApplyNoCV = this.page.getByRole('button', { name: /Ứng tuyển không cần CV/i }).first();
    this.txtFullName = this.page.getByRole('textbox', { name: /Nhập họ và tên/i });
    this.txtPhone = this.page.getByRole('textbox', { name: /Nhập số điện thoại/i });
    this.txtProvince = this.page.getByRole('textbox', { name: /Chọn tỉnh/i }).first();
    this.txtDistrict = this.page.getByText('Chọn quận').first();
    this.iconChevronDown = this.page.locator('.flex.items-center.cursor-pointer > .svicon-chevron-down').first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Chia sẻ về bản thân & kinh/i }).first();
    this.txtBirthYear = this.page.getByRole('textbox', { name: /Chọn năm sinh/i }).first();
    this.txtEducation = this.page.getByText('Chọn học vấn', { exact: true }).first();
    this.btnUploadFile = this.page.getByRole('button', { name: /Chọn hình\/file|Thay hình/i }).first();
    this.btnDone = this.page.getByRole('button', { name: 'Xong' }).first();
    this.btnCommonSave = this.page.getByRole('button', { name: /Nộp hồ sơ ngay/i }).first();
    this.chkCheckAll = this.page.locator('[data-test-id="common__checkall"]').getByRole('checkbox').first();
    this.bulkJobCheckboxes = this.page.locator('[data-test-id="common__checkbox"]');
    this.btnBulkApply = this.page.getByRole('button', { name: /Ứng tuyển/i }).last();
    this.btnBulkApplyZero = this.page.getByRole('button', { name: /Ứng tuyển\s*0\s*vị trí/i }).first();
    this.btnBulkApplyReady = this.page.getByRole('button', { name: /\u1ee8ng tuy\u1ec3n\s*[1-9]\d*\s*v\u1ecb tr\u00ed/i }).first();
    this.btnBulkApplyZeroStable = this.page.getByRole('button', { name: /\u1ee8ng tuy\u1ec3n\s*0\s*v\u1ecb tr\u00ed/i }).first();
    this.btnCommonNext = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').last();
    this.btnSeeMoreJobs = this.page.getByRole('button', { name: /Xem thêm việc gợi ý/i }).first();
    this.msgNoSimilarJobs = this.page
      .getByText(/Hiện chưa tìm thấy việc làm phù hợp|Không có.*(?:job|việc làm).*gợi ý|Không tìm thấy.*việc làm phù hợp/i)
      .first();
  }

  async startApplyNoCV(options = {}) {
    await this.clickElement(this.btnApplyNoCV);
    await this.handlePhoneVerificationAfterApplyIfVisible(options.otpCode);
  }

  async startGuestApplyNoCV() {
    await this.clickElement(this.btnApplyNoCV);
    await expect(this.txtFullName).toBeVisible({ timeout: 15000 });
  }

  async fillGuestContact(data) {
    await this.fillInput(this.txtFullName, data.fullName);
    await this.fillInput(this.txtPhone, data.phone);
  }

  async submitGuestProfile() {
    await this.submitProfile();
    const verificationLocators = this.getPhoneVerificationLocators();
    await this.waitForPhoneVerificationCodeStepVisible(verificationLocators, 15000);
    await this.capture('phone_verification_code_step');
  }

  async verifyGuestPhoneOtp(otpCode) {
    await this.submitPhoneVerificationOtp(otpCode);
  }

  async fillMiniProfile(data) {
    // Province
    await this.clickElement(this.txtProvince);
    await this.clickElement(this.page.getByRole('button', { name: data.province }));

    // District: match relatively because option labels may differ slightly from source data.
    await this.clickElement(this.txtDistrict);
    for (const district of data.districts) {
      const districtName = String(district || '').trim();
      if (!districtName) continue;

      const districtOption = this.page
        .getByRole('button')
        .filter({
          hasText: new RegExp(districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        })
        .first();

      try {
        await this.clickElement(districtOption);
      } catch (error) {
        const fallbackOption = this.page
          .getByText(new RegExp(districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
          .first();
        await this.clickElement(fallbackOption);
      }
    }
    // Close dropdown
    await this.page.keyboard.press('Escape');

    // Intro (Optional based on job)
    if (data.intro) {
      try {
        await this.txtIntro.waitFor({ state: 'visible', timeout: 3000 });
        await this.clickElement(this.txtIntro);
        await this.fillInput(this.txtIntro, data.intro);
      } catch (e) {
        console.log('Intro field not present for this job, skipping...');
      }
    }

    // Birth Year
    await this.clickElement(this.txtBirthYear);
    await this.clickElement(this.page.getByRole('button', { name: data.birthYear }));

    if (data.education && await this.txtEducation.isVisible()) {
      await this.clickElement(this.txtEducation);
      await this.clickElement(this.page.getByText(data.education, { exact: true }).last());
    }

    // Gender can be absent in some no-CV mini profile forms.
    if (data.gender) {
      const genderOption = this.page.locator('label').filter({ hasText: data.gender }).locator('i').first();
      try {
        await genderOption.waitFor({ state: 'visible', timeout: 3000 });
        await this.clickElement(genderOption);
      } catch (e) {
        console.log('Job hiện tại không yêu cầu chọn giới tính, bỏ qua trường optional.');
      }
    }

    // File Upload
    if (data.uploadFile) {
      const uploadAvailable = await this.btnUploadFile.isVisible();
      if (uploadAvailable) {
        const [fileChooser] = await Promise.all([
          this.page.waitForEvent('filechooser', { timeout: 5000 }),
          this.clickElement(this.btnUploadFile),
        ]);
        await fileChooser.setFiles(data.uploadFile);
        await this.clickElement(this.btnDone);
      } else {
        console.log('Job hiện tại không yêu cầu upload hình/file, bỏ qua trường optional.');
      }
    }
  }

  async submitProfile() {
    await this.waitForGlobalLoadingHidden(15000);
    await this.actions.waitForVisible(this.btnCommonSave, { timeout: 15000 });
    // Ensure button is enabled before clicking
    await this.btnCommonSave.waitFor({ state: 'visible' });
    await this.clickElement(this.btnCommonSave);
  }

  async bulkApply(dataJob2) {
    // Wait for either the bulk apply list, the success action, or the empty-state message.
    const target = this.chkCheckAll.or(this.btnSeeMoreJobs).or(this.msgNoSimilarJobs).or(this.btnBulkApplyZero);
    try {
      await target.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      console.log('Không tìm thấy danh sách Bulk Apply, kết thúc kịch bản.');
      return false;
    }

    const hasBulkApplyJobs = await this.waitForBulkApplyListReady();
    if (!hasBulkApplyJobs) {
      console.log('Khong co job trong danh sach Bulk Apply sau khi cho danh sach render xong.');
      return false;
    }

    if (await this.btnSeeMoreJobs.isVisible()) {
        console.log('Không có job nào gợi ý để Bulk Apply, kết thúc kịch bản.');
        await this.clickElement(this.btnSeeMoreJobs);
        return false;
    }

    if (!(await this.chkCheckAll.isVisible())) {
        console.log('Không tìm thấy danh sách Bulk Apply, bỏ qua.');
        return false;
    }

    await this.capture('before_bulk_apply');
    await this.actions.check(this.chkCheckAll);
    await this.capture('after_bulk_apply');
    
    await this.actions.waitForVisible(this.btnBulkApplyReady, { timeout: 15000 });
    await this.clickElement(this.btnBulkApplyReady);
    
    // Check if missing info form appears for next job
    try {
      await this.txtProvince.waitFor({ state: 'visible', timeout: 8000 });
      // If it appears, fill it
      await this.capture('and_profile2_start');
      if (dataJob2) {
          await this.fillMiniProfile(dataJob2);
      }
      await this.capture('and_profile2_end');
      await this.clickElement(this.btnCommonNext);
    } catch (e) {
      console.log('No missing info for Bulk Apply, continuing...');
    }

    // Wait for loading icon to disappear if present
    await this.waitForGlobalLoadingHidden(15000);
    
    // Wait for the final popup and click 'Xem thêm việc gợi ý'
    await this.actions.waitForVisible(this.btnSeeMoreJobs, { timeout: 15000 });
    await this.capture('after_click_submit_all');
    await this.clickElement(this.btnSeeMoreJobs);
    return true;
  }

  async hasNoBulkApplyJobs() {
    try {
      await this.bulkJobCheckboxes.first().waitFor({ state: 'visible', timeout: 500 });
      return false;
    } catch {
      // Continue checking explicit empty-state signals.
    }

    try {
      await this.msgNoSimilarJobs.or(this.btnBulkApplyZero).first().waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      let bulkApplyText = '';
      try {
        bulkApplyText = await this.btnBulkApply.textContent();
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

module.exports = { JobApplyNoCVPage };
