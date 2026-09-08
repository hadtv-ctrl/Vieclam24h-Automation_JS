const { JobApplyPage } = require('../desktop/JobApplyPage');

class MobileJobApplyPage extends JobApplyPage {
  constructor(page, featureName) {
    super(page, featureName);

    // Mobile responsive locators:
    // Nút "Ứng tuyển ngay" trên mobile thường là sticky button dưới đáy màn hình
    this.btnApplyNow = this.page
      .getByRole('button', { name: /Ứng tuyển ngay|Nộp lại hồ sơ/i })
      .or(this.page.locator('.fixed.bottom-0 button:has-text("Ứng tuyển")'))
      .or(this.page.locator('[data-test-id*="apply-button"]'))
      .first();

    // Phương thức ứng tuyển trên Mobile dialog / bottom-sheet
    this.optProfileMethod = this.page
      .locator('[data-test-id="apply-method-selector__option-profile"]')
      .or(this.page.getByText(/Hồ sơ trực tuyến|Sử dụng hồ sơ/i))
      .first();

    this.optCVMethod = this.page
      .locator('[data-test-id="apply-method-selector__option-cv"]')
      .or(this.page.getByText(/Tải lên CV|Đính kèm CV/i))
      .first();

    this.btnContinueProfile = this.page
      .locator('[data-test-id="apply-method-selector__expanded-profile"] [data-test-id="apply-profile-completion-content__action"]')
      .or(this.page.getByRole('button', { name: /Tiếp tục/i }))
      .first();

    // Input file upload CV
    this.inpCV = this.page.locator('input[type="file"]').first();

    // Bulk apply modal on mobile
    this.btnBulkApply = this.page
      .getByRole('button', { name: /Ứng tuyển nhanh|Nộp hồ sơ ngay|Ứng tuyển tất cả/i })
      .or(this.page.locator('[data-test-id*="bulk-apply"] button'))
      .first();
  }

  /**
   * Đóng bottom sheet chọn nguồn tải CV nếu còn hiển thị trên Mobile Web
   */
  async closeUploadMethodSheetIfVisible() {
    const sheet = this.page.locator('[data-test-id="common__dialog"]').filter({ hasText: /Tải lên CV|Google Drive/i });
    if (await sheet.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeBtn = sheet.locator('button:has(.svicon-close), button:has(.svicon-x), i.svicon-close').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await this.clickElement(closeBtn);
      } else {
        await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
      }
      await sheet.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }

  /**
   * Upload CV trên Mobile: đóng sheet nguồn upload nếu mở
   */
  async uploadCV(filePath) {
    const fileInput = this.page.locator('input[type="file"]').first();
    if ((await fileInput.count().catch(() => 0)) > 0) {
      await fileInput.setInputFiles(filePath);
    } else {
      await super.uploadCV(filePath);
    }
    await this.waitForGlobalLoadingHidden(15000);
    await this.page.waitForTimeout(1000);
    await this.closeUploadMethodSheetIfVisible();
  }

  /**
   * Tiếp tục ứng tuyển bằng CV trên Mobile
   */
  async continueApplyCV() {
    await this.closeUploadMethodSheetIfVisible();
    await super.continueApplyCV();
  }

  /**
   * Override mở danh sách việc đã ứng tuyển trên Mobile:
   * Nếu menu header bị ẩn vào drawer/hamburger, điều hướng URL tương đối hoặc mở drawer
   */
  async openAppliedJobs() {
    try {
      await super.openAppliedJobs();
      return;
    } catch (e) {
      // Fallback: Điều hướng trực tiếp URL tương đối chuẩn trên Mobile
      await this.navigate('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html');
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Đảm bảo danh sách việc đã ứng tuyển hiển thị trên mobile
   */
  async expectAppliedJobsVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const appliedList = this.page.locator(
      'h1:has-text("Việc làm đã ứng tuyển"):visible, ' +
      'h2:has-text("Việc làm đã ứng tuyển"):visible, ' +
      '[data-test-id="applied-job__list-jobs"]:visible, ' +
      'div:has-text("Hồ sơ đã đến nhà tuyển dụng"):visible, ' +
      'span:has-text("CV ứng tuyển"):visible'
    ).first();
    await this.waitForElement(appliedList, 20000);
  }
}

module.exports = { MobileJobApplyPage };
