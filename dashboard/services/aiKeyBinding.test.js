'use strict';

/**
 * The .env key must never travel to an endpoint named by the request. Every QA service that
 * calls an AI provider takes a baseURL from the request (clientConfig or payload), so each one
 * is exercised against two fake providers: the saved endpoint and an attacker-chosen one.
 * Features that run on rules (arbitration, test-script scaffolding, default analysis) must reach neither.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { inferWithAi, extractScaffoldFromRaw } = require('./qaInferenceService');
const { analyzeRequirement } = require('./qaRequirementAnalyzerService');
const { arbitrateConflict } = require('./qaConflictService');

const SERVER_KEY = 'fixture-server-key';

function startFakeProvider() {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push({ url: req.url, authorization: req.headers.authorization || '' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '{}' } }] }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      calls,
      base: `http://127.0.0.1:${server.address().port}/v1`,
      stop: () => new Promise((done) => server.close(done)),
    }));
  });
}

function makeRepo(savedBase, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-key-binding-'));
  const all = { '.env': `AI_PROVIDER=custom\nAI_BASE_URL=${savedBase}\nAI_MODEL=fake-model\nAI_API_KEY=${SERVER_KEY}\n`, ...files };
  for (const [rel, content] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content, 'utf8');
  }
  return root;
}

const CONFLICT_FILES = {
  'requirements/REQ-001.md': '# REQ-001\n\n- AC-001: Given a, When b, Then c.\n- AC-003: Given d, When e, Then f.\n',
  'test-cases/REQ-001.md': '# TC\n\n| Requirement | Acceptance criterion | Test case | Automation | Priority |\n|---|---|---|---|---|\n| REQ-001 | AC-003 | TC-011 | Yes | P1 |\n',
  'tests/login.spec.js': "test('TC-011 @AC-009', async () => { expect(1).toBe(1); });\n",
};

const INFER_ARGS = { reqId: 'REQ-001', reqContent: '# REQ-001', decidedQuestions: [], existingTcIds: [], existingTcTitles: [], acs: [] };

let saved;
let other;
test.before(async () => { saved = await startFakeProvider(); other = await startFakeProvider(); });
test.after(async () => { await saved.stop(); await other.stop(); });
test.beforeEach(() => { saved.calls.length = 0; other.calls.length = 0; });

async function withRepo(files, fn) {
  const root = makeRepo(saved.base, files);
  try { return await fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('inferWithAi: baseURL từ request không nhận key .env', async () => {
  await withRepo({}, async (root) => {
    await assert.rejects(inferWithAi({ ...INFER_ARGS, root, clientConfig: { baseURL: other.base } }), /Chưa cấu hình API Key/);
    assert.equal(other.calls.length, 0);
  });
});

test('inferWithAi: không nêu baseURL thì key .env đi tới endpoint đã lưu', async () => {
  await withRepo({}, async (root) => {
    await inferWithAi({ ...INFER_ARGS, root }).catch(() => {});
    assert.deepEqual(saved.calls.map((c) => c.authorization), [`Bearer ${SERVER_KEY}`]);
  });
});

test('inferWithAi: key người dùng tự nhập được gửi tới endpoint họ chọn', async () => {
  await withRepo({}, async (root) => {
    await inferWithAi({ ...INFER_ARGS, root, clientConfig: { baseURL: other.base, apiKey: 'typed-key' } }).catch(() => {});
    assert.deepEqual(other.calls.map((c) => c.authorization), ['Bearer typed-key']);
  });
});

test('extractScaffoldFromRaw: payload.baseURL lạ thì rơi về heuristic, không gọi ra ngoài', async () => {
  await withRepo({}, async (root) => {
    const res = await extractScaffoldFromRaw(root, { rawContent: 'Người dùng đăng nhập bằng email.', baseURL: other.base, provider: 'openai' });
    assert.ok(res);
    assert.equal(other.calls.length, 0);
  });
});

test('extractScaffoldFromRaw: không nêu baseURL thì dùng endpoint đã lưu', async () => {
  await withRepo({}, async (root) => {
    await extractScaffoldFromRaw(root, { rawContent: 'Người dùng đăng nhập bằng email.' }).catch(() => {});
    assert.deepEqual(saved.calls.map((c) => c.authorization), [`Bearer ${SERVER_KEY}`]);
  });
});

test('analyzeRequirement: clientConfig.baseURL lạ thì rơi về heuristic, không gọi ra ngoài', async () => {
  await withRepo({}, async (root) => {
    const res = await analyzeRequirement({ root, rawText: 'Đăng nhập bằng email', mode: 'ai', clientConfig: { baseURL: other.base }, scanExisting: false });
    assert.match(res.fallbackNotice, /Heuristic/);
    assert.equal(other.calls.length, 0);
  });
});

test('analyzeRequirement: mode ai với key .env gọi đúng endpoint đã lưu', async () => {
  await withRepo({}, async (root) => {
    await analyzeRequirement({ root, rawText: 'Đăng nhập bằng email', mode: 'ai', scanExisting: false });
    assert.deepEqual(saved.calls.map((c) => c.authorization), [`Bearer ${SERVER_KEY}`]);
  });
});

test('analyzeRequirement: không nêu mode thì chạy luật, không gọi ra ngoài', async () => {
  await withRepo({}, async (root) => {
    const res = await analyzeRequirement({ root, rawText: 'Đăng nhập bằng email', scanExisting: false });
    assert.equal(res.engine, 'heuristic');
    assert.equal(saved.calls.length + other.calls.length, 0);
  });
});

test('extractScaffoldFromRaw: test script được đọc bằng code, không gọi AI dù có key .env', async () => {
  await withRepo({}, async (root) => {
    const script = "const { test, expect } = require('@playwright/test');\ntest('TC-001 - AC-001 đăng nhập', async ({ page }) => { await expect(page).toHaveURL(/login/); });\n";
    const res = await extractScaffoldFromRaw(root, { rawContent: script });
    assert.equal(res.engine, 'heuristic');
    assert.equal(saved.calls.length + other.calls.length, 0);
  });
});

test('arbitrateConflict: phân xử bằng luật, không gọi provider nào dù có key .env', async () => {
  await withRepo(CONFLICT_FILES, async (root) => {
    const res = arbitrateConflict({ root, tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(res.engine, 'heuristic');
    assert.equal(res.recommendation, 'sync_spec_to_doc');
    assert.equal(saved.calls.length + other.calls.length, 0);
  });
});
