const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, settle, deferred, session, response, posts } = require('./agent-ui-fixture');

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
  const editor = { __sharedEditor: { isDirty: () => true }, tagName: 'textarea' };
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
