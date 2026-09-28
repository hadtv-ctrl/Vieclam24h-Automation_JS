/**
 * core/utils/basePageExtensions.js
 * Các phương thức mở rộng chuyên biệt cho BasePage:
 * - hasVisibleModal: Phát hiện modal/dialog/popup
 * - captureAdaptive: Screenshot tự động chọn fullPage hay viewport
 * - uploadFile: Upload file qua fileChooser
 * - importExcelData: Luồng Import Excel chuẩn
 *
 * Tách riêng để giữ BasePage dưới giới hạn 250 dòng module.
 */

/**
 * Phát hiện xem hiện tại có modal/dialog/popup/drawer nào đang hiển thị không
 */
async function hasVisibleModal() {
  try {
    return await this.page.evaluate(() => {
      const modalSelectors = [
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.MuiModal-root',
        '.MuiDialog-root',
        '.MuiDialog-container',
        '.MuiDialog-paper',
        '.MuiBackdrop-root',
        '.modal.show',
        '.modal-dialog',
        '.popup',
        '.dialog',
      ];
      return modalSelectors.some((selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
    });
  } catch {
    return false;
  }
}

/**
 * Chụp ảnh màn hình tương thích linh hoạt: toàn trang khi không có modal, viewport khi có modal
 */
async function captureAdaptive(stepName, options = {}) {
  const modal = await this.hasVisibleModal();
  return this._capture(stepName, '', !modal, options);
}

/**
 * Tải tệp lên thông qua fileChooser
 */
async function uploadFile(locator, filePath) {
  const fileChooserPromise = this.page.waitForEvent('filechooser');
  await this.clickElement(locator);
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

/**
 * Phương thức chung xử lý luồng Import Excel chuẩn của hệ thống:
 * Nhấn nút Import -> Mở popup -> Chọn file -> Xác nhận
 */
async function importExcelData(importButtonLocator, filePath, importName = 'excel') {
  const safeImportName = String(importName)
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'excel';

  // 1. Nhấn nút Nhập Excel ở ngoài màn hình
  await this.clickElement(importButtonLocator);
  await this.captureAdaptive(`${safeImportName}-after-click-import-excel`);

  // 2. Chờ popup tải file hiển thị và chọn file
  const uploadInput = this.page.locator('input[type="file"]');
  await uploadInput.setInputFiles(filePath);
  await this.captureAdaptive(`${safeImportName}-after-file-selected`);

  // 3. Nhấn nút Tải lên / Xác nhận trong popup
  const confirmBtn = this.page.getByRole('button', { name: /Tải lên|Xác nhận|Nhập dữ liệu|Lưu/i }).first();
  await this.clickElement(confirmBtn);
  await this.captureAdaptive(`${safeImportName}-after-submit`);
}

/**
 * Apply extension methods vào prototype của BasePage.
 * @param {Function} BasePageClass
 */
function applyBasePageExtensions(BasePageClass) {
  BasePageClass.prototype.hasVisibleModal = hasVisibleModal;
  BasePageClass.prototype.captureAdaptive = captureAdaptive;
  BasePageClass.prototype.uploadFile = uploadFile;
  BasePageClass.prototype.importExcelData = importExcelData;
}

module.exports = { applyBasePageExtensions };
