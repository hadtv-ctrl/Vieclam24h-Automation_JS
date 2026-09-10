/**
 * dashboard/routes/pageRoutes.js
 * Handles Object Repository & Core Capabilities APIs.
 */
const {
  scanAllPageObjects,
  parsePageObject,
  updateLocatorSelector,
  createPageObject,
  deletePageObject,
  getCoreCapabilities,
} = require('../../core/generator/objectRepository');
const { cleanupDraft } = require('../../core/generator/draftManager');
const { sendJson, parseBody } = require('./routeUtils');

async function handlePageRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && (url.pathname === '/api/object-repository/pages' || url.pathname === '/api/pages')) {
    try {
      const pages = scanAllPageObjects(root);
      sendJson(response, 200, { pages });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/object-repository/page') {
    const pageFile = url.searchParams.get('file');
    if (!pageFile) {
      sendJson(response, 400, { error: 'Thiếu file Page Object.' });
      return true;
    }
    try {
      const details = parsePageObject(pageFile, root);
      sendJson(response, 200, details);
    } catch (error) {
      sendJson(response, 404, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/object-repository/update-locator') {
    try {
      const body = await parseBody(request);
      const result = updateLocatorSelector({
        pageRelativePath: body.pageRelativePath,
        locatorName: body.locatorName,
        newExpression: body.newExpression,
        rootDir: root,
      });
      sendJson(response, 200, {
        success: true,
        message: `Đã cập nhật selector cho phần tử "${body.locatorName}" thành công!`,
        affectedFiles: result.affectedFiles,
        impact: result.impact,
        ...result,
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/object-repository/create-page') {
    try {
      const body = await parseBody(request);
      const result = createPageObject(body, root);
      if (body.draftId) {
        cleanupDraft({ type: 'page', id: body.draftId, rootDir: root });
      }
      sendJson(response, 201, { ...result, message: `Đã tạo ${result.className}.js trong ${result.relativePath}` });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if ((request.method === 'DELETE' || request.method === 'POST') &&
      (url.pathname === '/api/object-repository/page' || url.pathname === '/api/object-repository/delete-page')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const relativePath = body.relativePath || body.path || body.file ||
        url.searchParams.get('relativePath') || url.searchParams.get('path') || url.searchParams.get('file') ||
        (body.platform && body.name ? `pages/${body.platform}/${body.name}.js` : '');
      if (!relativePath) {
        sendJson(response, 400, { error: 'Thiếu đường dẫn Page Object cần xóa.' });
        return true;
      }
      const result = deletePageObject(relativePath, root);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/core/capabilities') {
    try {
      const capabilities = getCoreCapabilities(root);
      sendJson(response, 200, { capabilities });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handlePageRoutes };
