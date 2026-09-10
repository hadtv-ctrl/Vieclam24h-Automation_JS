/**
 * dashboard/routes/resourceRoutes.js
 * Handles Resource Explorer, Code Editor, Artifact Deletion, and Report/Evidence Serving.
 */
const fs = require('fs');
const path = require('path');
const {
  listResources, isDeveloperRequest, readResourceBody,
  resolveResource, createBackup, newestReport,
} = require('../services/resourceService');
const { sendJson, parseBody, safeChildPath } = require('./routeUtils');

const CODE_ROOTS = ['tests', 'pages', 'core'];

function listCodeFiles(root) {
  const files = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.isFile() && /\.(js|cjs|mjs|json)$/i.test(e.name)) files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  CODE_ROOTS.forEach((r) => visit(path.join(root, r)));
  return files.sort();
}

function resolveCodeFile(filePath, root) {
  if (!listCodeFiles(root).includes(filePath)) return null;
  const abs = path.resolve(root, filePath);
  return CODE_ROOTS.some((r) => abs.startsWith(`${path.join(root, r)}${path.sep}`)) ? abs : null;
}

function countFolderArtifacts(dir) {
  const res = { files: 0, traceAndVideo: 0 };
  if (!fs.existsSync(dir)) return res;
  const visit = (cur) => {
    try {
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, e.name);
        if (e.isDirectory()) visit(full);
        else if (e.isFile()) { res.files++; if (/\.(zip|trace|webm)$/i.test(e.name)) res.traceAndVideo++; }
      }
    } catch {}
  };
  visit(dir);
  return res;
}

function serveFile(response, filePath, cache = false) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendJson(response, 404, { error: 'Không tìm thấy tài nguyên.' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.webm': 'video/webm', '.zip': 'application/zip', '.woff2': 'font/woff2',
  };
  response.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': cache ? 'public, max-age=31536000' : 'no-store, no-cache, must-revalidate, max-age=0',
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleResourceRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const reportDir = path.join(root, 'playwright-report');
  const evidenceDir = path.join(root, 'evidence');
  const toolsDir = path.join(root, 'tools');

  if (request.method === 'GET' && url.pathname === '/api/resources') {
    const isDev = isDeveloperRequest(request);
    sendJson(response, 200, { ...listResources(isDev, root), isDeveloper: isDev });
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/code-files') {
    sendJson(response, 200, { files: listCodeFiles(root) });
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/code') {
    const filePath = url.searchParams.get('path') || '';
    const abs = resolveCodeFile(filePath, root);
    if (!abs) return sendJson(response, 404, { error: 'File mã nguồn không hợp lệ.' }) || true;
    if (fs.statSync(abs).size > 1_048_576) return sendJson(response, 413, { error: 'File mã nguồn lớn hơn giới hạn 1 MB.' }) || true;
    sendJson(response, 200, { path: filePath, content: fs.readFileSync(abs, 'utf8'), editable: true });
    return true;
  }
  if (request.method === 'PUT' && url.pathname === '/api/code') {
    try {
      const body = await parseBody(request);
      const filePath = String(body.path || '');
      const isDev = isDeveloperRequest(request);
      if ((filePath === 'core/fixtures/baseTest.js' || filePath === 'core/fixtures/mobileWebTest.js') && !isDev) {
        return sendJson(response, 403, { error: `File '${filePath}' là Fixture nền tảng cốt lõi của framework, được bảo vệ chỉ đọc.` }) || true;
      }
      const abs = resolveCodeFile(filePath, root);
      if (!abs) return sendJson(response, 403, { error: 'File mã nguồn này không được phép chỉnh sửa.' }) || true;
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      if (filePath.endsWith('.json')) JSON.parse(content); else new Function(content);
      const backup = createBackup(filePath, abs, root);
      fs.writeFileSync(abs, content, 'utf8');
      sendJson(response, 200, { message: 'Đã lưu source file.', backup });
    } catch (e) { sendJson(response, 400, { error: `Không thể lưu: ${e.message}` }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/resource') {
    const isDev = isDeveloperRequest(request);
    const res = readResourceBody(url.searchParams.get('path') || '', url.searchParams.get('reveal') === 'true', isDev, root);
    if (!res) return sendJson(response, 404, { error: 'Resource không hợp lệ.' }) || true;
    if (res.error) return sendJson(response, res.status, { error: res.error }) || true;
    sendJson(response, 200, res);
    return true;
  }
  if (request.method === 'PUT' && url.pathname === '/api/resource') {
    try {
      const isDev = isDeveloperRequest(request);
      const body = await parseBody(request);
      const resPath = String(body.path || '');
      const abs = resolveResource(resPath, isDev, root);
      if (!abs) return sendJson(response, 404, { error: 'Resource không tồn tại.' }) || true;
      if (resPath.endsWith('.md') && !isDev) return sendJson(response, 403, { error: 'Tài liệu chuẩn của framework được bảo vệ. Chỉ nhà phát triển mới có quyền chỉnh sửa.' }) || true;
      if (!resPath.startsWith('data/') && !resPath.endsWith('.md')) return sendJson(response, 403, { error: 'Resource này không được phép chỉnh sửa.' }) || true;
      const content = String(body.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 1_048_576) return sendJson(response, 413, { error: 'Nội dung lớn hơn giới hạn 1 MB.' }) || true;
      if (resPath.endsWith('.json')) JSON.parse(content);
      const backup = createBackup(resPath, abs, root);
      fs.writeFileSync(abs, content, 'utf8');
      sendJson(response, 200, { message: 'Đã lưu thay đổi.', backup });
    } catch (e) { sendJson(response, 400, { error: e instanceof SyntaxError ? 'JSON không hợp lệ.' : e.message }); }
    return true;
  }
  if (request.method === 'DELETE' && url.pathname === '/api/artifact') {
    return handleDeleteArtifact(request, response, root, reportDir, evidenceDir);
  }
  if (request.method === 'GET' && url.pathname === '/report/latest') {
    const report = newestReport(root);
    if (!report) return sendJson(response, 404, { error: 'Chưa có Playwright report.' }) || true;
    const rel = path.relative(reportDir, report).split(path.sep).map(encodeURIComponent).join('/');
    response.writeHead(302, { Location: `/reports/${rel}` });
    response.end();
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    serveFile(response, safeChildPath(reportDir, decodeURIComponent(url.pathname.slice('/reports'.length))), true);
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/evidence/')) {
    const req = decodeURIComponent(url.pathname.slice('/evidence'.length));
    if (!/\.(png|jpe?g|webp)$/i.test(req)) { sendJson(response, 404, { error: 'Evidence không hợp lệ.' }); return true; }
    serveFile(response, safeChildPath(evidenceDir, req), true);
    return true;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/tools/')) {
    serveFile(response, safeChildPath(toolsDir, decodeURIComponent(url.pathname.slice('/tools'.length))));
    return true;
  }
  return false;
}

async function handleDeleteArtifact(request, response, root, reportDir, evidenceDir) {
  try {
    const { path: artPath = '', type = '' } = await parseBody(request);
    const res = listResources(false, root);
    if (type === 'evidence' && res.evidence.includes(artPath)) {
      const target = safeChildPath(evidenceDir, `/${artPath}`);
      if (!target || !fs.statSync(target).isFile()) throw new Error('Evidence không hợp lệ.');
      fs.unlinkSync(target);
      return sendJson(response, 200, { message: 'Đã xóa evidence.' }) || true;
    }
    if (type === 'evidence-folder') {
      const norm = artPath.replace(/^\/+|\/+$/g, '');
      const target = (norm && res.evidence.some((i) => i.startsWith(`${norm}/`))) ? safeChildPath(evidenceDir, `/${norm}`) : null;
      if (!target || target === evidenceDir || !target.startsWith(`${evidenceDir}${path.sep}`) || !fs.statSync(target).isDirectory()) throw new Error('Folder evidence không hợp lệ.');
      fs.rmSync(target, { recursive: true, force: true });
      return sendJson(response, 200, { message: 'Đã xóa folder evidence và toàn bộ ảnh bên trong.' }) || true;
    }
    if (type === 'report-folder' || type === 'report') {
      const norm = artPath.replace(/^\/+|\/+$/g, '');
      const target = type === 'report' ? path.dirname(safeChildPath(reportDir, `/${artPath}`) || '') : safeChildPath(reportDir, `/${norm}`);
      if (!target || target === reportDir || !target.startsWith(`${reportDir}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error('Báo cáo không hợp lệ.');
      const del = countFolderArtifacts(target);
      fs.rmSync(target, { recursive: true, force: true });
      return sendJson(response, 200, { message: `Đã xóa folder báo cáo (${del.files} file, ${del.traceAndVideo} trace/video).` }) || true;
    }
    sendJson(response, 404, { error: 'Artifact không tồn tại hoặc không hợp lệ.' });
  } catch (e) { sendJson(response, 400, { error: e.message }); }
  return true;
}

module.exports = { handleResourceRoutes, serveFile };
