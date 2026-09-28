/**
 * dashboard/public/js/views/qa/batch/batchController.js
 * Điều phối sửa static finding (PLAN-18): danh sách + selection + toolbar, mở modal xem trước,
 * modal chi tiết, thanh kết quả. Listener gắn qua delegation và gỡ ở destroy(); phản hồi đến sau
 * khi view đã unmount hoặc đã có yêu cầu mới thì bị bỏ qua (OWN-05, ASYNC-03).
 */

import { apiClient } from '../../../core/apiClient.js';
import { SelectionModel } from './selectionModel.js';
import { countByGroup, filterFindings, isSelectable, renderFindingRows } from './findingRows.js';
import { updateToolbar } from './batchToolbar.js';
import { BatchPreviewModal } from './batchPreviewModal.js';
import { BatchResultBar } from './batchResultBar.js';
import { FindingDetailModal } from './findingDetailModal.js';
import { applyPlan, changeInput, fileOf, rescanStats, undoBatch } from './batchFlows.js';

export class BatchController {
  constructor(slice) {
    this.slice = slice;
    this.selection = new SelectionModel();
    this.findings = [];
    this.filter = 'all';
    this.newKeys = new Set();
    this.busy = '';
    this.scanPending = true;
    this.scanId = null;
    this.latest = null;
    this.notice = '';
    this.pending = null;
    this.lastApplied = null;
    this.seq = 0;
    this.latestSeq = 0;
    this.alive = false;
    this.disposers = [];
  }

  init(root) {
    this.destroy();
    if (!root || !root.querySelector('#qa-batch-toolbar')) return;
    this.root = root;
    this.alive = true;
    this.busy = '';
    this.modal = new BatchPreviewModal(root, root.querySelector('#qa-batch-confirm'), {
      onApply: (keys) => applyPlan(this, keys),
      onInput: (key, input) => changeInput(this, key, input),
      onReplan: (keys) => this.preview(keys),
      onNextAction: (type, key, target) => { this.modal.close(); this.runAction(type, key, target); },
      onClosed: () => { this.busy = ''; this.refresh(); },
    });
    this.result = new BatchResultBar(root, {
      onUndo: () => undoBatch(this, (this.lastApplied && this.lastApplied.sessionId) || (this.latest && this.latest.sessionId)),
      onShowNew: () => { this.filter = 'new'; this.refresh(); },
      onHidden: () => this.refresh(),
    });
    this.detail = new FindingDetailModal(root, { onFix: (key) => this.preview([key]) });
    const on = (target, evt, fn) => {
      if (!target) return;
      target.addEventListener(evt, fn);
      this.disposers.push(() => target.removeEventListener(evt, fn));
    };
    const list = root.querySelector('#qa-static-gaps-list');
    const bar = root.querySelector('#qa-batch-toolbar');
    on(list, 'change', (e) => {
      if (!e.target.matches('.qa-finding-checkbox')) return;
      this.selection.toggle(e.target.dataset.findingKey, e.target.checked);
      this.refresh(false);
    });
    on(list, 'click', (e) => {
      const btn = e.target.closest('[data-finding-action]');
      if (btn && !btn.disabled) this.runAction(btn.dataset.findingAction, btn.dataset.findingKey);
    });
    on(bar, 'change', (e) => {
      if (e.target.id !== 'qa-batch-master') return;
      this.selection.toggleVisible(this._visibleKeys());
      this.refresh();
    });
    on(bar, 'click', (e) => this._onToolbarClick(e));
    // Giữ đúng instance của lần init này: disposer cũ chạy muộn không được huỷ component của lần init sau.
    const { modal, result, detail } = this;
    this.disposers.push(() => { modal.destroy(); result.destroy(); detail.destroy(); });
    this.loadLatest();
  }

  destroy() {
    this.alive = false;
    this.seq += 1;
    this.latestSeq += 1;
    this.disposers.forEach((dispose) => { try { dispose(); } catch (_) { /* đã gỡ */ } });
    this.disposers = [];
  }

  /** Số listener đang giữ — cho test vòng đời (OWN-04). */
  get listenerCount() {
    return this.disposers.length;
  }

  _onToolbarClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.batchFilter) this.filter = btn.dataset.batchFilter;
    else if (btn.id === 'qa-batch-hidden') this.filter = 'all';
    else if (btn.id === 'qa-batch-clear') this.selection.clear();
    else if (btn.id === 'qa-batch-preview') {
      this.preview(this.selection.keys());
      return;
    } else if (btn.id === 'qa-batch-undo-last') {
      undoBatch(this, this.latest && this.latest.sessionId);
      return;
    } else return;
    this.refresh();
  }

  get locked() {
    return this.scanPending || Boolean(this.busy);
  }

  /** Thanh kết quả đang mở: card phải còn hiện dù đã hết lỗi, để người dùng còn nút Hoàn tác. */
  get hasActiveResult() {
    return Boolean(this.result && this.result.visible);
  }

  setScanPending(pending) {
    this.scanPending = pending;
    this.refresh();
  }

  /** Gọi từ qaSlice.renderFindings mỗi khi có (hoặc chưa có) summary. */
  render(summary) {
    if (!this.alive) return;
    if (summary && Array.isArray(summary.findings) && summary.scanId !== this.scanId) {
      this.findings = summary.findings.filter((f) => f.findingKey);
      const pruned = this.scanId === null ? 0 : this.selection.prune(this.findings.map((f) => f.findingKey));
      this.notice = pruned ? `${pruned} mục đã chọn không còn trong kết quả quét mới.` : '';
      this.scanId = summary.scanId;
      if (this.pending && summary.scanId > this.pending.scanId) {
        const stats = rescanStats(this.pending, this.findings);
        this.pending = null;
        this.newKeys = stats.newKeys;
        this.result.showRescan(stats);
      }
    }
    this.refresh();
  }

  refresh(redrawList = true) {
    if (!this.alive || !this.root) return;
    const list = this.root.querySelector('#qa-static-gaps-list');
    const visible = filterFindings(this.findings, this.filter, this.newKeys);
    if (redrawList && list) renderFindingRows(list, visible, { selection: this.selection, locked: this.locked });
    updateToolbar(this.root, {
      counts: countByGroup(this.findings),
      filter: this.filter,
      newCount: this.newKeys.size,
      visibleKeys: this._visibleKeys(visible),
      selection: this.selection,
      locked: this.locked,
      statusText: this.busy || (this.scanPending ? 'Đang quét lại…' : ''),
      canUndoLast: Boolean(this.latest && this.latest.status === 'COMMITTED' && !(this.result && this.result.visible)),
      notice: this.notice,
      hasSelectable: this.findings.some(isSelectable),
    });
  }

  _visibleKeys(visible = filterFindings(this.findings, this.filter, this.newKeys)) {
    return visible.filter(isSelectable).map((f) => f.findingKey);
  }

  runAction(action, key, target) {
    const finding = this.findings.find((f) => f.findingKey === key);
    if (action === 'fix') this.preview([key]);
    else if (action === 'detail' && finding) this.detail.open(finding);
    else if (action === 'scaffold') this.slice.openScaffoldModal();
    else if (action === 'autofix') this.slice.openAutoFixModal();
    else if (action === 'openDoc') {
      const first = String((finding && finding.where) || '').split(',')[0].replace(/\s*\(.*$/, '').trim();
      this.slice.switchTab('docs');
      this.slice.openDocument(target || fileOf(first));
    }
  }

  async preview(keys) {
    if (!keys.length || this.scanPending) return;
    const seq = ++this.seq;
    this.busy = 'Đang lập kế hoạch sửa…';
    this.refresh();
    try {
      const plan = await apiClient.post('/api/qa/finding/batch-plan', { findingKeys: keys });
      if (!this.alive || seq !== this.seq) return;
      this.busy = 'Đang xem trước bản vá…';
      this.modal.open(plan);
    } catch (err) {
      if (!this.alive || seq !== this.seq) return;
      this.busy = '';
      this.slice.notify(`Không lập được kế hoạch sửa: ${err.message}`);
    }
    this.refresh();
  }

  async loadLatest() {
    const seq = ++this.latestSeq;
    try {
      const res = await apiClient.get('/api/qa/finding/batch-last');
      if (!this.alive || seq !== this.latestSeq) return;
      this.latest = res.latest;
      if (res.recovered && res.recovered.length) {
        this.notice = `Đã khôi phục ${res.recovered.length} batch bị dừng giữa chừng về nguyên trạng.`;
      }
      this.refresh(false);
    } catch (_) { /* server cũ chưa có API batch: toolbar chỉ ẩn nút hoàn tác */ }
  }
}
