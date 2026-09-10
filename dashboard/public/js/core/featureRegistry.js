/**
 * dashboard/public/js/core/featureRegistry.js
 * Central Registry and Router for 13 Studio Views.
 * Line budget: <= 150 lines.
 */

import { eventBus } from './eventBus.js';
import { stateStore } from './stateStore.js';

export class FeatureRegistry {
  constructor() {
    this._views = new Map();
    this._activeViewId = null;
    this._navigationGen = 0;
  }

  registerView(id, definition) {
    if (!id || typeof id !== 'string') throw new Error('View ID must be a non-empty string.');
    this._views.set(id, {
      id,
      title: definition.title || id,
      containerSelector: definition.containerSelector || `#${id}`,
      mount: definition.mount || (() => {}),
      unmount: definition.unmount || (() => {}),
      isLegacy: Boolean(definition.isLegacy ?? true),
      ...definition,
    });
  }

  getView(id) {
    return this._views.get(id);
  }

  listViews() {
    return Array.from(this._views.values());
  }

  getActiveViewId() {
    return this._activeViewId;
  }

  async switchView(targetViewId) {
    if (!this._views.has(targetViewId)) {
      console.warn(`[FeatureRegistry] Unknown view: "${targetViewId}". Defaulting to container search.`);
    }

    const currentGen = ++this._navigationGen;
    const prevViewId = this._activeViewId;
    if (prevViewId === targetViewId) return;

    // 1. Unmount previous view
    if (prevViewId && this._views.has(prevViewId)) {
      const prevView = this._views.get(prevViewId);
      try {
        await prevView.unmount();
      } catch (err) {
        console.error(`[FeatureRegistry] Error unmounting "${prevViewId}":`, err);
      }
    }

    if (currentGen !== this._navigationGen) return;

    // 2. Update active state
    this._activeViewId = targetViewId;
    stateStore.setState({ activeView: targetViewId }, 'featureRegistry.switchView');

    // 3. Update DOM view visibility
    this._updateDomTabsAndPanels(targetViewId);

    // 4. Mount target view
    if (this._views.has(targetViewId)) {
      const nextView = this._views.get(targetViewId);
      try {
        await nextView.mount();
      } catch (err) {
        console.error(`[FeatureRegistry] Error mounting "${targetViewId}":`, err);
      }
    }

    if (currentGen !== this._navigationGen) return;

    // 5. Emit event
    eventBus.emit('view:changed', { from: prevViewId, to: targetViewId });
  }

  _updateDomTabsAndPanels(activeId) {
    if (typeof document === 'undefined') return;

    // Update tab active classes
    const tabs = document.querySelectorAll('.view-tab');
    tabs.forEach((tab) => {
      const match = tab.getAttribute('data-view') === activeId;
      tab.classList.toggle('active', match);
      tab.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    // Update view panels visibility
    const panels = document.querySelectorAll('.dashboard-view, [role="tabpanel"]');
    panels.forEach((v) => {
      const match = v.id === activeId;
      v.classList.toggle('active', match);
      if (match) {
        v.removeAttribute('hidden');
      } else {
        v.setAttribute('hidden', 'true');
      }
    });
  }
}

export const featureRegistry = new FeatureRegistry();
