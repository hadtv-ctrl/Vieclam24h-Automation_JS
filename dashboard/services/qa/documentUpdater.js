'use strict';

/**
 * dashboard/services/qa/documentUpdater.js
 * Cập nhật an toàn bảng truy vết và kịch bản chi tiết trong tài liệu test-cases/REQ-xxx.md
 */

const fs = require('fs');
const path = require('path');
const { createBackup } = require('../resourceService');
const { findTestCaseFile } = require('./markdownRequirementParser');

function buildTestCaseDocument(currentContent, reqId, testCases = []) {
  let content = currentContent;
  if (!content) {
    content = `# Test Cases: ${reqId}\n\nRequirement: \`requirements/${reqId}.md\`\n\n## Bảng truy vết\n\n| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |\n|---|---|---|---|---|---|\n\n## Test cases\n\n`;
  }
  let lines = content.split(/\r?\n/);
  const existingIdsInDoc = new Set();
  for (const line of lines) {
    const m = line.match(/\|\s*(TC-\d{3,})\s*\|/i);
    if (m) existingIdsInDoc.add(m[1].toUpperCase());
  }

  const toAdd = testCases.filter((tc) => !existingIdsInDoc.has(String(tc.suggestedId || '').toUpperCase()));
  if (!toAdd.length) return content;

  let tableHeaderIdx = lines.findIndex((l) => /\|\s*(?:Test\s*case|Requirement)\s*\|/i.test(l));
  let isTableStyle1 = true;

  if (tableHeaderIdx !== -1) {
    if (/\|\s*Requirement\s*\|/i.test(lines[tableHeaderIdx])) {
      isTableStyle1 = false;
    }

    let tableEndIdx = tableHeaderIdx + 1;
    if (lines[tableEndIdx] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[tableEndIdx])) {
      tableEndIdx += 1;
    }
    while (tableEndIdx < lines.length && /^\s*\|.*\|\s*$/.test(lines[tableEndIdx])) {
      tableEndIdx += 1;
    }

    const newTableRows = toAdd.map((tc) => {
      const p = tc.priority || 'P2';
      const ac = tc.acId || '-';
      const title = (tc.title || '').replace(/\|/g, '-').trim();
      if (isTableStyle1) {
        return `| ${tc.suggestedId} | ${ac} | ${title} | ${p} | candidate | - |`;
      }
      return `| ${reqId} | ${ac} | ${tc.suggestedId} | candidate | - | ${p} |`;
    });

    lines.splice(tableEndIdx, 0, ...newTableRows);
  }

  const detailBlocks = toAdd.map((tc) => {
    const stepsTable = (tc.steps && tc.steps.length)
      ? tc.steps.map((s, idx) => `| ${s.step || idx + 1} | ${(s.action || '').replace(/\|/g, '-')} | ${(s.expected || '').replace(/\|/g, '-')} |`).join('\n')
      : `| 1 | Thực hiện kiểm thử ${tc.title} | Phản hồi đúng nghiệp vụ |`;

    return `\n### ${tc.suggestedId} — ${tc.title}\n\n` +
      `- **Loại:** Chức năng | **Ưu tiên:** ${tc.priority || 'P2'} | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt\n` +
      `- **Automation:** Candidate\n` +
      `- **Tiền điều kiện:** ${tc.precondition || 'Môi trường sẵn sàng'}\n` +
      `- **Dữ liệu kiểm thử:** ${tc.testData || 'Mặc định'}\n` +
      (tc.rationale ? `> *Ghi chú nghiệp vụ:* ${tc.rationale}\n\n` : '\n') +
      `| Bước | Thao tác | Kết quả mong đợi |\n` +
      `|---|---|---|\n` +
      `${stepsTable}\n`;
  });

  lines.push(...detailBlocks);
  return lines.join('\n');
}

function appendTestCasesToDocument(root, { reqId, tcPath, testCases = [] }) {
  if (!Array.isArray(testCases) || !testCases.length) {
    throw Object.assign(new Error('Danh sách test cases cần thêm không được rỗng.'), { status: 400 });
  }

  const cleanReqId = String(reqId || '').toUpperCase();
  const tcFileInfo = tcPath
    ? { absPath: path.resolve(root, tcPath), relPath: tcPath, exists: fs.existsSync(path.resolve(root, tcPath)) }
    : findTestCaseFile(root, cleanReqId);

  let currentContent = '';
  if (tcFileInfo.exists) {
    currentContent = fs.readFileSync(tcFileInfo.absPath, 'utf8');
    createBackup(tcFileInfo.relPath, tcFileInfo.absPath, root);
  } else {
    fs.mkdirSync(path.dirname(tcFileInfo.absPath), { recursive: true });
  }

  const updatedContent = buildTestCaseDocument(currentContent, cleanReqId, testCases);
  fs.writeFileSync(tcFileInfo.absPath, updatedContent, 'utf8');

  return {
    success: true,
    reqId: cleanReqId,
    tcPath: tcFileInfo.relPath,
    addedCount: testCases.length,
    message: `Đã thêm thành công ${testCases.length} test case vào ${tcFileInfo.relPath}.`,
  };
}

module.exports = {
  buildTestCaseDocument,
  appendTestCasesToDocument,
};
