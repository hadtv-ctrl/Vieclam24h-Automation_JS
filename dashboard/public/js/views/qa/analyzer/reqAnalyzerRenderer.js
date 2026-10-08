'use strict';

/**
 * dashboard/public/js/views/qa/analyzer/reqAnalyzerRenderer.js
 * Quản lý vẽ DOM cho Clarity và Spec tabs, chuyển tab giao diện.
 */

import { toast } from '../../../core/toast.js';
import { escapeHtml } from './markdownSpecParser.js';

export function switchTab(root, tabKey) {
  const tabs = root.querySelectorAll('.qa-req-tab');
  const panels = root.querySelectorAll('.qa-req-panel');

  tabs.forEach((t) => {
    const isCur = t.getAttribute('data-tab') === tabKey;
    t.classList.toggle('active', isCur);
    t.style.borderBottomColor = isCur ? '#8b5cf6' : 'transparent';
    t.style.color = isCur ? 'var(--text)' : 'var(--muted)';
  });

  panels.forEach((p) => {
    p.style.display = p.id === `qa-req-panel-${tabKey}` ? 'flex' : 'none';
  });
}

export function renderClarityResult(root, res) {
  const container = root.querySelector('#qa-req-clarity-result');
  if (!container) return;
  container.innerHTML = '';

  const scoreColors = { clear: '#10b981', needs_clarification: '#f59e0b', ambiguous: '#ef4444' };
  const statusLabels = { clear: 'Rõ ràng (Đạt chuẩn)', needs_clarification: 'Cần làm rõ thêm', ambiguous: 'Quá mơ hồ / Thiếu tiêu chí' };
  const color = scoreColors[res.status] || '#f59e0b';
  const label = statusLabels[res.status] || res.status;

  const ambiguitiesHtml = (res.ambiguities || []).map((a) => `
    <div style="background: var(--surface-2); border: 1px solid var(--line); border-left: 3px solid ${color}; border-radius: 6px; padding: 10px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <strong style="color: ${color}; font-size: 13px;">"${escapeHtml(a.phrase)}"</strong>
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--line); color: var(--muted);">Cụm từ định tính</span>
      </div>
      <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;"><strong>Vấn đề:</strong> ${escapeHtml(a.reason)}</div>
      <div style="font-size: 12px; color: var(--accent);"><strong>Đề xuất viết lại:</strong> ${escapeHtml(a.suggestion)}</div>
    </div>
  `).join('');

  const missingHtml = (res.missingAspects || []).map((m) => `
    <span style="font-size: 11.5px; padding: 3px 8px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2);">
      <i class="ph-bold ph-warning"></i> ${escapeHtml(m)}
    </span>
  `).join(' ');

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line);">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px; font-weight: 700; color: ${color};">${res.score}/100</span>
          <span style="font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: color-mix(in srgb, ${color} 15%, transparent); color: ${color};">${label}</span>
        </div>
        <p style="margin: 4px 0 0; font-size: 12.5px; color: var(--text);">${escapeHtml(res.summary || '')}</p>
      </div>
    </div>
    ${res.missingAspects?.length ? `<div><strong style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px;">CÁC GÓC CẠNH CÒN THIẾU TIÊU CHÍ:</strong><div style="display: flex; gap: 8px; flex-wrap: wrap;">${missingHtml}</div></div>` : ''}
    <div>
      <strong style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px;">DANH SÁCH CỤM TỪ MƠ HỒ (${res.ambiguities?.length || 0}):</strong>
      <div style="display: flex; flex-direction: column; gap: 8px;">${ambiguitiesHtml || '<p style="color: var(--muted); font-size: 12px;">Không phát hiện từ ngữ mơ hồ.</p>'}</div>
    </div>
    ${res.clarifiedDraft ? `
      <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 12.5px; color: var(--accent);"><i class="ph-bold ph-note-pencil"></i> Bản nháp BDD (Given-When-Then):</strong>
          <button type="button" class="btn-text-sm" id="btn-copy-bdd-draft" style="color: var(--accent); font-size: 11.5px; cursor: pointer; border: none; background: transparent;"><i class="ph-bold ph-copy"></i> Sao chép BDD</button>
        </div>
        <pre style="margin: 0; padding: 10px; background: var(--surface); border-radius: 6px; font-size: 12px; line-height: 1.5; color: var(--text); white-space: pre-wrap; word-break: break-word;"><code>${escapeHtml(res.clarifiedDraft)}</code></pre>
      </div>
    ` : ''}
  `;

  const copyBddBtn = container.querySelector('#btn-copy-bdd-draft');
  if (copyBddBtn) {
    copyBddBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(res.clarifiedDraft);
        toast.success('Đã sao chép văn bản BDD viết lại vào clipboard!');
      } catch (_) {
        toast.warn('Không thể sao chép tự động.');
      }
    });
  }
}

export function renderSpecResult(root, res) {
  const container = root.querySelector('#qa-req-spec-result');
  if (!container) return;

  container.innerHTML = `
    <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <i class="ph-bold ph-file-code" style="color: #6366f1; font-size: 18px;"></i>
          <strong style="font-family: var(--font-mono, monospace); font-size: 13px;">${escapeHtml(res.fileName || 'spec.js')}</strong>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(99, 102, 241, 0.15); color: #6366f1; font-weight: 600;">
            ${(res.tests || []).filter((t) => t.runnable).length}/${(res.tests || []).length} test chạy được
          </span>
        </div>
        <button type="button" class="btn-secondary-sm" id="btn-copy-spec-code" style="font-size: 11.5px;">
          <i class="ph-bold ph-copy"></i> Sao chép mã Spec
        </button>
      </div>
      <p style="font-size: 12px; color: var(--muted); margin: 0;">${escapeHtml(res.summary || '')}</p>
      <pre style="margin: 0; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.5; color: var(--text); overflow-x: auto; max-height: 380px;"><code>${escapeHtml(res.specCode || '')}</code></pre>
    </div>
  `;

  const copyBtn = container.querySelector('#btn-copy-spec-code');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(res.specCode || '');
        toast.success('Đã sao chép mã Playwright spec vào clipboard!');
      } catch (_) {
        toast.warn('Không thể tự động ghi vào clipboard.');
      }
    });
  }
}

export function renderResults(helper, root, data) {
  const statTc = root.querySelector('#qa-req-stat-tc');
  const statRisk = root.querySelector('#qa-req-stat-risk');
  const statImpacted = root.querySelector('#qa-req-stat-impacted');
  const statLogic = root.querySelector('#qa-req-stat-logic');
  const statQa = root.querySelector('#qa-req-stat-qa');

  const tcCount = data.testCaseEstimation?.totalCount || data.testCaseEstimation?.testCases?.length || 0;
  const riskLevel = data.systemImpact?.riskLevel || 'Trung bình';
  const impactedCount = data.existingTestCasesImpact?.length || 0;
  const logicCount = data.logicClarifications?.length || 0;
  const qaCount = data.qaTeamInquiries?.length || 0;

  if (statTc) statTc.textContent = `${tcCount} TCs`;
  if (statRisk) {
    statRisk.textContent = riskLevel;
    statRisk.style.color = riskLevel === 'Cao' ? 'var(--danger)' : riskLevel === 'Thấp' ? 'var(--success)' : 'var(--warning)';
  }
  if (statImpacted) statImpacted.textContent = `${impactedCount} TC`;
  if (statLogic) statLogic.textContent = String(logicCount);
  if (statQa) statQa.textContent = String(qaCount);

  const tabTcCount = root.querySelector('#qa-req-tab-tc-count');
  const tabImpactCount = root.querySelector('#qa-req-tab-impact-count');
  const tabLogicCount = root.querySelector('#qa-req-tab-logic-count');
  const tabQaCount = root.querySelector('#qa-req-tab-qa-count');
  if (tabTcCount) tabTcCount.textContent = String(tcCount);
  if (tabImpactCount) tabImpactCount.textContent = String(impactedCount);
  if (tabLogicCount) tabLogicCount.textContent = String(logicCount);
  if (tabQaCount) tabQaCount.textContent = String(qaCount);

  helper.renderTestCases(root, data.testCaseEstimation?.testCases || []);
  helper.renderSystemImpact(root, data.systemImpact, data.existingTestCasesImpact || []);
  helper.renderLogicClarifications(root, data.logicClarifications || []);
  helper.renderQaInquiries(root, data.qaTeamInquiries || []);

  const copyBtn = root.querySelector('#qa-req-analyzer-btn-copy');
  const scaffoldBtn = root.querySelector('#qa-req-analyzer-btn-scaffold');
  if (copyBtn) copyBtn.style.display = 'inline-flex';
  if (scaffoldBtn) scaffoldBtn.style.display = 'inline-flex';
  helper.switchTab(root, 'tc');
}

