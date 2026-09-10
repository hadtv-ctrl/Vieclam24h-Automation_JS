// master-process-disable-size-check: Scheduled for splitting in Plan 09 Phase 4
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'public/agent.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const session = (id, status = 'completed', extra = {}) => ({
  id, status, prompt: `Task ${id}`, events: [], changedFiles: [], summary: '', ...extra,
});

// Small DOM boundary fixture: exercise the shipped controller without a browser dependency.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.scrollHeight = 300;
    this.clientHeight = 300;
    this.scrollTop = 0;
    this.classList = { toggle() {} };
    this.textContent = '';
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('Agent content must be rendered as text.'); }
  replaceChildren(...children) { this.text = ''; this.children = children; this.value = ''; }
  append(...children) { this.children.push(...children); }
  add(option) { this.children.push(option); if (this.children.length === 1) this.value = option.value; }
  focus() { this.focused = true; }
  querySelectorAll(selector) {
    assert.equal(selector, 'details[open]');
    return this.children.filter(child => child.tagName === 'details' && child.open);
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  async emit(type, extra = {}) {
    const event = { preventDefault() {}, ...extra };
    await Promise.all((this.listeners.get(type) || []).map(handler => handler(event)));
  }
  requestSubmit() { return this.emit('submit'); }
}

function fixture({ visible = false, sessions = [], activeId = null } = {}) {
  const ids = [...source.matchAll(/byId\('([^']+)'\)/g)].map(match => match[1]);
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  delete elements['resource-editor'];
  delete elements['code-editor'];
  elements['agent-view'].hidden = !visible;
  elements['agent-prompt'].tagName = 'textarea';
  elements['agent-prompt'].maxLength = 8000;
  elements['agent-connection'].textContent = 'Đang kiểm tra Ollama…';
  elements['agent-start'].disabled = true;
  elements['agent-stop'].disabled = true;
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  const app = {
    elements, requests, timers, sessions,
    state: { available: true, models: [{ name: 'local-model' }], selectedModel: 'local-model', message: 'Ready', activeSessionId: activeId },
    reply: null,
    async fire(id, type = 'click', extra) { await elements[id].emit(type, extra); },
    async tick() {
      const [id, callback] = timers.entries().next().value || [];
      assert.ok(callback, 'Expected a pending poll');
      timers.delete(id);
      await callback();
    },
  };
  const window = new Element();
  app.unload = () => window.emit('beforeunload');
  vm.runInNewContext(source, {
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: selector => {
        assert.equal(selector, 'textarea');
        return Object.values(elements).filter(element => element.tagName === 'textarea');
      },
      createElement: tag => new Element(tag),
    },
    window,
    Option: function (label, value) { const option = new Element('option'); option.textContent = label; option.value = value; return option; },
    AbortSignal,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      const request = { url, ...options };
      requests.push(request);
      const custom = app.reply && await app.reply(request);
      if (custom instanceof Error) throw custom;
      if (custom !== undefined && custom !== null) return custom;
      let data;
      if (url === '/api/agent/status?refresh=1') data = app.state;
      else if (url === '/api/agent/sessions' && !options.method) data = { sessions: app.sessions };
      else {
        const found = app.sessions.find(item => url === `/api/agent/sessions/${item.id}`);
        assert.ok(found, `Unexpected request: ${options.method || 'GET'} ${url}`);
        data = { session: found };
      }
      return { ok: true, json: async () => data };
    },
  }, { filename: 'agent.js' });
  return app;
}

const response = (data, ok = true) => ({ ok, json: async () => data });
const posts = app => app.requests.filter(request => request.method === 'POST');

test('A visible AI tab initializes once; a hidden tab waits for activation', async () => {
  const visible = fixture({ visible: true });
  await settle();
  assert.deepEqual(visible.requests.map(request => request.url), ['/api/agent/status?refresh=1', '/api/agent/sessions']);
  assert.equal(visible.elements['agent-connection'].textContent, 'Ready');
  assert.equal(visible.elements['agent-start'].disabled, false);
  assert.equal(visible.elements['agent-history'].children.length, 1);
  assert.equal(visible.elements['agent-history'].value, '');

  const hidden = fixture();
  await settle();
  assert.equal(hidden.requests.length, 0);
  await hidden.fire('agent-tab');
  assert.equal(hidden.elements['agent-model'].value, 'local-model');
  assert.equal(hidden.elements['agent-start'].disabled, false);
  for (const element of Object.values(hidden.elements)) {
    for (const handlers of element.listeners.values()) assert.equal(handlers.length, 1);
  }
});

test('Refresh disables start, deduplicates activation, exposes connection failures and permits retry', async () => {
  const app = fixture();
  const pending = deferred();
  app.reply = request => request.url.includes('/status') ? pending.promise : undefined;
  app.elements['agent-prompt'].value = 'Fix tests';
  const refreshing = app.fire('agent-refresh');
  assert.equal(app.elements['agent-start'].disabled, true);
  assert.equal(app.elements['agent-refresh'].disabled, true);
  await app.fire('agent-tab');
  await app.fire('agent-form', 'submit');
  assert.equal(app.requests.length, 1);
  pending.resolve(new Error('private socket detail'));
  await refreshing;
  assert.equal(app.elements['agent-refresh'].disabled, false);
  assert.equal(app.elements['agent-start'].disabled, true);
  assert.equal(app.elements['agent-feedback'].hidden, false);
  assert.equal(app.elements['agent-connection'].textContent, app.elements['agent-feedback'].textContent);
  assert.doesNotMatch(app.elements['agent-feedback'].textContent, /private socket detail|Đang kiểm tra/);
  app.reply = null;
  await app.fire('agent-refresh');
  assert.equal(app.elements['agent-connection'].textContent, 'Ready');
  assert.equal(app.elements['agent-feedback'].hidden, true);
  assert.equal(app.elements['agent-start'].disabled, false);
});

test('Unavailable models and malformed API responses remain recoverable', async () => {
  const app = fixture();
  app.state = { ...app.state, available: false, models: [], selectedModel: '', message: 'Install a local model' };
  await app.fire('agent-tab');
  assert.equal(app.elements['agent-start'].disabled, true);
  assert.equal(app.elements['agent-model'].disabled, true);
  assert.equal(app.elements['agent-model'].value, '');
  app.elements['agent-prompt'].value = 'Fix tests';
  await app.fire('agent-form', 'submit');
  assert.equal(posts(app).length, 0);
  app.reply = () => ({ ok: true, json: async () => { throw new Error('raw syntax detail'); } });
  await app.fire('agent-refresh');
  assert.equal(app.elements['agent-feedback'].hidden, false);
  assert.doesNotMatch(app.elements['agent-feedback'].textContent, /raw syntax detail/);
  assert.equal(app.elements['agent-refresh'].disabled, false);
});

test('Submit rejects blank, oversized and dirty-editor input; the exact length boundary can run and stop', async () => {
  const app = fixture();
  await app.fire('agent-tab');
  for (const value of [' ', '\n\t', 'x'.repeat(8001)]) {
    app.elements['agent-prompt'].value = value;
    await app.fire('agent-form', 'submit');
    assert.equal(posts(app).length, 0);
    assert.equal(app.elements['agent-feedback'].hidden, false);
    assert.equal(app.elements['agent-prompt'].focused, true);
  }
  const editor = new Element('textarea');
  editor.__sharedEditor = { isDirty: () => true };
  app.elements.editor = editor;
  app.elements['agent-prompt'].value = 'x'.repeat(8000);
  await app.fire('agent-form', 'submit');
  assert.equal(posts(app).length, 0);
  delete app.elements.editor;

  app.reply = request => {
    if (request.method !== 'POST') return;
    const current = session('created', request.url.endsWith('/stop') ? 'stopped' : 'running');
    app.sessions = [current];
    return response({ session: current });
  };
  await app.fire('agent-form', 'submit');
  assert.equal(JSON.parse(posts(app)[0].body).prompt.length, 8000);
  assert.equal(posts(app)[0].headers['X-Dashboard-Agent'], '1');
  assert.equal(app.elements['agent-prompt'].readOnly, true);
  assert.equal(app.elements['agent-history'].disabled, true);
  assert.equal(app.elements['agent-stop'].disabled, false);
  await app.fire('agent-form', 'submit');
  assert.equal(posts(app).length, 1);
  await app.fire('agent-stop');
  assert.equal(posts(app)[1].url, '/api/agent/sessions/created/stop');
  assert.equal(app.elements['agent-start'].disabled, false);
  assert.equal(app.elements['agent-prompt'].readOnly, false);
  assert.equal(app.timers.size, 0);
});

test('A start conflict releases controls and supports a successful retry', async () => {
  const app = fixture();
  await app.fire('agent-tab');
  app.elements['agent-prompt'].value = 'Fix tests';
  app.reply = request => request.method === 'POST' ? response({ error: 'Another task is running' }, false) : undefined;
  await app.fire('agent-form', 'submit');
  assert.equal(app.elements['agent-feedback'].textContent, 'Another task is running');
  assert.equal(app.elements['agent-start'].disabled, false);
  assert.equal(app.elements['agent-prompt'].readOnly, false);
  app.reply = request => {
    if (request.method !== 'POST') return;
    app.sessions = [session('retry', 'running')];
    return response({ session: app.sessions[0] });
  };
  await app.fire('agent-form', 'submit');
  assert.equal(posts(app).length, 2);
  assert.equal(app.elements['agent-stop'].disabled, false);
  assert.equal(app.elements['agent-feedback'].hidden, true);
});

test('History changes render literal event text and update summary/file empty states', async () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  const first = session('first', 'completed', {
    prompt: unsafe, summary: unsafe, changedFiles: [{ kind: 'update', path: unsafe }],
    events: [{ id: 'message', type: 'message', text: unsafe }, { id: 'command', type: 'command', command: unsafe, output: unsafe, exitCode: 0 }],
  });
  const app = fixture({ sessions: [first, session('second')] });
  await app.fire('agent-tab');
  assert.equal(app.elements['agent-session-task'].textContent, unsafe);
  assert.equal(app.elements['agent-events'].children[0].textContent, unsafe);
  assert.equal(app.elements['agent-events'].children[1].children[1].textContent, unsafe);
  assert.equal(app.elements['agent-summary'].textContent, unsafe);
  assert.equal(app.elements['agent-summary-section'].hidden, false);
  assert.equal(app.elements['agent-files-section'].hidden, false);
  app.elements['agent-history'].value = 'second';
  await app.fire('agent-history', 'change');
  assert.equal(app.elements['agent-session-task'].textContent, 'Task second');
  assert.equal(app.elements['agent-summary-section'].hidden, true);
  assert.equal(app.elements['agent-files-section'].hidden, true);
  assert.equal(app.elements['agent-events'].children.length, 0);
  assert.equal(app.elements['agent-history'].disabled, false);
});

test('A stale poll cannot overwrite a refreshed session or reintroduce polling', async () => {
  const app = fixture({ sessions: [session('current', 'running')], activeId: 'current' });
  await app.fire('agent-tab');
  const pending = deferred();
  app.reply = request => request.url.endsWith('/current') ? pending.promise : undefined;
  const oldPoll = app.tick();
  app.reply = null;
  app.sessions = [session('current', 'completed', { summary: 'Latest result' })];
  app.state.activeSessionId = null;
  await app.fire('agent-refresh');
  pending.resolve(response({ session: session('current', 'running', { prompt: 'Stale task' }) }));
  await oldPoll;
  assert.equal(app.elements['agent-session-task'].textContent, 'Task current');
  assert.equal(app.elements['agent-summary'].textContent, 'Latest result');
  assert.equal(app.elements['agent-stop'].disabled, true);
  assert.equal(app.timers.size, 0);
});

test('Poll failures stop after five attempts; refresh reconnects and unload cancels polling', async () => {
  const app = fixture({ sessions: [session('running', 'running')], activeId: 'running' });
  await app.fire('agent-tab');
  app.reply = () => new Error('private transport detail');
  for (let attempt = 0; attempt < 5; attempt++) await app.tick();
  assert.equal(app.timers.size, 0);
  assert.match(app.elements['agent-feedback'].textContent, /Kiểm tra lại/);
  assert.doesNotMatch(app.elements['agent-feedback'].textContent, /private transport detail/);
  app.reply = null;
  await app.fire('agent-refresh');
  assert.equal(app.elements['agent-feedback'].hidden, true);
  assert.equal(app.timers.size, 1);
  await app.unload();
  assert.equal(app.timers.size, 0);
});

test('Token quota widget displays remaining percent, limit and session consumption', async () => {
  const app = fixture();
  app.state = {
    ...app.state,
    tokenQuota: {
      remainingPercent: 94,
      usedTokens: 60000,
      limitTokens: 1000000,
      remainingTokens: 940000,
      modelName: 'gemini-2.5-flash',
    },
  };
  await app.fire('agent-tab');
  assert.equal(app.elements['agent-quota-pill-percent'].textContent, '94%');
  assert.equal(app.elements['agent-quota-percent'].textContent, '94%');
  assert.equal(app.elements['agent-quota-model'].textContent, 'gemini-2.5-flash');
  assert.match(app.elements['agent-quota-used'].textContent, /60\.000|60,000/);

  const sessionWithTokens = session('token-task', 'completed', {
    tokenUsage: { promptTokens: 1500, completionTokens: 500, totalTokens: 2000 },
    tokenQuota: { remainingPercent: 88, usedTokens: 120000, limitTokens: 1000000, remainingTokens: 880000 },
  });
  app.sessions = [sessionWithTokens];
  app.elements['agent-history'].value = 'token-task';
  await app.fire('agent-history', 'change');
  assert.equal(app.elements['agent-quota-pill-percent'].textContent, '88%');
  assert.equal(app.elements['agent-quota-percent'].textContent, '88%');
  assert.match(app.elements['agent-quota-session-tokens'].textContent, /2\.000|2,000/);
  assert.match(app.elements['agent-summary-tokens'].textContent, /2\.000 tokens|2,000 tokens/);
});

