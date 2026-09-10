/**
 * dashboard/public/js/views/runner/runnerSlice.js
 * Test Runner & SSE Monitor Feature Slice (Phase 4.6). Budget <= 200 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class RunnerSlice {
  constructor() {
    this.activeRun = null;
    this.logs = [];
    this.status = 'idle';
    this._eventSource = null;
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    this._connectEventStream();
    await this.fetchInitialState();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
  }

  _bindDomEvents() {
    const root = document.getElementById('runner-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#run-tests-button', 'click', () => this.startRun());
    on('#stop-tests-button', 'click', () => this.stopRun());
    on('#clear-logs-button', 'click', () => this.clearLogs());
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('startTestRun', (opts) => this.startRun(opts));
    reg('stopTestRun', () => this.stopRun());
    reg('clearRunnerLogs', () => this.clearLogs());
  }

  _connectEventStream() {
    if (typeof EventSource === 'undefined') return;
    try {
      this._eventSource = new EventSource('/api/events');
      this._eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this._handleRunnerEvent(payload);
        } catch (_) {
          this.appendLog(event.data);
        }
      };
      this._eventSource.onerror = () => {
        // SSE reconnect handles automatically
      };
    } catch (err) {
      console.error('[RunnerSlice] EventSource connection failed:', err);
    }
  }

  _handleRunnerEvent(payload) {
    if (!payload) return;
    if (payload.status) {
      this.status = payload.status;
      stateStore.setState({ runner: { status: payload.status } }, 'runnerSlice.status');
      this.updateRunStatusBadge();
    }
    if (payload.log) {
      this.appendLog(payload.log);
    }
    if (payload.type === 'RUN_FINISHED') {
      this.status = 'completed';
      this.notify('Phiên chạy kiểm thử đã hoàn tất.');
    }
  }

  async fetchInitialState() {
    try {
      const res = await apiClient.get('/api/state');
      if (res?.activeRun) this.activeRun = res.activeRun;
      if (res?.status) this.status = res.status;
      if (Array.isArray(res?.logs)) {
        this.logs = res.logs;
        this.renderLogs();
      }
      this.updateRunStatusBadge();
    } catch (err) {
      console.error('[RunnerSlice] Failed to fetch state:', err);
    }
  }

  async startRun(options = {}) {
    try {
      this.status = 'running';
      this.updateRunStatusBadge();
      const res = await apiClient.post('/api/run', options);
      this.activeRun = res?.runId || 'active';
      this.notify('Bắt đầu phiên chạy kiểm thử...');
      return res;
    } catch (err) {
      this.status = 'idle';
      this.updateRunStatusBadge();
      this.notify('Lỗi khởi động test: ' + err.message);
    }
  }

  async stopRun() {
    try {
      await apiClient.post('/api/stop', {});
      this.status = 'stopping';
      this.updateRunStatusBadge();
      this.notify('Đang dừng phiên chạy kiểm thử...');
    } catch (err) {
      this.notify('Lỗi dừng test: ' + err.message);
    }
  }

  appendLog(line) {
    this.logs.push(line);
    if (this.logs.length > 2000) this.logs.shift();
    const terminal = document.getElementById('live-log-output') || document.getElementById('runner-log-viewer');
    if (terminal) {
      const span = document.createElement('div');
      span.className = 'terminal-line';
      span.textContent = line;
      terminal.appendChild(span);
      terminal.scrollTop = terminal.scrollHeight;
    }
  }

  renderLogs() {
    const terminal = document.getElementById('live-log-output') || document.getElementById('runner-log-viewer');
    if (!terminal) return;
    terminal.innerHTML = this.logs.map((l) => `<div class="terminal-line">${escapeHtml(l)}</div>`).join('');
    terminal.scrollTop = terminal.scrollHeight;
  }

  clearLogs() {
    this.logs = [];
    const terminal = document.getElementById('live-log-output') || document.getElementById('runner-log-viewer');
    if (terminal) terminal.innerHTML = '';
  }

  updateRunStatusBadge() {
    const badge = document.getElementById('runner-status-badge') || document.getElementById('stat-runner-status');
    if (!badge) return;
    badge.textContent = this.status.toUpperCase();
    badge.className = `status-pill status-${this.status}`;
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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const runnerSlice = new RunnerSlice();
