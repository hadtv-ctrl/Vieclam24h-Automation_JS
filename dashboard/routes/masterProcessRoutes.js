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
  validateProjectPath,
  getProjectStatus,
  initProject,
  syncProject,
  installHooks,
  runAudit,
  runDoctor,
  runProbes,
  exportEvidence,
  reviewEvidence,
  runMasterAction,
} = require('../services/masterProcessService');

async function handleMasterProcessRoutes(request, response, url, context = {}) {
  const normPath = url.pathname.replace(/^\/api\/master-process\//, '/api/mp/');
  if (!normPath.startsWith('/api/mp/')) return false;
  const fallbackRoot = typeof context === 'string' ? context : (context.root || process.cwd());

  try {
    let body = {};
    if (request.method === 'POST') {
      body = await parseBody(request).catch(() => ({}));
    }
    const target = body.targetPath || body.projectRoot || url.searchParams.get('target') || fallbackRoot;
    const projectRoot = validateProjectPath(target, fallbackRoot);

    if (normPath === '/api/mp/freeze' || normPath === '/api/mp/freeze/toggle') {
      if (request.method === 'GET') return sendJson(response, 200, getCircuitBreakerStatus(projectRoot));
      if (request.method === 'POST') return sendJson(response, 200, updateFreezeState(projectRoot, body));
    }

    if (request.method === 'GET' && (normPath === '/api/mp/evidence' || normPath === '/api/mp/evidence/latest')) {
      const evPath = path.join(projectRoot, '.gate-artifacts', 'evidence-gate4.json');
      if (!fs.existsSync(evPath)) return sendJson(response, 200, { exists: false });
      return sendJson(response, 200, { exists: true, evidence: JSON.parse(fs.readFileSync(evPath, 'utf8')) });
    }

    if (request.method === 'GET' && normPath === '/api/mp/status') {
      return sendJson(response, 200, await getProjectStatus(projectRoot));
    }

    if (request.method === 'GET' && normPath === '/api/mp/audit') {
      const res = await runAudit(projectRoot, { staged: url.searchParams.get('staged') === 'true' });
      return sendJson(response, res.code === 409 ? 409 : 200, res);
    }

    if (request.method === 'POST') {
      if (normPath === '/api/mp/run') {
        const result = await runMasterAction(projectRoot, body.action, body);
        return sendJson(response, result.code === 409 ? 409 : 200, result);
      }
      let res;
      if (normPath === '/api/mp/init') res = await initProject(projectRoot);
      else if (normPath === '/api/mp/sync') res = await syncProject(projectRoot, body);
      else if (normPath === '/api/mp/install-hooks') res = await installHooks(projectRoot);
      else if (normPath === '/api/mp/audit') res = await runAudit(projectRoot, body);
      else if (normPath === '/api/mp/doctor') res = await runDoctor(projectRoot);
      else if (normPath === '/api/mp/probes') res = await runProbes(projectRoot, body);
      else if (normPath === '/api/mp/evidence/export') res = await exportEvidence(projectRoot);
      else if (normPath === '/api/mp/evidence/review') res = await reviewEvidence(projectRoot, body);
      if (res) return sendJson(response, res.code === 409 ? 409 : 200, res);
    }
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(response, status, { ok: false, error: error.message });
  }

  return false;
}

module.exports = { handleMasterProcessRoutes };
