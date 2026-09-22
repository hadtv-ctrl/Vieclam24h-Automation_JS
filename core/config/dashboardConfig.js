// master-process-disable-size-check: Legacy module, queued for modular decomposition
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'dashboardConfig.json');

const DEFAULT_CONFIG = Object.freeze({
  environments: {
    qc: {
      label: 'QC',
      baseURL: 'https://example.com',
      apiBaseURL: 'https://httpbin.org',
    },
    stg: {
      label: 'Staging',
      baseURL: 'https://staging.example.com',
      apiBaseURL: 'https://httpbin.org',
    },
    prod: {
      label: 'Production',
      baseURL: 'https://example.com',
      apiBaseURL: 'https://httpbin.org',
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
    registrationBearerToken: '',
    branch: 'main',
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
  server: {
    port: 4180,
  },
  // Vị trí tài liệu QA của TỪNG dự án. Thư mục spec khác nhau giữa các repo
  // (tests/ ở đây, playwright/tests ở repo khác) nên phải khai được, không hard-code.
  // dashboardConfig.json nằm trong excludes của sync nên mỗi repo tự giữ giá trị của mình.
  qa: {
    requirements: 'requirements',
    testCases: 'test-cases',
    specs: 'tests',
    decisionsFile: 'decisions.json',
  },
  // Thư mục tài liệu RIÊNG của dự án, được mục Hướng dẫn tự quét.
  // Nhờ vậy thêm một tài liệu không còn phải sửa code trong dashboard/ — vùng mà sync
  // ghi đè toàn bộ, nên mọi chỉnh sửa ở đó sẽ biến mất ở lần đồng bộ kế tiếp.
  docs: {
    dir: 'docs',
  },
  branding: {
    projectName: "QA Automation Studio",
    projectSubtitle: "Playwright Automation Platform",
    pageTitle: "QA Automation Dashboard",
    logoUrl: "",
    primaryColor: "#0A65CC",
    backgroundColor: "",
    fontSize: "14px"
  },
  suites: {
    "smoke": {
      label: "Smoke Tests",
      project: "all",
      viewport: { preset: "default", width: 1920, height: 1080 },
      spec: "all",
      specs: "all",
      grep: "@smoke",
      workers: 2
    }
  },
  discord: {
    webhookUrl: '',
    channelName: '#qa-automation-reports',
    notifyOnFinish: true,
    notifyOnlyOnFailure: false,
  },
});

// Các key của môi trường do Hub chuẩn hoá riêng ở trên. Mọi key chuỗi khác được coi là
// mở rộng của dự án và giữ nguyên. KHÔNG thêm tên field riêng của dự án vào đây.
const ENV_RESERVED_KEYS = new Set(['label', 'baseURL', 'apiBaseURL']);

const TRACE_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];
const SCREENSHOT_OPTIONS = ['off', 'on', 'only-on-failure'];
const VIDEO_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asFontSize(value, fallback = '') {
  const text = asString(value, '');
  if (!text) return '';
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(text);
  if (!match) return asFontSize(fallback, '');
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size < 11 || size > 18) return asFontSize(fallback, '');
  return `${size}px`;
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

  const suitesInput = source.suites && typeof source.suites === 'object' ? source.suites : (existing.suites || DEFAULT_CONFIG.suites);
  const suites = {};
  
  for (const [key, value] of Object.entries(suitesInput)) {
    if (typeof value === 'object' && value !== null) {
      const suiteKey = key.slice(0, 50);
      const isComposite = value.type === 'composite' || (Array.isArray(value.suites) && value.suites.length > 0);
      const isMulti = !isComposite && (value.type === 'multi-platform' || (value.platforms && typeof value.platforms === 'object'));

      if (isComposite) {
        const childSuites = Array.isArray(value.suites)
          ? value.suites.map((s) => asString(s, '')).filter(Boolean)
          : [];

        suites[suiteKey] = {
          label: asString(value.label, key).slice(0, 50),
          description: asString(value.description, '').slice(0, 200),
          type: 'composite',
          suites: childSuites,
          workers: asInteger(value.workers, 2, 1, 8),
        };
        continue;
      }
      
      let platforms = null;
      if (value.platforms && typeof value.platforms === 'object') {
        platforms = {};
        for (const [pKey, pVal] of Object.entries(value.platforms)) {
          if (typeof pVal === 'object' && pVal !== null) {
            let pSpecs = [];
            if (Array.isArray(pVal.specs)) {
              pSpecs = pVal.specs.map((s) => asString(s, '')).filter(Boolean);
            } else if (typeof pVal.spec === 'string' && pVal.spec && pVal.spec !== 'all') {
              pSpecs = [pVal.spec.trim()];
            }

            const pVpInput = pVal.viewport && typeof pVal.viewport === 'object' ? pVal.viewport : {};
            const pDefaultVp = pKey === 'mobile' ? { preset: '390x844', width: 390, height: 844 } : { preset: '1920x1080', width: 1920, height: 1080 };
            platforms[pKey] = {
              enabled: pVal.enabled !== false,
              label: asString(pVal.label, pKey === 'mobile' ? 'Mobile Web' : 'Desktop Web').slice(0, 50),
              project: asString(pVal.project, pKey === 'mobile' ? 'Pixel 7' : 'Desktop Chrome').slice(0, 100),
              device: asString(pVal.device, pKey === 'mobile' ? 'Pixel 7' : '').slice(0, 100),
              viewport: {
                preset: asString(pVpInput.preset || pVal.viewportPreset, pDefaultVp.preset),
                width: asInteger(pVpInput.width || pVal.viewportWidth, pDefaultVp.width, 320, 7680),
                height: asInteger(pVpInput.height || pVal.viewportHeight, pDefaultVp.height, 320, 4320),
              },
              spec: pSpecs.length === 1 ? pSpecs[0] : (pSpecs.length > 1 ? 'custom' : 'all'),
              specs: pSpecs.length > 0 ? pSpecs : 'all',
              grep: asString(pVal.grep, '').slice(0, 80),
              workers: asInteger(pVal.workers, 2, 1, 8),
            };
          }
        }
      }

      let specs = [];
      if (Array.isArray(value.specs)) {
        specs = value.specs.map((s) => asString(s, '')).filter(Boolean);
      } else if (typeof value.spec === 'string' && value.spec && value.spec !== 'all') {
        specs = [value.spec.trim()];
      }

      const vpInput = value.viewport && typeof value.viewport === 'object' ? value.viewport : {};
      const vpPreset = asString(vpInput.preset || value.viewportPreset, 'default');
      const vpWidth = asInteger(vpInput.width || value.viewportWidth, 1920, 320, 7680);
      const vpHeight = asInteger(vpInput.height || value.viewportHeight, 1080, 320, 4320);
      const viewport = {
        preset: vpPreset,
        width: vpWidth,
        height: vpHeight,
      };

      const platformVal = asString(value.platform, '').toLowerCase();
      let detectedPlatform = platformVal;
      if (!detectedPlatform) {
        const isMobileProj = asString(value.project, '').toLowerCase().includes('mobile');
        detectedPlatform = isMobileProj ? 'mobile' : 'desktop';
      }

      suites[suiteKey] = {
        label: asString(value.label, key).slice(0, 50),
        description: asString(value.description, '').slice(0, 200),
        type: isMulti ? 'multi-platform' : 'single',
        platform: detectedPlatform,
        project: asString(value.project, 'all').slice(0, 100),
        device: asString(value.device, '').slice(0, 100),
        viewport,
        spec: specs.length === 1 ? specs[0] : (specs.length > 1 ? 'custom' : 'all'),
        specs: specs.length > 0 ? specs : 'all',
        grep: asString(value.grep, '').slice(0, 80),
        workers: asInteger(value.workers, 2, 1, 8),
      };

      if (platforms) {
        suites[suiteKey].platforms = platforms;
      }
    }
  }

  // Đường dẫn QA phải là tương đối và nằm trong repo: chặn '..' và đường dẫn tuyệt đối,
  // vì giá trị này được dùng để quét thư mục.
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

function normalizePort(value, fallback = 4180) {
  if (value === 'random' || value === 0 || value === '0') return 'random';
  if (value === 'auto') return 'auto';
  const number = Number.parseInt(value, 10);
  if (Number.isInteger(number) && number >= 1024 && number <= 65535) return number;
  return fallback;
}

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
