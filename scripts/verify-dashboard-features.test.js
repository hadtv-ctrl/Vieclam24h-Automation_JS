/**
 * scripts/verify-dashboard-features.test.js
 * Chạy tay: node --test scripts/verify-dashboard-features.test.js
 *
 * Dựng một dashboard tí hon trong thư mục tạm rồi tháo từng mảnh. Mỗi test tương ứng
 * một kiểu hỏng âm thầm thật sự có thể xảy ra khi sync: file lọt vào excludes, wiring
 * bị quên, route có file nhưng server không gọi.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { verify } = require('./verify-dashboard-features');

const MAIN = `
import { qaSlice } from './views/qa/qaSlice.js';
import { dataSlice } from './views/data/dataSlice.js';

const SLICE_REGISTRY = {
  'data-view': { slice: dataSlice, title: 'Dữ liệu' },
  'qa-view': { slice: qaSlice, title: 'QA Docs & Automation' },
};
`;

const LOADER = `
class TemplateLoader {
  constructor() {
    this._viewMap = {
      'data-view': 'data',
      'qa-view': 'qa',
    };
  }
}
`;

const INDEX = `<!doctype html>
<html><body>
  <section id="data-view"></section>
  <section id="qa-view"></section>
  <script type="module" src="/js/main.js"></script>
</body></html>
`;

const SERVER = `
const { handleDataRoutes } = require('./routes/dataRoutes');
const { handleQaRoutes } = require('./routes/qaRoutes');
async function router(req, res, url) {
  if (await handleDataRoutes(req, res, url)) return;
  if (await handleQaRoutes(req, res, url)) return;
}
`;

const STYLES = `@import url('./styles/views/data.css');
@import url('./styles/views/qa.css');
`;

const BASE = {
  'dashboard/public/js/main.js': MAIN,
  'dashboard/public/js/core/templateLoader.js': LOADER,
  'dashboard/public/index.html': INDEX,
  'dashboard/server.js': SERVER,
  'dashboard/public/styles.css': STYLES,
  'dashboard/public/js/views/qa/qaSlice.js': 'export const qaSlice = {};',
  'dashboard/public/js/views/data/dataSlice.js': 'export const dataSlice = {};',
  'dashboard/public/templates/qa.html': '<div></div>',
  'dashboard/public/templates/data.html': '<div></div>',
  'dashboard/public/styles/views/qa.css': '.qa-view {}',
  'dashboard/public/styles/views/data.css': '.data-view {}',
  'dashboard/routes/qaRoutes.js': 'module.exports = {};',
  'dashboard/routes/dataRoutes.js': 'module.exports = {};',
};

function makeRepo(overrides = {}, removals = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-dash-'));
  const files = { ...BASE, ...overrides };
  for (const rel of removals) delete files[rel];
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (overrides, removals, fn) => {
  const root = makeRepo(overrides, removals);
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

const errorText = (r) => r.errors.map((e) => `${e.view}|${e.part}|${e.detail}`).join('\n');

test('dashboard đủ mảnh thì không báo lỗi và đọc ra đúng số view', () => {
  withRepo({}, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 0, errorText(r));
    assert.equal(r.views.length, 2);
    const qa = r.views.find((v) => v.viewId === 'qa-view');
    assert.deepEqual(qa.parts, { slice: true, section: true, template: 'qa', style: 'styles/views/qa.css' });
  });
});

test('thiếu file slice — trường hợp file lọt vào excludes', () => {
  withRepo({}, ['dashboard/public/js/views/qa/qaSlice.js'], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].view, 'qa-view');
    assert.equal(r.errors[0].part, 'slice');
  });
});

test('quên thêm <section> vào index.html', () => {
  withRepo({ 'dashboard/public/index.html': INDEX.replace('<section id="qa-view"></section>', '') }, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].part, 'section');
  });
});

test('_viewMap trỏ tới template không tồn tại', () => {
  withRepo({}, ['dashboard/public/templates/qa.html'], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].part, 'template');
  });
});

test('có stylesheet nhưng quên @import — view mất sạch định dạng', () => {
  withRepo({ 'dashboard/public/styles.css': STYLES.replace("@import url('./styles/views/qa.css');\n", '') }, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].part, 'style');
    assert.match(r.errors[0].detail, /mất toàn bộ định dạng/);
  });
});

test('@import trỏ tới file không có — trình duyệt bỏ qua im lặng', () => {
  withRepo({}, ['dashboard/public/styles/views/qa.css'], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].view, '(styles)');
  });
});

test('route có file, được require, nhưng server không bao giờ gọi', () => {
  withRepo({
    'dashboard/server.js': SERVER.replace('  if (await handleQaRoutes(req, res, url)) return;\n', ''),
  }, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.equal(r.errors[0].part, 'route');
    assert.match(r.errors[0].detail, /404/);
  });
});

test('server require route nhưng thiếu file', () => {
  withRepo({}, ['dashboard/routes/qaRoutes.js'], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 1, errorText(r));
    assert.match(r.errors[0].detail, /thiếu dashboard\/routes\/qaRoutes\.js/);
  });
});

test('destructuring nhiều tên vẫn nhận ra route — mẫu một-tên sẽ bỏ sót', () => {
  withRepo({
    'dashboard/server.js': SERVER.replace(
      "const { handleQaRoutes } = require('./routes/qaRoutes');",
      "const { handleQaRoutes, helperKhac } = require('./routes/qaRoutes');",
    ),
  }, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 0, errorText(r));
    assert.equal(r.routeCount, 2);
  });
});

test('template khai báo trong _viewMap nhưng không ai đăng ký chỉ là cảnh báo', () => {
  withRepo({
    'dashboard/public/js/core/templateLoader.js': LOADER.replace(
      "      'qa-view': 'qa',",
      "      'qa-view': 'qa',\n      'ma-view': 'ma',",
    ),
  }, [], (root) => {
    const r = verify(root);
    assert.equal(r.errors.length, 0, errorText(r));
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /ma-view/);
  });
});

test('thiếu hẳn file nền tảng thì dừng sớm, không suy diễn tiếp', () => {
  withRepo({}, ['dashboard/public/js/main.js'], (root) => {
    const r = verify(root);
    assert.equal(r.views.length, 0);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].detail, /main\.js/);
  });
});
