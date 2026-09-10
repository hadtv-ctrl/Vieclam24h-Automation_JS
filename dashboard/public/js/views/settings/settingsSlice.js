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
    if (typeof window.openSettings === 'function') {
      try { await window.openSettings(); } catch (_) {}
    }
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

    // Subtabs click listener
    root.querySelectorAll('.settings-subtab').forEach((tab) => {
      const h = () => this.switchSubtab(tab.dataset.subtab);
      tab.addEventListener('click', h);
      this._disposers.push(() => tab.removeEventListener('click', h));
    });

    const saveBtn = root.querySelector('#save-settings-button') || root.querySelector('#btn-save-settings');
    if (saveBtn) {
      const h = () => (typeof window.saveSettings === 'function' ? window.saveSettings() : this.saveSettings());
      saveBtn.addEventListener('click', h);
      this._disposers.push(() => saveBtn.removeEventListener('click', h));
    }

    const reloadBtn = root.querySelector('#reload-settings-button');
    if (reloadBtn) {
      const h = () => (typeof window.openSettings === 'function' ? window.openSettings() : this.loadSettings());
      reloadBtn.addEventListener('click', h);
      this._disposers.push(() => reloadBtn.removeEventListener('click', h));
    }
  }

  switchSubtab(target) {
    const root = document.getElementById('settings-view');
    if (!root) return;

    root.querySelectorAll('.settings-subtab').forEach((t) => t.classList.toggle('active', t.dataset.subtab === target));

    const isGeneral = target === 'general';
    ['.settings-environments', '.settings-runtime', '.settings-api', '.settings-artifacts'].forEach((sel) => {
      const el = root.querySelector(sel);
      if (el) el.hidden = !isGeneral;
    });

    const aiPanel = root.querySelector('.settings-ai');
    if (aiPanel) {
      aiPanel.hidden = target !== 'ai';
      if (target === 'ai' && typeof window.initAiSettings === 'function') {
        window.initAiSettings();
      }
    }

    const discordPanel = root.querySelector('.settings-discord');
    if (discordPanel) discordPanel.hidden = target !== 'discord';

    const brandingPanel = root.querySelector('.settings-branding');
    if (brandingPanel) brandingPanel.hidden = target !== 'branding';

    const suitesPanel = root.querySelector('.settings-suites');
    if (suitesPanel) suitesPanel.hidden = target !== 'suites';

    const documentsPanel = root.querySelector('.settings-documents');
    if (documentsPanel) {
      documentsPanel.hidden = target !== 'documents';
      if (target === 'documents' && typeof window.openSettingsDocuments === 'function') {
        window.openSettingsDocuments();
      }
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
