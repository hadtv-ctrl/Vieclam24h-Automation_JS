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

  getState() {
    return { ...this._state };
  }

  setState(partialState, actionSource = 'unknown') {
    const prevState = { ...this._state };
    this._state = { ...this._state, ...partialState };
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
