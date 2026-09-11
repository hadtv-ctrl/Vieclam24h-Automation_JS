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
    this.activeUrl = 'https://example.com';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    if (typeof window.openRecorderStudio === 'function') {
      await window.openRecorderStudio();
    }
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

    // Tránh duplicate event listeners nếu app.js đã gắn listener quản lý toàn diện wizard
    if (typeof window.initRecorderStudioListeners === 'function' || typeof window.openRecorderStudio === 'function') {
      return;
    }

    const on = (sel, evt, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on('#rec-start-btn', 'click', () => this.startRecording());
    on('#btn-start-recording', 'click', () => this.startRecording());
    on('#rec-stop-btn', 'click', () => this.stopRecording());
    on('#btn-stop-recording', 'click', () => this.stopRecording());
    on('#rec-reset-btn', 'click', () => this.resetRecording());
    on('#rec-refresh-list-btn', 'click', () => window.checkRecorderStatus?.());
    on('#rec-platform', 'change', (e) => {
      const wrapper = root.querySelector('#rec-device-wrapper');
      if (wrapper) wrapper.style.display = e.target.value === 'mobile-web' ? 'block' : 'none';
    });
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('startRecorderSession', (url) => {
      const root = document.getElementById('recorder-view');
      const startBtn = root?.querySelector('#rec-start-btn');
      if (startBtn && typeof window.openRecorderStudio === 'function') {
        if (url && root.querySelector('#rec-url')) root.querySelector('#rec-url').value = url;
        startBtn.click();
      } else {
        return this.startRecording(url);
      }
    });
    reg('stopRecorderSession', () => {
      const root = document.getElementById('recorder-view');
      const stopBtn = root?.querySelector('#rec-stop-btn');
      if (stopBtn && typeof window.openRecorderStudio === 'function') {
        stopBtn.click();
      } else {
        return this.stopRecording();
      }
    });
    reg('resetRecorderSession', () => {
      const root = document.getElementById('recorder-view');
      const resetBtn = root?.querySelector('#rec-reset-btn');
      if (resetBtn && typeof window.openRecorderStudio === 'function') {
        resetBtn.click();
      } else {
        return this.resetRecording();
      }
    });
  }

  async startRecording(url) {
    if (this.status === 'recording') return;
    const root = document.getElementById('recorder-view');
    const inputUrl = url || root?.querySelector('#rec-url')?.value?.trim() || root?.querySelector('#recorder-url-input')?.value?.trim() || this.activeUrl;
    const platform = root?.querySelector('#rec-platform')?.value || 'desktop';
    const device = platform === 'mobile-web' ? root?.querySelector('#rec-device')?.value || '' : '';
    const startBtn = root?.querySelector('#rec-start-btn') || root?.querySelector('#btn-start-recording');
    const stopBtn = root?.querySelector('#rec-stop-btn') || root?.querySelector('#btn-stop-recording');
    const badge = root?.querySelector('#recorder-badge');

    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang mở trình duyệt...';
    }

    try {
      this.status = 'recording';
      stateStore.setState({ recorder: { status: 'recording', url: inputUrl } }, 'recorderSlice.start');
      const res = await apiClient.post('/api/recorder/start', { url: inputUrl, platform, device, force: true });
      if (badge) {
        badge.className = 'rec-status-badge recording';
        badge.innerHTML = '<i class="ph-fill ph-circle"></i> Đang ghi thao tác...';
      }
      if (stopBtn) stopBtn.disabled = false;
      this.notify(res.message || `Đang ghi thao tác trình duyệt tại ${inputUrl}...`);
      if (typeof window.onRecorderStatusUpdate === 'function') window.onRecorderStatusUpdate({ isRecording: true });
    } catch (err) {
      this.status = 'idle';
      if (startBtn) startBtn.disabled = false;
      if (badge) {
        badge.className = 'rec-status-badge idle';
        badge.innerHTML = '<i class="ph-fill ph-circle"></i> Sẵn sàng';
      }
      this.notify('Lỗi khởi động ghi: ' + err.message);
    } finally {
      if (startBtn) startBtn.innerHTML = '<i class="ph-fill ph-record"></i> Bắt đầu ghi (Codegen)';
    }
  }

  async stopRecording() {
    const root = document.getElementById('recorder-view');
    const startBtn = root?.querySelector('#rec-start-btn') || root?.querySelector('#btn-start-recording');
    const stopBtn = root?.querySelector('#rec-stop-btn') || root?.querySelector('#btn-stop-recording');
    const badge = root?.querySelector('#recorder-badge');

    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang đọc mã...';
    }

    try {
      this.status = 'idle';
      stateStore.setState({ recorder: { status: 'idle' } }, 'recorderSlice.stop');
      const res = await apiClient.post('/api/recorder/stop', {});
      if (badge) {
        badge.className = 'rec-status-badge idle';
        badge.innerHTML = '<i class="ph-fill ph-circle"></i> Sẵn sàng';
      }
      if (startBtn) startBtn.disabled = false;
      this.notify(res.message || 'Đã dừng phiên ghi.');
      if (typeof window.checkRecorderStatus === 'function') await window.checkRecorderStatus();
      if (typeof window.setRawScriptContent === 'function' && res.rawScript) {
        window.setRawScriptContent(res.rawScript, res.actions, res.actionsCount, res.detectedUrl);
      }
    } catch (err) {
      this.notify('Lỗi dừng ghi: ' + err.message);
    } finally {
      if (stopBtn) stopBtn.innerHTML = '<i class="ph-fill ph-stop"></i> Dừng ghi & Lấy mã';
    }
  }

  async resetRecording() {
    try {
      await apiClient.post('/api/recorder/reset', {});
      this.status = 'idle';
      this.notify('Đã reset phiên ghi.');
      if (typeof window.checkRecorderStatus === 'function') await window.checkRecorderStatus();
    } catch (err) {
      this.notify('Lỗi reset: ' + err.message);
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
