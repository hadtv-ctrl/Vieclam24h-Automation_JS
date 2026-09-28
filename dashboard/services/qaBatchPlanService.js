'use strict';

/**
 * dashboard/services/qaBatchPlanService.js
 * Lập kế hoạch sửa hàng loạt (PLAN-18). Client chỉ gửi findingKey; server tra finding của lần quét
 * gần nhất, đọc file thật, chỉ giữ bản vá parse được và làm finding biến mất (INV-1, INV-3). Bản vá
 * lưu dạng ý định (kind + dòng + lựa chọn) để lúc commit dựng lại trên nội dung hiện tại.
 */

const fs = require('node:fs');
const { getQaSummary, getFindingsIndex } = require('./qaService');
const { parseDocument, serializeDocument } = require('./qaFixText');
const { loadReqContext } = require('./qaQuickFixes');
const { skipEntry, readTarget, fileEntry, tryPatch, describePatch, cardOf } = require('./qaBatchPlanParts');
const { guidedState, addGuidedPatch, applyAcInput } = require('./qaGuidedPlan');
const {
  httpError,
  createSession,
  requireSession,
  requireRevision,
} = require('./qaBatchSessionStore');

const MAX_KEYS = 200;
const AUTO_ROUTES = new Set(['quick', 'guided']);

function describePlan(session) {
  const cards = [...session.files.values()].map(cardOf);
  const keys = new Set(cards.flatMap((card) => card.patches.map((p) => p.findingKey)));
  return {
    ok: true,
    session: { sessionId: session.id, revision: session.revision, expiresAt: new Date(session.expiresAt).toISOString() },
    cards,
    skipped: session.skipped,
    totals: { patches: keys.size, files: cards.length, skipped: session.skipped.length },
  };
}

/** POST batch-plan. `options.findingsIndex` chỉ dùng trong test. */
function buildPlan(root, findingKeys, options = {}) {
  if (!Array.isArray(findingKeys) || !findingKeys.length || findingKeys.length > MAX_KEYS
    || !findingKeys.every((key) => typeof key === 'string' && key)) {
    throw httpError(400, 'INVALID_BODY', `Cần từ 1 đến ${MAX_KEYS} findingKey.`);
  }
  let index = options.findingsIndex || getFindingsIndex(root);
  if (!index) {
    getQaSummary(root);
    index = getFindingsIndex(root);
  }
  const ctx = loadReqContext(root);
  const files = new Map();
  const skipped = [];
  let guided = null;
  for (const key of new Set(findingKeys)) {
    const finding = index && index.byKey.get(key);
    if (!finding) { skipped.push(skipEntry({ findingKey: key }, 'NOT_IN_LATEST_SCAN')); continue; }
    if (!AUTO_ROUTES.has(finding.fixRoute)) { skipped.push(skipEntry(finding, 'MANUAL_ROUTE')); continue; }
    const target = readTarget(root, finding.where);
    if (target.skip || !target.line) { skipped.push(skipEntry(finding, target.skip || 'LINE_UNKNOWN')); continue; }
    if (!files.has(target.relPath)) files.set(target.relPath, fileEntry(target.relPath, target.absPath));
    const file = files.get(target.relPath);
    if (finding.fixRoute === 'guided') {
      guided = guided || guidedState(root);
      const res = addGuidedPatch(file, finding, target.line, guided, ctx.knownReqs);
      if (res.skip) skipped.push(skipEntry(finding, res.skip));
      continue;
    }
    const patch = {
      findingKey: key,
      kind: finding.kind,
      line: target.line,
      occurrences: finding.occurrences || 1,
      choice: finding.kind === 'test-bi-skip-am-tham' ? { skipMode: 'wip' } : {},
    };
    const result = tryPatch(root, file.doc, file.relPath, patch, ctx);
    if (result.skip) { skipped.push(skipEntry(finding, result.skip)); continue; }
    file.patches.set(key, describePatch(patch, file.doc, result));
  }
  for (const [relPath, file] of files) if (!file.patches.size) files.delete(relPath);
  return describePlan(createSession(root, {
    files,
    skipped,
    scanId: index ? index.scanId : null,
    reservedTcs: guided ? guided.reservedHere : [],
    specPaths: guided ? guided.specPaths : [],
  }));
}

/** POST batch-input: đổi chế độ xử lý test bị skip, hoặc chọn AC cho bản vá guided. */
function applyInput(root, { sessionId, revision, findingKey, input } = {}) {
  const session = requireSession(root, sessionId);
  if (session.state !== 'PLANNED') throw httpError(409, 'INVALID_STATE', 'Kế hoạch không còn ở trạng thái chờ áp dụng.');
  requireRevision(session, revision);
  const file = [...session.files.values()].find((f) => f.patches.has(findingKey) && f.patches.get(findingKey).kind !== 'traceability-row');
  if (!file) throw httpError(404, 'FINDING_NOT_FOUND', 'Bản vá không có trong kế hoạch này.');
  const current = file.patches.get(findingKey);
  if (input && typeof input.acId === 'string') return applyAcInput(root, session, file, current, input.acId);
  const skipMode = input && input.skipMode;
  if (current.kind !== 'test-bi-skip-am-tham' || !['wip', 'unskip'].includes(skipMode)) {
    throw httpError(400, 'INVALID_INPUT', 'Lựa chọn không hợp lệ cho bản vá này.');
  }
  const patch = { ...current, choice: { skipMode } };
  const result = tryPatch(root, file.doc, file.relPath, patch, {});
  if (result.skip) return { ok: true, revision: session.revision, skipped: skipEntry(current, result.skip) };
  file.patches.set(findingKey, describePatch(patch, file.doc, result));
  session.revision += 1;
  return { ok: true, revision: session.revision, card: cardOf(file), cards: [cardOf(file)] };
}

/**
 * Dựng nội dung cuối của mỗi file từ nội dung HIỆN TẠI + các bản vá được tick, lần lượt.
 * ALREADY_FIXED ở đây nghĩa là bản vá trước trong cùng file đã xử lý luôn (vd. chung describe).
 * Bản vá trải nhiều file (guided: spec + traceability) hỏng ở một file thì bỏ ở mọi file.
 */
function composeForCommit(root, session, accepted) {
  const first = composeFiles(root, session, accepted);
  const failed = new Set(first.flatMap((c) => c.notApplied.map((n) => n.findingKey)));
  const partial = [...failed].filter((key) => first.some((c) => c.applied.includes(key)));
  if (!partial.length) return first;
  const narrowed = new Set([...accepted].filter((key) => !partial.includes(key)));
  const second = composeFiles(root, session, narrowed);
  const reasons = new Map(first.flatMap((c) => c.notApplied.map((n) => [n.findingKey, n.reasonCode])));
  second.extraNotApplied = partial.map((key) => ({ findingKey: key, reasonCode: reasons.get(key) }));
  return second;
}

function composeFiles(root, session, accepted) {
  const ctx = loadReqContext(root);
  const out = [];
  for (const file of session.files.values()) {
    const chosen = [...file.patches.values()].filter((p) => accepted.has(p.findingKey));
    if (!chosen.length) continue;
    const original = fs.readFileSync(file.absPath, 'utf8');
    let doc = parseDocument(original);
    const applied = [];
    const notApplied = [];
    for (const patch of chosen) {
      const result = tryPatch(root, doc, file.relPath, patch, ctx);
      if (result.skip === 'ALREADY_FIXED') applied.push(patch.findingKey);
      else if (result.skip) notApplied.push({ findingKey: patch.findingKey, reasonCode: result.skip });
      else {
        doc = result.doc;
        applied.push(patch.findingKey);
      }
    }
    out.push({ file, original, content: serializeDocument(doc), applied, notApplied });
  }
  return out;
}

module.exports = { buildPlan, applyInput, composeForCommit, MAX_KEYS };
