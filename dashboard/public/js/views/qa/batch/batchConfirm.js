/**
 * dashboard/public/js/views/qa/batch/batchConfirm.js
 * Hộp xác nhận dùng chung của batch fixer (đóng modal còn lựa chọn chưa áp dụng, hoàn tác đè
 * file đã sửa). Dùng <dialog> của view thay cho window.confirm để giữ đúng giao diện và focus.
 */

export function confirmDialog(dialog, { title, message, items = [], confirmText = 'Đồng ý', cancelText = 'Huỷ' }) {
  if (!dialog) return Promise.resolve(false);
  const titleEl = dialog.querySelector('[data-confirm-title]');
  const messageEl = dialog.querySelector('[data-confirm-message]');
  const listEl = dialog.querySelector('[data-confirm-list]');
  const okBtn = dialog.querySelector('[data-confirm-ok]');
  const cancelBtn = dialog.querySelector('[data-confirm-cancel]');
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (listEl) {
    listEl.textContent = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      listEl.append(li);
    });
    listEl.hidden = items.length === 0;
  }
  if (okBtn) okBtn.textContent = confirmText;
  if (cancelBtn) cancelBtn.textContent = cancelText;

  return new Promise((resolve) => {
    const finish = (value) => {
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = (event) => {
      if (event && event.type === 'cancel') event.preventDefault();
      finish(false);
    };
    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);
    dialog.showModal();
    cancelBtn?.focus();
  });
}
