const { expect } = require('@playwright/test');

class JobSearchRestoreHelper {
  /**
   * @param {import('../JobSearchPage').JobSearchPage} pageInstance
   */
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  /**
   * Mở một URL tùy biến (phục vụ test URL dài/restore)
   * @param {string} relativePath
   */
  async openCustomUrl(relativePath) {
    await this.owner.navigateToPath(relativePath);
  }

  /**
   * Click nút đăng nhập từ thanh điều hướng nếu có
   */
  async clickLoginNavButton() {
    if (await this.owner.loginNavButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.owner.actions.click(this.owner.loginNavButton);
    }
  }

  /**
   * Lấy giá trị từ window.localStorage hoặc window.sessionStorage
   * @param {'local' | 'session'} type
   * @param {string} key
   */
  async getStorageValue(type, key) {
    return this.owner.page.evaluate(({ t, k }) => {
      const storage = t === 'local' ? window.localStorage : window.sessionStorage;
      return storage.getItem(k);
    }, { t: type, k: key });
  }

  /**
   * Xác nhận toast cảnh báo chọn quá nhiều khu vực hiển thị
   */
  async expectWarningToastVisible() {
    await expect(this.owner.toastWarning).toBeVisible({ timeout: 10000 });
  }

  async expectWarningToastHidden() {
    await expect(this.owner.toastWarning).toBeHidden({ timeout: 5000 });
  }

  /**
   * Trang tìm kiếm sẵn sàng: dựa vào khung search vì trang không kết quả của
   * /tim-kiem-viec-lam-nhanh không render <h1>.
   */
  async expectSearchFormReady() {
    await expect(this.owner.timKiemBtn).toBeVisible({ timeout: 15000 });
    await expect(this.owner.locTheoTinhThanhTrigger).toBeVisible({ timeout: 15000 });
  }

  /**
   * Thêm cookie đệm để request (URL + header) vượt ngưỡng ~8 KB của Node server,
   * mô phỏng phiên thật có nhiều cookie (luồng F5 sau khi search nhiều quận/huyện).
   * @param {import('@playwright/test').BrowserContext} context
   * @param {string} baseURL Origin của Seeker (testInfo.project.use.baseURL)
   * @param {number} bytes
   */
  async padRequestHeaders(context, baseURL, bytes) {
    const { hostname } = new URL(baseURL);
    await context.addCookies([{ name: 'qa_header_pad', value: 'A'.repeat(bytes), domain: hostname, path: '/' }]);
  }

  /**
   * Ghi lại các request tới Search API (get-job-list) của trang tìm kiếm.
   * @returns {{ url: string, hasDistricts: boolean }[]}
   */
  startSearchApiRecorder() {
    const calls = [];
    this.owner.page.on('request', (req) => {
      if (/\/job\/get-job-list/.test(req.url())) {
        calls.push({ url: req.url(), hasDistricts: /[?&]districts(%5B%5D|\[\])?=/.test(req.url()) });
      }
    });
    return calls;
  }

  /**
   * Ghi lại status code các document request (để xác nhận chuỗi 431 → ?_restore=1).
   * @returns {{ status: number, url: string }[]}
   */
  startDocumentStatusRecorder() {
    const docs = [];
    this.owner.page.on('response', (res) => {
      if (res.request().resourceType() === 'document' && res.frame() === this.owner.page.mainFrame()) {
        docs.push({ status: res.status(), url: res.url() });
      }
    });
    return docs;
  }

  /**
   * Lấy directive content của thẻ meta robots
   */
  async getRobotsMetaDirective() {
    return this.owner.robotsMeta.getAttribute('content');
  }

  /**
   * Kiểm tra thông báo lỗi fallback khi cookie độc lập quá lớn
   */
  async expectFallbackErrorVisible() {
    await expect(this.owner.fallbackErrorMsg).toBeVisible({ timeout: 15000 });
    await expect(this.owner.retrySearchBtn.or(this.owner.homeRedirectBtn).first()).toBeVisible({ timeout: 5000 });
  }
}

module.exports = { JobSearchRestoreHelper };

