'use strict';

/**
 * dashboard/services/qa/scaffoldTemplateBuilder.js
 * Tạo mã nguồn mẫu Playwright spec, tài liệu Requirement markdown và Test Cases markdown.
 */

function buildReqMarkdown({ reqId, title, slug, tcRelPath, businessGoal, acs, rules }) {
  const acBlocks = acs.map((ac) => (
    `### ${ac.id}: ${ac.title}\n\n` +
    `**Given** ${ac.given || 'Tiền điều kiện sẵn sàng'}\n` +
    `**When** ${ac.when || 'Người dùng thực hiện thao tác nghiệp vụ'}\n` +
    `**Then** ${ac.then || 'Hệ thống xử lý chính xác và trả về kết quả mong đợi'}\n`
  ));

  const ruleRows = rules.length > 0
    ? rules.map((r, idx) => `| ${r.field || `Rule ${idx + 1}`} | ${r.valid || 'Hợp lệ'} | ${r.invalid || 'Không hợp lệ'} | ${r.boundary || 'Biên'} | ${r.expected || 'Xử lý đúng'} | ${r.tcId || `TC-00${idx + 1}`} |`)
    : acs.map((ac, idx) => `| Quy tắc cho ${ac.id} | Dữ liệu hợp lệ | Dữ liệu sai định dạng | Biên chuẩn | Xử lý đúng theo ${ac.id} | TC-${String(idx + 1).padStart(3, '0')} |`);

  return `---
id: ${reqId}
title: ${title}
status: Draft
version: 1.0
risk: Medium
owner: QA Team
slug: ${slug}
test_cases: ${tcRelPath}
---

# ${reqId}: ${title}

- Status: Draft
- Owner: QA Team
- Version: 1.0
- Risk: Medium
- Related pages/modules: \`/${slug}\`
- Source: Scaffold Wizard (Smart Extraction)

## Business goal

${businessGoal || `Mô tả mục tiêu nghiệp vụ cho ${title}.`}

## Acceptance criteria

${acBlocks.join('\n')}
## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
${ruleRows.join('\n')}

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| Nghiệp vụ chính của ${title} | Phân tích yêu cầu và kịch bản automation | High | Confirmed |

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | ${new Date().toISOString().slice(0, 10)} | Khởi tạo tài liệu từ Scaffold Wizard | - | - |
`;
}

function buildTcMarkdown({ reqId, title, reqRelPath, testCases, specRelPath, domain }) {
  const traceRows = testCases.map((tc) => (
    `| ${reqId} | ${tc.acId || 'AC-001'} | ${tc.id} | ${tc.automation || 'Candidate'} | \`${specRelPath}\` | ${tc.priority || 'P1'} |`
  ));

  const tcBlocks = testCases.map((tc) => {
    const stepsTable = (tc.steps && tc.steps.length)
      ? tc.steps.map((s, idx) => `| ${s.step || idx + 1} | ${(s.action || '').replace(/\|/g, '-')} | ${(s.expected || '').replace(/\|/g, '-')} |`).join('\n')
      : `| 1 | Truy cập màn hình tính năng | Trang hiển thị đầy đủ |\n| 2 | Thực hiện thao tác kiểm thử: ${tc.title} | Phản hồi đúng theo ${tc.acId || 'AC-001'} |`;

    return `### ${tc.id}: ${tc.title}\n\n` +
      `- Type: Functional | Priority: ${tc.priority || 'P1'} | Technique: Equivalence Partitioning\n` +
      `- Automation: ${tc.automation || 'Candidate'} | Tags: \`@${domain} @${(tc.priority || 'p1').toLowerCase()}\`\n` +
      `- Preconditions: ${tc.precondition || 'Môi trường sẵn sàng'}\n\n` +
      `| Step | Action | Expected result |\n` +
      `|---|---|---|\n` +
      `${stepsTable}\n`;
  });

  return `# Test Cases: ${reqId} ${title}

Requirement: \`${reqRelPath}\` (v1.0)

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
${traceRows.join('\n')}

> Lưu ý: Cập nhật Priority thật (P0/P1) và chuyển Automation thành Yes khi hoàn thiện test.

## Case không automation

| Test case | Lý do | Cách bù đắp |
|---|---|---|

## Test cases

${tcBlocks.join('\n')}
`;
}

function buildSpecCode({ reqId, title, reqRelPath, testCases, domain, fixtureImport }) {
  const testSpecBlocks = testCases.map((tc) => {
    const tcBody = tc.body
      ? tc.body.split('\n').map((line) => `    ${line}`).join('\n')
      : `    await test.step('Given Tiền điều kiện: Truy cập tính năng', async () => {\n` +
        `      expect(page).toBeDefined();\n` +
        `    });\n\n` +
        `    await test.step('When Thao tác: ${tc.title.replace(/'/g, "\\'")}', async () => {\n` +
        `      // Thêm mã automation thao tác ở đây\n` +
        `    });\n\n` +
        `    await test.step('Then Kỳ vọng: Kết quả chính xác', async () => {\n` +
        `      expect(true).toBe(true);\n` +
        `    });`;

    return `  test('${tc.id} - ${tc.acId || 'AC-001'} ${tc.title.replace(/'/g, "\\'")}', async ({ page }, testInfo) => {\n` +
      `    testInfo.annotations.push({\n` +
      `      type: 'Precondition',\n` +
      `      description: '${(tc.precondition || 'Môi trường sẵn sàng').replace(/'/g, "\\'")}',\n` +
      `    });\n\n` +
      `${tcBody}\n` +
      `  });`;
  });

  return `const { test, expect } = require('${fixtureImport}');\n\n` +
    `/**\n` +
    ` * ${reqId} - ${title}\n` +
    ` * Requirement : ${reqRelPath}\n` +
    ` */\n` +
    `test.describe('${reqId} - ${title} @${reqId} @${domain}', () => {\n` +
    `${testSpecBlocks.join('\n\n')}\n` +
    `});\n`;
}

module.exports = {
  buildReqMarkdown,
  buildTcMarkdown,
  buildSpecCode,
};
