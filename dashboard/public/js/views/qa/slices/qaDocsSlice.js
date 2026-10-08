'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsSlice.js
 * Quản lý giao diện đọc và biên tập tài liệu Requirements / Test Cases Markdown.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';
import { renderMarkdown, parseFrontMatter } from '../markdownView.js';
import { parseOpenQuestions, applyAnswers } from '../openQuestions.js';

export class QaDocsSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderDocs(root) {
    this.renderDocList(root);
    if (this.qaSlice.activeDocPath) {
      this.openDocument(this.qaSlice.activeDocPath);
    } else {
      this.showOverview();
    }
  }

  renderDocList(root) {
    const list = root.querySelector('#qa-docs-list');
    if (!list) return;
    list.innerHTML = '';
    const docs = this.qaSlice.documents || [];

    docs.forEach((doc) => {
      const item = document.createElement('div');
      item.className = 'qa-doc-item';
      if (doc.path === this.qaSlice.activeDocPath) item.classList.add('active');

      const title = doc.frontMatter?.title || doc.path;
      item.innerHTML = `
        <div style="font-weight: 600; font-size: 13px;">${title}</div>
        <div style="font-size: 11.5px; color: var(--muted);">${doc.path}</div>
      `;

      item.onclick = () => {
        root.querySelectorAll('.qa-doc-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        this.openDocument(doc.path);
      };
      list.appendChild(item);
    });
  }

  showOverview() {
    const root = this.qaSlice._root();
    const reader = root?.querySelector('#qa-doc-reader');
    const overview = root?.querySelector('#qa-docs-overview');
    if (reader) reader.style.display = 'none';
    if (overview) overview.style.display = 'block';
  }

  async openDocument(docPath) {
    const root = this.qaSlice._root();
    const reader = root?.querySelector('#qa-doc-reader');
    const overview = root?.querySelector('#qa-docs-overview');
    if (!reader) return;

    this.qaSlice.activeDocPath = docPath;
    if (overview) overview.style.display = 'none';
    reader.style.display = 'block';

    const contentEl = reader.querySelector('#qa-reader-content');
    if (contentEl) contentEl.innerHTML = '<p style="color: var(--muted); padding: 20px;">Đang nạp tài liệu…</p>';

    try {
      const res = await apiClient.get(`/api/qa/document?path=${encodeURIComponent(docPath)}`);
      this.qaSlice._activeDoc = res;
      this.qaSlice._openQuestions = parseOpenQuestions(res.content || '');

      const fm = parseFrontMatter(res.content || '');
      this.renderDocMeta(reader, fm);
      this.setReaderHead(reader, fm.title || docPath, docPath);

      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(res.content || '');
      }
      this.setReaderActions(reader, false, false);
    } catch (err) {
      if (contentEl) contentEl.innerHTML = `<p style="color: var(--danger); padding: 20px;">Lỗi tải: ${err.message}</p>`;
    }
  }

  setReaderHead(reader, title, path) {
    const titleEl = reader.querySelector('#qa-reader-title');
    const pathEl = reader.querySelector('#qa-reader-path');
    if (titleEl) titleEl.textContent = title;
    if (pathEl) pathEl.textContent = path;
  }

  renderDocMeta(reader, fm) {
    const metaContainer = reader.querySelector('#qa-reader-meta');
    if (!metaContainer) return;
    metaContainer.innerHTML = '';
    const fields = ['id', 'status', 'version', 'risk', 'owner'];
    fields.forEach((f) => {
      if (fm[f]) {
        const badge = document.createElement('span');
        badge.className = 'qa-meta-badge';
        badge.textContent = `${f.toUpperCase()}: ${fm[f]}`;
        metaContainer.appendChild(badge);
      }
    });
  }

  setReaderActions(reader, isEditing, isAnswering) {
    const editBtn = reader.querySelector('#qa-reader-edit');
    const answerBtn = reader.querySelector('#qa-reader-answer');
    const hasQuestions = (this.qaSlice._openQuestions || []).length > 0;

    if (editBtn) editBtn.style.display = isEditing ? 'none' : 'inline-flex';
    if (answerBtn) answerBtn.style.display = (isAnswering || !hasQuestions) ? 'none' : 'inline-flex';
  }

  openAnswerForm() {
    const root = this.qaSlice._root();
    const reader = root?.querySelector('#qa-doc-reader');
    if (!reader || !this.qaSlice._openQuestions?.length) return;

    const contentEl = reader.querySelector('#qa-reader-content');
    if (!contentEl) return;

    this.setReaderActions(reader, false, true);
    contentEl.innerHTML = '';

    const form = document.createElement('div');
    form.className = 'qa-answer-form';

    this.qaSlice._openQuestions.forEach((q, idx) => {
      const group = document.createElement('div');
      group.className = 'qa-form-group';
      group.innerHTML = `
        <label style="font-weight: 600; font-size: 13px;">${q.id}: ${q.question}</label>
        <textarea class="qa-form-textarea" data-index="${idx}" placeholder="Nhập câu trả lời hoặc quyết định chốt...">${q.decision || ''}</textarea>
      `;
      form.appendChild(group);
    });

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 16px;';
    actions.innerHTML = `
      <button type="button" class="btn-primary-sm" id="qa-save-answers-btn">Lưu Quyết Định</button>
      <button type="button" class="btn-secondary-sm" id="qa-cancel-answers-btn">Hủy</button>
    `;
    form.appendChild(actions);

    contentEl.appendChild(form);
    form.querySelector('#qa-save-answers-btn')?.addEventListener('click', () => this.saveAnswers(form));
    form.querySelector('#qa-cancel-answers-btn')?.addEventListener('click', () => this.openDocument(this.qaSlice.activeDocPath));
  }

  async saveAnswers(form) {
    const textareas = form.querySelectorAll('.qa-form-textarea');
    const answers = [];
    textareas.forEach((t) => {
      const idx = parseInt(t.dataset.index, 10);
      const val = t.value.trim();
      if (val) answers.push({ ...this.qaSlice._openQuestions[idx], decision: val });
    });

    if (!answers.length) {
      toast.warn('Vui lòng nhập ít nhất 1 câu trả lời.');
      return;
    }

    const updated = applyAnswers(this.qaSlice._activeDoc.content, answers);
    await this.saveDocument(updated);
  }

  openEditForm() {
    const root = this.qaSlice._root();
    const reader = root?.querySelector('#qa-doc-reader');
    if (!reader || !this.qaSlice._activeDoc) return;

    const contentEl = reader.querySelector('#qa-reader-content');
    if (!contentEl) return;

    this.setReaderActions(reader, true, false);
    contentEl.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'qa-editor-textarea';
    textarea.value = this.qaSlice._activeDoc.content || '';
    contentEl.appendChild(textarea);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
    actions.innerHTML = `
      <button type="button" class="btn-primary-sm" id="qa-save-edit-btn">Lưu Tài Liệu</button>
      <button type="button" class="btn-secondary-sm" id="qa-cancel-edit-btn">Hủy</button>
    `;
    contentEl.appendChild(actions);

    actions.querySelector('#qa-save-edit-btn')?.addEventListener('click', () => this.saveDocument(textarea.value));
    actions.querySelector('#qa-cancel-edit-btn')?.addEventListener('click', () => this.openDocument(this.qaSlice.activeDocPath));
  }

  async saveDocument(newContent) {
    try {
      const res = await apiClient.post('/api/qa/document', {
        path: this.qaSlice.activeDocPath,
        content: newContent,
        expectedRevision: this.qaSlice._activeDoc?.revision,
      });
      if (res.ok) {
        toast.success('Đã lưu tài liệu thành công!');
        await this.openDocument(this.qaSlice.activeDocPath);
      }
    } catch (err) {
      toast.error(`Lỗi khi lưu tài liệu: ${err.message}`);
    }
  }
}
