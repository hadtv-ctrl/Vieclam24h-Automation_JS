/**
 * dashboard/routes/aiProductivityRoutes.js
 * Router handling Core Productivity AI endpoints (PLAN-17d).
 * Strict ceiling <= 150 lines.
 */
const { buildAiContext } = require('../../core/ai/context/contextBuilder');
const {
  runSuggestLocator,
  runReviewSpec,
  runAnalyzeTestImpact,
  runGenerateReleaseBriefing,
  runAnalyzeRequirementChange,
  runGeneratePlaywrightSpec
} = require('../../core/ai/tasks/index');
const { parseBody, sendJson, abortSignalFor } = require('./routeUtils');

async function handleAiProductivityRoutes(request, response, url, clientConfig) {
  const signal = abortSignalFor(request, response);

  if (url.pathname === '/api/ai/context' && request.method === 'POST') {
    const body = await parseBody(request);
    const context = buildAiContext({
      task: body.task || 'general',
      budgetTokens: body.budgetTokens || 4000,
      customSnippet: body.customSnippet || ''
    });
    return sendJson(response, 200, context);
  }

  if (url.pathname === '/api/ai/suggest-locator' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runSuggestLocator({
      brokenLocator: body.brokenLocator || '',
      errorMessage: body.errorMessage || '',
      domSnippet: body.domSnippet || '',
      pageUrl: body.pageUrl || '',
      signal,
      clientConfig
    });
    return sendJson(response, 200, result);
  }

  if (url.pathname === '/api/ai/review-spec' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runReviewSpec({
      specCode: body.specCode || '',
      filePath: body.filePath || '',
      signal,
      clientConfig
    });
    return sendJson(response, 200, result);
  }

  if (url.pathname === '/api/ai/test-impact' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runAnalyzeTestImpact({
      changedFiles: body.changedFiles || [],
      diffText: body.diffText || '',
      signal,
      clientConfig
    });
    return sendJson(response, 200, result);
  }

  if (url.pathname === '/api/ai/release-briefing' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runGenerateReleaseBriefing({
      testMetrics: body.testMetrics || {},
      uncoveredReqCount: body.uncoveredReqCount || 0,
      openBlockersCount: body.openBlockersCount || 0,
      releaseName: body.releaseName || 'Next Release',
      signal,
      clientConfig
    });
    return sendJson(response, 200, result);
  }

  if (url.pathname === '/api/ai/req-change' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runAnalyzeRequirementChange({
      reqId: body.reqId || 'REQ-001',
      oldContent: body.oldContent || '',
      newContent: body.newContent || '',
      signal,
      clientConfig
    });
    return sendJson(response, 200, result);
  }

  if (url.pathname === '/api/ai/generate-spec' && request.method === 'POST') {
    const body = await parseBody(request);
    const result = await runGeneratePlaywrightSpec({
      reqId: body.reqId || 'REQ-001',
      requirementTitle: body.requirementTitle || '',
      tcList: Array.isArray(body.tcList) ? body.tcList : [],
      criteriaText: typeof body.criteriaText === 'string' ? body.criteriaText : ''
    });
    return sendJson(response, result.ok ? 200 : 400, result);
  }

  return false;
}

module.exports = {
  handleAiProductivityRoutes
};
