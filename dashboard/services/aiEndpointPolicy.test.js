'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCrossSiteRequest,
  mayUseServerKey,
  resolveModelsRequest,
  resolveTestConnection,
  sameEndpoint,
  serverBaseUrl,
  validateConfigBody,
} = require('./aiEndpointPolicy');

const SAVED_9ROUTER = { AI_PROVIDER: '9router', AI_BASE_URL: 'http://localhost:20128/v1', AI_API_KEY: 'server-key' };
const SAVED_OLLAMA = { AI_PROVIDER: 'custom', AI_BASE_URL: 'http://127.0.0.1:11434/v1', AI_API_KEY: 'server-key' };

test('sameEndpoint: localhost và 127.0.0.1 là cùng endpoint; khác cổng hoặc giao thức thì khác', () => {
  assert.equal(sameEndpoint('http://localhost:20128/v1', 'http://127.0.0.1:20128/other'), true);
  assert.equal(sameEndpoint('http://localhost:20128/v1', 'http://localhost:20129/v1'), false);
  assert.equal(sameEndpoint('http://api.openai.com/v1', 'https://api.openai.com/v1'), false);
  assert.equal(sameEndpoint('not a url', 'http://localhost:20128'), false);
});

test('serverBaseUrl: Base URL đã lưu, hoặc 9Router khi provider là 9router, còn lại rỗng', () => {
  assert.equal(serverBaseUrl(SAVED_OLLAMA), 'http://127.0.0.1:11434/v1');
  assert.equal(serverBaseUrl({ AI_PROVIDER: '9router' }), 'http://localhost:20128/v1');
  assert.equal(serverBaseUrl({ AI_PROVIDER: 'gemini' }), '');
});

test('resolveModelsRequest: key server đi kèm khi đích là endpoint đã lưu', () => {
  const result = resolveModelsRequest({ baseURL: 'http://127.0.0.1:20128/v1/', env: SAVED_9ROUTER });
  assert.deepEqual(result, { ok: true, base: 'http://127.0.0.1:20128/v1', key: 'server-key' });
});

test('resolveModelsRequest: không có baseURL thì dùng Base URL đã lưu', () => {
  const result = resolveModelsRequest({ env: SAVED_OLLAMA });
  assert.equal(result.base, 'http://127.0.0.1:11434/v1');
  assert.equal(result.key, 'server-key');
});

test('resolveModelsRequest: host ngoài allowlist bị chặn trước khi gọi mạng', () => {
  for (const baseURL of ['http://attacker.example/v1', 'http://169.254.169.254/latest', 'http://localhost:8080/v1']) {
    const result = resolveModelsRequest({ baseURL, env: SAVED_9ROUTER });
    assert.equal(result.ok, false, baseURL);
    assert.equal(result.status, 400);
  }
});

test('resolveModelsRequest: giao thức khác http/https bị chặn', () => {
  for (const baseURL of ['file:///etc/passwd', 'ftp://localhost:20128/', 'javascript:alert(1)']) {
    assert.equal(resolveModelsRequest({ baseURL, env: SAVED_9ROUTER }).ok, false, baseURL);
  }
});

test('resolveModelsRequest: API chính thức được gọi nhưng không mang key của endpoint khác', () => {
  const result = resolveModelsRequest({ baseURL: 'https://api.openai.com/v1', env: SAVED_9ROUTER });
  assert.equal(result.ok, true);
  assert.equal(result.key, '');
});

test('resolveModelsRequest: 9Router vẫn gọi được khi .env đang lưu provider khác, không kèm key server', () => {
  const result = resolveModelsRequest({ baseURL: 'http://localhost:20128/v1', env: SAVED_OLLAMA });
  assert.equal(result.ok, true);
  assert.equal(result.key, '');
});

test('resolveModelsRequest: key cá nhân từ header được ưu tiên', () => {
  const result = resolveModelsRequest({ baseURL: 'http://localhost:20128/v1', clientKey: 'personal-key', env: SAVED_9ROUTER });
  assert.equal(result.key, 'personal-key');
});

test('resolveModelsRequest: apiKey trên query string bị từ chối', () => {
  const result = resolveModelsRequest({ baseURL: 'http://localhost:20128/v1', queryKey: 'leaked', env: SAVED_9ROUTER });
  assert.deepEqual([result.ok, result.status], [false, 400]);
});

test('resolveTestConnection: key người dùng nhập được thử trên endpoint mới', () => {
  const result = resolveTestConnection({
    body: { provider: 'custom', baseURL: 'http://10.0.0.5:8000/v1', apiKey: 'typed-key', model: 'm' },
    env: SAVED_9ROUTER,
  });
  assert.deepEqual(result, { ok: true, provider: 'custom', baseURL: 'http://10.0.0.5:8000/v1', model: 'm', apiKey: 'typed-key' });
});

test('resolveTestConnection: key .env không được gửi tới endpoint khác với endpoint đã lưu', () => {
  for (const apiKey of [undefined, '', 'server...-key']) {
    const result = resolveTestConnection({ body: { baseURL: 'http://attacker.example/v1', apiKey }, env: SAVED_9ROUTER });
    assert.deepEqual([result.ok, result.status], [false, 400], String(apiKey));
  }
});

test('resolveTestConnection: key .env dùng được với endpoint đã lưu hoặc khi để trống Base URL', () => {
  const same = resolveTestConnection({ body: { provider: '9router', baseURL: 'http://127.0.0.1:20128/v1' }, env: SAVED_9ROUTER });
  assert.equal(same.apiKey, 'server-key');
  const empty = resolveTestConnection({ body: { provider: '9router' }, env: SAVED_9ROUTER });
  assert.deepEqual([empty.baseURL, empty.apiKey], ['http://localhost:20128/v1', 'server-key']);
});

test('resolveTestConnection: Base URL sai định dạng bị chặn', () => {
  const result = resolveTestConnection({ body: { baseURL: 'localhost:20128', apiKey: 'typed-key' }, env: {} });
  assert.equal(result.ok, false);
});

test('validateConfigBody: ký tự xuống dòng bị chặn để không chèn thêm biến vào .env', () => {
  for (const field of ['provider', 'baseURL', 'model', 'apiKey']) {
    for (const bad of ['a\nNODE_OPTIONS=--require=x', 'a\rb', 'a\0b']) {
      const result = validateConfigBody({ [field]: bad });
      assert.deepEqual([result.ok, result.status], [false, 400], `${field}: ${JSON.stringify(bad)}`);
    }
  }
});

test('validateConfigBody: cấu hình hợp lệ, Base URL rỗng và endpoint tùy chỉnh đều qua', () => {
  assert.equal(validateConfigBody({ provider: 'custom', baseURL: 'http://10.0.0.5:8000/v1', model: 'm', apiKey: 'k' }).ok, true);
  assert.equal(validateConfigBody({ provider: 'gemini', baseURL: '' }).ok, true);
  assert.equal(validateConfigBody({}).ok, true);
  assert.equal(validateConfigBody({ baseURL: 'ftp://x' }).ok, false);
});

test('isCrossSiteRequest: request từ chính dashboard và từ công cụ dòng lệnh được nhận', () => {
  assert.equal(isCrossSiteRequest({ host: '127.0.0.1:4173' }), false);
  assert.equal(isCrossSiteRequest({ host: 'localhost:4173', origin: 'http://localhost:4173', 'sec-fetch-site': 'same-origin' }), false);
  assert.equal(isCrossSiteRequest({ host: '[::1]:4173', 'sec-fetch-site': 'none' }), false);
});

test('isCrossSiteRequest: trang khác, cổng localhost khác, origin null và DNS rebinding bị chặn', () => {
  assert.equal(isCrossSiteRequest({ host: '127.0.0.1:4173', 'sec-fetch-site': 'cross-site' }), true);
  assert.equal(isCrossSiteRequest({ host: '127.0.0.1:4173', 'sec-fetch-site': 'same-site' }), true);
  assert.equal(isCrossSiteRequest({ host: '127.0.0.1:4173', origin: 'http://localhost:3000' }), true);
  assert.equal(isCrossSiteRequest({ host: '127.0.0.1:4173', origin: 'null' }), true);
  assert.equal(isCrossSiteRequest({ host: 'attacker.example:4173', origin: 'http://attacker.example:4173' }), true);
  assert.equal(isCrossSiteRequest({}), true);
});

test('mayUseServerKey: chỉ khi request không nêu endpoint hoặc nêu đúng endpoint đã lưu', () => {
  assert.equal(mayUseServerKey(undefined, SAVED_9ROUTER), true);
  assert.equal(mayUseServerKey('', SAVED_9ROUTER), true);
  assert.equal(mayUseServerKey('http://127.0.0.1:20128/v1', SAVED_9ROUTER), true);
  assert.equal(mayUseServerKey('http://attacker.example/v1', SAVED_9ROUTER), false);
  assert.equal(mayUseServerKey('https://api.openai.com/v1', SAVED_9ROUTER), false);
  assert.equal(mayUseServerKey('http://localhost:20128/v1', { AI_PROVIDER: 'gemini' }), false);
});
