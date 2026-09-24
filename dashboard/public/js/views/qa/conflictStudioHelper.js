// master-process-disable-size-check: Traceability Conflict Studio visual manager and reconciler
/**
 * dashboard/public/js/views/qa/conflictStudioHelper.js
 * Traceability Conflict Studio — hòa giải nhóm finding "Tài liệu và spec nói khác nhau".
 *
 * - Dữ liệu xung đột đã được server bóc sẵn (`finding.conflict`); UI không tự đoán lại detail.
 * - Mọi thao tác ghi chỉ gửi TC + spec + chiều đồng bộ. Server tự tính AC từ file thật.
 * - OWN-01..05: mọi listener đi qua `_on()` và được xả trong `destroy()`; phản hồi đến muộn
 *   tìm lại thẻ theo khóa trong DOM hiện tại thay vì ghi vào node đã bị thay.
 * - ASYNC-01: trong lúc một thao tác ghi đang chạy, toàn bộ nút hành động của studio bị khóa.
 * - Không dùng innerHTML với dữ liệu từ repo hay AI.
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';

const CONFLICT_KIND = 'ac-lech-giua-tai-lieu-va-spec';
const AI_TIMEOUT_MS = 60000;

const keyOf = (c) => `${c.specFile}::${c.tcId}`;
const signatureOf = (c) => `${keyOf(c)}::${c.specAcs.join(',')}::${c.docAcs.join(',')}`;
const list = (acs) => acs.join(', ');

export class ConflictStudioHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
    this._root = null;
    this._busy = false;
    this._openGroups = null; // null = chưa render lần nào, dùng trạng thái mặc định
    this._openContexts = new Set();
    // Cache theo chữ ký (TC + spec + tập AC hai phía): dữ liệu đổi thì chữ ký đổi, cache tự hết hạn.
    this._contextCache = new Map();
    this._verdictCache = new Map();
  }

  destroy() {
    this.disposers.forEach((dispose) => {
      try { dispose(); } catch (_) { /* listener đã bị gỡ cùng node */ }
    });
    this.disposers = [];
    this._root = null;
  }

  _on(target, evt, handler) {
    if (!target) return;
    target.addEventListener(evt, handler);
    this.disposers.push(() => target.removeEventListener(evt, handler));
  }

  _el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  _icon(name) {
    const i = this._el('i', `ph-bold ${name}`);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  _pendingDecision(conflict) {
    const decisions = (this.qaSlice && this.qaSlice.decisions && this.qaSlice.decisions.decisions) || [];
    return decisions.find((d) => d && !d.answered && d.source && d.source.kind === CONFLICT_KIND
      && d.source.tcId === conflict.tcId && d.source.specFile === conflict.specFile) || null;
  }

  _cardFor(key) {
    if (!this._root) return null;
    return [...this._root.querySelectorAll('[data-conflict-key]')].find((n) => n.dataset.conflictKey === key) || null;
  }

  _setBusy(on) {
    this._busy = on;
    if (!this._root) return;
    this._root.classList.toggle('is-busy', on);
    this._root.setAttribute('aria-busy', on ? 'true' : 'false');
    // Nút đã ghi sổ luôn giữ khóa, kể cả khi busy được gỡ.
    this._root.querySelectorAll('[data-conflict-action]').forEach((btn) => { btn.disabled = on || btn.dataset.locked === '1'; });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  _parseConflictDetail(detailStr) {
    if (!detailStr || typeof detailStr !== 'string') return null;
    const m = detailStr.match(/^(.*?):\s*([A-Za-z0-9_.-]+)\s+ghi\s+([A-Za-z0-9_,-]+)\s+nhưng tài liệu khai\s+([A-Za-z0-9_,-]+)$/);
    if (!m) return null;

    const split = (s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
    const specAcs = split(m[3]);
    const docAcs = split(m[4]);
    if (!specAcs.length || !docAcs.length) return null;

    return {
      specFile: m[1].trim().replace(/\\/g, '/'),
      tcId: m[2].trim(),
      specAcs,
      docAcs,
      specOnly: specAcs.filter((ac) => !docAcs.includes(ac)),
      docOnly: docAcs.filter((ac) => !specAcs.includes(ac)),
      specAc: specAcs[0],
      docAc: docAcs[0],
    };
  }

  render(container, conflictItems) {
    this.destroy();
    if (!container || !Array.isArray(conflictItems) || !conflictItems.length) return;

    const bySpec = new Map();
    const unparsed = [];
    conflictItems.forEach((item) => {
      const conflict = item.conflict || this._parseConflictDetail(item.detail);
      if (!conflict) { unparsed.push(item); return; }
      const file = conflict.specFile;
      if (!bySpec.has(file)) bySpec.set(file, []);
      bySpec.get(file).push(conflict);
    });

    const studio = this._el('section', 'qa-conflict-studio');
    studio.setAttribute('aria-label', 'Traceability Conflict Studio');
    this._root = studio;

    studio.appendChild(this._renderHead(conflictItems.length, bySpec));

    const groups = this._el('div', 'qa-conflict-groups');
    const firstRender = this._openGroups === null;
    if (firstRender) this._openGroups = new Set(bySpec.size <= 2 ? [...bySpec.keys()] : [[...bySpec.keys()][0]]);

    bySpec.forEach((conflicts, specFile) => groups.appendChild(this._renderGroup(specFile, conflicts)));
    if (unparsed.length) groups.appendChild(this._renderUnparsed(unparsed));
    studio.appendChild(groups);

    container.appendChild(studio);
    if (this._busy) this._setBusy(true);

    // Khung ngữ cảnh đang mở trước lần làm mới thì mở lại (dữ liệu có thể đã đổi).
    this._openContexts.forEach((key) => {
      const card = this._cardFor(key);
      if (card) this._showContext(card, false);
      else this._openContexts.delete(key);
    });
  }

  _renderHead(total, bySpec) {
    const head = this._el('header', 'qa-conflict-studio-head');
    const titleRow = this._el('div', 'qa-conflict-title-row');
    titleRow.appendChild(this._icon('ph-arrows-split'));
    titleRow.appendChild(this._el('h3', null, 'Traceability Conflict Studio'));
    titleRow.appendChild(this._el('span', 'qa-conflict-count', `${total} xung đột · ${bySpec.size} spec`));

    if (bySpec.size > 0) {
      const toggleAll = this._el('button', 'btn-secondary-sm qa-conflict-toggle-all');
      toggleAll.type = 'button';
      const allOpen = [...bySpec.keys()].every((k) => this._openGroups && this._openGroups.has(k));
      toggleAll.textContent = allOpen ? 'Thu gọn tất cả' : 'Mở tất cả';
      this._on(toggleAll, 'click', () => {
        const all = [...this._root.querySelectorAll('details.qa-conflict-group')];
        const open = !all.every((d) => d.open);
        all.forEach((d) => { d.open = open; });
        toggleAll.textContent = open ? 'Thu gọn tất cả' : 'Mở tất cả';
      });
      titleRow.appendChild(toggleAll);
    }
    head.appendChild(titleRow);

    head.appendChild(this._el('p', 'qa-conflict-studio-desc',
      'Spec (.spec.js) và tài liệu test-case (.md) khai AC khác nhau cho cùng một TC. So sánh hai phía, xem ngữ cảnh, rồi chọn cách hòa giải. Mọi thay đổi đều được sao lưu và kiểm chứng lại trước khi giữ.'));
    return head;
  }

  _renderGroup(specFile, conflicts) {
    const group = this._el('details', 'qa-conflict-group');
    group.open = this._openGroups.has(specFile);
    this._on(group, 'toggle', () => {
      if (group.open) this._openGroups.add(specFile);
      else this._openGroups.delete(specFile);
    });

    const summary = this._el('summary', 'qa-conflict-group-head');
    summary.appendChild(this._icon('ph-caret-right qa-conflict-caret'));
    summary.appendChild(this._icon('ph-file-js'));
    summary.appendChild(this._el('span', 'qa-conflict-group-file', specFile));
    summary.appendChild(this._el('span', 'qa-conflict-chip is-warn', `${conflicts.length} xung đột`));
    group.appendChild(summary);

    const body = this._el('div', 'qa-conflict-group-body');
    conflicts.forEach((c) => body.appendChild(this._renderCard(c)));
    group.appendChild(body);
    return group;
  }

  _renderPills(acs, diff, variant) {
    const wrap = this._el('div', 'qa-conflict-pills');
    acs.forEach((ac) => {
      const pill = this._el('span', `qa-conflict-pill ${variant}${diff.includes(ac) ? ' is-diff' : ''}`, ac);
      if (diff.includes(ac)) pill.title = variant === 'is-spec' ? 'Tài liệu không khai AC này' : 'Spec không gắn AC này';
      wrap.appendChild(pill);
    });
    return wrap;
  }

  _summaryText(c) {
    const parts = [];
    if (c.specOnly.length) parts.push(`Spec gắn ${list(c.specOnly)} nhưng tài liệu không khai`);
    if (c.docOnly.length) parts.push(`tài liệu khai ${list(c.docOnly)} nhưng spec không gắn`);
    const text = parts.join('; ');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Hai phía khai AC khác nhau';
  }

  _actionButton(label, icon, className, title) {
    const btn = this._el('button', className);
    btn.type = 'button';
    btn.dataset.conflictAction = '1';
    btn.title = title;
    btn.appendChild(this._icon(icon));
    btn.appendChild(this._el('span', null, label));
    return btn;
  }

  _renderCard(c) {
    const key = keyOf(c);
    const card = this._el('article', 'qa-conflict-card');
    card.dataset.conflictKey = key;
    card.dataset.conflictSig = signatureOf(c);

    const head = this._el('div', 'qa-conflict-card-head');
    head.appendChild(this._el('span', 'qa-conflict-tc', c.tcId));
    head.appendChild(this._el('span', 'qa-conflict-summary', this._summaryText(c)));
    const pending = this._pendingDecision(c);
    if (pending) {
      const badge = this._el('span', 'qa-conflict-chip is-info', `Đã ghi sổ ${pending.id}`);
      badge.title = 'Quyết định đang chờ PO / Tech Lead duyệt';
      head.appendChild(badge);
    }
    card.appendChild(head);

    const compare = this._el('div', 'qa-conflict-compare');
    const specSide = this._el('div', 'qa-conflict-side is-spec');
    specSide.appendChild(this._el('small', 'qa-conflict-side-label', 'Automation spec'));
    specSide.appendChild(this._renderPills(c.specAcs, c.specOnly, 'is-spec'));
    const mid = this._el('div', 'qa-conflict-mid');
    mid.appendChild(this._icon('ph-arrows-left-right'));
    mid.appendChild(this._el('span', null, 'Lệch'));
    const docSide = this._el('div', 'qa-conflict-side is-doc');
    docSide.appendChild(this._el('small', 'qa-conflict-side-label', 'Tài liệu test-case'));
    docSide.appendChild(this._renderPills(c.docAcs, c.docOnly, 'is-doc'));
    compare.append(specSide, mid, docSide);
    card.appendChild(compare);

    const actions = this._el('div', 'qa-conflict-actions');
    const btnDoc = this._actionButton(`Tài liệu theo Spec → ${list(c.specAcs)}`, 'ph-file-text', 'btn-secondary-sm',
      `Sửa dòng khai ${c.tcId} trong tài liệu thành ${list(c.specAcs)}`);
    this._on(btnDoc, 'click', () => this.executeResolve(c, 'sync_doc_to_spec'));

    const btnSpec = this._actionButton(`Spec theo Tài liệu → ${list(c.docAcs)}`, 'ph-code', 'btn-secondary-sm',
      `Sửa tag AC trong tiêu đề test ${c.tcId} thành ${list(c.docAcs)}`);
    this._on(btnSpec, 'click', () => this.executeResolve(c, 'sync_spec_to_doc'));

    const btnAi = this._actionButton('Trọng tài AI', 'ph-sparkle', 'qa-gap-ai-fix-btn',
      'Đọc assertion trong test và Given-When-Then của AC để đề xuất phía đúng');
    this._on(btnAi, 'click', () => this.runArbitration(c));

    const btnEsc = this._actionButton(pending ? `Đã ghi sổ ${pending.id}` : 'Ghi sổ quyết định', 'ph-scales',
      'btn-secondary-sm', 'Tạo quyết định chờ PO / Tech Lead duyệt trong sổ quyết định');
    if (pending) btnEsc.dataset.locked = '1';
    this._on(btnEsc, 'click', () => this.escalateDecision(c));

    const btnCtx = this._el('button', 'btn-secondary-sm qa-conflict-ctx-toggle');
    btnCtx.type = 'button';
    btnCtx.setAttribute('aria-expanded', 'false');
    btnCtx.appendChild(this._icon('ph-magnifying-glass'));
    btnCtx.appendChild(this._el('span', null, 'Xem ngữ cảnh'));
    this._on(btnCtx, 'click', () => this._toggleContext(card));

    actions.append(btnDoc, btnSpec, btnAi, btnEsc, btnCtx);
    card.appendChild(actions);

    const feedback = this._el('div', 'qa-conflict-feedback');
    feedback.setAttribute('role', 'status');
    feedback.hidden = true;
    card.appendChild(feedback);

    const verdictBox = this._el('div', 'qa-conflict-verdict');
    verdictBox.hidden = true;
    card.appendChild(verdictBox);

    const ctxBox = this._el('div', 'qa-conflict-context');
    ctxBox.hidden = true;
    card.appendChild(ctxBox);

    const cached = this._verdictCache.get(signatureOf(c));
    if (cached) this._renderVerdict(card, c, cached);

    if (pending) btnEsc.disabled = true;
    card._conflict = c;
    return card;
  }

  _renderUnparsed(items) {
    const box = this._el('div', 'qa-conflict-unparsed');
    box.appendChild(this._el('p', 'qa-conflict-side-label', 'Không bóc tách được — cần xử lý tay'));
    const ul = this._el('ul', 'qa-finding-list');
    items.forEach((item) => ul.appendChild(this._el('li', null, item.detail || item.id || '')));
    box.appendChild(ul);
    return box;
  }

  _feedback(card, message, level = 'error') {
    if (!card) return;
    const box = card.querySelector('.qa-conflict-feedback');
    if (!box) return;
    box.textContent = message || '';
    box.className = `qa-conflict-feedback is-${level}`;
    box.hidden = !message;
  }

  // -------------------------------------------------------------------------
  // Ngữ cảnh (BA)
  // -------------------------------------------------------------------------

  _toggleContext(card) {
    const key = card.dataset.conflictKey;
    const box = card.querySelector('.qa-conflict-context');
    if (!box.hidden) {
      box.hidden = true;
      this._openContexts.delete(key);
      card.querySelector('.qa-conflict-ctx-toggle').setAttribute('aria-expanded', 'false');
      return;
    }
    this._openContexts.add(key);
    this._showContext(card, true);
  }

  async _showContext(card) {
    const c = card._conflict;
    const key = card.dataset.conflictKey;
    const sig = card.dataset.conflictSig;
    const box = card.querySelector('.qa-conflict-context');
    box.hidden = false;
    card.querySelector('.qa-conflict-ctx-toggle').setAttribute('aria-expanded', 'true');

    const cached = this._contextCache.get(sig);
    if (cached) { this._renderContext(box, cached); return; }

    box.textContent = '';
    box.appendChild(this._el('p', 'qa-conflict-muted', 'Đang đọc spec, tài liệu và requirement…'));
    try {
      const ctx = await apiClient.get('/api/qa/conflict/context', { tcId: c.tcId, specFile: c.specFile });
      this._contextCache.set(sig, ctx);
      const live = this._cardFor(key);
      if (live && live.dataset.conflictSig === sig && this._openContexts.has(key)) {
        this._renderContext(live.querySelector('.qa-conflict-context'), ctx);
      }
    } catch (err) {
      const live = this._cardFor(key);
      const target = live && live.querySelector('.qa-conflict-context');
      if (!target) return;
      target.textContent = '';
      target.appendChild(this._el('p', 'qa-conflict-error', `Không tải được ngữ cảnh: ${err.message || 'lỗi mạng'}`));
    }
  }

  _renderContext(box, ctx) {
    box.textContent = '';
    const grid = this._el('div', 'qa-conflict-ctx-grid');

    const specCol = this._el('div', 'qa-conflict-ctx-col');
    specCol.appendChild(this._el('h5', null, 'Test trong spec'));
    if (!ctx.blocks.length) specCol.appendChild(this._el('p', 'qa-conflict-muted', 'Không tìm thấy test nào mang mã này.'));
    ctx.blocks.forEach((b) => {
      const meta = this._el('div', 'qa-conflict-ctx-meta');
      meta.appendChild(this._el('code', null, `${ctx.specFile}:${b.line}`));
      meta.appendChild(this._el('span', `qa-conflict-chip ${b.hasAssertion ? 'is-ok' : 'is-warn'}`,
        b.hasAssertion ? 'Có assertion' : 'Không có assertion'));
      specCol.appendChild(meta);
      const pre = this._el('pre', 'qa-conflict-code');
      pre.appendChild(this._el('code', null, b.snippet + (b.truncated ? '\n…' : '')));
      specCol.appendChild(pre);
    });

    const docCol = this._el('div', 'qa-conflict-ctx-col');
    docCol.appendChild(this._el('h5', null, 'Dòng khai trong tài liệu'));
    if (!ctx.docLocations.length) docCol.appendChild(this._el('p', 'qa-conflict-muted', 'Không tìm thấy dòng khai nào.'));
    ctx.docLocations.forEach((loc) => {
      const row = this._el('div', 'qa-conflict-doc-line');
      row.appendChild(this._el('code', null, `${loc.file}:${loc.line}`));
      row.appendChild(this._el('span', null, loc.text));
      docCol.appendChild(row);
    });
    if (ctx.docDetails && ctx.docDetails.steps && ctx.docDetails.steps.length) {
      docCol.appendChild(this._el('h5', null, 'Các bước trong tài liệu'));
      const ol = this._el('ol', 'qa-conflict-steps');
      ctx.docDetails.steps.forEach((s) => {
        const li = this._el('li');
        li.appendChild(this._el('span', null, s.action));
        if (s.expected) li.appendChild(this._el('span', 'qa-conflict-muted', ` → ${s.expected}`));
        ol.appendChild(li);
      });
      docCol.appendChild(ol);
    }
    grid.append(specCol, docCol);
    box.appendChild(grid);

    const defs = this._el('div', 'qa-conflict-defs');
    defs.appendChild(this._el('h5', null, 'Định nghĩa AC (requirements)'));
    [...new Set([...ctx.specAcs, ...ctx.docAcs])].forEach((ac) => {
      const d = ctx.acDefinitions[ac];
      const row = this._el('div', `qa-conflict-def${d ? '' : ' is-missing'}`);
      const side = ctx.specOnly.includes(ac) ? ' · chỉ spec' : ctx.docOnly.includes(ac) ? ' · chỉ tài liệu' : '';
      row.appendChild(this._el('strong', null, `${ac}${side}`));
      row.appendChild(this._el('span', null, d ? d.text : 'Không requirement nào định nghĩa AC này.'));
      if (d) row.appendChild(this._el('code', null, `${d.file}:${d.line}`));
      defs.appendChild(row);
    });
    box.appendChild(defs);
  }

  // -------------------------------------------------------------------------
  // Hành động
  // -------------------------------------------------------------------------

  async executeResolve(c, resolutionType) {
    if (this._busy) return;
    const key = keyOf(c);
    this._setBusy(true);
    this._feedback(this._cardFor(key), '');
    try {
      const res = await apiClient.post('/api/qa/conflict/resolve', { resolutionType, tcId: c.tcId, specFile: c.specFile });
      if (res.noop) toast.info(res.message);
      else toast.success(`${res.message}${res.backup ? ` Bản sao lưu: ${res.backup}` : ''}`);
      await this._reload();
    } catch (err) {
      const message = `Không hòa giải được: ${err.message || 'lỗi không rõ'}`;
      this._feedback(this._cardFor(key), message);
      toast.error(message);
    } finally {
      this._setBusy(false);
    }
  }

  async runArbitration(c) {
    if (this._busy) return;
    const key = keyOf(c);
    const sig = signatureOf(c);
    const card = this._cardFor(key);
    const box = card && card.querySelector('.qa-conflict-verdict');
    if (box) {
      box.hidden = false;
      box.textContent = '';
      box.appendChild(this._el('p', 'qa-conflict-muted', 'Trọng tài đang đọc assertion và Given-When-Then…'));
    }
    this._setBusy(true);
    try {
      const res = await apiClient.post('/api/qa/conflict/arbitrate', { tcId: c.tcId, specFile: c.specFile }, { timeout: AI_TIMEOUT_MS });
      this._verdictCache.set(sig, res);
      const live = this._cardFor(key);
      if (live && live.dataset.conflictSig === sig) this._renderVerdict(live, c, res);
    } catch (err) {
      const live = this._cardFor(key);
      const target = live && live.querySelector('.qa-conflict-verdict');
      if (target) {
        target.textContent = '';
        target.appendChild(this._el('p', 'qa-conflict-error', `Không phân xử được: ${err.message || 'lỗi mạng'}`));
      }
    } finally {
      this._setBusy(false);
    }
  }

  _renderVerdict(card, c, res) {
    const box = card.querySelector('.qa-conflict-verdict');
    if (!box) return;
    box.hidden = false;
    box.textContent = '';

    const toDoc = res.recommendation === 'sync_doc_to_spec';
    const top = this._el('div', 'qa-conflict-verdict-top');
    top.appendChild(this._el('span', 'qa-conflict-chip is-ok',
      toDoc ? `Đề xuất: tài liệu theo Spec → ${list(c.specAcs)}` : `Đề xuất: spec theo Tài liệu → ${list(c.docAcs)}`));
    const confidence = Number(res.confidence) || 0;
    top.appendChild(this._el('span', `qa-conflict-chip ${confidence >= 75 ? 'is-ok' : 'is-warn'}`, `Độ tin cậy ${confidence}%`));
    top.appendChild(this._el('span', 'qa-conflict-muted', res.engine === 'ai' ? `AI · ${res.engineNote || ''}` : (res.engineNote || 'Luật suy luận tĩnh')));
    box.appendChild(top);
    box.appendChild(this._el('p', 'qa-conflict-verdict-reason', res.reason || ''));

    const row = this._el('div', 'qa-conflict-actions');
    const apply = this._actionButton('Áp dụng đề xuất', 'ph-check', 'btn-primary-sm',
      'Thực hiện đúng phương án trọng tài đề xuất');
    this._on(apply, 'click', () => this.executeResolve(c, res.recommendation));
    row.appendChild(apply);
    if (confidence < 75) {
      row.appendChild(this._el('span', 'qa-conflict-muted', 'Độ tin cậy thấp — nên xem ngữ cảnh hoặc ghi sổ quyết định.'));
    }
    box.appendChild(row);
    if (this._busy) apply.disabled = true;
  }

  async escalateDecision(c) {
    if (this._busy || this._pendingDecision(c)) return;
    const key = keyOf(c);
    this._setBusy(true);
    this._feedback(this._cardFor(key), '');
    try {
      const res = await apiClient.post('/api/qa/conflict/escalate', { tcId: c.tcId, specFile: c.specFile });
      if (res.isDuplicate) toast.info(res.message);
      else toast.success(res.message);
      await this._reload();
    } catch (err) {
      const message = `Không ghi được sổ quyết định: ${err.message || 'lỗi không rõ'}`;
      this._feedback(this._cardFor(key), message);
      toast.error(message);
    } finally {
      this._setBusy(false);
    }
  }

  async _reload() {
    if (this.qaSlice && typeof this.qaSlice.reload === 'function') await this.qaSlice.reload();
  }
}
