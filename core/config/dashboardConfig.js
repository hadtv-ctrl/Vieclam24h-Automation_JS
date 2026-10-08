const fs = require('fs');
const path = require('path');
const { CONFIG_PATH, DEFAULT_CONFIG, TRACE_OPTIONS, SCREENSHOT_OPTIONS, VIDEO_OPTIONS } = require('./constants');
const { normalizePort } = require('./utils');
const { normalizeDashboardConfig, publicDashboardConfig } = require('./configNormalizer');
function getProjectHashPort(projectPath) {
  const root = projectPath || process.env.QA_PROJECT_ROOT || process.cwd();
  const name = path.basename(root).toLowerCase();
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const offset = (Math.abs(hash) % 50) * 2;
  return 4180 + offset;
}

function resolveConfiguredPort(projectRoot) {
  const root = projectRoot || process.env.QA_PROJECT_ROOT || process.cwd();
  if (process.env.DASHBOARD_PORT) {
    const raw = String(process.env.DASHBOARD_PORT).trim().toLowerCase();
    if (raw === 'random' || raw === '0') return 'random';
    if (raw === 'auto') return getProjectHashPort(root);
    const p = Number.parseInt(raw, 10);
    if (Number.isInteger(p) && p >= 1024 && p <= 65535) return p;
  }
  try {
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, 'utf8').match(/^DASHBOARD_PORT\s*=\s*(.+)$/m);
      if (match) {
        const raw = match[1].trim().toLowerCase();
        if (raw === 'random' || raw === '0') return 'random';
        if (raw === 'auto') return getProjectHashPort(root);
        const p = Number.parseInt(raw, 10);
        if (Number.isInteger(p) && p >= 1024 && p <= 65535) return p;
      }
    }
  } catch (_) {}
  try {
    const cfg = getDashboardConfig();
    const portVal = cfg?.server?.port;
    if (portVal === 'random' || portVal === 0 || portVal === '0') return 'random';
    if (portVal === 'auto') return getProjectHashPort(root);
    if (Number.isInteger(portVal) && portVal >= 1024 && portVal <= 65535) return portVal;
  } catch (_) {}
  return 4180;
}

function getResolvedConfigPath() {
  const projectRoot = process.env.QA_PROJECT_ROOT || process.cwd();
  const projectConfigPath = path.join(projectRoot, 'qa-engine.config.json');
  if (fs.existsSync(projectConfigPath)) {
    return projectConfigPath;
  }
  const projectDashboardConfig = path.join(projectRoot, 'dashboardConfig.json');
  if (fs.existsSync(projectDashboardConfig)) {
    return projectDashboardConfig;
  }
  const projectCoreConfig = path.join(projectRoot, 'core', 'config', 'dashboardConfig.json');
  if (fs.existsSync(projectCoreConfig)) {
    return projectCoreConfig;
  }
  return CONFIG_PATH;
}

function readRawConfig() {
  const cfgPath = getResolvedConfigPath();
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function getDashboardConfig() {
  return normalizeDashboardConfig(readRawConfig(), DEFAULT_CONFIG);
}

function saveDashboardConfig(nextConfig) {
  const current = getDashboardConfig();
  const normalized = normalizeDashboardConfig(nextConfig, current);
  const cfgPath = getResolvedConfigPath();
  fs.writeFileSync(cfgPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

module.exports = {
  getProjectHashPort,
  resolveConfiguredPort,
  resolveConfiguredHost,
  CONFIG_PATH,
  getResolvedConfigPath,
  DEFAULT_CONFIG,
  TRACE_OPTIONS,
  SCREENSHOT_OPTIONS,
  VIDEO_OPTIONS,
  getDashboardConfig,
  normalizeDashboardConfig,
  normalizePort,
  getProjectHashPort,
  resolveConfiguredPort,
  publicDashboardConfig,
  saveDashboardConfig,
};
