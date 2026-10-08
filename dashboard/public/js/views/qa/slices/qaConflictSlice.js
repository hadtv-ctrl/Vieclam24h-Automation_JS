'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaConflictSlice.js
 * Quản lý giao diện xử lý xung đột truy vết (Conflict Studio) và xóa tài liệu an toàn.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export class QaConflictSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderConflicts(root) {
    if (this.qaSlice.conflictStudio && typeof this.qaSlice.conflictStudio.render === 'function') {
      this.qaSlice.conflictStudio.render(root);
    }
  }

  getReqIdFromDoc(doc) {
    if (!doc) return 'REQ';
    const fm = doc.frontMatter || {};
    if (fm.id) return String(fm.id).toUpperCase();
    const m = (doc.path || '').match(/\bREQ-(\d{3})\b/i);
    return m ? m[0].toUpperCase() : 'REQ';
  }

  async openDeleteRequirementModal(doc) {
    const root = this.qaSlice._root();
    const modal = root?.querySelector('#qa-delete-req-modal');
    if (!modal || !doc) return;

    const reqId = this.getReqIdFromDoc(doc);
    const reqTitle = doc.frontMatter?.title || doc.path;

    const reqIdBadge = modal.querySelector('#qa-del-req-id');
    const reqTitleEl = modal.querySelector('#qa-del-req-title');
    const confirmInput = modal.querySelector('#qa-del-confirm-input');
    const submitBtn = modal.querySelector('#qa-btn-confirm-delete-req');
    const warningList = modal.querySelector('#qa-del-impact-list');

    if (reqIdBadge) reqIdBadge.textContent = reqId;
    if (reqTitleEl) reqTitleEl.textContent = reqTitle;
    if (confirmInput) {
      confirmInput.value = '';
      confirmInput.placeholder = `Nhập chính xác "${reqId}" để xác nhận`;
    }
    if (submitBtn) submitBtn.disabled = true;

    if (warningList) {
      warningList.innerHTML = '<li style="color: var(--muted);">Đang phân tích tác động…</li>';
      try {
        const impact = await apiClient.get(`/api/qa/requirement-impact?reqId=${reqId}&path=${encodeURIComponent(doc.path)}`);
        warningList.innerHTML = '';
        if (impact && impact.files && impact.files.length) {
          impact.files.forEach((f) => {
            const li = document.createElement('li');
            li.textContent = f;
            warningList.appendChild(li);
          });
        } else {
          warningList.innerHTML = '<li style="color: var(--muted);">Chỉ xóa file requirement này.</li>';
        }
      } catch (_) {
        warningList.innerHTML = `<li>File requirement: ${doc.path}</li>`;
      }
    }

    const onInput = () => {
      if (submitBtn && confirmInput) {
        submitBtn.disabled = confirmInput.value.trim() !== reqId;
      }
    };
    confirmInput.oninput = onInput;

    const onSubmit = async () => {
      await this.submitDeleteRequirement(doc, modal, reqId);
    };
    submitBtn.onclick = onSubmit;

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async submitDeleteRequirement(doc, modal, reqId) {
    const deleteRelated = Boolean(modal.querySelector('#qa-del-also-testcases')?.checked);
    try {
      const res = await apiClient.post('/api/qa/delete-requirement', {
        path: doc.path,
        reqId,
        deleteRelated,
      });

      if (res.ok) {
        toast.success(`Đã xóa thành công ${reqId} và các file liên đới!`);
        try { modal.close(); } catch (_) {}
        this.qaSlice.activeDocPath = null;
        this.qaSlice._activeDoc = null;
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Lỗi khi xóa requirement: ${err.message}`);
    }
  }
}
