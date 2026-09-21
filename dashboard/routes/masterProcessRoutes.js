/**
 * dashboard/routes/masterProcessRoutes.js
 * Handles all /api/mp/* endpoints for Master Process integration.
 */

const { sendJson, parseBody } = require('./routeUtils');
const {
  getProjectStatus,
  initProject,
  syncProject,
  installHooks,
  runAudit,
  runDoctor,
  runProbes,
} = require('../services/masterProcessService');

async function handleMasterProcessRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith('/api/mp/')) return false;

  const projectRoot = typeof context === 'string' ? context : (context.root || process.cwd());

  if (request.method === 'GET' && url.pathname === '/api/mp/status') {
    try {
      const status = await getProjectStatus(projectRoot);
      return sendJson(response, 200, status);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/init') {
    try {
      const result = await initProject(projectRoot);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/sync') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = await syncProject(projectRoot, body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/install-hooks') {
    try {
      const result = await installHooks(projectRoot);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/audit') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = await runAudit(projectRoot, body);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/doctor') {
    try {
      const result = await runDoctor(projectRoot);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/mp/probes') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = await runProbes(projectRoot, body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  return false;
}

module.exports = { handleMasterProcessRoutes };
