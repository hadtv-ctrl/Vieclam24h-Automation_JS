/**
 * dashboard/public/js/components/ai/aiRequest.js
 * Lifecycle-safe requester for AI endpoints with sequence guards and abort control.
 * Strict ceiling <= 150 lines.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiRequest = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  // Same key and "enabled" rule as Settings → Cấu hình AI and agent.js; the old key was never written.
  function readClientConfigHeader() {
    try {
      const saved = localStorage.getItem('qa_studio_ai_personal_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.enabled && parsed?.apiKey) return btoa(unescape(encodeURIComponent(JSON.stringify(parsed))));
      }
    } catch (_) {}
    return null;
  }

  function mapErrorPayload(status, data, isAborted) {
    if (isAborted) return { code: 'CANCELLED', message: 'Tác vụ đã được hủy.' };
    if (status === 429) {
      const sec = data?.error?.seconds || 60;
      return { code: 'RATE_LIMITED', message: `Chạm giới hạn tốc độ. Vui lòng chờ ${sec}s.` };
    }
    if (status === 401 || status === 403) return { code: 'AUTH', message: 'API key không hợp lệ hoặc không có quyền.' };
    if (status === 409) return { code: 'BUSY', message: (typeof data?.error === 'string' && data.error) || 'Hệ thống đang bận xử lý tác vụ AI khác.' };
    if (status === 413) return { code: 'TOO_LARGE', message: 'Dữ liệu quá dài, vui lòng rút gọn nội dung.' };
    return { code: 'PROVIDER_DOWN', message: data?.error?.message || data?.error || 'Lỗi kết nối tới nhà cung cấp AI.' };
  }

  function createAiRequester() {
    let currentController = null;
    let seq = 0;

    async function send({ url, body = {}, onStatus = null, signal = null, timeoutMs = 60000 } = {}) {
      const mySeq = ++seq;
      if (currentController) {
        currentController.abort();
        currentController = null;
      }

      const controller = new AbortController();
      currentController = controller;
      const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (currentController === controller) controller.abort(new Error('TIMEOUT'));
        }, timeoutMs);
      }

      onStatus?.({ state: 'pending', message: 'Đang kết nối AI…', seq: mySeq });

      try {
        const headers = { 'Content-Type': 'application/json' };
        const clientHeader = readClientConfigHeader();
        if (clientHeader) headers['X-AI-Config'] = clientHeader;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: combined
        });

        if (timer) clearTimeout(timer);
        if (mySeq !== seq) return { ok: false, discarded: true };

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const err = mapErrorPayload(response.status, data, combined.aborted);
          onStatus?.({ state: 'error', error: err, seq: mySeq });
          return { ok: false, error: err };
        }

        onStatus?.({ state: 'success', data, seq: mySeq });
        return { ok: true, data };
      } catch (err) {
        if (timer) clearTimeout(timer);
        if (mySeq !== seq) return { ok: false, discarded: true };

        const isTimeout = err?.message === 'TIMEOUT' || err?.name === 'TimeoutError';
        const errObj = isTimeout
          ? { code: 'TIMEOUT', message: 'Hết thời gian chờ phản hồi AI.' }
          : mapErrorPayload(0, null, combined.aborted || err?.name === 'AbortError');

        onStatus?.({ state: 'error', error: errObj, seq: mySeq });
        return { ok: false, error: errObj };
      } finally {
        if (currentController === controller) currentController = null;
      }
    }

    function abort() {
      if (currentController) {
        currentController.abort();
        currentController = null;
      }
    }

    function dispose() {
      abort();
      seq = 0;
    }

    return { send, abort, dispose, isBusy: () => Boolean(currentController) };
  }

  function startAiRequest({ url, body = {}, timeoutMs = 60000, owner = null } = {}) {
    const requester = createAiRequester();
    const cancel = () => requester.abort();
    if (owner && Array.isArray(owner.disposers)) {
      owner.disposers.push(cancel);
    } else if (owner && Array.isArray(owner._disposers)) {
      owner._disposers.push(cancel);
    }
    const promise = requester.send({ url, body, timeoutMs }).then((res) => {
      if (!res.ok) {
        const err = new Error(res.error?.message || 'Lỗi gọi AI');
        err.code = res.error?.code;
        err.discarded = res.discarded;
        throw err;
      }
      return res.data;
    });
    return { promise, cancel, requester };
  }

  return { createAiRequester, startAiRequest };
});
