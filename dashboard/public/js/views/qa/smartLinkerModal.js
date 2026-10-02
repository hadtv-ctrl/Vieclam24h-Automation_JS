/**
 * dashboard/public/js/views/qa/smartLinkerModal.js
 * Modal trực quan Smart Trace Linker (Plan 21 Phase 2 & 3):
 * Hỗ trợ 2 tab (Ghép có sẵn & Tạo mới) và chế độ Đồng bộ ngược (Reverse Sync).
 * Ngân sách dòng: <= 250 dòng.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

const MODAL_TEMPLATE = `<div class="smart-linker-head"><div class="smart-linker-title-group"><div class="smart-linker-eyebrow"><i class="ph-bold ph-sparkle"></i> Smart Trace Linker</div><h3 id="smart-linker-title" class="smart-linker-title">Phân tích & Ghép Requirement</h3><div class="smart-linker-spec-pill" id="smart-linker-spec-pill"><i class="ph-bold ph-file-code"></i> <span id="smart-linker-spec-text">---</span></div></div><button type="button" class="btn-icon-subtle" id="smart-linker-close-btn" title="Đóng modal (Esc)"><i class="ph-bold ph-x"></i></button></div><div class="smart-linker-tabs" role="tablist"><button type="button" class="smart-linker-tab is-active" id="smart-tab-existing" role="tab" aria-selected="true"><i class="ph-bold ph-link"></i> Ghép vào REQ có sẵn</button><button type="button" class="smart-linker-tab" id="smart-tab-new" role="tab" aria-selected="false"><i class="ph-bold ph-file-plus"></i> Tạo REQ mới</button></div><div class="smart-linker-body" id="smart-linker-body"><div class="smart-linker-tab-content" id="smart-content-existing"><div class="smart-linker-cards" id="smart-linker-candidates-list"></div></div><div class="smart-linker-tab-content" id="smart-content-new" style="display:none;"><div class="smart-linker-form"><div class="smart-linker-field"><label for="smart-new-req-id">Mã Requirement dự kiến:</label><input type="text" class="smart-linker-input" id="smart-new-req-id" readonly /></div><div class="smart-linker-field"><label for="smart-new-title">Tiêu đề Requirement:</label><input type="text" class="smart-linker-input" id="smart-new-title" placeholder="Nhập tiêu đề requirement..." /></div><div class="smart-linker-field"><label>Xem trước kịch bản / Tiêu chí Given/When/Then:</label><div class="smart-linker-diff-box" id="smart-new-preview-box"></div></div></div></div><div class="smart-linker-notice" id="smart-linker-notice" style="display:none;"><i class="ph-bold ph-info" id="smart-notice-icon"></i><span id="smart-notice-text"></span></div></div><div class="smart-linker-foot"><button type="button" class="btn-secondary-sm" id="smart-linker-cancel-btn">Hủy bỏ</button><div class="smart-linker-foot-actions"><button type="button" class="primary-button" id="smart-linker-apply-btn"><i class="ph-bold ph-check-circle"></i> <span>Xác nhận & Cập nhật</span></button></div></div>`;

export class SmartLinkerModal {
  constructor() {
    this.dialog = null;
    this.data = null;
    this.selectedReqId = null;
    this.activeTab = 'existing';
    this.onApplyCallback = null;
    this.disposers = [];
  }

  ensureMounted() {
    if (this.dialog && document.body.contains(this.dialog)) return this.dialog;
    let dialog = document.getElementById('qa-smart-linker-modal');
    if (!dialog) {
      dialog = el('dialog', 'qa-modal qa-smart-linker-modal');
      dialog.id = 'qa-smart-linker-modal';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'smart-linker-title');
      dialog.innerHTML = MODAL_TEMPLATE;
      document.body.appendChild(dialog);
    }
    this.dialog = dialog;
    this._bindEvents();
    return dialog;
  }

  _bindEvents() {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    const on = (sel, ev, fn) => {
      const elNode = this.dialog.querySelector(sel);
      if (elNode) { elNode.addEventListener(ev, fn); this.disposers.push(() => elNode.removeEventListener(ev, fn)); }
    };
    on('#smart-linker-close-btn', 'click', () => this.close());
    on('#smart-linker-cancel-btn', 'click', () => this.close());
    on('#smart-tab-existing', 'click', () => this.switchTab('existing'));
    on('#smart-tab-new', 'click', () => this.switchTab('new'));

    const onCancel = (e) => { e.preventDefault(); this.close(); };
    this.dialog.addEventListener('cancel', onCancel);
    this.disposers.push(() => this.dialog.removeEventListener('cancel', onCancel));

    on('#smart-linker-apply-btn', 'click', () => {
      if (this.onApplyCallback && !this.dialog.querySelector('#smart-linker-apply-btn').disabled) {
        this.onApplyCallback(this.getSelectedData());
      }
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    const isExist = tab === 'existing';
    const tE = this.dialog.querySelector('#smart-tab-existing');
    const tN = this.dialog.querySelector('#smart-tab-new');
    tE?.classList.toggle('is-active', isExist);
    tE?.setAttribute('aria-selected', isExist ? 'true' : 'false');
    tN?.classList.toggle('is-active', !isExist);
    tN?.setAttribute('aria-selected', isExist ? 'false' : 'true');
    const cE = this.dialog.querySelector('#smart-content-existing');
    const cN = this.dialog.querySelector('#smart-content-new');
    if (cE) cE.style.display = isExist ? 'flex' : 'none';
    if (cN) cN.style.display = isExist ? 'none' : 'flex';
  }

  render(data) {
    this.data = data;
    this.setNotice(null);
    this.setBusy(false);
    const specTextEl = this.dialog.querySelector('#smart-linker-spec-text');
    if (specTextEl) specTextEl.textContent = data.specPath || 'Chưa lưu';

    const titleEl = this.dialog.querySelector('#smart-linker-title');
    const tabExist = this.dialog.querySelector('#smart-tab-existing');
    const tabNew = this.dialog.querySelector('#smart-tab-new');

    if (data.mode === 'reverse_sync') {
      const delta = data.delta || {};
      const newTests = delta.newTests || [];
      if (titleEl) titleEl.textContent = `✦ Đồng bộ kịch bản vào ${delta.reqId || 'Requirement'}`;
      if (tabExist) tabExist.innerHTML = `<i class="ph-bold ph-arrows-clockwise"></i> Đồng bộ kịch bản mới (${newTests.length})`;
      if (tabNew) tabNew.style.display = 'none';
      this.switchTab('existing');
      this.renderReverseSync(delta);
      return;
    }

    if (titleEl) titleEl.textContent = 'Phân tích & Ghép Requirement';
    if (tabExist) tabExist.innerHTML = '<i class="ph-bold ph-link"></i> Ghép vào REQ có sẵn';
    if (tabNew) tabNew.style.display = '';

    const candidates = data.candidates || [];
    this.renderCandidates(candidates);

    const scaffold = data.newScaffold || {};
    const newReqIdInput = this.dialog.querySelector('#smart-new-req-id');
    const newTitleInput = this.dialog.querySelector('#smart-new-title');
    const newPreviewBox = this.dialog.querySelector('#smart-new-preview-box');

    if (newReqIdInput) newReqIdInput.value = scaffold.suggestedReqId || scaffold.nextReqId || 'REQ-001';
    if (newTitleInput) newTitleInput.value = scaffold.suggestedTitle || (data.intent?.describeTitle || '');
    if (newPreviewBox) {
      newPreviewBox.textContent = '';
      (scaffold.previewLines || []).forEach((line) => newPreviewBox.appendChild(el('div', 'smart-linker-diff-line-add', `+ ${line}`)));
    }
    this.switchTab(candidates.length > 0 && candidates[0].score >= 0.4 ? 'existing' : 'new');
  }

  renderReverseSync(delta) {
    const list = this.dialog.querySelector('#smart-linker-candidates-list');
    if (!list) return;
    list.textContent = '';
    const newTests = delta.newTests || [];
    if (!newTests.length) {
      list.appendChild(el('div', 'smart-linker-notice is-info', 'Tất cả kịch bản đã được đồng bộ đầy đủ trong tài liệu.'));
      this.setBusy(true, 'Đã đồng bộ đủ');
    } else {
      newTests.forEach((t) => {
        const card = el('div', 'smart-linker-card is-selected');
        const top = el('div', 'smart-linker-card-top');
        const meta = el('div', 'smart-linker-card-meta');
        meta.append(el('span', 'smart-linker-req-id', `${t.suggestedTcId} / ${t.suggestedAcId}`), el('span', 'smart-linker-req-title', ` — ${t.title}`));
        top.append(meta, el('span', 'smart-linker-badge is-new', 'Kịch bản mới'));
        card.appendChild(top);
        const diffBox = el('div', 'smart-linker-diff-box');
        diffBox.appendChild(el('div', 'smart-linker-diff-line-add', `+ ${t.suggestedAcId}: Given/When/Then cho "${t.title}"`));
        diffBox.appendChild(el('div', 'smart-linker-diff-line-add', `+ ${t.suggestedTcId} (Priority: ${t.priority || 'P1'})`));
        card.appendChild(diffBox);
        list.appendChild(card);
      });
      const applySpan = this.dialog.querySelector('#smart-linker-apply-btn span');
      if (applySpan) applySpan.textContent = `✦ Đồng bộ ${newTests.length} kịch bản vào ${delta.reqId}`;
    }
    if (delta.renamedWarnings && delta.renamedWarnings.length > 0) {
      this.setNotice(delta.renamedWarnings.map((w) => w.message).join(' | '), 'warning');
    }
  }

  renderCandidates(candidates) {
    const list = this.dialog.querySelector('#smart-linker-candidates-list');
    if (!list) return;
    list.textContent = '';
    if (!candidates.length) {
      list.appendChild(el('div', 'smart-linker-notice is-info', 'Chưa có Requirement nào khớp với kịch bản này. Bạn có thể Tạo REQ mới.'));
      return;
    }
    this.selectedReqId = candidates[0].reqId;
    candidates.forEach((cand, idx) => {
      const card = el('div', `smart-linker-card${idx === 0 ? ' is-selected' : ''}`);
      card.dataset.reqId = cand.reqId;
      const top = el('div', 'smart-linker-card-top');
      const meta = el('div', 'smart-linker-card-meta');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'smart-linker-req-radio';
      radio.className = 'smart-linker-card-radio';
      radio.checked = idx === 0;

      meta.append(radio, el('span', 'smart-linker-req-id', cand.reqId), el('span', 'smart-linker-req-title', ` — ${cand.title}`));
      const pct = Math.round((cand.score || 0) * 100);
      const isH = cand.matchLevel === 'high';
      const isP = cand.matchLevel === 'partial';
      top.append(meta, el('span', `smart-linker-badge ${isH ? 'is-high' : (isP ? 'is-partial' : 'is-new')}`, isH ? `${pct}% Khớp cao` : (isP ? `${pct}% Khớp tiềm năng` : 'Đề xuất mới')));
      card.appendChild(top);

      const prev = cand.preview;
      if (prev && ((prev.newAcLines && prev.newAcLines.length) || (prev.newTcRows && prev.newTcRows.length))) {
        const diffBox = el('div', 'smart-linker-diff-box');
        (prev.newAcLines || []).forEach((l) => diffBox.appendChild(el('div', 'smart-linker-diff-line-add', `+ ${l}`)));
        (prev.newTcRows || []).forEach((r) => diffBox.appendChild(el('div', 'smart-linker-diff-line-add', `+ ${r}`)));
        card.appendChild(diffBox);
      }
      card.addEventListener('click', () => {
        list.querySelectorAll('.smart-linker-card').forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        radio.checked = true;
        this.selectedReqId = cand.reqId;
      });
      list.appendChild(card);
    });
  }

  setNotice(message, type = 'info') {
    const noticeEl = this.dialog?.querySelector('#smart-linker-notice');
    const textEl = this.dialog?.querySelector('#smart-notice-text');
    if (!noticeEl || !textEl) return;
    if (!message) { noticeEl.style.display = 'none'; return; }
    noticeEl.className = `smart-linker-notice is-${type}`;
    textEl.textContent = message;
    noticeEl.style.display = 'flex';
  }

  setBusy(isBusy, text = 'Đang xử lý...') {
    const applyBtn = this.dialog?.querySelector('#smart-linker-apply-btn');
    if (!applyBtn) return;
    applyBtn.disabled = isBusy;
    const span = applyBtn.querySelector('span');
    if (span) span.textContent = isBusy ? text : 'Xác nhận & Cập nhật';
  }

  getSelectedData() {
    if (this.data?.mode === 'reverse_sync') return { mode: 'reverse_sync', targetReqId: this.data.delta?.reqId };
    if (this.activeTab === 'existing') return { mode: 'link_existing', targetReqId: this.selectedReqId };
    const newTitleInput = this.dialog.querySelector('#smart-new-title');
    return { mode: 'create_new', newReqData: { title: newTitleInput ? newTitleInput.value.trim() : '' } };
  }

  open(data, onApply) {
    this.ensureMounted();
    this.onApplyCallback = onApply;
    this.render(data);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector('#smart-linker-apply-btn')?.focus();
  }

  close() {
    if (this.dialog && this.dialog.open) this.dialog.close();
    this.data = null;
    this.onApplyCallback = null;
  }
}
