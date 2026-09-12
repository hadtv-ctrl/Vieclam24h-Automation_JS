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
    this._registerBridgeActions();
    if (typeof window.openDataManager === 'function') {
      try {
        await window.openDataManager();
        return;
      } catch (err) {
        console.warn('[DataSlice] openDataManager error:', err);
      }
    }
    this._bindDomEvents();
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
    // Tránh duplicate event listeners nếu app.js đã quản lý toàn diện Test Data Studio
    if (typeof window.openDataManager === 'function') {
      return;
    }
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
    if (typeof window.loadDataFilesList === 'function') {
      try {
        await window.loadDataFilesList();
        return;
      } catch (_) {}
    }
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
    this.currentFile = fileName;
    if (typeof window.legacySelectDataset === 'function') {
      try {
        await window.legacySelectDataset(fileName, true);
        return;
      } catch (err) {
        console.error('[DataSlice] legacySelectDataset error:', err);
      }
    } else if (typeof window.selectDataset === 'function' && window.selectDataset !== this.selectDataset) {
      try {
        await window.selectDataset(fileName, true);
        return;
      } catch (err) {
        console.error('[DataSlice] selectDataset error:', err);
      }
    }
    try {
      const res = await apiClient.get(`/api/data/dataset?file=${encodeURIComponent(fileName)}`);
      this.currentData = res.data ?? res;
      const rawText = res.raw || JSON.stringify(this.currentData, null, 2);
      editorSession.openFile(`data/${fileName}`, rawText);
      stateStore.setState({ data: { currentFile: fileName, currentData: this.currentData } }, 'dataSlice.selectDataset');
      this.renderFilesList();
      this.renderEditor(rawText);
    } catch (err) {
      console.error(`[DataSlice] Failed to load dataset ${fileName}:`, err);
    }
  }

  async saveDataset() {
    if (typeof window.legacySaveDataset === 'function') {
      try {
        await window.legacySaveDataset();
        return;
      } catch (err) {
        console.error('[DataSlice] legacySaveDataset error:', err);
      }
    } else if (typeof window.saveCurrentDataset === 'function' && window.saveCurrentDataset !== this.saveDataset) {
      try {
        await window.saveCurrentDataset();
        return;
      } catch (err) {
        console.error('[DataSlice] saveCurrentDataset error:', err);
      }
    }
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
    const btn = document.getElementById('data-delete-file-btn');
    if (btn) {
      btn.click();
      return;
    }
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
    if (typeof window.switchToDataInspectMode === 'function' && mode === 'inspect') {
      window.switchToDataInspectMode();
      return;
    }
    if (typeof window.switchToDataCreateMode === 'function' && mode === 'create') {
      window.switchToDataCreateMode();
      return;
    }
    const inspectBtn = document.getElementById('btn-tab-data-inspect');
    const createBtn = document.getElementById('btn-tab-data-create');
    const inspectView = document.getElementById('data-inspect-scroll-content');
    const createView = document.getElementById('data-create-scroll-content');
    const actions = document.getElementById('data-subnav-actions');
    if (inspectBtn) inspectBtn.classList.toggle('active', mode === 'inspect');
    if (createBtn) createBtn.classList.toggle('active', mode === 'create');
    if (inspectView) inspectView.style.display = mode === 'inspect' ? 'block' : 'none';
    if (createView) createView.style.display = mode === 'create' ? 'block' : 'none';
    if (actions) actions.style.display = mode === 'inspect' ? '' : 'none';
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
    if (typeof window.renderDataFilesList === 'function') {
      window.renderDataFilesList();
      return;
    }
  }

  renderEditor(content) {
    const textarea = document.getElementById('data-raw-editor') || document.getElementById('data-raw-json-editor') || document.getElementById('data-file-content');
    if (textarea) {
      textarea.value = content;
      editorSession.bindKeybindings(textarea, () => this.saveDataset());
    }
    if (typeof window.updateRawJsonPreview === 'function') {
      window.updateRawJsonPreview();
    }
  }

  copyJson() {
    const text = document.getElementById('data-raw-editor')?.value || editorSession.getBuffer();
    if (navigator.clipboard && text) {
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
