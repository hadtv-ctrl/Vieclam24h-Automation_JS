/**
 * dashboard/server.js
 * Modular Playwright Automation Studio Server & Master Dispatcher.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getDashboardConfig, resolveConfiguredPort } = require('../core/config/dashboardConfig');
const { createAgentService } = require('../core/ai/agentService');
const { createAgentRoutes } = require('../core/ai/agentRoutes');

const { handleSystemRoutes } = require('./routes/systemRoutes');
const { handleAiRoutes } = require('./routes/aiRoutes');
const { handleRunnerRoutes } = require('./routes/runnerRoutes');
const { handleRecorderRoutes, stopRecorderSession, getActiveRecorder } = require('./routes/recorderRoutes');
const { handleGitRoutes } = require('./routes/gitRoutes');
const { handleDataRoutes } = require('./routes/dataRoutes');
const { handleBddRoutes } = require('./routes/bddRoutes');
const { handlePageRoutes } = require('./routes/pageRoutes');
const { handleFixtureRoutes } = require('./routes/fixtureRoutes');
const { handleResourceRoutes, serveFile } = require('./routes/resourceRoutes');
const { sendJson, parseBody, safeChildPath } = require('./routes/routeUtils');
const { getActiveRun, stopRun } = require('./services/runnerService');

const ENGINE_DIR = path.resolve(__dirname, '..');
let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : process.cwd();
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;
require('dotenv').config({ path: path.join(ROOT, '.env') });
const PUBLIC_DIR = path.join(__dirname, 'public');

function getRandomPort(min = 4200, max = 4999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const CONFIGURED_PORT = resolveConfiguredPort(ROOT);
const IS_RANDOM_PORT = CONFIGURED_PORT === 'random' || CONFIGURED_PORT === 0;
function getAppName() {
  if (process.env.DASHBOARD_APP_NAME) return process.env.DASHBOARD_APP_NAME;
  try {
    const cfg = getDashboardConfig();
    if (cfg?.branding?.projectName) {
      return cfg.branding.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }
  } catch (_) {}
  return path.basename(ROOT).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}
const APP_NAME = getAppName();
const PORT = IS_RANDOM_PORT ? getRandomPort() : CONFIGURED_PORT;
let currentPort = PORT;

const agentService = createAgentService({ root: ROOT });
let pendingDashboardWrites = 0;
const agentRoutes = createAgentRoutes({
  service: agentService,
  parseBody,
  sendJson,
  isBusy: () => Boolean(getActiveRun() || getActiveRecorder() || pendingDashboardWrites),
});

const AGENT_SAFE_POST_ROUTES = new Set([
  '/api/stop', '/api/shutdown', '/api/recorder/stop', '/api/recorder/reset', '/api/recorder/scan-pages',
  '/api/recorder/convert', '/api/recorder/generate-draft', '/api/ai/generate-state',
  '/api/ai/config', '/api/ai/test-connection', '/api/ai/inline-suggest',
  '/api/diagnostics/analyze', '/api/builder/compile', '/api/system/apply-update',
]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/agent/')) {
    await agentRoutes(request, response, url);
    return;
  }
  const dashboardWrite = url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    && !(request.method === 'POST' && AGENT_SAFE_POST_ROUTES.has(url.pathname));
  if (dashboardWrite) {
    if (agentService.isRunning()) {
      sendJson(response, 409, { error: 'Agent đang làm việc. Hãy chờ hoặc dừng tác vụ trước khi thay đổi dữ liệu hay chạy test.' });
      return;
    }
    pendingDashboardWrites += 1;
    let released = false;
    const release = () => { if (!released) { released = true; pendingDashboardWrites -= 1; } };
    response.once('finish', release);
    response.once('close', release);
  }

  const context = { root: ROOT, engineDir: ENGINE_DIR, appName: APP_NAME, port: currentPort, agentService, shutdown };

  if (await handleSystemRoutes(request, response, url, context)) return;
  if (await handleAiRoutes(request, response, url, context)) return;
  if (await handleRunnerRoutes(request, response, url, context)) return;
  if (await handleRecorderRoutes(request, response, url, context)) return;
  if (await handleGitRoutes(request, response, url, context)) return;
  if (await handleDataRoutes(request, response, url, context)) return;
  if (await handleBddRoutes(request, response, url, context)) return;
  if (await handlePageRoutes(request, response, url, context)) return;
  if (await handleFixtureRoutes(request, response, url, context)) return;
  if (await handleResourceRoutes(request, response, url, context)) return;

  if (request.method === 'GET') {
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    return serveFile(response, safeChildPath(PUBLIC_DIR, requested));
  }
  sendJson(response, 404, { error: 'Endpoint không tồn tại.' });
});

const maxPortAttempts = 20;
let portAttempts = 0;
const STATE_PATH = path.join(ROOT, '.dashboard-server.json');

function tryListen(port) {
  server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
  const actualPort = server.address().port;
  currentPort = actualPort;
  try {
    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify({ appName: APP_NAME, workspaceRoot: ROOT, port: actualPort, pid: process.pid }, null, 2) + '\n',
      'utf8'
    );
  } catch (_) {}
  console.log(`Playwright Dashboard (${APP_NAME}): http://127.0.0.1:${actualPort}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (portAttempts < maxPortAttempts) {
      portAttempts += 1;
      const prevPort = currentPort;
      currentPort = IS_RANDOM_PORT ? getRandomPort() : (currentPort + 1);
      console.log(`Port ${prevPort} đang bận, tự động thử port tiếp theo: ${currentPort}...`);
      tryListen(currentPort);
      return;
    }
    console.error(`Không tìm được port trống sau ${maxPortAttempts} lần thử.`);
    process.exitCode = 1;
    return;
  }
  console.error(`Không thể khởi động dashboard: ${error.message}`);
  process.exitCode = 1;
});

tryListen(currentPort);

function shutdown() {
  agentService.shutdown();
  stopRun();
  stopRecorderSession();
  if (fs.existsSync(STATE_PATH)) {
    try { fs.rmSync(STATE_PATH, { force: true }); } catch (_) {}
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
