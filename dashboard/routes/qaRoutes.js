/**
 * dashboard/routes/qaRoutes.js
 * QA Docs & Automation APIs: ma trận truy vết, ứng viên automation, sổ quyết định.
 *
 * Route chỉ dịch HTTP <-> service. Mọi logic nằm ở dashboard/services/qaService.js.
 */
const {
  getTrace,
  getCandidates,
  getDecisions,
  saveDecisionAnswer,
  listDocuments,
  readDocument,
  saveDocument,
} = require('../services/qaService');
const { sendJson, parseBody } = require('./routeUtils');

const MAX_BODY_BYTES = 1_048_576;

async function handleQaRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/qa/trace') {
    try {
      sendJson(response, 200, getTrace(root));
    } catch (error) {
      sendJson(response, 500, { error: `Không phân tích được tài liệu QA: ${error.message}` });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/qa/candidates') {
    try {
      const raw = Number.parseInt(url.searchParams.get('limit') || '', 10);
      const limit = Number.isInteger(raw) && raw > 0 && raw <= 100 ? raw : 7;
      sendJson(response, 200, getCandidates(root, limit));
    } catch (error) {
      sendJson(response, 500, { error: `Không lấy được danh sách ứng viên automation: ${error.message}` });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/qa/documents') {
    try {
      sendJson(response, 200, listDocuments(root));
    } catch (error) {
      sendJson(response, 500, { error: `Không liệt kê được tài liệu: ${error.message}` });
    }
    return true;
  }

  // Trả nội dung THÔ. Không dựng HTML ở đây: phía trình duyệt dựng bằng createElement,
  // vì tài liệu do dự án viết và hoàn toàn có thể chứa thẻ HTML.
  if (request.method === 'GET' && url.pathname === '/api/qa/document') {
    try {
      sendJson(response, 200, readDocument(root, url.searchParams.get('path')));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, { error: error.message });
    }
    return true;
  }

  if (request.method === 'PUT' && url.pathname === '/api/qa/document') {
    try {
      const body = await parseBody(request);
      if (Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES) {
        return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      }
      sendJson(response, 200, { message: 'Đã lưu tài liệu.', ...saveDocument(root, body || {}) });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/qa/decisions') {
    try {
      sendJson(response, 200, getDecisions(root));
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'PUT' && url.pathname === '/api/qa/decision') {
    try {
      const body = await parseBody(request);
      if (Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES) {
        return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      }
      const result = saveDecisionAnswer(root, body || {});
      sendJson(response, 200, { message: 'Đã lưu quyết định.', ...result });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  return false;
}

module.exports = { handleQaRoutes };
