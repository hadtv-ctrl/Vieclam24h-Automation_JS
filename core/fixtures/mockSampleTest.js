const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Fixture dùng chung: dựng một HTTP server cục bộ phục vụ một trang HTML tĩnh,
 * để kiểm thử xác định (deterministic) mà không phụ thuộc mạng hay môi trường thật.
 *
 * Đây là NĂNG LỰC của Hub, mỗi dự án dùng theo đặc thù riêng của mình. Chỉ phần
 * NỘI DUNG HTML là dữ liệu mẫu — `data/` không bao giờ được sync, nên fixture này
 * KHÔNG được phép hard-code đường dẫn tới một file cụ thể của dự án nào.
 *
 * Thứ tự phân giải nguồn HTML:
 *   1. `options.html`      — chuỗi/Buffer truyền thẳng vào.
 *   2. `options.htmlPath`  — đường dẫn tuyệt đối, hoặc tương đối so với gốc dự án.
 *   3. `<gốc dự án>/data/mock/sample.html` — dự án tự đặt bản của mình vào đây.
 *   4. HTML mặc định nhúng sẵn bên dưới — để fixture luôn chạy được ở một dự án
 *      chưa tạo file mock nào.
 *
 * Gốc dự án lấy từ `QA_PROJECT_ROOT` rồi mới tới `process.cwd()`, thống nhất với
 * `core/config/dashboardConfig.js`.
 *
 * Ví dụ dùng theo đặc thù dự án:
 *   const test = withMockSample(base, { htmlPath: 'data/mock/checkout.html' });
 *   const test = withMockSample(base, { html: '<h1>Trang nội bộ</h1>' });
 */

const DEFAULT_MOCK_HTML = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="utf-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1">',
  '  <title>QA Automation Mock</title>',
  '  <style>body { font: 18px system-ui; margin: 24px; } main { max-width: 640px; margin: auto; } a { display: inline-block; padding: 12px 0; }</style>',
  '</head>',
  '<body>',
  '  <main>',
  '    <h1>QA Automation Mock</h1>',
  '    <p>Deterministic local data for page container verification.</p>',
  '    <a href="#details">More information</a>',
  '  </main>',
  '</body>',
  '</html>',
  '',
].join('\n');

const DEFAULT_MOCK_RELATIVE_PATH = path.join('data', 'mock', 'sample.html');

function getProjectRoot() {
  return process.env.QA_PROJECT_ROOT || process.cwd();
}

function resolveMockHtml(options = {}) {
  if (options.html !== undefined && options.html !== null) {
    return options.html;
  }

  const candidates = [];
  if (options.htmlPath) {
    candidates.push(
      path.isAbsolute(options.htmlPath)
        ? options.htmlPath
        : path.join(getProjectRoot(), options.htmlPath),
    );
  } else {
    candidates.push(path.join(getProjectRoot(), DEFAULT_MOCK_RELATIVE_PATH));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
    } catch (_) {
      // Không đọc được thì rơi xuống nguồn kế tiếp.
    }
  }

  // htmlPath do người dùng chỉ định mà không tồn tại là lỗi cấu hình, phải báo rõ.
  if (options.htmlPath) {
    throw new Error(
      `withMockSample: không tìm thấy HTML mock tại "${options.htmlPath}" (gốc dự án: ${getProjectRoot()}).`,
    );
  }

  return DEFAULT_MOCK_HTML;
}

/**
 * @param {import('@playwright/test').TestType} base
 * @param {{ html?: string|Buffer, htmlPath?: string }} [options]
 */
function withMockSample(base, options = {}) {
  return base.extend({
    mockSampleUrl: [async ({}, use) => {
      const html = resolveMockHtml(options);
      const server = http.createServer((request, response) => {
        if (request.url !== '/') {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(html);
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      try {
        await use(`http://127.0.0.1:${server.address().port}/`);
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    }, { scope: 'worker' }],
  });
}

module.exports = { withMockSample, resolveMockHtml, DEFAULT_MOCK_HTML, DEFAULT_MOCK_RELATIVE_PATH };
