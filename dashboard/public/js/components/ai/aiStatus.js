/**
 * dashboard/public/js/components/ai/aiStatus.js
 * Status bar UI displaying AI progress with seconds counter, abort button, and retry.
 * Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiStatus = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  function createAiStatusBar({ container, onCancel = null, onRetry = null } = {}) {
    if (!container) return null;

    let timer = null;
    let seconds = 0;

    const el = document.createElement('div');
    el.className = 'ai-status-bar';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    container.appendChild(el);

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startTimer() {
      stopTimer();
      seconds = 0;
      timer = setInterval(() => {
        seconds++;
        const timerEl = el.querySelector('.ai-status-timer');
        if (timerEl) timerEl.textContent = `(${seconds}s)`;
      }, 1000);
    }

    function setPending(message = 'Đang xử lý…', { showCancel = true } = {}) {
      startTimer();
      el.className = 'ai-status-bar is-pending';
      el.hidden = false;
      el.innerHTML = `
        <span class="ai-spinner" aria-hidden="true"></span>
        <span class="ai-status-text">${escapeHtml(message)}</span>
        <span class="ai-status-timer">(0s)</span>
        ${showCancel && onCancel ? '<button type="button" class="ai-status-btn ai-cancel-btn"><i class="ph-bold ph-x"></i> Hủy</button>' : ''}
      `;

      const cancelBtn = el.querySelector('.ai-cancel-btn');
      if (cancelBtn && onCancel) {
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          onCancel();
        }, { once: true });
      }
    }

    function setError(errorMsg = 'Đã xảy ra lỗi khi gọi AI.', { showRetry = true } = {}) {
      stopTimer();
      el.className = 'ai-status-bar is-error';
      el.hidden = false;
      el.innerHTML = `
        <i class="ph-bold ph-warning-circle ai-status-icon"></i>
        <span class="ai-status-text">${escapeHtml(errorMsg)}</span>
        <div class="ai-status-actions">
          ${showRetry && onRetry ? '<button type="button" class="ai-status-btn ai-retry-btn"><i class="ph-bold ph-arrow-counter-clockwise"></i> Thử lại</button>' : ''}
          <button type="button" class="ai-status-btn ai-dismiss-btn" title="Đóng"><i class="ph-bold ph-x"></i></button>
        </div>
      `;

      const retryBtn = el.querySelector('.ai-retry-btn');
      if (retryBtn && onRetry) {
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          onRetry();
        }, { once: true });
      }

      const dismissBtn = el.querySelector('.ai-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => clear(), { once: true });
      }
    }

    function setSuccess(message = 'Thành công!', { autoHideMs = 2500 } = {}) {
      stopTimer();
      el.className = 'ai-status-bar is-success';
      el.hidden = false;
      el.innerHTML = `
        <i class="ph-bold ph-check-circle ai-status-icon"></i>
        <span class="ai-status-text">${escapeHtml(message)}</span>
      `;
      if (autoHideMs > 0) {
        setTimeout(() => clear(), autoHideMs);
      }
    }

    function clear() {
      stopTimer();
      el.hidden = true;
      el.innerHTML = '';
      el.className = 'ai-status-bar';
    }

    function dispose() {
      clear();
      el.remove();
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    return { setPending, setError, setSuccess, clear, dispose, el };
  }

  return { createAiStatusBar };
});
