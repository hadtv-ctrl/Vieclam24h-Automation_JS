/**
 * dashboard/public/js/views/agent/agentSlice.js
 * AI Copilot & Autonomous Agent Feature Slice (Phase 4.7). Budget <= 250 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class AgentSlice {
  constructor() {
    this.activeId = null;
    this.working = false;
    this.events = [];
    this._timer = null;
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
    await this.checkStatus();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _bindDomEvents() {
    const root = document.getElementById('agent-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#agent-start', 'click', (e) => { e.preventDefault(); this.startAgent(); });
    on('#agent-stop', 'click', (e) => { e.preventDefault(); this.stopAgent(); });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('startAiAgent', () => this.startAgent());
    reg('stopAiAgent', () => this.stopAgent());
  }

  async checkStatus() {
    try {
      const res = await apiClient.get('/api/agent/session');
      if (res?.session) {
        this.activeId = res.session.id;
        this.working = res.session.status === 'running';
        this.updateControls();
        if (this.working && !this._timer) {
          this._startPolling();
        }
      }
    } catch (_) {
      // Agent session optional on boot
    }
  }

  async startAgent() {
    const promptInput = document.getElementById('agent-prompt');
    const promptText = promptInput?.value?.trim();
    if (!promptText) return this.notify('Vui lòng nhập yêu cầu cho AI Agent.');

    try {
      this.working = true;
      this.updateControls();
      const res = await apiClient.post('/api/agent/session', { prompt: promptText });
      this.activeId = res?.session?.id || 'agent-active';
      this.notify('AI Agent đã bắt đầu thực thi yêu cầu.');
      this._startPolling();
    } catch (err) {
      this.working = false;
      this.updateControls();
      this.notify('Lỗi khởi động AI Agent: ' + err.message);
    }
  }

  async stopAgent() {
    if (!this.activeId) return;
    try {
      await apiClient.post(`/api/agent/session/${this.activeId}/stop`, {});
      this.working = false;
      this.updateControls();
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this.notify('Đã dừng AI Agent.');
    } catch (err) {
      this.notify('Lỗi dừng Agent: ' + err.message);
    }
  }

  _startPolling() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      if (!this.activeId || !this._mounted) return;
      try {
        const res = await apiClient.get(`/api/agent/session/${this.activeId}`);
        if (res?.session) {
          if (Array.isArray(res.session.events)) {
            this.events = res.session.events;
            this.renderEvents();
          }
          if (res.session.status !== 'running') {
            this.working = false;
            this.updateControls();
            clearInterval(this._timer);
            this._timer = null;
            this.notify(`AI Agent hoàn tất (${res.session.status}).`);
          }
        }
      } catch (_) {}
    }, 2000);
  }

  renderEvents() {
    const container = document.getElementById('agent-events');
    if (!container) return;
    container.innerHTML = this.events.map((e) => `
      <div class="agent-event-card">
        <strong>${e.title || e.type || 'Event'}:</strong>
        <p>${e.message || JSON.stringify(e)}</p>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  updateControls() {
    const startBtn = document.getElementById('agent-start');
    const stopBtn = document.getElementById('agent-stop');
    const promptInput = document.getElementById('agent-prompt');
    if (startBtn) startBtn.disabled = this.working;
    if (stopBtn) stopBtn.disabled = !this.working;
    if (promptInput) promptInput.readOnly = this.working;
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

export const agentSlice = new AgentSlice();
