'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaBatchSlice.js
 * Quản lý tab Static Findings, quy trình Auto-Fix và Scaffold Wizard.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export class QaBatchSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderFindings(root) {
    const list = root.querySelector('#qa-findings-list');
    const empty = root.querySelector('#qa-findings-empty');
    if (!list) return;
    list.innerHTML = '';

    const summary = this.qaSlice.summary;
    const findings = (summary && Array.isArray(summary.findings)) ? summary.findings : [];

    if (!findings.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    findings.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'qa-finding-card';
      const severity = (f.severity || 'info').toLowerCase();
      card.setAttribute('data-severity', severity);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <span class="qa-finding-badge" data-severity="${severity}">${f.severity || 'Info'}</span>
            <strong style="margin-left: 6px;">${f.code || 'FINDING'}</strong>
            <span style="color: var(--muted); margin-left: 6px;">${f.file || ''}</span>
          </div>
        </div>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--text);">${f.message || f.detail || ''}</p>
      `;
      list.appendChild(card);
    });
  }

  async openAutoFixModal() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-fix-modal');
    if (!modal) return;

    const list = modal.querySelector('#qa-fix-preview-list');
    if (list) list.innerHTML = '<p style="color: var(--muted);">Đang phân tích thay đổi dự kiến…</p>';
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: true });
      if (!res || !res.changes) throw new Error('Không nhận được kế hoạch sửa');
      this.qaSlice._fixChanges = res.changes;
      if (list) {
        list.innerHTML = '';
        if (!res.changes.length) {
          list.innerHTML = '<p style="color: var(--muted); padding: 12px 0;">Không có lỗi nào cần sửa tự động.</p>';
          return;
        }
        res.changes.forEach((c) => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 12.5px;';
          item.textContent = `${c.file || ''}: ${c.description || c.action || ''}`;
          list.appendChild(item);
        });
      }
    } catch (err) {
      if (list) list.innerHTML = `<p style="color: var(--danger);">Lỗi phân tích: ${err.message}</p>`;
    }
  }

  async applyAutoFix() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-fix-modal');
    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: false });
      toast.success(`Đã tự động sửa ${res.updatedFiles || 0} file thành công!`);
      if (modal) { try { modal.close(); } catch (_) {} }
      await this.qaSlice.reload(true);
    } catch (err) {
      toast.error(`Lỗi khi áp dụng sửa: ${err.message}`);
    }
  }

  async openScaffoldModal() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    try {
      const meta = await apiClient.get('/api/qa/scaffold-meta');
      const reqInput = modal.querySelector('#qa-scaffold-req-id');
      const domainSelect = modal.querySelector('#qa-scaffold-domain');

      if (reqInput && meta.nextReqId) reqInput.value = meta.nextReqId;
      if (domainSelect && meta.existingDomains) {
        domainSelect.innerHTML = '';
        meta.existingDomains.forEach((d) => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          domainSelect.appendChild(opt);
        });
      }
    } catch (_) {}

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async extractRawScaffold() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    const rawTextarea = modal.querySelector('#qa-scaffold-raw-content');
    const rawContent = rawTextarea ? rawTextarea.value.trim() : '';
    if (!rawContent) {
      toast.warn('Vui lòng dán nội dung kịch bản hoặc spec thô.');
      return;
    }

    const previewSection = modal.querySelector('#qa-scaffold-preview-section');
    const previewFiles = modal.querySelector('#qa-scaffold-preview-files');
    const titleInput = modal.querySelector('#qa-scaffold-title');

    try {
      const res = await apiClient.post('/api/qa/extract-scaffold', { rawContent });
      if (res && res.preview) {
        if (titleInput && res.preview.title) titleInput.value = res.preview.title;
        if (previewFiles && res.preview.files) {
          previewFiles.innerHTML = res.preview.files.map((f) => `<li><code>${f}</code></li>`).join('');
        }
        if (previewSection) previewSection.style.display = 'block';
        toast.success(`Đã trích xuất ${res.preview.acCount} AC và ${res.preview.tcCount} TC!`);
      }
    } catch (err) {
      toast.error(`Lỗi trích xuất: ${err.message}`);
    }
  }

  async submitScaffold() {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-scaffold-modal');
    if (!modal) return;

    const reqId = modal.querySelector('#qa-scaffold-req-id')?.value.trim();
    const title = modal.querySelector('#qa-scaffold-title')?.value.trim();
    const domain = modal.querySelector('#qa-scaffold-domain')?.value.trim();
    const acCount = parseInt(modal.querySelector('#qa-scaffold-ac-count')?.value || '2', 10);

    if (!reqId || !title) {
      toast.warn('Vui lòng nhập đầy đủ Mã REQ và Tiêu đề.');
      return;
    }

    try {
      const res = await apiClient.post('/api/qa/scaffold', { reqId, title, domain, acCount });
      if (res.ok) {
        toast.success(`Đã khởi tạo ${res.created?.length || 3} file thành công!`);
        try { modal.close(); } catch (_) {}
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Lỗi tạo scaffold: ${err.message}`);
    }
  }
}
