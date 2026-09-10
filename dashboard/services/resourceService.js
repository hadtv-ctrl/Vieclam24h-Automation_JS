/**
 * dashboard/services/resourceService.js
 * Manages test resources, document files, report artifacts, and sensitive data masking.
 */
const fs = require('fs');
const path = require('path');
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

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

function isDeveloperRequest(request) {
  if (process.env.FRAMEWORK_DEV_MODE === 'true' || process.env.FRAMEWORK_DEV_MODE === '1') return true;
  const headerMode = request?.headers ? request.headers['x-developer-mode'] : null;
  const token = request?.headers ? request.headers['x-developer-token'] : null;
  const expectedToken = process.env.FRAMEWORK_DEV_TOKEN || 'lead_developer';
  return headerMode === 'true' && (!process.env.FRAMEWORK_DEV_TOKEN || token === expectedToken);
}

function listDocumentResources(isDev = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const docs = isDev ? [...PUBLIC_DOCUMENTS, ...DEV_DOCUMENTS] : PUBLIC_DOCUMENTS;
  return docs.filter((f) => fs.existsSync(path.join(root, f))).sort();
}

function listResources(isDev = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const documents = listDocumentResources(isDev, root);
  const dataDir = path.join(root, 'data');
  const data = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => `data/${e.name}`).sort()
    : [];

  const evidenceDir = path.join(root, 'evidence');
  const evidence = [];
  if (fs.existsSync(evidenceDir)) {
    const collectEvidence = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectEvidence(full);
        else if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
          evidence.push({ path: path.relative(evidenceDir, full).split(path.sep).join('/'), modifiedAt: fs.statSync(full).mtimeMs });
        }
      }
    };
    collectEvidence(evidenceDir);
    evidence.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  const reportDir = path.join(root, 'playwright-report');
  const reports = [];
  if (fs.existsSync(reportDir)) {
    const collectReports = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectReports(full);
        else if (entry.isFile() && entry.name === 'index.html' && !full.includes(`${path.sep}workers${path.sep}`)) {
          reports.push({ path: path.relative(reportDir, full).split(path.sep).join('/'), modifiedAt: fs.statSync(full).mtimeMs });
        }
      }
    };
    collectReports(reportDir);
    reports.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  return {
    documents,
    data,
    evidence: evidence.map((item) => item.path),
    evidenceDetails: evidence.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
    reports: reports.map((item) => item.path),
    reportDetails: reports.map((item) => ({ path: item.path, modifiedAt: new Date(item.modifiedAt).toISOString() })),
  };
}

function resolveResource(resourcePath, isDev = true, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const resources = listResources(isDev, root);
  const allowed = [...resources.documents, ...resources.data];
  if (!allowed.includes(resourcePath)) return null;
  const absolutePath = path.resolve(root, resourcePath);
  return absolutePath.startsWith(`${root}${path.sep}`) ? absolutePath : null;
}

function createBackup(resourcePath, absolutePath, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, '.dashboard-backups', timestamp, resourcePath);
  fs.mkdirSync(path.dirname(backupDir), { recursive: true });
  fs.copyFileSync(absolutePath, backupDir);
  return path.relative(root, backupDir).split(path.sep).join('/');
}

function deleteTestScript(specPath, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const value = String(specPath || '').replace(/\\/g, '/');
  if (path.isAbsolute(value) || value.includes('..') || !value.startsWith('tests/')) {
    throw new Error('Đường dẫn kịch bản phải thuộc thư mục tests/.');
  }
  if (!value.endsWith('.spec.js')) throw new Error('Chỉ được xóa file kịch bản kiểm thử Playwright (*.spec.js).');
  const fullPath = path.resolve(root, value);
  if (!fs.existsSync(fullPath)) throw new Error(`File kịch bản ${value} không tồn tại.`);
  const backup = createBackup(value, fullPath, root);
  fs.unlinkSync(fullPath);
  return { success: true, spec: value, fileName: path.basename(value), backup, message: `Đã xóa kịch bản ${path.basename(value)} thành công.` };
}

function maskSensitiveData(value, key = '') {
  const sensitive = /(password|passwd|secret|token|authorization|otp|pin|phone|email)/i.test(key);
  if (sensitive && typeof value === 'string' && value) {
    if (value.length <= 4) return '••••';
    return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 2))}`;
  }
  if (Array.isArray(value)) return value.map((item) => maskSensitiveData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskSensitiveData(v, k)]));
  }
  return value;
}

function readResourceBody(resourcePath, reveal = false, isDev = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const absolutePath = resolveResource(resourcePath, isDev, root);
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
  return { path: resourcePath, type: 'markdown', content: rawContent, masked: false, editable: isDev, isProtected: !isDev };
}

function newestReport(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const reportDir = path.join(root, 'playwright-report');
  if (!fs.existsSync(reportDir)) return null;
  const indexes = [];
  const visit = (dir, depth = 0) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile() && entry.name === 'index.html') {
        indexes.push({ absolutePath: full, mtime: fs.statSync(full).mtimeMs });
      }
    }
  };
  visit(reportDir);
  return indexes.sort((a, b) => b.mtime - a.mtime)[0]?.absolutePath || null;
}

module.exports = {
  PUBLIC_DOCUMENTS,
  DEV_DOCUMENTS,
  isDeveloperRequest,
  listDocumentResources,
  listResources,
  resolveResource,
  createBackup,
  deleteTestScript,
  maskSensitiveData,
  readResourceBody,
  newestReport
};
