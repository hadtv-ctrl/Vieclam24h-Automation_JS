/**
 * dashboard/public/js/views/suites/suitesSlice.js
 * Test Suites Feature Slice (Phase 4.2). Budget <= 200 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class SuitesSlice {
  constructor() {
    this.suites = {};
    this.selectedSuiteId = null;
    this.filter = 'all';
    this.searchQuery = '';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    if (typeof window.openSuitesManager === 'function') {
      try { await window.openSuitesManager(); } catch (_) {}
    }
    this._bindDomEvents();
    this._registerBridgeActions();
    await this.loadSuites();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('suites-view');
    if (!root) return;

    // Tránh duplicate event listeners nếu app.js đã gắn listener quản lý toàn diện suites view
    if (typeof window.initSuitesView === 'function' || typeof window.openSuitesManager === 'function') {
      return;
    }

    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#suites-search-input', 'input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase();
      this.renderSuitesList();
    });

    on('#suites-refresh-btn', 'click', () => {
      this.loadSuites();
      this.notify('Đã làm mới danh sách Test Suites.');
    });

    on('#suites-subnav-create', 'click', () => {
      if (typeof window.createNewSuite === 'function') {
        return window.createNewSuite();
      }
      this.createSuite();
    });
    on('#suites-subnav-delete-btn', 'click', () => {
      if (typeof window.deleteCurrentSuite === 'function') {
        return window.deleteCurrentSuite();
      }
      this.deleteSuite();
    });

    // Filter pills
    root.querySelectorAll('.suite-filter-pill').forEach((pill) => {
      const h = () => {
        root.querySelectorAll('.suite-filter-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.filter = pill.dataset.filter || 'all';
        this.renderSuitesList();
      };
      pill.addEventListener('click', h);
      this._disposers.push(() => pill.removeEventListener('click', h));
    });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectSuite', (id) => this.selectSuite(id));
    reg('createSuite', () => {
      if (typeof window.createNewSuite === 'function') {
        return window.createNewSuite();
      }
      return this.createSuite();
    });
    reg('deleteCurrentSuite', () => {
      if (typeof window.deleteCurrentSuite === 'function') {
        return window.deleteCurrentSuite();
      }
      return this.deleteSuite();
    });
  }

  async loadSuites() {
    try {
      const res = await apiClient.get('/api/config');
      this.suites = res?.suites || res?.features?.suites || {};
      stateStore.setState({ suites: { items: this.suites } }, 'suitesSlice.loadSuites');
      const keys = Object.keys(this.suites);
      if (keys.length > 0 && !this.selectedSuiteId) {
        this.selectedSuiteId = keys[0];
        stateStore.setState({ suites: { selected: keys[0] } }, 'suitesSlice.loadSuites');
      }
      if (typeof window._legacySelectSuite !== 'function') {
        this.renderSuitesList();
      }
    } catch (err) {
      console.error('[SuitesSlice] Failed to load suites:', err);
    }
  }

  selectSuite(suiteId) {
    if (!suiteId) return;
    this.selectedSuiteId = suiteId;
    stateStore.setState({ suites: { selected: suiteId } }, 'suitesSlice.selectSuite');
    if (typeof window._legacySelectSuite === 'function') {
      window._legacySelectSuite(suiteId);
    } else {
      this.renderSuitesList();
      this.renderSuiteDetails(this.suites[suiteId]);
    }
  }


  createSuite() {
    if (typeof window.createNewSuite === 'function') {
      return window.createNewSuite();
    }
    const newId = `suite-${Date.now().toString(36)}`;
    this.suites[newId] = {
      label: 'Kịch bản mới',
      description: '',
      type: 'single',
      platform: 'desktop',
      workers: 2,
    };
    this.selectSuite(newId);
    this.notify('Đã tạo kịch bản Test Suite mới.');
  }

  deleteSuite(suiteId = this.selectedSuiteId) {
    if (!suiteId) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa Test Suite "${suiteId}"?`)) return;
    delete this.suites[suiteId];
    this.selectedSuiteId = Object.keys(this.suites)[0] || null;
    this.renderSuitesList();
    this.notify(`Đã xóa Test Suite "${suiteId}".`);
  }

  renderSuitesList() {
    const container = document.getElementById('suites-list-container');
    if (!container) return;
    const entries = Object.entries(this.suites).filter(([id, suite]) => {
      if (!this.searchQuery) return true;
      return id.toLowerCase().includes(this.searchQuery) || (suite.label || '').toLowerCase().includes(this.searchQuery);
    });

    if (entries.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy suite.</div>';
      return;
    }

    container.innerHTML = entries.map(([id, suite]) => {
      const isSel = this.selectedSuiteId === id;
      return `
        <div class="dashboard-list-card suite-item-card ${isSel ? 'is-selected active' : ''}" data-suite-id="${id}">
          <span class="dashboard-list-card__icon"><i class="ph-bold ph-stack"></i></span>
          <div class="dashboard-list-card__body">
            <div class="script-card-title">${suite.label || id}</div>
            <small style="color: var(--muted); font-size: 11px;">${suite.description || id}</small>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.suite-item-card').forEach((card) => {
      card.addEventListener('click', () => this.selectSuite(card.dataset.suiteId));
    });
  }

  renderSuiteDetails(suite) {
    if (!suite) return;
    const titleEl = document.getElementById('suite-detail-title');
    const descEl = document.getElementById('suite-detail-desc');
    if (titleEl) titleEl.textContent = suite.label || this.selectedSuiteId;
    if (descEl) descEl.textContent = suite.description || '';
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

export const suitesSlice = new SuitesSlice();
