/**
 * dashboard/public/js/components/ai/aiResultCard.js
 * Visual card displaying AI and rule-based suggestions with origin badges and action controls.
 * Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiResultCard = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function createResultCard({
    title = 'Đề xuất từ AI',
    origin = 'ai',
    model = '',
    confidence = null,
    bodyHtml = '',
    actions = []
  } = {}) {
    const card = document.createElement('article');
    card.className = 'ai-result-card';

    const originBadge = origin === 'rule'
      ? '<span class="ai-badge ai-badge-rule"><i class="ph-bold ph-shield-check"></i> Luật suy luận</span>'
      : `<span class="ai-badge ai-badge-ai"><i class="ph-bold ph-sparkle"></i> AI · ${escapeHtml(model || 'Gateway')}</span>`;

    const confBadge = typeof confidence === 'number'
      ? `<span class="ai-badge ai-badge-conf">${confidence}% tin cậy</span>`
      : '';

    card.innerHTML = `
      <header class="ai-result-header">
        <div class="ai-result-title-group">
          <strong class="ai-result-title">${escapeHtml(title)}</strong>
          ${originBadge}
          ${confBadge}
        </div>
      </header>
      <div class="ai-result-body">
        ${bodyHtml}
      </div>
      <footer class="ai-result-footer">
        <div class="ai-result-actions"></div>
      </footer>
    `;

    const actionsContainer = card.querySelector('.ai-result-actions');
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ai-btn ${act.variant ? `ai-btn-${act.variant}` : 'ai-btn-secondary'}`;
      if (act.icon) {
        btn.innerHTML = `<i class="ph-bold ${escapeHtml(act.icon)}"></i> ${escapeHtml(act.label)}`;
      } else {
        btn.textContent = act.label;
      }
      if (act.onClick) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          act.onClick(card, e);
        });
      }
      actionsContainer.appendChild(btn);
    }

    return card;
  }

  return { createResultCard };
});
