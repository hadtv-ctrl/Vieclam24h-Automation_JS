/**
 * dashboard/routes/qaSpecRoutes.js
 * Router endpoint POST /api/qa/boundary-matrix (0 token AI).
 * Bóc tách ràng buộc số/độ dài và xây ma trận phân vùng biên tương đương.
 * Ngân sách dòng <= 100.
 */

const { parseBody, sendJson } = require('./routeUtils');
const { extractConstraints } = require('../services/qaBoundaryExtract');
const { buildMatrix } = require('../services/qaBoundaryMatrix');

async function handleQaSpecRoutes(request, response, url) {
  if (request.method !== 'POST' || url.pathname !== '/api/qa/boundary-matrix') {
    return false;
  }

  let body;
  try {
    body = await parseBody(request, 64 * 1024);
  } catch {
    sendJson(response, 400, { ok: false, code: 'EMPTY_TEXT', error: 'Dữ liệu request không hợp lệ' });
    return true;
  }

  const text = typeof body?.requirementText === 'string' ? body.requirementText.trim() : '';
  if (!text) {
    sendJson(response, 400, { ok: false, code: 'EMPTY_TEXT', error: 'Nội dung yêu cầu không được để trống' });
    return true;
  }

  if (text.length > 20000) {
    sendJson(response, 413, { ok: false, code: 'TEXT_TOO_LONG', error: 'Nội dung vượt quá giới hạn 20.000 ký tự' });
    return true;
  }

  const { constraints: rawConstraints, unrecognized } = extractConstraints(text);
  const constraints = rawConstraints.map((c) => ({
    ...c,
    matrix: buildMatrix(c)
  }));

  sendJson(response, 200, {
    ok: true,
    source: 'rule',
    constraints,
    unrecognized
  });
  return true;
}

module.exports = { handleQaSpecRoutes };
