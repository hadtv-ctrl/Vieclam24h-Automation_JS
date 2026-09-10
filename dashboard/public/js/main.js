/**
 * dashboard/public/js/main.js
 * Master ESM Bootstrap Entrypoint for Studio Modular Architecture.
 * Line budget: <= 180 lines.
 */

import { eventBus } from './core/eventBus.js';
import { stateStore } from './core/stateStore.js';
import { windowBridge } from './core/windowBridge.js';
import { featureRegistry } from './core/featureRegistry.js';
import { apiClient } from './core/apiClient.js';
import { editorSession } from './components/editor/editorSession.js';
import { legacyAdapter } from './legacy/legacyAdapter.js';

// 1. Register the 13 Studio Views from Inventory
const INVENTORY_VIEWS = [
  { id: 'runner-view', title: 'Chạy test' },
  { id: 'builder-view', title: 'Kịch bản BDD' },
  { id: 'page-manager-view', title: 'Quản lý Page' },
  { id: 'resources-view', title: 'Báo cáo & Tài nguyên' },
  { id: 'docs-view', title: 'Hướng dẫn' },
  { id: 'agent-view', title: 'AI Agent' },
  { id: 'suites-view', title: 'Kịch bản Test Suite' },
  { id: 'recorder-view', title: 'Ghi kịch bản UI' },
  { id: 'data-view', title: 'Dữ liệu test' },
  { id: 'git-view', title: 'Đồng bộ Git' },
  { id: 'fixtures-view', title: 'Custom Fixtures' },
  { id: 'settings-view', title: 'Cấu hình hệ thống' },
  { id: 'compare-view', title: 'So sánh ảnh' },
];

INVENTORY_VIEWS.forEach((viewDef) => {
  featureRegistry.registerView(viewDef.id, {
    ...viewDef,
    isLegacy: true,
  });
});

// 2. Initialize Legacy Compatibility Adapter
legacyAdapter.init();

// 3. Expose Studio Core Foundation for Backward Compatibility & DevTools inspection
if (typeof window !== 'undefined') {
  window.__STUDIO_CORE__ = {
    version: '5.0.0-modular',
    eventBus,
    stateStore,
    windowBridge,
    featureRegistry,
    apiClient,
    editorSession,
  };
  console.log('[Studio Core] Modular Architecture Foundation initialized.');
}

export {
  eventBus,
  stateStore,
  windowBridge,
  featureRegistry,
  apiClient,
  editorSession,
};
