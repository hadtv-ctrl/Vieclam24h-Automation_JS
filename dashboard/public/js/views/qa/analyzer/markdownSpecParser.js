'use strict';

/**
 * dashboard/public/js/views/qa/analyzer/markdownSpecParser.js
 * Tiện ích xử lý cú pháp Jira markup, trích xuất Jira key và định dạng báo cáo Markdown.
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function extractJiraKey(text) {
  if (!text) return null;
  const keys = String(text).match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
  return keys.find((key) => !['AC', 'TC'].includes(key.split('-')[0])) || null;
}

export function parseJiraMarkup(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, c) => `${'#'.repeat(Number(lvl))} ${c.trim()}\n\n`);
    text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
    text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
    text = text.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }
  text = text.replace(/\{code(?::([a-z]+))?\}([\s\S]*?)\{code\}/gi, (_, lang, code) => `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`);
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_, code) => `\`\`\`\n${code.trim()}\n\`\`\`\n`);
  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_, q) => q.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n');
  text = text.replace(/^bq\.\s*(.+)$/gm, '> $1');
  text = text.replace(/^(\s*)#+\s+/gm, '$11. ');
  text = text.replace(/^(\s*)\*\s+/gm, '$1- ');
  text = text.replace(/^h([1-6])\.\s*(.+)$/gm, (_, lvl, title) => `${'#'.repeat(Number(lvl))} ${title.trim()}`);
  text = text.replace(/(^|[\s(])\*([^\s*][^*]*[^\s*])\*([\s).,!?:]|$)/g, '$1**$2**$3');
  text = text.replace(/(^|[\s(])_([^\s_][^_]*[^\s_])_([\s).,!?:]|$)/g, '$1*$2*$3');
  text = text.replace(/(^|[\s(])-([^\s-][^-]*[^\s-])-([\s).,!?:]|$)/g, '$1~~$2~~$3');
  text = text.replace(/\{\{([^{}]+)\}\}/g, '`$1`');
  text = text.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '[$1]($2)');
  text = text.replace(/\[([a-z]+:\/\/[^\]]+)\]/g, '<$1>');

  const lines = text.split('\n');
  const resultLines = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('||') && line.endsWith('||')) {
      const headers = line.slice(2, -2).split('||').map((h) => h.trim());
      resultLines.push(`| ${headers.join(' | ')} |`);
      resultLines.push(`| ${headers.map(() => '---').join(' | ')} |`);
      inTable = true;
    } else if (line.startsWith('|') && line.endsWith('|') && !line.startsWith('||')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      resultLines.push(`| ${cells.join(' | ')} |`);
      inTable = true;
    } else {
      if (inTable) inTable = false;
      resultLines.push(lines[i]);
    }
  }
  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildMarkdownReport(data) {
  const lines = [];
  lines.push('# Báo Cáo Phân Tích Yêu Cầu & Đánh Giá Tác Động QA');
  lines.push(`\n**Tóm tắt:** ${data.summary || ''}`);
  lines.push(`**Mức độ rủi ro hệ thống:** ${data.systemImpact?.riskLevel || 'Trung bình'}`);
  lines.push('\n---\n');

  lines.push(`## 1. Ước Tính & Danh Sách Test Cases Đề Xuất (${data.testCaseEstimation?.totalCount || 0} TCs)`);
  (data.testCaseEstimation?.testCases || []).forEach((tc) => {
    lines.push(`\n### ${tc.suggestedId}: ${tc.title}`);
    lines.push(`- **Loại:** ${tc.type} | **Độ ưu tiên:** ${tc.priority}`);
    if (tc.precondition) lines.push(`- **Tiền điều kiện:** ${tc.precondition}`);
    if (tc.testData) lines.push(`- **Dữ liệu test:** ${tc.testData}`);
    if (tc.steps && tc.steps.length) {
      lines.push('\n| Bước | Thao tác | Kết quả mong đợi |');
      lines.push('|:---|:---|:---|');
      tc.steps.forEach((s) => lines.push(`| ${s.step} | ${s.action} | ${s.expected} |`));
    }
  });

  lines.push('\n---\n');
  lines.push(`## 2. Đánh Giá Tác Động Hệ Thống & Test Cases Có Sẵn\n\n${data.systemImpact?.summary || ''}\n`);
  if (data.systemImpact?.affectedSurfaces?.length) {
    lines.push('**Bề mặt ảnh hưởng:**');
    data.systemImpact.affectedSurfaces.forEach((s) => lines.push(`- ${s.surface}: ${s.impact}`));
  }
  if (data.existingTestCasesImpact?.length) {
    lines.push('\n**Các Test Case / Specs hiện có cần sửa đổi:**\n| File / Test ID | Hành vi hiện tại | Thay đổi cần sửa | Mức độ / Lý do |\n|:---|:---|:---|:---|');
    data.existingTestCasesImpact.forEach((e) => {
      lines.push(`| \`${e.identifier}\` | ${e.currentBehavior} | ${e.requiredChange} | **${e.severity}**: ${e.reason} |`);
    });
  }

  lines.push('\n---\n');
  lines.push('## 3. Câu Hỏi Làm Rõ Logic Nghiệp Vụ (Gửi PO/BA/Dev)');
  (data.logicClarifications || []).forEach((q) => {
    lines.push(`\n- **[${q.questionId}] ${q.question}**`);
    lines.push(`  * *Tại sao cần hỏi:* ${q.whyItMatters}`);
    lines.push(`  * *Đề xuất mặc định:* ${q.proposedDefault}`);
  });

  lines.push('\n---\n');
  lines.push('## 4. Bộ Câu Hỏi Phản Biện Của Team QA (Phòng Vệ Rủi Ro)');
  (data.qaTeamInquiries || []).forEach((item) => {
    lines.push(`\n- **[${item.inquiryId}] (${item.category})** ${item.question}`);
    lines.push(`  * *Đối tượng:* ${item.targetStakeholder} | *Căn cứ kỹ thuật:* ${item.rationale}`);
  });

  return lines.join('\n');
}
