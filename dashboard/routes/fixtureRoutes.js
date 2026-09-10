/**
 * dashboard/routes/fixtureRoutes.js
 * Handles Fixtures & Lifecycle Hooks Management APIs.
 */
const {
  scanAllFixtures,
  getFixtureByName,
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
} = require('../../core/generator/objectRepository');
const { sendJson, parseBody } = require('./routeUtils');

async function handleFixtureRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/fixtures') {
    try {
      const fixtures = scanAllFixtures(root);
      sendJson(response, 200, { fixtures });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/fixtures/validate') {
    try {
      const body = await parseBody(request);
      const result = validateCustomFixtureSource({ ...body, rootDir: root });
      sendJson(response, result.valid ? 200 : 400, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/fixtures') {
    try {
      const body = await parseBody(request);
      const result = createCustomFixture({ ...body, rootDir: root });
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      if (!fixtureName || fixtureName === 'validate') {
        sendJson(response, 400, { error: 'Tên fixture không hợp lệ.' });
        return true;
      }
      const fixture = getFixtureByName(fixtureName, root);
      if (!fixture) {
        sendJson(response, 404, { error: `Không tìm thấy fixture '${fixtureName}'.` });
        return true;
      }
      sendJson(response, 200, fixture);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      const body = await parseBody(request);
      const result = updateCustomFixture({
        name: fixtureName,
        sourceCode: body.sourceCode || body.rawCode,
        expectedRevision: body.expectedRevision,
        rootDir: root,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(response, statusCode, { error: error.message, code: error.code });
    }
    return true;
  }

  if ((request.method === 'DELETE' || request.method === 'POST') && url.pathname.startsWith('/api/fixtures/delete')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fixtureName = body.name || decodeURIComponent(url.pathname.slice('/api/fixtures/delete/'.length));
      if (!fixtureName) {
        sendJson(response, 400, { error: 'Thiếu tên fixture cần xóa.' });
        return true;
      }
      const result = deleteCustomFixture(fixtureName, root, body.expectedRevision);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(response, statusCode, { error: error.message, code: error.code });
    }
    return true;
  }

  if (request.method === 'DELETE' && url.pathname.startsWith('/api/fixtures/')) {
    try {
      const fixtureName = decodeURIComponent(url.pathname.slice('/api/fixtures/'.length));
      const body = await parseBody(request).catch(() => ({}));
      const result = deleteCustomFixture(fixtureName, root, body.expectedRevision);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(response, statusCode, { error: error.message, code: error.code });
    }
    return true;
  }

  return false;
}

module.exports = { handleFixtureRoutes };
