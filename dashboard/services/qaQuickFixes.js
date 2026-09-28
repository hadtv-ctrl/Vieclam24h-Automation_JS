'use strict';

/**
 * dashboard/services/qaQuickFixes.js
 * Ba phép sửa xác định của tuyến quick (PLAN-18 mục 4). Mỗi planner nhận mảng dòng hiện tại và
 * trả `{ edits: [{ index, text }], target }` hoặc `{ skip: reasonCode }`. Planner chạy lại được
 * trên nội dung đã sửa một phần — commit dùng chính điều này để ghép nhiều bản vá vào một file.
 */

const { insertAtColumn } = require('./qaFixText');
const {
  locateTitle,
  appendTitleTag,
  unskipDeclaration,
  placeReqTag,
} = require('./qaFixTitle');
const { scannerAvailable, findMissingAwaitAt } = require('./qaFixValidate');
const { planGuidedTitle, planTraceabilityRow } = require('./qaGuidedFixes');

let qaSources = null;
let qaConfig = null;
try {
  // eslint-disable-next-line global-require
  qaSources = require('../../tools/qa/lib/sources');
  // eslint-disable-next-line global-require
  qaConfig = require('../../tools/qa/lib/config');
} catch (_) { /* thiếu tools/qa: tuyến REQ trả REQ_UNKNOWN */ }

const skip = (reasonCode) => ({ skip: reasonCode });

function previousNonSpaceChar(lines, index, column) {
  const same = lines[index].slice(0, column).trimEnd();
  if (same) return same[same.length - 1];
  for (let i = index - 1; i >= 0; i--) {
    const text = lines[i].trimEnd();
    if (text) return text[text.length - 1];
  }
  return '';
}

function planMissingAwait(lines, line) {
  if (!scannerAvailable()) return skip('SCANNER_UNAVAILABLE');
  const hit = findMissingAwaitAt(lines, line);
  if (!hit) return skip('ALREADY_FIXED');
  if (typeof hit.column !== 'number') return skip('SCANNER_UNAVAILABLE');
  // expect là phần tử mảng / đối số (vd. Promise.all([...])): thêm await sẽ đổi ngữ nghĩa.
  if (['[', '(', ','].includes(previousNonSpaceChar(lines, line - 1, hit.column))) return skip('IN_EXPRESSION');
  return { edits: [{ index: line - 1, text: insertAtColumn(lines[line - 1], hit.column, 'await ') }], target: { line } };
}

function planSkipped(lines, line, mode = 'wip') {
  const text = lines[line - 1] || '';
  if (!/test\.(?:skip|fixme)\b/.test(text)) return skip('ALREADY_FIXED');
  const res = mode === 'unskip' ? unskipDeclaration(text) : appendTitleTag(text, '@wip');
  if (res.error) return skip(res.error);
  return { edits: [{ index: line - 1, text: res.line }], target: { line } };
}

function resolveReq(title, ctx) {
  const tc = (String(title).match(/^\s*(TC-\d{3})\b/) || [])[1];
  const candidates = new Set();
  if (tc && ctx.reqByTc.has(tc)) ctx.reqByTc.get(tc).forEach((req) => candidates.add(req));
  const fromFile = (String(ctx.relPath || '').match(/REQ-\d{3}/i) || [])[0];
  if (fromFile) candidates.add(fromFile.toUpperCase());
  if (candidates.size === 0) return skip('REQ_UNKNOWN');
  if (candidates.size > 1) return skip('REQ_AMBIGUOUS');
  const [req] = candidates;
  if (!ctx.knownReqs.has(req)) return skip('REQ_NOT_FOUND');
  return { req };
}

/** Tag REQ đi lên title của describe bao quanh (AI_PROMPTS.md 3.3); không có describe thì lên title test. */
function planReqTag(lines, line, ctx) {
  const loc = locateTitle(lines[line - 1] || '');
  if (loc.error) return skip(loc.error);
  const resolved = resolveReq(loc.value, ctx);
  if (resolved.skip) return resolved;
  return placeReqTag(lines, line - 1, `@${resolved.req}`);
}

function planFinding(kind, lines, line, ctx, choice = {}) {
  if (kind === 'assertion-thieu-await') return planMissingAwait(lines, line);
  if (kind === 'test-bi-skip-am-tham') return planSkipped(lines, line, choice.skipMode);
  if (kind === 'test-thieu-tag-req') return planReqTag(lines, line, ctx);
  if (kind === 'test-khong-co-ma-tc') return planGuidedTitle(lines, line, choice);
  if (kind === 'traceability-row') return planTraceabilityRow(lines, choice);
  return skip('MANUAL_ROUTE');
}

/** REQ hợp lệ + map TC -> REQ từ tài liệu thật của dự án (theo qa.config.json). */
function loadReqContext(root) {
  const ctx = { reqByTc: new Map(), knownReqs: new Set() };
  if (!qaSources) return ctx;
  let options = {};
  try {
    options = qaConfig ? qaConfig.loadConfig(root) : {};
  } catch (_) { /* qa.config.json lỗi: dùng thư mục mặc định */ }
  for (const req of qaSources.loadRequirements(root, options)) if (req.id) ctx.knownReqs.add(req.id);
  for (const link of qaSources.loadTestCases(root, options).links || []) {
    if (!link.tcId || !link.reqId) continue;
    if (!ctx.reqByTc.has(link.tcId)) ctx.reqByTc.set(link.tcId, new Set());
    ctx.reqByTc.get(link.tcId).add(link.reqId);
  }
  return ctx;
}

module.exports = { planFinding, loadReqContext };
