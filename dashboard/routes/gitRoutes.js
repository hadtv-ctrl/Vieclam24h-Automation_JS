/**
 * dashboard/routes/gitRoutes.js
 * Handles all /api/git/* endpoints for Git synchronization, status, and branching.
 */
const gitSyncService = require('../../core/system/gitSyncService');
const { sendJson, parseBody } = require('./routeUtils');

async function handleGitRoutes(request, response, url) {
  if (!url.pathname.startsWith('/api/git/')) return false;

  if (request.method === 'GET' && url.pathname === '/api/git/status') {
    try {
      return sendJson(response, 200, gitSyncService.getGitStatus());
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/git/pull') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = gitSyncService.pullCode(body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/git/commit-push') {
    try {
      const body = await parseBody(request);
      const result = gitSyncService.commitAndPush(body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/git/diff') {
    try {
      const file = url.searchParams.get('file');
      const diff = gitSyncService.getFileDiff(file);
      return sendJson(response, diff.ok ? 200 : 400, diff);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/git/quality-check') {
    try {
      return sendJson(response, 200, gitSyncService.runFrameworkQualityGate());
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/git/branches') {
    try {
      return sendJson(response, 200, gitSyncService.listBranches());
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/git/branch/checkout') {
    try {
      const body = await parseBody(request);
      const result = gitSyncService.checkoutBranch(body.branch, !!body.createNew);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/git/sync') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = gitSyncService.sync(body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  return false;
}

module.exports = { handleGitRoutes };
