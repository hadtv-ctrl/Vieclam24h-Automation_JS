'use strict';

/**
 * dashboard/services/qaFixText.js
 * Thao tác văn bản dùng chung cho bộ sửa finding (PLAN-18). Tách/ghép dòng mà giữ nguyên
 * định dạng file (INV-6): BOM, ký tự xuống dòng của TỪNG dòng (file lẫn CRLF/LF không bị đổi
 * cả loạt), có hay không newline cuối file.
 */

const crypto = require('node:crypto');

const BOM = '﻿';

/** content -> { bom, lines, eols, eol }; eols[i] là ký tự kết thúc dòng i ('' cho dòng cuối không newline). */
function parseDocument(content) {
  const text = String(content);
  const bom = text.startsWith(BOM);
  const parts = (bom ? text.slice(1) : text).split(/(\r?\n)/);
  const lines = [];
  const eols = [];
  for (let i = 0; i < parts.length; i += 2) {
    lines.push(parts[i]);
    eols.push(parts[i + 1] || '');
  }
  // "a\n" tách thành ["a", ""]: phần rỗng sau newline cuối không phải một dòng thật.
  if (lines.length > 1 && lines[lines.length - 1] === '' && eols[eols.length - 1] === '') {
    lines.pop();
    eols.pop();
  }
  const crlf = eols.filter((e) => e === '\r\n').length;
  const lf = eols.filter((e) => e === '\n').length;
  return { bom, lines, eols, eol: crlf > lf ? '\r\n' : '\n' };
}

function serializeDocument(doc) {
  let out = doc.bom ? BOM : '';
  doc.lines.forEach((line, i) => {
    out += line + (doc.eols[i] ?? doc.eol);
  });
  return out;
}

/** Thay nội dung một dòng (index 0-based), giữ nguyên ký tự xuống dòng của dòng đó. */
function replaceLine(doc, index, text) {
  if (index < 0 || index >= doc.lines.length) throw new RangeError(`Dòng ${index + 1} nằm ngoài file.`);
  const lines = doc.lines.slice();
  lines[index] = text;
  return { ...doc, lines, eols: doc.eols.slice() };
}

/**
 * Chèn các dòng mới trước dòng `index` (index = số dòng nghĩa là chèn vào cuối file).
 * Dòng mới dùng kiểu xuống dòng chiếm đa số; chèn vào cuối file vẫn giữ trạng thái newline cuối.
 */
function insertLines(doc, index, newLines) {
  if (index < 0 || index > doc.lines.length) throw new RangeError(`Vị trí chèn ${index} nằm ngoài file.`);
  const lines = doc.lines.slice();
  const eols = doc.eols.slice();
  const added = newLines.map(() => doc.eol);
  if (index === lines.length && lines.length > 0) {
    added[added.length - 1] = eols[eols.length - 1];
    eols[eols.length - 1] = doc.eol;
  }
  lines.splice(index, 0, ...newLines);
  eols.splice(index, 0, ...added);
  return { ...doc, lines, eols };
}

/** Băm sau khi đổi CRLF -> LF: checkout CRLF trên Windows không bị coi là file đã đổi. */
function hashNormalized(content) {
  return crypto.createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex');
}

function insertAtColumn(line, column, text) {
  return `${line.slice(0, column)}${text}${line.slice(column)}`;
}

function indentOf(line) {
  return (String(line).match(/^[ \t]*/) || [''])[0].length;
}

module.exports = {
  parseDocument,
  serializeDocument,
  replaceLine,
  insertLines,
  hashNormalized,
  insertAtColumn,
  indentOf,
};
