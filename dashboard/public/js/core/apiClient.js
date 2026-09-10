/**
 * dashboard/public/js/core/apiClient.js
 * Standardized typed HTTP client for Dashboard REST APIs with timeout and JSON helpers.
 * Line budget: <= 150 lines.
 */

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  constructor(baseUrl = '') {
    this._baseUrl = baseUrl;
    this._defaultTimeoutMs = 30000;
  }

  async request(path, options = {}) {
    const url = `${this._baseUrl}${path}`;
    const timeoutMs = options.timeout || this._defaultTimeoutMs;
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);
    let removeCallerAbort = null;

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw options.signal.reason || new Error('Aborted by caller.');
      }
      const onCallerAbort = () => controller.abort(options.signal.reason);
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
      removeCallerAbort = () => options.signal.removeEventListener('abort', onCallerAbort);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = data?.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new ApiError(errorMsg, response.status, data);
      }

      return data;
    } catch (err) {
      if (options.signal?.aborted) {
        throw err;
      }
      if (isTimeout || err.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeoutMs}ms: ${path}`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (removeCallerAbort) removeCallerAbort();
    }
  }

  get(path, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const fullPath = query ? `${path}?${query}` : path;
    return this.request(fullPath, { ...options, method: 'GET' });
  }

  post(path, body = {}, options = {}) {
    return this.request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(path, body = {}, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(path, body = null, options = {}) {
    return this.request(path, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
