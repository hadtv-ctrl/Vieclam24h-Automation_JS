'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaCandidatesSlice.js
 * Quản lý danh sách Test Candidates, lựa chọn sinh bản thảo và soạn thảo spec tự động.
 */

import { toast } from '../../../core/toast.js';

export class QaCandidatesSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderCandidates(root) {
    const tbody = root.querySelector('#qa-candidates-tbody');
    const empty = root.querySelector('#qa-candidates-empty');
    if (!tbody) return;
    tbody.innerHTML = '';

    const candidates = this.qaSlice.candidates || [];
    if (!candidates.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    candidates.forEach((cand) => {
      const tr = document.createElement('tr');
      const isPicked = this.qaSlice.pickedIds.has(cand.id);

      tr.innerHTML = `
        <td style="width: 40px; text-align: center;">
          <input type="checkbox" class="qa-candidate-pick" data-id="${cand.id}" ${isPicked ? 'checked' : ''}>
        </td>
        <td style="font-family: var(--font-mono, monospace); font-weight: 600;">${cand.id}</td>
        <td><strong>${cand.title || ''}</strong></td>
        <td><code>${cand.acId || ''}</code></td>
        <td><span class="qa-prio-badge">${cand.priority || 'P1'}</span></td>
        <td><small style="color: var(--muted);">${cand.file || ''}</small></td>
      `;

      const cb = tr.querySelector('.qa-candidate-pick');
      if (cb) {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            this.qaSlice.pickedIds.add(cand.id);
          } else {
            this.qaSlice.pickedIds.delete(cand.id);
          }
          this.syncPickState(root);
        });
      }
      tbody.appendChild(tr);
    });
    this.syncPickState(root);
  }

  syncPickState(root) {
    const count = this.qaSlice.pickedIds.size;
    const btnDraft = root.querySelector('#qa-btn-draft');
    const pickCountEl = root.querySelector('#qa-pick-count');
    if (btnDraft) btnDraft.disabled = count === 0;
    if (pickCountEl) pickCountEl.textContent = count > 0 ? `(${count})` : '';
  }

  toggleAllPicks(checked) {
    const root = this.qaSlice._root();
    const candidates = this.qaSlice.candidates || [];
    if (checked) {
      candidates.forEach((c) => this.qaSlice.pickedIds.add(c.id));
    } else {
      this.qaSlice.pickedIds.clear();
    }
    root.querySelectorAll('.qa-candidate-pick').forEach((cb) => {
      cb.checked = checked;
    });
    this.syncPickState(root);
  }

  clearPicks() {
    this.qaSlice.pickedIds.clear();
    const root = this.qaSlice._root();
    root.querySelectorAll('.qa-candidate-pick').forEach((cb) => {
      cb.checked = false;
    });
    const pickAll = root.querySelector('#qa-pick-all');
    if (pickAll) pickAll.checked = false;
    this.syncPickState(root);
  }

  generateDraft() {
    const picked = Array.from(this.qaSlice.pickedIds);
    if (!picked.length) {
      toast.warn('Vui lòng chọn ít nhất 1 test case candidate.');
      return;
    }

    const lines = [];
    lines.push(`const { test, expect } = require('@playwright/test');\n`);
    lines.push(`test.describe('Generated Candidates Suite', () => {`);

    picked.forEach((id) => {
      const cand = (this.qaSlice.candidates || []).find((c) => c.id === id);
      const title = cand?.title || id;
      lines.push(`  test('${id}: ${title.replace(/'/g, "\\'")}', async ({ page }) => {`);
      lines.push(`    // Preconditions: ${cand?.precondition || 'Môi trường sẵn sàng'}`);
      lines.push(`    expect(page).toBeDefined();`);
      lines.push(`  });\n`);
    });
    lines.push(`});\n`);

    this.qaSlice.draftText = lines.join('\n');
    const root = this.qaSlice._root();
    const draftContainer = root?.querySelector('#qa-draft-drawer');
    const codeEl = root?.querySelector('#qa-draft-code');
    if (codeEl) codeEl.textContent = this.qaSlice.draftText;
    if (draftContainer) draftContainer.style.display = 'block';
    toast.success(`Đã sinh bản thảo cho ${picked.length} test cases!`);
  }

  async copyDraft() {
    if (!this.qaSlice.draftText) return;
    try {
      await navigator.clipboard.writeText(this.qaSlice.draftText);
      toast.success('Đã sao chép mã spec vào clipboard!');
    } catch (_) {
      toast.warn('Không thể tự động ghi vào clipboard.');
    }
  }

  closeDraft() {
    const root = this.qaSlice._root();
    const draftContainer = root?.querySelector('#qa-draft-drawer');
    if (draftContainer) draftContainer.style.display = 'none';
  }

  toggleDraftFullscreen() {
    const root = this.qaSlice._root();
    const drawer = root?.querySelector('#qa-draft-drawer');
    if (drawer) drawer.classList.toggle('fullscreen');
  }
}
