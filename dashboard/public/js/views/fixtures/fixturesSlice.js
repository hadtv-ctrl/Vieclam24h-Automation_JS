/**
 * dashboard/public/js/views/fixtures/fixturesSlice.js
 * Fixtures & Hooks Feature Slice. Line budget <= 200 lines.
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
    this._bindDomEvents();
    if (typeof window.openFixturesStudio === 'function') {
      try { await window.openFixturesStudio(); } catch (e) { console.warn('[FixturesSlice] legacy studio err:', e); }
    }
    await this.loadFixtures();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('fixtures-view');
    if (!root || this._disposers.length > 2) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (el) { el.addEventListener(evt, fn); this._disposers.push(() => el.removeEventListener(evt, fn)); }
    };
    on('#fixtures-search-input', 'input', (e) => { this.searchQuery = (e.target.value || '').toLowerCase(); this.renderFixturesList(); });
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
      const isCustom = this.selectedFixture?.isCustom;
      const c = isCustom ? (document.getElementById('fx-source-editor')?.value || '') : (document.getElementById('fx-source-code')?.textContent || '');
      if (c) navigator.clipboard?.writeText(c).then(() => this.notify('📋 Đã sao chép mã nguồn!'));
    });
    on('#btn-toggle-fixture-edit', 'click', () => {
      const ed = document.getElementById('fx-source-editor'), pre = document.getElementById('fx-source-code-pre'), txt = document.getElementById('fx-toggle-edit-text'), isEd = ed && ed.style.display !== 'none';
      if (ed) ed.style.display = isEd ? 'none' : 'block';
      if (pre) pre.style.display = isEd ? 'block' : 'none';
      if (txt) txt.textContent = isEd ? 'Chỉnh sửa mã' : 'Xem mã highlight';
    });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('selectFixture', (target) => this.selectFixture(target));
    reg('refreshFixturesList', () => this.loadFixtures());
  }

  async loadFixtures() {
    const container = document.getElementById('fixtures-list-container');
    if (container && this.fixtures.length === 0) container.innerHTML = '<p class="empty-resource">Đang tải danh sách fixtures...</p>';
    try {
      const res = await apiClient.get('/api/fixtures');
      this.fixtures = res?.fixtures || window.repoFixtures || [];
      if (typeof window !== 'undefined') window.repoFixtures = this.fixtures;
      stateStore.setState({ fixtures: { list: this.fixtures } }, 'fixturesSlice.loadFixtures');
      this.renderFixturesList();
      if (this.fixtures.length > 0 && !this.selectedFixture) this.selectFixture(this.fixtures[0]);
    } catch (err) {
      console.error('[FixturesSlice] Failed to load fixtures:', err);
    }
  }

  selectFixture(target) {
    if (!target) return;
    const name = typeof target === 'string' ? target : target.name;
    if (!name) return;
    const list = (this.fixtures && this.fixtures.length > 0) ? this.fixtures : (window.repoFixtures || []);
    const fx = (typeof target === 'object' && target.name && target.category) ? target : list.find((f) => f.name === name);
    if (!fx) return;
    this.selectedFixture = fx;
    if (typeof window !== 'undefined') window.currentSelectedFixture = fx;
    stateStore.setState({ fixtures: { selected: name } }, 'fixturesSlice.selectFixture');
    document.querySelectorAll('#fixtures-list-container .fixture-card-item').forEach((card) => {
      const match = card.dataset.name === name;
      card.classList.toggle('is-selected', match);
      card.classList.toggle('active', match);
    });
    this.renderFixtureDetails(fx);
  }

  renderFixturesList() {
    const container = document.getElementById('fixtures-list-container');
    if (!container) return;
    const filtered = (this.fixtures || []).filter((fx) => {
      if (this.filter === 'core' && fx.isCustom) return false;
      if (this.filter === 'custom' && !fx.isCustom) return false;
      if (!this.searchQuery) return true;
      const q = this.searchQuery;
      return (fx.name || '').toLowerCase().includes(q) || (fx.title || '').toLowerCase().includes(q);
    });
    const badge = document.getElementById('fixtures-badge-total');
    if (badge) badge.textContent = `${filtered.length} / ${this.fixtures.length}`;
    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy fixture.</div>';
      return;
    }
    const getMeta = (fx) => {
      if (fx.isCustom) return { icon: 'ph-sparkle', cls: 'setup', lbl: 'Tùy biến' };
      if (fx.name === 'pages') return { icon: 'ph-browsers', cls: 'desktop', lbl: 'Cốt lõi' };
      if (fx.name.includes('User')) return { icon: 'ph-user-circle', cls: 'fixture', lbl: 'Cốt lõi' };
      if (fx.name.includes('cleanup') || fx.name.includes('Hook')) return { icon: 'ph-trash', cls: 'setup', lbl: 'Cốt lõi' };
      return { icon: 'ph-gear', cls: 'desktop', lbl: 'Cốt lõi' };
    };
    container.innerHTML = filtered.map((fx) => {
      const isSel = this.selectedFixture?.name === fx.name;
      const meta = getMeta(fx);
      const desc = fx.title || fx.description || 'Fixture tự động nạp.';
      return `
        <div class="dashboard-list-card script-card-item fixture-card-item ${isSel ? 'is-selected active' : ''}" data-name="${fx.name}">
          <span class="dashboard-list-card__icon script-card-platform-icon ${meta.cls}"><i class="ph-bold ${meta.icon}"></i></span>
          <div class="dashboard-list-card__body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
              <div class="script-card-title">${fx.name}</div>
              <span class="script-card-badge-platform ${meta.cls}">${meta.lbl}</span>
            </div>
            <div class="script-card-file" title="${desc}"><i class="ph ph-file-js"></i> ${desc}</div>
            <div class="script-card-pills">
              <span class="script-card-badge-pages" title="${fx.category || 'Hạ tầng'}"><i class="ph ph-tag"></i> ${fx.category || 'Hạ tầng'}</span>
              <span class="script-card-badge-data"><i class="ph ph-clock"></i> ${fx.scope || 'test'}</span>
            </div>
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
    const rev = document.getElementById('fx-detail-revision'), delBtn = document.getElementById('btn-delete-fixture'), toggleBtn = document.getElementById('btn-toggle-fixture-edit'), modeBadge = document.getElementById('fx-mode-badge');
    if (rev) { rev.textContent = fx.revision ? `Bản dựng: ${fx.revision}` : ''; rev.style.display = fx.revision ? 'inline-block' : 'none'; }
    if (delBtn) delBtn.style.display = fx.isCustom ? 'inline-flex' : 'none';
    if (toggleBtn) toggleBtn.style.display = fx.isCustom ? 'inline-flex' : 'none';
    if (modeBadge) { modeBadge.textContent = fx.isCustom ? 'Tùy biến (Xem mã)' : 'Chỉ đọc'; modeBadge.classList.toggle('editable', Boolean(fx.isCustom)); }
    const ed = document.getElementById('fx-source-editor'), pre = document.getElementById('fx-source-code-pre');
    const sourceCode = fx.rawCode || `// Fixture ${fx.name} được định nghĩa trong ${fx.sourceFile}\n// Chữ ký tham số: ${fx.params?.join(', ') || 'Không có'}`;
    if (ed) { ed.value = sourceCode; ed.style.display = 'none'; }
    if (pre) pre.style.display = 'block';
    const sourceEl = document.getElementById('fx-source-code'), usageEl = document.getElementById('fx-usage-code');
    if (sourceEl) { sourceEl.textContent = sourceCode; sourceEl.className = 'language-javascript'; if (window.Prism) Prism.highlightElement(sourceEl); }
    if (usageEl) {
      usageEl.textContent = `const { test, expect } = require('../../../core/fixtures/baseTest');\n\ntest('Kịch bản sử dụng fixture ${fx.name}', async ({ ${fx.name} }) => {\n  console.log('Đang thực thi với fixture:', ${fx.name});\n});`;
      usageEl.className = 'language-javascript';
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
