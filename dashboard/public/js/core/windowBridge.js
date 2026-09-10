/**
 * dashboard/public/js/core/windowBridge.js
 * Bidirectional bridge connecting ESM modules with legacy window globals.
 * Line budget: <= 150 lines.
 */

export class WindowBridge {
  constructor(targetWindow = window) {
    this._window = targetWindow;
    this._actions = new Map();
    this._window.__STUDIO_BRIDGE__ = this._window.__STUDIO_BRIDGE__ || {};
  }

  exposeAction(name, handler) {
    if (typeof handler !== 'function') throw new TypeError(`Action "${name}" must be a function.`);
    if (this._actions.has(name)) {
      console.warn(`[WindowBridge] Overwriting existing action: "${name}"`);
    }

    this._actions.set(name, handler);

    // Bind to window for inline onclick="..." handlers
    this._window[name] = (...args) => {
      try {
        return handler(...args);
      } catch (err) {
        console.error(`[WindowBridge] Error executing global action "${name}":`, err);
        throw err;
      }
    };

    this._window.__STUDIO_BRIDGE__[name] = this._window[name];
    return () => this.unexposeAction(name);
  }

  unexposeAction(name) {
    this._actions.delete(name);
    delete this._window[name];
    delete this._window.__STUDIO_BRIDGE__[name];
  }

  hasAction(name) {
    return this._actions.has(name) || typeof this._window[name] === 'function';
  }

  callAction(name, ...args) {
    if (!this.hasAction(name)) {
      throw new ReferenceError(`[WindowBridge] Action "${name}" is not registered on window.`);
    }
    const fn = this._actions.get(name) || this._window[name];
    return fn(...args);
  }

  listActions() {
    return Array.from(this._actions.keys());
  }
}

export const windowBridge = new WindowBridge();
