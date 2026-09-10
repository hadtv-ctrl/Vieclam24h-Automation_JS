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

module.exports = { fixture, settle, deferred, session, response, posts };
