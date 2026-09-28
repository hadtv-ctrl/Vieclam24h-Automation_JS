'use strict';

/** PLAN-18 — GET /api/qa/finding/context ở mức service: đoạn mã, đường dẫn thoát project, không có file (BATCH-45). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { getFindingContext } = require('./qaFindingFixerService');
const { makeWorkspace, finding, indexOf } = require('../../tests/dashboard/support/batchTestUtils');

const REL = 'tests/e2e/long.spec.js';
const LONG = Array.from({ length: 40 }, (_, i) => `// dòng ${i + 1}`).join('\r\n');

test('getFindingContext: ±15 dòng quanh vị trí, chặn đường dẫn thoát project, thư mục thì file null', () => {
  const ws = makeWorkspace({ [REL]: `﻿${LONG}` });
  try {
    const index = indexOf([
      finding('assertion-thieu-await', `${REL}:20`),
      finding('assertion-thieu-await', '../../ngoai.spec.js:3'),
      finding('khong-doc-duoc-requirement', 'requirements/'),
      finding('ma-tc-trung', `test-cases/REQ-001.md (REQ-001/AC-001), ${REL} (REQ-001/AC-002)`),
    ]);
    const key = (i) => index.list[i].findingKey;
    const opts = { findingsIndex: index };

    const ctx = getFindingContext(ws.root, key(0), opts);
    assert.equal(ctx.file.relPath, REL);
    assert.equal(ctx.file.line, 20);
    assert.equal(ctx.file.startLine, 5);
    assert.equal(ctx.file.lines.length, 31);
    assert.equal(ctx.file.lines[0], '// dòng 5');
    assert.equal(ctx.finding.fixRoute, 'quick');

    assert.throws(() => getFindingContext(ws.root, key(1), opts), { status: 403, code: 'PATH_REJECTED' });
    assert.equal(getFindingContext(ws.root, key(2), opts).file, null);
    assert.equal(getFindingContext(ws.root, key(3), opts).file.relPath, 'test-cases/REQ-001.md');
    assert.throws(() => getFindingContext(ws.root, 'khongco', opts), { status: 404, code: 'FINDING_NOT_FOUND' });
    assert.throws(() => getFindingContext(ws.root, '', opts), { status: 400 });
  } finally {
    ws.cleanup();
  }
});
