'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaInferenceSlice.js
 * Quản lý giao diện suy luận test case từ Open Questions (Heuristic / AI) và ghi vào document.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export class QaInferenceSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  openInferModal() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-infer-modal');
    if (!modal) return;

    const docPath = this.qaSlice.activeDocPath;
    const pathEl = modal.querySelector('#qa-infer-req-path');
    if (pathEl) pathEl.textContent = docPath || '—';

    const cardsContainer = modal.querySelector('#qa-infer-cards');
    if (cardsContainer) cardsContainer.innerHTML = '';
    const footer = modal.querySelector('#qa-infer-footer');
    if (footer) footer.style.display = 'none';

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async runInference() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-infer-modal');
    if (!modal) return;

    const reqPath = this.qaSlice.activeDocPath;
    if (!reqPath) {
      toast.warn('Vui lòng mở một tài liệu Requirement trước.');
      return;
    }

    const mode = modal.querySelector('input[name="qa-infer-mode"]:checked')?.value || 'heuristic';
    const statusEl = modal.querySelector('#qa-infer-status');
    const cardsContainer = modal.querySelector('#qa-infer-cards');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = mode === 'ai' ? 'Đang gọi AI suy luận test case…' : 'Đang chạy Heuristic BVA…';
    }

    try {
      const res = await apiClient.post('/api/qa/infer-test-cases', { reqPath, mode });
      if (statusEl) statusEl.style.display = 'none';
      if (!res.success) throw new Error(res.message || 'Lỗi suy luận test case');
      this.renderInferredCards(modal, res.items || [], mode);
      toast.success(`Đã tìm thấy ${res.count} test case đề xuất!`);
    } catch (err) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = `Lỗi: ${err.message}`;
      }
      toast.error(`Lỗi suy luận: ${err.message}`);
    }
  }

  renderInferredCards(modal, items, mode) {
    const container = modal.querySelector('#qa-infer-cards');
    const footer = modal.querySelector('#qa-infer-footer');
    if (!container) return;
    container.innerHTML = '';

    if (!items.length) {
      container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted);">Không có test case nào được sinh ra.</p>';
      if (footer) footer.style.display = 'none';
      return;
    }

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'qa-inferred-card';
      const stepsHtml = (item.steps || []).map((s) => `
        <tr><td>${s.step}</td><td>${s.action}</td><td>${s.expected}</td></tr>
      `).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer;">
            <input type="checkbox" class="qa-infer-pick" data-index="${idx}" checked>
            <span class="qa-inferred-id-badge">${item.suggestedId}</span>
            <span>${item.title}</span>
          </label>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--surface); border: 1px solid var(--line);">${item.priority}</span>
        </div>
        ${item.rationale ? `<p style="font-size: 12px; color: var(--muted); margin: 6px 0;">${item.rationale}</p>` : ''}
        ${stepsHtml ? `
          <table class="qa-inferred-steps-table" style="margin-top: 6px;">
            <thead><tr><th style="width: 40px;">#</th><th>Thao tác</th><th>Kỳ vọng</th></tr></thead>
            <tbody>${stepsHtml}</tbody>
          </table>
        ` : ''}
      `;
      container.appendChild(card);
    });

    this._inferredItems = items;
    if (footer) footer.style.display = 'flex';
    this.updateInferredSelectedCount(modal);
  }

  toggleAllInferred(checked) {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-infer-modal');
    if (!modal) return;
    modal.querySelectorAll('.qa-infer-pick').forEach((cb) => {
      cb.checked = checked;
    });
    this.updateInferredSelectedCount(modal);
  }

  updateInferredSelectedCount(modal) {
    const picked = modal.querySelectorAll('.qa-infer-pick:checked').length;
    const btn = modal.querySelector('#qa-btn-submit-inferred');
    if (btn) btn.textContent = `Thêm ${picked} Test Case Vào Tài Liệu`;
  }

  async submitInferredTestCases() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-infer-modal');
    if (!modal || !this._inferredItems) return;

    const checkboxes = modal.querySelectorAll('.qa-infer-pick:checked');
    const selected = Array.from(checkboxes).map((cb) => this._inferredItems[parseInt(cb.dataset.index, 10)]);

    if (!selected.length) {
      toast.warn('Vui lòng chọn ít nhất 1 test case.');
      return;
    }

    try {
      const res = await apiClient.post('/api/qa/append-inferred-cases', {
        reqPath: this.qaSlice.activeDocPath,
        testCases: selected,
      });
      if (res.success) {
        toast.success(`Đã thêm ${res.addedCount} test case thành công!`);
        try { modal.close(); } catch (_) {}
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Lỗi khi lưu test cases: ${err.message}`);
    }
  }
}
