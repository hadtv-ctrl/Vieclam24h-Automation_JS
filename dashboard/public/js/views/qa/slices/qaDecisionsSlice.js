'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaDecisionsSlice.js
 * Quản lý vẽ tab Quyết định kiểm thử (Decisions & Open Questions Log).
 */

export class QaDecisionsSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderDecisions(root) {
    const list = root.querySelector('#qa-decisions-list');
    const empty = root.querySelector('#qa-decisions-empty');
    if (!list) return;
    list.innerHTML = '';

    const decisionsObj = this.qaSlice.decisions;
    const items = (decisionsObj && Array.isArray(decisionsObj.decisions)) ? decisionsObj.decisions : [];

    if (!items.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    items.forEach((dec) => {
      const card = document.createElement('div');
      card.className = 'qa-decision-card';
      const severity = (dec.severity || 'info').toLowerCase();

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <span class="qa-finding-badge" data-severity="${severity}">${dec.id || 'DECISION'}</span>
            <strong style="margin-left: 6px;">${dec.title || dec.question || ''}</strong>
          </div>
          <span style="font-size: 11px; color: var(--muted);">${dec.date || ''}</span>
        </div>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--text);">${dec.decision || dec.resolution || ''}</p>
        ${dec.rationale ? `<small style="display: block; margin-top: 4px; color: var(--muted); font-style: italic;">Lý do: ${dec.rationale}</small>` : ''}
      `;
      list.appendChild(card);
    });
  }
}
