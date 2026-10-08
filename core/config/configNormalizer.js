const { clone, asString, asFontSize, asBoolean, asInteger, assertUrl, normalizePort } = require('./utils');
const { DEFAULT_CONFIG, TRACE_OPTIONS, SCREENSHOT_OPTIONS, VIDEO_OPTIONS, ENV_RESERVED_KEYS } = require('./constants');
const { normalizeSuites } = require('./suiteNormalizer');

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
    if (apiBaseURL) {
      assertUrl(apiBaseURL, `${envKey}.apiBaseURL`);
    }

    const envEntry = { label, baseURL, apiBaseURL };

    // Giữ lại MỌI key chuỗi do dự án tự định nghĩa (vd. một URL phụ theo nghiệp vụ)
    // mà KHÔNG hard-code tên field của bất kỳ dự án nào trong file thuộc sở hữu Hub này.
    // Nguồn sự thật là dashboardConfig.json — file đã được loại khỏi sync nên mỗi dự án tự giữ.
    // Ưu tiên: giá trị từ input; nếu input không khai báo thì lấy lại từ config hiện có
    // để một lần lưu thiếu field không âm thầm xoá URL riêng của dự án.
    for (const source of [fallback, envValue]) {
      for (const [propKey, propVal] of Object.entries(source || {})) {
        if (ENV_RESERVED_KEYS.has(propKey)) continue;
        if (propKey === '_siteLabels') continue;
        if (typeof propVal !== 'string') continue;
        const trimmed = propVal.trim();
        if (source === envValue && trimmed === '') {
          delete envEntry[propKey];
        } else if (trimmed !== '') {
          envEntry[propKey] = trimmed;
        }
      }
    }

    const siteLabelsSource = (envValue._siteLabels && typeof envValue._siteLabels === 'object')
      ? envValue._siteLabels
      : (fallback._siteLabels && typeof fallback._siteLabels === 'object' ? fallback._siteLabels : null);
    if (siteLabelsSource) {
      const siteLabels = {};
      for (const [sKey, sLabel] of Object.entries(siteLabelsSource)) {
        if (typeof sLabel === 'string' && sLabel.trim()) {
          siteLabels[sKey] = sLabel.trim().slice(0, 100);
        }
      }
      if (Object.keys(siteLabels).length > 0) {
        envEntry._siteLabels = siteLabels;
      }
    }

    environments[envKey] = envEntry;
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

  const brandingInput = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const brandingFallback = existing.branding || DEFAULT_CONFIG.branding;
  const branding = {
    projectName: asString(brandingInput.projectName, brandingFallback.projectName).slice(0, 80),
    projectSubtitle: asString(brandingInput.projectSubtitle, brandingFallback.projectSubtitle).slice(0, 100),
    pageTitle: asString(brandingInput.pageTitle, brandingFallback.pageTitle).slice(0, 100),
    logoUrl: asString(brandingInput.logoUrl, brandingFallback.logoUrl).slice(0, 500),
    primaryColor: asString(brandingInput.primaryColor, brandingFallback.primaryColor).slice(0, 80),
    backgroundColor: asString(brandingInput.backgroundColor, brandingFallback.backgroundColor).slice(0, 80),
    fontSize: asFontSize(brandingInput.fontSize, brandingFallback.fontSize)
  };

  const discordInput = source.discord && typeof source.discord === 'object' ? source.discord : {};
  const discordFallback = existing.discord || DEFAULT_CONFIG.discord;
  const discord = {
    webhookUrl: asString(discordInput.webhookUrl, discordFallback.webhookUrl).slice(0, 500),
    channelName: asString(discordInput.channelName, discordFallback.channelName).slice(0, 100),
    notifyOnFinish: asBoolean(discordInput.notifyOnFinish, discordFallback.notifyOnFinish),
    notifyOnlyOnFailure: asBoolean(discordInput.notifyOnlyOnFailure, discordFallback.notifyOnlyOnFailure),
  };

  const suites = normalizeSuites(source.suites, existing.suites);

  const qaInput = source.qa && typeof source.qa === 'object' ? source.qa : {};
  const qaFallback = existing.qa || DEFAULT_CONFIG.qa;
  const asRelPath = (value, fallback) => {
    const text = asString(value, '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!text) return fallback;
    if (/^[a-zA-Z]:/.test(text) || text.split('/').includes('..')) return fallback;
    return text.slice(0, 200);
  };
  const qa = {
    requirements: asRelPath(qaInput.requirements, qaFallback.requirements),
    testCases: asRelPath(qaInput.testCases, qaFallback.testCases),
    specs: asRelPath(qaInput.specs, qaFallback.specs),
    decisionsFile: asRelPath(qaInput.decisionsFile, qaFallback.decisionsFile),
  };

  const docsInput = source.docs && typeof source.docs === 'object' ? source.docs : {};
  const docsFallback = existing.docs || DEFAULT_CONFIG.docs;
  const docs = { dir: asRelPath(docsInput.dir, docsFallback.dir) };

  const serverInput = source.server && typeof source.server === 'object' ? source.server : {};
  const serverFallback = existing.server || DEFAULT_CONFIG.server || { port: 4180 };
  const server = {
    port: normalizePort(serverInput.port, serverFallback.port),
  };

  return { environments, runtime, server, api, artifacts, branding, suites, discord, qa, docs };
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

module.exports = { normalizeDashboardConfig, publicDashboardConfig };
