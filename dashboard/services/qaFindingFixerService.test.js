'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  resolveSafePath,
  generateUnifiedDiff,
  analyzeFindingFix,
  analyzeWithHeuristicFix,
  applyFindingFix,
} = require('./qaFindingFixerService');

test('resolveSafePath: phân giải đường dẫn an toàn và trích xuất số dòng', () => {
  const root = path.join(os.tmpdir(), 'qa-test-root-' + Date.now());
  fs.mkdirSync(root, { recursive: true });

  try {
    const res1 = resolveSafePath(root, 'tests/sample.spec.js:25');
    assert.ok(res1);
    assert.equal(res1.relPath, 'tests/sample.spec.js');
    assert.equal(res1.lineNumber, 25);

    // Chặn Path Traversal
    const res2 = resolveSafePath(root, '../../etc/passwd');
    assert.equal(res2, null);

    const res3 = resolveSafePath(root, '..\\..\\Windows\\System32');
    assert.equal(res3, null);

    // Chặn đường dẫn tuyệt đối ngoài root
    const res4 = resolveSafePath(root, 'C:\\secrets\\key.txt');
    assert.equal(res4, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('generateUnifiedDiff: sinh định dạng diff chính xác với dòng xóa và thêm', () => {
  const diff = generateUnifiedDiff('const x = 1;', 'const x = 2;', 'tests/sample.spec.js');
  assert.ok(diff.includes('--- a/tests/sample.spec.js'));
  assert.ok(diff.includes('+++ b/tests/sample.spec.js'));
  assert.ok(diff.includes('- const x = 1;'));
  assert.ok(diff.includes('+ const x = 2;'));
});

test('analyzeWithHeuristicFix: sửa lỗi assertion-thieu-await', () => {
  const fileContent = `test('sample test', async ({ page }) => {
  expect(page.locator('.submit')).toBeVisible();
});`;
  const finding = {
    kind: 'assertion-thieu-await',
    where: 'tests/sample.spec.js:2',
    message: 'expect() thiếu await',
  };
  const fileContext = {
    relPath: 'tests/sample.spec.js',
    lineNumber: 2,
    content: fileContent,
  };

  const res = analyzeWithHeuristicFix({ root: '', finding, fileContext });
  assert.equal(res.patchType, 'replace_lines');
  assert.ok(res.fixedSnippet.includes('await expect('));
  assert.ok(res.rootCause.includes('async'));
});

test('analyzeWithHeuristicFix: sửa lỗi test-khong-co-ma-tc', () => {
  const fileContent = `test('Kiểm tra đăng nhập thành công', async ({ page }) => {
  await page.goto('/');
});`;
  const finding = {
    kind: 'test-khong-co-ma-tc',
    where: 'tests/login.spec.js:1',
    message: 'Test không mở đầu bằng TC-xxx',
  };
  const fileContext = {
    relPath: 'tests/login.spec.js',
    lineNumber: 1,
    content: fileContent,
  };

  const res = analyzeWithHeuristicFix({ root: '', finding, fileContext });
  assert.equal(res.patchType, 'replace_lines');
  assert.match(res.fixedSnippet, /test\('TC-\d+: Kiểm tra đăng nhập thành công'/);
});

test('analyzeWithHeuristicFix: sửa lỗi test-bi-skip-am-tham', () => {
  const fileContent = `test.skip('TC-001: Test tính năng mới', async ({ page }) => {
  await page.goto('/');
});`;
  const finding = {
    kind: 'test-bi-skip-am-tham',
    where: 'tests/skip.spec.js:1',
    message: 'Test bị skip âm thầm',
  };
  const fileContext = {
    relPath: 'tests/skip.spec.js',
    lineNumber: 1,
    content: fileContent,
  };

  const res = analyzeWithHeuristicFix({ root: '', finding, fileContext });
  assert.equal(res.patchType, 'replace_lines');
  assert.ok(res.fixedSnippet.startsWith("test('TC-001:"));
});

test('analyzeWithHeuristicFix: sửa lỗi khong-doc-duoc-requirement bằng create_file', () => {
  const finding = {
    kind: 'khong-doc-duoc-requirement',
    where: 'requirements/',
    message: 'Không đọc được requirement nào',
  };

  const res = analyzeWithHeuristicFix({ root: '', finding, fileContext: null });
  assert.equal(res.patchType, 'create_file');
  assert.equal(res.targetFile, 'requirements/REQ-001-general.md');
  assert.ok(res.fullContent.includes('# REQ-001'));
});

test('analyzeFindingFix: trả về cấu trúc kết quả hợp lệ ở chế độ heuristic fallback', async () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-analyze-fix-' + Date.now());
  fs.mkdirSync(path.join(tmpRoot, 'tests'), { recursive: true });
  const testFile = path.join(tmpRoot, 'tests', 'example.spec.js');
  fs.writeFileSync(testFile, "test('Sample test @smoke', async () => {});", 'utf8');

  try {
    const finding = {
      kind: 'test-khong-co-ma-tc',
      where: 'tests/example.spec.js:1',
      message: 'Test không có mã TC-xxx',
    };
    const res = await analyzeFindingFix({ root: tmpRoot, finding });
    assert.equal(res.ok, true);
    assert.ok(res.engine === 'heuristic' || res.engine === 'ai');
    assert.ok(res.analysis);
    assert.equal(res.analysis.targetFile, 'tests/example.spec.js');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('applyFindingFix: áp dụng bản vá thành công và tạo bản sao lưu', () => {
  const tmpRoot = path.join(os.tmpdir(), 'qa-apply-fix-' + Date.now());
  fs.mkdirSync(path.join(tmpRoot, 'tests'), { recursive: true });
  const testFile = path.join(tmpRoot, 'tests', 'sample.spec.js');
  fs.writeFileSync(
    testFile,
    "test('Chưa có mã TC', async ({ page }) => {\n  expect(page).toBeDefined();\n});",
    'utf8'
  );

  try {
    // 1. Áp dụng thay thế dòng
    const res = applyFindingFix(tmpRoot, {
      targetFile: 'tests/sample.spec.js',
      patchType: 'replace_lines',
      originalSnippet: "test('Chưa có mã TC',",
      fixedSnippet: "test('TC-001: Đã có mã TC',",
    });

    assert.equal(res.ok, true);
    assert.ok(res.backup);

    const updated = fs.readFileSync(testFile, 'utf8');
    assert.ok(updated.includes("test('TC-001: Đã có mã TC',"));

    // 2. Kiểm tra sao lưu đã được tạo
    const backupFull = path.join(tmpRoot, res.backup);
    assert.ok(fs.existsSync(backupFull));

    // 3. Chặn path traversal
    assert.throws(
      () => {
        applyFindingFix(tmpRoot, {
          targetFile: '../../outside.txt',
          patchType: 'replace_lines',
          originalSnippet: 'a',
          fixedSnippet: 'b',
        });
      },
      /bị từ chối do vi phạm bảo mật/
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
