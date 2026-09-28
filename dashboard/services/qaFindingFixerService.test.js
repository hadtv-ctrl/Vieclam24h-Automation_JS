'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const service = require('./qaFindingFixerService');

const { resolveSafePath } = service;

test('resolveSafePath: phân giải đường dẫn an toàn và trích xuất số dòng', () => {
  const root = path.join(os.tmpdir(), 'qa-test-root-' + Date.now());
  fs.mkdirSync(root, { recursive: true });

  try {
    const res1 = resolveSafePath(root, 'tests/sample.spec.js:25');
    assert.ok(res1);
    assert.equal(res1.relPath, 'tests/sample.spec.js');
    assert.equal(res1.lineNumber, 25);

    // Chặn Path Traversal
    const res2 = resolveSafePath(root, '../../etc/passwd');
    assert.equal(res2, null);

    const res3 = resolveSafePath(root, '..\\..\\Windows\\System32');
    assert.equal(res3, null);

    // Chặn đường dẫn tuyệt đối ngoài root
    const res4 = resolveSafePath(root, 'C:\\secrets\\key.txt');
    assert.equal(res4, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveSafePath: vị trí nhiều file lấy file đầu, bỏ chú thích trong ngoặc', () => {
  const root = path.join(os.tmpdir(), 'qa-test-root-' + Date.now());
  const res = resolveSafePath(root, 'test-cases/REQ-002.md (REQ-002/AC-005), test-cases/REQ-003.md (REQ-003/AC-001)');
  assert.equal(res.relPath, 'test-cases/REQ-002.md');
  assert.equal(res.lineNumber, null);
});

test('PLAN-18: service chỉ còn tra cứu chỉ đọc, không còn đường AI/heuristic ghi file', () => {
  assert.deepEqual(Object.keys(service).sort(), ['getFindingContext', 'resolveSafePath']);
});
