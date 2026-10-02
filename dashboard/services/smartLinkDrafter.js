'use strict';

/**
 * dashboard/services/smartLinkDrafter.js
 * Sinh bản thảo AC/TC bổ sung khi ghép vào REQ có sẵn, bản thảo Scaffold REQ mới,
 * và thực hiện patch tag @REQ-xxx vào mã nguồn Playwright Spec.
 * Ngân sách dòng: <= 200 dòng.
 */

const fs = require('node:fs');
const path = require('node:path');
const { slugify, synthesizeScaffoldContents } = require('./qaInferenceService');

/** Tìm số thứ tự AC và TC lớn nhất hiện có trong tài liệu */
function scanMaxIds(reqContent, tcContent) {
  let maxAc = 0;
  let maxTc = 0;

  const acMatches = String(reqContent || '').matchAll(/\bAC-(\d{3})\b/g);
  for (const m of acMatches) {
    const n = parseInt(m[1], 10);
    if (n > maxAc) maxAc = n;
  }

  const tcMatches = String(tcContent || '').matchAll(/\bTC-(\d{3})\b/g);
  for (const m of tcMatches) {
    const n = parseInt(m[1], 10);
    if (n > maxTc) maxTc = n;
  }

  return { maxAc: maxAc || 0, maxTc: maxTc || 0 };
}

/** Tạo bản thảo AC & TC đề xuất khi ghép vào Requirement có sẵn */
function draftLinkToExistingReq(root, candidate, specParsed, relSpecPath = '') {
  const reqAbs = path.join(root, candidate.docPath);
  const tcAbs = path.join(root, candidate.tcPath);

  const reqContent = fs.existsSync(reqAbs) ? fs.readFileSync(reqAbs, 'utf8') : '';
  const tcContent = fs.existsSync(tcAbs) ? fs.readFileSync(tcAbs, 'utf8') : '';
  const { maxAc, maxTc } = scanMaxIds(reqContent, tcContent);

  const tests = specParsed.tests.length > 0 ? specParsed.tests : [{ title: specParsed.describeTitle || 'Kiểm thử tính năng' }];
  const newAcLines = [];
  const newTcRows = [];
  const testCasesForDoc = [];

  tests.forEach((t, idx) => {
    const acNum = maxAc + idx + 1;
    const tcNum = maxTc + idx + 1;
    const acId = `AC-${String(acNum).padStart(3, '0')}`;
    const tcId = `TC-${String(tcNum).padStart(3, '0')}`;
    const title = t.title.replace(/@[a-zA-Z0-9_\-]+/g, '').replace(/^TC-[A-Z0-9_\-]+:?\s*/i, '').trim() || 'Kịch bản kiểm thử mới';

    newAcLines.push(`- ${acId}: Given môi trường kiểm thử sẵn sàng, When thực hiện "${title}", Then hệ thống xử lý chính xác theo quy chuẩn.`);
    newTcRows.push(`| ${candidate.reqId} | ${acId} | ${tcId} | Yes | ${relSpecPath || '-'} | P1 |`);

    testCasesForDoc.push({
      suggestedId: tcId,
      acId,
      title,
      priority: 'P1',
      automation: 'Yes',
      spec: relSpecPath || '-',
      steps: t.steps && t.steps.length ? t.steps.map((st, sIdx) => ({ step: sIdx + 1, action: st, expected: 'Xử lý thành công' })) : null,
    });
  });

  return {
    reqId: candidate.reqId,
    title: candidate.title,
    suggestedAcId: `AC-${String(maxAc + 1).padStart(3, '0')}`,
    suggestedTcId: `TC-${String(maxTc + 1).padStart(3, '0')}`,
    preview: { newAcLines, newTcRows },
    testCasesForDoc,
  };
}

/** Tạo bản thảo Scaffold cho Requirement hoàn toàn mới */
function draftNewReqScaffold(root, specParsed, maxReqNumber, relSpecPath = '') {
  const nextNum = (maxReqNumber || 0) + 1;
  const nextReqId = `REQ-${String(nextNum).padStart(3, '0')}`;
  const rawTitle = specParsed.describeTitle.replace(/@[a-zA-Z0-9_\-]+/g, '').trim() || 'Nghiệp vụ mới';
  const cleanTitle = rawTitle.replace(/^(?:Kiem thu|Test|Kich ban|Suite)\s*:?\s*/i, '').trim() || 'Nghiệp vụ chức năng';
  const slug = slugify(cleanTitle) || `chuc-nang-${nextReqId.toLowerCase()}`;

  const tests = specParsed.tests.length > 0 ? specParsed.tests : [{ title: cleanTitle }];
  const acs = tests.map((t, idx) => ({
    id: `AC-${String(idx + 1).padStart(3, '0')}`,
    title: t.title.replace(/@[a-zA-Z0-9_\-]+/g, '').trim(),
    given: 'Người dùng truy cập màn hình chức năng',
    when: `Thực hiện thao tác: ${t.title.replace(/@[a-zA-Z0-9_\-]+/g, '').trim()}`,
    then: 'Hệ thống phản hồi chính xác và hiển thị kết quả mong đợi',
  }));

  const testCases = acs.map((ac, idx) => ({
    id: `TC-${String(idx + 1).padStart(3, '0')}`,
    acId: ac.id,
    title: ac.title,
    automation: 'Yes',
    priority: 'P1',
  }));

  const scaffold = synthesizeScaffoldContents(root, {
    reqId: nextReqId,
    domain: 'e2e',
    title: cleanTitle,
    slug,
    businessGoal: `Kiểm thử tự động hóa quy trình nghiệp vụ cho ${cleanTitle}.`,
    acs,
    testCases,
  });

  const previewLines = [
    `Requirement: ${nextReqId} — ${cleanTitle}`,
    ...acs.map((ac) => `${ac.id}: Given/When/Then cho "${ac.title}"`),
    ...testCases.map((tc) => `${tc.id} (${tc.acId}): Priority ${tc.priority}, Spec: ${relSpecPath || '-'}`),
  ];

  return {
    nextReqId,
    suggestedReqId: nextReqId,
    suggestedTitle: cleanTitle,
    slug,
    reqFileName: `${nextReqId}-${slug}.md`,
    tcFileName: `${nextReqId}-${slug}.md`,
    reqContent: scaffold.reqContent,
    tcContent: scaffold.tcContent,
    previewLines,
  };
}

/** Chèn tag @REQ-xxx vào spec content một cách an toàn */
function patchSpecWithReqTag(specContent, reqId) {
  const normalized = String(specContent || '').replace(/\r\n/g, '\n');
  const tag = `@${reqId}`;

  // Kiểm tra nếu đã có tag này rồi thì không sửa
  if (new RegExp(`\\b${tag}\\b`).test(normalized)) {
    return normalized;
  }

  // 1. Nếu có test.describe: gắn vào cuối chuỗi title của describe đầu tiên (hoặc các describe cấp cao nhất)
  let patched = false;
  const describeRegex = /(test\.describe(?:\.(?:parallel|serial|only|skip|fixme))?\s*\(\s*(['"`]))((?:\\.|(?!\2).)*)(\2)/;
  const match = normalized.match(describeRegex);

  if (match) {
    const existingTitle = match[3];
    if (!existingTitle.includes(tag)) {
      const newTitle = `${existingTitle.trim()} ${tag}`;
      patched = normalized.replace(describeRegex, `$1${newTitle}$4`);
      return patched;
    }
    return normalized;
  }

  // 2. Nếu không có test.describe: gắn vào tất cả test('...', ...) cấp cao nhất
  const testRegex = /(test(?:\.(?:only|skip|fixme))?\s*\(\s*(['"`]))((?:\\.|(?!\2).)*)(\2)/g;
  let hasAnyTest = false;
  const replacedTests = normalized.replace(testRegex, (full, p1, quote, title) => {
    hasAnyTest = true;
    if (title.includes(tag)) return full;
    return `${p1}${title.trim()} ${tag}${quote}`;
  });

  if (hasAnyTest) {
    return replacedTests;
  }

  // 3. Fallback: gắn vào đầu file
  return `// ${tag}\n${normalized}`;
}

module.exports = {
  scanMaxIds,
  draftLinkToExistingReq,
  draftNewReqScaffold,
  patchSpecWithReqTag,
};
