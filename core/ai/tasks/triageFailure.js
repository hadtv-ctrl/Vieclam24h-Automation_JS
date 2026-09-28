/**
 * core/ai/tasks/triageFailure.js
 * Automated failure triage and Root Cause Analysis (RCA) for Playwright test runs.
 * Deterministic rule engine (0 token, no AI call). Strict ceiling <= 150 lines.
 */
const { analyzeDiagnostics } = require('../../diagnostics/diagnosticsAnalyzer');

const CATEGORIES = ['product_bug', 'test_bug', 'environment', 'flaky'];

function heuristicTriage({ errorText = '', testTitle = '', locator = '', snippet = '', consoleLogs = '', url = '', status = '', retry = 0 } = {}) {
  const diag = analyzeDiagnostics({ error: errorText, testTitle, locator, snippet, consoleLogs, url, status, retry });
  const top = diag.topFinding || {};
  const category = CATEGORIES.includes(diag.topCategory) ? diag.topCategory : 'unknown';
  const confidence = Math.round((top.confidence || 0) * 100);
  const summary = top.message || 'Chưa đủ bằng chứng để xác định nguyên nhân gốc.';
  const evidence = (top.evidence && top.evidence.map((e) => e.value).join('\n')) || errorText.slice(0, 500);
  const suggestedFix = (top.suggestedFix && top.suggestedFix.preview) || '';
  return { ok: true, source: 'rule', category, confidence, summary, evidence, suggestedFix, locator: diag.locator, findings: diag.findings };
}

async function runTriageFailure(params = {}) {
  return heuristicTriage(params);
}

module.exports = { CATEGORIES, heuristicTriage, runTriageFailure };
