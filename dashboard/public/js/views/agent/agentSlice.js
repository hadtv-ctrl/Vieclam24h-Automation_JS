/**
 * dashboard/public/js/views/agent/agentSlice.js
 * AI Copilot & Autonomous Agent Feature Slice (Phase 4.7). Budget <= 120 lines.
 */
import { windowBridge } from '../../core/windowBridge.js';

export class AgentSlice {
  constructor() {
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._registerBridgeActions();
    if (typeof window.initAgentView === 'function') {
      try {
        await window.initAgentView();
      } catch (err) {
        console.error('[AgentSlice] Error mounting agent view:', err);
      }
    }
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _registerBridgeActions() {
    const reg = (name, fn) => this._disposers.push(windowBridge.exposeAction(name, fn));
    reg('refreshAgent', () => {
      if (typeof window.initAgentView === 'function') return window.initAgentView();
    });
  }
}

export const agentSlice = new AgentSlice();
