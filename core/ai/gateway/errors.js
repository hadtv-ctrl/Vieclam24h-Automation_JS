/**
 * core/ai/gateway/errors.js
 * Standardized AI Gateway error codes and user-friendly Vietnamese messages.
 * Strict ceiling <= 150 lines.
 */
const ERROR_DEFINITIONS = {
  NOT_CONFIGURED: {
    message: 'Chưa cấu hình AI. Mở Cài đặt → Cấu hình AI.',
    retryable: false
  },
  PROVIDER_DOWN: {
    message: '9Router chưa chạy (localhost:20128). Mở 9Router rồi thử lại.',
    retryable: true
  },
  AUTH: {
    message: 'API Key không hợp lệ hoặc hết hạn.',
    retryable: false
  },
  RATE_LIMITED: {
    message: 'Hết hạn mức ở 9Router. Thử lại sau {n} giây.',
    retryable: true
  },
  TIMEOUT: {
    message: 'AI không trả lời sau {n} giây.',
    retryable: true
  },
  CANCELLED: {
    message: 'Đã hủy.',
    retryable: false
  },
  BAD_OUTPUT: {
    message: 'AI trả kết quả sai định dạng.',
    retryable: true
  },
  TOO_LARGE: {
    message: 'Nội dung quá dài cho tác vụ này ({n} token ước tính).',
    retryable: false
  },
  BUSY: {
    message: 'Đang có 2 tác vụ AI chạy. Chờ xong hoặc hủy bớt.',
    retryable: true
  }
};

function createAiError(code, details = {}) {
  const def = ERROR_DEFINITIONS[code] || {
    message: details.message || 'Lỗi xử lý AI không xác định.',
    retryable: false
  };

  let message = def.message;
  if (details.seconds !== undefined) {
    message = message.replace('{n}', String(details.seconds));
  }
  if (details.tokens !== undefined) {
    message = message.replace('{n}', String(details.tokens));
  }
  if (details.customMessage) {
    message = details.customMessage;
  }

  return {
    ok: false,
    code,
    message,
    retryable: details.retryable !== undefined ? details.retryable : def.retryable,
    retryAfterMs: details.retryAfterMs || 0,
    requestId: details.requestId || null,
    details: details.details || null
  };
}

module.exports = {
  ERROR_DEFINITIONS,
  createAiError
};
