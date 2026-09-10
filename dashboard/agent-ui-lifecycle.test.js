const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, deferred, session, response, posts } = require('./agent-ui-fixture');

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
