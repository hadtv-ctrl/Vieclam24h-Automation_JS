// master-process-disable-size-check: QA Docs & Automation route handlers including requirement analyzer
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
  getBddDraft,
  getQaSummary,
  runQaFix,
  getScaffoldMeta,
  generateScaffold,
  getRequirementImpact,
  deleteRequirement,
} = require('../services/qaService');
const {
  inferTestCases,
  appendTestCasesToDocument,
  extractScaffoldFromRaw,
} = require('../services/qaInferenceService');
const {
  analyzeRequirement,
  scaffoldFromAnalysis,
} = require('../services/qaRequirementAnalyzerService');
const {
  getConflictContext,
  resolveConflict,
  arbitrateConflict,
  escalateConflictToDecision,
} = require('../services/qaConflictService');
const { withWriteLock } = require('../services/qaBatchSessionStore');
const {
  analyzeSmartLink,
  applySmartLink,
} = require('../services/smartTraceLinkerService');
const { sendJson, parseBody, abortSignalFor } = require('./routeUtils');

const MAX_BODY_BYTES = 1_048_576;

async function handleQaRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/qa/summary') {
    try {
      const force = url.searchParams.get('force') === 'true';
      sendJson(response, 200, getQaSummary(root, { force }));
    } catch (error) {
      sendJson(response, 500, { error: `Không lấy được tổng quan QA: ${error.message}` });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/fix') {
    try {
      const body = (await parseBody(request)) || {};
      // Chạy thật thì ghi test-cases/: chung write lock với batch fixer (PLAN-18, INV-7).
      const result = body.dryRun
        ? runQaFix(root, body)
        : await withWriteLock(root, async () => runQaFix(root, body));
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/qa/scaffold/meta') {
    try {
      sendJson(response, 200, getScaffoldMeta(root));
    } catch (error) {
      sendJson(response, 500, { error: `Không lấy được thông tin scaffold: ${error.message}` });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/scaffold/extract') {
    try {
      const body = await parseBody(request);
      const signal = abortSignalFor(request, response);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await extractScaffoldFromRaw(root, { ...(body || {}), ...(clientConfig || {}), signal });
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/scaffold') {
    try {
      const body = await parseBody(request);
      sendJson(response, 200, generateScaffold(root, body || {}));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

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

  // Bản thảo BDD: chỉ đọc, không lưu đâu cả. Dựng lại mỗi lần gọi từ tài liệu hiện tại.
  if (request.method === 'GET' && url.pathname === '/api/qa/bdd-draft') {
    try {
      const ids = (url.searchParams.get('ids') || '').split(',');
      sendJson(response, 200, getBddDraft(root, ids));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, { error: error.message });
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

  if (request.method === 'POST' && url.pathname === '/api/qa/infer-testcases') {
    try {
      const body = await parseBody(request);
      const signal = abortSignalFor(request, response);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await inferTestCases({
        root,
        reqPath: body.reqPath,
        mode: body.mode || 'heuristic',
        clientConfig,
        signal,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/append-testcases') {
    try {
      const body = await parseBody(request);
      const result = appendTestCasesToDocument(root, {
        reqId: body.reqId,
        tcPath: body.tcPath,
        testCases: body.testCases || [],
      });
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/qa/requirement/impact') {
    try {
      const reqId = url.searchParams.get('reqId');
      sendJson(response, 200, getRequirementImpact(root, reqId));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, { error: error.message });
    }
    return true;
  }

  if (
    (request.method === 'DELETE' && url.pathname === '/api/qa/requirement') ||
    (request.method === 'POST' && (url.pathname === '/api/qa/requirement/delete' || url.pathname === '/api/qa/delete-requirement'))
  ) {
    try {
      const body = await parseBody(request);
      sendJson(response, 200, deleteRequirement(root, body || {}));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/analyze-requirement') {
    try {
      const body = await parseBody(request, 256 * 1024);
      const signal = abortSignalFor(request, response);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await analyzeRequirement({
        root,
        rawText: body.rawText,
        mode: body.mode === 'ai' ? 'ai' : 'heuristic',
        scanExisting: body.scanExisting !== false,
        clientConfig,
        signal,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/scaffold-from-analysis') {
    try {
      const body = await parseBody(request, 512 * 1024);
      const result = scaffoldFromAnalysis(root, {
        reqId: body.reqId,
        title: body.title,
        domain: body.domain || 'general',
        analysisResult: body.analysisResult,
        source: body.source || body.jiraKey || body.analysisResult?.source
      });
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 400;
      sendJson(response, status, {
        error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message,
      });
    }
    return true;
  }

  // --- Traceability Conflict Studio: client chỉ gửi TC + spec + chiều đồng bộ; AC luôn được
  // service tính lại từ file thật, nên body không mang AC nào.
  const sendConflictError = (error) => {
    const status = Number.isInteger(error.status) ? error.status : 400;
    const payload = { error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message };
    if (Array.isArray(error.skipped)) payload.skipped = error.skipped;
    sendJson(response, status, payload);
  };

  if (request.method === 'GET' && url.pathname === '/api/qa/conflict/context') {
    try {
      sendJson(response, 200, getConflictContext(root, {
        tcId: url.searchParams.get('tcId'),
        specFile: url.searchParams.get('specFile'),
      }));
    } catch (error) {
      sendConflictError(error);
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/resolve') {
    try {
      const body = await parseBody(request, 64 * 1024);
      sendJson(response, 200, resolveConflict(root, {
        resolutionType: body.resolutionType,
        tcId: body.tcId,
        specFile: body.specFile,
      }));
    } catch (error) {
      sendConflictError(error);
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/arbitrate') {
    try {
      const body = await parseBody(request, 64 * 1024);
      sendJson(response, 200, arbitrateConflict({ root, tcId: body.tcId, specFile: body.specFile }));
    } catch (error) {
      sendConflictError(error);
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/escalate') {
    try {
      const body = await parseBody(request, 64 * 1024);
      sendJson(response, 200, escalateConflictToDecision(root, {
        tcId: body.tcId,
        specFile: body.specFile,
        reason: body.reason,
      }));
    } catch (error) {
      sendConflictError(error);
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/smart-link') {
    try {
      const body = await parseBody(request, MAX_BODY_BYTES);
      const result = await analyzeSmartLink(root, body || {});
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, {
        error: error.message,
        code: error.code || 'SMART_LINK_FAILED',
      });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/smart-link/apply') {
    try {
      const body = await parseBody(request, MAX_BODY_BYTES);
      const result = await applySmartLink(root, body || {});
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(response, status, {
        error: error.message,
        code: error.code || 'APPLY_FAILED',
      });
    }
    return true;
  }

  return false;
}

module.exports = { handleQaRoutes };
