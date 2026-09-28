/**
 * core/utils/visualRegression.js
 * Visual Regression mixin cho BasePage.
 * Tách riêng để giữ BasePage dưới giới hạn 250 dòng module.
 */
const { expect } = require('@playwright/test');

/**
 * Chụp screenshot và so sánh với baseline sử dụng Playwright built-in toHaveScreenshot().
 * Tự động chờ UI ổn định trước khi chụp (tái sử dụng logic ổn định của BasePage).
 *
 * @param {string} snapshotName - Tên snapshot (vd: 'login-form', 'dashboard-loaded')
 * @param {object} [options]
 * @param {number} [options.maxDiffPixelRatio] - Tỉ lệ pixel khác biệt cho phép (default: 0.01 = 1%)
 * @param {number} [options.threshold] - Ngưỡng khác biệt per-pixel (0-1, default: 0.2)
 * @param {boolean} [options.fullPage] - null = auto-detect (full nếu không có modal)
 */
async function captureAndCompare(snapshotName, options = {}) {
  // Chờ UI ổn định (reuse logic từ BasePage.capture)
  await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
  await this.page.waitForFunction(
    () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"]'),
    null,
    { timeout: 15000 }
  ).catch(() => null);
  await this.waitForElementStable(this.page.locator('body'), { timeout: 5000 }).catch(() => null);

  const hasModal = await this.hasVisibleModal();
  const fullPage = options.fullPage ?? !hasModal;

  const safeName = String(snapshotName).replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();

  await expect(this.page).toHaveScreenshot(`${safeName}.png`, {
    fullPage,
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.01,
    threshold: options.threshold ?? 0.2,
    animations: 'disabled',
  });
}

/**
 * Apply visual regression method vào prototype của BasePage (hoặc bất kỳ class kế thừa).
 * @param {Function} BasePageClass
 */
function applyVisualRegressionMixin(BasePageClass) {
  BasePageClass.prototype.captureAndCompare = captureAndCompare;
}

module.exports = { applyVisualRegressionMixin, captureAndCompare };
