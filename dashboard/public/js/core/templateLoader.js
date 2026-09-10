/**
 * dashboard/public/js/core/templateLoader.js
 * Dynamic on-demand HTML template loader for Studio Views (Plan 09 Phase 5).
 * Line budget: <= 150 lines.
 */

export class TemplateLoader {
  constructor() {
    this._cache = new Map();
    this._loading = new Map();
    this._viewMap = {
      'agent-view': 'agent',
      'suites-view': 'suites',
      'recorder-view': 'recorder',
      'page-manager-view': 'pages',
      'builder-view': 'builder',
      'data-view': 'data',
      'fixtures-view': 'fixtures',
      'resources-view': 'resources',
      'compare-view': 'compare',
      'docs-view': 'docs',
      'settings-view': 'settings',
      'git-view': 'git',
    };
  }

  hasTemplate(viewId) {
    return Boolean(this._viewMap[viewId]);
  }

  isLoaded(viewId) {
    if (typeof document === 'undefined') return false;
    const el = document.getElementById(viewId);
    return Boolean(el && el.childElementCount > 0);
  }

  async loadViewTemplate(viewId) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(viewId);
    if (!container || container.childElementCount > 0) return;

    const templateName = this._viewMap[viewId];
    if (!templateName) return;

    if (this._cache.has(templateName)) {
      container.innerHTML = this._cache.get(templateName);
      return;
    }

    if (this._loading.has(templateName)) {
      await this._loading.get(templateName);
      return;
    }

    const loadPromise = (async () => {
      try {
        const res = await fetch(`/templates/${templateName}.html?v=5.0`);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading template "${templateName}"`);
        const html = await res.text();
        this._cache.set(templateName, html);
        container.innerHTML = html;
      } catch (err) {
        console.error(`[TemplateLoader] Failed to load template for "${viewId}":`, err);
        throw err;
      } finally {
        this._loading.delete(templateName);
      }
    })();

    this._loading.set(templateName, loadPromise);
    await loadPromise;
  }

  preloadAll() {
    return Promise.all(
      Object.keys(this._viewMap).map((id) => this.loadViewTemplate(id).catch(() => {}))
    );
  }

  clearCache() {
    this._cache.clear();
  }
}

export const templateLoader = new TemplateLoader();
