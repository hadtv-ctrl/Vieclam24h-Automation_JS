/**
 * dashboard/routes/runnerRoutes.js
 * Handles all /api/run, /api/stop, /api/events, /api/state endpoints for test execution.
 */
const { sendJson, parseBody } = require('./routeUtils');
const {
  getActiveRun,
  getLastRun,
  getClients,
  getLogBuffer,
  publicRun,
  validateOptions,
  startRun,
  stopRun
} = require('../services/runnerService');

async function handleRunnerRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, {
      activeRun: publicRun(getActiveRun()),
      lastRun: getLastRun(),
      logs: getLogBuffer()
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write(': connected\n\n');
    const clients = getClients();
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/run') {
    if (getActiveRun()) return sendJson(response, 409, { error: 'Đang có một test run khác.' });
    try {
      const options = validateOptions(await parseBody(request), root);
      return sendJson(response, 202, startRun(options, false, root));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/ui') {
    if (getActiveRun()) return sendJson(response, 409, { error: 'Đang có một test run hoặc UI Mode khác.' });
    try {
      const options = validateOptions(await parseBody(request), root);
      return sendJson(response, 202, startRun(options, true, root));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/stop') {
    if (!getActiveRun()) return sendJson(response, 409, { error: 'Không có test run đang chạy.' });
    stopRun();
    return sendJson(response, 202, { message: 'Đã gửi yêu cầu dừng.' });
  }

  if (request.method === 'POST' && url.pathname === '/api/shutdown') {
    sendJson(response, 200, { message: 'Đang tắt dashboard server...' });
    if (typeof context.shutdown === 'function') {
      setImmediate(context.shutdown);
    }
    return true;
  }

  return false;
}

module.exports = { handleRunnerRoutes };
