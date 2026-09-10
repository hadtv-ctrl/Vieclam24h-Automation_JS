/**
 * dashboard/public/js/views/pages/pagesSlice.js
 * Object Repository & Page Manager Feature Slice (Phase 4.4). Budget <= 200 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';
import { editorSession } from '../../components/editor/editorSession.js';

export class PagesSlice {
  constructor() {
    this.pages = [];
    this.selectedPage = null;
    this.filter = 'all';
    this.searchQuery = '';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    if (typeof window.openPageManager === 'function') {
      try { await window.openPageManager(); } catch (_) {}
    }
    await this.loadPages();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('page-manager-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#page-search-input', 'input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase();
      this.renderPagesList();
    });

    on('#btn-refresh-pages', 'click', () => {
      this.loadPages();
      this.notify('Đã làm mới danh sách Page Objects.');
    });

    // Subtabs
    on('#btn-tab-pm-inspect', 'click', () => this.switchSubnav('inspect'));
    on('#btn-tab-pm-source', 'click', () => this.switchSubnav('source'));
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectPageObject', (name) => this.selectPage(name));
    reg('refreshPagesList', () => this.loadPages());
  }

  async loadPages() {
    const container = document.getElementById('pages-list-container');
    if (container && this.pages.length === 0) {
      container.innerHTML = '<p class="empty-resource">Đang nạp danh sách Pages...</p>';
    }
    try {
      const res = await apiClient.get('/api/object-repository/pages');
      this.pages = res?.pages || [];
      stateStore.setState({ pages: { list: this.pages } }, 'pagesSlice.loadPages');
      this.renderPagesList();
      if (this.pages.length > 0 && !this.selectedPage) {
        this.selectPage(this.pages[0].name || this.pages[0].fileName);
      }
    } catch (err) {
      console.error('[PagesSlice] Failed to load pages:', err);
    }
  }

  selectPage(pageName) {
    if (!pageName) return;
    const page = this.pages.find((p) => (p.name || p.fileName) === pageName);
    if (!page) return;
    this.selectedPage = page;
    stateStore.setState({ pages: { selected: pageName } }, 'pagesSlice.selectPage');
    this.renderPagesList();
    this.renderPageDetails(page);
  }

  renderPagesList() {
    const container = document.getElementById('pages-list-container');
    if (!container) return;

    const filtered = this.pages.filter((p) => {
      if (!this.searchQuery) return true;
      const n = (p.name || p.fileName || '').toLowerCase();
      const t = (p.title || '').toLowerCase();
      return n.includes(this.searchQuery) || t.includes(this.searchQuery);
    });

    const badge = document.getElementById('stat-pm-pages-count');
    if (badge) badge.textContent = filtered.length;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy Page Object.</div>';
      return;
    }

    container.innerHTML = filtered.map((p) => {
      const pName = p.name || p.fileName;
      const isSel = (this.selectedPage?.name || this.selectedPage?.fileName) === pName;
      return `
        <div class="dashboard-list-card page-item-card ${isSel ? 'is-selected active' : ''}" data-name="${pName}">
          <span class="dashboard-list-card__icon"><i class="ph-bold ph-browsers"></i></span>
          <div class="dashboard-list-card__body">
            <div class="script-card-title">${p.title || pName}</div>
            <small style="color: var(--muted); font-size: 11px;">${(p.locators || []).length} locators • ${p.fileName || pName}</small>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.page-item-card').forEach((card) => {
      card.addEventListener('click', () => this.selectPage(card.dataset.name));
    });
  }

  renderPageDetails(page) {
    if (!page) return;
    const titleEl = document.getElementById('pm-detail-title');
    const fileEl = document.getElementById('pm-detail-file');
    if (titleEl) titleEl.textContent = page.title || page.name || page.fileName;
    if (fileEl) fileEl.textContent = page.fileName || '';
    if (page.rawCode) {
      editorSession.openFile(`pages/${page.fileName}`, page.rawCode);
    }
  }

  switchSubnav(mode) {
    const inspectBtn = document.getElementById('btn-tab-pm-inspect');
    const sourceBtn = document.getElementById('btn-tab-pm-source');
    const inspectPanel = document.getElementById('pm-inspect-panel');
    const sourcePanel = document.getElementById('pm-source-panel');
    if (inspectBtn) inspectBtn.classList.toggle('active', mode === 'inspect');
    if (sourceBtn) sourceBtn.classList.toggle('active', mode === 'source');
    if (inspectPanel) inspectPanel.style.display = mode === 'inspect' ? '' : 'none';
    if (sourcePanel) sourcePanel.style.display = mode === 'source' ? '' : 'none';
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

export const pagesSlice = new PagesSlice();
