'use strict';

/**
 * dashboard/services/smartTraceLinkerService.js
 * Facade chính cho Smart Trace Linker Engine:
 * - analyzeSmartLink(): Phân tích spec, bóc tách intent, xếp hạng candidates & newScaffold
 * - applySmartLink(): Bọc withWriteLock và ghi đĩa nguyên tử
 * Ngân sách dòng: <= 200 dòng.
 */

const fs = require('node:fs');
const path = require('node:path');
const { withWriteLock, httpError } = require('./qaBatchSessionStore');
const { assertSpecPath, computeSpecHash, parseSpecContent } = require('./smartLinkSpecParser');
const { rankMatchingRequirements } = require('./smartLinkMatcher');
const { draftLinkToExistingReq, draftNewReqScaffold } = require('./smartLinkDrafter');
const { detectSpecDelta } = require('./specDeltaService');
const { executeApply } = require('./smartLinkApply');

/** Phân tích kịch bản kiểm thử và trả về đề xuất so khớp thông minh */
async function analyzeSmartLink(root, { specPath, specContent } = {}) {
  let content = specContent;
  let diskContent = '';
  let hashSource = 'disk';
  let absSpec = null;

  if (specPath) {
    absSpec = assertSpecPath(root, specPath);
    if (fs.existsSync(absSpec)) {
      diskContent = fs.readFileSync(absSpec, 'utf8');
    }
  }

  if (typeof content !== 'string') {
    if (!diskContent) {
      throw httpError(400, 'INVALID_PARAMS', 'Cần cung cấp specContent hoặc specPath của file đã tồn tại.');
    }
    content = diskContent;
    hashSource = 'disk';
  } else {
    hashSource = 'editor';
  }

  const specHash = computeSpecHash(content);
  const diskHash = diskContent ? computeSpecHash(diskContent) : specHash;

  const specParsed = parseSpecContent(content);
  const relSpec = specPath ? path.relative(root, absSpec || path.resolve(root, specPath)).replace(/\\/g, '/') : '';
  specParsed.specPath = relSpec;

  const intent = {
    describeTitle: specParsed.describeTitle || 'Kiểm thử chức năng',
    testTitles: specParsed.tests.map((t) => t.title),
    keywords: specParsed.tests.flatMap((t) => t.steps).slice(0, 10),
  };

  // Kiểm tra phân luồng mode
  const deltaRes = detectSpecDelta(root, specParsed, relSpec);

  if (deltaRes.mode === 'reverse_sync') {
    return {
      specPath: relSpec,
      specHash,
      diskHash,
      hashSource,
      mode: 'reverse_sync',
      hasExistingReq: true,
      existingReqTags: specParsed.existingReqTags,
      delta: deltaRes.delta,
      intent,
      candidates: [],
      newScaffold: null,
    };
  }

  if (deltaRes.mode === 'conflict') {
    return {
      specPath: relSpec,
      specHash,
      diskHash,
      hashSource,
      mode: 'conflict',
      hasExistingReq: true,
      existingReqTags: specParsed.existingReqTags,
      conflictMessage: deltaRes.message,
      delta: null,
      intent,
      candidates: [],
      newScaffold: null,
    };
  }

  // mode === 'link': Tìm candidates và tạo newScaffold
  const { candidates, maxReqNumber } = rankMatchingRequirements(root, specParsed);

  const enrichedCandidates = candidates.slice(0, 5).map((c) => {
    const draft = draftLinkToExistingReq(root, c, specParsed, relSpec);
    return {
      reqId: c.reqId,
      title: c.title,
      score: c.score,
      matchLevel: c.matchLevel,
      docPath: c.docPath,
      tcPath: c.tcPath,
      suggestedAcId: draft.suggestedAcId,
      suggestedTcId: draft.suggestedTcId,
      preview: draft.preview,
    };
  });

  const newScaffold = draftNewReqScaffold(root, specParsed, maxReqNumber, relSpec);

  return {
    specPath: relSpec,
    specHash,
    diskHash,
    hashSource,
    mode: 'link',
    hasExistingReq: false,
    existingReqTags: [],
    delta: null,
    intent,
    candidates: enrichedCandidates,
    newScaffold,
  };
}

/** Áp dụng liên kết requirement được bảo vệ bởi withWriteLock */
async function applySmartLink(root, params) {
  if (params && params.specPath) {
    assertSpecPath(root, params.specPath);
  }
  return await withWriteLock(root, async () => {
    return await executeApply(root, params);
  });
}

module.exports = {
  analyzeSmartLink,
  applySmartLink,
};
