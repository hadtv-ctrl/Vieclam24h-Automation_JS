/**
 * dashboard/public/js/core/tabRouter.js
 * Universal View & Tab Persistence Router across Page Reloads & URL Navigation.
 * Budget: <= 200 lines.
 */
import { featureRegistry } from './featureRegistry.js';

export const DASHBOARD_VIEW_MAP = {
  runner: 'runner-view', 'runner-view': 'runner-view',
  builder: 'builder-view', 'builder-view': 'builder-view', bdd: 'builder-view', 'bdd-view': 'builder-view',
  pages: 'page-manager-view', 'page-manager': 'page-manager-view', 'page-manager-view': 'page-manager-view',
  code: 'page-manager-view', framework: 'page-manager-view',
  resources: 'resources-view', 'resources-view': 'resources-view', reports: 'resources-view', evidence: 'resources-view',
  docs: 'docs-view', 'docs-view': 'docs-view', guide: 'docs-view', guides: 'docs-view', huongdan: 'docs-view', documents: 'docs-view',
  agent: 'agent-view', 'agent-view': 'agent-view', ai: 'agent-view', 'ai-view': 'agent-view',
  suites: 'suites-view', 'suites-view': 'suites-view', suite: 'suites-view',
  recorder: 'recorder-view', 'recorder-view': 'recorder-view', record: 'recorder-view', codegen: 'recorder-view',
  data: 'data-view', 'data-view': 'data-view', 'test-data': 'data-view',
  fixtures: 'fixtures-view', 'fixtures-view': 'fixtures-view', fixture: 'fixtures-view',
  compare: 'compare-view', 'compare-view': 'compare-view', diff: 'compare-view',
  qa: 'qa-view', 'qa-view': 'qa-view', audit: 'qa-view',
  git: 'git-view', 'git-view': 'git-view', sync: 'git-view',
  settings: 'settings-view', 'settings-view': 'settings-view', config: 'settings-view',
};

export class TabRouter {
  constructor() {
    this._initialized = false;
  }

  init() {
    if (this._initialized || typeof document === 'undefined') return;
    this._initialized = true;
    this._bindTrackingListeners();
    this._restoreInitialViewAndSubtabs();
    this._bindHashChangeListener();
  }

  parseHash(hashString) {
    const raw = String(hashString || '').replace(/^#\/?/, '').trim();
    if (!raw) return null;
    const [hashPath, hashQuery] = raw.split('?');
    const segments = hashPath.split('/').filter(Boolean);
    const viewId = DASHBOARD_VIEW_MAP[segments[0]?.toLowerCase()] || (document.getElementById(segments[0]) ? segments[0] : null);
    if (!viewId) return null;
    let subtab = segments[1]?.toLowerCase() || null;
    let doc = null;
    if (hashQuery) {
      try {
        const q = new URLSearchParams(hashQuery);
        if (!subtab) subtab = q.get('subtab') || null;
        doc = q.get('doc') || null;
      } catch (_) {}
    }
    return { viewId, subtab, doc };
  }

  resolveTargetView() {
    if (typeof window !== 'undefined' && window.location.hash) {
      const fromHash = this.parseHash(window.location.hash);
      if (fromHash) return { ...fromHash, source: 'hash' };
    }
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) {
        const viewId = DASHBOARD_VIEW_MAP[tabParam.toLowerCase()] || tabParam;
        if (viewId && (DASHBOARD_VIEW_MAP[viewId] || document.getElementById(viewId))) {
          const urlParams = new URLSearchParams(window.location.search);
          return { viewId: DASHBOARD_VIEW_MAP[viewId] || viewId, subtab: urlParams.get('subtab'), doc: urlParams.get('doc'), source: 'query' };
        }
      }
    } catch (_) {}
    try {
      const saved = localStorage.getItem('dashboard_active_view');
      if (saved) {
        const viewId = DASHBOARD_VIEW_MAP[saved.toLowerCase()] || saved;
        if (viewId && document.getElementById(viewId)) return { viewId, subtab: null, doc: null, source: 'storage' };
      }
    } catch (_) {}
    return { viewId: 'runner-view', subtab: null, doc: null, source: 'default' };
  }

  activateView(targetViewId, options = {}) {
    if (!targetViewId) return;
    const tabBtn = document.querySelector(`.view-tab[data-view="${targetViewId}"]`);
    if (!tabBtn) return;
    try { localStorage.setItem('dashboard_active_view', targetViewId); } catch (_) {}

    const targetHash = '#/' + targetViewId;
    if (typeof window !== 'undefined' && window.location.hash !== targetHash && window.location.hash !== `#${targetViewId}`) {
      try {
        if (window.history?.replaceState) window.history.replaceState(null, '', targetHash);
        else window.location.hash = targetHash;
      } catch (_) {}
    }

    const currentActiveBtn = document.querySelector('.view-tab.active');
    if (currentActiveBtn?.dataset.view !== targetViewId || options.force) tabBtn.click();
    if (featureRegistry.getActiveViewId() !== targetViewId) featureRegistry.switchView(targetViewId);
    this._applySubtabs(targetViewId, options);
  }

  _applySubtabs(targetViewId, { subtab, doc } = {}) {
    const sTab = subtab || this._getSavedSubtab(targetViewId);
    if (targetViewId === 'docs-view' && doc) {
      setTimeout(() => { if (typeof window.loadDocFile === 'function') window.loadDocFile(doc); }, 150);
    } else if (targetViewId === 'docs-view' && sTab) {
      setTimeout(() => { if (typeof window.switchDocsSubtab === 'function') window.switchDocsSubtab(sTab); }, 150);
    } else if (targetViewId === 'settings-view' && sTab) {
      setTimeout(() => {
        const btn = document.querySelector(`.settings-subtab[data-subtab="${sTab}"]`);
        if (btn && !btn.classList.contains('active')) btn.click();
      }, 150);
    } else if (targetViewId === 'resources-view' && sTab) {
      setTimeout(() => { if (typeof window.switchResourceCategory === 'function') window.switchResourceCategory(sTab, true); }, 150);
    } else if (targetViewId === 'qa-view' && sTab) {
      setTimeout(() => {
        const btn = document.querySelector(`.qa-tab-btn[data-tab="${sTab}"]`);
        if (btn && !btn.classList.contains('active')) btn.click();
      }, 150);
    }
  }

  _getSavedSubtab(viewId) {
    try {
      if (viewId === 'settings-view') return localStorage.getItem('dashboard_settings_subtab');
      if (viewId === 'resources-view') return localStorage.getItem('dashboard_resources_category');
      if (viewId === 'docs-view') return localStorage.getItem('dashboard_docs_subtab');
      if (viewId === 'qa-view') return localStorage.getItem('dashboard_qa_subtab');
    } catch (_) {}
    return null;
  }

  _bindTrackingListeners() {
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.view-tab, [data-view]');
      if (tab?.getAttribute('data-view')) {
        const viewId = tab.getAttribute('data-view');
        try {
          localStorage.setItem('dashboard_active_view', viewId);
          const targetHash = '#/' + viewId;
          if (window.location.hash !== targetHash && window.location.hash !== `#${viewId}`) {
            if (window.history?.replaceState) window.history.replaceState(null, '', targetHash);
            else window.location.hash = targetHash;
          }
        } catch (_) {}
      }
      const setTab = e.target.closest('.settings-subtab');
      if (setTab?.dataset.subtab) try { localStorage.setItem('dashboard_settings_subtab', setTab.dataset.subtab); } catch (_) {}
      const resBtn = e.target.closest('.resource-seg-btn');
      if (resBtn?.dataset.category) try { localStorage.setItem('dashboard_resources_category', resBtn.dataset.category); } catch (_) {}
      const docsTab = e.target.closest('.docs-subtab');
      if (docsTab?.dataset.docsSubtab) try { localStorage.setItem('dashboard_docs_subtab', docsTab.dataset.docsSubtab); } catch (_) {}
      const qaBtn = e.target.closest('.qa-tab-btn');
      if (qaBtn?.dataset.tab) try { localStorage.setItem('dashboard_qa_subtab', qaBtn.dataset.tab); } catch (_) {}
      const runTab = e.target.closest('.runner-mode-tab');
      if (runTab?.dataset.mode) try { localStorage.setItem('dashboard_runner_mode', runTab.dataset.mode); } catch (_) {}
    });
  }

  _restoreInitialViewAndSubtabs() {
    try {
      const initial = this.resolveTargetView();
      if (!initial?.viewId) return;
      if (initial.viewId !== 'runner-view') {
        this.activateView(initial.viewId, { subtab: initial.subtab, doc: initial.doc, force: true });
      } else {
        featureRegistry.switchView('runner-view');
        try { localStorage.setItem('dashboard_active_view', 'runner-view'); } catch (_) {}
        if ((initial.source === 'hash' || initial.source === 'query') && window.location.hash !== '#/runner-view') {
          window.history?.replaceState?.(null, '', '#/runner-view');
        }
        const savedRunMode = localStorage.getItem('dashboard_runner_mode');
        if (savedRunMode && typeof window.setRunnerMode === 'function') window.setRunnerMode(savedRunMode);
      }
    } catch (e) {
      console.warn('[TabRouter] Restore error:', e);
    }
  }

  _bindHashChangeListener() {
    window.addEventListener('hashchange', () => {
      const fromHash = this.parseHash(window.location.hash);
      if (fromHash?.viewId && document.querySelector('.view-tab.active')?.dataset.view !== fromHash.viewId) {
        this.activateView(fromHash.viewId, { subtab: fromHash.subtab, doc: fromHash.doc });
      }
    });
  }
}

export const tabRouter = new TabRouter();
