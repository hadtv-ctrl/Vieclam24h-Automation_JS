const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PAGE_ROOTS = ['pages/', 'pages/desktop/', 'pages/mobile/', 'pages/mobile-web/'];
const LOCATOR_EXPRESSION = /^(?:this\.)?page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText|getByAltText|getByTitle)\s*\(/;

function normalizePagePath(relativePath) {
  const value = String(relativePath || '').replace(/\\/g, '/');
  if (path.isAbsolute(value) || value.includes('..') || !value.startsWith('pages/')) {
    throw new Error('Đường dẫn phải thuộc thư mục pages/.');
  }
  return value;
}

function validateLocatorExpression(expression) {
  const value = String(expression || '').trim().replace(/;$/, '');
  if (!LOCATOR_EXPRESSION.test(value) || /[\r\n]|(?:;|=>|require\s*\(|process\.)/.test(value)) {
    throw new Error('Selector phải là biểu thức locator Playwright hợp lệ.');
  }
  return value;
}

function getReadiness({ relativePath, className, baseClass, content }) {
  const syntax = (() => {
    try { new Function(content); return true; } catch (_) { return false; }
  })();
  const exportReady =
    new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${className}\\b`).test(content) ||
    new RegExp(`module\\.exports\\s*=\\s*\\b${className}\\b`).test(content) ||
    className === 'BasePage';
  const importReady = /require\(['"][^'"]+['"]\)/.test(content) || baseClass === 'BasePage' || className === 'BasePage';
  const platformReady = relativePath.startsWith('pages/');
  const checks = { syntax, export: exportReady, import: importReady, platform: platformReady };
  const passed = Object.values(checks).every(Boolean);
  return { status: passed ? 'ready' : 'blocked', ready: passed, checks, reason: passed ? null : Object.entries(checks).filter(([, value]) => !value).map(([key]) => key).join(', ') };
}

/**
 * Metadata thông tin thân thiện cho toàn bộ Page Objects
 */
const PAGE_METADATA = {
  'BasePage.js': {
    title: 'Lớp Nền Tảng (BasePage)',
    desc: 'Lớp cơ sở hệ thống chứa cơ chế Anti-Flaky Wait, Smart Evidence Capture và điều hướng an toàn cho toàn bộ Page Objects.',
    icon: 'ph-shield-check',
    platform: 'base',
    category: 'Lớp Nền Tảng (Core Foundation)',
    isBase: true,
  },
  'desktop/SamplePage.js': {
    title: 'Trang Kiểm Thử Mẫu (SamplePage)',
    desc: 'Trang mẫu demo cách xây dựng Page Object kế thừa BasePage.',
    icon: 'ph-browsers',
    platform: 'desktop',
    category: 'Trang chính',
  },
  'mobile/SampleMobilePage.js': {
    title: 'Trang Mẫu Mobile Web (SampleMobilePage)',
    desc: 'Trang mẫu demo cách xây dựng Page Object cho thiết bị di động kế thừa BasePage.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
};


/**
 * Phân tích loại phần tử từ tên biến và biểu thức định vị
 */
function inferElementCategory(name, expr) {
  const lowerName = name.toLowerCase();
  const lowerExpr = expr.toLowerCase();

  if (lowerName.startsWith('btn') || lowerExpr.includes('button') || lowerName.includes('button')) {
    return { type: 'button', label: 'Nút bấm', icon: 'ph-bold ph-cursor-click', badgeColor: '#3b82f6' };
  }
  if (lowerName.startsWith('txt') || lowerName.startsWith('input') || lowerExpr.includes('textbox') || lowerExpr.includes('fill')) {
    return { type: 'input', label: 'Ô nhập văn bản', icon: 'ph-bold ph-textbox', badgeColor: '#10b981' };
  }
  if (lowerName.endsWith('link') || lowerName.includes('link') || lowerExpr.includes('link') || lowerExpr.includes('href')) {
    return { type: 'link', label: 'Đường dẫn liên kết', icon: 'ph-bold ph-link', badgeColor: '#8b5cf6' };
  }
  if (lowerName.startsWith('chk') || lowerName.includes('check') || lowerExpr.includes('checkbox')) {
    return { type: 'checkbox', label: 'Hộp kiểm', icon: 'ph-bold ph-check-square', badgeColor: '#f59e0b' };
  }
  if (lowerName.includes('select') || lowerName.includes('dropdown') || lowerExpr.includes('selectoption') || lowerName.includes('menu')) {
    return { type: 'dropdown', label: 'Menu danh sách', icon: 'ph-bold ph-list-dashes', badgeColor: '#06b6d4' };
  }
  if (lowerName.includes('modal') || lowerName.includes('popup') || lowerName.includes('dialog') || lowerExpr.includes('dialog')) {
    return { type: 'modal', label: 'Popup / Cửa sổ', icon: 'ph-bold ph-browser', badgeColor: '#ec4899' };
  }
  if (lowerName.includes('icon') || lowerName.includes('svg') || lowerName.includes('logo') || lowerName.includes('img')) {
    return { type: 'media', label: 'Biểu tượng / Hình ảnh', icon: 'ph-bold ph-image', badgeColor: '#64748b' };
  }
  if (lowerName.includes('heading') || lowerName.includes('msg') || lowerName.includes('text') || lowerName.includes('title')) {
    return { type: 'text', label: 'Đoạn văn / Tiêu đề', icon: 'ph-bold ph-text-t', badgeColor: '#6366f1' };
  }
  return { type: 'element', label: 'Phần tử giao diện', icon: 'ph-bold ph-crosshair', badgeColor: '#6b7280' };
}

/**
 * Sinh mô tả tiếng Việt dễ hiểu từ tên biến
 */
function inferHumanDescription(name, expr) {
  let cleanName = name
    .replace(/^(btn|txt|chk|icon|msg|lbl|opt|div)/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();

  // Trích xuất text hoặc role từ expression nếu có
  const nameMatch = expr.match(/name:\s*(?:'([^']*)'|"([^"]*)"|\/([^/]*)\/)/i);
  if (nameMatch) {
    const text = nameMatch[1] || nameMatch[2] || nameMatch[3];
    if (text) return `Phần tử hiển thị nhãn "${text.trim()}"`;
  }

  const textMatch = expr.match(/getByText\(\s*(?:'([^']*)'|"([^"]*)"|\/([^/]*)\/)/i);
  if (textMatch) {
    const text = textMatch[1] || textMatch[2] || textMatch[3];
    if (text) return `Văn bản chứa "${text.trim()}"`;
  }

  return cleanName.length > 0 ? `Thành phần ${cleanName}` : 'Phần tử giao diện';
}

const FIXTURE_ALLOWLIST = new Set([
  'core/fixtures/baseTest.js',
  'core/fixtures/mobileWebTest.js',
]);

/**
 * Bóc tách chi tiết một file Fixture (chỉ đọc, allowlist cho Inspector BDD/Studio - R01, T11)
 */
function extractExtendObjectBody(content) {
  const startIdx = content.indexOf('.extend(');
  if (startIdx === -1) return null;
  const openBrace = content.indexOf('{', startIdx);
  if (openBrace === -1) return null;

  let depth = 1;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  let endBrace = -1;

  for (let i = openBrace + 1; i < content.length; i++) {
    const char = content[i];
    const prev = content[i - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && char === '/') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (char === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (char === '/' && content[i + 1] === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && content[i + 1] === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        endBrace = i;
        break;
      }
    }
  }

  if (endBrace !== -1) {
    return content.slice(openBrace + 1, endBrace);
  }
  return null;
}

function parseExtendFixtures(content) {
  const extendBody = extractExtendObjectBody(content);
  if (!extendBody) return [];

  const items = [];
  let depthBraces = 0;
  let depthBrackets = 0;
  let depthParens = 0;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  let currentKey = '';
  let currentValue = '';
  let readingKey = true;

  for (let i = 0; i < extendBody.length; i++) {
    const char = extendBody[i];
    const prev = extendBody[i - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && char === '/') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (char === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (char === '/' && extendBody[i + 1] === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && extendBody[i + 1] === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') depthBraces++;
    else if (char === '}') depthBraces--;
    else if (char === '[') depthBrackets++;
    else if (char === ']') depthBrackets--;
    else if (char === '(') depthParens++;
    else if (char === ')') depthParens--;

    const isTopLevel = depthBraces === 0 && depthBrackets === 0 && depthParens === 0;

    if (isTopLevel && char === ':' && readingKey) {
      readingKey = false;
      continue;
    }

    if (isTopLevel && (char === ',' || i === extendBody.length - 1)) {
      if (i === extendBody.length - 1 && char !== ',') {
        currentValue += char;
      }
      const fixName = currentKey.trim();
      const val = currentValue.trim();
      if (fixName && /^[a-zA-Z0-9_]+$/.test(fixName)) {
        let cat = 'Đối tượng trang (Page Objects)';
        let badgeColor = '#10b981';
        let icon = 'ph-bold ph-browsers';
        let params = [];

        if (fixName.toLowerCase().includes('clean') || fixName.toLowerCase().includes('teardown')) {
          cat = 'Dọn dẹp & Hậu điều kiện';
          badgeColor = '#ef4444';
          icon = 'ph-bold ph-trash';
        } else if (fixName.includes('User') || fixName.includes('auth') || fixName.includes('worker')) {
          cat = 'Xác thực & Tiền điều kiện';
          badgeColor = '#8b5cf6';
          icon = 'ph-bold ph-user-circle';
        } else if (fixName.startsWith('create')) {
          cat = 'Khởi tạo đa tab / Popup';
          badgeColor = '#06b6d4';
          icon = 'ph-bold ph-tabs';
        } else if (fixName === 'pages' || fixName === 'pageClasses' || fixName === 'featureName' || fixName === 'basePage') {
          cat = 'Hạ tầng & Nền tảng';
          badgeColor = '#6366f1';
          icon = 'ph-bold ph-gear';
        } else if (fixName.includes('Hook') || fixName.includes('tracker') || fixName.includes('failure') || val.includes('auto: true')) {
          cat = 'Vòng đời & Hook';
          badgeColor = '#ef4444';
          icon = 'ph-bold ph-arrow-clockwise';
        } else if (val.includes('option: true') || fixName.startsWith('pageObjects')) {
          cat = 'Cấu hình & Tùy chọn';
          badgeColor = '#f59e0b';
          icon = 'ph-bold ph-sliders';
        }

        const argsMatch = val.match(/async\s*\(\s*([^)]*)\s*\)\s*=>/);
        if (argsMatch) {
          params = [argsMatch[1].trim()];
        } else if (val.includes('option: true')) {
          params = ['{ option: true }'];
        }

        items.push({
          name: fixName,
          params,
          signature: `${fixName}`,
          category: cat,
          badgeColor,
          icon,
          isFixture: true,
          description: `Fixture tự động nạp: ${fixName}`,
        });
      }

      currentKey = '';
      currentValue = '';
      readingKey = true;
      continue;
    }

    if (readingKey) {
      currentKey += char;
    } else {
      currentValue += char;
    }
  }

  return items;
}

function parseFixture(relativePath, rootDir = process.cwd()) {
  const safeRelativePath = String(relativePath || '').replace(/\\/g, '/');
  if (!FIXTURE_ALLOWLIST.has(safeRelativePath)) {
    throw new Error(`Đường dẫn fixture không nằm trong allowlist: ${relativePath}`);
  }
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file Fixture: ${relativePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const fixtureFileName = path.basename(relativePath, '.js');
  const isMobile = fixtureFileName === 'mobileWebTest';

  const meta = {
    title: isMobile ? 'Fixture Nền Tảng Mobile Web (mobileWebTest)' : 'Fixture Nền Tảng Desktop (baseTest)',
    desc: 'Playwright Fixture quản lý Dependency Injection và vòng đời kiểm thử.',
    icon: isMobile ? 'ph-device-mobile' : 'ph-lightning',
    platform: 'fixture',
    category: 'Fixture Nền tảng',
  };

  const fixtureItems = parseExtendFixtures(content);

  // Nếu là mobileWebTest, bổ sung các fixtures kế thừa từ baseTest nếu chưa có (T11, F04)
  if (isMobile) {
    const baseTestPath = path.join(rootDir, 'core', 'fixtures', 'baseTest.js');
    if (fs.existsSync(baseTestPath)) {
      try {
        const baseParsed = parseFixture('core/fixtures/baseTest.js', rootDir);
        for (const item of baseParsed.methods) {
          if (!fixtureItems.some((f) => f.name === item.name)) {
            fixtureItems.push({
              ...item,
              description: `Inherited từ baseTest: ${item.name}`,
            });
          }
        }
      } catch (_) {}
    }
  }

  // F05: Kiểm tra syntax và export thực tế
  const syntax = (() => {
    try {
      new Function(content);
      return true;
    } catch (_) {
      return false;
    }
  })();
  const exportReady = content.includes('module.exports') || content.includes('export ');
  const platformReady = safeRelativePath.startsWith('core/fixtures/');
  const checks = { syntax, export: exportReady, import: true, platform: platformReady };
  const passed = Object.values(checks).every(Boolean);

  return {
    relativePath: safeRelativePath,
    className: fixtureFileName,
    baseClass: isMobile ? 'baseTest' : '@playwright/test',
    title: meta.title,
    desc: meta.desc,
    icon: meta.icon,
    platform: 'fixture',
    category: meta.category,
    resourceKind: 'fixture',
    permissions: {
      canDelete: false,
      canAddLocator: false,
      canAddAction: false,
      canEditSource: true,
    },
    locatorCount: 0,
    methodCount: fixtureItems.length,
    locators: [],
    methods: fixtureItems,
    fixtureName: fixtureFileName,
    readiness: {
      status: passed ? 'ready' : (syntax ? 'blocked' : 'error'),
      ready: passed,
      checks,
      reason: passed ? null : Object.entries(checks).filter(([, value]) => !value).map(([key]) => key).join(', '),
    },
    rawCode: content,
  };
}

/**
 * Bóc tách chi tiết một file Page Object (hoặc Fixture allowlist)
 */
function parsePageObject(relativePath, rootDir = process.cwd()) {
  const normRel = String(relativePath || '').replace(/\\/g, '/');
  if (FIXTURE_ALLOWLIST.has(normRel)) {
    return parseFixture(normRel, rootDir);
  }

  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file Page Object: ${relativePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const safeRelativePath = normalizePagePath(path.relative(rootDir, fullPath));
  const normalizedRel = safeRelativePath.replace(/^pages\//, '');
  const isMobile = relativePath.includes('mobile-web') || relativePath.includes('mobile/');
  const isBase = path.basename(relativePath) === 'BasePage.js';

  // 1. Class name & Base class
  const classMatch = content.match(/class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/);
  const className = classMatch ? classMatch[1] : path.basename(relativePath, '.js');
  const baseClass = classMatch ? classMatch[2] || 'None' : 'None';

  // 2. Metadata
  const meta = PAGE_METADATA[normalizedRel] || {
    title: className,
    desc: `Page Object quản lý tương tác trên ${className}`,
    icon: isMobile ? 'ph-device-mobile' : 'ph-browsers',
    platform: isBase ? 'base' : (isMobile ? 'mobile-web' : 'desktop'),
    category: isMobile ? 'Mobile Web' : 'Desktop Web',
  };

  // 3. Trích xuất Locators từ constructor
  const locators = [];
  const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*(\}\s*\n|\}\s*$)/);
  if (constructorMatch) {
    const constructorBody = constructorMatch[1];
    const lines = constructorBody.split('\n');

    let currentVar = '';
    let currentExprLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('super(')) continue;

      const assignMatch = line.match(/^this\.([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
      if (assignMatch) {
        if (currentVar) {
          const fullExpr = currentExprLines.join(' ').replace(/;$/, '').trim();
          if (fullExpr.includes('page') || fullExpr.includes('locator') || fullExpr.includes('getBy')) {
            const cat = inferElementCategory(currentVar, fullExpr);
            locators.push({
              name: currentVar,
              expression: fullExpr,
              category: cat.type,
              categoryLabel: cat.label,
              categoryIcon: cat.icon,
              badgeColor: cat.badgeColor,
              description: inferHumanDescription(currentVar, fullExpr),
            });
          }
        }
        currentVar = assignMatch[1];
        currentExprLines = [assignMatch[2]];
      } else if (currentVar) {
        currentExprLines.push(line);
      }

      if (line.endsWith(';') && currentVar) {
        const fullExpr = currentExprLines.join(' ').replace(/;$/, '').trim();
        if (fullExpr.includes('page') || fullExpr.includes('locator') || fullExpr.includes('getBy')) {
          const cat = inferElementCategory(currentVar, fullExpr);
          locators.push({
            name: currentVar,
            expression: fullExpr,
            category: cat.type,
            categoryLabel: cat.label,
            categoryIcon: cat.icon,
            badgeColor: cat.badgeColor,
            description: inferHumanDescription(currentVar, fullExpr),
          });
        }
        currentVar = '';
        currentExprLines = [];
      }
    }
  }

  // 4. Trích xuất Actions (chỉ các hàm async method hợp lệ của class)
  const methods = [];
  const methodRegex = /async\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\}/g;
  const reservedKeywords = new Set([
    'constructor', '_capture', 'for', 'if', 'while', 'catch', 'switch', 'function', 'return', 'try', 'finally'
  ]);
  let mMatch;
  while ((mMatch = methodRegex.exec(content)) !== null) {
    const methodName = mMatch[1];
    if (reservedKeywords.has(methodName) || methodName.startsWith('_')) {
      continue;
    }
    const params = mMatch[2].trim().split(',').map((p) => p.trim()).filter(Boolean);
    const body = mMatch[3].trim();
    const callsCapture = body.includes('capture(');
    const isNavigation = body.includes('goto(') || body.includes('navigate(');
    const isAssertion = body.includes('expect(');

    methods.push({
      name: methodName,
      params,
      hasCapture: callsCapture,
      isNavigation,
      isAssertion,
      signature: `${methodName}(${params.join(', ')})`,
    });
  }

  const isFoundation = Boolean(isBase || meta.isBase);
  return {
    relativePath: safeRelativePath,
    className,
    baseClass,
    title: meta.title,
    desc: meta.desc,
    icon: meta.icon,
    platform: meta.platform,
    category: meta.category,
    isBase: isFoundation,
    resourceKind: isFoundation ? 'foundation' : 'page',
    permissions: {
      canDelete: !isFoundation,
      canAddLocator: !isFoundation,
      canAddAction: !isFoundation,
      canEditSource: true,
    },
    locatorCount: locators.length,
    methodCount: methods.length,
    locators,
    methods,
    fixtureName: className.charAt(0).toLowerCase() + className.slice(1),
    readiness: getReadiness({ relativePath: safeRelativePath, className, baseClass, content }),
    rawCode: content,
  };
}

/**
 * Quét toàn bộ Page Objects trong framework (chỉ thuộc pages/)
 */
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

/**
 * Cập nhật một selector của locator trực tiếp trong file Page Object
 */
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

  // Tìm vị trí khai báo this.<name> = ...
  const regex = new RegExp(`(this\\.${locatorName}\\s*=\\s*)([\\s\\S]*?)(;\\s*\\n|;\\s*$)`);
  if (!regex.test(originalContent)) {
    throw new Error(`Không tìm thấy khai báo phần tử "this.${locatorName}" trong file ${path.basename(fullPath)}`);
  }

  // Chuẩn hóa biểu thức mới
  const cleanRhs = cleanExpression.startsWith('this.') ? cleanExpression : `this.${cleanExpression}`;

  const updatedContent = originalContent.replace(regex, `$1${cleanRhs}$3`);

  // Tạo backup an toàn
  const backupDir = path.join(rootDir, '.dashboard-backups', 'pages');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = `${path.basename(fullPath)}.${Date.now()}.bak`;
  fs.copyFileSync(fullPath, path.join(backupDir, backupFile));

  // Ghi file mới
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

/**
 * Cung cấp thông tin trực quan cho 5 Trụ Cột Năng Lực Core (Core Capability Map)
 */
function getCoreCapabilities(rootDir = process.cwd()) {
  return [
    {
      id: 'core_data_manager',
      title: 'Trợ Thủ Dữ Liệu Test (No-Code Data Studio)',
      desc: 'Quản lý tập trung các bộ dữ liệu người dùng, hồ sơ, ứng tuyển dạng bảng tính. Hỗ trợ import/export CSV và cơ chế tự sinh biến động chống trùng lặp dữ liệu.',
      icon: 'ph-database',
      color: '#3b82f6',
      tags: ['dataManager.js', '{{random_phone}}', 'CSV Import/Export'],
      status: 'Đang hoạt động (5 datasets)',
      linkTab: 'data-view',
      linkLabel: 'Mở tab Dữ liệu test',
    },
    {
      id: 'core_smart_evidence',
      title: 'Bằng Chứng Thông Minh (Smart DOM Evidence Capture)',
      desc: 'Tự động soi DOM thời gian thực: Tự động chụp Full Page toàn cảnh khi không có popup; Tự động chụp Viewport khi có Modal/Dialog để chống vỡ giao diện và lệch backdrop.',
      icon: 'ph-camera',
      color: '#8b5cf6',
      tags: ['ScreenshotHelper', 'AI_PROMPTS.md Sec 7', 'Smart Detection'],
      status: 'Đã tích hợp DOM Detection',
      linkTab: 'resources-view',
      linkLabel: 'Xem báo cáo & evidence',
    },
    {
      id: 'core_anti_flaky',
      title: 'Bộ Chống Flaky & Ổn Định Giao Diện (Anti-Flaky Wait)',
      desc: 'Loại bỏ hoàn toàn hardcoded sleep. Tự động chờ networkidle, chờ Skeleton loader và animation biến mất trước khi thao tác. 100% Page Objects kế thừa.',
      icon: 'ph-shield-check',
      color: '#10b981',
      tags: ['BasePage.js', 'UiActions', 'Skeleton Wait', 'NetworkIdle'],
      status: '15/15 Page Objects áp dụng',
      linkTab: 'code-view',
      linkLabel: 'Xem BasePage.js',
    },
    {
      id: 'core_auth_precondition',
      title: 'Fixture Đăng Nhập Nền Nhanh (Auth Precondition)',
      desc: 'Tự động tạo tài khoản hoặc nạp token xác thực ngầm qua API trong 1 giây, các kịch bản kiểm thử không cần gõ lại mật khẩu từ đầu, tiết kiệm 15-20s mỗi lần chạy.',
      icon: 'ph-key',
      color: '#f59e0b',
      tags: ['baseTest.js', 'authSetup.js', 'registrationApiHelper.js'],
      status: 'Tích hợp trong tất cả E2E Specs',
      linkTab: 'builder-view',
      linkLabel: 'Xem kịch bản BDD',
    },
    {
      id: 'core_spec_compiler',
      title: 'Trình Biên Dịch Kịch Bản BDD (Spec Generator & Guard)',
      desc: 'Chuyển đổi trực tiếp các khối hành động kéo thả dạng khối tiếng Việt sang mã Playwright Test chuẩn BDD Given/When/Then, tự động kiểm tra cú pháp và backup trước khi ghi.',
      icon: 'ph-tree-structure',
      color: '#ec4899',
      tags: ['visualBuilderCompiler.js', 'recordParser.js', 'actionRegistry.js'],
      status: 'Điều phối 12 kịch bản BDD',
      linkTab: 'builder-view',
      linkLabel: 'Mở BDD Studio',
    },
  ];
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

function deletePageObject(relativePath, rootDir = path.resolve(__dirname, '../..')) {
  const normalized = normalizePagePath(relativePath);
  if (normalized === 'pages/BasePage.js') {
    throw new Error('Không thể xóa BasePage.js vì đây là lớp nền tảng dùng chung của toàn bộ framework.');
  }
  const fullPath = path.join(rootDir, normalized);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Page Object ${normalized} không tồn tại.`);
  }

  // Tao backup truoc khi xoa
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

const FIXTURE_METADATA_VI = {
  workerUserData: {
    title: 'Dữ liệu người dùng theo worker',
    description: 'Cung cấp tài khoản test cô lập cho từng luồng worker song song.',
    category: 'Xác thực & Tiền điều kiện',
  },
  featureName: {
    title: 'Tên tính năng kiểm thử',
    description: 'Tự động trích xuất tên tính năng từ đường dẫn file test.',
    category: 'Hạ tầng & Nền tảng',
  },
  basePage: {
    title: 'Trang cơ sở (BasePage)',
    description: 'Lớp nền tảng chứa các tiện ích điều hướng và tương tác trình duyệt chung.',
    category: 'Hạ tầng & Nền tảng',
  },
  pageObjectsRoot: {
    title: 'Đường dẫn gốc Page Objects',
    description: 'Cấu hình thư mục chứa các đối tượng trang dùng trong kịch bản.',
    category: 'Cấu hình & Tùy chọn',
  },
  pageObjectsPlatform: {
    title: 'Nền tảng thực thi (Platform)',
    description: 'Chỉ định nền tảng (Desktop / Mobile Web) để nạp Page Object tương ứng.',
    category: 'Cấu hình & Tùy chọn',
  },
  pages: {
    title: 'Bộ điều phối Page Objects (pages)',
    description: 'Container truy cập nhanh tất cả Page Objects: pages.loginPage, pages.dashboardPage...',
    category: 'Hạ tầng & Nền tảng',
  },
  authenticatedUser: {
    title: 'Phiên đăng nhập tự động',
    description: 'Tự động xác thực tài khoản và duy trì trạng thái đăng nhập trước khi chạy test.',
    category: 'Xác thực & Tiền điều kiện',
  },
  cleanupQueue: {
    title: 'Hàng đợi dọn dẹp sau test',
    description: 'Tự động thu hồi và dọn dẹp tài nguyên (xóa tài khoản, reset dữ liệu) sau khi test hoàn tất.',
    category: 'Dọn dẹp & Hậu điều kiện',
  },
  failureTrackerHook: {
    title: 'Hook giám sát lỗi kiểm thử',
    description: 'Tự động chụp ảnh màn hình, thu thập console log khi kịch bản test thất bại.',
    category: 'Vòng đời & Hook',
  },
  ephemeralUser: {
    title: 'Tài khoản người dùng tạm thời',
    description: 'Tự động tạo user mới trước test và dọn dẹp ngay sau khi test kết thúc.',
    category: 'Dọn dẹp & Tùy biến',
  },
};

/**
 * Quét toàn bộ Fixtures (gồm Core fixtures và Custom fixtures tạo từ Dashboard)
 */
function scanAllFixtures(rootDir = process.cwd()) {
  const allFixtures = [];
  const coreFiles = ['core/fixtures/baseTest.js', 'core/fixtures/mobileWebTest.js'];

  // 1. Quét Core Fixtures
  for (const rel of coreFiles) {
    try {
      const parsed = parseFixture(rel, rootDir);
      for (const item of parsed.methods) {
        if (!allFixtures.some((f) => f.name === item.name)) {
          const viMeta = FIXTURE_METADATA_VI[item.name] || {};
          allFixtures.push({
            name: item.name,
            title: viMeta.title || item.title || item.name,
            description: viMeta.description || item.description || `Fixture tự động nạp: ${item.name}`,
            category: viMeta.category || item.category || 'Hạ tầng & Nền tảng',
            badgeColor: item.badgeColor || '#6366f1',
            icon: item.icon || 'ph-bold ph-gear',
            params: item.params || [],
            signature: item.signature || item.name,
            isCustom: false,
            canDelete: false,
            sourceFile: rel,
            scope: item.name === 'workerUserData' ? 'worker' : 'test',
          });
        }
      }
    } catch (_) {}
  }

  // 2. Quét Custom Fixtures: Ưu tiên fixtures/custom/ (canonical) sau đó core/fixtures/custom/ (legacy)
  const candidateDirs = [
    { dir: path.join(rootDir, 'fixtures', 'custom'), isCanonical: true },
    { dir: path.join(rootDir, 'core', 'fixtures', 'custom'), isCanonical: false },
  ];

  for (const { dir, isCanonical } of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.fixture.js') || (entry.name.endsWith('.js') && entry.name !== 'index.js'))) {
        const fixName = path.basename(entry.name, '.fixture.js').replace(/\.js$/, '');
        if (allFixtures.some((f) => f.name === fixName)) continue; // Không duplicate

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const revision = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex').slice(0, 16);

        const titleMatch = fileContent.match(/@title\s+([^\n]+)/);
        const descMatch = fileContent.match(/@description\s+([^\n]+)/);
        const catMatch = fileContent.match(/@category\s+([^\n]+)/);
        const viMeta = FIXTURE_METADATA_VI[fixName] || {};

        allFixtures.push({
          name: fixName,
          title: titleMatch ? titleMatch[1].trim() : (viMeta.title || fixName),
          description: descMatch ? descMatch[1].trim() : (viMeta.description || `Fixture nghiệp vụ tùy biến: ${fixName}`),
          category: catMatch ? catMatch[1].trim() : (viMeta.category || 'Dọn dẹp & Tùy biến'),
          badgeColor: '#10b981',
          icon: 'ph-bold ph-sparkle',
          params: ['{ request, pages }'],
          signature: fixName,
          isCustom: true,
          canDelete: true,
          isCanonical,
          sourceFile: relPath,
          rawCode: fileContent,
          revision,
          scope: 'test',
        });
      }
    }
  }

  return allFixtures;
}

const RESERVED_FIXTURE_NAMES = new Set([
  'test', 'expect', 'page', 'request', 'browser', 'context',
  'basePage', 'pages', 'workerUserData', 'authenticatedUser',
  'cleanupQueue', 'featureName', 'pageObjectsRoot', 'pageObjectsPlatform',
  'isMobile', 'viewport', 'browserName', 'storageState',
]);

/**
 * Tìm kiếm đường dẫn file fixture của một custom fixture
 */
function findCustomFixturePath(name, rootDir = process.cwd()) {
  const canonicalPath = path.join(rootDir, 'fixtures', 'custom', `${name}.fixture.js`);
  if (fs.existsSync(canonicalPath)) return { fullPath: canonicalPath, isCanonical: true };

  const legacyPath = path.join(rootDir, 'core', 'fixtures', 'custom', `${name}.fixture.js`);
  if (fs.existsSync(legacyPath)) return { fullPath: legacyPath, isCanonical: false };

  return null;
}

/**
 * Lấy thông tin chi tiết của một fixture theo tên (Core hoặc Custom)
 */
function getFixtureByName(name, rootDir = process.cwd()) {
  if (!name) return null;
  const all = scanAllFixtures(rootDir);
  const found = all.find((f) => f.name === name);
  if (found) return found;

  const fileInfo = findCustomFixturePath(name, rootDir);
  if (fileInfo) {
    const content = fs.readFileSync(fileInfo.fullPath, 'utf8');
    const revision = crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
    return {
      name,
      title: name,
      description: `Custom Fixture: ${name}`,
      category: 'Dọn dẹp & Nghiệp vụ tùy biến',
      isCustom: true,
      canDelete: true,
      isCanonical: fileInfo.isCanonical,
      sourceFile: path.relative(rootDir, fileInfo.fullPath).replace(/\\/g, '/'),
      rawCode: content,
      revision,
      scope: 'test',
    };
  }
  return null;
}

/**
 * Phân tích và kiểm tra cú pháp tĩnh cho một custom fixture mà không ghi ra disk
 */
function validateCustomFixtureSource({ name, sourceCode, rootDir = process.cwd() }) {
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

/**
 * Tạo một Custom Fixture mới an toàn từ Dashboard Studio Form Wizard
 */
function createCustomFixture({ name, title, description, category, template, config = {}, rawCode, rootDir = process.cwd() }) {
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Tên fixture không hợp lệ: '${name}'. Tên phải bắt đầu bằng chữ cái và chỉ chứa chữ, số, gạch dưới.`);
  }
  if (RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Tên fixture '${name}' trùng với từ khóa hoặc Core Fixture nền tảng đã được bảo vệ.`);
  }

  // Ưu tiên lưu vào canonical consumer directory: fixtures/custom/
  // Nếu thư mục fixtures/custom chưa tồn tại nhưng core/fixtures/custom đã có (cho backward compat trong test runner độc lập)
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

  let generatedCode = '';
  const safeTitle = title || name;
  const safeDesc = description || `Custom Fixture ${name}`;
  const safeCategory = category || (template === 'cleanup_api' ? 'Dọn dẹp & Teardown' : 'Xác thực & Precondition');

  if (template === 'cleanup_api') {
    const url = config.url || '/api/resource';
    const method = (config.method || 'DELETE').toUpperCase();
    const headers = config.headers ? JSON.stringify(config.headers, null, 2) : '{}';

    generatedCode = `/**
 * @title ${safeTitle}
 * @description ${safeDesc}
 * @category ${safeCategory}
 */
const ${name} = async ({ request }, use, testInfo) => {
  // Dữ liệu ngữ cảnh khởi tạo trước test (Setup)
  const context = {
    id: null,
    targetUrl: '${url}',
    payload: null,
  };

  try {
    // Bàn giao context cho kịch bản test thực thi
    await use(context);
  } finally {
    // Tự động dọn dẹp sau khi test kết thúc (Teardown fail-safe)
    await testInfo.attach('teardown_log', {
      body: \`Bắt đầu dọn dẹp qua API: \${context.targetUrl}\`,
      contentType: 'text/plain'
    });
    try {
      if (context.id) {
        const deleteEndpoint = context.targetUrl.replace(/:id/g, context.id);
        await request.${method.toLowerCase()}(deleteEndpoint, {
          headers: ${headers}
        });
        console.log(\`[Teardown \${'${name}'}] Đã xóa thành công resource ID: \${context.id}\`);
      }
    } catch (err) {
      console.warn(\`[Teardown \${'${name}'} Warning] Không thể xóa resource: \${err.message}\`);
    }
  }
};

module.exports = { ${name} };
`;
  } else if (template === 'precondition_data') {
    generatedCode = `/**
 * @title ${safeTitle}
 * @description ${safeDesc}
 * @category ${safeCategory}
 */
const ${name} = async ({ request }, use, testInfo) => {
  // 1. SETUP: Chuẩn bị dữ liệu trước khi test
  const data = {
    timestamp: Date.now(),
    role: 'standard_user',
    token: null,
  };

  try {
    // 2. USE: Cung cấp data cho test
    await use(data);
  } finally {
    // 3. TEARDOWN: Khôi phục trạng thái
    console.log(\`[Teardown \${'${name}'}] Hoàn tất dọn dẹp data thử nghiệm.\`);
  }
};

module.exports = { ${name} };
`;
  } else {
    // Custom Code do người dùng tự viết
    if (!rawCode || typeof rawCode !== 'string') {
      throw new Error('Vui lòng cung cấp mã nguồn cho custom fixture.');
    }
    generatedCode = rawCode;
  }

  // Kiểm tra cú pháp JS an toàn
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

/**
 * Cập nhật mã nguồn một Custom Fixture kèm kiểm tra revision (Optimistic Concurrency Control)
 */
function updateCustomFixture({ name, sourceCode, expectedRevision, rootDir = process.cwd() }) {
  if (!name || RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Không thể chỉnh sửa fixture nền tảng hoặc tên không hợp lệ: '${name}'.`);
  }
  const fileInfo = findCustomFixturePath(name, rootDir);
  if (!fileInfo) {
    throw new Error(`Không tìm thấy file của fixture '${name}' để cập nhật.`);
  }

  const currentContent = fs.readFileSync(fileInfo.fullPath, 'utf8');
  const currentRevision = crypto.createHash('sha256').update(currentContent, 'utf8').digest('hex').slice(0, 16);

  if (expectedRevision && expectedRevision !== currentRevision) {
    const conflictErr = new Error(`Conflict: Fixture '${name}' đã bị thay đổi bởi phiên làm việc khác (Revision hiện tại: ${currentRevision}, Revision gửi lên: ${expectedRevision}). Vui lòng tải lại trước khi lưu.`);
    conflictErr.code = 'CONFLICT';
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  // Kiểm tra cú pháp mã mới
  try {
    new Function(sourceCode);
  } catch (err) {
    throw new Error(`Mã nguồn fixture có lỗi cú pháp JavaScript: ${err.message}`);
  }

  // Backup trước khi ghi đè
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

/**
 * Xóa một Custom Fixture kèm backup và kiểm tra revision tùy chọn
 */
function deleteCustomFixture(name, rootDir = process.cwd(), expectedRevision = null) {
  if (RESERVED_FIXTURE_NAMES.has(name)) {
    throw new Error(`Không thể xóa Core Fixture nền tảng '${name}'. Thao tác bị cấm.`);
  }

  const fileInfo = findCustomFixturePath(name, rootDir);
  if (!fileInfo) {
    throw new Error(`Không tìm thấy custom fixture '${name}' để xóa.`);
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

  // Backup trước khi xóa
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
  PAGE_METADATA,
  FIXTURE_ALLOWLIST,
  parseFixture,
  parsePageObject,
  scanAllPageObjects,
  scanAllFixtures,
  getFixtureByName,
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
  updateLocatorSelector,
  getCoreCapabilities,
  createPageObject,
  deletePageObject,
  inferElementCategory,
  inferHumanDescription,
  validateLocatorExpression,
  normalizePagePath,
};
