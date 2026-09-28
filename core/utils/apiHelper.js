/**
 * core/utils/apiHelper.js
 * API Client helper với retry logic, exponential backoff và response validation.
 * Bọc Playwright APIRequestContext để tăng độ tin cậy cho API calls trong test.
 */

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_BACKOFF_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

class ApiHelper {
  /**
   * @param {import('@playwright/test').APIRequestContext} requestContext
   * @param {object} [options]
   * @param {number} [options.retries] - Số lần retry tối đa (default: 3)
   * @param {number} [options.backoffMs] - Thời gian chờ giữa các retry, tăng gấp đôi mỗi lần (default: 1000ms)
   * @param {number} [options.timeout] - Request timeout (default: 30000ms)
   */
  constructor(requestContext, options = {}) {
    this.requestContext = requestContext;
    this.retries = options.retries ?? DEFAULT_RETRY_COUNT;
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Thực hiện request với retry + exponential backoff
   * @param {'get'|'post'|'put'|'patch'|'delete'|'head'} method
   * @param {string} endpoint
   * @param {object} [options] - Playwright request options (data, headers, params, etc.)
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async _requestWithRetry(method, endpoint, options = {}) {
    const maxAttempts = this.retries + 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const requestOptions = {
          timeout: this.timeout,
          ...options,
        };

        const response = await this.requestContext[method](endpoint, requestOptions);
        return response;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          const waitMs = this.backoffMs * Math.pow(2, attempt - 1);
          console.warn(
            `[ApiHelper] ${method.toUpperCase()} ${endpoint} thất bại (lần ${attempt}/${maxAttempts}): ${err.message}. Retry sau ${waitMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    throw new Error(
      `[ApiHelper] ${method.toUpperCase()} ${endpoint} thất bại sau ${maxAttempts} lần thử. Lỗi cuối: ${lastError?.message}`
    );
  }

  /**
   * GET request với retry
   * @param {string} endpoint
   * @param {object} [options]
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async get(endpoint, options = {}) {
    return this._requestWithRetry('get', endpoint, options);
  }

  /**
   * POST request với retry
   * @param {string} endpoint
   * @param {object} [data] - Request body
   * @param {object} [options] - Playwright request options bổ sung
   * @returns {Promise<import('@playwright/test').APIResponse>}
   */
  async post(endpoint, data, options = {}) {
    return this._requestWithRetry('post', endpoint, { data, ...options });
  }

  /**
   * PUT request với retry
   */
  async put(endpoint, data, options = {}) {
    return this._requestWithRetry('put', endpoint, { data, ...options });
  }

  /**
   * PATCH request với retry
   */
  async patch(endpoint, data, options = {}) {
    return this._requestWithRetry('patch', endpoint, { data, ...options });
  }

  /**
   * DELETE request với retry
   */
  async delete(endpoint, options = {}) {
    return this._requestWithRetry('delete', endpoint, options);
  }

  /**
   * GET + parse JSON + validate status code
   * @param {string} endpoint
   * @param {object} [options]
   * @param {number} [expectedStatus=200]
   * @returns {Promise<any>} Parsed JSON body
   */
  async getJson(endpoint, options = {}, expectedStatus = 200) {
    const response = await this.get(endpoint, options);
    if (response.status() !== expectedStatus) {
      const body = await response.text().catch(() => '(không đọc được body)');
      throw new Error(
        `[ApiHelper] GET ${endpoint} trả về status ${response.status()} (expected ${expectedStatus}). Body: ${body.slice(0, 500)}`
      );
    }
    return response.json();
  }

  /**
   * POST + parse JSON + validate status code
   * @param {string} endpoint
   * @param {object} [data]
   * @param {object} [options]
   * @param {number} [expectedStatus=200]
   * @returns {Promise<any>} Parsed JSON body
   */
  async postJson(endpoint, data, options = {}, expectedStatus = 200) {
    const response = await this.post(endpoint, data, options);
    if (response.status() !== expectedStatus) {
      const body = await response.text().catch(() => '(không đọc được body)');
      throw new Error(
        `[ApiHelper] POST ${endpoint} trả về status ${response.status()} (expected ${expectedStatus}). Body: ${body.slice(0, 500)}`
      );
    }
    return response.json();
  }
}

module.exports = { ApiHelper, DEFAULT_RETRY_COUNT, DEFAULT_BACKOFF_MS, DEFAULT_TIMEOUT_MS };
