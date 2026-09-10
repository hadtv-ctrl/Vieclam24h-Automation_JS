/**
 * dashboard/public/js/legacy/legacyAdapter.js
 * Transition adapter synchronizing legacy app.js DOM events with Studio Core foundations.
 * Line budget: <= 150 lines.
 */

import { featureRegistry } from '../core/featureRegistry.js';
import { eventBus } from '../core/eventBus.js';
import { stateStore } from '../core/stateStore.js';

export class LegacyAdapter {
  constructor() {
    this._initialized = false;
  }

  init() {
    if (this._initialized || typeof document === 'undefined') return;
    this._initialized = true;

    // 1. Intercept .view-tab clicks to synchronize FeatureRegistry and EventBus
    document.addEventListener('click', (event) => {
      const tab = event.target.closest('.view-tab');
      if (!tab) return;

      const targetView = tab.getAttribute('data-view');
      if (targetView) {
        // Synchronize view switch through FeatureRegistry
        featureRegistry.switchView(targetView);
      }
    });

    // 2. Synchronize active view from DOM on load
    const currentActiveTab = document.querySelector('.view-tab.active');
    if (currentActiveTab) {
      const activeId = currentActiveTab.getAttribute('data-view');
      if (activeId) {
        stateStore.setState({ activeView: activeId }, 'legacyAdapter.init');
      }
    }

    // 3. Listen to cross-slice events
    eventBus.on('view:changed', ({ to }) => {
      // If legacy app.js defines a global switchView or view hook, allow it to react
      if (typeof window.onViewSwitched === 'function') {
        try {
          window.onViewSwitched(to);
        } catch (e) {
          console.error('[LegacyAdapter] Error in window.onViewSwitched:', e);
        }
      }
    });
  }
}

export const legacyAdapter = new LegacyAdapter();
