/**
 * dashboard/public/js/views/resources/resourcesSlice.js
 * Reports & Artifacts Explorer Feature Slice (Phase 4.8). Budget <= 180 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class ResourcesSlice {
  constructor() {
    this.categories = {};
    this.activeCategory = 'reports';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    if (typeof window.openExplorer === 'function') {
      try { await window.openExplorer(); } catch (_) {}
    }
    await this.loadResources();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('resources-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#btn-refresh-resources', 'click', () => {
      this.loadResources();
      this.notify('Đã làm mới báo cáo và tài nguyên.');
    });

    root.querySelectorAll('.resource-seg-btn').forEach((btn) => {
      const h = () => {
        if (typeof window.switchResourceCategory === 'function') {
          window.switchResourceCategory(btn.dataset.category);
        }
      };
      btn.addEventListener('click', h);
      this._disposers.push(() => btn.removeEventListener('click', h));
    });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('refreshResources', () => this.loadResources());
  }

  async loadResources() {
    try {
      const res = await apiClient.get('/api/resources');
      this.categories = res || {};
      stateStore.setState({ resources: this.categories }, 'resourcesSlice.load');
      this.renderResources();
    } catch (err) {
      console.error('[ResourcesSlice] Failed to load resources:', err);
    }
  }

  renderResources() {
    const container = document.getElementById('resources-grid-container');
    if (!container) return;
    const items = Object.entries(this.categories);
    if (items.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">Chưa có tài nguyên.</div>';
      return;
    }
    container.innerHTML = items.map(([key, val]) => `
      <div class="resource-card">
        <h3>${key}</h3>
        <p>${Array.isArray(val) ? val.length : 0} mục lưu trữ</p>
      </div>
    `).join('');
  }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
  }
}

export const resourcesSlice = new ResourcesSlice();
