// master-process-disable-size-check: QA Traceability Conflict resolution comprehensive test suite
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  parseConflictDetail,
  getConflictState,
  getConflictContext,
  resolveConflict,
  arbitrateWithAi,
  escalateConflictToDecision,
  rewriteAcRun,
  rewriteDocText,
  parseAiVerdict,
} = require('./qaConflictService');
const { getTrace } = require('./qaService');

const REQ = `# REQ-001 Đăng nhập

- AC-001: Given người dùng hợp lệ, When đăng nhập, Then vào trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
- AC-003: Given chưa đăng nhập, When mở trang riêng, Then bị chặn.
`;

function makeRepo(files, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-conflict-'));
  if (config) files['core/config/dashboardConfig.json'] = JSON.stringify(config);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return root;
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });
const conflictsOf = (root) => {
  const t = getTrace(root);
  return ['major', 'minor', 'info'].flatMap((k) => (t.findings && t.findings[k]) || [])
    .filter((f) => f.kind === 'ac-lech-giua-tai-lieu-va-spec');
};

const table = (rows) => `# Test Cases REQ-001

| Requirement | Acceptance criterion | Test case | Automation | Priority |
|---|---|---|---|---|
${rows.join('\n')}
`;

test('parseConflictDetail: bóc nhiều AC và tính phần chênh hai phía', () => {
  const p = parseConflictDetail('tests/a.spec.js: TC-011 ghi AC-001,AC-002 nhưng tài liệu khai AC-001,AC-003');
  assert.equal(p.tcId, 'TC-011');
  assert.deepEqual(p.specAcs, ['AC-001', 'AC-002']);
  assert.deepEqual(p.specOnly, ['AC-002']);
  assert.deepEqual(p.docOnly, ['AC-003']);
  assert.equal(parseConflictDetail('tests\\b.spec.js: TC-AUTH-001 ghi AC-1 nhưng tài liệu khai AC-2').specFile, 'tests/b.spec.js');
  assert.equal(parseConflictDetail('rác'), null);
  assert.equal(parseConflictDetail(null), null);
});

test('getTrace: finding xung đột mang sẵn dữ liệu cấu trúc cho UI', () => {
  const root = makeRepo({
    'requirements/REQ-001.md': REQ,
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-002 sai mật khẩu', async () => { expect(1).toBe(1); });\n",
  });
  try {
    const [f] = conflictsOf(root);
    assert.ok(f && f.conflict);
    assert.equal(f.conflict.specFile, 'tests/login.spec.js');
    assert.deepEqual(f.conflict.specOnly, ['AC-002']);
  } finally { cleanup(root); }
});

test('sync_doc_to_spec: một TC nhiều AC — đồng bộ cả tập, không chỉ AC đầu tiên', () => {
  const root = makeRepo({
    'requirements/REQ-001.md': REQ,
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-001 | TC-011 | Yes | P1 |', '| REQ-001 | AC-003 | TC-012 | No | P2 |']),
    'tests/login.spec.js': "test('TC-011 @AC-001 @AC-002 đăng nhập', async () => { expect(1).toBe(1); });\n",
  });
  try {
    assert.equal(conflictsOf(root).length, 1);
    const res = resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(res.ok, true);
    assert.deepEqual(res.newAcs, ['AC-001', 'AC-002']);
    const doc = read(root, 'test-cases/REQ-001.md');
    assert.ok(doc.includes('| REQ-001 | AC-001, AC-002 | TC-011 |'));
    assert.ok(doc.includes('| REQ-001 | AC-003 | TC-012 |'), 'không đụng TC khác');
    assert.ok(fs.existsSync(path.join(root, res.backup)));
    assert.equal(conflictsOf(root).length, 0, 'analyzer không còn báo xung đột');
  } finally { cleanup(root); }
});

test('sync_spec_to_doc: giữ kiểu tag @AC và thay đúng tập AC trong tiêu đề test', () => {
  const root = makeRepo({
    'requirements/REQ-001.md': REQ,
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011: chặn trang riêng @AC-001 @AC-002 @smoke', async () => { expect(1).toBe(1); });\n// TC-011 AC-001 ghi chú ngoài tiêu đề\n",
  });
  try {
    const res = resolveConflict(root, { resolutionType: 'sync_spec_to_doc', tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(res.ok, true);
    const spec = read(root, 'tests/login.spec.js');
    assert.ok(spec.includes("test('TC-011: chặn trang riêng @AC-003 @smoke'"));
    assert.ok(spec.includes('// TC-011 AC-001 ghi chú ngoài tiêu đề'), 'chỉ sửa tiêu đề test, không sửa comment');
    assert.equal(conflictsOf(root).length, 0);
  } finally { cleanup(root); }
});

test('resolveConflict: bỏ qua client, gọi lần hai là no-op (chống double-click)', () => {
  const root = makeRepo({
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
  });
  try {
    resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'tests/login.spec.js', targetAc: 'AC-999' });
    assert.ok(!read(root, 'test-cases/REQ-001.md').includes('AC-999'), 'payload AC từ client bị bỏ qua');
    const again = resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(again.noop, true);
  } finally { cleanup(root); }
});

test('resolveConflict: dòng khai chung nhiều TC không bị sửa, trả 409 và không ghi gì', () => {
  const original = table(['| REQ-001 | AC-003 | TC-011, TC-012 | Yes | P1 |']);
  const root = makeRepo({
    'test-cases/REQ-001.md': original,
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
  });
  try {
    assert.throws(
      () => resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'tests/login.spec.js' }),
      (err) => err.status === 409 && /TC-012/.test(err.message) && Array.isArray(err.skipped),
    );
    assert.equal(read(root, 'test-cases/REQ-001.md'), original);
  } finally { cleanup(root); }
});

test('resolveConflict: ghi xong mà vẫn lệch thì hoàn tác toàn bộ', () => {
  // Dòng bảng sửa được, nhưng dòng mô tả khai chung với TC-012 vẫn giữ AC-003 -> không sao.
  // Ca hoàn tác: spec có hai test cùng TC, một tiêu đề có AC rải rác không sửa được.
  const specOriginal = "test('TC-011 @AC-001', async () => { expect(1).toBe(1); });\n"
    + "test('TC-011 AC-002 kiểm tra rồi mới tới AC-004', async () => { expect(1).toBe(1); });\n";
  const root = makeRepo({
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': specOriginal,
  });
  try {
    assert.throws(
      () => resolveConflict(root, { resolutionType: 'sync_spec_to_doc', tcId: 'TC-011', specFile: 'tests/login.spec.js' }),
      (err) => err.status === 409 && /hoàn tác/.test(err.message) && /sửa tay/.test(err.message),
    );
    assert.equal(read(root, 'tests/login.spec.js'), specOriginal, 'file trở về nguyên trạng');
  } finally { cleanup(root); }
});

test('resolveConflict: giữ nguyên CRLF và file trộn EOL', () => {
  const root = makeRepo({
    'test-cases/REQ-001.md': '# T\r\n| REQ-001 | AC-003 | TC-011 | Yes |\r\n| REQ-001 | AC-001 | TC-001 | Yes |\n',
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
  });
  try {
    resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(read(root, 'test-cases/REQ-001.md'), '# T\r\n| REQ-001 | AC-002 | TC-011 | Yes |\r\n| REQ-001 | AC-001 | TC-001 | Yes |\n');
  } finally { cleanup(root); }
});

test('resolveConflict: tôn trọng thư mục test-case trong cấu hình QA và thư mục con', () => {
  const root = makeRepo({
    'docs/qa-cases/desktop/login.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'e2e/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
  }, { qa: { testCases: 'docs/qa-cases', specs: 'e2e' } });
  try {
    const state = getConflictState(root, { tcId: 'TC-011', specFile: 'e2e/login.spec.js' });
    assert.deepEqual(state.docFiles, ['docs/qa-cases/desktop/login.md']);
    resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', specFile: 'e2e/login.spec.js' });
    assert.ok(read(root, 'docs/qa-cases/desktop/login.md').includes('| AC-002 | TC-011 |'));
  } finally { cleanup(root); }
});

test('resolveConflict: chặn path traversal, spec ngoài thư mục spec và loại hòa giải lạ', () => {
  const root = makeRepo({ 'tests/a.spec.js': "test('TC-011 @AC-001', () => {});\n", 'scripts/x.spec.js': '' });
  try {
    const call = (extra) => () => resolveConflict(root, { resolutionType: 'sync_doc_to_spec', tcId: 'TC-011', ...extra });
    assert.throws(call({ specFile: '../outside.spec.js' }), (e) => e.status === 400);
    assert.throws(call({ specFile: 'tests/a.md' }), (e) => e.status === 400);
    assert.throws(call({ specFile: 'scripts/x.spec.js' }), (e) => e.status === 400);
    assert.throws(call({ specFile: 'tests/missing.spec.js' }), (e) => e.status === 404);
    assert.throws(() => resolveConflict(root, { resolutionType: 'xoa_het', tcId: 'TC-011', specFile: 'tests/a.spec.js' }), (e) => e.status === 400);
    assert.throws(call({ specFile: 'tests/a.spec.js', tcId: 'TC 011;rm' }), (e) => e.status === 400);
  } finally { cleanup(root); }
});

test('rewriteAcRun / rewriteDocText: các dạng viết AC', () => {
  assert.equal(rewriteAcRun(' AC-001, AC-002 ', ['AC-003']).text, ' AC-003 ');
  assert.equal(rewriteAcRun('TC-011 @AC-001 @AC-002 @smoke', ['AC-003', 'AC-004']).text, 'TC-011 @AC-003 @AC-004 @smoke');
  assert.equal(rewriteAcRun('AC-001 và AC-002', ['AC-005']).text, 'AC-005');
  assert.ok(rewriteAcRun('AC-001 rồi tới AC-002', ['AC-005']).skip);
  // AC nằm trong `inline code` không được tính, giống analyzer
  const r = rewriteDocText('### TC-011: xem `AC-009` (AC-001)\n```\nTC-011 AC-001\n```\n', 'TC-011', ['AC-002']);
  assert.equal(r.text, '### TC-011: xem `AC-009` (AC-002)\n```\nTC-011 AC-001\n```\n');
  // TC-01 không được khớp nhầm TC-011
  assert.equal(rewriteDocText('| AC-001 | TC-011 |', 'TC-01', ['AC-002']).changes.length, 0);
});

test('getConflictContext: trả test block, dòng tài liệu và định nghĩa Given-When-Then', () => {
  const root = makeRepo({
    'requirements/REQ-001.md': REQ,
    'test-cases/REQ-001.md': `${table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |'])}\n## TC-011: Chặn trang riêng\n\n| Step | Action | Expected result |\n|---|---|---|\n| 1 | Mở /account | Bị chuyển về login |\n`,
    'tests/login.spec.js': "test('TC-011 @AC-002', async ({ page }) => {\n  await expect(page).toHaveURL('/login');\n});\n",
  });
  try {
    const ctx = getConflictContext(root, { tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(ctx.blocks.length, 1);
    assert.equal(ctx.blocks[0].hasAssertion, true);
    assert.equal(ctx.blocks[0].line, 1);
    assert.ok(ctx.docLocations.some((l) => l.text.includes('| AC-003 | TC-011')));
    assert.match(ctx.acDefinitions['AC-002'].text, /sai mật khẩu/);
    assert.match(ctx.acDefinitions['AC-003'].text, /chưa đăng nhập/);
    assert.equal(ctx.docDetails.steps[0].action, 'Mở /account');
  } finally { cleanup(root); }
});

test('arbitrateWithAi (heuristic): AC không có trong requirements => sửa spec', async () => {
  const root = makeRepo({
    'requirements/REQ-001.md': REQ,
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-009', async () => { expect(1).toBe(1); });\n",
  });
  try {
    const res = await arbitrateWithAi({ root, tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(res.engine, 'heuristic');
    assert.equal(res.recommendation, 'sync_spec_to_doc');
    assert.ok(res.confidence >= 85);
    assert.match(res.reason, /AC-009/);
  } finally { cleanup(root); }
});

test('arbitrateWithAi: không còn xung đột => 409', async () => {
  const root = makeRepo({
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-002 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
  });
  try {
    await assert.rejects(arbitrateWithAi({ root, tcId: 'TC-011', specFile: 'tests/login.spec.js' }), (e) => e.status === 409);
  } finally { cleanup(root); }
});

test('parseAiVerdict: chuẩn hóa và từ chối đầu ra AI sai hợp đồng', () => {
  assert.deepEqual(
    parseAiVerdict('```json\n{"recommendation":"sync_spec_to_doc","confidence":"88%","reason":"Assertion kiểm tra redirect."}\n```'),
    { recommendation: 'sync_spec_to_doc', confidence: 88, reason: 'Assertion kiểm tra redirect.' },
  );
  assert.throws(() => parseAiVerdict('{"recommendation":"delete_all","confidence":90,"reason":"x"}'));
  assert.throws(() => parseAiVerdict('{"recommendation":"sync_doc_to_spec","confidence":90,"reason":""}'));
  assert.throws(() => parseAiVerdict('không phải json'));
});

test('escalate: ghi vào sổ theo cấu hình, gắn source, không trùng, không khớp nhầm mã TC dài hơn', () => {
  const root = makeRepo({
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |', '| REQ-001 | AC-003 | TC-012 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\ntest('TC-012 @AC-002', async () => { expect(1).toBe(1); });\n",
    'qa/decisions.json': JSON.stringify({ version: 1, decisions: [
      { id: 'D-07', title: 'Hòa giải xung đột truy vết TC-0111: bản ghi cũ', status: 'pending' },
    ] }),
  }, { qa: { decisionsFile: 'qa/decisions.json' } });
  try {
    const a = escalateConflictToDecision(root, { tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(a.decisionId, 'D-08', 'bản ghi cũ TC-0111 không bị coi là trùng với TC-011');
    assert.ok(a.backup, 'sao lưu sổ cũ trước khi ghi');
    assert.deepEqual(a.decision.source.specAcs, ['AC-002']);
    assert.deepEqual(a.decision.source.docFiles, ['test-cases/REQ-001.md']);

    const dup = escalateConflictToDecision(root, { tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.decisionId, 'D-08');

    const b = escalateConflictToDecision(root, { tcId: 'TC-012', specFile: 'tests/login.spec.js' });
    assert.equal(b.decisionId, 'D-09');
    assert.equal(JSON.parse(read(root, 'qa/decisions.json')).decisions.length, 3);
  } finally { cleanup(root); }
});

test('escalate: sổ quyết định hỏng thì từ chối, không ghi đè mất dữ liệu', () => {
  const root = makeRepo({
    'test-cases/REQ-001.md': table(['| REQ-001 | AC-003 | TC-011 | Yes | P1 |']),
    'tests/login.spec.js': "test('TC-011 @AC-002', async () => { expect(1).toBe(1); });\n",
    'decisions.json': '{ "decisions": [ hỏng',
  });
  try {
    assert.throws(() => escalateConflictToDecision(root, { tcId: 'TC-011', specFile: 'tests/login.spec.js' }), (e) => e.status === 409);
    assert.equal(read(root, 'decisions.json'), '{ "decisions": [ hỏng');
  } finally { cleanup(root); }
});
