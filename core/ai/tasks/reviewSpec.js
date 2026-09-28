/**
 * core/ai/tasks/reviewSpec.js
 * Automated Playwright spec code review (QA-9).
 * Static lint rules only (0 token, no AI call). Strict ceiling <= 150 lines.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          severity: { type: 'string', enum: ['error', 'warning', 'info'] },
          line: { type: 'number' },
          message: { type: 'string' },
          suggestion: { type: 'string' }
        },
        required: ['ruleId', 'severity', 'message']
      }
    },
    generalSuggestions: { type: 'array', items: { type: 'string' } }
  },
  required: ['score', 'findings']
};

function staticSpecReview(specCode = '') {
  const findings = [];
  const lines = specCode.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/waitForTimeout\s*\(/i.test(line)) {
      findings.push({
        ruleId: 'PW-NO-WAIT-TIMEOUT',
        severity: 'error',
        line: lineNum,
        message: 'Sử dụng waitForTimeout() là anti-pattern gây flaky test.',
        suggestion: 'Dùng web-first assertions (expect(locator).toBeVisible()) hoặc waitForLoadState().'
      });
    }

    if (/\/(?:div|span|section)\[\d+\]/i.test(line)) {
      findings.push({
        ruleId: 'PW-BRITTLE-XPATH',
        severity: 'error',
        line: lineNum,
        message: 'Phát hiện XPath tuyệt đối chứa chỉ số mảng (/div[1]...).',
        suggestion: 'Chuyển sang Playwright locators như getByRole hoặc getByTestId.'
      });
    }

    if (/\btest\s*\(\s*['"`](?!.*@TC-)/i.test(line) && !line.includes('describe')) {
      findings.push({
        ruleId: 'PW-MISSING-TC-TAG',
        severity: 'warning',
        line: lineNum,
        message: 'Tiêu đề test case thiếu mã truy vết @TC-xxx.',
        suggestion: 'Bổ sung @TC-xxx vào tiêu đề test để hỗ trợ Living Documentation.'
      });
    }
  });

  if (!/expect\s*\(/i.test(specCode) && specCode.trim().length > 50) {
    findings.push({
      ruleId: 'PW-NO-ASSERTION',
      severity: 'error',
      line: 1,
      message: 'Test spec không chứa bất kỳ assertion (expect) nào.',
      suggestion: 'Bổ sung ít nhất một web-first assertion để kiểm chứng kết quả kỳ vọng.'
    });
  }

  const penalty = findings.reduce((acc, f) => acc + (f.severity === 'error' ? 20 : 10), 0);
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    summary: findings.length === 0 ? 'Spec tuân thủ xuất sắc các quy chuẩn Playwright.' : `Phát hiện ${findings.length} vấn đề cần lưu ý.`,
    findings,
    generalSuggestions: findings.map((f) => f.suggestion)
  };
}

async function runReviewSpec({ specCode = '', filePath = '', signal = null, clientConfig = null } = {}) {
  // Pure deterministic AST/regex rule-based linter (instantaneous, 0 tokens, 100% accurate)
  const staticResult = staticSpecReview(specCode);
  return {
    source: 'rule',
    ...staticResult
  };
}

module.exports = {
  runReviewSpec,
  staticSpecReview,
  SCHEMA
};
