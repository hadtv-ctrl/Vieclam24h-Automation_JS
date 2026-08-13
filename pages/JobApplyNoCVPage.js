const { BasePage } = require('./BasePage');
const { ScreenshotHelper } = require('../core/utils/commonUtils');

class JobApplyNoCVPage extends BasePage {
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-nocv');

    // Locators
    this.btnApplyNoCV = this.page.getByRole('button', { name: /Ứng tuyển không cần CV/i }).first();
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
    this.btnBulkApply = this.page.getByRole('button', { name: /Ứng tuyển/i }).last();
    this.btnCommonNext = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').last();
    this.btnSeeMoreJobs = this.page.getByRole('button', { name: /Xem thêm việc gợi ý/i }).first();
  }

  async startApplyNoCV() {
    await this.clickElement(this.btnApplyNoCV);
  }

  async fillMiniProfile(data) {
    // Province
    await this.clickElement(this.txtProvince);
    await this.clickElement(this.page.getByRole('button', { name: data.province }));

    // District
    await this.clickElement(this.txtDistrict);
    for (const district of data.districts) {
      await this.clickElement(this.page.getByRole('button', { name: district }));
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

    // Gender
    await this.clickElement(this.page.locator('label').filter({ hasText: data.gender }).locator('i'));

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
    // Wait for either the bulk apply checkbox or the success page button
    const target = this.chkCheckAll.or(this.btnSeeMoreJobs);
    await target.first().waitFor({ state: 'visible', timeout: 15000 });

    if (await this.btnSeeMoreJobs.isVisible()) {
        console.log('Không có job nào gợi ý để Bulk Apply, kết thúc kịch bản.');
        await this.capture('after_click_submit_all');
        await this.clickElement(this.btnSeeMoreJobs);
        return;
    }

    if (!(await this.chkCheckAll.isVisible())) {
        console.log('Không tìm thấy danh sách Bulk Apply, bỏ qua.');
        return;
    }

    await this.capture('before_bulk_apply');
    await this.actions.check(this.chkCheckAll);
    await this.capture('after_bulk_apply');

    await this.clickElement(this.btnBulkApply);

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
  }
}

module.exports = { JobApplyNoCVPage };
