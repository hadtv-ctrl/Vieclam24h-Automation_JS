'use strict';

/**
 * dashboard/services/qaGuidedPlan.js
 * Phần session của tuyến guided (PLAN-18 Phase 4): giữ chỗ số TC khi lập kế hoạch (không trùng
 * với session khác đang mở), và khi người dùng chọn AC thì dựng cùng lúc bản vá trong spec lẫn
 * dòng trong bảng Traceability — hai thẻ file dùng chung một findingKey nên tick một lần.
 */

const { resolveGuidedReq, loadGuidedContext, nextTcNumber } = require('./qaGuidedFixes');
const { skipEntry, readTarget, fileEntry, tryPatch, describePatch, cardOf } = require('./qaBatchPlanParts');
const { httpError, plannedSessions } = require('./qaBatchSessionStore');

/** Ngữ cảnh guided nạp một lần cho mỗi lượt lập kế hoạch (có chạy playwright --list). */
function guidedState(root) {
  const ctx = loadGuidedContext(root);
  const reservedElsewhere = plannedSessions(root).flatMap((s) => s.reservedTcs || []);
  return { ...ctx, reserved: new Set(reservedElsewhere), reservedHere: [] };
}

/** Thêm bản vá guided ở trạng thái chờ chọn AC. Trả {} hoặc { skip }. */
function addGuidedPatch(file, finding, line, state, knownReqs) {
  const req = resolveGuidedReq(file.doc.lines, line - 1, file.relPath, knownReqs);
  if (req.skip) return req;
  const acs = state.acsByReq.get(req.reqId) || [];
  if (!acs.length) return { skip: 'REQ_NO_AC' };
  const traceFile = state.traceFileByReq.get(req.reqId);
  if (!traceFile) return { skip: 'NO_TRACEABILITY_TABLE' };
  const n = nextTcNumber(state.usedTcs, state.reserved);
  if (n === null) return { skip: 'TC_OVERFLOW' };
  state.reserved.add(n);
  state.reservedHere.push(n);
  file.patches.set(finding.findingKey, {
    findingKey: finding.findingKey,
    kind: finding.kind,
    line,
    occurrences: finding.occurrences || 1,
    choice: {
      reqId: req.reqId,
      tagged: req.tagged,
      tcId: `TC-${String(n).padStart(3, '0')}`,
      acId: null,
      acs,
      traceFile,
      spec: file.relPath,
      title: req.title,
    },
    risk: 'traceability',
    defaultSelected: false,
    needsInput: true,
    hunk: null,
  });
  return {};
}

/** batch-input { acId }: dựng bản vá spec + dòng traceability; lỗi thì giữ nguyên bản vá cũ. */
function applyAcInput(root, session, file, current, acId) {
  if (current.kind !== 'test-khong-co-ma-tc' || !current.choice.acs.some((ac) => ac.id === acId)) {
    throw httpError(400, 'INVALID_INPUT', 'AC không thuộc requirement của test này.');
  }
  const choice = { ...current.choice, acId };
  const specPatch = { ...current, choice, defaultSelected: true };
  const specResult = tryPatch(root, file.doc, file.relPath, specPatch, {});
  if (specResult.skip) return { ok: true, revision: session.revision, skipped: skipEntry(current, specResult.skip) };

  let trace = session.files.get(choice.traceFile);
  if (!trace) {
    const target = readTarget(root, choice.traceFile);
    if (target.skip) return { ok: true, revision: session.revision, skipped: skipEntry(current, target.skip) };
    trace = fileEntry(target.relPath, target.absPath);
  }
  const rowPatch = { findingKey: current.findingKey, kind: 'traceability-row', line: 0, occurrences: 1, choice, risk: 'traceability' };
  const rowResult = tryPatch(root, trace.doc, trace.relPath, rowPatch, {});
  if (rowResult.skip) return { ok: true, revision: session.revision, skipped: skipEntry(current, rowResult.skip) };

  file.patches.set(current.findingKey, describePatch(specPatch, file.doc, specResult));
  trace.patches.set(current.findingKey, describePatch(rowPatch, trace.doc, rowResult));
  session.files.set(trace.relPath, trace);
  session.revision += 1;
  return { ok: true, revision: session.revision, card: cardOf(file), cards: [cardOf(file), cardOf(trace)] };
}

module.exports = { guidedState, addGuidedPatch, applyAcInput };
