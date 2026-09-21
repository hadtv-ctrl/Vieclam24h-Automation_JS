'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  getQaSummary,
  runQaFix,
  getScaffoldMeta,
  generateScaffold,
} = require('./qaService');

test('getQaSummary: trả về đúng JSON 1.0.0 với đầy đủ metrics, health, boundary, decisions, findings', () => {
  const summary = getQaSummary(process.cwd());
  assert.equal(summary.schemaVersion, '1.0.0');
  assert.ok(['HEALTHY', 'WARNING', 'CRITICAL'].includes(summary.systemHealth));
  assert.ok(summary.metrics && typeof summary.metrics === 'object');
  assert.equal(typeof summary.metrics.requirements, 'number');
  assert.equal(typeof summary.metrics.acceptanceCriteria, 'number');
  assert.equal(typeof summary.metrics.coveragePercent, 'number');
  assert.ok(summary.health && typeof summary.health === 'object');
  assert.ok(summary.boundary && typeof summary.boundary === 'object');
  assert.ok(['ALIGNED', 'DRIFTED', 'MISSING'].includes(summary.boundary.status));
  assert.ok(summary.decisions && typeof summary.decisions === 'object');
  assert.ok(Array.isArray(summary.findings));
});

test('runQaFix: hỗ trợ dryRun: true và trả về cấu trúc kết quả hợp lệ', () => {
  const result = runQaFix(process.cwd(), { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(typeof result.reconciledLinks, 'number');
  assert.equal(typeof result.registeredCandidates, 'number');
  assert.equal(typeof result.updatedFiles, 'number');
  assert.ok(Array.isArray(result.changes));
});

test('getScaffoldMeta: trả về nextReqId dạng REQ-xxx và danh sách domains hợp lệ', () => {
  const meta = getScaffoldMeta(process.cwd());
  assert.ok(/^REQ-\d{3}$/.test(meta.nextReqId));
  assert.ok(Array.isArray(meta.existingDomains));
  assert.ok(meta.existingDomains.length > 0);
});

test('generateScaffold: tạo thành công 3 file trong thư mục tạm', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'playwright', 'tests', 'auth'), { recursive: true });

    const result = generateScaffold(tempDir, {
      reqId: 'REQ-101',
      title: 'Xác thực OTP',
      domain: 'auth',
      acCount: 2,
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'scaffold');
    assert.equal(result.created.length, 3);
    assert.ok(fs.existsSync(path.join(tempDir, result.created[0])));
    assert.ok(fs.existsSync(path.join(tempDir, result.created[1])));
    assert.ok(fs.existsSync(path.join(tempDir, result.created[2])));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('getQaSummary: Soft Fallback an toàn khi thư mục không có tools/qa', () => {
  const emptyTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-fallback-'));
  try {
    const summary = getQaSummary(emptyTemp);
    assert.equal(summary.schemaVersion, '1.0.0');
    assert.ok(summary.metrics);
    assert.ok(Array.isArray(summary.findings));
  } finally {
    fs.rmSync(emptyTemp, { recursive: true, force: true });
  }
});
