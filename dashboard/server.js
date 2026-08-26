const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const BACKUP_DIR = path.join(ROOT, '.dashboard-backups');
const TOOLS_DIR = path.join(ROOT, 'tools');
const CODE_ROOTS = ['tests', 'pages', 'core'];
const PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4173', 10);
const PROJECTS = ['all', 'Smoke Tests', 'Regression Tests', 'API Tests'];
const ENVIRONMENTS = ['qc', 'stg', 'prod'];
const DOCUMENT_RESOURCES = ['AI_PROMPTS.md', 'QA_AI_RULES.md', 'README.md'];

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

function listResources() {
  const documents = DOCUMENT_RESOURCES.filter((file) => fs.existsSync(path.join(ROOT, file)));
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

function resolveResource(resourcePath) {
  const resources = listResources();
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

function countFolderArtifacts(directory) {
  const result = { files: 0, traceAndVideo: 0 };
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      if (entry.isFile()) {
        result.files += 1;
        if (/\.(zip|trace|webm)$/i.test(entry.name)) result.traceAndVideo += 1;
      }
    }
  };
  visit(directory);
  return result;
}

function readResourceBody(resourcePath, reveal = false) {
  const absolutePath = resolveResource(resourcePath);
  if (!absolutePath) return null;
  if (fs.statSync(absolutePath).size > 1_048_576) return { error: 'Resource lớn hơn giới hạn 1 MB.', status: 413 };
  const extension = path.extname(absolutePath).toLowerCase();
  const rawContent = fs.readFileSync(absolutePath, 'utf8');
  if (extension === '.json') {
    try {
      const parsed = JSON.parse(rawContent);
      const content = reveal ? parsed : maskSensitiveData(parsed);
      return { path: resourcePath, type: 'json', content: JSON.stringify(content, null, 2), masked: !reveal, editable: true };
    } catch {
      return { error: 'File JSON không hợp lệ.', status: 422 };
    }
  }
  return { path: resourcePath, type: 'markdown', content: rawContent, masked: false, editable: resourcePath === 'AI_PROMPTS.md' };
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
    if (depth > 3) return;
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

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32_768) reject(new Error('Request body quá lớn.'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSON không hợp lệ.')); }
    });
    request.on('error', reject);
  });
}

function validateOptions(input) {
  const specs = listSpecs();
  const project = String(input.project || 'all');
  const environment = String(input.environment || 'qc');
  const spec = String(input.spec || 'all');
  const grep = String(input.grep || '').trim();
  const workers = Number(input.workers || 2);

  if (!PROJECTS.includes(project)) throw new Error('Project không hợp lệ.');
  if (!ENVIRONMENTS.includes(environment)) throw new Error('Environment không hợp lệ.');
  if (spec !== 'all' && !specs.includes(spec)) throw new Error('Spec không hợp lệ.');
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('Workers phải từ 1 đến 8.');
  if (grep.length > 80 || /[\r\n\0]/.test(grep)) throw new Error('Tag/grep không hợp lệ.');

  return { project, environment, spec, grep, workers, headed: input.headed === true };
}

function startRun(options, uiMode = false) {
  const args = ['test'];
  if (options.spec !== 'all') args.push(options.spec);
  if (options.project !== 'all') args.push(`--project=${options.project}`);
  if (options.grep) args.push('--grep', options.grep);
  if (uiMode) args.push('--ui');
  else if (options.headed) args.push('--headed');

  logBuffer.length = 0;
  const playwrightCli = require.resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [playwrightCli, ...args], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: options.environment, PW_WORKERS: String(options.workers) },
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
    'Cache-Control': cache ? 'public, max-age=3600' : 'no-store',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/config') {
    return sendJson(response, 200, { projects: PROJECTS, environments: ENVIRONMENTS, specs: listSpecs() });
  }
  if (request.method === 'GET' && url.pathname === '/api/resources') {
    return sendJson(response, 200, listResources());
  }
  if (request.method === 'GET' && url.pathname === '/api/code-files') {
    return sendJson(response, 200, { files: listCodeFiles() });
  }
  if (request.method === 'GET' && url.pathname === '/api/code') {
    const filePath = url.searchParams.get('path') || '';
    const absolutePath = resolveCodeFile(filePath);
    if (!absolutePath) return sendJson(response, 404, { error: 'Source file không hợp lệ.' });
    if (fs.statSync(absolutePath).size > 1_048_576) return sendJson(response, 413, { error: 'Source file lớn hơn giới hạn 1 MB.' });
    return sendJson(response, 200, { path: filePath, content: fs.readFileSync(absolutePath, 'utf8'), editable: true });
  }
  if (request.method === 'PUT' && url.pathname === '/api/code') {
    try {
      const body = await parseBody(request);
      const filePath = String(body.path || '');
      const absolutePath = resolveCodeFile(filePath);
      if (!absolutePath) return sendJson(response, 403, { error: 'Source file này không được phép chỉnh sửa.' });
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
    const resource = readResourceBody(resourcePath, url.searchParams.get('reveal') === 'true');
    if (!resource) return sendJson(response, 404, { error: 'Resource không hợp lệ.' });
    if (resource.error) return sendJson(response, resource.status, { error: resource.error });
    return sendJson(response, 200, resource);
  }
  if (request.method === 'PUT' && url.pathname === '/api/resource') {
    try {
      const body = await parseBody(request);
      const resourcePath = String(body.path || '');
      const absolutePath = resolveResource(resourcePath);
      const editable = resourcePath === 'AI_PROMPTS.md' || resourcePath.startsWith('data/') && resourcePath.endsWith('.json');
      if (!absolutePath || !editable) return sendJson(response, 403, { error: 'Resource này không được phép chỉnh sửa.' });
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
        fs.rmSync(target, { recursive: true, force: false });
        return sendJson(response, 200, { message: 'Đã xóa folder evidence và toàn bộ ảnh bên trong.' });
      }
      if (type === 'report' && resources.reports.includes(artifactPath)) {
        const indexPath = safeChildPath(REPORT_DIR, `/${artifactPath}`);
        const reportFolder = indexPath ? path.dirname(indexPath) : null;
        const relativeFolder = reportFolder ? path.relative(REPORT_DIR, reportFolder) : '';
        if (!reportFolder || !reportFolder.startsWith(`${REPORT_DIR}${path.sep}`) || relativeFolder.split(path.sep).length < 2) throw new Error('Report không hợp lệ.');
        const deleted = countFolderArtifacts(reportFolder);
        const dateFolder = path.dirname(reportFolder);
        fs.rmSync(reportFolder, { recursive: true, force: false });
        if (dateFolder !== REPORT_DIR && fs.existsSync(dateFolder) && fs.readdirSync(dateFolder).length === 0) fs.rmdirSync(dateFolder);
        return sendJson(response, 200, { message: `Đã xóa toàn bộ folder report (${deleted.files} file, ${deleted.traceAndVideo} trace/video).` });
      }
      return sendJson(response, 404, { error: 'Artifact không tồn tại hoặc không hợp lệ.' });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, { activeRun: publicRun(activeRun), lastRun, logs: logBuffer });
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
    sendJson(response, 200, { message: 'Dashboard đang tắt.' });
    setImmediate(shutdown);
    return;
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

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Dashboard đã chạy tại http://127.0.0.1:${PORT}`);
    console.error('Hãy dùng cửa sổ dashboard hiện tại hoặc dừng process cũ trước khi chạy lại.');
    process.exitCode = 1;
    return;
  }
  console.error(`Không thể khởi động dashboard: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Playwright Dashboard: http://127.0.0.1:${PORT}`);
});

function shutdown() {
  if (activeRun) activeRun.child.kill('SIGTERM');
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
