/**
 * dashboard/public/js/core/eventBus.js
 * Decoupled Pub/Sub Event Bus for Studio slices and legacy coexistence.
 * Line budget: <= 150 lines.
 */

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (typeof callback !== 'function') throw new TypeError('Event callback must be a function');
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const set = this._listeners.get(event);
    set.add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const unsub = this.on(event, (...args) => {
      unsub();
      callback(...args);
    });
    return unsub;
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return;
    const set = this._listeners.get(event);
    set.delete(callback);
    if (set.size === 0) this._listeners.delete(event);
  }

  emit(event, payload = null) {
    if (!this._listeners.has(event)) return;
    const callbacks = Array.from(this._listeners.get(event));
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    }
  }

  clear(event = null) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  listenerCount(event) {
    return this._listeners.has(event) ? this._listeners.get(event).size : 0;
  }
}

export const eventBus = new EventBus();
