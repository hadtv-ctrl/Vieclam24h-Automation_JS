/**
 * dashboard/public/js/views/qa/batch/batchPreviewModal.js
 * Modal xem trước bản vá (PLAN-18 mục 6.3): giữ trạng thái tick / thu gọn, khoá khi đang áp
 * dụng, hỏi trước khi đóng nếu còn lựa chọn chưa áp dụng. Không gọi API — mọi thao tác đi qua
 * callbacks của controller; phần dựng DOM nằm ở batchPreviewRender.js.
 */

import { confirmDialog } from './batchConfirm.js';
import { renderSkippedItems, renderPlanCard } from './batchPreviewRender.js';

export class BatchPreviewModal {
  constructor(root, confirmEl, callbacks) {
    this.dialog = root.querySelector('#qa-batch-modal');
    this.confirmEl = confirmEl;
    this.callbacks = callbacks;
    this.plan = null;
    this.ticked = new Set();
    this.expanded = new Set();
    this.collapsed = new Set();
    this.dirty = false;
    this.busy = false;
    this.disposers = [];
    if (!this.dialog) return;
    const on = (target, evt, fn) => {
      target.addEventListener(evt, fn);
      this.disposers.push(() => target.removeEventListener(evt, fn));
    };
    on(this.dialog, 'change', (event) => this._onChange(event));
    on(this.dialog, 'click', (event) => this._onClick(event));
    on(this.dialog, 'cancel', (event) => { event.preventDefault(); this.requestClose(); });
  }

  destroy() {
    // Idempotent: gọi lần hai (disposer cũ chạy muộn) không được đóng dialog mà instance mới đang mở.
    if (this.disposed) return;
    this.disposed = true;
    this.disposers.forEach((dispose) => { try { dispose(); } catch (_) { /* đã gỡ */ } });
    this.disposers = [];
    if (this.dialog && this.dialog.open) this.dialog.close();
    this.plan = null;
  }

  open(plan) {
    if (!this.dialog) return;
    this.plan = plan;
    this.ticked = new Set(plan.cards.flatMap((c) => c.patches.filter((p) => p.defaultSelected).map((p) => p.findingKey)));
    this.expanded = new Set();
    this.collapsed = new Set();
    this.dirty = false;
    this.setBusy(false);
    this.showError(null);
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector('#qa-batch-modal-title')?.focus();
  }

  close() {
    if (this.dialog && this.dialog.open) this.dialog.close();
    this.plan = null;
    this.callbacks.onClosed?.();
  }

  async requestClose() {
    if (this.busy) return;
    if (this.dirty && !(await confirmDialog(this.confirmEl, {
      title: 'Bỏ các lựa chọn đã thay đổi?',
      message: 'Bạn đã bỏ tick hoặc đổi cách xử lý một số bản vá. Đóng lại sẽ bỏ các thay đổi này.',
      confirmText: 'Bỏ và đóng',
      cancelText: 'Ở lại',
    }))) return;
    this.close();
  }

  /** Cập nhật hoặc thêm thẻ file sau batch-input (chọn AC có thể thêm thẻ file test-cases). */
  updateCards(cards, revision, tickKey) {
    if (!this.plan) return;
    this.plan.session.revision = revision;
    cards.forEach((card) => {
      const i = this.plan.cards.findIndex((c) => c.relPath === card.relPath);
      if (i >= 0) this.plan.cards[i] = card;
      else this.plan.cards.push(card);
    });
    const keys = new Set(this.plan.cards.flatMap((c) => c.patches.map((p) => p.findingKey)));
    this.plan.totals = { ...this.plan.totals, patches: keys.size, files: this.plan.cards.length };
    // Chọn AC là một quyết định tường minh của người dùng: tick luôn bản vá đó.
    if (tickKey) this.ticked.add(tickKey);
    this.render();
  }

  setBusy(busy, label) {
    this.busy = busy;
    if (!this.dialog) return;
    this.dialog.classList.toggle('is-busy', busy);
    this.dialog.setAttribute('aria-busy', String(busy));
    this.dialog.querySelectorAll('input, select, #qa-batch-modal-cancel, #qa-batch-modal-close').forEach((node) => { node.disabled = busy; });
    this._syncApply(label);
  }

  /** error = null | { message, files?, retry?: 'replan' | 'apply' } */
  showError(error) {
    const box = this.dialog?.querySelector('#qa-batch-modal-error');
    if (!box) return;
    box.textContent = '';
    box.hidden = !error;
    if (!error) return;
    const text = document.createElement('p');
    text.textContent = error.message;
    box.append(text);
    if (error.files && error.files.length) {
      const ul = document.createElement('ul');
      error.files.forEach((f) => {
        const li = document.createElement('li');
        li.textContent = f;
        ul.append(li);
      });
      box.append(ul);
    }
    if (error.retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary-sm';
      btn.textContent = error.retry === 'replan' ? 'Lập lại kế hoạch' : 'Thử lại';
      btn.dataset.batchRetry = error.retry;
      box.append(btn);
    }
  }

  render() {
    if (!this.dialog || !this.plan) return;
    const { cards, skipped, totals } = this.plan;
    const summary = this.dialog.querySelector('#qa-batch-modal-summary');
    if (summary) summary.textContent = `${totals.patches} bản vá · ${totals.files} file · ${skipped.length} bỏ qua`;
    const skippedBox = this.dialog.querySelector('#qa-batch-skipped');
    if (skippedBox) {
      skippedBox.hidden = skipped.length === 0;
      this.dialog.querySelector('#qa-batch-skipped-summary').textContent = `${skipped.length} mục bị bỏ qua`;
      renderSkippedItems(this.dialog.querySelector('#qa-batch-skipped-list'), skipped);
    }
    const list = this.dialog.querySelector('#qa-batch-cards');
    list.textContent = '';
    const collapseByDefault = cards.length > 5;
    cards.forEach((card) => {
      const expanded = this.expanded.has(card.relPath) || (!collapseByDefault && !this.collapsed.has(card.relPath));
      list.append(renderPlanCard(card, { ticked: this.ticked, expanded }));
    });
    const empty = this.dialog.querySelector('#qa-batch-empty');
    if (empty) empty.hidden = cards.length > 0;
    this._syncApply();
  }

  _onChange(event) {
    const { target } = event;
    const set = (keys, on) => keys.forEach((key) => (on ? this.ticked.add(key) : this.ticked.delete(key)));
    if (target.dataset.patchKeys) set(target.dataset.patchKeys.split(','), target.checked);
    else if (target.dataset.batchFile) {
      const card = this.plan.cards.find((c) => c.relPath === target.dataset.batchFile);
      set(card.patches.filter((p) => !p.needsInput).map((p) => p.findingKey), target.checked);
    } else if (target.dataset.skipKey) {
      this.dirty = true;
      this.callbacks.onInput(target.dataset.skipKey, { skipMode: target.value });
      return;
    } else if (target.dataset.acKey) {
      if (!target.value) return;
      this.dirty = true;
      this.callbacks.onInput(target.dataset.acKey, { acId: target.value });
      return;
    } else return;
    this.dirty = true;
    this.render();
  }

  _onClick(event) {
    const btn = event.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.cardToggle) {
      const rel = btn.dataset.cardToggle;
      const open = btn.getAttribute('aria-expanded') === 'true';
      (open ? this.collapsed : this.expanded).add(rel);
      (open ? this.expanded : this.collapsed).delete(rel);
      this.render();
    } else if (btn.id === 'qa-batch-modal-apply') this.callbacks.onApply([...this.ticked]);
    else if (btn.id === 'qa-batch-modal-cancel' || btn.id === 'qa-batch-modal-close') this.requestClose();
    else if (btn.dataset.batchRetry === 'replan') this.callbacks.onReplan([...this.ticked]);
    else if (btn.dataset.batchRetry === 'apply') this.callbacks.onApply([...this.ticked]);
    else if (btn.dataset.batchNext) this.callbacks.onNextAction(btn.dataset.batchNext, btn.dataset.findingKey, btn.dataset.target);
  }

  _syncApply(label) {
    const apply = this.dialog?.querySelector('#qa-batch-modal-apply');
    if (!apply || !this.plan) return;
    const files = this.plan.cards.filter((c) => c.patches.some((p) => this.ticked.has(p.findingKey))).length;
    apply.disabled = this.busy || this.ticked.size === 0;
    apply.textContent = label || `Áp dụng ${this.ticked.size} bản vá (${files} file)`;
  }
}
