/**
 * vnDataGeneratorModal.js - Controller modal sinh du lieu VN & Payload bien.
 * Tran so dong <= 150, sequence counter chong late response, dirty guard (UI-05).
 */

import { renderOptions, renderPreviewTable, renderPayloadTable } from './vnDataPreview.js';

export class VnDataGeneratorModal {
  constructor() {
    this.alive = true; this.seq = 0; this.dirty = false;
    this.currentRecords = []; this.currentType = 'persona';
    this.abortController = null; this.cleanupFns = [];
  }

  init(root = document) {
    this.root = root;
    this.modal = root.querySelector('#data-vn-gen-modal');
    this.confirmDialog = root.querySelector('#data-vn-confirm');
    const openBtn = root.querySelector('#data-vn-gen-open-btn');
    if (!this.modal || !openBtn) return;

    this.bind(openBtn, 'click', () => this.open());
    this.bind(root.querySelector('#data-vn-close-btn'), 'click', () => this.handleRequestClose());
    this.bind(root.querySelector('#data-vn-close-top-btn'), 'click', () => this.handleRequestClose());
    this.modal.addEventListener('cancel', (e) => { e.preventDefault(); this.handleRequestClose(); });
    this.bind(root.querySelector('#data-vn-confirm-stay-btn'), 'click', () => this.confirmDialog?.close());
    this.bind(root.querySelector('#data-vn-confirm-leave-btn'), 'click', () => { this.confirmDialog?.close(); this.dirty = false; this.modal.close(); });

    const typeSel = root.querySelector('#data-vn-type');
    if (typeSel) {
      this.bind(typeSel, 'change', (e) => {
        this.currentType = e.target.value;
        renderOptions(root.querySelector('#data-vn-dynamic-options'), this.currentType);
      });
      renderOptions(root.querySelector('#data-vn-dynamic-options'), this.currentType);
    }

    this.bind(root.querySelector('#data-vn-tab-identity'), 'click', () => this.switchTab('identity'));
    this.bind(root.querySelector('#data-vn-tab-payload'), 'click', () => this.switchTab('payload'));
    this.bind(root.querySelector('#data-vn-payload-category'), 'change', (e) => this.loadPayloads(e.target.value));
    this.bind(root.querySelector('#data-vn-generate-btn'), 'click', () => this.generate());
    this.bind(root.querySelector('#data-vn-save-btn'), 'click', () => this.saveDataset());
    this.bind(root.querySelector('#data-vn-copy-btn'), 'click', () => this.copyJson());
  }

  bind(el, evt, fn) {
    if (!el) return;
    el.addEventListener(evt, fn);
    this.cleanupFns.push(() => el.removeEventListener(evt, fn));
  }

  open() { this.modal.showModal(); this.root.querySelector('#data-vn-gen-title')?.focus(); }

  handleRequestClose() {
    if (this.dirty && this.currentRecords.length > 0) this.confirmDialog?.showModal();
    else this.modal.close();
  }

  switchTab(mode) {
    const isId = mode === 'identity';
    const [tId, tPay] = [this.root.querySelector('#data-vn-tab-identity'), this.root.querySelector('#data-vn-tab-payload')];
    const [pId, pPay] = [this.root.querySelector('#data-vn-panel-identity'), this.root.querySelector('#data-vn-panel-payload')];
    tId?.classList.toggle('active', isId); tId?.setAttribute('aria-selected', String(isId));
    tPay?.classList.toggle('active', !isId); tPay?.setAttribute('aria-selected', String(!isId));
    if (pId) pId.style.display = isId ? 'flex' : 'none';
    if (pPay) pPay.style.display = isId ? 'none' : 'flex';
    if (!isId) this.loadPayloads(this.root.querySelector('#data-vn-payload-category')?.value || 'all');
  }

  async generate() {
    const seq = ++this.seq;
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    const count = Number(this.root.querySelector('#data-vn-count')?.value || 10);
    const seed = this.root.querySelector('#data-vn-seed')?.value.trim();
    const options = {
      gender: this.root.querySelector('#data-vn-gender')?.value, carrier: this.root.querySelector('#data-vn-carrier')?.value,
      mstKind: this.root.querySelector('#data-vn-mst-kind')?.value, diacritics: this.root.querySelector('#data-vn-diacritics')?.value === 'true',
      birthYear: this.root.querySelector('#data-vn-birthyear')?.value || undefined
    };

    const alertEl = this.root.querySelector('#data-vn-alert');
    alertEl.style.display = 'none';
    try {
      const res = await fetch('/api/data/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: this.currentType, count, seed: seed || undefined, options }), signal: this.abortController.signal
      });
      const data = await res.json();
      if (!this.alive || seq !== this.seq) return;
      if (!res.ok) { alertEl.textContent = data.error || 'Lỗi sinh dữ liệu'; alertEl.style.display = 'block'; return; }
      this.currentRecords = data.records; this.dirty = true;
      this.root.querySelector('#data-vn-status-badge').style.display = 'inline-block';
      this.root.querySelector('#data-vn-seed-display').textContent = `Seed: ${data.seed}`;
      this.root.querySelector('#data-vn-preview-count').textContent = String(data.records.length);
      renderPreviewTable(this.root.querySelector('#data-vn-preview'), this.currentType, data.records);
    } catch (err) {
      if (err.name === 'AbortError') return;
      alertEl.textContent = err.message; alertEl.style.display = 'block';
    }
  }

  async saveDataset() {
    let fileName = (this.root.querySelector('#data-vn-filename')?.value || '').trim();
    if (!fileName) fileName = `dataset_${this.currentType}_${Date.now()}.json`;
    if (!fileName.endsWith('.json')) fileName += '.json';
    const saveBtn = this.root.querySelector('#data-vn-save-btn');
    saveBtn.disabled = true;
    try {
      const res = await fetch('/api/data/create-dataset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, content: this.currentRecords })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tạo dataset');
      this.dirty = false;
      this.root.querySelector('#data-vn-status-badge').style.display = 'none';
      window.dispatchEvent?.(new CustomEvent('dataset:created', { detail: { fileName } }));
      this.modal.close();
    } catch (err) {
      const alertEl = this.root.querySelector('#data-vn-alert');
      alertEl.textContent = err.message; alertEl.style.display = 'block';
    } finally { saveBtn.disabled = false; }
  }

  async copyJson() {
    if (!this.currentRecords.length) return;
    await navigator.clipboard.writeText(JSON.stringify(this.currentRecords, null, 2));
    this.dirty = false; this.root.querySelector('#data-vn-status-badge').style.display = 'none';
  }

  async loadPayloads(category) {
    const res = await fetch(`/api/data/payloads?category=${encodeURIComponent(category)}`);
    if (!res.ok) return;
    const data = await res.json();
    renderPayloadTable(this.root.querySelector('#data-vn-payload-table-container'), data.payloads, (val, btn) => {
      navigator.clipboard.writeText(val);
      btn.textContent = 'Đã chép!';
      setTimeout(() => { btn.textContent = 'Sao chép'; }, 1500);
    });
  }

  destroy() {
    this.alive = false;
    if (this.abortController) this.abortController.abort();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}
