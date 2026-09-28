'use strict';

/**
 * dashboard/services/qaGuidedFixes.js
 * Tuyến guided (PLAN-18 Phase 4): gán mã TC cho test chưa có, sau khi NGƯỜI DÙNG chọn AC.
 * Một bản vá gồm title `TC-NNN - AC-NNN <mô tả>` (+ tag @REQ lên describe nếu test chưa mang
 * REQ đó) trong spec và một dòng trong bảng Traceability của REQ — cùng một giao dịch, nên sửa
 * xong không phát sinh `script-khong-co-trong-test-case` hay `test-thieu-tag-req`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { locateTitle, titleTags, locateEnclosingDescribe, placeReqTag } = require('./qaFixTitle');

let qaCommands = null;
let qaSources = null;
let qaConfig = null;
try {
  // eslint-disable-next-line global-require
  qaCommands = require('../../tools/qa/lib/commands');
  // eslint-disable-next-line global-require
  qaSources = require('../../tools/qa/lib/sources');
  // eslint-disable-next-line global-require
  qaConfig = require('../../tools/qa/lib/config');
} catch (_) { /* thiếu tools/qa: tuyến guided trả REQ_UNKNOWN */ }

const RE_REQ_TAG = /^@REQ-\d{3}$/;
const RE_TC_AC = /^TC-\d{3}\s*-\s*AC-\d{3}\b/;
const LEGACY_TC_PREFIX = /^\s*TC-[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*\s*(?:[:\-–—]\s*)?/;
const TRACE_HEADING = /^##\s+(?:Traceability|Bảng truy vết)/i;
const MAX_TC = 999;

const skip = (reasonCode) => ({ skip: reasonCode });
const splitRow = (text) => text.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** REQ của test: tag trên title test + describe bao quanh, không có thì theo tên file. */
function resolveGuidedReq(lines, index, relPath, knownReqs) {
  const loc = locateTitle(lines[index] || '');
  if (loc.error) return skip(loc.error);
  const tags = new Set(titleTags(loc.value).filter((t) => RE_REQ_TAG.test(t)));
  const describe = locateEnclosingDescribe(lines, index);
  if (describe.line !== undefined) {
    const d = locateTitle(lines[describe.line], { describe: true });
    if (!d.error) titleTags(d.value).filter((t) => RE_REQ_TAG.test(t)).forEach((t) => tags.add(t));
  }
  let reqs = [...tags].map((t) => t.slice(1));
  const tagged = reqs.length > 0;
  const fromFile = (String(relPath).match(/REQ-\d{3}/i) || [])[0];
  if (!tagged && fromFile) reqs = [fromFile.toUpperCase()];
  if (!reqs.length) return skip('REQ_UNKNOWN');
  if (reqs.length > 1) return skip('REQ_AMBIGUOUS');
  if (!knownReqs.has(reqs[0])) return skip('REQ_NOT_FOUND');
  return { reqId: reqs[0], tagged, title: loc.value };
}

/** Bản vá trong spec. choice = { reqId, acId, tcId, tagged } — thiếu AC thì chưa dựng được. */
function planGuidedTitle(lines, line, choice = {}) {
  if (!choice.acId || !choice.tcId) return skip('AC_REQUIRED');
  const index = line - 1;
  const loc = locateTitle(lines[index] || '');
  if (loc.error) return skip(loc.error);
  if (RE_TC_AC.test(loc.value)) return skip('ALREADY_FIXED');
  const rest = loc.value.replace(LEGACY_TC_PREFIX, '').trim();
  const working = lines.slice();
  working[index] = `${lines[index].slice(0, loc.start + 1)}${choice.tcId} - ${choice.acId}${rest ? ` ${rest}` : ''}${lines[index].slice(loc.end)}`;
  const edits = new Map([[index, working[index]]]);
  if (!choice.tagged) {
    const placed = placeReqTag(working, index, `@${choice.reqId}`);
    if (placed.skip && placed.skip !== 'ALREADY_FIXED') return placed;
    (placed.edits || []).forEach((edit) => edits.set(edit.index, edit.text));
  }
  return { edits: [...edits].map(([i, text]) => ({ index: i, text })), target: { line } };
}

/** Vị trí bảng Traceability: dòng header (đã tách cột) và dòng dữ liệu cuối cùng. */
function locateTraceabilityTable(lines) {
  const head = lines.findIndex((line) => TRACE_HEADING.test(line.trim()));
  if (head < 0) return null;
  let header = null;
  let lastRow = -1;
  const rows = [];
  for (let i = head + 1; i < lines.length; i++) {
    const text = lines[i].trim();
    if (/^#{1,6}\s/.test(text)) break;
    if (text.startsWith('|')) {
      if (!header) header = splitRow(text);
      else if (!/^\|[\s:|-]+\|$/.test(text)) rows.push(splitRow(text));
      lastRow = i;
    } else if (lastRow >= 0 && text) break;
  }
  return header && lastRow > head + 1 ? { header, lastRow, rows } : null;
}

/**
 * Dựng dòng theo đúng tên cột của bảng đang có (bảng REQ-trước hay bảng tiếng Việt TC-trước).
 * Đường dẫn spec theo kiểu của bảng (`bare`: để trần như các dòng sẵn có; mặc định bọc backtick như fixer.js).
 */
function buildRow(header, c, { bareSpec = false } = {}) {
  const value = (name) => {
    if (/requirement|^req/i.test(name)) return c.reqId;
    if (/acceptance|^ac\b/i.test(name)) return c.acId;
    if (/test ?case|^tc\b/i.test(name)) return c.tcId;
    if (/automation/i.test(name)) return 'Yes';
    if (/spec/i.test(name)) return bareSpec ? c.spec : `\`${c.spec}\``;
    if (/priority|ưu tiên/i.test(name)) return 'P2';
    if (/mô tả|description|title|tiêu đề/i.test(name)) return String(c.title || '').replace(/\|/g, '/');
    return '-';
  };
  return `| ${header.map(value).join(' | ')} |`;
}

/** Bản vá trong file test-cases: chèn dòng sau dòng cuối của bảng Traceability. */
function planTraceabilityRow(lines, choice = {}) {
  if (!choice.acId || !choice.tcId) return skip('AC_REQUIRED');
  const table = locateTraceabilityTable(lines);
  if (!table) return skip('NO_TRACEABILITY_TABLE');
  if (lines.some((l) => new RegExp(`\\|\\s*${choice.tcId}\\s*\\|`).test(l))) return skip('ALREADY_FIXED');
  const specCol = table.header.findIndex((name) => /spec/i.test(name));
  const specCells = table.rows.map((r) => r[specCol] || '').filter((cell) => cell && cell !== '-');
  const bareSpec = specCol >= 0 && specCells.length > 0 && !specCells.some((cell) => cell.startsWith('`'));
  const row = buildRow(table.header, choice, { bareSpec });
  return { edits: [{ index: table.lastRow + 1, text: row, insert: true }], target: { row } };
}

function tcNumbers(text) {
  return [...String(text).matchAll(/\bTC-(\d{3})\b/g)].map((m) => Number(m[1]));
}

/**
 * Dữ liệu thật để gán TC: AC theo REQ, file test-cases có bảng Traceability của REQ, các số
 * TC đã dùng (bảng + title spec) và danh sách spec đã quét. Có chạy `playwright --list`.
 */
function loadGuidedContext(root) {
  const ctx = { acsByReq: new Map(), traceFileByReq: new Map(), usedTcs: new Set(), specPaths: [] };
  if (!qaCommands) return ctx;
  const { requirements, testCases, realTests } = qaCommands.collect(root, {});
  const hasTable = (rel) => {
    const abs = path.resolve(root, rel);
    return fs.existsSync(abs) && Boolean(locateTraceabilityTable(fs.readFileSync(abs, 'utf8').split(/\r?\n/)));
  };
  for (const req of requirements) {
    if (!req.id) continue;
    ctx.acsByReq.set(req.id, req.acs.map((ac) => ({ id: ac.id, title: ac.title })));
    const candidates = [req.testCaseFile, ...testCases.links.filter((l) => l.reqId === req.id).map((l) => l.file)].filter(Boolean);
    const file = candidates.find(hasTable);
    if (file) ctx.traceFileByReq.set(req.id, file.replace(/\\/g, '/'));
  }
  testCases.links.forEach((l) => tcNumbers(l.tcId).forEach((n) => ctx.usedTcs.add(n)));
  realTests.forEach((t) => tcNumbers(t.title).forEach((n) => ctx.usedTcs.add(n)));
  ctx.specPaths = [...new Set(realTests.map((t) => t.path).filter(Boolean))];
  return ctx;
}

/** Số TC kế tiếp chưa dùng và chưa bị session khác giữ chỗ; quá TC-999 thì null. */
function nextTcNumber(used, reserved) {
  let n = Math.max(0, ...used, ...reserved) + 1;
  while (used.has(n) || reserved.has(n)) n += 1;
  return n > MAX_TC ? null : n;
}

/** Các TC đã giữ chỗ nay đã bị dùng ở bảng Traceability hoặc title spec (kiểm lại lúc apply). */
function findTakenTcs(root, tcIds, specPaths) {
  const taken = new Set();
  if (!qaSources || !tcIds.length) return [];
  let options = {};
  try {
    options = qaConfig.loadConfig(root);
  } catch (_) { /* qa.config.json lỗi: dùng thư mục mặc định */ }
  qaSources.loadTestCases(root, options).links.forEach((l) => { if (tcIds.includes(l.tcId)) taken.add(l.tcId); });
  for (const rel of specPaths) {
    const abs = path.resolve(root, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    tcIds.forEach((tc) => { if (new RegExp(`['"\`]${tc}\\b`).test(text)) taken.add(tc); });
  }
  return [...taken];
}

module.exports = {
  buildRow,
  resolveGuidedReq,
  planGuidedTitle,
  planTraceabilityRow,
  locateTraceabilityTable,
  loadGuidedContext,
  nextTcNumber,
  findTakenTcs,
};
