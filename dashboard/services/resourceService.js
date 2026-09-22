// master-process-disable-size-check: Legacy module, queued for modular decomposition
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

/**
 * Tài liệu RIÊNG của dự án, tự phát hiện bằng cách quét thư mục cấu hình (mặc định `docs/`).
 *
 * Trước đây muốn thêm một tài liệu thì phải sửa PUBLIC_DOCUMENTS ở đây VÀ DOCS_METADATA
 * trong dashboard/public/app.js. Cả hai file đều thuộc `dashboard/` — vùng sync ghi đè
 * toàn bộ, không có exclude nào — nên chỉnh sửa của dự án sẽ biến mất ở lần đồng bộ kế
 * tiếp. Quét thư mục thì dự án chỉ cần thả file .md vào là xong, không đụng code Hub.
 */
const MAX_DOC_SCAN_DEPTH = 4;
const MAX_PROJECT_DOCS = 200;

function projectDocsDir(root) {
  try {
    const config = getDashboardConfig(root);
    return (config && config.docs && config.docs.dir) || 'docs';
  } catch (_) {
    return 'docs';
  }
}

/** Quét đệ quy `.md` trong thư mục tài liệu của dự án. Trả đường dẫn tương đối, dấu `/`. */
function scanProjectDocuments(root, dir) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];

  const found = [];
  const walk = (current, depth) => {
    if (depth > MAX_DOC_SCAN_DEPTH || found.length >= MAX_PROJECT_DOCS) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (found.length >= MAX_PROJECT_DOCS) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        found.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(base, 0);
  return found.sort();
}

/**
 * Tiêu đề lấy từ CHÍNH tài liệu: frontmatter `title:` trước, rồi tới `# ` đầu tiên, cuối
 * cùng mới tới tên file. Đọc từ tài liệu nghĩa là đổi tiêu đề chỉ cần sửa tài liệu — không
 * ai phải nhớ cập nhật một bảng ánh xạ ở nơi khác, và bảng đó không thể lệch được nữa.
 */
function readDocumentTitle(root, relPath) {
  try {
    const full = path.join(root, relPath);
    const fd = fs.openSync(full, 'r');
    const buffer = Buffer.alloc(4096);
    const read = fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);
    const head = buffer.slice(0, read).toString('utf8').replace(/^﻿/, '');
    const lines = head.split(/\r?\n/);

    if (lines[0] === '---') {
      const close = lines.indexOf('---', 1);
      if (close > 0) {
        for (const line of lines.slice(1, close)) {
          const m = line.match(/^title\s*:\s*(.+)$/i);
          if (m) return m[1].trim().replace(/^["']|["']$/g, '').slice(0, 160);
        }
      }
    }
    for (const line of lines) {
      const m = line.match(/^#\s+(.+)$/);
      if (m) return m[1].trim().replace(/[*`]/g, '').slice(0, 160);
    }
  } catch (_) { /* file không đọc được thì rơi về tên file */ }
  return null;
}

/**
 * Siêu dữ liệu cho danh sách tài liệu, gửi kèm /api/resources.
 * Chỉ trả những gì suy được từ repo; phần trình bày (icon, nhóm) do client quyết định.
 */
function describeDocuments(paths, root) {
  const projectDir = `${projectDocsDir(root)}/`;
  const out = {};
  for (const relPath of paths) {
    const title = readDocumentTitle(root, relPath);
    out[relPath] = {
      title: title || relPath.split('/').pop(),
      // Tài liệu nằm trong thư mục của dự án được tách nhóm riêng, để không lẫn vào
      // tài liệu khung của Hub.
      isProject: relPath.startsWith(projectDir),
    };
  }
  return out;
}

function isDeveloperRequest(request) {
  if (process.env.FRAMEWORK_DEV_MODE === 'true' || process.env.FRAMEWORK_DEV_MODE === '1') return true;
  const headerMode = request?.headers ? request.headers['x-developer-mode'] : null;
  const token = request?.headers ? request.headers['x-developer-token'] : null;
  const expectedToken = process.env.FRAMEWORK_DEV_TOKEN || 'lead_developer';
  return headerMode === 'true' && (!process.env.FRAMEWORK_DEV_TOKEN || token === expectedToken);
}

function listDocumentResources(isDev = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const curated = isDev ? [...PUBLIC_DOCUMENTS, ...DEV_DOCUMENTS] : PUBLIC_DOCUMENTS;
  const discovered = scanProjectDocuments(root, projectDocsDir(root));
  // Giữ thứ tự ổn định và loại trùng: một tài liệu vừa được Hub liệt kê vừa nằm trong
  // thư mục dự án (vd. docs/SETUP_GUIDE.md) chỉ được xuất hiện một lần.
  const all = [...new Set([...curated, ...discovered])];
  return all.filter((f) => fs.existsSync(path.join(root, f))).sort();
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
    // Tiêu đề được rút từ chính tài liệu. Giữ `documents` là mảng chuỗi để không phá
    // hợp đồng sẵn có của /api/resources; phần mô tả đi thành trường riêng.
    documentMeta: describeDocuments(documents, root),
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
  scanProjectDocuments,
  projectDocsDir,
  readDocumentTitle,
  describeDocuments,
  listResources,
  resolveResource,
  createBackup,
  deleteTestScript,
  maskSensitiveData,
  readResourceBody,
  newestReport
};
