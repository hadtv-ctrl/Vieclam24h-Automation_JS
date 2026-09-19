const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveMockHtml,
  DEFAULT_MOCK_HTML,
  DEFAULT_MOCK_RELATIVE_PATH,
} = require('./mockSampleTest');

function withProjectRoot(root, fn) {
  const previous = process.env.QA_PROJECT_ROOT;
  process.env.QA_PROJECT_ROOT = root;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.QA_PROJECT_ROOT;
    else process.env.QA_PROJECT_ROOT = previous;
  }
}

function makeProject(withMock) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-sample-'));
  if (withMock) {
    const target = path.join(root, DEFAULT_MOCK_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '<h1>Bản mock của dự án</h1>\n', 'utf8');
  }
  return root;
}

// `data/` không bao giờ được sync xuống vệ tinh, nên fixture dùng chung này phải
// chạy được ở một dự án chưa có file mock nào.
test('dự án chưa có data/mock/sample.html vẫn dùng được (HTML mặc định)', () => {
  const root = makeProject(false);
  try {
    withProjectRoot(root, () => {
      assert.equal(resolveMockHtml(), DEFAULT_MOCK_HTML);
      assert.match(resolveMockHtml(), /<h1>QA Automation Mock<\/h1>/);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('dự án có bản mock riêng thì bản đó được ưu tiên', () => {
  const root = makeProject(true);
  try {
    withProjectRoot(root, () => {
      assert.equal(resolveMockHtml(), '<h1>Bản mock của dự án</h1>\n');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('htmlPath tương đối được phân giải theo gốc dự án', () => {
  const root = makeProject(false);
  try {
    const target = path.join(root, 'data', 'mock', 'checkout.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '<h1>Checkout</h1>\n', 'utf8');

    withProjectRoot(root, () => {
      assert.equal(resolveMockHtml({ htmlPath: 'data/mock/checkout.html' }), '<h1>Checkout</h1>\n');
      assert.equal(resolveMockHtml({ htmlPath: target }), '<h1>Checkout</h1>\n');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('html truyền thẳng thắng mọi nguồn khác', () => {
  const root = makeProject(true);
  try {
    withProjectRoot(root, () => {
      assert.equal(resolveMockHtml({ html: '<h1>Inline</h1>' }), '<h1>Inline</h1>');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('htmlPath chỉ định sai phải báo lỗi rõ ràng, không im lặng dùng mặc định', () => {
  const root = makeProject(false);
  try {
    withProjectRoot(root, () => {
      assert.throws(
        () => resolveMockHtml({ htmlPath: 'data/mock/khong-ton-tai.html' }),
        /không tìm thấy HTML mock/i,
      );
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
