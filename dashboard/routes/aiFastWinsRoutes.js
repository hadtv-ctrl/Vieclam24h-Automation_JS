/**
 * dashboard/routes/aiFastWinsRoutes.js
 * Router for Plan-17c Fast Wins: requirement clarity (BA-1), bug report draft (QA-4),
 * test case generation (QA-1) and the AI audit log. The three QA tasks are deterministic
 * rule engines (0 token), so no AI client configuration is read here.
 * Strict ceiling <= 150 lines.
 */
const { parseBody, sendJson, abortSignalFor } = require('./routeUtils');
const { runCheckRequirementClarity } = require('../../core/ai/tasks/checkRequirementClarity');
const { runDraftBugReport } = require('../../core/ai/tasks/draftBugReport');
const { runGenerateTestCases } = require('../../core/ai/tasks/generateTestCases');
const { runFormatBddCriteria } = require('../../core/ai/tasks/formatBddCriteria');
const { readRecentAuditRecords, clearAuditLogs } = require('../../core/ai/gateway/audit');

function parseClientConfigHeader(request) {
  if (!request?.headers?.['x-ai-config']) return null;
  try {
    return JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function handleAiFastWinsRoutes(request, response, url, context = {}) {
  const root = context.projectRoot || context.root || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/ai/audit') {
    const limit = Number(url.searchParams?.get('limit')) || 50;
    const records = readRecentAuditRecords({ root, limit });
    sendJson(response, 200, { ok: true, records, count: records.length });
    return true;
  }

  if (request.method === 'DELETE' && url.pathname === '/api/ai/audit') {
    const cleared = clearAuditLogs({ root });
    sendJson(response, 200, { ok: cleared });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/req-clarity') {
    try {
      const body = await parseBody(request, 128 * 1024);
      sendJson(response, 200, await runCheckRequirementClarity({
        requirementText: body.requirementText || '',
        title: body.title || '',
        source: body.source || ''
      }));
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/draft-bug') {
    try {
      const body = await parseBody(request, 128 * 1024);
      sendJson(response, 200, await runDraftBugReport({
        testTitle: body.testTitle || '',
        errorText: body.errorText || '',
        locator: body.locator || '',
        snippet: body.snippet || '',
        url: body.url || '',
        browser: body.browser || '',
        triageCategory: body.triageCategory || '',
        triageSummary: body.triageSummary || '',
        suggestedFix: body.suggestedFix || ''
      }));
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/generate-tc') {
    try {
      const body = await parseBody(request, 128 * 1024);
      sendJson(response, 200, await runGenerateTestCases({
        criteriaText: body.criteriaText || '',
        startTcNumber: Number(body.startTcNumber) || 1
      }));
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/format-bdd') {
    let body;
    try {
      body = await parseBody(request, 128 * 1024);
    } catch {
      sendJson(response, 400, { ok: false, code: 'EMPTY_TEXT', error: 'Dữ liệu không hợp lệ' });
      return true;
    }

    const text = typeof body?.requirementText === 'string' ? body.requirementText.trim() : '';
    if (!text) {
      sendJson(response, 400, { ok: false, code: 'EMPTY_TEXT', error: 'Nội dung yêu cầu không được để trống' });
      return true;
    }
    if (text.length > 8000) {
      sendJson(response, 413, { ok: false, code: 'TEXT_TOO_LONG', error: 'Nội dung vượt quá giới hạn 8.000 ký tự' });
      return true;
    }

    const signal = abortSignalFor(request, response);
    const clientConfig = parseClientConfigHeader(request);

    const res = await runFormatBddCriteria({
      requirementText: text,
      title: body.title || '',
      clientConfig,
      root,
      signal
    });

    if (!res.ok) {
      const status = (res.code === 'EMPTY_TEXT') ? 400 : (res.code === 'TEXT_TOO_LONG') ? 413 : 502;
      const payload = { ok: false, code: res.code, error: res.error };
      if (res.details) payload.details = res.details;
      sendJson(response, status, payload);
      return true;
    }

    sendJson(response, 200, res);
    return true;
  }

  return false;
}

module.exports = { handleAiFastWinsRoutes };
