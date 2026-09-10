/**
 * dashboard/public/js/views/settings/settingsSlice.js
 * Environment & Settings Feature Slice (Phase 4.8). Budget <= 150 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';

export class SettingsSlice {
  constructor() {
    this.config = {};
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    await this.loadSettings();
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('settings-view');
    if (!root) return;
    const saveBtn = root.querySelector('#btn-save-settings');
    if (saveBtn) {
      const h = () => this.saveSettings();
      saveBtn.addEventListener('click', h);
      this._disposers.push(() => saveBtn.removeEventListener('click', h));
    }
  }

  async loadSettings() {
    try {
      const res = await apiClient.get('/api/config');
      this.config = res || {};
      stateStore.setState({ settings: this.config }, 'settingsSlice.load');
      this.populateForm();
    } catch (err) {
      console.error('[SettingsSlice] Failed to load config:', err);
    }
  }

  populateForm() {
    const projInput = document.getElementById('setting-project-name');
    if (projInput && this.config?.branding?.projectName) {
      projInput.value = this.config.branding.projectName;
    }
  }

  async saveSettings() {
    try {
      const projInput = document.getElementById('setting-project-name');
      const payload = { ...this.config, branding: { ...this.config.branding, projectName: projInput?.value } };
      await apiClient.post('/api/config', payload);
      this.notify('Đã lưu cấu hình hệ thống thành công.');
    } catch (err) {
      this.notify('Lỗi lưu cấu hình: ' + err.message);
    }
  }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
  }
}

export const settingsSlice = new SettingsSlice();
