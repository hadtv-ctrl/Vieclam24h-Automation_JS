/**
 * dashboard/public/js/core/windowBridge.js
 * Bidirectional bridge connecting ESM modules with legacy window globals.
 * Line budget: <= 150 lines.
 */

export class WindowBridge {
  constructor(targetWindow = window) {
    this._window = targetWindow;
    this._actions = new Map();
    this._tokenCounter = 0;
    this._window.__STUDIO_BRIDGE__ = this._window.__STUDIO_BRIDGE__ || {};
  }

  exposeAction(name, handler) {
    if (typeof handler !== 'function') throw new TypeError(`Action "${name}" must be a function.`);
    if (this._actions.has(name)) {
      console.warn(`[WindowBridge] Overwriting existing action: "${name}"`);
    }

    const token = ++this._tokenCounter;
    this._actions.set(name, { handler, token });

    // Bind to window for inline onclick="..." handlers
    this._window[name] = (...args) => {
      try {
        const current = this._actions.get(name);
        return current ? current.handler(...args) : handler(...args);
      } catch (err) {
        console.error(`[WindowBridge] Error executing global action "${name}":`, err);
        throw err;
      }
    };

    this._window.__STUDIO_BRIDGE__[name] = this._window[name];
    return () => this.unexposeAction(name, token);
  }

  unexposeAction(name, expectedToken = null) {
    const current = this._actions.get(name);
    if (!current) return;
    if (expectedToken !== null && current.token !== expectedToken) {
      return; // Handled action was replaced by a newer owner token; do not delete replacement
    }
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
    const entry = this._actions.get(name);
    const fn = entry ? entry.handler : this._window[name];
    return fn(...args);
  }

  listActions() {
    return Array.from(this._actions.keys());
  }
}

export const windowBridge = new WindowBridge();
