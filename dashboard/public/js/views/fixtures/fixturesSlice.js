/**
 * dashboard/public/js/views/fixtures/fixturesSlice.js
 * Fixtures & Hooks Feature Slice (Phase 4.3). Budget <= 200 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class FixturesSlice {
  constructor() {
    this.fixtures = [];
    this.selectedFixture = null;
    this.filter = 'all';
    this.searchQuery = '';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._registerBridgeActions();
    if (typeof window.openFixturesStudio === 'function') {
      try {
        await window.openFixturesStudio();
        return;
      } catch (err) {
        console.warn('[FixturesSlice] openFixturesStudio error:', err);
      }
    }
    this._bindDomEvents();
    await this.loadFixtures();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    if (typeof window.openFixturesStudio === 'function') return;
    const root = document.getElementById('fixtures-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#fixtures-search-input', 'input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase();
      this.renderFixturesList();
    });

    // Filter pills
    root.querySelectorAll('.pm-filter-pill, .fx-filter-pill').forEach((pill) => {
      const h = () => {
        root.querySelectorAll('.pm-filter-pill, .fx-filter-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.filter = pill.dataset.filter || 'all';
        this.renderFixturesList();
      };
      pill.addEventListener('click', h);
      this._disposers.push(() => pill.removeEventListener('click', h));
    });

    on('#btn-copy-usage-code', 'click', () => {
      const c = document.getElementById('fx-usage-code')?.textContent;
      if (c) navigator.clipboard?.writeText(c).then(() => this.notify('📋 Đã sao chép mã mẫu!'));
    });
    on('#btn-copy-source-code', 'click', () => {
      const c = document.getElementById('fx-source-code')?.textContent;
      if (c) navigator.clipboard?.writeText(c).then(() => this.notify('📋 Đã sao chép mã nguồn!'));
    });
    on('#btn-toggle-fixture-edit', 'click', () => {
      const ed = document.getElementById('fx-source-editor');
      const pre = document.getElementById('fx-source-code-pre');
      const txt = document.getElementById('fx-toggle-edit-text');
      const isEd = ed && ed.style.display !== 'none';
      if (ed) ed.style.display = isEd ? 'none' : 'block';
      if (pre) pre.style.display = isEd ? 'block' : 'none';
      if (txt) txt.textContent = isEd ? 'Chỉnh sửa mã' : 'Xem mã highlight';
    });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectFixture', (name) => this.selectFixture(name));
    reg('refreshFixturesList', () => this.loadFixtures());
  }

  async loadFixtures() {
    const container = document.getElementById('fixtures-list-container');
    if (container && this.fixtures.length === 0) {
      container.innerHTML = '<p class="empty-resource">Đang tải danh sách fixtures...</p>';
    }
    try {
      const res = await apiClient.get('/api/fixtures');
      this.fixtures = res?.fixtures || [];
      stateStore.setState({ fixtures: { list: this.fixtures } }, 'fixturesSlice.loadFixtures');
      this.renderFixturesList();
      if (this.fixtures.length > 0 && !this.selectedFixture) {
        this.selectFixture(this.fixtures[0].name);
      }
    } catch (err) {
      console.error('[FixturesSlice] Failed to load fixtures:', err);
    }
  }

  selectFixture(name) {
    if (!name) return;
    const fx = this.fixtures.find((f) => f.name === name);
    if (!fx) return;
    this.selectedFixture = fx;
    stateStore.setState({ fixtures: { selected: name } }, 'fixturesSlice.selectFixture');
    if (typeof window.selectFixture === 'function') {
      try { window.selectFixture(fx); } catch (_) {}
    }
    this.renderFixturesList();
    this.renderFixtureDetails(fx);
  }

  renderFixturesList() {
    const container = document.getElementById('fixtures-list-container');
    if (!container) return;

    const filtered = this.fixtures.filter((fx) => {
      if (this.filter === 'core' && fx.isCustom) return false;
      if (this.filter === 'custom' && !fx.isCustom) return false;
      if (!this.searchQuery) return true;
      const n = (fx.name || '').toLowerCase();
      const t = (fx.title || '').toLowerCase();
      return n.includes(this.searchQuery) || t.includes(this.searchQuery);
    });

    const badge = document.getElementById('fixtures-badge-total');
    if (badge) badge.textContent = `${filtered.length} / ${this.fixtures.length}`;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy fixture.</div>';
      return;
    }

    container.innerHTML = filtered.map((fx) => {
      const isSel = this.selectedFixture?.name === fx.name;
      return `
        <div class="dashboard-list-card fixture-card-item ${isSel ? 'is-selected active' : ''}" data-name="${fx.name}">
          <span class="dashboard-list-card__icon"><i class="ph-bold ph-wrench"></i></span>
          <div class="dashboard-list-card__body">
            <div class="script-card-title">${fx.title || fx.name}</div>
            <small style="color: var(--muted); font-size: 11px;">${fx.category || 'Custom'} • ${fx.scope || 'test'}</small>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.fixture-card-item').forEach((card) => {
      card.addEventListener('click', () => this.selectFixture(card.dataset.name));
    });
  }

  renderFixtureDetails(fx) {
    if (!fx) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('fx-detail-category-eyebrow', fx.isCustom ? 'FIXTURE NGHIỆP VỤ TÙY BIẾN' : 'FIXTURE CỐT LÕI HỆ THỐNG');
    set('fx-detail-name', fx.title ? `${fx.name} (${fx.title})` : fx.name);
    set('fx-detail-desc', fx.description || fx.title || 'Fixture được nạp tự động vào ngữ cảnh kiểm thử Playwright.');
    set('fx-grid-scope', fx.scope || 'test');
    set('fx-grid-cat', fx.category || 'Hạ tầng & Nền tảng');
    set('fx-grid-params', (fx.params && fx.params.length) ? fx.params.join(', ') : 'Không có');
    set('fx-grid-file', fx.sourceFile || 'core/fixtures/baseTest.js');

    const toggleBtn = document.getElementById('btn-toggle-fixture-edit');
    if (toggleBtn) toggleBtn.style.display = fx.isCustom ? 'inline-flex' : 'none';

    const sourceEl = document.getElementById('fx-source-code');
    if (sourceEl) {
      sourceEl.textContent = fx.rawCode || `// Fixture ${fx.name} được định nghĩa trong ${fx.sourceFile}\n// Chữ ký tham số: ${fx.params?.join(', ') || 'Không có'}`;
      if (window.Prism) Prism.highlightElement(sourceEl);
    }

    const usageEl = document.getElementById('fx-usage-code');
    if (usageEl) {
      usageEl.textContent = `const { test, expect } = require('../../../core/fixtures/baseTest');\n\ntest('Kịch bản sử dụng fixture ${fx.name}', async ({ ${fx.name} }) => {\n  console.log('Đang thực thi với fixture:', ${fx.name});\n});`;
      if (window.Prism) Prism.highlightElement(usageEl);
    }
  }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
  }
}

export const fixturesSlice = new FixturesSlice();
