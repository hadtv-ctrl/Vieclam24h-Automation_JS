/**
 * dashboard/public/js/views/data/dataSlice.js
 * Test Data Studio Feature Slice (Phase 4.1). Budget <= 250 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';
import { editorSession } from '../../components/editor/editorSession.js';

export class DataSlice {
  constructor() {
    this.datasets = [];
    this.currentFile = null;
    this.currentData = null;
    this.subnavMode = 'inspect';
    this.searchQuery = '';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    if (typeof window.openDataManager === 'function') {
      try { await window.openDataManager(); } catch (_) {}
    }
    await this.loadDatasets();
    if (this.datasets.length > 0 && !this.currentFile) {
      await this.selectDataset(this.datasets[0].fileName);
    }
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('data-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };
    on('#btn-tab-data-inspect', 'click', () => this.switchSubnav('inspect'));
    on('#btn-tab-data-create', 'click', () => this.switchSubnav('create'));
    on('#data-save-btn', 'click', () => this.saveDataset());
    on('#data-delete-file-btn', 'click', () => this.deleteDataset());
    on('#data-copy-json-btn', 'click', () => this.copyJson());

    const searchInput = root.querySelector('#data-search-input');
    if (searchInput) {
      const h = (e) => { this.searchQuery = e.target.value.toLowerCase(); this.renderFilesList(); };
      searchInput.addEventListener('input', h);
      this._disposers.push(() => searchInput.removeEventListener('input', h));
    }
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectDataset', (file) => this.selectDataset(file));
    reg('saveCurrentDataset', () => this.saveDataset());
    reg('createNewDataset', (payload) => this.createDataset(payload));
  }

  async loadDatasets() {
    try {
      const res = await apiClient.get('/api/data/datasets');
      this.datasets = res.datasets || [];
      stateStore.setState({ data: { datasets: this.datasets } }, 'dataSlice.loadDatasets');
      this.renderStats();
      this.renderFilesList();
    } catch (err) {
      console.error('[DataSlice] Failed to load datasets:', err);
    }
  }

  async selectDataset(fileName) {
    if (!fileName) return;
    try {
      const res = await apiClient.get(`/api/data/dataset?file=${encodeURIComponent(fileName)}`);
      this.currentFile = fileName;
      this.currentData = res.data ?? res;
      const rawText = JSON.stringify(this.currentData, null, 2);
      editorSession.openFile(`data/${fileName}`, rawText);
      stateStore.setState({ data: { currentFile: fileName, currentData: this.currentData } }, 'dataSlice.selectDataset');
      this.renderFilesList();
      this.renderEditor(rawText);
    } catch (err) {
      console.error(`[DataSlice] Failed to load dataset ${fileName}:`, err);
    }
  }

  async saveDataset() {
    if (!this.currentFile) return;
    const content = editorSession.getBuffer();
    try {
      const parsed = JSON.parse(content);
      await apiClient.post('/api/data/dataset', { file: this.currentFile, data: parsed });
      this.currentData = parsed;
      await editorSession.save(async () => {});
      eventBus.emit('STUDIO_EVENTS:DATASET_UPDATED', {
        type: 'DATASET_UPDATED', version: 1, entityId: this.currentFile, source: 'dataSlice',
      });
      this.notify(`Đã lưu tệp ${this.currentFile} thành công.`);
    } catch (err) {
      console.error('[DataSlice] Save failed:', err);
      this.notify('Lỗi lưu dữ liệu: ' + (err.message || 'JSON không hợp lệ'));
    }
  }

  async createDataset({ fileName, templateType = 'array' } = {}) {
    const name = fileName || document.getElementById('create-dataset-filename')?.value?.trim();
    if (!name) return this.notify('Vui lòng nhập tên file dữ liệu.');
    const full = name.endsWith('.json') ? name : `${name}.json`;
    try {
      await apiClient.post('/api/data/create-dataset', { fileName: full, templateType });
      await this.loadDatasets();
      await this.selectDataset(full);
      this.switchSubnav('inspect');
      this.notify(`Đã tạo tệp ${full} thành công.`);
    } catch (err) {
      console.error('[DataSlice] Create failed:', err);
      this.notify('Lỗi tạo tệp dữ liệu: ' + err.message);
    }
  }

  async deleteDataset(fileName = this.currentFile) {
    if (!fileName) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa tệp dữ liệu "${fileName}"?`)) return;
    try {
      await apiClient.post('/api/data/delete-dataset', { fileName });
      this.currentFile = null;
      await this.loadDatasets();
      if (this.datasets.length > 0) await this.selectDataset(this.datasets[0].fileName);
      this.notify(`Đã xóa tệp ${fileName}.`);
    } catch (err) {
      console.error('[DataSlice] Delete failed:', err);
      this.notify('Lỗi xóa tệp: ' + err.message);
    }
  }

  switchSubnav(mode) {
    this.subnavMode = mode;
    const inspectBtn = document.getElementById('btn-tab-data-inspect');
    const createBtn = document.getElementById('btn-tab-data-create');
    const inspectPanel = document.getElementById('data-inspect-panel');
    const createPanel = document.getElementById('data-create-panel');
    const actions = document.getElementById('data-subnav-actions');
    if (inspectBtn) inspectBtn.classList.toggle('active', mode === 'inspect');
    if (createBtn) createBtn.classList.toggle('active', mode === 'create');
    if (inspectPanel) inspectPanel.style.display = mode === 'inspect' ? '' : 'none';
    if (createPanel) createPanel.style.display = mode === 'create' ? '' : 'none';
    if (actions) actions.style.display = mode === 'inspect' ? '' : 'none';
    this.renderFilesList();
  }

  renderStats() {
    const sFiles = document.getElementById('stat-data-files');
    const sRecs = document.getElementById('stat-data-records');
    const sSize = document.getElementById('stat-data-total-size');
    if (sFiles) sFiles.textContent = this.datasets.length;
    if (sRecs) sRecs.textContent = this.datasets.reduce((acc, d) => acc + (d.recordCount || 0), 0);
    if (sSize) {
      const bytes = this.datasets.reduce((acc, d) => acc + (d.size || 0), 0);
      sSize.textContent = `${(bytes / 1024).toFixed(1)} KB`;
    }
  }

  renderFilesList() {
    const container = document.getElementById('data-files-list');
    if (!container) return;
    const filtered = this.datasets.filter((ds) => !this.searchQuery || ds.fileName.toLowerCase().includes(this.searchQuery));
    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy tệp dữ liệu.</div>';
      return;
    }
    container.innerHTML = filtered.map((ds) => {
      const isSel = this.subnavMode === 'inspect' && this.currentFile === ds.fileName;
      return `
        <div class="dashboard-list-card data-file-card-item ${isSel ? 'is-selected active' : ''}" data-file="${ds.fileName}">
          <span class="dashboard-list-card__icon ${ds.isArray ? 'desktop' : 'api'}">
            <i class="ph-bold ${ds.isArray ? 'ph-rows' : 'ph-tree-structure'}"></i>
          </span>
          <div class="dashboard-list-card__body">
            <div class="script-card-title">${ds.fileName}</div>
            <div style="color: var(--muted); font-size: 11px; margin-top: 4px;">
              ${ds.recordCount || 0} ${ds.isArray ? 'dòng' : 'mục'} • ${(ds.size / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.data-file-card-item').forEach((card) => {
      card.addEventListener('click', () => {
        const file = card.dataset.file;
        if (file && file !== this.currentFile) this.selectDataset(file);
      });
    });
  }

  renderEditor(content) {
    const textarea = document.getElementById('data-raw-json-editor') || document.getElementById('data-file-content');
    if (textarea) {
      textarea.value = content;
      editorSession.bindKeybindings(textarea, () => this.saveDataset());
    }
  }

  copyJson() {
    const text = editorSession.getBuffer();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.notify('Đã sao chép JSON vào clipboard.');
    }
  }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }
}

export const dataSlice = new DataSlice();
