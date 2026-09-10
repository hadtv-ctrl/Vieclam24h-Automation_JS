const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');
const { expect } = require('@playwright/test');

class JobApplyNoCVPage extends BasePage {
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-nocv');
    
    // Locators
    this.btnApplyNoCV = this.page.getByRole('button', { name: /Ứng tuyển không cần CV/i }).first();
    this.txtFullName = this.page.getByRole('textbox', { name: /Nhập họ và tên/i });
    this.txtPhone = this.page.getByRole('textbox', { name: /Nhập số điện thoại/i });
    this.txtProvince = this.page.getByText('Chọn tỉnh', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn tỉnh/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn tỉnh/i }))
      .first();
    this.txtDistrict = this.page.getByText('Chọn quận', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn quận/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn quận/i }))
      .first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Chia sẻ về bản thân|Giới thiệu bản thân/i })
      .or(this.page.getByPlaceholder(/Giới thiệu bản thân/i))
      .first();
    this.txtBirthYear = this.page.getByText('Chọn năm sinh', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn năm sinh/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn năm sinh/i }))
      .first();
    this.txtEducation = this.page.getByText('Chọn học vấn', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn học vấn/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn học vấn/i }))
      .first();
    this.fileInput = this.page.locator('input[type="file"]').first();
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

  /**
   * Đóng dropdown / select menu đang mở bằng Escape và click outside an toàn
   */
  async closeActiveDropdownIfAny() {
    await this.page.keyboard.press('Escape').catch((_err) => null);

    const outsideTarget = this.page.getByText('Địa điểm làm việc')
      .or(this.page.getByText('Thông tin ứng tuyển'))
      .or(this.page.getByText('Hồ sơ ứng tuyển'))
      .first();

    if (await outsideTarget.isVisible({ timeout: 500 }).catch(() => false)) {
      await outsideTarget.click({ force: true }).catch((_err) => null);
    }

    const districtMenuOption = this.page.locator('button:has-text("Quận 1"):visible').first();
    if (await districtMenuOption.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true }).catch((_err) => null);
    }
  }

  async fillMiniProfile(data) {
    // Province
    if (data.province && await this.txtProvince.isVisible({ timeout: 2000 }).catch(() => false)) {
      try {
        await this.clickElement(this.txtProvince);
        const provinceOption = this.page
          .getByRole('button', { name: data.province })
          .or(this.page.locator('[data-test-id="common__select-menu"]').getByText(data.province, { exact: true }))
          .or(this.page.getByText(data.province, { exact: true }))
          .first();
        await this.actions.click(provinceOption, { timeout: 3000 });
      } catch (err) {
        console.log('Province option click notice:', err.message);
        await this.closeActiveDropdownIfAny();
      }
    }

    // District: match relatively because option labels may differ slightly from source data.
    if (data.districts && await this.txtDistrict.isVisible({ timeout: 2000 }).catch(() => false)) {
      try {
        await this.clickElement(this.txtDistrict);
        for (const district of data.districts) {
          const districtName = String(district || '').trim();
          if (!districtName) continue;

          const districtOption = this.page
            .getByRole('button')
            .filter({
              hasText: new RegExp(districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            })
            .or(this.page.getByRole('option', { name: new RegExp(districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }))
            .or(this.page.locator('li, div, span, label').filter({ hasText: new RegExp(`^\\s*${districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }))
            .or(this.page.getByText(new RegExp(`^\\s*${districtName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')))
            .first();

          await this.actions.click(districtOption, { timeout: 3000 });
        }
        // Close dropdown: try scoped confirm button first, then closeActiveDropdownIfAny
        const confirmDistrictBtn = this.page.locator(
          '[data-test-id="common__select-menu"] button:has-text("Xong"), ' +
          '[data-test-id="select__modal-menu__container"] button:has-text("Xong"), ' +
          'button:text-is("Xong"), button:text-is("Xác nhận")'
        ).first();
        if (await confirmDistrictBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmDistrictBtn.click().catch(() => null);
        } else {
          await this.closeActiveDropdownIfAny();
        }
      } catch (err) {
        console.log('District option click notice:', err.message);
        await this.closeActiveDropdownIfAny();
      }
    }

    // Ensure any dropdown is closed before next field
    await this.closeActiveDropdownIfAny();

    // Intro (Optional based on job)
    if (data.intro) {
      try {
        const introElement = this.txtIntro;
        if (await introElement.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.clickElement(introElement);
          await this.fillInput(introElement, data.intro);
        }
      } catch (e) {
        console.log('Intro field notice:', e.message);
      }
    }

    // Birth Year (Optional based on job)
    if (data.birthYear && await this.txtBirthYear.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickElement(this.txtBirthYear);
      const yearOption = this.page.getByRole('button', { name: data.birthYear })
        .or(this.page.locator('[data-test-id="common__select-menu"]').getByText(data.birthYear, { exact: true }))
        .or(this.page.getByText(data.birthYear, { exact: true }))
        .first();
      await this.clickElement(yearOption);
    }

    // Ensure any dropdown is closed
    await this.closeActiveDropdownIfAny();

    if (data.education && await this.txtEducation.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickElement(this.txtEducation);
      const eduOption = this.page.getByRole('button', { name: data.education })
        .or(this.page.locator('[data-test-id="common__select-menu"]').getByText(data.education, { exact: true }))
        .or(this.page.getByText(data.education, { exact: true }))
        .last();
      await this.clickElement(eduOption);
      await this.closeActiveDropdownIfAny();
    }

    // Gender can be absent in some no-CV mini profile forms.
    if (data.gender) {
      const genderOption = this.page.locator('label').filter({ hasText: data.gender }).locator('i').first();
      try {
        await genderOption.waitFor({ state: 'visible', timeout: 2000 });
        await this.clickElement(genderOption);
      } catch (e) {
        console.log('Job hiện tại không yêu cầu chọn giới tính, bỏ qua trường optional.');
      }
    }

    // File Upload
    if (data.uploadFile) {
      let uploadSuccess = false;
      const fileInput = this.fileInput || this.page.locator('input[type="file"]').first();
      const hasFileInput = (await fileInput.count().catch(() => 0)) > 0;

      if (hasFileInput) {
        try {
          await fileInput.setInputFiles(data.uploadFile);
          uploadSuccess = true;
          if (await this.btnDone.isVisible({ timeout: 2000 }).catch(() => false)) {
            await this.clickElement(this.btnDone);
          }
        } catch (fileErr) {
          console.log('FileInput setInputFiles fallback notice:', fileErr.message);
        }
      }

      if (!uploadSuccess && await this.btnUploadFile.isVisible({ timeout: 2000 }).catch(() => false)) {
        try {
          const [fileChooser] = await Promise.all([
            this.page.waitForEvent('filechooser', { timeout: 5000 }),
            this.clickElement(this.btnUploadFile),
          ]);
          await fileChooser.setFiles(data.uploadFile);
          uploadSuccess = true;
          if (await this.btnDone.isVisible({ timeout: 2000 }).catch(() => false)) {
            await this.clickElement(this.btnDone);
          }
        } catch (chooserErr) {
          console.log('File chooser notice:', chooserErr.message);
        }
      }

      if (!uploadSuccess && !hasFileInput) {
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
    
    // Check if missing info form or confirm modal appears for next job
    try {
      const modalAppeared = await this.btnCommonSave.or(this.txtProvince).first().isVisible({ timeout: 8000 }).catch(() => false);
      if (modalAppeared) {
        await this.capture('and_profile2_start');
        
        const submitBtn = this.btnCommonSave.or(this.btnCommonNext).first();
        const isReadyToSubmit = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
        if (!isReadyToSubmit && dataJob2) {
          await this.fillMiniProfile(dataJob2);
        }
        await this.capture('and_profile2_end');

        if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          const box = await submitBtn.boundingBox();
          if (box) {
            await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          } else {
            await submitBtn.click({ force: true });
          }
        }
      }
    } catch (e) {
      console.log('Error filling missing info for Bulk Apply:', e.message);
    }

    // Wait for loading icon to disappear if present
    await this.waitForGlobalLoadingHidden(15000);
    
    // Wait for the final popup and click 'Xem thêm việc gợi ý' if present
    try {
      await this.btnSeeMoreJobs.waitFor({ state: 'visible', timeout: 8000 });
      await this.capture('after_click_submit_all');
      await this.clickElement(this.btnSeeMoreJobs);
    } catch {
      console.log('Không thấy nút Xem thêm việc gợi ý sau khi Bulk Apply thành công.');
    }

    // Ensure any remaining apply modal or backdrop is closed before navigating away
    try {
      const modal = this.page.locator('#apply-job-modal');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeBtn = modal.locator('button').filter({ has: this.page.locator('svg, i, [class*="close"]') }).first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        } else {
          await this.page.keyboard.press('Escape');
        }
        await modal.waitFor({ state: 'hidden', timeout: 5000 });
      }
    } catch (dismissErr) {
      console.log('Modal dismiss notice:', dismissErr.message);
    }

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
