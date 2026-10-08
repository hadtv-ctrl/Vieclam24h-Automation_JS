'use strict';

/**
 * dashboard/public/js/views/qa/analyzer/cardPanelsRenderer.js
 * Quản lý vẽ DOM cho Test Cases, System Impact, Logic Clarifications và QA Inquiries.
 */

import { escapeHtml } from './markdownSpecParser.js';

export function renderTestCases(root, testCases) {
  const container = root.querySelector('#qa-req-tc-list');
  if (!container) return;
  container.innerHTML = '';

  if (!testCases.length) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không có test case nào được đề xuất.</p>';
    return;
  }

  const typeColors = { Positive: '#10b981', Negative: '#ef4444', Boundary: '#f59e0b', 'Edge Case': '#8b5cf6', Security: '#ec4899' };

  testCases.forEach((tc) => {
    const card = document.createElement('div');
    card.className = 'qa-inferred-card';
    card.style.background = 'var(--surface-2)';

    const typeColor = typeColors[tc.type] || '#6b7280';
    const stepsHtml = (tc.steps || []).map((s) => `
      <tr>
        <td style="width: 40px; text-align: center; font-weight: 600;">${s.step}</td>
        <td>${escapeHtml(s.action)}</td>
        <td>${escapeHtml(s.expected)}</td>
      </tr>
    `).join('');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="qa-inferred-id-badge" style="background: var(--accent);">${escapeHtml(tc.suggestedId || 'TC')}</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; background: color-mix(in srgb, ${typeColor} 15%, transparent); color: ${typeColor}; border: 1px solid color-mix(in srgb, ${typeColor} 30%, transparent);">${escapeHtml(tc.type || 'Functional')}</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: var(--surface); border: 1px solid var(--line);">${escapeHtml(tc.priority || 'P1')}</span>
        </div>
        ${tc.precondition ? `<small style="font-size: 11.5px; color: var(--muted);"><strong>Tiền điều kiện:</strong> ${escapeHtml(tc.precondition)}</small>` : ''}
      </div>
      <div style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(tc.title)}</div>
      ${tc.testData ? `<div style="font-size: 11.5px; color: var(--muted); font-style: italic;"><strong>Dữ liệu test:</strong> ${escapeHtml(tc.testData)}</div>` : ''}
      ${stepsHtml ? `
        <table class="qa-inferred-steps-table" style="margin-top: 6px;">
          <thead><tr><th style="width: 40px; text-align: center;">#</th><th style="width: 45%;">Hành động</th><th style="width: 50%;">Kết quả mong đợi</th></tr></thead>
          <tbody>${stepsHtml}</tbody>
        </table>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

export function renderSystemImpact(root, systemImpact, existingImpacts) {
  const summaryEl = root.querySelector('#qa-req-impact-summary');
  const surfacesEl = root.querySelector('#qa-req-impact-surfaces');
  const apisEl = root.querySelector('#qa-req-impact-apis');
  const schemaEl = root.querySelector('#qa-req-impact-schema');
  const rulesEl = root.querySelector('#qa-req-impact-rules');
  const tbody = root.querySelector('#qa-req-existing-impact-tbody');

  if (summaryEl) summaryEl.textContent = systemImpact?.summary || 'Không có mô tả tổng quan.';
  if (surfacesEl) surfacesEl.innerHTML = (systemImpact?.affectedSurfaces || []).map((s) => `<li><strong>${escapeHtml(s.surface)}:</strong> ${escapeHtml(s.impact)}</li>`).join('') || '<li style="color: var(--muted);">Chưa xác định bề mặt ảnh hưởng</li>';
  if (apisEl) apisEl.innerHTML = (systemImpact?.apiEndpoints || []).map((a) => `<li><span style="color: #10b981; font-weight: 700;">[${escapeHtml(a.method || 'API')}]</span> ${escapeHtml(a.endpoint || '')} <small style="color: var(--muted);">— ${escapeHtml(a.impact)}</small></li>`).join('') || '<li style="color: var(--muted);">Không có thay đổi API lớn</li>';
  if (schemaEl) schemaEl.innerHTML = (systemImpact?.dataSchemaChanges || []).map((d) => `<li><strong>${escapeHtml(d.field)}:</strong> <span style="font-size: 11px; padding: 1px 4px; border-radius: 3px; background: var(--line);">${escapeHtml(d.nature || 'Mới')}</span> ${escapeHtml(d.impact)}</li>`).join('') || '<li style="color: var(--muted);">Không có thay đổi cấu trúc dữ liệu</li>';
  if (rulesEl) rulesEl.innerHTML = (systemImpact?.businessLogicChanges || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('') || '<li style="color: var(--muted);">Không có thay đổi logic lớn</li>';

  if (tbody) {
    tbody.innerHTML = '';
    if (!existingImpacts.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 16px;">Không phát hiện kịch bản test hiện có nào bị ảnh hưởng trực tiếp hoặc xung đột.</td></tr>';
    } else {
      const severityColors = { Cao: '#ef4444', High: '#ef4444', 'Trung bình': '#f59e0b', Medium: '#f59e0b', Thấp: '#10b981', Low: '#10b981' };
      existingImpacts.forEach((item) => {
        const tr = document.createElement('tr');
        const sevColor = severityColors[item.severity] || '#6b7280';
        tr.innerHTML = `
          <td style="font-family: var(--font-mono, monospace); font-weight: 600; color: var(--text);">${escapeHtml(item.identifier)}</td>
          <td style="color: var(--muted);">${escapeHtml(item.currentBehavior)}</td>
          <td style="color: var(--accent); font-weight: 500;">${escapeHtml(item.requiredChange)}</td>
          <td><span style="font-size: 11px; font-weight: 700; color: ${sevColor}; display: block; margin-bottom: 2px;">${escapeHtml(item.severity || 'Medium')}</span><small style="color: var(--muted);">${escapeHtml(item.reason)}</small></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

export function renderLogicClarifications(root, clarifications) {
  const container = root.querySelector('#qa-req-logic-list');
  if (!container) return;
  container.innerHTML = '';

  if (!clarifications.length) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không phát hiện điểm mơ hồ nào cần làm rõ.</p>';
    return;
  }

  clarifications.forEach((q) => {
    const card = document.createElement('div');
    card.style.cssText = 'background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono, monospace); font-size: 11.5px; font-weight: 700; color: #10b981;">[${escapeHtml(q.questionId || 'Q')}]</span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--surface); border: 1px solid var(--line); color: var(--muted);">${escapeHtml(q.topic || 'Chung')}</span>
      </div>
      <div style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(q.question)}</div>
      <div style="font-size: 12px; color: var(--muted);"><strong style="color: var(--text);">Tại sao cần làm rõ:</strong> ${escapeHtml(q.whyItMatters)}</div>
      <div style="font-size: 12px; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); padding: 6px 10px; border-radius: 6px; border: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);">
        <strong>Đề xuất mặc định:</strong> ${escapeHtml(q.proposedDefault)}
      </div>
    `;
    container.appendChild(card);
  });
}

export function renderQaInquiries(root, inquiries) {
  const container = root.querySelector('#qa-req-qa-list');
  if (!container) return;
  container.innerHTML = '';

  if (!inquiries.length) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không có câu hỏi phản biện.</p>';
    return;
  }

  inquiries.forEach((item) => {
    const card = document.createElement('div');
    card.style.cssText = 'background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono, monospace); font-size: 11.5px; font-weight: 700; color: #8b5cf6;">[${escapeHtml(item.inquiryId || 'QA')}]</span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; font-weight: 600;">${escapeHtml(item.category || 'QA Defense')}</span>
      </div>
      <div style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(item.question)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; margin-top: 2px;">
        <span style="color: var(--muted); font-style: italic;"><strong>Căn cứ rủi ro:</strong> ${escapeHtml(item.rationale)}</span>
        <span style="color: var(--accent); font-weight: 600;">Gửi: ${escapeHtml(item.targetStakeholder || 'Dev Lead')}</span>
      </div>
    `;
    container.appendChild(card);
  });
}
