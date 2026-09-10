/**
 * dashboard/public/js/main.js
 * Master ESM Bootstrap Entrypoint for Studio Modular Architecture (Plan 09 Phase 4).
 * Line budget: <= 180 lines.
 */

import { eventBus } from './core/eventBus.js';
import { stateStore } from './core/stateStore.js';
import { windowBridge } from './core/windowBridge.js';
import { featureRegistry } from './core/featureRegistry.js';
import { apiClient } from './core/apiClient.js';
import { templateLoader } from './core/templateLoader.js';
import { editorSession } from './components/editor/editorSession.js';
import { sharedShell } from './components/shell/sharedShell.js';
import { legacyAdapter } from './legacy/legacyAdapter.js';

// 1. Import all 13 Feature Slices (Phase 4.1 - 4.8)
import { dataSlice } from './views/data/dataSlice.js';
import { suitesSlice } from './views/suites/suitesSlice.js';
import { fixturesSlice } from './views/fixtures/fixturesSlice.js';
import { pagesSlice } from './views/pages/pagesSlice.js';
import { bddSlice } from './views/bdd/bddSlice.js';
import { runnerSlice } from './views/runner/runnerSlice.js';
import { recorderSlice } from './views/recorder/recorderSlice.js';
import { gitSlice } from './views/git/gitSlice.js';
import { agentSlice } from './views/agent/agentSlice.js';
import { resourcesSlice } from './views/resources/resourcesSlice.js';
import { docsSlice } from './views/docs/docsSlice.js';
import { compareSlice } from './views/compare/compareSlice.js';
import { settingsSlice } from './views/settings/settingsSlice.js';

const SLICE_REGISTRY = {
  'data-view': { slice: dataSlice, title: 'Dữ liệu test' },
  'suites-view': { slice: suitesSlice, title: 'Kịch bản Test Suite' },
  'fixtures-view': { slice: fixturesSlice, title: 'Custom Fixtures' },
  'page-manager-view': { slice: pagesSlice, title: 'Quản lý Page' },
  'builder-view': { slice: bddSlice, title: 'Kịch bản BDD' },
  'runner-view': { slice: runnerSlice, title: 'Chạy test' },
  'recorder-view': { slice: recorderSlice, title: 'Ghi kịch bản UI' },
  'git-view': { slice: gitSlice, title: 'Đồng bộ Git' },
  'agent-view': { slice: agentSlice, title: 'AI Agent' },
  'resources-view': { slice: resourcesSlice, title: 'Báo cáo & Tài nguyên' },
  'docs-view': { slice: docsSlice, title: 'Hướng dẫn' },
  'compare-view': { slice: compareSlice, title: 'So sánh ảnh' },
  'settings-view': { slice: settingsSlice, title: 'Cấu hình hệ thống' },
};

// 2. Register all 13 Studio Views with FeatureRegistry
Object.entries(SLICE_REGISTRY).forEach(([id, { slice, title }]) => {
  featureRegistry.registerView(id, {
    id,
    title,
    isLegacy: false,
    mount: () => slice.mount(),
    unmount: () => slice.unmount(),
  });
});

// 3. Initialize Shared Shell & Legacy Adapter
sharedShell.init();
legacyAdapter.init();

// 4. Expose Studio Core Foundation on Window
if (typeof window !== 'undefined') {
  window.__STUDIO_CORE__ = {
    version: '5.0.0-modular',
    eventBus,
    stateStore,
    windowBridge,
    featureRegistry,
    apiClient,
    templateLoader,
    editorSession,
    sharedShell,
    slices: {
      data: dataSlice,
      suites: suitesSlice,
      fixtures: fixturesSlice,
      pages: pagesSlice,
      bdd: bddSlice,
      runner: runnerSlice,
      recorder: recorderSlice,
      git: gitSlice,
      agent: agentSlice,
      resources: resourcesSlice,
      docs: docsSlice,
      compare: compareSlice,
      settings: settingsSlice,
    },
  };
  console.log('[Studio Core] All 13 Feature Slices, Shared Shell & Template Loader active.');
}

export {
  eventBus,
  stateStore,
  windowBridge,
  featureRegistry,
  apiClient,
  templateLoader,
  editorSession,
  sharedShell,
  dataSlice,
  suitesSlice,
  fixturesSlice,
  pagesSlice,
  bddSlice,
  runnerSlice,
  recorderSlice,
  gitSlice,
  agentSlice,
  resourcesSlice,
  docsSlice,
  compareSlice,
  settingsSlice,
};
