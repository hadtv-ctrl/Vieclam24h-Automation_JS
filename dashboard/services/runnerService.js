/**
 * dashboard/services/runnerService.js
 * Manages Playwright subprocess execution, live SSE logging, and run status.
 */
const { spawn } = require('child_process');
const https = require('https');
const { getDashboardConfig } = require('../../core/config/dashboardConfig');
const { listSpecs, getPlaywrightProjects } = require('./specService');
const { newestReport } = require('./resourceService');

let activeRun = null;
let lastRun = null;
const clients = new Set();
const logBuffer = [];

function publish(type, payload) {
  const event = { type, payload, timestamp: new Date().toISOString() };
  if (type === 'log') {
    logBuffer.push(event);
    if (logBuffer.length > 1000) logBuffer.shift();
  }
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(message);
}

function publicRun(run) {
  if (!run) return null;
  const { child, ...rest } = run;
  return rest;
}

function validateOptions(input, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const settings = getDashboardConfig();
  const environments = Object.keys(settings.environments);
  const allSpecs = listSpecs(null, root);
  const project = String(input.project || 'all');
  const environment = String(input.environment || settings.runtime.defaultEnvironment);
  const grep = String(input.grep || '').trim();
  const workers = Number(input.workers || settings.runtime.workers);
  const suiteKey = typeof input.suiteKey === 'string' ? input.suiteKey.replace(/[^\w\-]/g, '-').slice(0, 60) : '';
  const suiteLabel = typeof input.suiteLabel === 'string' ? input.suiteLabel.slice(0, 80) : '';

  let viewport = null;
  if (input.viewport && typeof input.viewport === 'object') {
    const w = Number(input.viewport.width);
    const h = Number(input.viewport.height);
    if (Number.isInteger(w) && w >= 320 && w <= 7680 && Number.isInteger(h) && h >= 320 && h <= 4320) {
      viewport = { width: w, height: h };
    }
  }

  let specs = [];
  if (Array.isArray(input.specs)) {
    specs = input.specs.map(String).filter((s) => allSpecs.includes(s));
  } else if (input.spec && input.spec !== 'all') {
    if (allSpecs.includes(input.spec)) specs = [input.spec];
    else throw new Error('Spec không hợp lệ.');
  }

  let projects = [];
  if (Array.isArray(input.projects)) {
    projects = input.projects.map(String).filter((p) => getPlaywrightProjects(root).includes(p));
  } else if (input.project && input.project !== 'all') {
    if (getPlaywrightProjects(root).includes(input.project)) projects = [input.project];
  }

  if (!getPlaywrightProjects(root).includes(project) && project !== 'all') throw new Error('Project không hợp lệ.');
  if (!environments.includes(environment)) throw new Error('Environment không hợp lệ.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('Luồng chạy phải từ 1 đến 8.');
  if (grep.length > 80 || /[\r\n\0]/.test(grep)) throw new Error('Tag/grep không hợp lệ.');

  const spec = specs.length === 1 ? specs[0] : (specs.length > 1 ? specs.join(' ') : 'all');
  return { project, projects, environment, spec, specs, grep, workers, headed: input.headed === true, viewport, suiteLabel, suiteKey };
}

function runtimeEnv(options) {
  const settings = getDashboardConfig();
  const runtime = settings.runtime;
  const api = settings.api;
  const retries = process.env.CI ? runtime.retriesCI : runtime.retriesLocal;
  const selectedSpec = String(options.spec || (Array.isArray(options.specs) && options.specs.length > 0 ? options.specs[0] : '') || '');
  const selectedProject = String(options.project || '');
  const platform = selectedSpec.startsWith('tests/e2e/mobile-web/') || selectedSpec.startsWith('tests/e2e/mobile/') || selectedSpec.includes('.mobile.') || /^Mobile (?:Chrome|Safari)/i.test(selectedProject)
    ? 'mobile-web' : selectedSpec.startsWith('tests/e2e/mobile-app/') ? 'mobile-app' : 'desktop';

  const vpWidth = options.viewport?.width || runtime.viewport.width;
  const vpHeight = options.viewport?.height || runtime.viewport.height;

    const sanitizeSuiteName = (name) => String(name || '')
    .replace(/[^\w\-. ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

  return {
    NODE_ENV: options.environment,
    QA_SUITE_NAME: options.suiteKey || sanitizeSuiteName(options.suiteLabel),
    QA_SUITE_LABEL: String(options.suiteLabel || options.suiteKey || ''),
    QA_PLATFORM: platform,
    PW_WORKERS: String(options.workers),
    PW_RETRIES: String(retries),
    PW_TEST_TIMEOUT: String(runtime.testTimeout),
    PW_NAVIGATION_TIMEOUT: String(runtime.navigationTimeout),
    PW_ACTION_TIMEOUT: String(runtime.actionTimeout),
    PW_TRACE: runtime.trace,
    PW_SCREENSHOT: runtime.screenshot,
    PW_VIDEO: runtime.video,
    PW_VIEWPORT_WIDTH: String(vpWidth),
    PW_VIEWPORT_HEIGHT: String(vpHeight),
    SHOW_ENV_BANNER: runtime.showEnvBanner ? '1' : '0',
    DEBUG_OPTIONAL_POPUPS: runtime.debugOptionalPopups ? '1' : '0',
    REGISTRATION_BEARER_TOKEN: api.registrationBearerToken || '',
    REGISTRATION_BRANCH: api.branch,
    REGISTRATION_LANG: api.lang,
  };
}

function startRun(options, uiMode = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const args = ['test'];
  if (Array.isArray(options.specs) && options.specs.length > 0) args.push(...options.specs);
  else if (options.spec && options.spec !== 'all') args.push(options.spec);

  if (Array.isArray(options.projects) && options.projects.length > 0) {
    for (const proj of options.projects) args.push(`--project=${proj}`);
  } else if (options.project && options.project !== 'all') {
    args.push(`--project=${options.project}`);
  }
  if (options.grep) args.push('--grep', options.grep);
  if (uiMode) args.push('--ui');
  else if (options.headed) args.push('--headed');

  logBuffer.length = 0;
  const playwrightCli = require.resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [playwrightCli, ...args], {
    cwd: root,
    env: { ...process.env, ...runtimeEnv(options) },
    shell: false,
    windowsHide: true,
  });

  activeRun = {
    id: Date.now().toString(36),
    status: 'running',
    startedAt: new Date().toISOString(),
    mode: uiMode ? 'ui' : 'test',
    options,
    command: `npx playwright ${args.map((a) => JSON.stringify(a)).join(' ')}`,
    child,
  };
  publish('status', publicRun(activeRun));

  const pipe = (src, stream) => src.on('data', (d) => publish('log', { stream, text: d.toString() }));
  pipe(child.stdout, 'stdout');
  pipe(child.stderr, 'stderr');

  child.on('error', (err) => publish('log', { stream: 'stderr', text: `${err.message}\n` }));
  child.on('close', (exitCode, signal) => {
    const report = newestReport(root);
    activeRun.status = signal ? 'stopped' : exitCode === 0 ? 'passed' : 'failed';
    activeRun.finishedAt = new Date().toISOString();
    activeRun.exitCode = exitCode;
    activeRun.reportAvailable = Boolean(report);
    lastRun = publicRun(activeRun);
    activeRun = null;
    publish('status', lastRun);
  });

  return publicRun(activeRun);
}

function stopRun() {
  if (!activeRun?.child) return false;
  activeRun.child.kill('SIGTERM');
  return true;
}

module.exports = {
  getActiveRun: () => activeRun,
  getLastRun: () => lastRun,
  getClients: () => clients,
  getLogBuffer: () => logBuffer,
  publish,
  publicRun,
  validateOptions,
  runtimeEnv,
  startRun,
  stopRun
};
