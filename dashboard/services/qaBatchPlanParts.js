'use strict';

/**
 * dashboard/services/qaBatchPlanParts.js
 * Mảnh dùng chung khi lập kế hoạch sửa (PLAN-18): mục bị bỏ qua kèm hành động kế tiếp, đọc file
 * đích an toàn, dựng + kiểm một bản vá trên document, hunk xem trước và thẻ file gửi về UI.
 */

const fs = require('node:fs');
const { resolveSafePath } = require('./qaFindingFixerService');
const { reasonText } = require('./qaFindingCatalog');
const { parseDocument, serializeDocument, replaceLine, insertLines, hashNormalized } = require('./qaFixText');
const { validateSyntax, isResolved } = require('./qaFixValidate');
const { planFinding } = require('./qaQuickFixes');

const MAX_FILE_BYTES = 512 * 1024;
const CONTEXT_LINES = 2;
const ROUTE_ACTION = { scaffold: 'scaffold', autofix: 'autofix' };

function skipEntry(finding, reasonCode) {
  let nextAction = { type: 'detail' };
  if (reasonCode === 'MANUAL_ROUTE' && ROUTE_ACTION[finding.fixRoute]) nextAction = { type: ROUTE_ACTION[finding.fixRoute] };
  if (finding.kind === 'ma-tc-trung') {
    nextAction = { type: 'openDoc', target: String(finding.where || '').split(',')[0].replace(/\s*\(.*$/, '').trim() };
  }
  return {
    findingKey: finding.findingKey,
    kind: finding.kind || null,
    where: finding.where || null,
    reasonCode,
    reason: reasonText(reasonCode),
    nextAction,
  };
}

/** File đích của một vị trí `path[:line]` trong dự án, hoặc { skip }. */
function readTarget(root, where) {
  const resolved = resolveSafePath(root, String(where || ''));
  if (!resolved) return { skip: 'PATH_REJECTED' };
  let stat;
  try {
    stat = fs.statSync(resolved.absPath);
  } catch (_) {
    return { skip: 'FILE_NOT_FOUND' };
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return { skip: 'FILE_NOT_FOUND' };
  return { relPath: resolved.relPath, absPath: resolved.absPath, line: resolved.lineNumber };
}

/** Mục file của session: đọc một lần, giữ baseHash để phát hiện file đổi trước khi ghi. */
function fileEntry(relPath, absPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  return { relPath, absPath, action: 'modified', baseHash: hashNormalized(content), doc: parseDocument(content), patches: new Map() };
}

function applyEdits(doc, edits) {
  return edits.reduce((d, e) => (e.insert ? insertLines(d, e.index, [e.text]) : replaceLine(d, e.index, e.text)), doc);
}

/** Dựng một bản vá trên `doc`; chỉ giữ khi finding biến mất và file vẫn parse được. */
function tryPatch(root, doc, relPath, patch, ctx) {
  const planned = planFinding(patch.kind, doc.lines, patch.line, { ...ctx, relPath }, patch.choice);
  if (planned.skip) return planned;
  const next = applyEdits(doc, planned.edits);
  if (!isResolved(patch.kind, next.lines, planned.target)) return { skip: 'NOT_RESOLVED' };
  const syntax = validateSyntax(relPath, serializeDocument(next), { root });
  if (!syntax.ok) return { skip: syntax.reasonCode };
  return { ...planned, doc: next };
}

function hunkOf(before, after, edits) {
  const indexes = edits.map((edit) => edit.index);
  const start = Math.max(0, Math.min(...indexes) - CONTEXT_LINES);
  const end = Math.min(after.lines.length - 1, Math.max(...indexes) + CONTEXT_LINES);
  const inserted = edits.filter((edit) => edit.insert);
  return {
    startLine: start + 1,
    changedLines: edits.filter((edit) => !edit.insert).map((edit) => edit.index + 1),
    insertedLines: inserted.map((edit) => edit.index + 1),
    before: inserted.length ? [] : before.lines.slice(start, end + 1),
    after: after.lines.slice(start, end + 1),
  };
}

function riskOf(patch) {
  if (patch.kind === 'test-bi-skip-am-tham') return (patch.choice || {}).skipMode === 'unskip' ? 'behavior' : 'low';
  return patch.risk || 'low';
}

function describePatch(patch, doc, result) {
  return {
    ...patch,
    risk: riskOf(patch),
    defaultSelected: patch.defaultSelected !== false,
    needsInput: false,
    hunk: hunkOf(doc, result.doc, result.edits),
  };
}

function cardOf(file) {
  return { relPath: file.relPath, action: file.action, patches: [...file.patches.values()] };
}

module.exports = { skipEntry, readTarget, fileEntry, tryPatch, describePatch, cardOf };
