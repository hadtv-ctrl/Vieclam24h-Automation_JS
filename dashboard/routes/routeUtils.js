const path = require('path');

/**
 * Sends a JSON response with the specified status code and UTF-8 charset.
 */
function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
  return true;
}

/**
 * Sends a standardized JSON error response.
 */
function sendError(response, status, message) {
  return sendJson(response, status, { error: message });
}

/**
 * Parses JSON request body asynchronously with a maximum byte limit.
 */
function parseBody(request, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error('Kích thước request vượt quá giới hạn cho phép.'));
      }
    });
    request.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Dữ liệu JSON không hợp lệ: ' + err.message));
      }
    });
    request.on('error', reject);
  });
}

/**
 * Ensures the requested path stays strictly within the base directory (path traversal protection).
 */
function safeChildPath(base, requestedPath) {
  const resolved = path.resolve(base, `.${requestedPath}`);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

module.exports = {
  sendJson,
  sendError,
  parseBody,
  safeChildPath,
};
