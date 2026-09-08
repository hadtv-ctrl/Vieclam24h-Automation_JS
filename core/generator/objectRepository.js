const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PAGE_ROOTS = ['pages/', 'pages/desktop/', 'pages/mobile-web/', 'core/fixtures/'];
const LOCATOR_EXPRESSION = /^(?:this\.)?page\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText|getByAltText|getByTitle)\s*\(/;

function normalizePagePath(relativePath) {
  const value = String(relativePath || '').replace(/\\/g, '/');
  if (path.isAbsolute(value) || value.includes('..') || (!value.startsWith('pages/') && !value.startsWith('core/fixtures/'))) {
    throw new Error('Đường dẫn phải thuộc thư mục pages/ hoặc core/fixtures/.');
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
  const isFixture = relativePath.startsWith('core/fixtures/');
  const syntax = (() => {
    try { new Function(content); return true; } catch (_) { return false; }
  })();
  if (isFixture) {
    const exportReady = /module\.exports\s*=\s*\{[^}]*test\b/.test(content);
    const importReady = /require\(['"][^'"]+['"]\)/.test(content);
    const platformReady = true;
    const checks = { syntax, export: exportReady, import: importReady, platform: platformReady };
    const passed = Object.values(checks).every(Boolean);
    return { status: passed ? 'ready' : 'blocked', ready: passed, checks, reason: passed ? null : Object.entries(checks).filter(([, value]) => !value).map(([key]) => key).join(', ') };
  }
  const exportReady = new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${className}\\b`).test(content);
  const importReady = /require\(['"][^'"]+['"]\)/.test(content) || baseClass === 'BasePage';
  const platformReady = relativePath.startsWith('pages/') || relativePath.startsWith('core/fixtures/');
  const checks = { syntax, export: exportReady, import: importReady, platform: platformReady };
  const passed = Object.values(checks).every(Boolean);
  return { status: passed ? 'ready' : 'blocked', ready: passed, checks, reason: passed ? null : Object.entries(checks).filter(([, value]) => !value).map(([key]) => key).join(', ') };
}

/**
 * Metadata thông tin thân thiện cho toàn bộ Page Objects
 */
const PAGE_METADATA = {
  'BasePage.js': {
    title: 'Trang Cơ Sở (BasePage)',
    desc: 'Lớp nền tảng chứa cơ chế Anti-Flaky Wait, Smart Evidence Capture và điều hướng an toàn.',
    icon: 'ph-stack',
    platform: 'base',
    category: 'Nền tảng',
  },
  'desktop/HomePage.js': {
    title: 'Trang Chủ & Menu Việc Làm',
    desc: 'Trang chủ Việc Làm 24h, menu điều hướng, popup chào mừng và các lối tắt tìm việc.',
    icon: 'ph-house',
    platform: 'desktop',
    category: 'Trang chính',
  },
  'desktop/JobSearchPage.js': {
    title: 'Trang Tìm Kiếm Việc Làm',
    desc: 'Bộ lọc công việc, kết quả danh sách việc làm, phân trang và thông tin tin tuyển dụng.',
    icon: 'ph-magnifying-glass',
    platform: 'desktop',
    category: 'Tìm việc',
  },
  'desktop/JobApplyNoCVPage.js': {
    title: 'Quy Trình Ứng Tuyển Không Cần CV',
    desc: 'Nộp đơn ứng tuyển nhanh bằng Mini-Profile, xác thực OTP điện thoại và ứng tuyển hàng loạt.',
    icon: 'ph-paper-plane-tilt',
    platform: 'desktop',
    category: 'Ứng tuyển',
  },
  'desktop/JobApplyPage.js': {
    title: 'Quy Trình Ứng Tuyển Với CV',
    desc: 'Nộp đơn ứng tuyển chuẩn có đính kèm tệp CV PDF/Word hoặc CV tạo trực tuyến.',
    icon: 'ph-file-text',
    platform: 'desktop',
    category: 'Ứng tuyển',
  },
  'desktop/UserProfilePage.js': {
    title: 'Quản Lý Hồ Sơ & Trợ Lý AI',
    desc: 'Cập nhật học vấn, kinh nghiệm, thông tin cá nhân và tạo nội dung bằng trợ lý AI.',
    icon: 'ph-user-circle',
    platform: 'desktop',
    category: 'Người tìm việc',
  },
  'desktop/LoginPopup.js': {
    title: 'Popup Đăng Nhập',
    desc: 'Cửa sổ đăng nhập người tìm việc bằng số điện thoại, email hoặc mật khẩu.',
    icon: 'ph-sign-in',
    platform: 'desktop',
    category: 'Tài khoản',
  },
  'desktop/OnboardingPopup.js': {
    title: 'Popup Giới Thiệu (Onboarding)',
    desc: 'Popup khảo sát và thiết lập tiêu chí nghề nghiệp ban đầu cho người dùng mới.',
    icon: 'ph-sparkle',
    platform: 'desktop',
    category: 'Tài khoản',
  },
  'desktop/PopupConsent.js': {
    title: 'Popup Đồng Ý Chính Sách',
    desc: 'Popup chấp thuận điều khoản dịch vụ và chính sách bảo vệ dữ liệu cá nhân.',
    icon: 'ph-shield-check',
    platform: 'desktop',
    category: 'Chính sách',
  },
  'mobile-web/MobileHomePage.js': {
    title: 'Trang Chủ Mobile Web',
    desc: 'Giao diện trang chủ tối ưu cho trình duyệt điện thoại Android và iOS.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileJobSearchPage.js': {
    title: 'Tìm Kiếm Việc Làm Mobile',
    desc: 'Trang tìm kiếm việc làm và lọc nhanh trên thiết bị di động.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileJobApplyNoCVPage.js': {
    title: 'Ứng Tuyển Không Cần CV Mobile',
    desc: 'Quy trình nộp hồ sơ nhanh không cần CV trên trình duyệt di động.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileLoginPopup.js': {
    title: 'Popup Đăng Nhập Mobile',
    desc: 'Popup đăng nhập responsive trên màn hình điện thoại.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileOnboardingPopup.js': {
    title: 'Popup Onboarding Mobile',
    desc: 'Cửa sổ chào mừng và hoàn thiện hồ sơ ban đầu trên mobile.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobilePopupConsent.js': {
    title: 'Popup Chính Sách Mobile',
    desc: 'Cửa sổ xác nhận điều khoản và chính sách riêng tư trên mobile.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileJobApplyPage.js': {
    title: 'Ứng Tuyển Việc Làm Mobile',
    desc: 'Trang nộp hồ sơ ứng tuyển bằng CV hoặc Profile trực tuyến trên trình duyệt mobile.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'mobile-web/MobileUserProfilePage.js': {
    title: 'Hồ Sơ Của Tôi Mobile',
    desc: 'Quản lý thông tin cá nhân, tiêu chí tìm việc và CV trên thiết bị di động.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
  'core/fixtures/baseTest.js': {
    title: 'Fixture Nền Tảng Desktop (baseTest)',
    desc: 'Fixture gốc cho Desktop: Quản lý Precondition, Injected Page Objects và Worker Sessions.',
    icon: 'ph-lightning',
    platform: 'fixture',
    category: 'Fixture Nền tảng',
  },
  'core/fixtures/mobileWebTest.js': {
    title: 'Fixture Nền Tảng Mobile Web (mobileWebTest)',
    desc: 'Fixture mở rộng cho Mobile Web: Kế thừa baseTest, nạp Mobile Page Objects và Failure Tracing.',
    icon: 'ph-device-mobile',
    platform: 'fixture',
    category: 'Fixture Nền tảng',
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

/**
 * Bóc tách chi tiết một file Page Object
 */
function parsePageObject(relativePath, rootDir = process.cwd()) {
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file Page Object: ${relativePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const safeRelativePath = normalizePagePath(path.relative(rootDir, fullPath));
  const normalizedRel = safeRelativePath.replace(/^pages\//, '');
  const isFixture = safeRelativePath.startsWith('core/fixtures/');
  const isMobile = relativePath.includes('mobile-web') || relativePath.includes('mobileWebTest');
  const isBase = path.basename(relativePath) === 'BasePage.js';

  if (isFixture) {
    const fixtureFileName = path.basename(relativePath, '.js');
    const meta = PAGE_METADATA[safeRelativePath] || {
      title: fixtureFileName === 'baseTest' ? 'Fixture Nền Tảng Desktop (baseTest)' : 'Fixture Nền Tảng Mobile Web (mobileWebTest)',
      desc: 'Playwright Fixture quản lý Dependency Injection và vòng đời kiểm thử.',
      icon: fixtureFileName === 'mobileWebTest' ? 'ph-device-mobile' : 'ph-lightning',
      platform: 'fixture',
      category: 'Fixture Nền tảng',
    };

    const fixtureItems = [];
    const extendMatch = content.match(/\.extend\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (extendMatch) {
      const extendBody = extendMatch[1];
      const fixRegex = /([a-zA-Z0-9_]+)\s*:\s*async\s*\(\s*([^)]*)\s*\)\s*=>/g;
      let fMatch;
      while ((fMatch = fixRegex.exec(extendBody)) !== null) {
        const fixName = fMatch[1];
        const fixArgs = fMatch[2].trim();
        let cat = 'Page Object Injection';
        let badgeColor = '#10b981';
        let icon = 'ph-bold ph-browsers';
        if (fixName.includes('User') || fixName.includes('auth') || fixName.includes('worker')) {
          cat = 'Xác thực & Precondition';
          badgeColor = '#8b5cf6';
          icon = 'ph-bold ph-user-circle';
        } else if (fixName.startsWith('create')) {
          cat = 'Factory (Multi-Tab / Popup)';
          badgeColor = '#06b6d4';
          icon = 'ph-bold ph-tabs';
        } else if (fixName === 'pageClasses' || fixName === 'featureName' || fixName === 'basePage') {
          cat = 'Hạ tầng & Nền tảng';
          badgeColor = '#6366f1';
          icon = 'ph-bold ph-gear';
        }

        fixtureItems.push({
          name: fixName,
          params: fixArgs ? [fixArgs] : [],
          signature: `${fixName}`,
          category: cat,
          badgeColor,
          icon,
          isFixture: true,
          description: `Injected Fixture: ${fixName}`,
        });
      }
    }

    return {
      relativePath: safeRelativePath,
      className: fixtureFileName,
      baseClass: fixtureFileName === 'mobileWebTest' ? 'baseTest' : '@playwright/test',
      title: meta.title,
      desc: meta.desc,
      icon: meta.icon,
      platform: 'fixture',
      category: meta.category,
      locatorCount: 0,
      methodCount: fixtureItems.length,
      locators: [],
      methods: fixtureItems,
      fixtureName: fixtureFileName,
      readiness: getReadiness({ relativePath: safeRelativePath, className: fixtureFileName, baseClass: 'none', content }),
      rawCode: content,
    };
  }

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

  return {
    relativePath: safeRelativePath,
    className,
    baseClass,
    title: meta.title,
    desc: meta.desc,
    icon: meta.icon,
    platform: meta.platform,
    category: meta.category,
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
 * Quét toàn bộ 15 Page Objects trong framework
 */
function scanAllPageObjects(rootDir = process.cwd()) {
  const pagesDir = path.join(rootDir, 'pages');
  const fixturesDir = path.join(rootDir, 'core', 'fixtures');
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
  visit(fixturesDir);
  return results.sort((a, b) => {
    if (a.platform === 'base') return -1;
    if (b.platform === 'base') return 1;
    if (a.platform === 'fixture' && b.platform !== 'fixture') return 1;
    if (b.platform === 'fixture' && a.platform !== 'fixture') return -1;
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

module.exports = {
  PAGE_METADATA,
  parsePageObject,
  scanAllPageObjects,
  updateLocatorSelector,
  getCoreCapabilities,
  createPageObject,
  deletePageObject,
  inferElementCategory,
  inferHumanDescription,
  validateLocatorExpression,
  normalizePagePath,
};
