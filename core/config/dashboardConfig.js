const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'dashboardConfig.json');

const DEFAULT_CONFIG = Object.freeze({
  environments: {
    qc: {
      label: 'QC',
      baseURL: 'https://seeker.vl24hv2.qc.sieuviet-team.com',
      apiBaseURL: 'https://api.vl24hv2.qc.sieuviet-team.com',
    },
    stg: {
      label: 'Staging',
      baseURL: 'https://seeker.vl24hv2.staging.sieuviet-team.com',
      apiBaseURL: 'https://api.vl24hv2.staging.sieuviet-team.com',
    },
    prod: {
      label: 'Production',
      baseURL: 'https://seeker.vl24hv2.staging.sieuviet-team.com',
      apiBaseURL: 'https://api.vl24hv2.staging.sieuviet-team.com',
    },
  },
  runtime: {
    defaultEnvironment: 'qc',
    workers: 2,
    testTimeout: 60000,
    navigationTimeout: 60000,
    actionTimeout: 0,
    retriesLocal: 0,
    retriesCI: 2,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
    showEnvBanner: false,
    debugOptionalPopups: false,
  },
  api: {
    registrationBearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaGFubmVsX2NvZGUiOiJ2bDI0aCIsInVzZXIiOm51bGx9.b_GBXepcnCjRzAc9I5OdamF0Mx2K1rEg9sZVYpNx_rU',
    branch: 'vl24h.north',
    lang: 'vi',
    registerRetries: 2,
    registerTimeout: 30000,
    consentRetries: 2,
    consentTimeout: 30000,
  },
  artifacts: {
    retentionDays: 14,
    maxReportsPerDay: 20,
    autoCleanupEvidence: false,
    autoCleanupReports: false,
  },
});

const TRACE_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];
const SCREENSHOT_OPTIONS = ['off', 'on', 'only-on-failure'];
const VIDEO_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readRawConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number)) return fallback;
  if (number < min || number > max) return fallback;
  return number;
}

function assertUrl(value, name) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${name} must be a valid http(s) URL.`);
  }
}

function normalizeDashboardConfig(input = {}, existingConfig = DEFAULT_CONFIG) {
  const existing = clone(existingConfig || DEFAULT_CONFIG);
  const source = input && typeof input === 'object' ? input : {};
  const environmentsInput = source.environments && typeof source.environments === 'object'
    ? source.environments
    : existing.environments;
  const environments = {};

  for (const [key, value] of Object.entries(environmentsInput)) {
    const envKey = asString(key).toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,20}$/.test(envKey)) {
      throw new Error(`Environment "${key}" has an invalid key.`);
    }

    const envValue = value && typeof value === 'object' ? value : {};
    const fallback = existing.environments[envKey] || {};
    const label = asString(envValue.label, fallback.label || envKey.toUpperCase()).slice(0, 40);
    const baseURL = asString(envValue.baseURL, fallback.baseURL);
    const apiBaseURL = asString(envValue.apiBaseURL, fallback.apiBaseURL);
    assertUrl(baseURL, `${envKey}.baseURL`);
    assertUrl(apiBaseURL, `${envKey}.apiBaseURL`);
    environments[envKey] = { label, baseURL, apiBaseURL };
  }

  if (!Object.keys(environments).length) throw new Error('At least one environment is required.');

  const runtimeInput = source.runtime && typeof source.runtime === 'object' ? source.runtime : {};
  const runtimeFallback = existing.runtime || DEFAULT_CONFIG.runtime;
  const defaultEnvironment = asString(runtimeInput.defaultEnvironment, runtimeFallback.defaultEnvironment);
  if (!environments[defaultEnvironment]) throw new Error('Default environment must exist in environments.');

  const trace = asString(runtimeInput.trace, runtimeFallback.trace);
  const screenshot = asString(runtimeInput.screenshot, runtimeFallback.screenshot);
  const video = asString(runtimeInput.video, runtimeFallback.video);
  if (!TRACE_OPTIONS.includes(trace)) throw new Error('Trace option is invalid.');
  if (!SCREENSHOT_OPTIONS.includes(screenshot)) throw new Error('Screenshot option is invalid.');
  if (!VIDEO_OPTIONS.includes(video)) throw new Error('Video option is invalid.');

  const viewportInput = runtimeInput.viewport && typeof runtimeInput.viewport === 'object' ? runtimeInput.viewport : {};
  const viewportFallback = runtimeFallback.viewport || DEFAULT_CONFIG.runtime.viewport;
  const runtime = {
    defaultEnvironment,
    workers: asInteger(runtimeInput.workers, runtimeFallback.workers, 1, 8),
    testTimeout: asInteger(runtimeInput.testTimeout, runtimeFallback.testTimeout, 5000, 600000),
    navigationTimeout: asInteger(runtimeInput.navigationTimeout, runtimeFallback.navigationTimeout, 5000, 600000),
    actionTimeout: asInteger(runtimeInput.actionTimeout, runtimeFallback.actionTimeout, 0, 600000),
    retriesLocal: asInteger(runtimeInput.retriesLocal, runtimeFallback.retriesLocal, 0, 5),
    retriesCI: asInteger(runtimeInput.retriesCI, runtimeFallback.retriesCI, 0, 5),
    trace,
    screenshot,
    video,
    viewport: {
      width: asInteger(viewportInput.width, viewportFallback.width, 320, 7680),
      height: asInteger(viewportInput.height, viewportFallback.height, 320, 4320),
    },
    showEnvBanner: asBoolean(runtimeInput.showEnvBanner, runtimeFallback.showEnvBanner),
    debugOptionalPopups: asBoolean(runtimeInput.debugOptionalPopups, runtimeFallback.debugOptionalPopups),
  };

  const apiInput = source.api && typeof source.api === 'object' ? source.api : {};
  const apiFallback = existing.api || DEFAULT_CONFIG.api;
  const tokenInput = Object.prototype.hasOwnProperty.call(apiInput, 'registrationBearerToken')
    ? asString(apiInput.registrationBearerToken, '')
    : apiFallback.registrationBearerToken;
  const api = {
    registrationBearerToken: tokenInput || apiFallback.registrationBearerToken || '',
    branch: asString(apiInput.branch, apiFallback.branch).slice(0, 80),
    lang: asString(apiInput.lang, apiFallback.lang).slice(0, 12),
    registerRetries: asInteger(apiInput.registerRetries, apiFallback.registerRetries, 1, 5),
    registerTimeout: asInteger(apiInput.registerTimeout, apiFallback.registerTimeout, 5000, 120000),
    consentRetries: asInteger(apiInput.consentRetries, apiFallback.consentRetries, 1, 5),
    consentTimeout: asInteger(apiInput.consentTimeout, apiFallback.consentTimeout, 5000, 120000),
  };

  if (/[\r\n\0]/.test(api.registrationBearerToken)) throw new Error('Registration bearer token is invalid.');
  if (!/^[a-z0-9._-]+$/i.test(api.branch)) throw new Error('API branch is invalid.');
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/i.test(api.lang)) throw new Error('API language is invalid.');

  const artifactsInput = source.artifacts && typeof source.artifacts === 'object' ? source.artifacts : {};
  const artifactsFallback = existing.artifacts || DEFAULT_CONFIG.artifacts;
  const artifacts = {
    retentionDays: asInteger(artifactsInput.retentionDays, artifactsFallback.retentionDays, 1, 365),
    maxReportsPerDay: asInteger(artifactsInput.maxReportsPerDay, artifactsFallback.maxReportsPerDay, 1, 200),
    autoCleanupEvidence: asBoolean(artifactsInput.autoCleanupEvidence, artifactsFallback.autoCleanupEvidence),
    autoCleanupReports: asBoolean(artifactsInput.autoCleanupReports, artifactsFallback.autoCleanupReports),
  };

  return { environments, runtime, api, artifacts };
}

function getDashboardConfig() {
  return normalizeDashboardConfig(readRawConfig(), DEFAULT_CONFIG);
}

function saveDashboardConfig(nextConfig) {
  const current = getDashboardConfig();
  const normalized = normalizeDashboardConfig(nextConfig, current);
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function publicDashboardConfig(config = getDashboardConfig()) {
  const publicConfig = clone(config);
  const token = publicConfig.api.registrationBearerToken || '';
  publicConfig.api.registrationBearerToken = '';
  publicConfig.api.hasRegistrationBearerToken = Boolean(token);
  publicConfig.options = {
    trace: TRACE_OPTIONS,
    screenshot: SCREENSHOT_OPTIONS,
    video: VIDEO_OPTIONS,
  };
  return publicConfig;
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  TRACE_OPTIONS,
  SCREENSHOT_OPTIONS,
  VIDEO_OPTIONS,
  getDashboardConfig,
  normalizeDashboardConfig,
  publicDashboardConfig,
  saveDashboardConfig,
};
