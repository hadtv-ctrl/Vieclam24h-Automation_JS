const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4173', 10);
const URL = `http://127.0.0.1:${PORT}`;

async function isRunning() {
  try {
    const response = await fetch(`${URL}/api/state`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function hasCurrentSettingsApi() {
  try {
    const response = await fetch(`${URL}/api/settings`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function stopRunningDashboard() {
  try {
    await fetch(`${URL}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!(await isRunning())) return;
  }
}

async function start() {
  if (await isRunning()) {
    if (await hasCurrentSettingsApi()) {
      console.log(`Dashboard đã chạy tại ${URL}`);
      return;
    }

    console.log(`Dashboard tại ${URL} đang chạy phiên bản cũ, đang khởi động lại...`);
    await stopRunningDashboard();
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, DASHBOARD_PORT: String(PORT) },
  });
  child.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (await isRunning()) {
      console.log(`Dashboard đang chạy ngầm tại ${URL}`);
      console.log('Tắt bằng: npm run dashboard:stop');
      return;
    }
  }
  process.exitCode = 1;
  console.error('Dashboard không thể khởi động. Chạy npm run dashboard để xem log chi tiết.');
}

start();

