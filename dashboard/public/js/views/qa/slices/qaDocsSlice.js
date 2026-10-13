'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDocsSlice.js
 * Quản lý giao diện đọc và biên tập tài liệu Requirements / Test Cases Markdown.
 */

import { apiClient } from '../../../core/apiClient.js';
import { renderMarkdown, parseFrontMatter } from '../markdownView.js';
import { parseOpenQuestions, applyAnswers } from '../openQuestions.js';

export class QaDocsSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this._lastAuthor = '';
  }

  renderDocs(root) {
    const r = root || this.qaSlice._root();
    if (!r || !this.qaSlice.trace) return;
    const workspace = r.querySelector('#qa-docs-workspace');
    const tbody = r.querySelector('#qa-docs-tbody');
    if (!workspace || !tbody) return;
    tbody.textContent = '';

    if (this.qaSlice.trace.available === false) {
      workspace.hidden = true;
      this.qaSlice._setEmpty('qa-docs-empty', [
        'Chưa có analyzer trong repo này',
        (this.qaSlice.trace.analyzer && this.qaSlice.trace.analyzer.error) || '',
        'Chạy một lượt sync từ Hub để nhận scripts/lib/qaTrace.js.',
      ].filter(Boolean));
      return;
    }

    const reqs = this.qaSlice.trace.requirements || [];
    if (!reqs.length && !this.qaSlice.documents.length) {
      workspace.hidden = true;
      this.qaSlice._setEmpty('qa-docs-empty', [
        'Repo này chưa có tài liệu requirement',
        `Chưa thấy thư mục "${(this.qaSlice.trace.dirs || {}).requirements}/" hoặc thư mục đó chưa có file nào đúng quy ước.`,
        'Đây là trạng thái bình thường khi dự án bắt đầu từ script. Mỗi requirement là một file'
          + ' Markdown mang mã REQ-xxx, bên trong có các AC-yyy.',
        `Hiện có ${(this.qaSlice.trace.counts || {}).specs || 0} spec chưa truy vết được về nghiệp vụ nào —`
          + ' đó chính là vùng rủi ro sót nghiệp vụ.',
      ]);
      return;
    }

    this.qaSlice._setEmpty('qa-docs-empty', null);
    workspace.hidden = false;

    reqs.forEach((req) => {
      const firstFile = (req.files || [])[0];
      const cellFile = firstFile
        ? this._docLink(firstFile, (req.files || []).join(', '))
        : this.qaSlice._cell('—', 'qa-dim');
      const action = this.qaSlice._el('td');
      if (firstFile) {
        const btn = this.qaSlice._el('button', 'Mở tài liệu', 'btn-secondary-sm');
        btn.type = 'button';
        const handler = () => this.openDocument(firstFile);
        btn.addEventListener('click', handler);
        this.qaSlice._renderDisposers.push(() => btn.removeEventListener('click', handler));
        action.appendChild(btn);
      }
      tbody.appendChild(this.qaSlice._row([
        this.qaSlice._cell(req.id, 'qa-mono'),
        this.qaSlice._cell(req.acCount),
        this.qaSlice._cell(req.tcCount),
        cellFile,
        action,
      ]));
    });

    this.renderDocList(r);
    if (this.qaSlice.activeDocPath) {
      this.openDocument(this.qaSlice.activeDocPath);
    } else {
      this.showOverview();
    }
  }

  _docLink(relPath, label) {
    const td = this.qaSlice._el('td');
    const btn = this.qaSlice._el('button', label || relPath, 'qa-file-link qa-mono');
    btn.type = 'button';
    btn.title = `Mở ${relPath}`;
    const handler = () => this.openDocument(relPath);
    btn.addEventListener('click', handler);
    this.qaSlice._renderDisposers.push(() => btn.removeEventListener('click', handler));
    td.appendChild(btn);
    return td;
  }

  renderDocList(root) {
    const r = root || this.qaSlice._root();
    const list = r && r.querySelector('#qa-docs-list');
    const empty = r && r.querySelector('#qa-docs-list-empty');
    if (!list || !empty) return;
    list.textContent = '';

    const needle = (this.qaSlice.docFilter || '').trim().toLowerCase();
    const matches = (this.qaSlice.documents || []).filter((d) => !needle
      || d.path.toLowerCase().includes(needle)
      || (d.ids || []).some((id) => id.toLowerCase().includes(needle)));

    empty.hidden = matches.length > 0;
    const countEl = r && r.querySelector('#qa-docs-count');
    if (countEl) countEl.textContent = String(matches.length);

    const GROUPS = [
      { kind: 'requirement', label: 'Requirement' },
      { kind: 'test-case', label: 'Test case' },
    ];
    for (const group of GROUPS) {
      const items = matches.filter((d) => d.kind === group.kind);
      if (!items.length) continue;
      list.appendChild(this.qaSlice._el('p', `${group.label} (${items.length})`, 'qa-docs-group'));
      for (const doc of items) list.appendChild(this._docListItem(doc));
    }
  }

  _docListItem(doc) {
    const active = this.qaSlice.activeDocPath === doc.path;
    const btn = this.qaSlice._el('div', null, `qa-doc-item dashboard-list-card${active ? ' is-active active' : ''}`);
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-current', active ? 'true' : 'false');

    const isReq = doc.kind === 'requirement' || (doc.path && doc.path.startsWith('requirements'));
    const iconClass = isReq ? 'ph-file-text' : 'ph-check-square-offset';
    const iconWrap = this.qaSlice._el('div', null, 'qa-doc-icon dashboard-list-card__icon');
    const icon = this.qaSlice._el('i', null, `ph-bold ${iconClass}`);
    iconWrap.appendChild(icon);
    btn.appendChild(iconWrap);

    const body = this.qaSlice._el('div', null, 'qa-doc-item-body dashboard-list-card__body');
    body.appendChild(this.qaSlice._el('span', doc.name, 'qa-doc-item-name'));

    const ids = doc.ids || [];
    if (ids.length) {
      const idsWrap = this.qaSlice._el('div', null, 'qa-doc-item-ids');
      const maxShown = 3;
      const shown = ids.slice(0, maxShown);
      for (const id of shown) {
        idsWrap.appendChild(this.qaSlice._el('span', id, 'qa-doc-id-chip'));
      }
      if (ids.length > maxShown) {
        idsWrap.appendChild(this.qaSlice._el('span', `+${ids.length - maxShown}`, 'qa-doc-id-chip qa-doc-id-chip--more'));
      }
      body.appendChild(idsWrap);
    }
    btn.appendChild(body);

    const handler = () => this.openDocument(doc.path);
    btn.addEventListener('click', handler);
    this.qaSlice._renderDisposers.push(() => btn.removeEventListener('click', handler));
    return btn;
  }

  showOverview() {
    const root = this.qaSlice._root();
    if (!root) return;
    this.qaSlice.activeDocPath = null;
    this.qaSlice._activeDoc = null;
    this._closeReaderForm();
    const overview = root.querySelector('#qa-reader-overview');
    const doc = root.querySelector('#qa-reader-doc');
    if (overview) overview.hidden = false;
    if (doc) doc.hidden = true;
    this.renderDocList(root);
  }

  async openDocument(relPath) {
    const root = this.qaSlice._root();
    if (!root || !relPath) return;
    const overview = root.querySelector('#qa-reader-overview');
    const pane = root.querySelector('#qa-reader-doc');
    const body = root.querySelector('#qa-reader-body');
    const chips = root.querySelector('#qa-reader-chips');
    if (!pane || !body) return;

    this.qaSlice.activeDocPath = relPath;
    this.qaSlice._activeDoc = null;
    this._closeReaderForm();
    if (overview) overview.hidden = true;
    pane.hidden = false;
    this.renderDocList(root);

    body.textContent = '';
    if (chips) chips.textContent = '';
    body.appendChild(this.qaSlice._el('p', 'Đang mở tài liệu…', 'qa-reader-loading'));

    let doc;
    try {
      doc = await apiClient.get('/api/qa/document', { path: relPath });
    } catch (error) {
      body.textContent = '';
      body.appendChild(this.qaSlice._el(
        'div',
        error.status === 404
          ? `Không tìm thấy ${relPath} trong danh sách tài liệu đọc được của repo này.`
          : `Không mở được tài liệu: ${error.message}`,
        'qa-reader-error',
      ));
      this._setReaderHead(relPath, null);
      return;
    }

    if (this.qaSlice.activeDocPath !== relPath) return;

    this.qaSlice._activeDoc = doc;
    const { meta, body: markdown } = parseFrontMatter(doc.content);
    this._setReaderHead(doc.path, doc, meta);
    this._setReaderActions(doc, doc.content);
    this._renderDocMeta(meta);
    if (chips) this._renderDocChips(chips, doc);

    body.textContent = '';
    body.appendChild(renderMarkdown(markdown));
    body.scrollTop = 0;
    this._renderOutline(body);
  }

  _setReaderActions(doc, markdown) {
    const root = this.qaSlice._root();
    if (!root) return;
    const answerBtn = root.querySelector('#qa-reader-answer');
    const answerLabel = root.querySelector('#qa-reader-answer-label');
    const editBtn = root.querySelector('#qa-reader-edit');
    const inferBtn = root.querySelector('#qa-reader-infer');
    const deleteBtn = root.querySelector('#qa-reader-delete');
    const editable = Boolean(doc) && doc.kind === 'requirement';

    if (editBtn) editBtn.hidden = !editable;
    if (deleteBtn) deleteBtn.hidden = !editable;

    const parsed = editable ? parseOpenQuestions(markdown) : { found: false, questions: [] };
    this.qaSlice._openQuestions = parsed.questions;
    const pending = parsed.questions.filter((q) => !q.answered).length;
    const hasDecided = parsed.questions.some((q) => q.answered);

    if (answerBtn) {
      answerBtn.hidden = !parsed.found || !parsed.questions.length;
      if (answerLabel) {
        answerLabel.textContent = pending
          ? `Trả lời câu hỏi (${pending})`
          : 'Câu hỏi đã chốt';
      }
    }

    if (inferBtn) {
      inferBtn.hidden = !editable || !hasDecided;
    }

    const acMatches = [...(markdown || '').matchAll(/^#{2,4}\s*(AC-\d{3})\b[:\s\-—]*(.*)$/gim)];
    this.qaSlice._activeDocAcs = acMatches.map((m) => ({ id: m[1].toUpperCase(), title: m[2].trim() }));
    if (!this.qaSlice._activeDocAcs.length) {
      const allAcMatches = [...(markdown || '').matchAll(/\bAC-\d{3}\b/g)];
      this.qaSlice._activeDocAcs = [...new Set(allAcMatches.map((m) => m[0].toUpperCase()))].map((id) => ({ id, title: '' }));
    }
  }

  _renderDocMeta(meta) {
    const box = this.qaSlice._root() && this.qaSlice._root().querySelector('#qa-reader-meta');
    if (!box) return;
    box.textContent = '';
    const SKIP = new Set(['title', 'id', 'slug']);
    for (const [key, value] of meta) {
      if (SKIP.has(key.toLowerCase()) || !value) continue;
      box.appendChild(this.qaSlice._el('dt', key));
      box.appendChild(this.qaSlice._el('dd', value));
    }
  }

  _setReaderHead(relPath, doc, meta = []) {
    const root = this.qaSlice._root();
    if (!root) return;
    const kind = root.querySelector('#qa-reader-kind');
    const title = root.querySelector('#qa-reader-title');
    const pathEl = root.querySelector('#qa-reader-path');
    const label = doc && doc.kind === 'test-case' ? 'TÀI LIỆU TEST CASE' : 'TÀI LIỆU REQUIREMENT';
    const fromMeta = (meta.find(([k]) => k.toLowerCase() === 'title') || [])[1];
    if (kind) kind.textContent = doc ? label : 'TÀI LIỆU';
    if (title) title.textContent = doc ? (fromMeta || doc.name) : relPath;
    if (pathEl) {
      pathEl.textContent = doc
        ? `${doc.path} · ${Math.max(1, Math.round(doc.bytes / 1024))} KB`
        : relPath;
    }
  }

  _renderDocChips(container, doc) {
    container.textContent = '';
    const req = (this.qaSlice.trace?.requirements || []).find((r) => (r.files || []).includes(doc.path));

    if (doc.kind === 'requirement' && req) {
      const uncovered = new Set(
        (this.qaSlice.trace?.findings?.major || [])
          .filter((f) => f.kind === 'ac-khong-co-tc')
          .map((f) => f.id),
      );
      for (const ac of (req.acs || []).slice().sort()) {
        const covered = !uncovered.has(ac);
        const chip = this.qaSlice._el('span', null, `qa-chip ${covered ? 'qa-chip-covered' : 'qa-chip-uncovered'}`);
        chip.appendChild(this.qaSlice._el('span', ac));
        chip.appendChild(this.qaSlice._el('span', covered ? 'có TC' : 'chưa có TC'));
        chip.title = covered ? `${ac} đã có test case` : `${ac} chưa có test case nào phủ`;
        container.appendChild(chip);
      }
      return;
    }

    for (const id of (doc.ids || []).slice(0, 24)) {
      container.appendChild(this.qaSlice._el('span', id, 'qa-chip'));
    }
    if ((doc.ids || []).length > 24) {
      container.appendChild(this.qaSlice._el('span', `+${doc.ids.length - 24}`, 'qa-chip'));
    }
  }

  _renderOutline(body) {
    const box = this.qaSlice._root() && this.qaSlice._root().querySelector('#qa-reader-outline');
    if (!box) return;
    box.textContent = '';

    const headings = [...body.querySelectorAll('.qa-md-h')];
    if (headings.length < 3) return;

    box.appendChild(this.qaSlice._el('p', 'Mục lục', 'qa-outline-title'));
    headings.forEach((heading) => {
      const level = Number((heading.className.match(/qa-md-h(\d)/) || [, '1'])[1]);
      const link = this.qaSlice._el('button', heading.textContent, `qa-outline-link qa-outline-l${level}`);
      link.type = 'button';
      link.title = heading.textContent;
      const handler = () => {
        body.scrollTop = heading.offsetTop - body.offsetTop;
      };
      link.addEventListener('click', handler);
      this.qaSlice._renderDisposers.push(() => link.removeEventListener('click', handler));
      box.appendChild(link);
    });
  }

  _closeReaderForm() {
    const root = this.qaSlice._root();
    if (!root) return;
    const box = root.querySelector('#qa-reader-form');
    if (box) {
      box.textContent = '';
      box.hidden = true;
    }
    const readerMain = root.querySelector('#qa-reader-main');
    if (readerMain) {
      readerMain.classList.remove('has-open-form');
    }
    const outline = root.querySelector('#qa-reader-outline');
    if (outline) {
      outline.hidden = false;
    }
  }

  _formShell(title, hint) {
    const root = this.qaSlice._root();
    const box = root.querySelector('#qa-reader-form');
    box.textContent = '';
    box.hidden = false;

    const readerMain = root.querySelector('#qa-reader-main');
    if (readerMain) {
      readerMain.classList.add('has-open-form');
    }
    const outline = root.querySelector('#qa-reader-outline');
    if (outline) {
      outline.hidden = true;
    }

    const head = this.qaSlice._el('div', null, 'qa-form-head');
    head.appendChild(this.qaSlice._el('p', title, 'qa-form-title'));

    const closeBtn = this.qaSlice._el('button', null, 'qa-form-close-btn');
    closeBtn.type = 'button';
    closeBtn.title = 'Đóng';
    closeBtn.innerHTML = '<i class="ph-bold ph-x"></i>';
    head.appendChild(closeBtn);
    box.appendChild(head);

    if (hint) {
      const hintEl = this.qaSlice._el('p', hint, 'qa-form-hint');
      hintEl.style.maxWidth = 'none';
      box.appendChild(hintEl);
    }

    const body = this.qaSlice._el('div', null, 'qa-form-body');
    box.appendChild(body);

    const footer = this.qaSlice._el('div', null, 'qa-form-footer');
    const byWrap = this.qaSlice._el('label', null, 'qa-form-by');
    byWrap.appendChild(this.qaSlice._el('span', 'Người chốt', 'qa-field-label'));
    const by = document.createElement('input');
    by.type = 'text';
    by.placeholder = 'Tên bạn';
    by.value = this._lastAuthor || '';
    byWrap.appendChild(by);
    footer.appendChild(byWrap);

    const save = this.qaSlice._el('button', 'Lưu vào tài liệu', 'btn-primary-sm');
    save.type = 'button';
    const cancel = this.qaSlice._el('button', 'Huỷ', 'btn-secondary-sm');
    cancel.type = 'button';
    const status = this.qaSlice._el('span', '', 'qa-form-status');
    footer.appendChild(save);
    footer.appendChild(cancel);
    footer.appendChild(status);
    box.appendChild(footer);

    const onCancel = () => this._closeReaderForm();
    cancel.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    this.qaSlice._renderDisposers.push(() => {
      cancel.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
    });

    return { box, body, by, save, status };
  }

  async _saveDocument(content, status, save) {
    const doc = this.qaSlice._activeDoc;
    if (!doc) return false;
    save.disabled = true;
    status.className = 'qa-form-status';
    status.textContent = 'Đang lưu…';
    try {
      const res = await apiClient.put('/api/qa/document', {
        path: doc.path,
        content,
        expectedBytes: doc.bytes,
      });
      status.textContent = res.changed ? `Đã lưu. Bản sao lưu: ${res.backup}` : 'Không có thay đổi nào.';
      this._closeReaderForm();
      await this.qaSlice.reload();
      this.qaSlice.notify(res.changed ? 'Đã cập nhật tài liệu requirement.' : 'Tài liệu không thay đổi.');
      return true;
    } catch (error) {
      status.className = 'qa-form-status is-error';
      status.textContent = error.status === 409
        ? 'Tài liệu đã đổi trên đĩa (hoặc AI Agent đang chạy). Bấm Làm mới rồi thử lại.'
        : `Không lưu được: ${error.message}`;
      save.disabled = false;
      return false;
    }
  }

  openAnswerForm() {
    if (!this.qaSlice._activeDoc || !this.qaSlice._openQuestions || !this.qaSlice._openQuestions.length) return;
    const { body, by, save, status } = this._formShell(
      'Trả lời câu hỏi treo',
      'Câu trả lời được ghi thẳng vào dòng câu hỏi, thay cho đuôi "cần ... xác nhận".'
        + ' Phần còn lại của tài liệu giữ nguyên từng dòng.',
    );

    const hasDecided = this.qaSlice._openQuestions.some((q) => q.answered);
    if (hasDecided) {
      const inferBanner = this.qaSlice._el('div', null, 'qa-infer-prompt-banner');
      inferBanner.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;';
      const bannerText = this.qaSlice._el('span', '💡 Đã có quyết định chốt! Rà soát để tự động sinh Test Case biên & rẽ nhánh:', null);
      bannerText.style.fontSize = '12px';
      bannerText.style.fontWeight = '600';
      const inferBtn = document.createElement('button');
      inferBtn.type = 'button';
      inferBtn.className = 'btn-secondary-sm';
      inferBtn.textContent = '🔍 Rà soát Test Case';
      inferBtn.addEventListener('click', () => this.qaSlice.inferenceSlice.openInferModal());
      inferBanner.appendChild(bannerText);
      inferBanner.appendChild(inferBtn);
      body.appendChild(inferBanner);
    }

    const inputs = [];
    for (const q of this.qaSlice._openQuestions) {
      const card = this.qaSlice._el('div', null, `qa-question${q.answered ? ' is-answered' : ''}`);
      card.appendChild(this.qaSlice._el('p', q.text, 'qa-question-text'));
      if (q.answered) {
        card.appendChild(this.qaSlice._el('p', 'Câu này đã có kết luận trong tài liệu.', 'qa-question-note'));
      } else {
        const area = document.createElement('textarea');
        area.className = 'qa-textarea';
        area.style.width = '100%';
        area.style.boxSizing = 'border-box';
        area.rows = 2;
        area.placeholder = 'Kết luận của bạn…';
        card.appendChild(area);
        inputs.push({ line: q.line, area });
      }
      body.appendChild(card);
    }

    const handler = async () => {
      const author = by.value.trim();
      if (!author) {
        status.className = 'qa-form-status is-error';
        status.textContent = 'Cần tên người chốt để ghi vào tài liệu.';
        return;
      }
      const answers = inputs
        .map((i) => ({ line: i.line, answer: i.area.value }))
        .filter((a) => a.answer.trim());
      if (!answers.length) {
        status.className = 'qa-form-status is-error';
        status.textContent = 'Chưa nhập câu trả lời nào.';
        return;
      }
      this._lastAuthor = author;
      const stamp = new Date().toISOString().slice(0, 10);
      const next = applyAnswers(this.qaSlice._activeDoc.content, answers, { author, date: stamp });
      await this._saveDocument(next.content, status, save);
    };
    save.addEventListener('click', handler);
    this.qaSlice._renderDisposers.push(() => save.removeEventListener('click', handler));
  }

  openEditForm() {
    if (!this.qaSlice._activeDoc) return;
    const { body, by, save, status } = this._formShell(
      'Sửa tài liệu requirement',
      'Sửa trực tiếp Markdown. Bản cũ được sao lưu tự động trước khi ghi đè.',
    );

    const area = document.createElement('textarea');
    area.className = 'qa-textarea qa-edit-area';
    area.style.width = '100%';
    area.style.boxSizing = 'border-box';
    area.rows = 22;
    area.value = this.qaSlice._activeDoc.content;
    area.spellcheck = false;
    body.appendChild(area);

    const handler = async () => {
      const author = by.value.trim();
      if (author) this._lastAuthor = author;
      await this._saveDocument(area.value, status, save);
    };
    save.addEventListener('click', handler);
    this.qaSlice._renderDisposers.push(() => save.removeEventListener('click', handler));
  }
}
