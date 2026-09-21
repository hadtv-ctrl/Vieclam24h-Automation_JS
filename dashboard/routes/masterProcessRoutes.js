/**
 * dashboard/routes/masterProcessRoutes.js
 * Handles all /api/mp/* endpoints for Master Process integration,
 * Feature Freeze Circuit Breaker, and Acceptance Gate Evidence.
 */

const fs = require('fs');
const path = require('path');
const { sendJson, parseBody } = require('./routeUtils');
const { getCircuitBreakerStatus, updateFreezeState } = require('../../core/utils/circuitBreaker');
const {
  getProjectStatus,
  initProject,
  syncProject,
  installHooks,
  runAudit,
  runDoctor,
  runProbes,
  runMasterAction,
} = require('../services/masterProcessService');

async function handleMasterProcessRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith('/api/mp/')) return false;
  const projectRoot = typeof context === 'string' ? context : (context.root || process.cwd());

  try {
    if (url.pathname === '/api/mp/freeze') {
      if (request.method === 'GET') {
        return sendJson(response, 200, getCircuitBreakerStatus(projectRoot));
      }
      if (request.method === 'POST') {
        const body = await parseBody(request).catch(() => ({}));
        return sendJson(response, 200, updateFreezeState(projectRoot, body));
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/mp/evidence') {
      const evPath = path.join(projectRoot, '.gate-artifacts', 'evidence-gate4.json');
      if (!fs.existsSync(evPath)) return sendJson(response, 200, { exists: false });
      return sendJson(response, 200, { exists: true, evidence: JSON.parse(fs.readFileSync(evPath, 'utf8')) });
    }

    if (request.method === 'GET' && url.pathname === '/api/mp/status') {
      return sendJson(response, 200, await getProjectStatus(projectRoot));
    }

    if (request.method === 'POST') {
      const body = await parseBody(request).catch(() => ({}));
      if (url.pathname === '/api/mp/run') {
        const result = await runMasterAction(projectRoot, body.action, body);
        return sendJson(response, 200, result);
      }
      let res;
      if (url.pathname === '/api/mp/init') res = await initProject(projectRoot);
      else if (url.pathname === '/api/mp/sync') res = await syncProject(projectRoot, body);
      else if (url.pathname === '/api/mp/install-hooks') res = await installHooks(projectRoot);
      else if (url.pathname === '/api/mp/audit') return sendJson(response, 200, await runAudit(projectRoot, body));
      else if (url.pathname === '/api/mp/doctor') res = await runDoctor(projectRoot);
      else if (url.pathname === '/api/mp/probes') res = await runProbes(projectRoot, body);
      if (res) return sendJson(response, res.ok ? 200 : 400, res);
    }
  } catch (error) {
    return sendJson(response, 500, { ok: false, error: error.message });
  }

  return false;
}

module.exports = { handleMasterProcessRoutes };
