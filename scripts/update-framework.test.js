'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  FRAMEWORK_MODULES,
  FRAMEWORK_ROOT_FILES,
  FORBIDDEN_PATHS,
  updateFramework,
  isExcludedPath,
} = require('./update-framework');

test('Cấu hình Asset Shield ngăn cấm tuyệt đối các thư mục nghiệp vụ của dự án', () => {
  for (const forbidden of ['tests', 'pages', 'data', 'requirements', 'test-cases', '.env', 'decisions.json', 'qa.config.json']) {
    assert.ok(FORBIDDEN_PATHS.includes(forbidden), `Phải cấm ghi đè: ${forbidden}`);
  }
  // Đảm bảo không module nào trong FRAMEWORK_MODULES trỏ vào forbidden
  for (const mod of FRAMEWORK_MODULES) {
    assert.ok(!FORBIDDEN_PATHS.includes(mod.dest), `Module ${mod.dest} không được trùng với forbidden path`);
  }
});

test('isExcludedPath nhận diện chính xác các đường dẫn loại trừ', () => {
  const excludes = ['core/local', 'core/config/dashboardConfig.json'];

  assert.ok(isExcludedPath('D:/project/core/local', excludes));
  assert.ok(isExcludedPath('D:/project/core/local/customHelper.js', excludes));
  assert.ok(isExcludedPath('D:/project/core/config/dashboardConfig.json', excludes));
  assert.ok(!isExcludedPath('D:/project/core/utils/commonUtils.js', excludes));
  assert.ok(!isExcludedPath('D:/project/dashboard/server.js', excludes));
});

test('updateFramework cập nhật đúng các tệp framework và không xóa tệp dự án riêng', () => {
  const tempSatellite = fs.mkdtempSync(path.join(os.tmpdir(), 'test-sat-'));
  const tempHub = fs.mkdtempSync(path.join(os.tmpdir(), 'test-hub-'));

  try {
    // 1. Tạo giả lập Hub
    fs.mkdirSync(path.join(tempHub, 'dashboard', 'public'), { recursive: true });
    fs.writeFileSync(path.join(tempHub, 'dashboard', 'server.js'), '// hub server v2');
    fs.writeFileSync(path.join(tempHub, 'dashboard', 'public', 'app.js'), '// hub app v2');

    fs.mkdirSync(path.join(tempHub, 'core', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(tempHub, 'core', 'utils', 'commonUtils.js'), '// hub commonUtils v2');
    fs.writeFileSync(path.join(tempHub, 'Start_Dashboard.bat'), 'echo Starting Hub Dashboard');

    // 2. Tạo giả lập Vệ tinh với dữ liệu nghiệp vụ riêng
    fs.mkdirSync(path.join(tempSatellite, 'dashboard'), { recursive: true });
    fs.writeFileSync(path.join(tempSatellite, 'dashboard', 'server.js'), '// sat server v1');

    fs.mkdirSync(path.join(tempSatellite, 'tests', 'e2e'), { recursive: true });
    fs.writeFileSync(path.join(tempSatellite, 'tests', 'e2e', 'login.spec.js'), '// business test');

    fs.mkdirSync(path.join(tempSatellite, 'data'), { recursive: true });
    fs.writeFileSync(path.join(tempSatellite, 'data', 'users.json'), '{"test":"user"}');

    fs.mkdirSync(path.join(tempSatellite, 'core', 'local'), { recursive: true });
    fs.writeFileSync(path.join(tempSatellite, 'core', 'local', 'myHelper.js'), '// local helper');

    fs.writeFileSync(path.join(tempSatellite, 'decisions.json'), '{"approved":true}');
    fs.writeFileSync(path.join(tempSatellite, 'package.json'), JSON.stringify({ name: "sat", scripts: {} }));

    // Mock resolveFrameworkSource bằng cách trỏ Hub
    const originalResolve = require('./update-framework');

    // Thực thi copy thủ công logic update với nguồn tempHub
    const count = originalResolve.updateFramework({ targetDir: tempSatellite, _testSourceDir: tempHub });

    // Kiểm tra: Dashboard phải được cập nhật bản mới
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'dashboard', 'server.js'), 'utf8'), '// hub server v2');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'dashboard', 'public', 'app.js'), 'utf8'), '// hub app v2');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'core', 'utils', 'commonUtils.js'), 'utf8'), '// hub commonUtils v2');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'Start_Dashboard.bat'), 'utf8'), 'echo Starting Hub Dashboard');

    // Kiểm tra BẤT BIẾN: Toàn bộ dữ liệu nghiệp vụ của vệ tinh phải CÒN NGUYÊN VẸN
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'tests', 'e2e', 'login.spec.js'), 'utf8'), '// business test');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'data', 'users.json'), 'utf8'), '{"test":"user"}');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'core', 'local', 'myHelper.js'), 'utf8'), '// local helper');
    assert.equal(fs.readFileSync(path.join(tempSatellite, 'decisions.json'), 'utf8'), '{"approved":true}');

    // Kiểm tra package.json được tự động bổ sung script
    const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempSatellite, 'package.json'), 'utf8'));
    assert.equal(updatedPkg.scripts['update:framework'], 'node scripts/update-framework.js');
  } finally {
    try { fs.rmSync(tempSatellite, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(tempHub, { recursive: true, force: true }); } catch (_) {}
  }
});
