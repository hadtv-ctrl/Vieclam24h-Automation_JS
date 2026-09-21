const fs = require('fs');
const path = require('path');

let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : process.cwd();
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;
const { stateFilePath } = require('./services/serverStateService');

const STATE_PATH = stateFilePath(ROOT);
let resolveConfiguredPort;
try {
  ({ resolveConfiguredPort } = require('../core/config/dashboardConfig'));
} catch (_) {
  resolveConfiguredPort = () => 4180;
}

function readPort() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if ((state.workspaceRoot === ROOT || !state.workspaceRoot) && Number.isInteger(state.port)) {
      return state.port;
    }
  } catch {}

  const configured = resolveConfiguredPort(ROOT);
  return typeof configured === 'number' ? configured : 4180;
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
const PROJECT_TITLE = getProjectTitle();

async function stop() {
  const port = readPort();
  const url = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${url}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (fs.existsSync(STATE_PATH)) {
      fs.rmSync(STATE_PATH, { force: true });
    }

    console.log(`Đã tắt ${PROJECT_TITLE} dashboard tại ${url}`);
  } catch {
    console.log(`Không có ${PROJECT_TITLE} dashboard đang chạy tại ${url}`);
  }
}

stop();
