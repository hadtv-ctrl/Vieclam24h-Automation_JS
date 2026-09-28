/**
 * dashboard/public/js/views/qa/batch/batchToolbar.js
 * Đồng bộ toolbar sửa hàng loạt với trạng thái (PLAN-18 mục 6.1): checkbox tổng tri-state theo
 * các dòng đang hiển thị, số mục đã chọn / đang ẩn, chip lọc có bộ đếm, nút chính và lý do
 * nút bị khoá. Chỉ ghi DOM, không giữ state.
 */

function setText(root, selector, text, hidden) {
  const node = root.querySelector(selector);
  if (!node) return null;
  node.textContent = text;
  if (hidden !== undefined) node.hidden = hidden;
  return node;
}

/**
 * m = { counts, filter, newCount, visibleKeys, selection, locked, statusText,
 *       canUndoLast, notice, hasSelectable }
 */
export function updateToolbar(root, m) {
  const bar = root.querySelector('#qa-batch-toolbar');
  if (!bar) return;
  const state = m.selection.visibleState(m.visibleKeys);

  const master = bar.querySelector('#qa-batch-master');
  if (master) {
    master.checked = state === 'all';
    master.indeterminate = state === 'some';
    master.disabled = m.locked || m.visibleKeys.length === 0;
    master.setAttribute('aria-checked', state === 'some' ? 'mixed' : String(state === 'all'));
  }
  setText(bar, '#qa-batch-count', `${m.selection.size} đã chọn`);
  const hidden = m.selection.hiddenCount(m.visibleKeys);
  setText(bar, '#qa-batch-hidden', `${hidden} đang ẩn`, hidden === 0);
  const clear = bar.querySelector('#qa-batch-clear');
  if (clear) clear.hidden = m.selection.size === 0;

  bar.querySelectorAll('[data-batch-filter]').forEach((chip) => {
    const key = chip.dataset.batchFilter;
    const count = key === 'new' ? m.newCount : (m.counts[key] || 0);
    chip.setAttribute('aria-pressed', String(m.filter === key));
    const badge = chip.querySelector('[data-count]');
    if (badge) badge.textContent = String(count);
    if (key === 'guided' || key === 'new') chip.hidden = count === 0 && m.filter !== key;
  });

  const preview = bar.querySelector('#qa-batch-preview');
  if (preview) {
    preview.hidden = !m.hasSelectable;
    preview.disabled = m.locked || m.selection.size === 0;
    preview.title = m.locked ? 'Đang quét lại hoặc đang có thao tác sửa, chờ một chút.'
      : m.selection.size === 0 ? 'Chọn ít nhất một lỗi sửa được.' : 'Xem trước các bản vá trước khi ghi file.';
    setText(preview, 'span', `Xem trước & sửa (${m.selection.size})`);
  }
  const status = m.statusText || (m.hasSelectable ? '' : 'Không có mục sửa tự động được.');
  setText(bar, '#qa-batch-status', status, !status);
  bar.classList.toggle('is-locked', m.locked);

  const undo = bar.querySelector('#qa-batch-undo-last');
  if (undo) {
    undo.hidden = !m.canUndoLast;
    undo.disabled = m.locked;
  }
  setText(root, '#qa-batch-notice', m.notice || '', !m.notice);
}
