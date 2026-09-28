'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDocument,
  serializeDocument,
  replaceLine,
  insertLines,
  hashNormalized,
  insertAtColumn,
  indentOf,
} = require('./qaFixText');

const SAMPLES = {
  lf: 'a\nb\nc\n',
  crlfBomNoFinal: '﻿a\r\nb\r\nc',
  mixed: 'a\r\nb\nc\r\n',
  empty: '',
  onlyNewline: '\n',
  blankLines: 'a\n\n\nb\n',
};

test('parse/serialize: giữ nguyên byte cho LF, CRLF + BOM, lẫn EOL, file rỗng (BATCH-09)', () => {
  for (const [name, content] of Object.entries(SAMPLES)) {
    assert.equal(serializeDocument(parseDocument(content)), content, name);
  }
});

test('parseDocument: tách đúng dòng, BOM và kiểu xuống dòng đa số', () => {
  const doc = parseDocument(SAMPLES.crlfBomNoFinal);
  assert.equal(doc.bom, true);
  assert.deepEqual(doc.lines, ['a', 'b', 'c']);
  assert.deepEqual(doc.eols, ['\r\n', '\r\n', '']);
  assert.equal(doc.eol, '\r\n');
  assert.deepEqual(parseDocument(SAMPLES.lf).lines, ['a', 'b', 'c']);
});

test('replaceLine: chỉ đổi đúng một dòng, giữ EOL từng dòng; ngoài phạm vi thì ném lỗi', () => {
  const doc = parseDocument(SAMPLES.mixed);
  const next = replaceLine(doc, 1, 'B');
  assert.equal(serializeDocument(next), 'a\r\nB\nc\r\n');
  assert.equal(serializeDocument(doc), SAMPLES.mixed, 'không sửa document gốc');
  assert.throws(() => replaceLine(doc, 3, 'x'), RangeError);
});

test('insertLines: chèn giữa file và cuối file giữ trạng thái newline cuối', () => {
  const noFinal = parseDocument(SAMPLES.crlfBomNoFinal);
  assert.equal(serializeDocument(insertLines(noFinal, 1, ['x'])), '﻿a\r\nx\r\nb\r\nc');
  assert.equal(serializeDocument(insertLines(noFinal, 3, ['d', 'e'])), '﻿a\r\nb\r\nc\r\nd\r\ne');
  assert.equal(serializeDocument(insertLines(parseDocument(SAMPLES.lf), 3, ['d'])), 'a\nb\nc\nd\n');
});

test('hashNormalized: CRLF và LF cùng hash, nội dung khác thì khác hash', () => {
  assert.equal(hashNormalized('a\r\nb\r\n'), hashNormalized('a\nb\n'));
  assert.notEqual(hashNormalized('a\nb\n'), hashNormalized('a\nc\n'));
});

test('insertAtColumn và indentOf', () => {
  assert.equal(insertAtColumn('  expect(x)', 2, 'await '), '  await expect(x)');
  assert.equal(indentOf('    test('), 4);
  assert.equal(indentOf('\ttest('), 1);
  assert.equal(indentOf('test('), 0);
});
