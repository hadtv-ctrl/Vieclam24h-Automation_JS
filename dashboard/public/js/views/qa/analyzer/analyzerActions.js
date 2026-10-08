'use strict';

/**
 * dashboard/public/js/views/qa/analyzer/analyzerActions.js
 * Điều phối các tác vụ phân tích, soát độ rõ, sinh test case, sinh spec và scaffold files.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

export async function runClarityCheck(helper, root) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi soát độ rõ.');
    if (textarea) textarea.focus();
    return;
  }

  helper._setLoadingState(root, true);
  try {
    const res = await apiClient.post('/api/ai/req-clarity', {
      requirementText: rawText,
      title: helper.extractJiraKey(rawText) || 'Requirement',
    });
    if (!res.ok) throw new Error(res.error || 'Lỗi khi soát requirement');
    helper._setLoadingState(root, false);
    helper.renderClarityResult(root, res);
    const scoreBadge = root.querySelector('#qa-req-tab-clarity-score');
    if (scoreBadge) scoreBadge.textContent = `${res.score}/100`;
    helper.switchTab(root, 'clarity');
    toast.success(`Đã soát độ rõ thành công (Điểm: ${res.score}/100)!`);
  } catch (err) {
    helper._setLoadingState(root, false, true);
    toast.error(`Lỗi soát độ rõ: ${err.message}`);
  }
}

export async function runGenerateTestCases(helper, root) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi sinh test cases.');
    if (textarea) textarea.focus();
    return;
  }

  helper._setLoadingState(root, true);
  try {
    const res = await apiClient.post('/api/ai/generate-tc', { criteriaText: rawText, startTcNumber: 1 });
    if (!res.ok) throw new Error(res.error || 'Lỗi khi sinh test cases');
    helper._setLoadingState(root, false);

    const typeLabels = { positive: 'Positive', negative: 'Negative', boundary: 'Boundary' };
    const formattedTcs = (res.testCases || []).map((tc) => ({
      suggestedId: tc.tcId,
      acId: tc.acId,
      title: tc.title,
      type: typeLabels[tc.type] || 'Positive',
      priority: tc.priority || 'P1',
      precondition: tc.given,
      steps: Array.isArray(tc.steps) && tc.steps.length ? tc.steps : [{ step: 1, action: tc.when, expected: tc.then }],
      testData: tc.testData || '',
    }));

    helper.currentTestCasesText = rawText;
    helper.renderTestCases(root, formattedTcs);
    const tabTcCount = root.querySelector('#qa-req-tab-tc-count');
    const statTc = root.querySelector('#qa-req-stat-tc');
    if (tabTcCount) tabTcCount.textContent = String(formattedTcs.length);
    if (statTc) statTc.textContent = `${formattedTcs.length} TCs`;

    helper.switchTab(root, 'tc');
    toast.success(`Đã sinh ${formattedTcs.length} test case. ${res.coverageNotes || ''}`.trim());
  } catch (err) {
    helper._setLoadingState(root, false, true);
    toast.error(`Lỗi sinh test cases: ${err.message}`);
  }
}

export async function runGenerateSpec(helper, root) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi sinh Playwright spec.');
    if (textarea) textarea.focus();
    return;
  }

  helper._setLoadingState(root, true);
  try {
    const jiraKeyInput = root.querySelector('#qa-req-jira-key');
    const reqId = jiraKeyInput?.value.trim() || helper.extractJiraKey(rawText) || 'REQ-001';
    const res = await apiClient.post('/api/ai/generate-spec', {
      reqId,
      tcList: helper.currentTestCasesText === rawText ? (helper.currentTestCases || []) : [],
      criteriaText: rawText,
    });

    if (!res.specCode) throw new Error(res.error || 'Không sinh được mã nguồn spec.');
    helper._setLoadingState(root, false);
    helper.renderSpecResult(root, res);
    const tabSpecStatus = root.querySelector('#qa-req-tab-spec-status');
    if (tabSpecStatus) tabSpecStatus.textContent = 'Đã sinh';
    helper.switchTab(root, 'spec');
    toast.success(`Đã sinh mã Playwright spec (${res.fileName}) thành công!`);
  } catch (err) {
    helper._setLoadingState(root, false, true);
    toast.error(`Lỗi sinh spec: ${err.message}`);
  }
}

export async function runAnalysis(helper, root) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi phân tích.');
    if (textarea) textarea.focus();
    return;
  }

  helper.currentRawText = rawText;
  const mode = root.querySelector('input[name="qa-req-mode"]:checked')?.value || 'heuristic';
  const scanExisting = Boolean(root.querySelector('#qa-req-analyzer-scan-ctx')?.checked);
  helper._setLoadingState(root, true);

  try {
    const res = await apiClient.post('/api/qa/analyze-requirement', { rawText, mode, scanExisting });
    const jiraKeyInput = root.querySelector('#qa-req-jira-key');
    if (jiraKeyInput && !jiraKeyInput.value.trim()) {
      const detected = helper.extractJiraKey(rawText);
      if (detected) jiraKeyInput.value = detected;
    }
    if (res && jiraKeyInput?.value.trim()) res.source = jiraKeyInput.value.trim();

    helper.currentResult = res;
    helper._setLoadingState(root, false);
    helper.currentTestCasesText = rawText;
    helper.renderResults(root, res);
    toast.success('Phân tích requirement thành công!');
  } catch (err) {
    helper._setLoadingState(root, false, true);
    toast.error(`Lỗi phân tích: ${err.message || 'Không thể xử lý yêu cầu.'}`);
  }
}

export async function scaffoldFiles(helper, root) {
  if (!helper.currentResult) return;
  const title = window.prompt('Nhập tiêu đề cho bộ tài liệu:', helper.currentResult.summary || 'Tính năng mới');
  if (!title) return;
  const reqId = window.prompt('Nhập mã Requirement (ví dụ REQ-016):', 'REQ-016');
  if (!reqId) return;

  const jiraKeyInput = root?.querySelector?.('#qa-req-jira-key');
  const source = jiraKeyInput?.value.trim() || helper.extractJiraKey(helper.currentRawText) || helper.currentResult.source;

  try {
    const res = await apiClient.post('/api/qa/scaffold-from-analysis', {
      reqId,
      title,
      source: source || undefined,
      analysisResult: helper.currentResult,
    });
    if (res.ok) {
      toast.success(`Đã khởi tạo thành công: ${res.files.join(', ')}`);
      if (helper.qaSlice && typeof helper.qaSlice.loadAll === 'function') await helper.qaSlice.loadAll();
    }
  } catch (err) {
    toast.error(`Không thể tạo file: ${err.message}`);
  }
}

export async function copyMarkdownReport(helper) {
  if (!helper.currentResult) return;
  try {
    await navigator.clipboard.writeText(helper.buildMarkdownReport(helper.currentResult));
    toast.success('Đã sao chép báo cáo phân tích Markdown vào Clipboard!');
  } catch (_) {
    toast.warn('Không thể tự động ghi vào clipboard.');
  }
}
