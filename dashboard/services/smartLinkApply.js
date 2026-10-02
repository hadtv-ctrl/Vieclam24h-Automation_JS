'use strict';

/**
 * dashboard/services/smartLinkApply.js
 * Thực thi ghi đĩa nguyên tử có snapshot và rollback cho Smart Trace Linker.
 * Thứ tự ghi: TC -> REQ -> Spec.
 * Ngân sách dòng: <= 200 dòng.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { httpError } = require('./qaBatchSessionStore');
const { writeAtomic } = require('./qaBatchManifest');
const { buildTestCaseDocument, synthesizeScaffoldContents, slugify } = require('./qaInferenceService');
const { computeSpecHash, parseSpecContent, RE_VALID_REQ_ID } = require('./smartLinkSpecParser');
const { patchSpecWithReqTag, scanMaxIds, draftLinkToExistingReq } = require('./smartLinkDrafter');
const { detectSpecDelta } = require('./specDeltaService');

const BACKUP_BASE = path.join('.dashboard-backups', 'smart-link');

function createSnapshot(root, sessionId, relPaths) {
  const sessionDir = path.join(root, BACKUP_BASE, sessionId, 'files');
  fs.mkdirSync(sessionDir, { recursive: true });
  const snapshotMap = {};
  for (const rel of relPaths) {
    const abs = path.resolve(root, rel);
    const snapAbs = path.join(sessionDir, rel.replace(/[\\/]/g, '_'));
    const existed = fs.existsSync(abs);
    if (existed) fs.copyFileSync(abs, snapAbs);
    snapshotMap[rel] = { existed, snapAbs, abs };
  }
  return snapshotMap;
}

function rollbackSnapshot(snapshotMap) {
  for (const info of Object.values(snapshotMap)) {
    try {
      if (info.existed && fs.existsSync(info.snapAbs)) fs.copyFileSync(info.snapAbs, info.abs);
      else if (!info.existed && fs.existsSync(info.abs)) fs.rmSync(info.abs, { force: true });
    } catch (_) { /* rollback */ }
  }
}

/** Thực thi apply smart link với cơ chế bảo vệ nguyên tử */
async function executeApply(root, params) {
  const { specPath, specHash, diskHash, mode = 'link_existing', targetReqId, newReqData, currentEditorContent } = params;

  if (targetReqId && !RE_VALID_REQ_ID.test(targetReqId)) {
    throw httpError(400, 'INVALID_PARAMS', `targetReqId phải khớp định dạng ^REQ-\\d{3}$: ${targetReqId}`);
  }

  const absSpec = path.resolve(root, specPath);
  if (!fs.existsSync(absSpec)) {
    throw httpError(404, 'SPEC_NOT_FOUND', `File spec không tồn tại trên đĩa: ${specPath}`);
  }

  const currentDiskContent = fs.readFileSync(absSpec, 'utf8');
  const currentDiskHash = computeSpecHash(currentDiskContent);

  if (diskHash && diskHash !== currentDiskHash) {
    throw httpError(409, 'SPEC_CHANGED', 'Nội dung spec trên đĩa đã bị thay đổi so với thời điểm phân tích.');
  }

  const specToProcess = currentEditorContent || currentDiskContent;
  if (specHash && computeSpecHash(specToProcess) !== specHash) {
    throw httpError(409, 'SPEC_CHANGED', 'Nội dung spec trong editor đã bị chỉnh sửa. Hãy phân tích lại.');
  }

  const specParsed = parseSpecContent(specToProcess);
  let assignedReqId = targetReqId;
  let relTcPath = '';
  let relReqPath = '';
  let updatedTcContent = '';
  let updatedReqContent = '';
  let patchedSpecContent = '';

  if (mode === 'link_existing' || mode === 'reverse_sync') {
    if (!assignedReqId) throw httpError(400, 'INVALID_PARAMS', 'Thiếu targetReqId cho chế độ link_existing / reverse_sync.');

    const reqDir = path.join(root, 'requirements');
    const tcDir = path.join(root, 'test-cases');
    const reqFiles = fs.existsSync(reqDir) ? fs.readdirSync(reqDir).filter((f) => f.startsWith(`${assignedReqId}`) && f.endsWith('.md')) : [];
    const tcFiles = fs.existsSync(tcDir) ? fs.readdirSync(tcDir).filter((f) => f.startsWith(`${assignedReqId}`) && f.endsWith('.md')) : [];

    relReqPath = reqFiles.length > 0 ? `requirements/${reqFiles[0]}` : `requirements/${assignedReqId}.md`;
    relTcPath = tcFiles.length > 0 ? `test-cases/${tcFiles[0]}` : `test-cases/${assignedReqId}.md`;

    const absReq = path.resolve(root, relReqPath);
    const absTc = path.resolve(root, relTcPath);

    const oldReq = fs.existsSync(absReq) ? fs.readFileSync(absReq, 'utf8') : `# ${assignedReqId}\n\n`;
    const oldTc = fs.existsSync(absTc) ? fs.readFileSync(absTc, 'utf8') : `# Test Cases: ${assignedReqId}\n\n`;

    let testCasesToAdd = [];
    let acLinesToAdd = [];

    if (mode === 'reverse_sync') {
      const deltaRes = detectSpecDelta(root, specParsed, specPath);
      testCasesToAdd = (deltaRes.delta?.newTests || []).map((t) => ({
        suggestedId: t.suggestedTcId,
        acId: t.suggestedAcId,
        title: t.title,
        priority: t.priority,
        automation: 'Yes',
        spec: specPath,
        steps: t.steps ? t.steps.map((st, i) => ({ step: i + 1, action: st, expected: 'Thành công' })) : null,
      }));
      acLinesToAdd = testCasesToAdd.map((tc) => `- ${tc.acId}: Given chuẩn bị môi trường, When thực hiện "${tc.title}", Then hệ thống xử lý đúng.`);
      patchedSpecContent = specToProcess;
    } else {
      const draft = draftLinkToExistingReq(root, { docPath: relReqPath, tcPath: relTcPath, reqId: assignedReqId, title: '' }, specParsed, specPath);
      testCasesToAdd = draft.testCasesForDoc;
      acLinesToAdd = draft.preview.newAcLines;
      patchedSpecContent = patchSpecWithReqTag(specToProcess, assignedReqId);
    }

    updatedTcContent = buildTestCaseDocument(oldTc, assignedReqId, testCasesToAdd);
    const acIdx = oldReq.search(/^##\s*(?:Acceptance\s*criteria|Tiêu chí chấp nhận)/im);
    if (acIdx !== -1) {
      const rest = oldReq.slice(acIdx);
      const nextH = rest.slice(1).search(/\n##\s+/);
      const pos = nextH !== -1 ? acIdx + 1 + nextH : -1;
      updatedReqContent = pos !== -1
        ? oldReq.slice(0, pos).trimEnd() + '\n' + acLinesToAdd.join('\n') + '\n\n' + oldReq.slice(pos).trimStart()
        : oldReq.trimEnd() + '\n' + acLinesToAdd.join('\n') + '\n';
    } else {
      updatedReqContent = oldReq.trimEnd() + '\n\n' + acLinesToAdd.join('\n') + '\n';
    }
  } else if (mode === 'create_new') {
    const title = newReqData?.title || specParsed.describeTitle || 'Nghiệp vụ mới';
    const cleanTitle = title.replace(/@[a-zA-Z0-9_\-]+/g, '').replace(/^(?:Kiem thu|Test|Kich ban|Suite)\s*:?\s*/i, '').trim();
    const slug = newReqData?.slug || slugify(cleanTitle) || 'chuc-nang-moi';

    if (!assignedReqId) {
      const reqDir = path.join(root, 'requirements');
      let maxNum = 0;
      if (fs.existsSync(reqDir)) {
        const files = fs.readdirSync(reqDir).filter((f) => /^REQ-\d{3}.*\.md$/i.test(f));
        for (const f of files) {
          const m = f.match(/^REQ-(\d{3})/i);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
      }
      assignedReqId = `REQ-${String(maxNum + 1).padStart(3, '0')}`;
    }

    relReqPath = `requirements/${assignedReqId}-${slug}.md`;
    relTcPath = `test-cases/${assignedReqId}-${slug}.md`;

    const scaffold = synthesizeScaffoldContents(root, {
      reqId: assignedReqId,
      domain: 'e2e',
      title: cleanTitle,
      slug,
      businessGoal: `Kiểm thử tự động cho ${cleanTitle}.`,
      acs: specParsed.tests.map((t, idx) => ({
        id: `AC-${String(idx + 1).padStart(3, '0')}`,
        title: t.title.replace(/@[a-zA-Z0-9_\-]+/g, '').trim(),
      })),
      testCases: specParsed.tests.map((t, idx) => ({
        id: `TC-${String(idx + 1).padStart(3, '0')}`,
        acId: `AC-${String(idx + 1).padStart(3, '0')}`,
        title: t.title.replace(/@[a-zA-Z0-9_\-]+/g, '').trim(),
        automation: 'Yes',
        priority: 'P1',
      })),
    });

    updatedReqContent = scaffold.reqContent;
    updatedTcContent = scaffold.tcContent;
    patchedSpecContent = patchSpecWithReqTag(specToProcess, assignedReqId);
  } else {
    throw httpError(400, 'INVALID_PARAMS', `Chế độ mode không hợp lệ: ${mode}`);
  }

  // Ghi đĩa nguyên tử: TC -> REQ -> Spec
  const filesToTouch = [relTcPath, relReqPath, specPath];
  const sessionId = `sl-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const snapshotMap = createSnapshot(root, sessionId, filesToTouch);

  try {
    await writeAtomic(path.resolve(root, relTcPath), updatedTcContent);
    await writeAtomic(path.resolve(root, relReqPath), updatedReqContent);
    await writeAtomic(path.resolve(root, specPath), patchedSpecContent);
  } catch (writeErr) {
    rollbackSnapshot(snapshotMap);
    throw httpError(500, 'APPLY_FAILED', `Ghi file thất bại: ${writeErr.message}. Đã rollback sạch sẽ.`);
  }

  return {
    success: true, assignedReqId, patchedSpecContent,
    updatedFiles: filesToTouch, backupSessionId: sessionId,
  };
}

module.exports = {
  executeApply,
};
