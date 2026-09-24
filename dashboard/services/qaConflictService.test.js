// master-process-disable-size-check: QA Traceability Conflict resolution comprehensive test suite
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  parseConflictDetail,
  findDocFileForTc,
  resolveConflict,
  arbitrateWithAi,
  escalateConflictToDecision,
} = require('./qaConflictService');

test('parseConflictDetail: bóc tách chính xác chuỗi xung đột từ qaTrace', () => {
  const detailStr = 'tests/e2e/desktop/admin-add-company.spec.js: TC-011 ghi AC-002 nhưng tài liệu khai AC-003';
  const parsed = parseConflictDetail(detailStr);

  assert.ok(parsed);
  assert.equal(parsed.specFile, 'tests/e2e/desktop/admin-add-company.spec.js');
  assert.equal(parsed.tcId, 'TC-011');
  assert.deepEqual(parsed.specAcs, ['AC-002']);
  assert.deepEqual(parsed.docAcs, ['AC-003']);
  assert.equal(parsed.specAc, 'AC-002');
  assert.equal(parsed.docAc, 'AC-003');

  // Trường hợp chuỗi không hợp lệ
  assert.equal(parseConflictDetail('Không liên quan'), null);
});

test('findDocFileForTc: tìm đúng file markdown trong test-cases/', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-find-doc-' + Date.now());
  const tcDir = path.join(tmpRoot, 'test-cases');
  fs.mkdirSync(tcDir, { recursive: true });

  const targetFile = path.join(tcDir, 'REQ-012-sample.md');
  fs.writeFileSync(targetFile, '| REQ-012 | AC-001 | TC-999 | Yes | spec | P1 |', 'utf8');

  try {
    const found = findDocFileForTc(tmpRoot, 'TC-999');
    assert.equal(found, 'test-cases/REQ-012-sample.md');

    const notFound = findDocFileForTc(tmpRoot, 'TC-000');
    assert.equal(notFound, null);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('resolveConflict (sync_doc_to_spec): cập nhật bảng Traceability Markdown', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-resolve-doc-' + Date.now());
  const tcDir = path.join(tmpRoot, 'test-cases');
  fs.mkdirSync(tcDir, { recursive: true });

  const docRel = 'test-cases/REQ-002.md';
  const docAbs = path.join(tmpRoot, docRel);
  const initialTable = `# REQ-002
| REQ | AC | TC | Status | Spec | Priority |
|---|---|---|---|---|---|
| REQ-002 | AC-003 | TC-011 | Yes | tests/spec.js | P1 |
`;
  fs.writeFileSync(docAbs, initialTable, 'utf8');

  try {
    const res = resolveConflict(tmpRoot, {
      resolutionType: 'sync_doc_to_spec',
      tcId: 'TC-011',
      docFile: docRel,
      specAc: 'AC-002',
    });

    assert.equal(res.ok, true);
    assert.ok(res.backup);

    const updated = fs.readFileSync(docAbs, 'utf8');
    assert.ok(updated.includes('| REQ-002 | AC-002 | TC-011 |'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('resolveConflict (sync_spec_to_doc): cập nhật tag AC trong file Playwright spec', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-resolve-spec-' + Date.now());
  const specDir = path.join(tmpRoot, 'tests', 'e2e');
  fs.mkdirSync(specDir, { recursive: true });

  const specRel = 'tests/e2e/sample.spec.js';
  const specAbs = path.join(tmpRoot, specRel);
  const initialSpec = `test('TC-011: Đăng ký công ty @AC-002 @smoke', async () => {});`;
  fs.writeFileSync(specAbs, initialSpec, 'utf8');

  try {
    const res = resolveConflict(tmpRoot, {
      resolutionType: 'sync_spec_to_doc',
      tcId: 'TC-011',
      specFile: specRel,
      specAc: 'AC-002',
      docAc: 'AC-003',
    });

    assert.equal(res.ok, true);
    assert.ok(res.backup);

    const updated = fs.readFileSync(specAbs, 'utf8');
    assert.ok(updated.includes('TC-011: Đăng ký công ty @AC-003 @smoke'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('arbitrateWithAi: đề xuất hòa giải qua Heuristic Fallback khi chưa có key', async () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-arbitrate-' + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });

  try {
    const res = await arbitrateWithAi({
      root: tmpRoot,
      specFile: 'tests/sample.spec.js',
      tcId: 'TC-011',
      specAc: 'AC-002',
      docAc: 'AC-003',
    });

    assert.ok(res);
    assert.equal(res.recommendation, 'sync_doc_to_spec');
    assert.ok(res.confidence);
    assert.ok(res.reason);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('escalateConflictToDecision: tự động tạo quyết định D-xx vào decisions.json', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-escalate-' + Date.now());
  fs.mkdirSync(tmpRoot, { recursive: true });

  try {
    const res = escalateConflictToDecision(tmpRoot, {
      tcId: 'TC-011',
      specFile: 'tests/e2e/admin-add-company.spec.js',
      specAcs: ['AC-002'],
      docFile: 'test-cases/REQ-002.md',
      docAcs: ['AC-003'],
      reason: 'Cần PO chốt',
    });

    assert.equal(res.ok, true);
    assert.match(res.decisionId, /^D-\d{2}$/);

    const decPath = path.join(tmpRoot, 'decisions.json');
    assert.ok(fs.existsSync(decPath));
    const content = JSON.parse(fs.readFileSync(decPath, 'utf8'));
    assert.equal(content.decisions.length, 1);
    assert.equal(content.decisions[0].id, res.decisionId);
    assert.ok(content.decisions[0].title.includes('TC-011'));

    // Gọi lần 2: phải tái sử dụng và không sinh thêm D-02
    const res2 = escalateConflictToDecision(tmpRoot, {
      tcId: 'TC-011',
      specFile: 'tests/e2e/admin-add-company.spec.js',
      specAcs: ['AC-002'],
      docFile: 'test-cases/REQ-002.md',
      docAcs: ['AC-003'],
      reason: 'Cần PO chốt',
    });
    assert.equal(res2.decisionId, res.decisionId);
    assert.equal(res2.isDuplicate, true);
    const content2 = JSON.parse(fs.readFileSync(decPath, 'utf8'));
    assert.equal(content2.decisions.length, 1);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('findDocFileForTc: tìm chính xác file khi nằm sâu trong thư mục con', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-find-nested-' + Date.now());
  const nestedDir = path.join(tmpRoot, 'test-cases', 'desktop', 'admin');
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, 'company.md'), '# TC-777 in nested folder', 'utf8');

  try {
    const found = findDocFileForTc(tmpRoot, 'TC-777');
    assert.equal(found, 'test-cases/desktop/admin/company.md');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('resolveConflict: bảo tồn chính xác ký tự xuống dòng CRLF', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-crlf-' + Date.now());
  const docDir = path.join(tmpRoot, 'test-cases');
  fs.mkdirSync(docDir, { recursive: true });
  const docAbs = path.join(docDir, 'doc.md');
  const crlfContent = '# Title\r\n| REQ-01 | AC-01 | TC-01 |\r\n';
  fs.writeFileSync(docAbs, crlfContent, 'utf8');

  try {
    resolveConflict(tmpRoot, {
      resolutionType: 'sync_doc_to_spec',
      tcId: 'TC-01',
      docFile: 'test-cases/doc.md',
      targetAc: 'AC-09',
      docAc: 'AC-01',
    });

    const updated = fs.readFileSync(docAbs, 'utf8');
    assert.ok(updated.includes('AC-09'));
    assert.ok(updated.includes('\r\n'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

