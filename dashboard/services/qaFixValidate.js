'use strict';

/**
 * dashboard/services/qaFixValidate.js
 * Kiểm tra trước khi ghi (PLAN-18, INV-3): nội dung sau vá phải parse được, và finding phải
 * thật sự hết trên nội dung mới — đo bằng chính rule của scanner, không bằng một bản sao.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { locateTitle, titleTags } = require('./qaFixTitle');

// Nạp mềm như analyzer trong qaService: dashboard/ luôn được sync nhưng tools/ có thể bị giữ
// lại vì drift. Thiếu scanner thì tuyến sửa await tự tắt (fail-closed), không làm sập route.
let sources = null;
try {
  // eslint-disable-next-line global-require
  sources = require('../../tools/qa/lib/sources');
} catch (_) { /* satellite chưa có tools/qa */ }

const RE_ESM = /^\s*(?:import[\s{*'"]|export\s)/m;

function checkWithNode(code, root) {
  const dir = path.join(root || process.cwd(), '.dashboard-drafts', 'qa-batch');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `syntax-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(file, code, 'utf8');
  try {
    const res = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    });
    if (res.status === 0) return { ok: true };
    const message = String(res.stderr || '').split(/\r?\n/).find((l) => /Error/.test(l)) || 'node --check thất bại';
    return { ok: false, reasonCode: 'SYNTAX_INVALID', message };
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/**
 * { ok: true } hoặc { ok: false, reasonCode, message }. `.js`/`.cjs` compile bằng vm với wrapper
 * CommonJS (không chạy code); ESM qua `node --check`; `.md` do bộ nạp tài liệu kiểm; loại khác
 * (vd. `.ts`) không kiểm được nên từ chối thay vì ghi mù.
 */
function validateSyntax(relPath, content, { root } = {}) {
  const ext = path.extname(String(relPath)).toLowerCase();
  if (ext === '.md') return { ok: true };
  if (!['.js', '.cjs', '.mjs'].includes(ext)) return { ok: false, reasonCode: 'UNSUPPORTED_FILE' };
  const code = String(content).replace(/^﻿/, '').replace(/^#![^\n]*/, '');
  if (ext === '.mjs' || RE_ESM.test(code)) return checkWithNode(code, root);
  try {
    // eslint-disable-next-line no-new
    new vm.Script(`(function (exports, require, module, __filename, __dirname) {${code}\n})`, {
      filename: String(relPath),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reasonCode: 'SYNTAX_INVALID', message: err.message };
  }
}

function scannerAvailable() {
  return Boolean(sources && typeof sources.findMissingAwaits === 'function');
}

/** Occurrence thiếu await tại dòng `line` (1-based) theo đúng rule scanner, hoặc null. */
function findMissingAwaitAt(lines, line) {
  if (!scannerAvailable()) return null;
  return sources.findMissingAwaits(lines, 1).find((hit) => hit.line === line) || null;
}

/**
 * Finding đã hết trên nội dung mới chưa. `target`:
 *  - assertion-thieu-await: { line }
 *  - test-bi-skip-am-tham: { line }
 *  - test-thieu-tag-req: { tag, tagLine, tagOnDescribe }
 *  - test-khong-co-ma-tc: { line } (title khớp TC-NNN - AC-NNN)
 *  - traceability-row: { row } (dòng đã nằm trong bảng)
 */
function isResolved(kind, lines, target) {
  if (kind === 'assertion-thieu-await') {
    return scannerAvailable() && !findMissingAwaitAt(lines, target.line);
  }
  if (kind === 'test-bi-skip-am-tham') {
    const text = lines[target.line - 1] || '';
    if (!/test\.(?:skip|fixme)\b/.test(text)) return true;
    const loc = locateTitle(text);
    return !loc.error && titleTags(loc.value).includes('@wip');
  }
  if (kind === 'test-thieu-tag-req') {
    const loc = locateTitle(lines[target.tagLine - 1] || '', { describe: Boolean(target.tagOnDescribe) });
    return !loc.error && titleTags(loc.value).includes(target.tag);
  }
  if (kind === 'test-khong-co-ma-tc') {
    const loc = locateTitle(lines[target.line - 1] || '');
    return !loc.error && /^TC-\d{3}\s*-\s*AC-\d{3}\b/.test(loc.value);
  }
  if (kind === 'traceability-row') return lines.includes(target.row);
  return false;
}

module.exports = {
  validateSyntax,
  scannerAvailable,
  findMissingAwaitAt,
  isResolved,
};
