/**
 * dashboard/public/js/views/bdd/bddSlice.js
 * Visual BDD Scenario Editor & Compiler Feature Slice (Phase 4.5). Budget <= 200 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';
import { editorSession } from '../../components/editor/editorSession.js';

export class BddSlice {
  constructor() {
    this.scripts = [];
    this.currentScript = null;
    this.subnavMode = 'visual'; // 'visual' | 'code' | 'data'
    this.searchQuery = '';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    if (typeof window.initVisualBuilder === 'function') {
      try { await window.initVisualBuilder(); } catch (_) {}
    }
    await this.loadScripts();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('builder-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#bdd-search-input', 'input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase();
      this.renderScriptsList();
    });

    on('#btn-bdd-compile', 'click', () => this.compileScript());
    on('#btn-bdd-save', 'click', () => this.saveScript());
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectBddScript', (id) => this.selectScript(id));
    reg('compileBddScript', () => this.compileScript());
    reg('saveBddScript', () => this.saveScript());
  }

  async loadScripts() {
    const container = document.getElementById('bdd-scripts-list');
    if (container && this.scripts.length === 0) {
      container.innerHTML = '<p class="empty-resource">Đang tải kịch bản BDD...</p>';
    }
    try {
      const res = await apiClient.get('/api/builder/scripts');
      this.scripts = res?.scripts || [];
      stateStore.setState({ bdd: { scripts: this.scripts } }, 'bddSlice.loadScripts');
      this.renderScriptsList();
      if (this.scripts.length > 0 && !this.currentScript) {
        this.selectScript(this.scripts[0].id || this.scripts[0].fileName);
      }
    } catch (err) {
      console.error('[BddSlice] Failed to load scripts:', err);
    }
  }

  selectScript(scriptId) {
    if (!scriptId) return;
    const script = this.scripts.find((s) => (s.id || s.fileName) === scriptId);
    if (!script) return;
    this.currentScript = script;
    stateStore.setState({ bdd: { selected: scriptId } }, 'bddSlice.selectScript');
    this.renderScriptsList();
    this.renderScriptEditor(script);
  }

  renderScriptsList() {
    const container = document.getElementById('bdd-scripts-list');
    if (!container) return;

    const filtered = this.scripts.filter((s) => {
      if (!this.searchQuery) return true;
      const t = (s.scenarioName || s.title || s.fileName || '').toLowerCase();
      return t.includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy kịch bản BDD.</div>';
      return;
    }

    container.innerHTML = filtered.map((s) => {
      const sId = s.id || s.fileName;
      const isSel = (this.currentScript?.id || this.currentScript?.fileName) === sId;
      return `
        <div class="dashboard-list-card bdd-script-card ${isSel ? 'is-selected active' : ''}" data-id="${sId}">
          <span class="dashboard-list-card__icon"><i class="ph-bold ph-tree-structure"></i></span>
          <div class="dashboard-list-card__body">
            <div class="script-card-title">${s.scenarioName || s.title || s.fileName}</div>
            <small style="color: var(--muted); font-size: 11px;">${(s.steps || []).length} bước • ${s.fileName || sId}</small>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.bdd-script-card').forEach((card) => {
      card.addEventListener('click', () => this.selectScript(card.dataset.id));
    });
  }

  renderScriptEditor(script) {
    if (!script) return;
    const titleInput = document.getElementById('bdd-scenario-title-input');
    if (titleInput) titleInput.value = script.scenarioName || script.title || '';
    if (script.specCode) {
      editorSession.openFile(`bdd/${script.fileName}`, script.specCode);
    }
  }

  async compileScript() {
    if (!this.currentScript) return;
    try {
      const res = await apiClient.post('/api/builder/compile', {
        scriptId: this.currentScript.id || this.currentScript.fileName,
        steps: this.currentScript.steps || [],
      });
      this.notify('Biên dịch kịch bản BDD thành công!');
      return res;
    } catch (err) {
      console.error('[BddSlice] Compile failed:', err);
      this.notify('Lỗi biên dịch BDD: ' + err.message);
    }
  }

  async saveScript() {
    if (!this.currentScript) return;
    try {
      await apiClient.post('/api/builder/save', {
        script: this.currentScript,
      });
      this.notify(`Đã lưu kịch bản ${this.currentScript.fileName || ''} thành công.`);
    } catch (err) {
      console.error('[BddSlice] Save failed:', err);
      this.notify('Lỗi lưu kịch bản: ' + err.message);
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

export const bddSlice = new BddSlice();
