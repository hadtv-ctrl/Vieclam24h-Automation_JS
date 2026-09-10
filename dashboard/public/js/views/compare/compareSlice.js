/**
 * dashboard/public/js/views/compare/compareSlice.js
 * Visual Screenshot Comparison Feature Slice (Phase 4.8). Budget <= 150 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';

export class CompareSlice {
  constructor() {
    this.diffs = [];
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    await this.loadComparisons();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('compare-view');
    if (!root) return;
    const btn = root.querySelector('#btn-refresh-compare');
    if (btn) {
      const h = () => this.loadComparisons();
      btn.addEventListener('click', h);
      this._disposers.push(() => btn.removeEventListener('click', h));
    }
  }

  async loadComparisons() {
    try {
      const res = await apiClient.get('/api/resources');
      this.diffs = res?.screenshots || [];
      stateStore.setState({ compare: { diffs: this.diffs } }, 'compareSlice.load');
      this.renderComparisonGrid();
    } catch (err) {
      console.error('[CompareSlice] Failed to load visual diffs:', err);
    }
  }

  renderComparisonGrid() {
    const el = document.getElementById('compare-grid-output');
    if (!el) return;
    if (this.diffs.length === 0) {
      el.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">Chưa có ảnh so sánh vi phạm (0 visual diffs).</div>';
      return;
    }
    el.innerHTML = this.diffs.map((d) => `<div class="compare-card">${d}</div>`).join('');
  }
}

export const compareSlice = new CompareSlice();
