/**
 * dashboard/public/js/views/qa/batch/batchResultBar.js
 * Thanh kết quả sau khi áp dụng batch (PLAN-18 mục 6.5): hiện ngay khi server trả 200, cập nhật
 * thống kê khi quét lại xong. Không đếm ngược — đóng thanh không mất khả năng hoàn tác vì toolbar
 * vẫn còn "Hoàn tác batch gần nhất".
 */

export class BatchResultBar {
  constructor(root, callbacks) {
    this.bar = root.querySelector('#qa-batch-result-bar');
    this.callbacks = callbacks;
    this.disposers = [];
    if (!this.bar) return;
    const onClick = (event) => {
      const btn = event.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.id === 'qa-batch-result-undo') this.callbacks.onUndo();
      else if (btn.id === 'qa-batch-result-close') this.hide();
      else if (btn.id === 'qa-batch-result-new') this.callbacks.onShowNew();
    };
    this.bar.addEventListener('click', onClick);
    this.disposers.push(() => this.bar.removeEventListener('click', onClick));
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposers.forEach((dispose) => { try { dispose(); } catch (_) { /* đã gỡ */ } });
    this.disposers = [];
  }

  get visible() {
    return Boolean(this.bar && !this.bar.hidden);
  }

  _set(id, text, hidden = false) {
    const node = this.bar?.querySelector(`#${id}`);
    if (!node) return;
    node.textContent = text;
    node.hidden = hidden;
  }

  showApplied({ appliedCount, fileCount, notAppliedCount }) {
    if (!this.bar) return;
    const extra = notAppliedCount ? ` ${notAppliedCount} bản vá không áp dụng được (file đã thay đổi trong lúc ghi).` : '';
    this._set('qa-batch-result-main', `Đã áp dụng ${appliedCount} bản vá trên ${fileCount} file.${extra}`);
    this._set('qa-batch-result-rescan', 'Đang quét lại…');
    this._set('qa-batch-result-new', '', true);
    this.bar.classList.remove('is-rolled-back');
    this.setUndoState({ visible: true, busy: false });
    this.bar.hidden = false;
  }

  showRescan({ processed, remaining, created }) {
    if (!this.bar) return;
    this._set('qa-batch-result-rescan', `Quét lại: đã xử lý ${processed} · còn ${remaining} · phát sinh mới ${created}`);
    this._set('qa-batch-result-new', `Xem ${created} lỗi mới`, created === 0);
  }

  showRolledBack() {
    if (!this.bar) return;
    this._set('qa-batch-result-main', 'Đã hoàn tác batch, các file đã về nguyên trạng.');
    this._set('qa-batch-result-rescan', '');
    this._set('qa-batch-result-new', '', true);
    this.bar.classList.add('is-rolled-back');
    this.setUndoState({ visible: false });
    this.bar.hidden = false;
  }

  setUndoState({ visible, busy = false }) {
    const btn = this.bar?.querySelector('#qa-batch-result-undo');
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = busy;
    const label = btn.querySelector('span');
    if (label) label.textContent = busy ? 'Đang hoàn tác…' : 'Hoàn tác';
  }

  hide() {
    if (this.bar) this.bar.hidden = true;
    this.callbacks.onHidden?.();
  }
}
