'use strict';

/**
 * dashboard/routes/qaBatchRoutes.js
 * API sửa finding hàng loạt (PLAN-18). Route chỉ dịch HTTP <-> service; lỗi service mang sẵn
 * status + code, route trả nguyên dạng { error, code, details }.
 *
 *   POST /api/qa/finding/batch-plan      { findingKeys }
 *   POST /api/qa/finding/batch-input     { sessionId, revision, findingKey, input }
 *   POST /api/qa/finding/batch-apply     { sessionId, revision, acceptedFindingKeys }
 *   POST /api/qa/finding/batch-rollback  { sessionId, forceFiles? }
 *   GET  /api/qa/finding/batch-last
 *   GET  /api/qa/finding/context?findingKey=...
 */

const { buildPlan, applyInput } = require('../services/qaBatchPlanService');
const { commitPlan } = require('../services/qaBatchCommitService');
const { rollbackBatch, getLatestBatch, recoverInterrupted } = require('../services/qaBatchRollbackService');
const { getFindingContext } = require('../services/qaFindingFixerService');
const { sendJson, parseBody } = require('./routeUtils');

const PREFIX = '/api/qa/finding/';
const MAX_BODY_BYTES = 64 * 1024;

const HANDLERS = {
  'POST batch-plan': (root, body) => buildPlan(root, body.findingKeys),
  'POST batch-input': (root, body) => applyInput(root, body),
  'POST batch-apply': (root, body) => commitPlan(root, body),
  'POST batch-rollback': (root, body) => rollbackBatch(root, body),
  'GET batch-last': async (root) => ({
    ok: true,
    latest: getLatestBatch(root),
    recovered: await recoverInterrupted(root),
  }),
  'GET context': (root, _body, url) => getFindingContext(root, url.searchParams.get('findingKey')),
};

async function readBody(request) {
  try {
    const body = await parseBody(request, MAX_BODY_BYTES);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch (err) {
    throw Object.assign(new Error(err.message), { status: 400, code: 'INVALID_BODY' });
  }
}

async function handleQaBatchRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith(PREFIX)) return false;
  const handler = HANDLERS[`${request.method} ${url.pathname.slice(PREFIX.length)}`];
  if (!handler) return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  try {
    // Batch dừng giữa chừng ở lần chạy trước phải được trả về nguyên trạng trước mọi thao tác mới.
    await recoverInterrupted(root);
    const body = request.method === 'POST' ? await readBody(request) : {};
    sendJson(response, 200, await handler(root, body, url));
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const payload = { error: error.message, code: error.code || 'INTERNAL_ERROR' };
    if (error.details) payload.details = error.details;
    sendJson(response, status, payload);
  }
  return true;
}

module.exports = { handleQaBatchRoutes };
