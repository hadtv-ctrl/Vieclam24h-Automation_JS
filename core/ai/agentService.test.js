const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAgentService, MAX_PROMPT } = require('./agentService');
const { resetLimitsForTesting } = require('./gateway/limits');

function response(body, ok = true, status = 200, headers = {}) {
  return {
    ok,
    status,
    headers: { get: (k) => headers[k] || headers[k.toLowerCase()] || null },
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body)
  };
}

test('Gemini status requires an API key and exposes configured provider', () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const service = createAgentService({ root, env: {} });
  assert.equal(service.status().available, false);
  assert.equal(service.status().provider, 'Gemini API');
  fs.rmSync(root, { recursive: true, force: true });
});

test('Gemini agent completes a text response without Codex or Ollama', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const requests = [];
  const service = createAgentService({
    root,
    env: { GEMINI_API_KEY: 'test-key', DASHBOARD_GEMINI_MODEL: 'gemini-test' },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response({ candidates: [{ content: { role: 'model', parts: [{ text: 'Đã kiểm tra xong.' }] } }] });
    }
  });
  const session = await service.start({ prompt: 'Kiểm tra trạng thái Agent' });
  for (let attempt = 0; attempt < 50 && service.isRunning(); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
  const result = service.get(session.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.summary, 'Đã kiểm tra xong.');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /gemini-test:generateContent/);
  assert.doesNotMatch(JSON.stringify(result), /test-key|OLLAMA|Codex/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Gemini agent validates prompt length and reports API failures', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const service = createAgentService({
    root,
    env: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async () => response({ error: { message: 'quota exceeded' } }, false, 429)
  });
  await assert.rejects(service.start({ prompt: 'x'.repeat(MAX_PROMPT + 1) }), /1 đến/);
  const session = await service.start({ prompt: 'Fail safely' });
  for (let attempt = 0; attempt < 50 && service.isRunning(); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(service.get(session.id).status, 'failed');
  assert.match(service.get(session.id).error, /quota exceeded/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Multi-provider supports OpenAI-compatible agent run and clientConfig override', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const requests = [];
  const service = createAgentService({
    root,
    env: {},
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response({ choices: [{ message: { role: 'assistant', content: 'OpenAI đã hoàn thành.' } }] });
    },
  });
  const session = await service.start({
    prompt: 'Kiểm tra OpenAI',
    clientConfig: { provider: 'openai', apiKey: 'sk-test-client', model: 'gpt-4o-mini' },
  });
  for (let attempt = 0; attempt < 50 && service.isRunning(); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
  const result = service.get(session.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.summary, 'OpenAI đã hoàn thành.');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /api\.openai\.com\/v1\/chat\/completions/);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer sk-test-client');
  fs.rmSync(root, { recursive: true, force: true });
});

test('testConnection checks Gemini and OpenAI endpoints successfully', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const service = createAgentService({
    root,
    env: {},
    fetchImpl: async () => response({ ok: true }),
  });
  const geminiRes = await service.testConnection({ provider: 'gemini', apiKey: 'test-key' });
  assert.equal(geminiRes.success, true);
  assert.match(geminiRes.message, /Google Gemini/);

  const openAiRes = await service.testConnection({ provider: 'openai', apiKey: 'sk-test' });
  assert.equal(openAiRes.success, true);
  assert.match(openAiRes.message, /openai/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Token quota reports percentage and tracks consumed tokens across turns', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const service = createAgentService({
    root,
    env: { GEMINI_API_KEY: 'test-key', DASHBOARD_GEMINI_MODEL: 'gemini-2.5-flash' },
    fetchImpl: async () => response({
      candidates: [{ content: { role: 'model', parts: [{ text: 'Phân tích xong.' }] } }],
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, totalTokenCount: 1500 },
    }),
  });

  const initialStatus = service.status();
  assert.ok(initialStatus.tokenQuota);
  assert.equal(initialStatus.tokenQuota.remainingPercent, 100);
  assert.equal(initialStatus.tokenQuota.limitTokens, 1000000);
  assert.equal(initialStatus.tokenQuota.usedTokens, 0);

  const session = await service.start({ prompt: 'Kiểm tra token quota' });
  for (let attempt = 0; attempt < 50 && service.isRunning(); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));

  const result = service.get(session.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.tokenUsage.promptTokens, 1200);
  assert.equal(result.tokenUsage.completionTokens, 300);
  assert.equal(result.tokenUsage.totalTokens, 1500);
  assert.ok(result.tokenQuota);
  assert.equal(result.tokenQuota.usedTokens, 1500);
  assert.equal(result.tokenQuota.remainingTokens, 998500);
  assert.equal(result.tokenQuota.remainingPercent, 100);

  fs.rmSync(root, { recursive: true, force: true });
});

test('inlineSuggest returns stripped code suggestion and tracks tokens', async () => {
  resetLimitsForTesting();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-agent-'));
  const service = createAgentService({
    root,
    env: { GEMINI_API_KEY: 'test-key', DASHBOARD_GEMINI_MODEL: 'gemini-2.5-flash' },
    fetchImpl: async () => response({
      candidates: [{ content: { role: 'model', parts: [{ text: '```javascript\nLoginPage(page);\n```' }] } }],
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 20, totalTokenCount: 170 },
    }),
  });

  const empty = await service.inlineSuggest({ prefix: '' });
  assert.equal(empty.suggestion, '');

  const result = await service.inlineSuggest({
    prefix: 'const loginPage = new ',
    suffix: ';',
    language: 'javascript',
  });

  assert.equal(result.success, true);
  assert.equal(result.suggestion, 'LoginPage(page);');
  assert.equal(result.tokensUsed, 170);

  fs.rmSync(root, { recursive: true, force: true });
});




