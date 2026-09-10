/**
 * dashboard/public/js/components/shell/sharedShell.js
 * Unified Shell Component managing navigation, branding, theme toggle, and global notifications.
 * Budget <= 150 lines.
 */
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';

export class SharedShell {
  constructor() {
    this._initialized = false;
  }

  init() {
    if (this._initialized || typeof document === 'undefined') return;
    this._initialized = true;

    this._bindThemeToggle();
    this._bindToastNotifications();
  }

  _bindThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn') || document.querySelector('.theme-toggle');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('dashboard_theme', next);
      stateStore.setState({ theme: next }, 'sharedShell.themeToggle');
      eventBus.emit('theme:changed', { theme: next });
    });
  }

  _bindToastNotifications() {
    eventBus.on('ui:notify', ({ message, level = 'info' }) => {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast show toast-${level}`;
      setTimeout(() => toast.classList.remove('show'), 3500);
    });
  }
}

export const sharedShell = new SharedShell();
