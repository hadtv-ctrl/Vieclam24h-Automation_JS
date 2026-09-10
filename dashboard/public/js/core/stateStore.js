/**
 * dashboard/public/js/core/stateStore.js
 * Centralized reactive state store with single ownership & mutation guard.
 * Line budget: <= 150 lines.
 */

export class StateStore {
  constructor(initialState = {}) {
    this._state = {
      activeView: 'runner-view',
      runner: { status: 'idle', activeRun: null, logs: [] },
      editor: { activeFile: null, isDirty: false, language: 'javascript' },
      mutations: new Set(),
      ...initialState,
    };
    this._subscribers = new Set();
  }

  _cloneState(source) {
    const clone = {};
    for (const [key, value] of Object.entries(source)) {
      if (value instanceof Set) {
        clone[key] = new Set(value);
      } else if (value && typeof value === 'object') {
        clone[key] = JSON.parse(JSON.stringify(value));
      } else {
        clone[key] = value;
      }
    }
    return clone;
  }

  getState() {
    return this._cloneState(this._state);
  }

  setState(partialState, actionSource = 'unknown') {
    const prevState = this.getState();
    const nextState = { ...this._state };
    for (const [key, value] of Object.entries(partialState)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set)) {
        nextState[key] = { ...(nextState[key] || {}), ...JSON.parse(JSON.stringify(value)) };
      } else if (value instanceof Set) {
        nextState[key] = new Set(value);
      } else if (Array.isArray(value)) {
        nextState[key] = JSON.parse(JSON.stringify(value));
      } else {
        nextState[key] = value;
      }
    }
    this._state = nextState;
    this._notify(prevState, actionSource);
    return this.getState();
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function');
    this._subscribers.add(listener);
    return () => this._subscribers.delete(listener);
  }

  acquireLock(lockKey) {
    if (this._state.mutations.has(lockKey)) {
      return false; // Already locked, prevents race conditions
    }
    this._state.mutations.add(lockKey);
    return true;
  }

  releaseLock(lockKey) {
    return this._state.mutations.delete(lockKey);
  }

  isLocked(lockKey) {
    return this._state.mutations.has(lockKey);
  }

  async runExclusive(lockKey, asyncFn) {
    if (!this.acquireLock(lockKey)) {
      throw new Error(`[StateStore] Concurrency conflict: Mutation "${lockKey}" is already in progress.`);
    }
    try {
      return await asyncFn();
    } finally {
      this.releaseLock(lockKey);
    }
  }

  _notify(prevState, actionSource) {
    const currentState = this.getState();
    for (const subscriber of this._subscribers) {
      try {
        subscriber(currentState, prevState, actionSource);
      } catch (err) {
        console.error(`[StateStore] Subscriber error from "${actionSource}":`, err);
      }
    }
  }
}

export const stateStore = new StateStore();
