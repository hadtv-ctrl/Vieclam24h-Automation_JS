/**
 * dashboard/public/js/views/recorder/recorderSlice.js
 * UI Recorder & Codegen Feature Slice (Phase 4.7). Budget <= 150 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';
import { windowBridge } from '../../core/windowBridge.js';

export class RecorderSlice {
  constructor() {
    this.status = 'idle'; // 'idle' | 'recording' | 'converting'
    this.activeUrl = 'http://localhost:3000';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    this._registerBridgeActions();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('recorder-view');
    if (!root) return;
    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#btn-start-recording', 'click', () => this.startRecording());
    on('#btn-stop-recording', 'click', () => this.stopRecording());
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('startRecorderSession', (url) => this.startRecording(url));
    reg('stopRecorderSession', () => this.stopRecording());
  }

  async startRecording(url) {
    const inputUrl = url || document.getElementById('recorder-url-input')?.value?.trim() || this.activeUrl;
    try {
      this.status = 'recording';
      stateStore.setState({ recorder: { status: 'recording', url: inputUrl } }, 'recorderSlice.start');
      await apiClient.post('/api/recorder/start', { url: inputUrl });
      this.notify(`Đang ghi thao tác trình duyệt tại ${inputUrl}...`);
    } catch (err) {
      this.status = 'idle';
      this.notify('Lỗi khởi động ghi kịch bản: ' + err.message);
    }
  }

  async stopRecording() {
    try {
      this.status = 'idle';
      stateStore.setState({ recorder: { status: 'idle' } }, 'recorderSlice.stop');
      await apiClient.post('/api/recorder/stop', {});
      this.notify('Đã dừng phiên ghi kịch bản.');
    } catch (err) {
      this.notify('Lỗi dừng ghi: ' + err.message);
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

export const recorderSlice = new RecorderSlice();
