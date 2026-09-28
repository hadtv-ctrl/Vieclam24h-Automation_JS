/**
 * core/ai/tasks/copyForJira.js
 * Formats Requirement, Test Cases, and QA status into Jira markup (BA-5).
 * Strict ceiling <= 150 lines.
 */
function formatForJira({
  reqId = 'REQ-001',
  title = '',
  status = 'In Progress',
  testCases = [],
  openQuestions = [],
  risks = []
} = {}) {
  const lines = [];

  lines.push(`h2. [${reqId}] ${title || 'Requirement Overview'}`);
  lines.push(`*Trạng thái:* ${status}`);
  lines.push(`*Tổng số Test Cases:* ${testCases.length}`);
  lines.push('');

  lines.push('h3. Danh Sách Test Cases');
  if (testCases.length === 0) {
    lines.push('_Chưa có test case nào được định nghĩa._');
  } else {
    lines.push('|| Mã TC || Tiêu đề || Loại || AC liên kết ||');
    testCases.forEach((tc) => {
      const id = tc.id || tc.suggestedId || 'TC-?';
      const name = tc.title || 'Scenario';
      const type = tc.type || 'Positive';
      const ac = tc.acId || 'AC-?';
      lines.push(`| ${id} | ${name} | ${type} | ${ac} |`);
    });
  }
  lines.push('');

  if (openQuestions.length > 0) {
    lines.push('h3. Câu Hỏi Cần Làm Rõ (Open Questions)');
    openQuestions.forEach((q, idx) => {
      const text = typeof q === 'string' ? q : q.question || q.text || '';
      lines.push(`# ${text}`);
    });
    lines.push('');
  }

  if (risks.length > 0) {
    lines.push('h3. Rủi Ro Chưa Được Bao Phủ');
    risks.forEach((r) => {
      lines.push(`* (!) ${typeof r === 'string' ? r : r.message || ''}`);
    });
    lines.push('');
  }

  return {
    reqId,
    jiraMarkup: lines.join('\n'),
    markdownFormat: lines
      .join('\n')
      .replace(/^h2\.\s*(.*)$/gm, '## $1')
      .replace(/^h3\.\s*(.*)$/gm, '### $1')
      .replace(/\|\|\s*/g, '| ')
  };
}

module.exports = {
  formatForJira
};
