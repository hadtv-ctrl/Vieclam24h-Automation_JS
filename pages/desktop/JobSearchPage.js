const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

class JobSearchPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} specName
   */
  constructor(page, specName) {
    super(page, specName);

    this.firstJobLink = page
      .locator('a[href*=".html?open_from="], a[href*="id200"], a:has(h3), [data-job-id]')
      .first();
    this.firstUnappliedJobLink = page
      .locator('a[href*=".html?open_from="], a[href*="id200"], a:has(h3), [data-job-id]')
      .filter({ hasNotText: /\u0110\u00e3 \u1ee9ng tuy\u1ec3n|B\u1ea1n v\u1eeba \u1ee9ng tuy\u1ec3n/i })
      .first();
    this.jobSearchResultTitle = page.getByRole('heading', { level: 1, name: /việc làm/i });
    this.jobCheckboxes = page.locator('.job-item-checkbox'); // Giả định selector cho checkbox
    this.bulkApplyBtn = page.getByRole('button', { name: 'Ứng tuyển hàng loạt' });
    this.confirmBulkApplyBtn = page.locator('.bulk-apply-modal').getByRole('button', { name: 'Xác nhận' }); // Giả định selector
    this.bulkApplySuccessMsg = page.getByText('Bạn đã ứng tuyển hàng loạt thành công'); // Giả định selector

    // Chop AI chatbot entry point
    this.chopIntroBtn = page.getByRole('img', { name: 'Chop Introduction' });

    // Bộ lọc việc làm & tìm kiếm
    this.locTheoTinhThanhInput = page
      .getByRole('textbox', { name: 'Lọc theo tỉnh thành' })
      .or(page.locator('input[placeholder*="tỉnh thành"]'))
      .first();
    this.cityDropdownContainer = page.locator('.fixed.z-\\[50\\], [class*="fixed"][class*="z-50"], .w-\\[200\\%\\]').first();
    this.timKiemBtn = page.getByRole('button', { name: 'Tìm kiếm' }).first();
    this.xoaLocBtn = page.getByText('Xoá lọc');

    // Bộ lọc thanh công cụ ngang (Horizontal Filter Bar)
    this.tuyenNhanhFilterBtn = page.getByRole('button', { name: 'Tuyển nhanh' });
    this.viecKhongCanCvFilterBtn = page.getByRole('button', { name: 'Việc không cần CV' });
    this.kinhNghiemFilterInput = page.locator('input[value*="kinh nghiệm"]').first();
    this.mucLuongFilterInput = page.locator('input[value*="mức lương"]').first();
    this.capBacFilterInput = page.locator('input[value*="cấp bậc"]').first();
    this.trinhDoFilterInput = page.locator('input[value*="trình độ"]').first();
    this.loaiCongViecFilterInput = page.locator('input[value*="Loại công việc"]').first();
    this.gioiTinhFilterInput = page.locator('input[value*="giới tính"]').first();
    this.filterDropdownTrigger = page.locator('.select-search-custom__input, [data-test-id*="filter"]').first();
    this.activeExperienceBtn = page.getByRole('button', { name: '1 năm', exact: true }).first();
    this.defaultExperienceBtn = page.getByRole('button', { name: /Tất cả kinh nghiệm/i }).first();
  }

  async navigate() {
    await super.navigate('/tim-kiem-viec-lam-nhanh');
  }

  async open() {
    await this.navigate();
  }

  async clickFirstJob() {
    const pagePromise = this.page.waitForEvent('popup');
    const targetJob = await this.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.firstUnappliedJobLink
      : this.firstJobLink;
    await this.clickElement(targetJob);
    const jobPage = await pagePromise;
    await jobPage.waitForLoadState('domcontentloaded');
    return jobPage;
  }

  async closeGuestPromptModalIfVisible() {
    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2500 }).catch(() => false)) {
      const closeBtn = dialog.locator('button, [class*="close" i], i, svg, [cursor="pointer"]').last();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => null);
      } else {
        await this.page.keyboard.press('Escape').catch(() => null);
      }
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {
        return this.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => el.remove());
        }).catch(() => null);
      });
    }
  }

  /**
   * Click vào nút Chop Introduction và trả về popup page của chatbot.
   * Nếu popup đầu tiên là trang intro trung gian, phương thức này vẫn trả về
   * popup page đó và để ChopChatbotPage.dismissIntroIfVisible() xử lý tiếp.
   * @returns {Promise<import('@playwright/test').Page>} popup page của Chop chatbot
   */
  async openChopChatbot() {
    await this.closeGuestPromptModalIfVisible();
    const popupPromise = this.page.waitForEvent('popup');
    try {
      await this.clickElement(this.chopIntroBtn, { timeout: 5000 });
    } catch (err) {
      // Nếu bị dialog chặn click, đóng dialog rồi click lại
      await this.closeGuestPromptModalIfVisible();
      await this.clickElement(this.chopIntroBtn);
    }
    const chatbotPopup = await popupPromise;
    await chatbotPopup.waitForLoadState('domcontentloaded');
    return chatbotPopup;
  }

  async expectJobSearchPageVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const heading = this.jobSearchResultTitle.or(this.page.getByRole('heading', { level: 1 })).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  }

  /**
   * Xác nhận bộ lọc tỉnh thành đã được áp dụng
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM')
   */
  async expectCityFilterApplied(cityName = 'TP.HCM') {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.locTheoTinhThanhInput).toHaveValue(cityName, { timeout: 15000 });
    await expect(this.jobSearchResultTitle).toContainText(cityName, { timeout: 15000 });
  }

  /**
   * Xác nhận bộ lọc kinh nghiệm đã được áp dụng
   * @param {string} expLabel Nhãn kinh nghiệm (ví dụ: '1 năm')
   */
  async expectExperienceFilterApplied(expLabel = '1 năm') {
    await this.page.waitForLoadState('domcontentloaded');
    const expIndicator = this.page.getByText(expLabel).or(this.page.locator(`input[value*="${expLabel}"]`)).first();
    await expect(expIndicator).toBeVisible({ timeout: 15000 });
  }

  /**
   * Xác nhận các bộ lọc đã được đặt lại về mặc định
   */
  async expectFiltersReset() {
    await this.page.waitForLoadState('domcontentloaded');
    const defaultExpIndicator = this.page.getByText(/Tất cả kinh nghiệm/i).or(this.page.locator('input[value*="Tất cả kinh nghiệm"]')).first();
    await expect(defaultExpIndicator).toBeVisible({ timeout: 15000 });
  }

  /**
   * Chọn một số lượng job để ứng tuyển hàng loạt
   * @param {number} numberOfJobs - Số lượng job cần chọn từ trên xuống
   */
  async selectJobsForBulkApply(numberOfJobs) {
    const allCheckboxes = await this.jobCheckboxes.all();
    for (let i = 0; i < Math.min(numberOfJobs, allCheckboxes.length); i++) {
      await allCheckboxes[i].check();
    }
  }

  async clickBulkApplyButton() {
    await this.clickElement(this.bulkApplyBtn);
  }

  async confirmBulkApply() {
    await this.clickElement(this.confirmBulkApplyBtn);
  }

  async expectBulkApplySuccessMessageVisible() {
    await expect(this.bulkApplySuccessMsg).toBeVisible({ timeout: 15000 });
  }

  /**
   * Mở dropdown chọn tỉnh thành từ thanh tìm kiếm
   */
  async openCityDropdown() {
    await this.closeAllPopupsIfVisible();
    await this.locTheoTinhThanhInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.actions.click(this.locTheoTinhThanhInput);
    await this.cityDropdownContainer.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Chọn tỉnh thành (và tùy chọn quận/huyện) trong danh sách dropdown
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM', 'Hà Nội', 'Bình Dương', 'Toàn quốc')
   * @param {string} [districtName] Tên quận/huyện nếu muốn lọc chi tiết (ví dụ: 'Quận 1', 'Quận 3')
   */
  async selectCityOption(cityName = 'TP.HCM', districtName = null) {
    if (districtName) {
      const row = this.cityDropdownContainer
        .locator('div.h-10.relative')
        .filter({ hasText: new RegExp(`^${cityName}`, 'i') })
        .first();
      await row.scrollIntoViewIfNeeded({ timeout: 5000 });
      const arrowBtn = row.locator('button.absolute, button').last();
      await this.actions.click(arrowBtn);
      const districtBtn = this.cityDropdownContainer
        .locator('button')
        .filter({ hasText: new RegExp(`^${districtName}`, 'i') })
        .first();
      await districtBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.actions.click(districtBtn);
    } else {
      const cityBtn = this.cityDropdownContainer
        .locator('button')
        .filter({ hasText: new RegExp(`^${cityName}$`, 'i') })
        .or(this.page.getByRole('button', { name: cityName, exact: true }))
        .first();
      await cityBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.actions.click(cityBtn);
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Bấm nút "Tìm kiếm" để thực thi truy vấn và làm mới danh sách việc làm
   */
  async clickSearch() {
    await this.timKiemBtn.waitFor({ state: 'visible', timeout: 10000 });
    await this.actions.click(this.timKiemBtn);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Quy trình đầy đủ để lọc việc làm theo tỉnh thành:
   * 1. Mở dropdown tỉnh thành
   * 2. Chọn tỉnh thành (hoặc quận/huyện)
   * 3. Bấm "Tìm kiếm" để cập nhật lại danh sách việc làm
   * @param {string} [cityName='TP.HCM'] Tên tỉnh thành (ví dụ: 'TP.HCM', 'Hà Nội', 'Bình Dương')
   * @param {string} [districtName] Tên quận/huyện nếu muốn lọc sâu hơn
   */
  async filterByCity(cityName = 'TP.HCM', districtName = null) {
    await this.openCityDropdown();
    await this.selectCityOption(cityName, districtName);
    await this.clickSearch();
  }

  /**
   * Lọc theo nút "Tuyển nhanh"
   */
  async filterByTuyenNhanh() {
    await this.closeAllPopupsIfVisible();
    await this.actions.click(this.tuyenNhanhFilterBtn);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Lọc theo nút "Việc không cần CV"
   */
  async filterByViecKhongCanCv() {
    await this.closeAllPopupsIfVisible();
    await this.actions.click(this.viecKhongCanCvFilterBtn);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Lọc việc làm theo kinh nghiệm
   * @param {string} [expLabel='1 năm'] Nhãn kinh nghiệm (ví dụ: '1 năm', 'Dưới 1 năm')
   */
  async filterByExperience(expLabel = '1 năm') {
    await this.closeAllPopupsIfVisible();
    const trigger = this.kinhNghiemFilterInput.or(this.filterDropdownTrigger);
    if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(trigger);
      const expBtn = this.page.getByRole('button', { name: expLabel, exact: true }).first();
      if (await expBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(expBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Lọc việc làm theo mức lương
   * @param {string} [salaryLabel='10 - 15 triệu'] Nhãn mức lương (ví dụ: '10 - 15 triệu', '5 - 7 triệu')
   */
  async filterBySalary(salaryLabel = '10 - 15 triệu') {
    await this.closeAllPopupsIfVisible();
    if (await this.mucLuongFilterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(this.mucLuongFilterInput);
      const salBtn = this.page.getByRole('button', { name: salaryLabel, exact: true }).first();
      if (await salBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(salBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Lọc việc làm theo cấp bậc
   * @param {string} [levelLabel='Nhân viên'] Nhãn cấp bậc (ví dụ: 'Nhân viên', 'Trưởng phòng')
   */
  async filterByJobLevel(levelLabel = 'Nhân viên') {
    await this.closeAllPopupsIfVisible();
    if (await this.capBacFilterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(this.capBacFilterInput);
      const levelBtn = this.page.getByRole('button', { name: levelLabel, exact: true }).first();
      if (await levelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(levelBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Lọc việc làm theo trình độ
   * @param {string} [eduLabel='Đại học'] Nhãn trình độ (ví dụ: 'Đại học', 'Cao đẳng')
   */
  async filterByEducation(eduLabel = 'Đại học') {
    await this.closeAllPopupsIfVisible();
    if (await this.trinhDoFilterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(this.trinhDoFilterInput);
      const eduBtn = this.page.getByRole('button', { name: eduLabel, exact: true }).first();
      if (await eduBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(eduBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Lọc việc làm theo loại công việc
   * @param {string} [jobTypeLabel='Toàn thời gian cố định'] Nhãn loại công việc
   */
  async filterByJobType(jobTypeLabel = 'Toàn thời gian cố định') {
    await this.closeAllPopupsIfVisible();
    if (await this.loaiCongViecFilterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(this.loaiCongViecFilterInput);
      const typeBtn = this.page.getByRole('button', { name: jobTypeLabel, exact: true }).first();
      if (await typeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(typeBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Lọc việc làm theo giới tính
   * @param {string} [genderLabel='Nam'] Nhãn giới tính (ví dụ: 'Nam', 'Nữ')
   */
  async filterByGender(genderLabel = 'Nam') {
    await this.closeAllPopupsIfVisible();
    if (await this.gioiTinhFilterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.actions.click(this.gioiTinhFilterInput);
      const genderBtn = this.page.getByRole('button', { name: genderLabel, exact: true }).first();
      if (await genderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.actions.click(genderBtn);
      }
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Xóa tất cả bộ lọc đã chọn bằng nút "Xoá lọc"
   */
  async clearFilters() {
    await this.closeAllPopupsIfVisible();
    if (await this.xoaLocBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.actions.click(this.xoaLocBtn);
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Click vào một tin tuyển dụng theo tiêu đề hoặc tin đầu tiên
   * Hỗ trợ tự động bắt popup tab mới nếu link có target="_blank"
   * @param {string} [title] Tiêu đề công việc
   * @returns {Promise<import('@playwright/test').Page>} Page đối tượng (tab hiện tại hoặc tab mới)
   */
  async clickJobByTitle(title) {
    await this.closeAllPopupsIfVisible();
    await this.page.waitForLoadState('domcontentloaded');

    const jobLink = title
      ? this.page.getByRole('link', { name: new RegExp(title, 'i') }).first()
      : this.page.locator('a[href*="-c"][href*="id"], a[href*="id200"], a[href*=".html?open_from="], a:has(h3)').first();

    await jobLink.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => null);
    await jobLink.waitFor({ state: 'visible', timeout: 15000 });

    const popupPromise = this.page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
    await jobLink.click({ force: true });
    const newTab = await popupPromise;
    if (newTab) {
      await newTab.waitForLoadState('domcontentloaded');
      return newTab;
    }
    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }
}

module.exports = { JobSearchPage };
