'use strict';

/**
 * dashboard/services/specDeltaService.js
 * Phát hiện delta giữa code spec và tài liệu TC, phục vụ Reverse Sync và Mode ('link' | 'reverse_sync' | 'conflict').
 * Ngân sách dòng: <= 200 dòng.
 */

const fs = require('node:fs');
const path = require('node:path');
const { stripDiacritics } = require('./smartLinkMatcher');
const { scanMaxIds } = require('./smartLinkDrafter');

function normalizeTitleForCompare(str) {
  return stripDiacritics(str)
    .replace(/@[a-zA-Z0-9_\-]+/g, '')
    .replace(/\b(?:tc|ac)-\d{1,4}\b/gi, '')
    .replace(/^tc-[a-z0-9_\-]+:?\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sanitizeTestTitle(title) {
  return String(title || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '-')
    .trim();
}

/** Đọc các test case đã có trong file markdown test-cases (cả heading và table row) */
function parseExistingTestCases(content) {
  const existing = [];
  const lines = String(content || '').split(/\r?\n/);
  for (const line of lines) {
    const headingMatch = line.match(/^#{2,4}\s*(TC-\d{3})\s*[:—.\-]?\s*(.*)/i);
    const tableMatch = line.match(/^\s*\|\s*(TC-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|/i);
    const id = (headingMatch ? headingMatch[1] : (tableMatch ? tableMatch[1] : '')).toUpperCase();
    const rawTitle = (headingMatch ? headingMatch[2] : (tableMatch ? tableMatch[3] : '')).trim();
    if (id && rawTitle) {
      const idx = existing.findIndex((e) => e.id === id);
      if (idx === -1) {
        existing.push({ id, title: rawTitle, normTitle: normalizeTitleForCompare(rawTitle) });
      } else if (!existing[idx].title || headingMatch) {
        existing[idx] = { id, title: rawTitle, normTitle: normalizeTitleForCompare(rawTitle) };
      }
    }
  }
  return existing;
}

/** Phát hiện sự khác biệt giữa Spec và tài liệu Test Cases hiện có */
function detectSpecDelta(root, specParsed, relSpecPath = '') {
  const { existingReqTags = [], tests = [] } = specParsed;
  if (!existingReqTags.length) return { mode: 'link', delta: null };

  const uniqueTags = [...new Set(existingReqTags)];
  if (uniqueTags.length > 1) {
    return { mode: 'conflict', conflictTags: uniqueTags, message: `Spec gắn nhiều tag Requirement: ${uniqueTags.join(', ')}`, delta: null };
  }

  const reqId = uniqueTags[0];
  const reqDir = path.join(root, 'requirements');
  const tcDir = path.join(root, 'test-cases');
  const reqFile = (fs.existsSync(reqDir) && fs.readdirSync(reqDir).find((f) => f.startsWith(reqId) && f.endsWith('.md'))) || '';
  const tcFile = (fs.existsSync(tcDir) && fs.readdirSync(tcDir).find((f) => f.startsWith(reqId) && f.endsWith('.md'))) || '';

  if (!reqFile && !tcFile) {
    return { mode: 'conflict', conflictTags: [reqId], message: `Tag ${reqId} trên spec không tồn tại tài liệu tương ứng.`, delta: null };
  }

  const reqAbs = reqFile ? path.join(reqDir, reqFile) : '';
  const tcAbs = tcFile ? path.join(tcDir, tcFile) : '';
  const reqContent = reqAbs && fs.existsSync(reqAbs) ? fs.readFileSync(reqAbs, 'utf8') : '';
  const tcContent = tcAbs && fs.existsSync(tcAbs) ? fs.readFileSync(tcAbs, 'utf8') : '';

  const existingTcs = parseExistingTestCases(tcContent);
  const { maxAc, maxTc } = scanMaxIds(reqContent, tcContent);
  const newTests = [];
  let knownCount = 0;
  const renamedWarnings = [];

  tests.forEach((t) => {
    const rawTitle = t.title || '';
    const cleanTitle = sanitizeTestTitle(rawTitle.replace(/@[a-zA-Z0-9_\-]+/g, '').replace(/^TC-[A-Z0-9_\-]+:?\s*/i, '').trim());
    const normTest = normalizeTitleForCompare(rawTitle);
    const tcTagMatch = rawTitle.match(/\bTC-(\d{3})\b/i);
    const taggedTcId = tcTagMatch ? `TC-${tcTagMatch[1]}`.toUpperCase() : null;

    let isKnown = false;
    if (taggedTcId) {
      const existingWithId = existingTcs.find((e) => e.id === taggedTcId);
      if (existingWithId) {
        if (existingWithId.normTitle === normTest || normTest.includes(existingWithId.normTitle) || existingWithId.normTitle.includes(normTest)) {
          isKnown = true;
          knownCount += 1;
        } else {
          renamedWarnings.push({
            tcId: taggedTcId,
            oldTitle: existingWithId.title,
            newTitle: cleanTitle,
            message: `Kịch bản mang tag ${taggedTcId} có tiêu đề mới ("${cleanTitle}") khác tài liệu ("${existingWithId.title}"). Coi như mới, không xoá TC cũ.`,
          });
        }
      }
    }

    if (!isKnown && !taggedTcId && existingTcs.some((e) => e.normTitle && (e.normTitle === normTest || (normTest.length >= 8 && e.normTitle.includes(normTest)) || (e.normTitle.length >= 8 && normTest.includes(e.normTitle))))) {
      isKnown = true;
      knownCount += 1;
    }

    if (!isKnown) {
      const tcNum = maxTc + newTests.length + 1;
      const acNum = maxAc + newTests.length + 1;
      const suggestedTcId = `TC-${String(tcNum).padStart(3, '0')}`;
      const suggestedAcId = `AC-${String(acNum).padStart(3, '0')}`;
      const exp = t.assertions && t.assertions[0] ? sanitizeTestTitle(t.assertions[0]) : null;
      const steps = (t.steps && t.steps.length > 0) ? t.steps : [
        'Mở và chuẩn bị môi trường kiểm thử',
        `Thực hiện thao tác: ${cleanTitle}`,
        exp ? `Xác nhận kỳ vọng qua assertion: ${exp}` : 'Kiểm tra phản hồi và trạng thái thành công',
      ];

      newTests.push({ title: cleanTitle, suggestedTcId, suggestedAcId, steps, priority: 'P1', spec: relSpecPath || '-' });
    }
  });

  return {
    mode: 'reverse_sync',
    delta: {
      reqId,
      docPath: reqFile ? `requirements/${reqFile}` : `requirements/${reqId}.md`,
      tcPath: tcFile ? `test-cases/${tcFile}` : `test-cases/${reqId}.md`,
      newTests,
      knownCount,
      renamedWarnings,
      inSync: newTests.length === 0,
    },
  };
}

module.exports = {
  normalizeTitleForCompare,
  parseExistingTestCases,
  sanitizeTestTitle,
  detectSpecDelta,
};

