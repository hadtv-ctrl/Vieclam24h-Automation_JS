/**
 * dashboard/public/js/views/git/gitSlice.js
 * Git Version Control & Sync Feature Slice (Phase 4.7). Budget <= 150 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class GitSlice {
  constructor() {
    this.status = null;
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    if (typeof window.openGitStudio === 'function') {
      try { await window.openGitStudio(); } catch (_) {}
    }
    await this.fetchGitStatus();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('git-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#btn-git-sync', 'click', () => this.syncGit());
    on('#btn-git-refresh', 'click', () => this.fetchGitStatus());
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('fetchGitStatus', () => this.fetchGitStatus());
    reg('syncGitWorkspace', () => this.syncGit());
  }

  async fetchGitStatus() {
    try {
      const res = await apiClient.get('/api/git/status');
      this.status = res;
      stateStore.setState({ git: { status: res } }, 'gitSlice.status');
      this.renderStatus();
    } catch (err) {
      console.error('[GitSlice] Failed to fetch git status:', err);
    }
  }

  async syncGit() {
    try {
      this.notify('Đang đồng bộ Git repository...');
      const res = await apiClient.post('/api/git/sync', {});
      await this.fetchGitStatus();
      this.notify('Đồng bộ Git hoàn tất thành công.');
      return res;
    } catch (err) {
      this.notify('Lỗi đồng bộ Git: ' + err.message);
    }
  }

  renderStatus() {
    const branchEl = document.getElementById('git-current-branch');
    if (branchEl && this.status?.branch) {
      branchEl.textContent = this.status.branch;
    }
    const changesEl = document.getElementById('git-changes-count');
    if (changesEl && this.status?.changes) {
      changesEl.textContent = Array.isArray(this.status.changes) ? this.status.changes.length : 0;
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

export const gitSlice = new GitSlice();
