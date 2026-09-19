const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : process.cwd();
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;

let resolveConfiguredPort;
try {
  ({ resolveConfiguredPort } = require('../core/config/dashboardConfig'));
} catch (_) {
  resolveConfiguredPort = () => 4180;
}

function getAppName() {
  if (process.env.DASHBOARD_APP_NAME) return process.env.DASHBOARD_APP_NAME;
  try {
    const cfgPath = path.join(ROOT, 'core', 'config', 'dashboardConfig.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg?.branding?.projectName) {
        return cfg.branding.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      }
    }
  } catch (_) {}
  return path.basename(ROOT).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function getProjectTitle() {
  try {
    const cfgPath = path.join(ROOT, 'core', 'config', 'dashboardConfig.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg?.branding?.projectName) return cfg.branding.projectName;
    }
  } catch (_) {}
  return 'QA Automation Studio';
}

const APP_NAME = getAppName();
const PROJECT_TITLE = getProjectTitle();
const { stateFilePath } = require('./services/serverStateService');

const STATE_PATH = stateFilePath(ROOT);
const MAX_PORT_ATTEMPTS = 20;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      });
    try {
      tester.listen(port, '127.0.0.1');
    } catch {
      resolve(false);
    }
  });
}

function getRandomPort(min = 4200, max = 4999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dashboardUrl(port) {
  return `http://127.0.0.1:${port}`;
}

async function fetchJson(url, timeout = 1000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function isRunning(port) {
  const response = await fetchJson(`${dashboardUrl(port)}/api/state`);
  return Boolean(response);
}

async function getHealth(port) {
  return fetchJson(`${dashboardUrl(port)}/api/health`);
}

async function hasCurrentSettingsApi(port) {
  const response = await fetchJson(`${dashboardUrl(port)}/api/settings`);
  return Boolean(response);
}

async function stopRunningDashboard(port) {
  try {
    await fetch(`${dashboardUrl(port)}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Ignore shutdown request errors.
  }
}

function writeState(port) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ appName: APP_NAME, workspaceRoot: ROOT, port, updatedAt: new Date().toISOString() }, null, 2));
}

async function findAvailablePort(targetPort) {
  // 1. Kiem tra xem dashboard cua chinh project nay co dang chay khong
  try {
    if (fs.existsSync(STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      if (state.port && (state.workspaceRoot === ROOT || !state.workspaceRoot)) {
        const running = await isRunning(state.port);
        if (running) {
          const health = await getHealth(state.port);
          if (health?.appName === APP_NAME && health?.workspaceRoot === ROOT) {
            return { port: state.port, status: 'same-dashboard' };
          }
        }
      }
    }
  } catch (_) {}

  // 2. Che do Random port
  if (targetPort === 'random' || targetPort === 0) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = getRandomPort(4200, 4999);
      if ((await isPortAvailable(candidate)) && !(await isRunning(candidate))) {
        return { port: candidate, status: 'free' };
      }
    }
    return { port: 4180, status: 'free' };
  }

  // 3. Che do Static hoac Auto port
  const basePort = typeof targetPort === 'number' ? targetPort : 4180;
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = basePort + offset;
    const running = await isRunning(port);
    if (!running && (await isPortAvailable(port))) {
      return { port, status: 'free' };
    }

    const health = await getHealth(port);
    if (health?.appName === APP_NAME && health?.workspaceRoot === ROOT) {
      return { port, status: 'same-dashboard' };
    }
  }

  return null;
}

async function start() {
  const configuredPort = resolveConfiguredPort(ROOT);
  const selected = await findAvailablePort(configuredPort);
  if (!selected) {
    process.exitCode = 1;
    console.error('Không tìm thấy port trống nào để khởi động dashboard.');
    return;
  }

  const url = dashboardUrl(selected.port);

  if (selected.status === 'same-dashboard') {
    if (await hasCurrentSettingsApi(selected.port)) {
      writeState(selected.port);
      console.log(`${PROJECT_TITLE} dashboard đã chạy tại ${url}`);
      return;
    }

    console.log(`${PROJECT_TITLE} dashboard tại ${url} đang chạy phiên bản cũ, đang khởi động lại...`);
    await stopRunningDashboard(selected.port);
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      DASHBOARD_APP_NAME: APP_NAME,
      DASHBOARD_PORT: String(selected.port),
    },
  });
  child.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (await isRunning(selected.port)) {
      writeState(selected.port);
      console.log(`${PROJECT_TITLE} dashboard đang chạy ngầm tại ${url}`);
      console.log('Tắt bằng: npm run dashboard:stop');
      return;
    }
  }

  process.exitCode = 1;
  console.error('Dashboard không thể khởi động. Chạy npm run dashboard để xem log chi tiết.');
}

start().catch((error) => {
  process.exitCode = 1;
  console.error(`Dashboard không thể khởi động: ${error.message}`);
});
