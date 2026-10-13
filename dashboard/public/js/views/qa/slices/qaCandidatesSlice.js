'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaCandidatesSlice.js
 * Quản lý danh sách Test Candidates, lựa chọn sinh bản thảo và soạn thảo spec tự động.
 */

import { apiClient } from '../../../core/apiClient.js';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

export class QaCandidatesSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderCandidates(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const wrap = r.querySelector('#qa-candidates-wrap');
    const tbody = r.querySelector('#qa-candidates-tbody');
    if (!tbody) return;
    tbody.textContent = '';

    const list = (this.qaSlice.candidates || [])
      .filter((c) => this.qaSlice.priorityFilter === 'all' || c.priority === this.qaSlice.priorityFilter)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
        || String(a.id).localeCompare(String(b.id)));

    if (!list.length) {
      if (wrap) wrap.hidden = true;
      this.syncPickState(r);
      this.qaSlice._setEmpty('qa-candidates-empty', (this.qaSlice.candidates || []).length
        ? ['Không có ứng viên nào ở mức ưu tiên này']
        : [
          'Không có test case nào đang chờ automation',
          'Hoặc mọi test case đã có script, hoặc repo chưa có thư mục test-cases/.',
        ]);
      return;
    }

    this.qaSlice._setEmpty('qa-candidates-empty', null);
    if (wrap) wrap.hidden = false;

    list.forEach((c) => {
      const prioKey = String(c.priority || '').toLowerCase();
      const prio = this.qaSlice._cell(c.priority || '—', `qa-prio qa-prio-${prioKey}`);

      const tdPick = this.qaSlice._el('td', null, 'qa-pick-col');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'qa-candidate-pick';
      box.checked = this.qaSlice.pickedIds.has(c.id);
      box.setAttribute('aria-label', `Chọn ${c.id}`);
      box.addEventListener('change', () => {
        if (box.checked) this.qaSlice.pickedIds.add(c.id);
        else this.qaSlice.pickedIds.delete(c.id);
        this.syncPickState(r);
      });
      tdPick.appendChild(box);

      tbody.appendChild(this.qaSlice._row([
        tdPick,
        this.qaSlice._cell(c.id, 'qa-mono'),
        this.qaSlice._cell(c.title || '—', 'qa-candidate-title'),
        this.qaSlice._cell(c.req || '—', 'qa-mono'),
        this.qaSlice._cell((c.acs || []).join(', ') || '—', 'qa-mono'),
        prio,
        this.qaSlice._cell(c.automation || 'Chưa khai', 'qa-dim'),
        this.qaSlice._cell(c.file || '—', 'qa-mono qa-dim'),
      ]));
    });

    this.syncPickState(r);
  }

  syncPickState(root) {
    const r = root || this.qaSlice._root();
    if (!r) return;
    const visible = [...r.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')];
    const picked = visible.filter((b) => b.checked).length;

    const all = r.querySelector('#qa-pick-all');
    if (all) {
      all.checked = visible.length > 0 && picked === visible.length;
      all.indeterminate = picked > 0 && picked < visible.length;
    }

    const btn = r.querySelector('#qa-btn-draft');
    const label = r.querySelector('#qa-btn-draft-label');
    const clear = r.querySelector('#qa-btn-draft-clear');
    if (btn) btn.disabled = this.qaSlice.pickedIds.size === 0;
    if (label) {
      label.textContent = this.qaSlice.pickedIds.size
        ? `Sinh bản thảo BDD (${this.qaSlice.pickedIds.size})`
        : 'Sinh bản thảo BDD';
    }
    if (clear) clear.hidden = this.qaSlice.pickedIds.size === 0;
  }

  toggleAllPicks(checked) {
    const root = this.qaSlice._root();
    if (!root) return;
    for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) {
      box.checked = checked;
      const id = (box.getAttribute('aria-label') || '').replace('Chọn ', '').trim();
      if (checked) this.qaSlice.pickedIds.add(id);
      else this.qaSlice.pickedIds.delete(id);
    }
    this.syncPickState(root);
  }

  clearPicks() {
    this.qaSlice.pickedIds.clear();
    const root = this.qaSlice._root();
    if (root) {
      for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) {
        box.checked = false;
      }
    }
    this.closeDraft();
    this.syncPickState(root);
  }

  async generateDraft() {
    const root = this.qaSlice._root();
    if (!root || !this.qaSlice.pickedIds.size) return;
    const box = root.querySelector('#qa-draft');
    const body = root.querySelector('#qa-draft-body');
    const meta = root.querySelector('#qa-draft-meta');
    const warn = root.querySelector('#qa-draft-warnings');
    if (!box || !body) return;

    box.hidden = false;
    body.style.width = '100%';
    body.style.maxWidth = 'none';
    body.textContent = 'Đang dựng bản thảo…';
    if (warn) warn.textContent = '';
    if (meta) meta.textContent = '';

    const ids = [...this.qaSlice.pickedIds].sort();
    let res;
    try {
      res = await apiClient.get('/api/qa/bdd-draft', { ids: ids.join(',') });
    } catch (error) {
      body.textContent = '';
      if (meta) meta.textContent = '';
      if (warn) {
        warn.textContent = '';
        warn.appendChild(this.qaSlice._el('p', `Không dựng được bản thảo: ${error.message}`, 'qa-draft-error'));
      }
      return;
    }

    const disclaimer = '# Lưu ý: Bản thảo KHÔNG được lưu lại (tự sinh từ tài liệu hiện tại).\n\n';
    this.qaSlice.draftText = disclaimer + (res.text || '');
    body.textContent = this.qaSlice.draftText;
    if (meta) {
      const missing = (res.missing || []).length ? ` · không có trong tài liệu: ${res.missing.join(', ')}` : '';
      meta.textContent = `${(res.ids || []).length} test case · dựng từ ${(res.dirs || {}).testCases}/${missing}`;
    }
    if (warn) {
      warn.textContent = '';
      for (const w of res.warnings || []) warn.appendChild(this.qaSlice._el('p', w, 'qa-draft-warn'));
    }
    body.scrollTop = 0;
  }

  async copyDraft() {
    const root = this.qaSlice._root();
    const copyBtn = root && root.querySelector('#qa-draft-copy');
    const status = root && root.querySelector('#qa-draft-meta');
    if (!this.qaSlice.draftText) return;
    try {
      await navigator.clipboard.writeText(this.qaSlice.draftText);
      this.qaSlice.notify('Đã sao chép kịch bản BDD vào bộ nhớ tạm.');
      if (copyBtn) {
        const origContent = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="ph-bold ph-check"></i> <span>Đã sao chép!</span>';
        copyBtn.style.borderColor = 'var(--success, #10b981)';
        copyBtn.style.color = 'var(--success, #10b981)';
        setTimeout(() => {
          copyBtn.innerHTML = origContent;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 1800);
      }
    } catch (_) {
      const body = root && root.querySelector('#qa-draft-body');
      if (body && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(body);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (status) status.textContent = 'Trình duyệt chặn clipboard — nội dung đã được bôi đen, bấm Ctrl+C.';
    }
  }

  closeDraft() {
    const root = this.qaSlice._root();
    const box = root && root.querySelector('#qa-draft');
    if (box) {
      box.classList.remove('is-fullscreen');
      const expandIcon = box.querySelector('#qa-draft-expand-icon');
      const expandLabel = box.querySelector('#qa-draft-expand-label');
      const expandBtn = box.querySelector('#qa-draft-expand');
      if (expandIcon) expandIcon.className = 'ph-bold ph-corners-out';
      if (expandLabel) expandLabel.textContent = 'Phóng to';
      if (expandBtn) expandBtn.title = 'Phóng to toàn màn hình';
      box.hidden = true;
    }
  }

  toggleDraftFullscreen(forceState) {
    const box = this.qaSlice._root() && this.qaSlice._root().querySelector('#qa-draft');
    if (!box) return;
    const isFull = typeof forceState === 'boolean' ? forceState : !box.classList.contains('is-fullscreen');
    box.classList.toggle('is-fullscreen', isFull);
    const expandIcon = box.querySelector('#qa-draft-expand-icon');
    const expandLabel = box.querySelector('#qa-draft-expand-label');
    const expandBtn = box.querySelector('#qa-draft-expand');
    if (expandIcon) expandIcon.className = isFull ? 'ph-bold ph-corners-in' : 'ph-bold ph-corners-out';
    if (expandLabel) expandLabel.textContent = isFull ? 'Thu nhỏ' : 'Phóng to';
    if (expandBtn) expandBtn.title = isFull ? 'Thu nhỏ khung xem (Esc)' : 'Phóng to toàn màn hình';
  }
}
