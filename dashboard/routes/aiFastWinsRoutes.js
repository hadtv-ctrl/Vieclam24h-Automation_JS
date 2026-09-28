/**
 * dashboard/routes/aiFastWinsRoutes.js
 * Router for Plan-17c Fast Wins: requirement clarity (BA-1), bug report draft (QA-4),
 * test case generation (QA-1) and the AI audit log. The three QA tasks are deterministic
 * rule engines (0 token), so no AI client configuration is read here.
 * Strict ceiling <= 150 lines.
 */
const { parseBody, sendJson } = require('./routeUtils');
const { runCheckRequirementClarity } = require('../../core/ai/tasks/checkRequirementClarity');
const { runDraftBugReport } = require('../../core/ai/tasks/draftBugReport');
const { runGenerateTestCases } = require('../../core/ai/tasks/generateTestCases');
const { readRecentAuditRecords, clearAuditLogs } = require('../../core/ai/gateway/audit');

async function handleAiFastWinsRoutes(request, response, url, context = {}) {
  const root = context.projectRoot || process.cwd();

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

  return false;
}

module.exports = { handleAiFastWinsRoutes };
