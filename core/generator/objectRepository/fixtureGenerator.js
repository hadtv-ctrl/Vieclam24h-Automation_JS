'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RESERVED_FIXTURE_NAMES } = require('../../fixtures/reservedFixtureNames');
const { isValidFixtureName, findCustomFixturePath } = require('./fixtureParser');

function validateCustomFixtureSource({ name, sourceCode, rootDir: _rootDir = process.cwd() }) {
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: `Tên fixture không hợp lệ: '${name}'. Phải bắt đầu bằng chữ cái và chỉ chứa ký tự chữ/số/gạch dưới.` };
  }
  if (RESERVED_FIXTURE_NAMES.has(name)) {
    return { valid: false, error: `Tên fixture '${name}' trùng với từ khóa hệ thống hoặc Core Fixture nền tảng đã được bảo vệ.` };
  }
  if (!sourceCode || typeof sourceCode !== 'string') {
    return { valid: false, error: 'Mã nguồn fixture không được để trống.' };
  }

  try {
    new Function(sourceCode);
  } catch (err) {
    return { valid: false, error: `Lỗi cú pháp JavaScript: ${err.message}` };
  }

  const revision = crypto.createHash('sha256').update(sourceCode, 'utf8').digest('hex').slice(0, 16);
  return {
    valid: true,
    name,
    revision,
    diagnostics: null,
  };
}

function buildCleanupApiFixture(name, safeTitle, safeDesc, safeCategory, config) {
  const url = config.url || '/api/resource';
  const method = (config.method || 'DELETE').toUpperCase();
  const headers = config.headers ? JSON.stringify(config.headers, null, 2) : '{}';

  return `/**
 * @title ${safeTitle}
 * @description ${safeDesc}
 * @category ${safeCategory}
 */
const ${name} = async ({ request }, use, testInfo) => {
  const context = { id: null, targetUrl: '${url}', payload: null };
  try {
    await use(context);
  } finally {
    await testInfo.attach('teardown_log', {
      body: \`Bắt đầu dọn dẹp qua API: \${context.targetUrl}\`,
      contentType: 'text/plain'
    });
    try {
      if (context.id) {
        const deleteEndpoint = context.targetUrl.replace(/:id/g, context.id);
        const res = await request.${method.toLowerCase()}(deleteEndpoint, { headers: ${headers} });
        if (res && typeof res.ok === 'function' && !res.ok()) {
          throw new Error(\`API teardown thất bại với mã lỗi HTTP \${res.status()}\`);
        }
        console.log(\`[Teardown \${'${name}'}] Đã xóa thành công resource ID: \${context.id}\`);
      }
    } catch (err) {
      console.warn(\`[Teardown \${'${name}'} Warning] Không thể xóa resource: \${err.message}\`);
      throw err;
    }
  }
};

module.exports = { ${name} };
`;
}

function buildPreconditionDataFixture(name, safeTitle, safeDesc, safeCategory) {
  return `/**
 * @title ${safeTitle}
 * @description ${safeDesc}
 * @category ${safeCategory}
 */
const ${name} = async ({ request }, use, testInfo) => {
  const data = { timestamp: Date.now(), role: 'standard_user', token: null };
  try {
    await use(data);
  } finally {
    console.log(\`[Teardown \${'${name}'}] Hoàn tất dọn dẹp data thử nghiệm.\`);
  }
};

module.exports = { ${name} };
`;
}

function createCustomFixture({ name, title, description, category, template, config = {}, rawCode, rootDir = process.cwd() }) {
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Tên fixture không hợp lệ: '${name}'. Tên phải bắt đầu bằng chữ cái và chỉ chứa chữ, số, gạch dưới.`);
  }
  if (RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Tên fixture '${name}' trùng với từ khóa hoặc Core Fixture nền tảng đã được bảo vệ.`);
  }

  const existingFixture = findCustomFixturePath(name, rootDir);
  if (existingFixture) {
    const conflictErr = new Error(`Fixture '${name}' đã tồn tại! Vui lòng chọn tên khác hoặc chỉnh sửa fixture hiện có.`);
    conflictErr.code = 'CONFLICT';
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  const canonicalDir = path.join(rootDir, 'fixtures', 'custom');
  const legacyDir = path.join(rootDir, 'core', 'fixtures', 'custom');

  let targetDir = canonicalDir;
  if (!fs.existsSync(canonicalDir) && fs.existsSync(legacyDir)) {
    targetDir = legacyDir;
  } else if (!fs.existsSync(canonicalDir)) {
    fs.mkdirSync(canonicalDir, { recursive: true });
  }

  const fileName = `${name}.fixture.js`;
  const targetPath = path.join(targetDir, fileName);

  const safeTitle = title || name;
  const safeDesc = description || `Custom Fixture ${name}`;
  const safeCategory = category || (template === 'cleanup_api' ? 'Dọn dẹp & Teardown' : 'Xác thực & Precondition');

  let generatedCode = '';
  if (template === 'cleanup_api') {
    generatedCode = buildCleanupApiFixture(name, safeTitle, safeDesc, safeCategory, config);
  } else if (template === 'precondition_data') {
    generatedCode = buildPreconditionDataFixture(name, safeTitle, safeDesc, safeCategory);
  } else {
    if (!rawCode || typeof rawCode !== 'string') {
      throw new Error('Vui lòng cung cấp mã nguồn cho custom fixture.');
    }
    generatedCode = rawCode;
  }

  try {
    new Function(generatedCode);
  } catch (err) {
    throw new Error(`Mã nguồn fixture có lỗi cú pháp JavaScript: ${err.message}`);
  }

  fs.writeFileSync(targetPath, generatedCode, 'utf8');
  const revision = crypto.createHash('sha256').update(generatedCode, 'utf8').digest('hex').slice(0, 16);

  return {
    success: true,
    name,
    fileName,
    relativePath: path.relative(rootDir, targetPath).replace(/\\/g, '/'),
    revision,
    message: `Đã tạo Custom Fixture '${name}' thành công!`,
  };
}

function updateCustomFixture({ name, sourceCode, expectedRevision, rootDir = process.cwd() }) {
  if (!name || !isValidFixtureName(name) || RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Không thể chỉnh sửa fixture nền tảng hoặc tên không hợp lệ: '${name}'.`);
  }
  const fileInfo = findCustomFixturePath(name, rootDir);
  if (!fileInfo) {
    const notFoundErr = new Error(`Không tìm thấy file của fixture '${name}' để cập nhật.`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const currentContent = fs.readFileSync(fileInfo.fullPath, 'utf8');
  const currentRevision = crypto.createHash('sha256').update(currentContent, 'utf8').digest('hex').slice(0, 16);

  if (expectedRevision && expectedRevision !== currentRevision) {
    const conflictErr = new Error(`Conflict: Fixture '${name}' đã bị thay đổi bởi phiên làm việc khác (Revision hiện tại: ${currentRevision}, Revision gửi lên: ${expectedRevision}). Vui lòng tải lại trước khi lưu.`);
    conflictErr.code = 'CONFLICT';
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  try {
    new Function(sourceCode);
  } catch (err) {
    throw new Error(`Mã nguồn fixture có lỗi cú pháp JavaScript: ${err.message}`);
  }

  const backupDir = path.join(rootDir, '.dashboard-backups', 'fixtures');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = `${name}.fixture.${Date.now()}.bak`;
  fs.copyFileSync(fileInfo.fullPath, path.join(backupDir, backupFile));

  fs.writeFileSync(fileInfo.fullPath, sourceCode, 'utf8');
  const newRevision = crypto.createHash('sha256').update(sourceCode, 'utf8').digest('hex').slice(0, 16);

  return {
    success: true,
    name,
    revision: newRevision,
    relativePath: path.relative(rootDir, fileInfo.fullPath).replace(/\\/g, '/'),
    message: `Đã cập nhật fixture '${name}' thành công!`,
  };
}

function deleteCustomFixture(name, rootDir = process.cwd(), expectedRevision = null) {
  if (!isValidFixtureName(name) || RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Không thể xóa Core Fixture nền tảng hoặc tên fixture không hợp lệ: '${name}'. Thao tác bị cấm.`);
  }

  const fileInfo = findCustomFixturePath(name, rootDir);
  if (!fileInfo) {
    const notFoundErr = new Error(`Không tìm thấy custom fixture '${name}' để xóa.`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const targetPath = fileInfo.fullPath;
  const content = fs.readFileSync(targetPath, 'utf8');
  const currentRevision = crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);

  if (expectedRevision && expectedRevision !== currentRevision) {
    const conflictErr = new Error(`Conflict: Fixture '${name}' đã bị thay đổi trước khi xóa. Vui lòng tải lại trang.`);
    conflictErr.code = 'CONFLICT';
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  const backupDir = path.join(rootDir, '.dashboard-backups', 'fixtures');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = `${name}.fixture.${Date.now()}.deleted.bak`;
  fs.copyFileSync(targetPath, path.join(backupDir, backupFile));

  fs.unlinkSync(targetPath);

  return {
    success: true,
    name,
    message: `Đã xóa custom fixture '${name}' thành công (Đã sao lưu tại .dashboard-backups).`,
  };
}

module.exports = {
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
};
