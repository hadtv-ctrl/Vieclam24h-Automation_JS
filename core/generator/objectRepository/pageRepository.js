'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizePagePath,
  validateLocatorExpression,
} = require('./locatorValidator');
const { parsePageObject } = require('./pageParser');

function scanAllPageObjects(rootDir = process.cwd()) {
  const pagesDir = path.join(rootDir, 'pages');
  const results = [];

  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        try {
          results.push(parsePageObject(rel, rootDir));
        } catch (e) {
          console.warn(`Could not parse page object ${rel}:`, e.message);
        }
      }
    }
  };

  visit(pagesDir);
  return results.sort((a, b) => {
    if (a.platform === 'base') return -1;
    if (b.platform === 'base') return 1;
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    return a.className.localeCompare(b.className);
  });
}

function updateLocatorSelector({ pageRelativePath, locatorName, newExpression, rootDir = process.cwd() }) {
  if (!pageRelativePath || !locatorName || !newExpression) {
    throw new Error('Thiếu thông tin cập nhật locator (cần pageRelativePath, locatorName, newExpression).');
  }

  const safeRelativePath = normalizePagePath(pageRelativePath);
  if (safeRelativePath === 'pages/BasePage.js') {
    throw new Error('Không thể thêm/sửa locator trong BasePage.js bằng form tự động. Vui lòng sử dụng editor mã nguồn để chỉnh sửa an toàn.');
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(locatorName)) throw new Error('Tên locator không hợp lệ.');
  const cleanExpression = validateLocatorExpression(newExpression);
  const fullPath = path.join(rootDir, safeRelativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File Page Object không tồn tại: ${pageRelativePath}`);
  }

  const originalContent = fs.readFileSync(fullPath, 'utf8');
  const regex = new RegExp(`(this\\.${locatorName}\\s*=\\s*)([\\s\\S]*?)(;\\s*\\n|;\\s*$)`);
  if (!regex.test(originalContent)) {
    throw new Error(`Không tìm thấy khai báo phần tử "this.${locatorName}" trong file ${path.basename(fullPath)}`);
  }

  const cleanRhs = cleanExpression.startsWith('this.') ? cleanExpression : `this.${cleanExpression}`;
  const updatedContent = originalContent.replace(regex, `$1${cleanRhs}$3`);

  const backupDir = path.join(rootDir, '.dashboard-backups', 'pages');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = `${path.basename(fullPath)}.${Date.now()}.bak`;
  fs.copyFileSync(fullPath, path.join(backupDir, backupFile));

  fs.writeFileSync(fullPath, updatedContent, 'utf8');

  return {
    success: true,
    pageRelativePath: safeRelativePath,
    locatorName,
    newExpression: cleanRhs,
    backupFile,
    affectedFiles: [safeRelativePath],
    impact: 'Chỉ cập nhật source Page Object; các spec gọi Page Object không bị sửa trực tiếp.',
  };
}

function createPageObject({ platform = 'desktop', className, title, description = '', locators = [], actions = [] }, rootDir = process.cwd()) {
  const safeClassName = String(className || '').trim();
  const safeTitle = String(title || '').trim();
  if (!/^[A-Z][A-Za-z0-9]*Page$/.test(safeClassName)) {
    throw new Error('Tên class phải viết PascalCase và kết thúc bằng Page, ví dụ: CompanyJobPage.');
  }
  if (!safeTitle) throw new Error('Vui lòng nhập tên màn hình.');
  if (!['desktop', 'mobile-web'].includes(platform)) throw new Error('Phân hệ Page Object không hợp lệ.');

  const relativePath = `pages/${platform}/${safeClassName}.js`;
  const fullPath = path.join(rootDir, relativePath);
  if (fs.existsSync(fullPath)) throw new Error(`Page Object ${safeClassName}.js đã tồn tại.`);

  const rawLocators = Array.isArray(locators) ? locators : [];
  const cleanLocators = rawLocators.map((item) => {
    const name = String(item.name || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`Tên locator không hợp lệ: ${name}.`);
    return { ...item, name, expression: validateLocatorExpression(item.expression) };
  });
  const locatorLines = cleanLocators.length
    ? cleanLocators.map((item) => `    this.${item.name.trim()} = ${String(item.expression).trim()};`).join('\n')
    : '    // Thêm locator của màn hình tại đây.';
  const cleanActions = (Array.isArray(actions) ? actions : []).filter((item) => String(item.name || '').trim());
  const locatorNames = new Set(cleanLocators.map((item) => item.name.trim()));
  if (cleanActions.some((item) => !/^[a-z][A-Za-z0-9]*$/.test(String(item.name).trim()) || !locatorNames.has(String(item.locatorName || '').trim()))) {
    throw new Error('Mỗi action cần tên hợp lệ và phải gắn với một locator đã tạo.');
  }
  const actionLines = cleanActions
    .filter((item) => /^[a-z][A-Za-z0-9]*$/.test(String(item.name || '').trim()))
    .map((item) => {
      const methodName = item.name.trim();
      const locatorName = String(item.locatorName || '').trim();
      const operation = ['click', 'fill'].includes(item.operation) ? item.operation : 'click';
      if (operation === 'fill') return `  async ${methodName}(value) {\n    await this.${locatorName || 'page'}.fill(value);\n  }`;
      return `  async ${methodName}() {\n    await this.${locatorName || 'page'}.click();\n  }`;
    });
  const methods = actionLines.length ? `\n${actionLines.join('\n\n')}\n` : '';
  const basePageImport = platform === 'mobile-web' ? "require('../../pages/BasePage')" : "require('../../pages/BasePage')";
  const content = `const { BasePage } = ${basePageImport};\n\nclass ${safeClassName} extends BasePage {\n  constructor(page, featureName) {\n    super(page, featureName);\n${locatorLines}\n  }\n${methods}}\n\nmodule.exports = { ${safeClassName} };\n`;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const tempPath = `${fullPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, fullPath);
  const readiness = parsePageObject(relativePath, rootDir).readiness;
  return { success: true, relativePath, className: safeClassName, fixtureName: safeClassName.charAt(0).toLowerCase() + safeClassName.slice(1), title: safeTitle, description, readiness, content };
}

function deletePageObject(relativePath, rootDir = path.resolve(__dirname, '../../..')) {
  const normalized = normalizePagePath(relativePath);
  if (normalized === 'pages/BasePage.js') {
    throw new Error('Không thể xóa BasePage.js vì đây là lớp nền tảng dùng chung của toàn bộ framework.');
  }
  const fullPath = path.join(rootDir, normalized);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Page Object ${normalized} không tồn tại.`);
  }

  const backupDir = path.join(rootDir, '.dashboard-backups', 'pages');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupName = `${path.basename(normalized)}.${Date.now()}.deleted.bak`;
  fs.copyFileSync(fullPath, path.join(backupDir, backupName));

  fs.unlinkSync(fullPath);
  return {
    success: true,
    relativePath: normalized,
    fileName: path.basename(normalized),
    message: `Đã xóa Page Object ${path.basename(normalized)} thành công.`,
  };
}

module.exports = {
  parsePageObject,
  scanAllPageObjects,
  updateLocatorSelector,
  createPageObject,
  deletePageObject,
};
