const { test, expect, request } = require('@playwright/test');
const { HomePage } = require('../../pages/HomePage');
const envConfig = require('../../core/config/env');

test.describe('Feature: Kiểm tra tính toàn vẹn của Elements và Links @healthcheck', () => {
  let homePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
  });

  test('Kiểm tra tất cả các link (loại trừ Job Detail) không trả về lỗi 404 hoặc 500', async ({ page }) => {
    test.setTimeout(180000);
    let allHrefs = [];

    await test.step('1. Truy cập vào trang chủ và kiểm tra hiển thị cơ bản', async () => {
      await homePage.navigate();
      // Đợi trang load xong bằng cách check 1 element cơ bản
      await expect(page).toHaveTitle(/./);
      await homePage.capture('homepage_loaded');
    });

    await test.step('2. Thu thập toàn bộ Links trên trang', async () => {
      allHrefs = await homePage.getAllLinksHrefs();
      expect(allHrefs.length, 'Phải có ít nhất 1 link trên trang').toBeGreaterThan(0);
    });

    await test.step('3. Lọc bỏ các link Job Detail và link rác', async () => {
      allHrefs = allHrefs.filter(href =>
        !href.includes('/viec-lam/') && // Loại trừ link job detail
        !href.includes('/job/') &&      // Loại trừ link job detail (nếu dùng tiếng Anh)
        !href.includes('javascript:') && // Bỏ link xử lý js
        !href.includes('mailto:') &&     // Bỏ link email
        !href.includes('tel:') &&        // Bỏ link số điện thoại
        href !== '#'                     // Bỏ link neo (anchor) rỗng
      );

      // Xoá các link trùng lặp (duplicate) để tối ưu thời gian chạy request
      allHrefs = [...new Set(allHrefs)];
    });

    await test.step('4. Bắn Request kiểm tra Status Code của từng link', async () => {
      // Khởi tạo API Context để bắn request ngầm
      const apiContext = await request.newContext({
        timeout: 15000,
        ignoreHTTPSErrors: true,
      });
      const brokenLinks = [];
      const baseURL = envConfig.baseURL;

      const urls = allHrefs.map((href) => href.startsWith('http') ? href : new URL(href, baseURL).href);
      const concurrency = 8;

      for (let index = 0; index < urls.length; index += concurrency) {
        const batch = urls.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async (fullUrl) => {
          try {
            const response = await apiContext.get(fullUrl);
            const status = response.status();
            return status >= 400 ? { url: fullUrl, status } : null;
          } catch (error) {
            return { url: fullUrl, error: error.message };
          }
        }));
        brokenLinks.push(...results.filter(Boolean));
      }

      await apiContext.dispose();

      // Chụp bằng chứng xử lý
      await homePage.capture('after_scan_completed');

      // In log chi tiết ra màn hình Terminal (stdout/stderr)
      if (brokenLinks.length > 0) {
        console.error('🚨 PHÁT HIỆN CÁC LINK LỖI (DEAD LINKS):', brokenLinks);
      }

      // Tổng hợp danh sách URL bị lỗi để in thẳng ra câu báo lỗi của Playwright
      const brokenUrlsMessage = brokenLinks.map(l => `- ${l.url} (Lỗi: ${l.status || l.error})`).join('\n');

      // Assert bước cuối: Kì vọng số lượng broken links phải bằng 0, nếu có lỗi thì in ngay danh sách link ra report
      expect(brokenLinks.length, `Test thất bại! Có ${brokenLinks.length} link chết:\n${brokenUrlsMessage}`).toBe(0);
    });
  });
});
