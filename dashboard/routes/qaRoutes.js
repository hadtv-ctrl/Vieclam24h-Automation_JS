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
  analyzeFindingFix,
  applyFindingFix,
} = require('../services/qaFindingFixerService');
const {
  resolveConflict,
  arbitrateWithAi,
  escalateConflictToDecision,
} = require('../services/qaConflictService');
const { sendJson, parseBody } = require('./routeUtils');

const MAX_BODY_BYTES = 1_048_576;

async function handleQaRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/qa/summary') {
    try {
      sendJson(response, 200, getQaSummary(root));
    } catch (error) {
      sendJson(response, 500, { error: `Không lấy được tổng quan QA: ${error.message}` });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/fix') {
    try {
      const body = await parseBody(request);
      sendJson(response, 200, runQaFix(root, body || {}));
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
      const result = await extractScaffoldFromRaw(root, body || {});
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
      const result = await inferTestCases({
        root,
        reqPath: body.reqPath,
        mode: body.mode || 'heuristic',
        clientConfig: body.clientConfig || null,
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
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await analyzeRequirement({
        root,
        rawText: body.rawText,
        mode: body.mode || 'ai',
        scanExisting: body.scanExisting !== false,
        clientConfig,
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

  if (request.method === 'POST' && url.pathname === '/api/qa/finding/ai-analyze-fix') {
    try {
      const body = await parseBody(request, 256 * 1024);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await analyzeFindingFix({
        root,
        finding: body.finding,
        clientConfig,
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

  if (request.method === 'POST' && url.pathname === '/api/qa/finding/apply-fix') {
    try {
      const body = await parseBody(request, 512 * 1024);
      const result = applyFindingFix(root, {
        targetFile: body.targetFile,
        patchType: body.patchType,
        originalSnippet: body.originalSnippet,
        fixedSnippet: body.fixedSnippet,
        fullContent: body.fullContent,
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

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/resolve') {
    try {
      const body = await parseBody(request, 256 * 1024);
      const result = resolveConflict(root, {
        resolutionType: body.resolutionType,
        tcId: body.tcId,
        specFile: body.specFile,
        docFile: body.docFile,
        targetAc: body.targetAc,
        specAc: body.specAc,
        docAc: body.docAc,
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

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/arbitrate') {
    try {
      const body = await parseBody(request, 256 * 1024);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await arbitrateWithAi({
        root,
        specFile: body.specFile,
        tcId: body.tcId,
        docFile: body.docFile,
        specAc: body.specAc,
        docAc: body.docAc,
        clientConfig,
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

  if (request.method === 'POST' && url.pathname === '/api/qa/conflict/escalate') {
    try {
      const body = await parseBody(request, 256 * 1024);
      const result = escalateConflictToDecision(root, {
        tcId: body.tcId,
        specFile: body.specFile,
        specAcs: body.specAcs,
        docFile: body.docFile,
        docAcs: body.docAcs,
        reason: body.reason,
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

  return false;
}

module.exports = { handleQaRoutes };
