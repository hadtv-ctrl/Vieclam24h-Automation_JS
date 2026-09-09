const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  CONFIG_PATH,
  getDashboardConfig,
  resolveConfiguredPort,
  publicDashboardConfig,
  saveDashboardConfig,
} = require('../core/config/dashboardConfig');

const ENGINE_DIR = path.resolve(__dirname, '..');
let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : process.cwd();
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;
require('dotenv').config({ path: path.join(ROOT, '.env') });
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const BACKUP_DIR = path.join(ROOT, '.dashboard-backups');
const TOOLS_DIR = path.join(ROOT, 'tools');
const TRACE_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];
const SCREENSHOT_OPTIONS = ['off', 'on', 'only-on-failure'];
const VIDEO_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];

const DISCORD_BOT_DIR = process.env.DISCORD_BOT_DIR ? path.resolve(process.env.DISCORD_BOT_DIR) : path.resolve(ROOT, '../discord-qa-bot');
const DISCORD_BOT_ENV_PATH = path.join(DISCORD_BOT_DIR, '.env');

const { checkForUpdates, applyUpdate, getCurrentVersion } = require('../core/system/updater');
const gitSyncService = require('../core/system/gitSyncService');

const { parsePlaywrightScript, scanPages } = require('../core/generator/recordParser');
const { transformToPomAndSpec } = require('../core/generator/recordTransformer');
const { saveDraftFiles } = require('../core/generator/recordWriter');
const { sanitizeToIdentifier } = require('../core/generator/namingUtils');
const { execSync } = require('child_process');

const {
  listDatasets,
  readDataset,
  saveDataset,
  createDataset,
  deleteDataset,
  jsonToCsv,
  csvToJson,
  generateDynamicValue,
} = require('../core/utils/dataManager');

const {
  PRESET_ACTIONS,
  compileVisualScenario,
  parseExistingSpecFile,
  scanAllProjectScripts,
} = require('../core/generator/visualBuilderCompiler');

const {
  injectSmartEvidenceCaptures,
} = require('../core/generator/evidenceInjector');
const { hashText } = require('../core/generator/wizardSchema');
const { createRemoteRunService } = require('../core/ci/remoteRunService');
const { createCopilotService } = require('../core/ai/copilotService');
const { createAgentService } = require('../core/ai/agentService');
const { createAgentRoutes } = require('../core/ai/agentRoutes');
const { analyzeDiagnostics } = require('../core/diagnostics/diagnosticsAnalyzer');

const {
  scanAllPageObjects,
  parsePageObject,
  scanAllFixtures,
  getFixtureByName,
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
  updateLocatorSelector,
  getCoreCapabilities,
  createPageObject,
  deletePageObject,
} = require('../core/generator/objectRepository');

const {
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  cleanupDraft,
} = require('../core/generator/draftManager');

const RECORDINGS_DIR = path.join(ROOT, '.tmp', 'recordings');
let activeRecorder = null;
const remoteRunConfig = { environments: {}, suites: {}, github: {} };
const remoteRunService = createRemoteRunService({ config: remoteRunConfig, allowProd: process.env.DASHBOARD_ALLOW_PROD_REMOTE === '1' });
const copilotService = createCopilotService({ quota: Number(process.env.DASHBOARD_AI_QUOTA || 20) });
const agentService = createAgentService({ root: ROOT });
let pendingDashboardWrites = 0;
const agentRoutes = createAgentRoutes({ service: agentService, parseBody, sendJson,
  isBusy: () => Boolean(activeRun || activeRecorder || pendingDashboardWrites) });
const AGENT_SAFE_POST_ROUTES = new Set([
  '/api/stop', '/api/shutdown', '/api/recorder/stop', '/api/recorder/reset', '/api/recorder/scan-pages',
  '/api/recorder/convert', '/api/recorder/generate-draft', '/api/ai/generate-state',
  '/api/ai/config', '/api/ai/test-connection', '/api/ai/inline-suggest',
  '/api/diagnostics/analyze', '/api/builder/compile', '/api/system/apply-update',
]);

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function killRecorderProcess(recorder) {
  if (!recorder?.child) return;
  const pid = recorder.child.pid;
  try {
    if (process.platform === 'win32' && pid) {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore', windowsHide: true });
    } else if (recorder.child) {
      recorder.child.kill('SIGTERM');
    }
  } catch (e) {}
}

function normalizeTargetUrl(rawUrl, fallback = 'https://example.com') {
  let urlStr = (rawUrl || '').trim();
  if (!urlStr) return fallback;
  if (!/^https?:\/\//i.test(urlStr)) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(urlStr)) {
      urlStr = 'http://' + urlStr;
    } else {
      urlStr = 'https://' + urlStr;
    }
  }
  return urlStr;
}


function ensureRecordingsDir() {
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
}

function listRecentRecordings() {
  ensureRecordingsDir();
  return fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => {
      const fullPath = path.join(RECORDINGS_DIR, entry.name);
      return {
        fileName: entry.name,
        path: `.tmp/recordings/${entry.name}`,
        size: fs.statSync(fullPath).size,
        modifiedAt: new Date(fs.statSync(fullPath).mtimeMs).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  });
  return env;
}

function writeEnvFile(filePath, envObj) {
  const lines = Object.entries(envObj).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}
const CODE_ROOTS = ['tests', 'pages', 'core'];
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
const PUBLIC_DOCUMENTS = [
  'docs/SETUP_GUIDE.md',
  'docs/DISCORD_BOT_SETUP_GUIDE.md',
  'GIT_WORKFLOW.md',
  'README.md',
  'ai/shared/AI_PROMPTS.md',
  'ai/shared/TEST_AUTOMATION_LESSONS.md',
  '.agents/skills/playwright_test/SKILL.md',
];

const DEV_DOCUMENTS = [
  'ai/dashboard/DASHBOARD_AI_PROMPT.md',
  'ai/dashboard/AI_LESSONS.md',
  '.agents/skills/dashboard-maintainer/SKILL.md',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'QA_AI_RULES.md',
  '.github/copilot-instructions.md',
  'ai/README.md',
];

const CANONICAL_DOCUMENTS = [...PUBLIC_DOCUMENTS, ...DEV_DOCUMENTS];

function isDeveloperRequest(request) {
  if (process.env.FRAMEWORK_DEV_MODE === 'true' || process.env.FRAMEWORK_DEV_MODE === '1') {
    return true;
  }
  const headerMode = request?.headers ? request.headers['x-developer-mode'] : null;
  const token = request?.headers ? request.headers['x-developer-token'] : null;
  const expectedToken = process.env.FRAMEWORK_DEV_TOKEN || 'lead_developer';
  if (headerMode === 'true' && (!process.env.FRAMEWORK_DEV_TOKEN || token === expectedToken)) {
    return true;
  }
  return false;
}

function listDocumentResources() {
  return PUBLIC_DOCUMENTS.filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
}

function getPlaywrightProjects() {
  try {
    const configPath = path.join(ROOT, 'playwright.config.js');
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      if (Array.isArray(config.projects) && config.projects.length > 0) {
        const names = config.projects.map((p) => p.name).filter(Boolean);
        return ['all', ...names];
      }
    }
  } catch (error) {
    console.warn('[Dashboard] Could not parse playwright.config.js projects:', error.message);
  }
  return [
    'all',
    'Desktop Smoke Tests',
    'Desktop Regression Tests',
    'Mobile Chrome Smoke Tests',
    'Mobile Chrome Regression Tests',
    'Mobile Safari Smoke Tests',
    'Mobile Safari Regression Tests',
    'API Tests',
  ];
}

let activeRun = null;
let lastRun = null;
const clients = new Set();
const logBuffer = [];

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function safeChildPath(base, requestedPath) {
  const resolved = path.resolve(base, `.${requestedPath}`);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

function listSpecs(directory = path.join(ROOT, 'tests')) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSpecs(absolutePath);
    if (!entry.name.endsWith('.spec.js')) return [];
    return [path.relative(ROOT, absolutePath).split(path.sep).join('/')];
  }).sort();
}

function listSpecDetails() {
  const specs = listSpecs();
  const specTags = {};
  const allTags = new Set();

  for (const specPath of specs) {
    const fullPath = path.join(ROOT, specPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const tags = [];
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        // Only inspect test titles and describe block headers
        if (/\b(?:test|describe)\b/i.test(line)) {
          const matches = line.match(/(?:^|[\s'",`])@([a-zA-Z][a-zA-Z0-9_-]*)/g) || [];
          for (const m of matches) {
            const tag = m.trim().replace(/^['",`]/, '').trim();
            if (tag.startsWith('@') && !tag.startsWith('@playwright') && !tag.includes('email') && !tag.includes('mail')) {
              tags.push(tag);
            }
          }
        }
      }
      const uniqueTags = Array.from(new Set(tags)).sort();
      specTags[specPath] = uniqueTags;
      uniqueTags.forEach((t) => allTags.add(t));
    } catch (e) {
      specTags[specPath] = [];
    }
  }

  return {
    specTags,
    availableTags: Array.from(allTags).sort(),
  };
}

function loadPlaywrightConfig() {
  try {
    const configPath = path.join(ROOT, 'playwright.config.js');
    if (!fs.existsSync(configPath)) return null;
    delete require.cache[require.resolve(configPath)];
    return require(configPath);
  } catch (err) {
    console.error('Lỗi khi đọc cấu hình playwright.config.js:', err.message);
    return null;
  }
}

function getPlaywrightProjects() {
  const config = loadPlaywrightConfig();
  if (!config || !Array.isArray(config.projects)) {
    return ['all'];
  }
  const projectNames = config.projects
    .map((p) => p.name)
    .filter((name) => name && name !== 'setup');
  return ['all', ...projectNames];
}

function matchGlobOrRegex(pattern, str) {
  if (!pattern) return true;
  if (pattern instanceof RegExp) return pattern.test(str);
  if (typeof pattern === 'string') {
    const segments = pattern.split('/').filter(Boolean).filter((p) => p !== '**' && p !== '*');
    return segments.every((segment) => {
      if (segment.endsWith('.spec.js')) return str.endsWith('.spec.js');
      return str.includes(segment);
    });
  }
  return true;
}

function projectsForSpec(spec) {
  const fullPath = path.join(ROOT, spec);
  if (!fs.existsSync(fullPath)) return [];
  
  const config = loadPlaywrightConfig();
  if (!config || !Array.isArray(config.projects)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const specRel = spec.split(path.sep).join('/');
  const specUnderTests = specRel.replace(/^tests\//, '');
  const matchedProjects = [];

  for (const proj of config.projects) {
    if (!proj.name || proj.name === 'setup') continue;

    // 1. Kiểm tra testMatch / testIgnore nếu có cấu hình trong project
    if (proj.testMatch && !matchGlobOrRegex(proj.testMatch, specRel) && !matchGlobOrRegex(proj.testMatch, specUnderTests)) {
      continue;
    }
    if (proj.testIgnore && (matchGlobOrRegex(proj.testIgnore, specRel) || matchGlobOrRegex(proj.testIgnore, specUnderTests))) {
      continue;
    }

    // 2. Kiểm tra bộ lọc grep nếu project có khai báo grep
    if (proj.grep) {
      const grepRegex = proj.grep instanceof RegExp ? proj.grep : new RegExp(proj.grep);
      if (!grepRegex.test(content)) continue;
    }

    // 3. Kiểm tra bộ lọc grepInvert nếu project có khai báo grepInvert
    if (proj.grepInvert) {
      const invertRegex = proj.grepInvert instanceof RegExp ? proj.grepInvert : new RegExp(proj.grepInvert);
      if (invertRegex.test(content)) continue;
    }

    matchedProjects.push(proj.name);
  }

  return matchedProjects;
}

function specProjects() {
  return Object.fromEntries(listSpecs().map((spec) => [spec, projectsForSpec(spec)]));
}

function listCodeFiles() {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      if (entry.isFile() && /\.(js|cjs|mjs|json)$/i.test(entry.name)) {
        files.push(path.relative(ROOT, absolutePath).split(path.sep).join('/'));
      }
    }
  };
  CODE_ROOTS.forEach((root) => visit(path.join(ROOT, root)));
  return files.sort();
}

function resolveCodeFile(filePath) {
  if (!listCodeFiles().includes(filePath)) return null;
  const absolutePath = path.resolve(ROOT, filePath);
  const validRoot = CODE_ROOTS.some((root) => absolutePath.startsWith(`${path.join(ROOT, root)}${path.sep}`));
  return validRoot ? absolutePath : null;
}

function listResources(isDev = false) {
  cleanupArtifacts();
  const documents = listDocumentResources(isDev);
  const dataDirectory = path.join(ROOT, 'data');
  const data = fs.existsSync(dataDirectory)
    ? fs.readdirSync(dataDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `data/${entry.name}`)
      .sort()
    : [];
  const evidence = [];
  const collectEvidence = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectEvidence(absolutePath);
      if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
        evidence.push({
          path: path.relative(EVIDENCE_DIR, absolutePath).split(path.sep).join('/'),
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  collectEvidence(EVIDENCE_DIR);
  evidence.sort((a, b) => b.modifiedAt - a.modifiedAt);

  const reports = [];
  const collectReports = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectReports(absolutePath);
      if (entry.isFile() && entry.name === 'index.html' && !absolutePath.includes(`${path.sep}workers${path.sep}`)) {
        reports.push({
          path: path.relative(REPORT_DIR, absolutePath).split(path.sep).join('/'),
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  collectReports(REPORT_DIR);
  reports.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return {
    documents,
    data,
    evidence: evidence.map((item) => item.path),
    evidenceDetails: evidence.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
    reports: reports.map((item) => item.path),
    reportDetails: reports.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
  };
}

function resolveResource(resourcePath, isDev = true) {
  const resources = listResources(isDev);
  const allowed = [...resources.documents, ...resources.data];
  if (!allowed.includes(resourcePath)) return null;
  const absolutePath = path.resolve(ROOT, resourcePath);
  return absolutePath.startsWith(`${ROOT}${path.sep}`) ? absolutePath : null;
}

function createBackup(resourcePath, absolutePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, timestamp, resourcePath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(absolutePath, backupPath);
  return path.relative(ROOT, backupPath).split(path.sep).join('/');
}

function deleteTestScript(specPath, rootDir = ROOT) {
  const value = String(specPath || '').replace(/\\/g, '/');
  if (path.isAbsolute(value) || value.includes('..') || !value.startsWith('tests/')) {
    throw new Error('Đường dẫn kịch bản phải thuộc thư mục tests/.');
  }
  if (!value.endsWith('.spec.js')) {
    throw new Error('Chỉ được xóa file kịch bản kiểm thử Playwright (*.spec.js).');
  }
  const fullPath = path.resolve(rootDir, value);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File kịch bản ${value} không tồn tại.`);
  }

  // Tao backup truoc khi xoa
  const backup = createBackup(value, fullPath);

  fs.unlinkSync(fullPath);
  return {
    success: true,
    spec: value,
    fileName: path.basename(value),
    backup,
    message: `Đã xóa kịch bản ${path.basename(value)} thành công.`,
  };
}

function removeInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget === resolvedBase || !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Cleanup target is outside the allowed artifact directory.');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: false });
}

function collectReportFolders() {
  if (!fs.existsSync(REPORT_DIR)) return [];
  const reports = [];
  const visit = (directory, depth = 0) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, depth + 1);
      if (entry.isFile() && entry.name === 'index.html' && !absolutePath.includes(`${path.sep}workers${path.sep}`)) {
        const reportFolder = path.dirname(absolutePath);
        const relativeParts = path.relative(REPORT_DIR, reportFolder).split(path.sep);
        const dateFolder = relativeParts.length >= 4 
          ? relativeParts.slice(0, 3).join('/')
          : relativeParts.slice(0, Math.max(1, relativeParts.length - 1)).join('/');
        reports.push({
          folder: reportFolder,
          dateFolder,
          modifiedAt: fs.statSync(absolutePath).mtimeMs,
        });
      }
    }
  };
  visit(REPORT_DIR);
  return reports;
}

function cleanupArtifacts() {
  const settings = getDashboardConfig().artifacts;
  const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;

  if (settings.autoCleanupEvidence && fs.existsSync(EVIDENCE_DIR)) {
    const evidenceFolders = new Set();
    const visitEvidence = (directory, depth = 0) => {
      if (depth > 10) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) visitEvidence(absolutePath, depth + 1);
        if (entry.isFile() && /\.(png|jpe?g|webp|webm)$/i.test(entry.name)) {
          evidenceFolders.add(directory);
        }
      }
    };
    visitEvidence(EVIDENCE_DIR);
    
    Array.from(evidenceFolders).forEach((target) => {
      if (fs.existsSync(target) && fs.statSync(target).mtimeMs < cutoff) {
        removeInside(EVIDENCE_DIR, target);
      }
    });

    for (const depth of [3, 2, 1, 0]) {
      const getParentDirs = (dir, currentDepth) => {
        if (!fs.existsSync(dir)) return [];
        if (currentDepth === depth) return [dir];
        let dirs = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) dirs = dirs.concat(getParentDirs(path.join(dir, entry.name), currentDepth + 1));
        }
        return dirs;
      };
      
      const parentDirs = getParentDirs(EVIDENCE_DIR, 0);
      parentDirs.forEach(parent => {
        if (!fs.existsSync(parent)) return;
        for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const targetDir = path.join(parent, entry.name);
          if (fs.readdirSync(targetDir).length === 0) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        }
      });
    }
  }

  if (settings.autoCleanupReports && fs.existsSync(REPORT_DIR)) {
    const reports = collectReportFolders();
    reports
      .filter((report) => report.modifiedAt < cutoff)
      .forEach((report) => removeInside(REPORT_DIR, report.folder));

    const remaining = collectReportFolders()
      .reduce((groups, report) => {
        groups[report.dateFolder] = groups[report.dateFolder] || [];
        groups[report.dateFolder].push(report);
        return groups;
      }, {});

    for (const reportsByDate of Object.values(remaining)) {
      reportsByDate
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .slice(settings.maxReportsPerDay)
        .forEach((report) => removeInside(REPORT_DIR, report.folder));
    }

    for (const entry of fs.readdirSync(REPORT_DIR, { withFileTypes: true })) {
      const dateFolder = path.join(REPORT_DIR, entry.name);
      if (entry.isDirectory() && fs.readdirSync(dateFolder).length === 0) fs.rmdirSync(dateFolder);
    }
  }
}

function countFolderArtifacts(directory) {
  const result = { files: 0, traceAndVideo: 0 };
  if (!fs.existsSync(directory)) return result;
  const visit = (current) => {
    try {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) visit(absolutePath);
        if (entry.isFile()) {
          result.files += 1;
          if (/\.(zip|trace|webm)$/i.test(entry.name)) result.traceAndVideo += 1;
        }
      }
    } catch {
      // Safe fallback if directory access is transiently restricted
    }
  };
  visit(directory);
  return result;
}

function readResourceBody(resourcePath, reveal = false, isDev = false) {
  const absolutePath = resolveResource(resourcePath, isDev);
  if (!absolutePath) return null;
  if (fs.statSync(absolutePath).size > 1_048_576) return { error: 'Resource lớn hơn giới hạn 1 MB.', status: 413 };
  const extension = path.extname(absolutePath).toLowerCase();
  const rawContent = fs.readFileSync(absolutePath, 'utf8');
  if (extension === '.json') {
    try {
      const parsed = JSON.parse(rawContent);
      const content = reveal ? parsed : maskSensitiveData(parsed);
      return { path: resourcePath, type: 'json', content: JSON.stringify(content, null, 2), masked: !reveal, editable: true, isProtected: false };
    } catch {
      return { error: 'File JSON không hợp lệ.', status: 422 };
    }
  }
  return { 
    path: resourcePath, 
    type: 'markdown', 
    content: rawContent, 
    masked: false, 
    editable: isDev, // Chỉ developer mới được edit
    isProtected: !isDev 
  };
}

function maskSensitiveData(value, key = '') {
  const sensitiveKey = /(password|passwd|secret|token|authorization|otp|pin|phone|email)/i.test(key);
  if (sensitiveKey && typeof value === 'string' && value) {
    if (value.length <= 4) return '••••';
    return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 2))}`;
  }
  if (Array.isArray(value)) return value.map((item) => maskSensitiveData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, maskSensitiveData(childValue, childKey)]));
  }
  return value;
}

function newestReport() {
  if (!fs.existsSync(REPORT_DIR)) return null;
  const indexes = [];
  const visit = (directory, depth = 0) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, depth + 1);
      if (entry.isFile() && entry.name === 'index.html') {
        indexes.push({ absolutePath, mtime: fs.statSync(absolutePath).mtimeMs });
      }
    }
  };
  visit(REPORT_DIR);
  return indexes.sort((a, b) => b.mtime - a.mtime)[0]?.absolutePath || null;
}

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
  const { child, ...serializable } = run;
  return serializable;
}

function parseBody(request, maxBytes = 32_768) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > maxBytes) reject(Object.assign(new Error('Request body quá lớn.'), { statusCode: 400 }));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(Object.assign(new Error('JSON không hợp lệ.'), { statusCode: 400 })); }
    });
    request.on('error', reject);
  });
}

function validateWizardDependencies(state) {
  const platform = state.platform || 'desktop';
  const pages = scanAllPageObjects(ROOT);
  const errors = [];
  for (const selected of Array.isArray(state.pageObjects) ? state.pageObjects : []) {
    const relativePath = typeof selected === 'string' ? selected : selected?.path || selected?.relativePath;
    const page = pages.find((item) => item.relativePath === relativePath);
    if (!page) { errors.push(`Page Object không tồn tại: ${relativePath || 'unknown'}.`); continue; }
    if (page.platform !== platform) errors.push(`Page Object ${relativePath} không tương thích platform ${platform}.`);
    if (!page.readiness?.ready) errors.push(`Page Object ${relativePath} chưa sẵn sàng.`);
  }
  for (const source of state.dataSources || []) {
    try {
      if (!source.dataPath || !String(source.dataPath).trim()) {
        errors.push(`Chưa chọn đường dẫn dữ liệu (dataPath) cho ${source.file || 'dataset'}.`);
        continue;
      }
      const dataset = readDataset(path.basename(source.file));
      let value = dataset.data;
      for (const segment of String(source.dataPath).split('.')) value = value?.[segment];
      if (value === undefined) errors.push(`dataPath không tồn tại: ${source.dataPath}.`);
    } catch (_) { errors.push(`Dataset không hợp lệ: ${source.file}.`); }
  }
  return errors;
}

function validateOptions(input) {
  const settings = getDashboardConfig();
  const environments = Object.keys(settings.environments);
  const allSpecs = listSpecs();
  const project = String(input.project || 'all');
  const environment = String(input.environment || settings.runtime.defaultEnvironment);
  const grep = String(input.grep || '').trim();
  const workers = Number(input.workers || settings.runtime.workers);
  const suiteLabel = typeof input.suiteLabel === 'string' ? input.suiteLabel.slice(0, 80) : '';

  let viewport = null;
  if (input.viewport && typeof input.viewport === 'object') {
    const width = Number(input.viewport.width);
    const height = Number(input.viewport.height);
    if (Number.isInteger(width) && width >= 320 && width <= 7680 && Number.isInteger(height) && height >= 320 && height <= 4320) {
      viewport = { width, height };
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
    projects = input.projects.map(String).filter((p) => getPlaywrightProjects().includes(p));
  } else if (input.project && input.project !== 'all') {
    if (getPlaywrightProjects().includes(input.project)) projects = [input.project];
  }

  // Nếu là composite suite chạy từ dashboard, nạp các project và specs từ child suites nếu chưa có
  if (input.suiteId && settings.suites?.[input.suiteId]) {
    const selectedSuite = settings.suites[input.suiteId];
    if (selectedSuite.type === 'composite' && Array.isArray(selectedSuite.suites)) {
      const compSpecs = [];
      const compProjects = [];
      for (const childId of selectedSuite.suites) {
        const child = settings.suites[childId];
        if (!child) continue;
        if (Array.isArray(child.specs) && child.specs.length > 0 && child.specs !== 'all') {
          compSpecs.push(...child.specs.filter((s) => allSpecs.includes(s)));
        } else if (child.spec && child.spec !== 'all' && allSpecs.includes(child.spec)) {
          compSpecs.push(child.spec);
        }
        if (child.project && child.project !== 'all' && getPlaywrightProjects().includes(child.project)) {
          compProjects.push(child.project);
        }
      }
      if (specs.length === 0 && compSpecs.length > 0) specs = [...new Set(compSpecs)];
      if (projects.length === 0 && compProjects.length > 0) projects = [...new Set(compProjects)];
    }
  }

  if (!getPlaywrightProjects().includes(project) && project !== 'all') throw new Error('Project không hợp lệ.');
  if (!environments.includes(environment)) throw new Error('Environment không hợp lệ.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('Luồng chạy phải từ 1 đến 8.');
  if (grep.length > 80 || /[\r\n\0]/.test(grep)) throw new Error('Tag/grep không hợp lệ.');

  const spec = specs.length === 1 ? specs[0] : (specs.length > 1 ? specs.join(' ') : 'all');
  return { project, projects, environment, spec, specs, grep, workers, headed: input.headed === true, viewport, suiteLabel };
}

function runtimeEnv(options) {
  const settings = getDashboardConfig();
  const runtime = settings.runtime;
  const api = settings.api;
  const retries = process.env.CI ? runtime.retriesCI : runtime.retriesLocal;
  const selectedSpec = String(options.spec || (Array.isArray(options.specs) && options.specs.length > 0 ? options.specs[0] : '') || '');
  const selectedProject = String(options.project || '');
  const platform = selectedSpec.startsWith('tests/e2e/mobile-web/') || selectedSpec.startsWith('tests/e2e/mobile/') || selectedSpec.includes('.mobile.') || /^Mobile (?:Chrome|Safari)/i.test(selectedProject)
    ? 'mobile-web'
    : selectedSpec.startsWith('tests/e2e/mobile-app/')
      ? 'mobile-app'
      : 'desktop';

  const vpWidth = options.viewport?.width || runtime.viewport.width;
  const vpHeight = options.viewport?.height || runtime.viewport.height;

  return {
    NODE_ENV: options.environment,
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

async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('Discord Webhook URL không hợp lệ.');
  }
  const parsedUrl = new URL(webhookUrl);
  if (parsedUrl.protocol !== 'https:' || !/(^|\.)discord(?:app)?\.com$/i.test(parsedUrl.hostname) || !parsedUrl.pathname.startsWith('/api/webhooks/')) {
    throw new Error('Discord Webhook URL không hợp lệ.');
  }
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          let errMsg = data;
          try {
            const parsed = JSON.parse(data);
            if (parsed.code === 50027 || parsed.message?.includes('Invalid Webhook Token')) {
              errMsg = 'Mã Webhook Token không hợp lệ. Vui lòng vào Discord (Edit Channel > Integrations > Webhooks) bấm "Copy Webhook URL" lại.';
            } else if (parsed.code === 10015 || parsed.message?.includes('Unknown Webhook')) {
              errMsg = 'Webhook này không tồn tại hoặc đã bị xóa trên Discord. Vui lòng tạo Webhook mới.';
            } else if (parsed.message) {
              errMsg = parsed.message;
            }
          } catch (e) {}
          reject(new Error(`Discord phản hồi (${res.statusCode}): ${errMsg}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendDiscordRunReport(runData) {
  const settings = getDashboardConfig();
  const discord = settings.discord;
  if (!discord?.webhookUrl || !discord.webhookUrl.startsWith('http')) return;
  if (!discord.notifyOnFinish) return;
  if (discord.notifyOnlyOnFailure && runData.status !== 'failed') return;

  const isPassed = runData.status === 'passed';
  const isFailed = runData.status === 'failed';

  const color = isPassed ? 0x22c55e : (isFailed ? 0xef4444 : 0xf59e0b);
  const statusEmoji = isPassed ? '🟢 PASSED' : (isFailed ? '🔴 FAILED' : '🟡 STOPPED');
  const durationSec = runData.finishedAt && runData.startedAt
    ? ((new Date(runData.finishedAt) - new Date(runData.startedAt)) / 1000).toFixed(1) + 's'
    : '—';

  const suiteName = runData.options?.suiteLabel || 'Tùy chỉnh (Thủ công)';
  const environment = runData.options?.environment || 'dev';
  const project = runData.options?.project || 'all';
  const vpWidth = runData.options?.viewport?.width || settings.runtime.viewport.width;
  const vpHeight = runData.options?.viewport?.height || settings.runtime.viewport.height;

  const projectName = settings.branding?.projectName || 'Việc Làm 24h';
  const embed = {
    title: `${isPassed ? '✅' : isFailed ? '❌' : '⚠️'} Automation Test Run: ${suiteName}`,
    color,
    description: `Kết quả thực thi tự động từ **${projectName} Automation Dashboard**.`,
    fields: [
      { name: '📊 Kết quả', value: `\`${statusEmoji}\``, inline: true },
      { name: '⏱️ Thời lượng', value: `\`${durationSec}\``, inline: true },
      { name: '🌐 Môi trường', value: `\`${environment.toUpperCase()}\``, inline: true },
      { name: '📱 Màn hình / Viewport', value: `\`${project}\` • \`${vpWidth}x${vpHeight}\``, inline: true },
      { name: '⚡ Luồng chạy (Workers)', value: `\`${runData.options?.workers || 2} workers\``, inline: true },
      { name: '🏷️ Tag / Grep', value: `\`${runData.options?.grep || 'None'}\``, inline: true },
    ],
    footer: {
      text: `${projectName} Automation • ${new Date().toLocaleString('vi-VN')}`,
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: `${projectName} QA Bot`,
    avatar_url: settings.branding?.logoUrl || '',
    embeds: [embed],
  };

  try {
    await sendDiscordWebhook(discord.webhookUrl, payload);
  } catch (err) {
    console.error('Lỗi khi gửi Discord notification:', err.message);
  }
}

function startRun(options, uiMode = false) {
  const args = ['test'];
  if (Array.isArray(options.specs) && options.specs.length > 0) {
    args.push(...options.specs);
  } else if (options.spec && options.spec !== 'all') {
    args.push(options.spec);
  }
  if (Array.isArray(options.projects) && options.projects.length > 0) {
    for (const proj of options.projects) {
      args.push(`--project=${proj}`);
    }
  } else if (options.project && options.project !== 'all') {
    args.push(`--project=${options.project}`);
  }
  if (options.grep) args.push('--grep', options.grep);
  if (uiMode) args.push('--ui');
  else if (options.headed) args.push('--headed');

  logBuffer.length = 0;
  const playwrightCli = require.resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [playwrightCli, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...runtimeEnv(options) },
    shell: false,
  });
  activeRun = {
    id: Date.now().toString(36),
    status: 'running',
    startedAt: new Date().toISOString(),
    mode: uiMode ? 'ui' : 'test',
    options,
    command: `npx playwright ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    child,
  };
  publish('status', publicRun(activeRun));

  const pipeOutput = (source, stream) => source.on('data', (chunk) => {
    publish('log', { stream, text: chunk.toString() });
  });
  pipeOutput(child.stdout, 'stdout');
  pipeOutput(child.stderr, 'stderr');

  child.on('error', (error) => publish('log', { stream: 'stderr', text: `${error.message}\n` }));
  child.on('close', (exitCode, signal) => {
    const report = newestReport();
    activeRun.status = signal ? 'stopped' : exitCode === 0 ? 'passed' : 'failed';
    activeRun.finishedAt = new Date().toISOString();
    activeRun.exitCode = exitCode;
    activeRun.reportAvailable = Boolean(report);
    lastRun = publicRun(activeRun);

    sendDiscordRunReport(activeRun).catch(() => {});

    activeRun = null;
    publish('status', lastRun);
  });
  return publicRun(activeRun);
}

function serveFile(response, filePath, cache = false) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: 'Không tìm thấy tài nguyên.' });
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.webm': 'video/webm', '.zip': 'application/zip', '.woff2': 'font/woff2',
  };
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/agent/')) {
    await agentRoutes(request, response, url);
    return;
  }
  const dashboardWrite = url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    && !(request.method === 'POST' && AGENT_SAFE_POST_ROUTES.has(url.pathname));
  if (dashboardWrite) {
    if (agentService.isRunning()) return sendJson(response, 409, { error: 'Agent đang làm việc. Hãy chờ hoặc dừng tác vụ trước khi thay đổi dữ liệu hay chạy test.' });
    pendingDashboardWrites += 1;
    let released = false;
    const release = () => { if (!released) { released = true; pendingDashboardWrites -= 1; } };
    response.once('finish', release);
    response.once('close', release);
  }

  if (request.method === 'GET' && url.pathname === '/api/config') {
    const settings = getDashboardConfig();
    const details = listSpecDetails();
    return sendJson(response, 200, {
      projects: getPlaywrightProjects(),
      environments: Object.keys(settings.environments),
      specs: details.specs || listSpecs(),
      specTags: details.specTags,
      availableTags: details.availableTags,
      specProjects: specProjects(),
      defaults: {
        environment: settings.runtime.defaultEnvironment,
        workers: settings.runtime.workers,
      },
      branding: publicDashboardConfig(settings).branding,
      suites: settings.suites || {},
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, {
      appName: APP_NAME,
      workspaceRoot: ROOT,
      port: PORT,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/system/version') {
    return sendJson(response, 200, {
      appName: APP_NAME,
      version: getCurrentVersion(),
      workspaceRoot: ROOT,
      engineDir: ENGINE_DIR,
      port: PORT,
      isEngineStandalone: ROOT === ENGINE_DIR,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/system/check-update') {
    try {
      const updateResult = await checkForUpdates();
      return sendJson(response, 200, updateResult);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/system/apply-update') {
    try {
      const result = applyUpdate();
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }

  // ==========================================
  // GIT SYNC & VERSION CONTROL ENDPOINTS
  // ==========================================
  if (request.method === 'GET' && url.pathname === '/api/git/status') {
    try {
      const status = gitSyncService.getGitStatus();
      return sendJson(response, 200, status);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/pull') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = gitSyncService.pullCode(body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/commit-push') {
    try {
      const body = await parseBody(request);
      const result = gitSyncService.commitAndPush(body);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/git/diff') {
    try {
      const file = url.searchParams.get('file');
      const diff = gitSyncService.getFileDiff(file);
      return sendJson(response, diff.ok ? 200 : 400, diff);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/quality-check') {
    try {
      const qg = gitSyncService.runFrameworkQualityGate();
      return sendJson(response, 200, qg);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/git/branches') {
    try {
      const result = gitSyncService.listBranches();
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/branch/checkout') {
    try {
      const body = await parseBody(request);
      const result = gitSyncService.checkoutBranch(body.branch, !!body.createNew);
      return sendJson(response, result.ok ? 200 : 400, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/settings') {
    return sendJson(response, 200, publicDashboardConfig());
  }
  if (request.method === 'POST' && url.pathname === '/api/remote-run') {
    try {
      const body = await parseBody(request);
      const env = parseEnvFile(DISCORD_BOT_ENV_PATH);
      const settings = getDashboardConfig();
      const remoteConfig = {
        environments: settings.environments,
        suites: settings.suites,
        github: {
          token: env.GITHUB_TOKEN,
          owner: env.GITHUB_OWNER || 'hadinhkms',
          repo: env.GITHUB_REPO || 'Automation_playwright_SV',
          workflow: env.GITHUB_WORKFLOW || 'discord-run-playwright.yml',
          ref: env.GITHUB_REF || 'main',
        },
      };
      Object.assign(remoteRunConfig, remoteConfig);
      const result = await remoteRunService.dispatch(body);
      return sendJson(response, 202, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/discord/test') {
    try {
      const body = await parseBody(request);
      const settings = getDashboardConfig();
      const webhookUrl = body.webhookUrl || settings.discord?.webhookUrl;
      if (!webhookUrl) throw new Error('Chưa cung cấp Discord Webhook URL.');

      const testEmbed = {
        title: '🧪 Kiểm Tra Kết Nối Discord Webhook Thành Công!',
        color: 0x3b82f6,
        description: `${settings.branding?.projectName || 'QA Automation'} Dashboard đã kết nối thành công tới kênh Discord này.\nBạn sẽ nhận được thông báo tự động mỗi khi có lượt chạy test!`,
        fields: [
          { name: '🖥️ Hệ thống', value: settings.branding?.projectName || 'QA Automation Studio', inline: true },
          { name: '⏰ Thời gian', value: new Date().toLocaleString('vi-VN'), inline: true },
        ],
        footer: { text: `${settings.branding?.projectName || 'QA Automation'} Bot` },
        timestamp: new Date().toISOString(),
      };

      await sendDiscordWebhook(webhookUrl, {
        username: `${settings.branding?.projectName || 'QA Automation'} Bot`,
        avatar_url: settings.branding?.logoUrl || undefined,
        embeds: [testEmbed],
      });

      return sendJson(response, 200, { success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công tới Discord!' });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể gửi tin nhắn Discord: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/discord-bot/config') {
    const exists = fs.existsSync(DISCORD_BOT_ENV_PATH);
    const env = exists ? parseEnvFile(DISCORD_BOT_ENV_PATH) : {};
    let currentGitBranch = 'main';
    try {
      const headPath = path.join(ROOT, '.git', 'HEAD');
      if (fs.existsSync(headPath)) {
        const headContent = fs.readFileSync(headPath, 'utf8').trim();
        const branchMatch = headContent.match(/ref:\s+refs\/heads\/(.+)/);
        if (branchMatch) currentGitBranch = branchMatch[1];
        else currentGitBranch = headContent.slice(0, 7);
      }
    } catch (e) {}

    return sendJson(response, 200, {
      exists,
      botDir: DISCORD_BOT_DIR,
      currentGitBranch,
      config: {
        discordToken: env.DISCORD_TOKEN ? `${env.DISCORD_TOKEN.slice(0, 10)}...${env.DISCORD_TOKEN.slice(-6)}` : '',
        hasDiscordToken: Boolean(env.DISCORD_TOKEN),
        allowedChannelId: env.ALLOWED_CHANNEL_ID || '',
        githubToken: env.GITHUB_TOKEN ? `${env.GITHUB_TOKEN.slice(0, 12)}...${env.GITHUB_TOKEN.slice(-4)}` : '',
        hasGithubToken: Boolean(env.GITHUB_TOKEN),
        githubOwner: env.GITHUB_OWNER || 'hadinhkms',
        githubRepo: env.GITHUB_REPO || 'Automation_playwright_SV',
        githubWorkflow: env.GITHUB_WORKFLOW || 'discord-run-playwright.yml',
        githubRef: env.GITHUB_REF || 'main',
      }
    });
  }
  if (request.method === 'PUT' && url.pathname === '/api/discord-bot/config') {
    try {
      const body = await parseBody(request);
      if (!fs.existsSync(DISCORD_BOT_DIR)) {
        throw new Error(`Thư mục Discord Bot không tồn tại: ${DISCORD_BOT_DIR}`);
      }
      const current = parseEnvFile(DISCORD_BOT_ENV_PATH);
      if (body.discordToken && !body.discordToken.includes('...')) current.DISCORD_TOKEN = body.discordToken.trim();
      if (body.githubToken && !body.githubToken.includes('...')) current.GITHUB_TOKEN = body.githubToken.trim();
      if (body.allowedChannelId !== undefined) current.ALLOWED_CHANNEL_ID = String(body.allowedChannelId).trim();
      if (body.githubOwner) current.GITHUB_OWNER = String(body.githubOwner).trim();
      if (body.githubRepo) current.GITHUB_REPO = String(body.githubRepo).trim();
      if (body.githubWorkflow) current.GITHUB_WORKFLOW = String(body.githubWorkflow).trim();
      if (body.githubRef) current.GITHUB_REF = String(body.githubRef).trim();

      writeEnvFile(DISCORD_BOT_ENV_PATH, current);
      return sendJson(response, 200, { message: 'Đã lưu cấu hình Discord QA Bot thành công!' });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu cấu hình Bot: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/ai/config') {
    const envPath = path.join(ROOT, '.env');
    const env = parseEnvFile(envPath);
    const activeKey = env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY || '';
    const provider = env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
    const model = env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    return sendJson(response, 200, {
      provider,
      baseURL: env.AI_BASE_URL || '',
      model,
      hasKey: Boolean(activeKey),
      maskedKey: activeKey ? `${activeKey.slice(0, 6)}...${activeKey.slice(-4)}` : '',
    });
  }
  if ((request.method === 'PUT' || request.method === 'POST') && url.pathname === '/api/ai/config') {
    try {
      const body = await parseBody(request);
      const envPath = path.join(ROOT, '.env');
      const current = parseEnvFile(envPath);
      if (body.provider) current.AI_PROVIDER = body.provider;
      if (body.baseURL !== undefined) {
        if (body.provider === 'gemini' && body.baseURL && !body.baseURL.includes('googleapis') && !body.baseURL.includes('gemini')) {
          current.AI_BASE_URL = '';
        } else {
          current.AI_BASE_URL = body.baseURL;
        }
      }
      if (body.model) {
        current.AI_MODEL = body.model;
        if (body.provider === 'gemini') current.DASHBOARD_GEMINI_MODEL = body.model;
      }
      if (body.apiKey && !body.apiKey.includes('...')) {
        current.AI_API_KEY = body.apiKey;
        if (body.provider === 'gemini') current.GEMINI_API_KEY = body.apiKey;
        else if (body.provider === 'openai') current.OPENAI_API_KEY = body.apiKey;
        else if (body.provider === 'deepseek') current.DEEPSEEK_API_KEY = body.apiKey;
      }
      writeEnvFile(envPath, current);
      try { require('dotenv').config({ path: envPath, override: true }); } catch {}
      return sendJson(response, 200, { message: 'Đã lưu cấu hình AI vào file .env thành công!' });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu cấu hình AI: ${error.message}` });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/ai/test-connection') {
    try {
      const body = await parseBody(request);
      let keyToTest = body.apiKey;
      if (!keyToTest || keyToTest.includes('...')) {
        const env = parseEnvFile(path.join(ROOT, '.env'));
        keyToTest = env.AI_API_KEY || (body.provider === 'gemini' ? env.GEMINI_API_KEY : body.provider === 'openai' ? env.OPENAI_API_KEY : body.provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.GEMINI_API_KEY);
      }
      const result = await agentService.testConnection({
        provider: body.provider,
        apiKey: keyToTest,
        baseURL: body.baseURL,
        model: body.model
      });
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message || 'Kiểm tra kết nối thất bại.' });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/ai/inline-suggest') {
    try {
      const body = await parseBody(request, 64 * 1024);
      let clientConfig = body.clientConfig || null;
      if (!clientConfig && request.headers['x-ai-config']) {
        try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
      }
      const result = await agentService.inlineSuggest({
        prefix: body.prefix,
        suffix: body.suffix,
        language: body.language,
        clientConfig,
        model: body.model,
      });
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 200, { success: false, suggestion: '', error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/git/sync') {
    try {
      const body = await parseBody(request).catch(() => ({}));
      const result = gitSyncService.syncSuitesAndConfigs(body);
      const statusCode = result.success ? 200 : (result.qualityGateFailed ? 400 : 500);
      return sendJson(response, statusCode, result);
    } catch (error) {
      return sendJson(response, 500, { ok: false, success: false, error: `Không thể đồng bộ lên GitHub: ${error.message}` });
    }
  }
  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    try {
      const body = await parseBody(request);
      const backup = createBackup('core/config/dashboardConfig.json', CONFIG_PATH);
      const saved = saveDashboardConfig(body);
      return sendJson(response, 200, { message: 'Đã lưu cấu hình.', backup, settings: publicDashboardConfig(saved) });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu cấu hình: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/resources') {
    const isDev = isDeveloperRequest(request);
    const resources = listResources(isDev);
    return sendJson(response, 200, {
      ...resources,
      isDeveloper: isDev,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/code-files') {
    return sendJson(response, 200, { files: listCodeFiles() });
  }
  if (request.method === 'GET' && url.pathname === '/api/code') {
    const filePath = url.searchParams.get('path') || '';
    const absolutePath = resolveCodeFile(filePath);
    if (!absolutePath) return sendJson(response, 404, { error: 'File mã nguồn không hợp lệ.' });
    if (fs.statSync(absolutePath).size > 1_048_576) return sendJson(response, 413, { error: 'File mã nguồn lớn hơn giới hạn 1 MB.' });
    return sendJson(response, 200, { path: filePath, content: fs.readFileSync(absolutePath, 'utf8'), editable: true });
  }
  if (request.method === 'PUT' && url.pathname === '/api/code') {
    try {
      const body = await parseBody(request);
      const filePath = String(body.path || '');
      const isDev = isDeveloperRequest(request);
      const isCoreFoundation = filePath === 'core/fixtures/baseTest.js' || filePath === 'core/fixtures/mobileWebTest.js';
      if (isCoreFoundation && !isDev) {
        return sendJson(response, 403, {
          error: `File '${filePath}' là Fixture nền tảng cốt lõi của framework, được bảo vệ chỉ đọc để tránh làm hỏng hệ thống kiểm thử. Để tạo hoặc mở rộng fixture nghiệp vụ, vui lòng sử dụng phân hệ 'Hạ tầng & Fixtures' hoặc tạo custom fixture trong 'core/fixtures/custom/'.`
        });
      }
      const absolutePath = resolveCodeFile(filePath);
      if (!absolutePath) return sendJson(response, 403, { error: 'File mã nguồn này không được phép chỉnh sửa.' });
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' });
      if (filePath.endsWith('.json')) JSON.parse(content);
      else new Function(content);
      const backup = createBackup(filePath, absolutePath);
      fs.writeFileSync(absolutePath, content, 'utf8');
      return sendJson(response, 200, { message: 'Đã lưu source file.', backup });
    } catch (error) {
      return sendJson(response, 400, { error: `Không thể lưu: ${error.message}` });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/resource') {
    const resourcePath = url.searchParams.get('path') || '';
    const isDev = isDeveloperRequest(request);
    const resource = readResourceBody(resourcePath, url.searchParams.get('reveal') === 'true', isDev);
    if (!resource) return sendJson(response, 404, { error: 'Resource không hợp lệ.' });
    if (resource.error) return sendJson(response, resource.status, { error: resource.error });
    return sendJson(response, 200, resource);
  }
  if (request.method === 'PUT' && url.pathname === '/api/resource') {
    try {
      const isDev = isDeveloperRequest(request);
      const body = await parseBody(request);
      const resourcePath = String(body.path || '');
      const absolutePath = resolveResource(resourcePath, isDev);
      const isUserData = resourcePath.startsWith('data/') && resourcePath.endsWith('.json');
      const isFrameworkDoc = resourcePath.endsWith('.md');
      
      if (!absolutePath) return sendJson(response, 404, { error: 'Resource không tồn tại.' });
      
      if (isFrameworkDoc && !isDev) {
        return sendJson(response, 403, { 
          error: 'Tài liệu chuẩn của framework được bảo vệ. Chỉ nhà phát triển (Developer) mới có quyền chỉnh sửa.' 
        });
      }
      
      if (!isUserData && !isFrameworkDoc) {
        return sendJson(response, 403, { error: 'Resource này không được phép chỉnh sửa.' });
      }
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' });
      if (resourcePath.endsWith('.json')) JSON.parse(content);
      const backup = createBackup(resourcePath, absolutePath);
      fs.writeFileSync(absolutePath, content, 'utf8');
      return sendJson(response, 200, { message: 'Đã lưu thay đổi.', backup });
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof SyntaxError ? 'JSON không hợp lệ.' : error.message });
    }
  }
  if (request.method === 'DELETE' && url.pathname === '/api/artifact') {
    try {
      const body = await parseBody(request);
      const artifactPath = String(body.path || '');
      const type = String(body.type || '');
      const resources = listResources();
      if (type === 'evidence' && resources.evidence.includes(artifactPath)) {
        const target = safeChildPath(EVIDENCE_DIR, `/${artifactPath}`);
        if (!target || !fs.statSync(target).isFile()) throw new Error('Evidence không hợp lệ.');
        fs.unlinkSync(target);
        return sendJson(response, 200, { message: 'Đã xóa evidence.' });
      }
      if (type === 'evidence-folder') {
        const normalizedFolder = artifactPath.replace(/^\/+|\/+$/g, '');
        const containsEvidence = normalizedFolder && resources.evidence.some((item) => item.startsWith(`${normalizedFolder}/`));
        const target = containsEvidence ? safeChildPath(EVIDENCE_DIR, `/${normalizedFolder}`) : null;
        if (!target || target === EVIDENCE_DIR || !target.startsWith(`${EVIDENCE_DIR}${path.sep}`) || !fs.statSync(target).isDirectory()) throw new Error('Folder evidence không hợp lệ.');
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        let parentDir = path.dirname(target);
        while (parentDir !== EVIDENCE_DIR && parentDir.startsWith(`${EVIDENCE_DIR}${path.sep}`)) {
          if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
            parentDir = path.dirname(parentDir);
          } else {
            break;
          }
        }
        return sendJson(response, 200, { message: 'Đã xóa folder evidence và toàn bộ ảnh bên trong.' });
      }
      if (type === 'report-folder') {
        const normalizedFolder = artifactPath.replace(/^\/+|\/+$/g, '');
        if (!normalizedFolder) throw new Error('Đường dẫn folder báo cáo không hợp lệ.');
        const containsReport = resources.reports.some((item) => item.startsWith(`${normalizedFolder}/`));
        const target = containsReport ? safeChildPath(REPORT_DIR, `/${normalizedFolder}`) : null;
        if (!target || target === REPORT_DIR || !target.startsWith(`${REPORT_DIR}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
          throw new Error('Folder báo cáo không hợp lệ.');
        }
        const deleted = countFolderArtifacts(target);
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        let parentDir = path.dirname(target);
        while (parentDir !== REPORT_DIR && parentDir.startsWith(`${REPORT_DIR}${path.sep}`)) {
          if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
            parentDir = path.dirname(parentDir);
          } else {
            break;
          }
        }
        return sendJson(response, 200, { message: `Đã xóa folder báo cáo (${deleted.files} file, ${deleted.traceAndVideo} trace/video).` });
      }
      if (type === 'report' && resources.reports.includes(artifactPath)) {
        const indexPath = safeChildPath(REPORT_DIR, `/${artifactPath}`);
        const reportFolder = indexPath ? path.dirname(indexPath) : null;
        const relativeFolder = reportFolder ? path.relative(REPORT_DIR, reportFolder) : '';
        if (!reportFolder || !reportFolder.startsWith(`${REPORT_DIR}${path.sep}`) || relativeFolder.split(path.sep).length < 2) throw new Error('Báo cáo không hợp lệ.');
        const deleted = countFolderArtifacts(reportFolder);
        fs.rmSync(reportFolder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        let parentDir = path.dirname(reportFolder);
        while (parentDir !== REPORT_DIR && parentDir.startsWith(`${REPORT_DIR}${path.sep}`)) {
          if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
            parentDir = path.dirname(parentDir);
          } else {
            break;
          }
        }
        return sendJson(response, 200, { message: `Đã xóa toàn bộ folder báo cáo (${deleted.files} file, ${deleted.traceAndVideo} trace/video).` });
      }
      return sendJson(response, 404, { error: 'Artifact không tồn tại hoặc không hợp lệ.' });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, { activeRun: publicRun(activeRun), lastRun, logs: logBuffer });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, {
      appName: APP_NAME,
      workspaceRoot: ROOT,
      port: currentPort,
      pid: process.pid,
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/run') {
    if (activeRun) return sendJson(response, 409, { error: 'Đang có một test run khác.' });
    try {
      const options = validateOptions(await parseBody(request));
      return sendJson(response, 202, startRun(options));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/ui') {
    if (activeRun) return sendJson(response, 409, { error: 'Đang có một test run hoặc UI Mode khác.' });
    try {
      const options = validateOptions(await parseBody(request));
      return sendJson(response, 202, startRun(options, true));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/stop') {
    if (!activeRun) return sendJson(response, 409, { error: 'Không có test run đang chạy.' });
    activeRun.child.kill('SIGTERM');
    return sendJson(response, 202, { message: 'Đã gửi yêu cầu dừng.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/shutdown') {
    sendJson(response, 200, { message: 'Đang tắt dashboard server...' });
    const stateFile = path.join(ROOT, '.dashboard-server.json');
    if (fs.existsSync(stateFile)) {
      try { fs.rmSync(stateFile, { force: true }); } catch (e) {}
    }
    setImmediate(shutdown);
    return;
  }
  // RECORDER API ENDPOINTS
  if (request.method === 'POST' && url.pathname === '/api/recorder/start') {
    try {
      const body = await parseBody(request);
      const activeConfig = getDashboardConfig();
      const defaultEnvKey = activeConfig.runtime?.defaultEnvironment || 'qc';
      const fallbackUrl = activeConfig.environments?.[defaultEnvKey]?.baseURL || 'https://example.com';
      const targetUrl = normalizeTargetUrl(body.url, fallbackUrl);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const device = (body.device || '').trim();
      const browser = (body.browser || 'chromium').trim();
      const viewport = body.viewport || (platform === 'desktop' ? '1920,1080' : '390,844');
      const loadStorage = (body.loadStorage || '').trim();
      const testIdAttribute = (body.testIdAttribute || '').trim();
      const forceRestart = body.force !== false;

      // Handle existing recording session
      if (activeRecorder) {
        if (!isProcessAlive(activeRecorder.child?.pid)) {
          console.warn(`[Recorder] Dọn dẹp phiên ghi cũ đã kết thúc (PID: ${activeRecorder.child?.pid}).`);
          activeRecorder = null;
        } else if (forceRestart) {
          console.log(`[Recorder] Buộc dừng phiên ghi cũ (PID: ${activeRecorder.child?.pid}) để khởi chạy phiên mới.`);
          killRecorderProcess(activeRecorder);
          activeRecorder = null;
          await new Promise((r) => setTimeout(r, 300));
        } else {
          return sendJson(response, 409, { error: 'Đang có một phiên ghi UI đang chạy.' });
        }
      }

      ensureRecordingsDir();
      const fileName = `rec_${Date.now()}.js`;
      const outputPath = path.join(RECORDINGS_DIR, fileName);

      const playwrightCli = require.resolve('@playwright/test/cli');
      const args = [
        playwrightCli,
        'codegen',
        targetUrl,
        '--target=playwright-test',
        `--output=${outputPath}`,
      ];

      if (browser && ['chromium', 'firefox', 'webkit', 'chrome'].includes(browser)) {
        args.push(`--browser=${browser}`);
      }
      if (device) {
        args.push(`--device=${device}`);
      } else if (viewport) {
        args.push(`--viewport-size=${viewport}`);
      }
      if (loadStorage && fs.existsSync(path.resolve(ROOT, loadStorage))) {
        args.push(`--load-storage=${path.resolve(ROOT, loadStorage)}`);
      }
      if (testIdAttribute) {
        args.push(`--test-id-attribute=${testIdAttribute}`);
      }

      const child = spawn(process.execPath, args, {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        shell: false,
        windowsHide: true,
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let earlyExitCode = null;

      child.stdout?.on('data', (chunk) => {
        stdoutBuffer = (stdoutBuffer + chunk.toString()).slice(-4000);
      });

      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuffer = (stderrBuffer + text).slice(-4000);
        console.warn('[Recorder Codegen stderr]', text.trim());
      });

      child.on('exit', (code) => {
        earlyExitCode = code;
        const finishedRecorder = activeRecorder;
        if (activeRecorder?.child === child) {
          activeRecorder = null;
        }
        publish('recorder_status', {
          isRecording: false,
          code,
          error: code !== 0 ? (stderrBuffer.trim() || `Playwright Codegen kết thúc với mã lỗi ${code}`) : undefined,
          fileName: finishedRecorder?.fileName,
          outputPath: finishedRecorder?.outputPath,
          recentRecordings: listRecentRecordings().slice(0, 15),
        });
      });

      child.on('error', (err) => {
        console.error('[Recorder Error]', err);
        if (activeRecorder?.child === child) {
          activeRecorder = null;
        }
        publish('recorder_status', {
          isRecording: false,
          error: err.message,
          recentRecordings: listRecentRecordings().slice(0, 15),
        });
      });

      // Wait 500ms grace period to verify child process launched cleanly
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (earlyExitCode !== null && earlyExitCode !== 0) {
        if (activeRecorder?.child === child) activeRecorder = null;
        return sendJson(response, 500, {
          error: `Không thể mở trình duyệt Playwright Codegen: ${stderrBuffer.trim() || 'Tiến trình kết thúc với mã lỗi ' + earlyExitCode}`,
        });
      }

      activeRecorder = {
        child,
        url: targetUrl,
        platform,
        device,
        browser,
        fileName,
        outputPath,
        startTime: new Date().toISOString(),
      };

      publish('recorder_status', {
        isRecording: true,
        url: activeRecorder.url,
        platform: activeRecorder.platform,
        device: activeRecorder.device,
        browser: activeRecorder.browser,
        fileName: activeRecorder.fileName,
        startTime: activeRecorder.startTime,
      });

      return sendJson(response, 200, {
        message: 'Đã khởi chạy Playwright Codegen thành công.',
        fileName,
        outputPath: `.tmp/recordings/${fileName}`,
        url: targetUrl,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/stop') {
    if (!activeRecorder) {
      return sendJson(response, 400, { error: 'Không có phiên ghi nào đang chạy.' });
    }
    const current = activeRecorder;
    killRecorderProcess(current);
    activeRecorder = null;
    publish('recorder_status', { isRecording: false, fileName: current.fileName, recentRecordings: listRecentRecordings().slice(0, 15) });

    await new Promise((r) => setTimeout(r, 400));

    let rawScript = '';
    if (fs.existsSync(current.outputPath)) {
      rawScript = fs.readFileSync(current.outputPath, 'utf8');
    }

    const parsed = parsePlaywrightScript(rawScript);

    return sendJson(response, 200, {
      message: 'Đã dừng phiên ghi.',
      fileName: current.fileName,
      rawScript,
      actionsCount: parsed.actionsCount,
      actions: parsed.actions,
      detectedUrl: parsed.detectedUrl || parsed.url,
      scenarioName: parsed.scenarioName,
      globalWarnings: parsed.globalWarnings || [],
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/reset') {
    if (activeRecorder) {
      killRecorderProcess(activeRecorder);
      activeRecorder = null;
    }
    publish('recorder_status', { isRecording: false, recentRecordings: listRecentRecordings().slice(0, 15) });
    return sendJson(response, 200, { message: 'Đã thiết lập lại trạng thái phiên ghi.' });
  }

  if (request.method === 'GET' && (url.pathname === '/api/recorder/status' || url.pathname === '/api/recorder/state')) {
    if (activeRecorder && !isProcessAlive(activeRecorder.child?.pid)) {
      activeRecorder = null;
    }
    return sendJson(response, 200, {
      isRecording: Boolean(activeRecorder),
      activeRecorder: activeRecorder
        ? {
            url: activeRecorder.url,
            platform: activeRecorder.platform,
            device: activeRecorder.device,
            browser: activeRecorder.browser,
            fileName: activeRecorder.fileName,
            startTime: activeRecorder.startTime,
          }
        : null,
      recentRecordings: listRecentRecordings().slice(0, 15),
    });
  }


  if (request.method === 'GET' && (url.pathname === '/api/recorder/file' || url.pathname === '/api/recorder/output')) {
    const fileName = path.basename(url.searchParams.get('name') || url.searchParams.get('file') || '');
    if (!fileName || !fileName.endsWith('.js')) {
      return sendJson(response, 400, { error: 'Tên file record không hợp lệ.' });
    }
    const filePath = path.join(RECORDINGS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return sendJson(response, 404, { error: 'Không tìm thấy file record.' });
    }
    const rawScript = fs.readFileSync(filePath, 'utf8');
    const parsed = parsePlaywrightScript(rawScript);
    return sendJson(response, 200, {
      fileName,
      rawScript,
      actionsCount: parsed.actionsCount,
      actions: parsed.actions,
      detectedUrl: parsed.detectedUrl || parsed.url,
      scenarioName: parsed.scenarioName,
      globalWarnings: parsed.globalWarnings || [],
    });
  }

  if ((request.method === 'POST' || request.method === 'DELETE') && url.pathname === '/api/recorder/delete') {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fileName = path.basename(body.fileName || url.searchParams.get('name') || url.searchParams.get('file') || '');
      if (!fileName || !fileName.endsWith('.js')) {
        return sendJson(response, 400, { error: 'Tên file bản ghi không hợp lệ.' });
      }
      const filePath = path.join(RECORDINGS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return sendJson(response, 200, {
        message: `Đã xóa bản ghi ${fileName}.`,
        recentRecordings: listRecentRecordings().slice(0, 15),
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/clear') {
    try {
      ensureRecordingsDir();
      const files = fs.readdirSync(RECORDINGS_DIR).filter((f) => f.endsWith('.js'));
      let deletedCount = 0;
      files.forEach((f) => {
        try {
          fs.unlinkSync(path.join(RECORDINGS_DIR, f));
          deletedCount++;
        } catch (e) {}
      });
      return sendJson(response, 200, {
        message: `Đã dọn dẹp ${deletedCount} bản ghi lịch sử.`,
        recentRecordings: [],
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/scan-pages') {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const pages = scanPages(platform, ROOT);
      return sendJson(response, 200, { platform, pages });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/convert' || url.pathname === '/api/recorder/generate-draft')) {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const rawScript = String(body.rawScript || '');
      const parsed = parsePlaywrightScript(rawScript);
      const actions = body.actions && Array.isArray(body.actions) && body.actions.length > 0 ? body.actions : parsed.actions;

      const isNewPage = body.isNewPage !== false;
      const pageClassName = body.pageClassName || 'CustomPage';
      const methodName = body.methodName || 'performRecordedActions';
      const featureName = (body.featureName || parsed.scenarioName || 'Recorded Feature').trim();
      const testName = (body.testName || `Người dùng thực hiện ${featureName}`).trim();
      const includeEvidence = body.includeEvidence !== false;

      let existingContent = '';
      let existingPagePath = '';

      if (!isNewPage && body.existingPagePath) {
        const resolved = path.resolve(ROOT, body.existingPagePath);
        if (resolved.startsWith(path.join(ROOT, 'pages', platform)) && fs.existsSync(resolved)) {
          existingContent = fs.readFileSync(resolved, 'utf8');
          existingPagePath = path.relative(ROOT, resolved).split(path.sep).join('/');
        }
      }

      const result = transformToPomAndSpec({
        platform,
        actions,
        isNewPage,
        pageClassName,
        baseClass: 'BasePage',
        existingPagePath,
        existingContent,
        methodName,
        featureName,
        testName,
        includeEvidence,
        url: parsed.detectedUrl || parsed.url || '',
      });

      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/save-draft' || url.pathname === '/api/recorder/save')) {
    try {
      const body = await parseBody(request);
      const { pomFile, specFile } = body;
      const saveResult = saveDraftFiles({
        ROOT,
        pomFile,
        specFile,
        createBackupFn: createBackup,
        execSyncFn: execSync,
      });
      return sendJson(response, 200, saveResult);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  // --- No-Code Test Data Studio APIs ---
  if (request.method === 'GET' && url.pathname === '/api/data/datasets') {
    try {
      return sendJson(response, 200, { datasets: listDatasets() });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/data/dataset') {
    const fileName = url.searchParams.get('file');
    if (!fileName) return sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
    try {
      const result = readDataset(fileName);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 404, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/data/dataset') {
    try {
      const body = await parseBody(request);
      const fileName = body.fileName;
      if (!fileName) return sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
      const result = saveDataset(fileName, body.data);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if ((request.method === 'DELETE' && url.pathname === '/api/data/dataset') || (request.method === 'POST' && url.pathname === '/api/data/delete-dataset')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fileName = body.fileName || body.file || body.name || url.searchParams.get('fileName') || url.searchParams.get('file') || url.searchParams.get('name');
      if (!fileName) return sendJson(response, 400, { error: 'Thiếu tên file dữ liệu cần xóa.' });
      const result = deleteDataset(fileName);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/data/create-dataset') {
    try {
      const body = await parseBody(request);
      const fileName = body.fileName;
      const templateType = body.templateType || 'array';
      if (!fileName) return sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
      const result = createDataset(fileName, templateType, body.content);
      return sendJson(response, 200, {
        success: true,
        message: `Đã tạo tệp dữ liệu ${result.fileName}`,
        ...result,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/data/export-csv') {
    const fileName = url.searchParams.get('file');
    if (!fileName) return sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
    try {
      const dataset = readDataset(fileName);
      if (!Array.isArray(dataset.data)) throw new Error('Chỉ có thể xuất CSV từ dataset dạng mảng.');
      const csv = jsonToCsv(dataset.data);
      response.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${dataset.fileName.replace(/"/g, '')}"`,
      });
      return response.end(`\uFEFF${csv}`);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/data/import-csv') {
    try {
      const body = await parseBody(request, 1024 * 1024 + 4096);
      const fileName = body.fileName;
      const csv = typeof body.csv === 'string' ? body.csv.replace(/^\uFEFF/, '') : '';
      if (!fileName || !csv) return sendJson(response, 400, { error: 'Thiếu tên file hoặc nội dung CSV.' });
      const rows = csvToJson(csv);
      if (rows.length === 0) throw new Error('CSV phải có tiêu đề và ít nhất một dòng dữ liệu.');
      const result = saveDataset(fileName, rows);
      return sendJson(response, 200, { ...result, importedRows: rows.length });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/data/dynamic-preview') {
    try {
      return sendJson(response, 200, {
        random_phone: generateDynamicValue('{{random_phone}}'),
        random_email: generateDynamicValue('{{random_email}}'),
        random_name: generateDynamicValue('{{random_name}}'),
        timestamp: generateDynamicValue('{{timestamp}}'),
        date: generateDynamicValue('{{date}}'),
      });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  // --- Visual Step Builder & BDD Studio APIs ---
  if (request.method === 'GET' && url.pathname === '/api/builder/scripts') {
    try {
      const scripts = scanAllProjectScripts(ROOT);
      return sendJson(response, 200, { scripts });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/generate-state') {
    try {
      const body = await parseBody(request, 64 * 1024);
      const result = await copilotService.generateState({ prompt: body.prompt, context: body.context });
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 422, { error: error.message, valid: false });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/diagnostics/analyze') {
    try {
      const body = await parseBody(request, 128 * 1024);
      return sendJson(response, 200, analyzeDiagnostics(body));
    } catch (error) {
      return sendJson(response, 422, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/builder/actions') {
    try {
      const presetActions = PRESET_ACTIONS.map(({ id, category, stepType, name, desc, fixture }) => ({
        id,
        category,
        stepType,
        name,
        desc,
        fixture,
      }));
      return sendJson(response, 200, { presetActions });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/compile') {
    try {
      const body = await parseBody(request);
      const isPreview = body.previewMode !== false;
      const dependencyErrors = isPreview ? [] : validateWizardDependencies(body);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, errors: dependencyErrors, warnings: [] });
      const compiled = compileVisualScenario(body, { previewMode: isPreview });
      if (!compiled.valid) return sendJson(response, 422, compiled);
      return sendJson(response, 200, compiled);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/validate-spec') {
    let tempPath = '';
    try {
      const body = await parseBody(request);
      const dependencyErrors = validateWizardDependencies(body);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, syntaxError: null, errors: dependencyErrors, warnings: [] });
      const compiled = compileVisualScenario(body);
      if (!compiled.valid) return sendJson(response, 422, { ...compiled, syntaxError: null });
      tempPath = path.join(ROOT, '.tmp', `wizard-validate-${process.pid}-${Date.now()}.spec.js`);
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, compiled.specCode, 'utf8');
      try {
        execSync(`node --check "${tempPath}"`, { cwd: ROOT, stdio: 'pipe', windowsHide: true });
        return sendJson(response, 200, { valid: true, syntaxError: null, errors: [], warnings: compiled.warnings, compiledHash: compiled.compiledHash, specRelativePath: compiled.specRelativePath });
      } catch (error) {
        return sendJson(response, 422, { valid: false, syntaxError: error.stderr?.toString() || error.message, errors: [{ code: 'syntax-error', message: 'Spec sinh ra có lỗi cú pháp.' }], warnings: compiled.warnings, compiledHash: compiled.compiledHash });
      }
    } catch (error) { return sendJson(response, 400, { valid: false, syntaxError: null, errors: [{ code: 'request-error', message: error.message }], warnings: [] }); }
    finally { if (tempPath) fs.rmSync(tempPath, { force: true }); }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/save') {
    try {
      const body = await parseBody(request);
      const dependencyErrors = validateWizardDependencies(body);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, errors: dependencyErrors, warnings: [] });
      const compiled = compileVisualScenario(body);
      if (!compiled.valid) return sendJson(response, 422, compiled);
      const fullPath = path.join(ROOT, compiled.specRelativePath);
      const specDir = path.dirname(fullPath);
      if (!fs.existsSync(specDir)) {
        fs.mkdirSync(specDir, { recursive: true });
      }
      let backup = null;
      if (fs.existsSync(fullPath)) {
        if (body.expectedHash && body.expectedHash !== hashText(fs.readFileSync(fullPath, 'utf8'))) {
          return sendJson(response, 409, { error: 'File đã thay đổi trên disk. Hãy tải lại trước khi lưu.' });
        }
        backup = createBackup(compiled.specRelativePath, fullPath);
      }
      const tempPath = `${fullPath}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, compiled.specCode, 'utf8');
      fs.renameSync(tempPath, fullPath);
      if (body.draftId) {
        cleanupDraft({ type: 'script', id: body.draftId, rootDir: ROOT });
      }
      return sendJson(response, 200, {
        success: true,
        message: 'Đã lưu kịch bản kiểm thử thành công',
        specPath: compiled.specRelativePath,
        backup,
        compiledHash: compiled.compiledHash,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/builder/load-spec') {
    const specFile = url.searchParams.get('file');
    if (!specFile) return sendJson(response, 400, { error: 'Thiếu file kịch bản.' });
    try {
      const parsed = parseExistingSpecFile(specFile, ROOT);
      return sendJson(response, 200, parsed);
    } catch (error) {
      return sendJson(response, 404, { error: error.message });
    }
  }

  if ((request.method === 'DELETE' || request.method === 'POST') && (url.pathname === '/api/builder/script' || url.pathname === '/api/builder/delete-script')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const spec = body.spec || body.specPath || body.path || body.file || url.searchParams.get('spec') || url.searchParams.get('specPath') || url.searchParams.get('path') || url.searchParams.get('file');
      if (!spec) return sendJson(response, 400, { error: 'Thiếu đường dẫn kịch bản cần xóa.' });
      const result = deleteTestScript(spec, ROOT);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/builder/page-content') {
    const pageFile = url.searchParams.get('file');
    if (!pageFile) return sendJson(response, 400, { error: 'Thiếu đường dẫn Page Object.' });
    const fullPath = safeChildPath(ROOT, pageFile.startsWith('/') ? pageFile : `/${pageFile}`);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return sendJson(response, 404, { error: 'Không tìm thấy file Page Object.' });
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return sendJson(response, 200, { path: pageFile, content });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/auto-capture') {
    try {
      const body = await parseBody(request);
      const specCode = String(body.specCode || '');
      const result = injectSmartEvidenceCaptures(specCode, { filePath: body.filePath });
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  // --- Draft Management APIs ---
  if (request.method === 'POST' && url.pathname === '/api/drafts/save') {
    try {
      const body = await parseBody(request);
      const { type, id, data } = body;
      if (!type || !['script', 'page'].includes(type)) {
        return sendJson(response, 400, { error: 'type phải là "script" hoặc "page"' });
      }
      const draft = saveDraft({ type, id, data, rootDir: ROOT });
      return sendJson(response, 200, { success: true, draft });
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi lưu bản nháp: ${err.message}` });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/drafts') {
    try {
      const type = url.searchParams.get('type') || 'script';
      const drafts = listDrafts({ type, rootDir: ROOT });
      return sendJson(response, 200, { success: true, drafts });
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi tải danh sách bản nháp: ${err.message}` });
    }
  }

  if (request.method === 'GET' && (url.pathname === '/api/drafts/get' || url.pathname === '/api/drafts/detail')) {
    try {
      const type = url.searchParams.get('type') || 'script';
      const id = url.searchParams.get('id');
      if (!id) return sendJson(response, 400, { error: 'Thiếu id bản nháp' });
      const draft = getDraft({ type, id, rootDir: ROOT });
      if (!draft) return sendJson(response, 404, { error: 'Không tìm thấy bản nháp' });
      return sendJson(response, 200, { success: true, draft });
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi lấy bản nháp: ${err.message}` });
    }
  }

  if ((request.method === 'DELETE' || request.method === 'POST') && (url.pathname === '/api/drafts/delete' || url.pathname === '/api/drafts/discard')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const type = body.type || url.searchParams.get('type') || 'script';
      const id = body.id || url.searchParams.get('id');
      if (!id) return sendJson(response, 400, { error: 'Thiếu id bản nháp cần xóa' });
      const result = deleteDraft({ type, id, rootDir: ROOT });
      return sendJson(response, 200, result);
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi xóa bản nháp: ${err.message}` });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/insert-step') {
    try {
      const body = await parseBody(request);
      const {
        scriptPath,
        pageFile,
        pageClassName,
        actionType, // 'method' | 'locator'
        actionName,
        actionParams,
        locatorInteraction = 'click', // 'click' | 'fill' | 'check' | 'visible'
        locatorValue,
        stepType = 'When',
        stepTitle,
        includeEvidence = true,
      } = body;

      if (!scriptPath) return sendJson(response, 400, { error: 'Thiếu đường dẫn kịch bản BDD (scriptPath).' });
      const fullPath = path.resolve(ROOT, scriptPath);
      if (!fs.existsSync(fullPath)) return sendJson(response, 404, { error: `Không tìm thấy file kịch bản: ${scriptPath}` });

      let content = fs.readFileSync(fullPath, 'utf8');

      // 1. Xác định tên class và fixture
      const cleanClassName = pageClassName || (pageFile ? path.basename(pageFile, '.js') : 'CustomPage');
      const fixtureName = cleanClassName.charAt(0).toLowerCase() + cleanClassName.slice(1);

      // 2. Tự động kiểm tra và thêm fixture vào test({ ... }) arguments nếu chưa có
      const testArgsMatch = content.match(/test\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*,\s*async\s*\(\s*\{([^}]*)\}\s*\)\s*=>/);
      if (testArgsMatch) {
        const currentArgs = testArgsMatch[1];
        const argTokens = currentArgs.split(',').map((t) => t.trim()).filter(Boolean);
        if (!argTokens.includes(fixtureName)) {
          const rawTrimEnd = currentArgs.replace(/\s+$/, '');
          const updatedArgs = `${rawTrimEnd}${rawTrimEnd.endsWith(',') ? '' : ','}\n    ${fixtureName},\n  `;
          content = content.replace(testArgsMatch[0], testArgsMatch[0].replace(currentArgs, updatedArgs));
        }
      }

      // 3. Sinh mã cho hành động bên trong bước BDD
      const actionLines = [];
      const safeStepTitle = (stepTitle || `Tôi thực hiện ${actionName}`).trim();
      const evidenceName = `${stepType.toLowerCase()}_${actionName}_completed`.replace(/[^a-zA-Z0-9_]/g, '_');

      if (actionType === 'locator') {
        const locVar = `${fixtureName}.${actionName}`;
        if (locatorInteraction === 'fill') {
          const val = locatorValue || "''";
          actionLines.push(`      await ${locVar}.fill(${JSON.stringify(val)});`);
        } else if (locatorInteraction === 'check') {
          actionLines.push(`      await ${locVar}.check();`);
        } else if (locatorInteraction === 'visible') {
          actionLines.push(`      await expect(${locVar}).toBeVisible();`);
        } else {
          actionLines.push(`      await ${locVar}.click();`);
        }
      } else {
        // Method nghiệp vụ
        const paramStr = (actionParams || '').trim();
        actionLines.push(`      await ${fixtureName}.${actionName}(${paramStr});`);
      }

      if (includeEvidence && locatorInteraction !== 'visible') {
        actionLines.push(`      await ${fixtureName}.capture('${evidenceName}');`);
      }

      const stepBlock = `\n    await test.step('${stepType} ${safeStepTitle}', async () => {\n${actionLines.join('\n')}\n    });\n`;

      // 4. Chèn khối step vào trước khi kết thúc test()
      const lastStepIndex = content.lastIndexOf('await test.step');
      if (lastStepIndex !== -1) {
        const afterLastStep = content.slice(lastStepIndex);
        const stepEndMatch = afterLastStep.match(/\n\s*\}\s*\);\s*(?=\n\s*(?:\}\s*\);|test\.after|\/\/|$))/);
        if (stepEndMatch) {
          const insertPos = lastStepIndex + stepEndMatch.index + stepEndMatch[0].length;
          content = content.slice(0, insertPos) + stepBlock + content.slice(insertPos);
        } else {
          const lastClose = content.lastIndexOf('});');
          if (lastClose !== -1) {
            content = content.slice(0, lastClose) + stepBlock + content.slice(lastClose);
          } else {
            content += stepBlock;
          }
        }
      } else {
        const lastClose = content.lastIndexOf('});');
        if (lastClose !== -1) {
          content = content.slice(0, lastClose) + stepBlock + content.slice(lastClose);
        } else {
          content += stepBlock;
        }
      }

      // 5. Kiểm tra cú pháp
      try {
        new Function(content);
      } catch (syntaxErr) {
        return sendJson(response, 400, { error: `Mã nguồn sau khi chèn bước có lỗi cú pháp JS: ${syntaxErr.message}` });
      }

      // 6. Tạo backup và lưu file
      const backup = createBackup(scriptPath, fullPath);
      fs.writeFileSync(fullPath, content, 'utf8');

      // 7. Parse lại file để trả về thông tin cập nhật
      const parsed = parseExistingSpecFile(scriptPath, ROOT);

      return sendJson(response, 200, {
        success: true,
        message: `Đã thêm bước "${stepType} ${safeStepTitle}" gọi ${cleanClassName}.${actionName}() thành công!`,
        script: parsed,
        backup,
      });
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi chèn bước BDD: ${err.message}` });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/create-script') {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      let rawName = (body.fileName || '').trim().replace(/\.spec\.js$/, '');
      if (!rawName) rawName = `scenario_${Date.now()}`;
      if (!rawName.endsWith('-bdd')) rawName += '-bdd';
      const fileName = `${rawName}.spec.js`;

      const relPath = `tests/e2e/${platform}/${fileName}`;
      const fullPath = path.resolve(ROOT, relPath);
      if (fs.existsSync(fullPath)) {
        return sendJson(response, 400, { error: `File kịch bản ${fileName} đã tồn tại trong ${platform}.` });
      }

      const featureName = (body.featureName || 'Tính năng kiểm thử').trim();
      const scenarioName = (body.scenarioName || 'Người dùng thực hiện quy trình kiểm thử').trim();
      const tags = (body.tags || '@e2e @custom').trim();
      const primaryPage = body.primaryPage;

      let fixtureName = 'homePage';
      if (primaryPage) {
        const pageClassName = path.basename(primaryPage, '.js');
        fixtureName = pageClassName.charAt(0).toLowerCase() + pageClassName.slice(1);
      }

      const fixtureRelPath = platform === 'mobile-web' ? '../../../core/fixtures/mobileWebTest' : '../../../core/fixtures/baseTest';

      const template = `const { test, expect } = require('${fixtureRelPath}');
 
test.describe('Feature: ${featureName} ${tags}', () => {
  test('${scenarioName}', async ({
    ${fixtureName},
  }, testInfo) => {
    test.setTimeout(180000);

    // Gắn tag Precondition hiển thị trên header của Playwright Report
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Môi trường sẵn sàng, khởi tạo kịch bản kiểm thử',
    });

    await test.step('Given Tiền điều kiện: Mở trang kiểm thử và chuẩn bị môi trường', async () => {
      await ${fixtureName}.capture('precondition_ready');
    });

    await test.step('When Người dùng thực hiện các bước kiểm thử', async () => {
      // Bổ sung các bước nghiệp vụ với ${fixtureName} tại đây
    });

    await test.step('Then Hệ thống phản hồi đúng kết quả mong đợi', async () => {
      // Bổ sung các assertion kiểm tra trạng thái
    });
  });
});
`;

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const finalContent = (typeof body.specCode === 'string' && body.specCode.trim()) ? body.specCode : template;
      fs.writeFileSync(fullPath, finalContent, 'utf8');

      const parsed = parseExistingSpecFile(relPath, ROOT);
      if (body.draftId) {
        cleanupDraft({ type: 'script', id: body.draftId, rootDir: ROOT });
      }
      return sendJson(response, 200, {
        success: true,
        message: `Đã tạo kịch bản BDD ${fileName} thành công!`,
        script: parsed,
      });
    } catch (err) {
      return sendJson(response, 500, { error: `Lỗi tạo kịch bản: ${err.message}` });
    }
  }

  // --- Centralized Object Repository & Core Capabilities APIs ---
  if (request.method === 'GET' && url.pathname === '/api/object-repository/pages') {
    try {
      const pages = scanAllPageObjects(ROOT);
      return sendJson(response, 200, { pages });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/object-repository/page') {
    const pageFile = url.searchParams.get('file');
    if (!pageFile) return sendJson(response, 400, { error: 'Thiếu file Page Object.' });
    try {
      const details = parsePageObject(pageFile, ROOT);
      return sendJson(response, 200, details);
    } catch (error) {
      return sendJson(response, 404, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/object-repository/update-locator') {
    try {
      const body = await parseBody(request);
      const result = updateLocatorSelector({
        pageRelativePath: body.pageRelativePath,
        locatorName: body.locatorName,
        newExpression: body.newExpression,
        rootDir: ROOT,
      });
      return sendJson(response, 200, {
        success: true,
        message: `Đã cập nhật selector cho phần tử "${body.locatorName}" thành công!`,
        affectedFiles: result.affectedFiles,
        impact: result.impact,
        ...result,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/object-repository/create-page') {
    try {
      const body = await parseBody(request);
      const result = createPageObject(body, ROOT);
      if (body.draftId) {
        cleanupDraft({ type: 'page', id: body.draftId, rootDir: ROOT });
      }
      return sendJson(response, 201, { ...result, message: `Đã tạo ${result.className}.js trong ${result.relativePath}` });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if ((request.method === 'DELETE' || request.method === 'POST') && (url.pathname === '/api/object-repository/page' || url.pathname === '/api/object-repository/delete-page')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const relativePath = body.relativePath || body.path || body.file || url.searchParams.get('relativePath') || url.searchParams.get('path') || url.searchParams.get('file') || (body.platform && body.name ? `pages/${body.platform}/${body.name}.js` : '');
      if (!relativePath) return sendJson(response, 400, { error: 'Thiếu đường dẫn Page Object cần xóa.' });
      const result = deletePageObject(relativePath, ROOT);
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/core/capabilities') {
    try {
      const capabilities = getCoreCapabilities(ROOT);
      return sendJson(response, 200, { capabilities });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  // --- Fixtures & Lifecycle Hooks Management APIs ---
  if (request.method === 'GET' && url.pathname === '/api/fixtures') {
    try {
      const fixtures = scanAllFixtures(ROOT);
      return sendJson(response, 200, { fixtures });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/fixtures/validate') {
    try {
      const body = await parseBody(request);
      const result = validateCustomFixtureSource({ ...body, rootDir: ROOT });
      if (!result.valid) {
        return sendJson(response, 400, result);
      }
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/fixtures') {
    try {
      const body = await parseBody(request);
      const result = createCustomFixture({ ...body, rootDir: ROOT });
      return sendJson(response, 201, result);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      if (!fixtureName || fixtureName === 'validate') {
        return sendJson(response, 400, { error: 'Tên fixture không hợp lệ.' });
      }
      const fixture = getFixtureByName(fixtureName, ROOT);
      if (!fixture) {
        return sendJson(response, 404, { error: `Không tìm thấy fixture '${fixtureName}'.` });
      }
      return sendJson(response, 200, fixture);
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      const body = await parseBody(request);
      const result = updateCustomFixture({
        name: fixtureName,
        sourceCode: body.sourceCode || body.rawCode,
        expectedRevision: body.expectedRevision,
        rootDir: ROOT,
      });
      return sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return sendJson(response, statusCode, { error: error.message, code: error.code });
    }
  }

  if ((request.method === 'DELETE' || request.method === 'POST') && url.pathname.startsWith('/api/fixtures/delete')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fixtureName = body.name || decodeURIComponent(url.pathname.slice('/api/fixtures/delete/'.length));
      if (!fixtureName) return sendJson(response, 400, { error: 'Thiếu tên fixture cần xóa.' });
      const result = deleteCustomFixture(fixtureName, ROOT, body.expectedRevision);
      return sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return sendJson(response, statusCode, { error: error.message, code: error.code });
    }
  }

  if (request.method === 'DELETE' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      const body = await parseBody(request).catch(() => ({}));
      const result = deleteCustomFixture(fixtureName, ROOT, body.expectedRevision);
      return sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return sendJson(response, statusCode, { error: error.message, code: error.code });
    }
  }

  if (request.method === 'GET' && url.pathname === '/report/latest') {
    const report = newestReport();
    if (!report) return sendJson(response, 404, { error: 'Chưa có Playwright report.' });
    const relative = path.relative(REPORT_DIR, report).split(path.sep).map(encodeURIComponent).join('/');
    response.writeHead(302, { Location: `/reports/${relative}` });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    const requested = decodeURIComponent(url.pathname.slice('/reports'.length));
    return serveFile(response, safeChildPath(REPORT_DIR, requested), true);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/evidence/')) {
    const requested = decodeURIComponent(url.pathname.slice('/evidence'.length));
    if (!/\.(png|jpe?g|webp)$/i.test(requested)) return sendJson(response, 404, { error: 'Evidence không hợp lệ.' });
    return serveFile(response, safeChildPath(EVIDENCE_DIR, requested), true);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/tools/')) {
    const requested = decodeURIComponent(url.pathname.slice('/tools'.length));
    return serveFile(response, safeChildPath(TOOLS_DIR, requested));
  }
  if (request.method === 'GET') {
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    return serveFile(response, safeChildPath(PUBLIC_DIR, requested));
  }
  sendJson(response, 404, { error: 'Endpoint không tồn tại.' });
});

let currentPort = PORT;
const maxPortAttempts = 20;
let portAttempts = 0;
const STATE_PATH = path.join(ROOT, '.dashboard-server.json');

function tryListen(port) {
  server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
  const actualPort = server.address().port;
  try {
    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify({ appName: APP_NAME, workspaceRoot: ROOT, port: actualPort, pid: process.pid }, null, 2) + '\n',
      'utf8'
    );
  } catch (e) {}
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
  if (activeRun?.child) activeRun.child.kill('SIGTERM');
  if (activeRecorder?.child) {
    killRecorderProcess(activeRecorder);
  }
  if (fs.existsSync(STATE_PATH)) {
    try { fs.rmSync(STATE_PATH, { force: true }); } catch (e) {}
  }
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
