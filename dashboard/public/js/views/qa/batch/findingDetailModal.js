/**
 * dashboard/public/js/views/qa/batch/findingDetailModal.js
 * Modal "Chi tiết & hướng dẫn" (PLAN-18 mục 6.4) thay modal "AI Sửa Lỗi": thông tin finding,
 * hướng dẫn của scanner, đoạn mã quanh vị trí lỗi (chỉ đọc). Không có nút áp dụng; mục sửa
 * được thì chuyển sang luồng "Sửa lỗi" dùng chung engine batch.
 */

import { apiClient } from '../../../core/apiClient.js';
import { renderExcerpt } from './batchDiffView.js';

export class FindingDetailModal {
  constructor(root, callbacks) {
    this.dialog = root.querySelector('#qa-finding-detail-modal');
    this.callbacks = callbacks;
    this.finding = null;
    this.token = 0;
    this.alive = true;
    this.disposers = [];
    if (!this.dialog) return;
    const onClick = (event) => {
      const btn = event.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.id === 'qa-finding-detail-close') this.close();
      else if (btn.id === 'qa-finding-detail-copy') this._copyLocation(btn);
      else if (btn.id === 'qa-finding-detail-fix') {
        const key = this.finding && this.finding.findingKey;
        this.close();
        if (key) this.callbacks.onFix(key);
      } else if (btn.dataset.detailRetry) this._load();
    };
    this.dialog.addEventListener('click', onClick);
    this.disposers.push(() => this.dialog.removeEventListener('click', onClick));
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.token += 1;
    this.disposers.forEach((dispose) => { try { dispose(); } catch (_) { /* đã gỡ */ } });
    this.disposers = [];
    if (this.dialog && this.dialog.open) this.dialog.close();
  }

  close() {
    this.token += 1;
    if (this.dialog && this.dialog.open) this.dialog.close();
  }

  open(finding) {
    if (!this.dialog || !finding) return;
    this.finding = finding;
    const set = (id, text) => {
      const node = this.dialog.querySelector(`#${id}`);
      if (node) node.textContent = text;
      return node;
    };
    set('qa-finding-detail-kind', finding.label || finding.kind);
    set('qa-finding-detail-where', finding.where || finding.id || '');
    set('qa-finding-detail-message', finding.message || finding.detail || '');
    const action = set('qa-finding-detail-action', finding.action ? `Hướng dẫn: ${finding.action}` : '');
    if (action) action.hidden = !finding.action;
    const fix = this.dialog.querySelector('#qa-finding-detail-fix');
    if (fix) fix.hidden = !(finding.fixRoute === 'quick' || finding.fixRoute === 'guided');
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector('#qa-finding-detail-title')?.focus();
    this._load();
  }

  _status(text, retry = false) {
    const box = this.dialog.querySelector('#qa-finding-detail-status');
    if (!box) return;
    box.textContent = text || '';
    box.hidden = !text;
    if (retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary-sm';
      btn.dataset.detailRetry = '1';
      btn.textContent = 'Thử lại';
      box.append(' ', btn);
    }
  }

  async _load() {
    const token = ++this.token;
    const code = this.dialog.querySelector('#qa-finding-detail-code');
    if (code) code.textContent = '';
    this._status('Đang tải đoạn mã…');
    try {
      const res = await apiClient.get('/api/qa/finding/context', { findingKey: this.finding.findingKey });
      if (!this.alive || token !== this.token) return;
      if (!res.file) {
        this._status('Lỗi này không gắn với một vị trí trong file mã nguồn.');
        return;
      }
      this._status('');
      if (code) code.append(renderExcerpt(res.file));
    } catch (err) {
      if (!this.alive || token !== this.token) return;
      this._status(`Không tải được đoạn mã: ${err.message}`, true);
    }
  }

  async _copyLocation(btn) {
    const text = (this.finding && (this.finding.where || this.finding.id)) || '';
    try {
      await navigator.clipboard.writeText(text);
      btn.querySelector('span').textContent = 'Đã sao chép';
    } catch (_) {
      btn.querySelector('span').textContent = 'Trình duyệt chặn sao chép';
    }
  }
}
