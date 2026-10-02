/**
 * Route handler cho cac endpoints sinh du lieu kiem thu VN va tra cuu payload bien.
 * Tuank thu trần số dòng <= 150.
 */

const { generateRecords, listPayloads, PAYLOAD_CATEGORIES, VnDataError } = require('../../core/utils/vnData');
const { sendJson } = require('./routeUtils');

const MAX_BODY_BYTES = 16 * 1024; // 16KB

async function readBodyWithLimit(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let totalBytes = 0;

    request.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        const err = new Error('Kích thước request vượt quá 16KB');
        err.statusCode = 413;
        err.field = 'body';
        request.pause();
        return reject(err);
      }
      raw += chunk.toString('utf8');
    });

    request.on('end', () => resolve(raw));
    request.on('error', reject);
  });
}

async function handleDataGenerateRoutes(request, response, url) {
  // 1. POST /api/data/generate
  if (request.method === 'POST' && url.pathname === '/api/data/generate') {
    const contentLength = Number(request.headers['content-length'] || 0);
    if (contentLength > MAX_BODY_BYTES) {
      sendJson(response, 413, { ok: false, error: 'Kích thước request vượt quá 16KB', field: 'body' });
      return true;
    }

    let raw;
    try {
      raw = await readBodyWithLimit(request);
    } catch (err) {
      const code = err.statusCode || 400;
      sendJson(response, code, { ok: false, error: err.message, field: err.field || 'body' });
      return true;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      sendJson(response, 400, { ok: false, error: 'Dữ liệu body không phải JSON hợp lệ', field: 'body' });
      return true;
    }

    try {
      const result = generateRecords(payload);
      sendJson(response, 200, { ok: true, ...result });
      return true;
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error.message,
        field: error.field || 'general'
      });
      return true;
    }
  }

  // 2. GET /api/data/payloads
  if (request.method === 'GET' && url.pathname === '/api/data/payloads') {
    const category = url.searchParams.get('category');
    try {
      const payloads = listPayloads(category);
      sendJson(response, 200, {
        ok: true,
        categories: PAYLOAD_CATEGORIES,
        payloads
      });
      return true;
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error.message,
        field: error.field || 'category'
      });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleDataGenerateRoutes,
  MAX_BODY_BYTES
};
