const fs = require('fs');
const path = require('path');

// Danh sách thuộc tính runtime introspection cần bỏ qua để không kích hoạt Proxy loader (T09)
const RESERVED_PROPERTIES = new Set([
  'then',
  'toJSON',
  'inspect',
  'constructor',
  'prototype',
  '__proto__',
  'valueOf',
  'toString',
  'toLocaleString',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'hasOwnProperty',
]);

/**
 * Xác định project root của consumer theo thứ tự ưu tiên (R03):
 * explicit rootDir -> QA_PROJECT_ROOT -> process.cwd()
 */
function resolveProjectRoot(explicitRoot) {
  if (explicitRoot) {
    const resolved = path.resolve(explicitRoot);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[PageContainer] Thư mục pageObjectsRoot '${explicitRoot}' không tồn tại.`);
    }
    return resolved;
  }
  if (process.env.QA_PROJECT_ROOT) {
    const resolved = path.resolve(process.env.QA_PROJECT_ROOT);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[PageContainer] Biến môi trường QA_PROJECT_ROOT='${process.env.QA_PROJECT_ROOT}' trỏ tới đường dẫn không tồn tại.`);
    }
    return resolved;
  }
  return process.cwd();
}

/**
 * Chuẩn hóa tên thuộc tính truy cập thành tên file / class Page Object tương ứng
 * Ví dụ:
 * - 'sample' -> 'SamplePage'
 * - 'samplePage' -> 'SamplePage'
 * - 'SamplePage' -> 'SamplePage'
 * - 'jobDetail' -> 'JobDetailPage'
 * - 'job_detail' -> 'JobDetailPage'
 */
function resolvePageClassName(propName) {
  if (!propName || typeof propName !== 'string') return null;

  // Kiểm tra chống Path Traversal (T10)
  if (/[\/\\.]/.test(propName)) {
    throw new Error(`[PageContainer] Tên thuộc tính không hợp lệ (chứa ký tự traversal): '${propName}'`);
  }

  const words = propName
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  let combined = words.join('');
  if (!combined) return null;

  if (!combined.endsWith('Page')) {
    combined += 'Page';
  } else {
    combined = combined.slice(0, -4) + 'Page';
  }

  return combined.charAt(0).toUpperCase() + combined.slice(1);
}

/**
 * Quét file đệ quy trong thư mục và phát hiện xung đột tên/case (F07, T04)
 */
function findFilesInDirRecursively(dirPath, targetName) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let matches = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      matches = matches.concat(findFilesInDirRecursively(fullPath, targetName));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const baseName = path.basename(entry.name, '.js');
      if (baseName.toLowerCase() === targetName.toLowerCase()) {
        matches.push(fullPath);
      }
    }
  }

  return matches;
}

/**
 * Quét file thực tế trong một thư mục và kiểm tra Case-Collision & Duplication (T04, F07)
 */
function findFileInDir(dirPath, targetName) {
  const matches = findFilesInDirRecursively(dirPath, targetName);
  if (matches.length > 1) {
    throw new Error(`[PageContainer] Xung đột phát hiện nhiều file Page Object trùng tên '${targetName}' trong '${dirPath}': ${matches.join(', ')}`);
  }
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Tìm file Page Object theo platform với cơ chế phát hiện Ambiguity (R02, T03, T04, F07)
 */
function findPageClassFile(className, platform, rootDir) {
  const pagesDir = path.join(rootDir, 'pages');
  if (!fs.existsSync(pagesDir)) return null;

  const isMobilePlatform = platform === 'mobile-web' || platform === 'mobile';

  if (isMobilePlatform) {
    const mobileWebDir = path.join(pagesDir, 'mobile-web');
    const mobileLegacyDir = path.join(pagesDir, 'mobile');

    const matchMobileWeb = findFileInDir(mobileWebDir, className);
    const matchMobileLegacy = findFileInDir(mobileLegacyDir, className);

    // Phát hiện Ambiguity nếu tồn tại cả ở mobile-web và mobile
    if (matchMobileWeb && matchMobileLegacy) {
      throw new Error(
        `[PageContainer] Xung đột trùng lặp (Ambiguity): Tìm thấy Page '${className}' ở cả 2 thư mục mobile:\n` +
        `  1. ${path.relative(rootDir, matchMobileWeb)}\n` +
        `  2. ${path.relative(rootDir, matchMobileLegacy)}\n` +
        `Vui lòng xóa bỏ hoặc đổi tên một trong hai file để tránh không xác định được file thực thi.`
      );
    }

    if (matchMobileWeb) return matchMobileWeb;
    if (matchMobileLegacy) return matchMobileLegacy;
  } else {
    // Desktop
    const desktopDir = path.join(pagesDir, 'desktop');
    const matchDesktop = findFileInDir(desktopDir, className);
    if (matchDesktop) return matchDesktop;
  }

  // Fallback sang shared pages/ (ngoại trừ BasePage.js và các subdirs nền tảng)
  if (className !== 'BasePage') {
    const entries = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir, { withFileTypes: true }) : [];
    const matches = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        const baseName = path.basename(entry.name, '.js');
        if (baseName.toLowerCase() === className.toLowerCase()) {
          matches.push(path.join(pagesDir, entry.name));
        }
      } else if (entry.isDirectory() && !['desktop', 'mobile', 'mobile-web'].includes(entry.name)) {
        matches.push(...findFilesInDirRecursively(path.join(pagesDir, entry.name), className));
      }
    }
    if (matches.length > 1) {
      throw new Error(`[PageContainer] Xung đột phát hiện nhiều file Page Object trùng tên '${className}' trong '${pagesDir}': ${matches.join(', ')}`);
    }
    if (matches.length === 1) return matches[0];
  }

  return null;
}

/**
 * Liệt kê toàn bộ alias Page Object khả dụng cho một platform (10/10 Reflection & Enumerable support)
 */
function listAvailablePageAliases(platform, rootDir) {
  const pagesDir = path.join(rootDir, 'pages');
  if (!fs.existsSync(pagesDir)) return [];

  const isMobilePlatform = platform === 'mobile-web' || platform === 'mobile';
  const targetDirs = [];

  if (isMobilePlatform) {
    const mWeb = path.join(pagesDir, 'mobile-web');
    const mLegacy = path.join(pagesDir, 'mobile');
    if (fs.existsSync(mWeb)) targetDirs.push(mWeb);
    if (fs.existsSync(mLegacy)) targetDirs.push(mLegacy);
  } else {
    const desktopDir = path.join(pagesDir, 'desktop');
    if (fs.existsSync(desktopDir)) targetDirs.push(desktopDir);
  }

  const aliases = new Set();
  const processFile = (fullPath) => {
    const baseName = path.basename(fullPath, '.js');
    if (baseName === 'BasePage') return;

    const camel = baseName.charAt(0).toLowerCase() + baseName.slice(1);
    aliases.add(camel);
    aliases.add(baseName);
    if (camel.endsWith('Page') && camel.length > 4) {
      aliases.add(camel.slice(0, -4));
    }
  };

  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        processFile(fullPath);
      }
    }
  };

  for (const dir of targetDirs) {
    scanDir(dir);
  }

  // Quét shared pages/
  const rootEntries = fs.readdirSync(pagesDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      processFile(path.join(pagesDir, entry.name));
    } else if (entry.isDirectory() && !['desktop', 'mobile', 'mobile-web'].includes(entry.name)) {
      scanDir(path.join(pagesDir, entry.name));
    }
  }

  return Array.from(aliases).sort();
}

/**
 * Tạo Proxy Container cho toàn bộ Page Objects trong dự án
 * Hỗ trợ đồng thời 2 signature (R03, mục 3.1):
 * 1. Contract mới: createPageContainer(page, { rootDir, platform, featureName })
 * 2. Overload adapter cũ: createPageContainer(page, isMobile, rootDir)
 *
 * @param {import('@playwright/test').Page} page
 * @param {object|boolean} [optionsOrIsMobile]
 * @param {string} [legacyRootDir]
 * @returns {Record<string, any>}
 */
function createPageContainer(page, optionsOrIsMobile = {}, legacyRootDir) {
  let options = {};
  if (typeof optionsOrIsMobile === 'boolean') {
    // Adapter tương thích ngược
    options = {
      platform: optionsOrIsMobile ? 'mobile-web' : 'desktop',
      rootDir: legacyRootDir,
    };
  } else if (optionsOrIsMobile && typeof optionsOrIsMobile === 'object') {
    options = { ...optionsOrIsMobile };
  }

  const rootDir = resolveProjectRoot(options.rootDir);
  let platform = (options.platform || 'desktop').toLowerCase();
  if (platform === 'mobile') platform = 'mobile-web';

  const featureName = options.featureName || 'unknown_feature';
  
  // F08: Caches mapping canonical realFilePath to instance
  const aliasToRealPath = new Map();
  const instanceCache = new Map();
  let cachedOwnKeys = null;

  return new Proxy({}, {
    get: (target, prop) => {
      // 1. Chặn các thuộc tính runtime introspection (T09)
      if (typeof prop === 'symbol' || RESERVED_PROPERTIES.has(prop)) {
        return undefined;
      }

      // 2. Chuẩn hóa tên class
      const className = resolvePageClassName(String(prop));
      if (!className) return undefined;

      // 3. Lazy loading & Per-test Caching theo canonical realFilePath (F08)
      let realFilePath = aliasToRealPath.get(className);
      if (!realFilePath) {
        const filePath = findPageClassFile(className, platform, rootDir);
        if (!filePath) {
          throw new Error(
            `[PageContainer 10/10] Không tìm thấy Page Object cho '${String(prop)}' (Đã quét: '${className}.js' trong phân hệ '${platform}' tại '${rootDir}/pages/').`
          );
        }

        // F02 & T10: Đảm bảo realpath nằm trong rootDir và pages/ bằng path.relative (chống symlink/junction breakout)
        realFilePath = fs.realpathSync(filePath);
        const realRootDir = fs.realpathSync(rootDir);
        const relToRoot = path.relative(realRootDir, realFilePath);
        if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
          throw new Error(`[PageContainer] Đường dẫn file nằm ngoài phạm vi project root: ${realFilePath}`);
        }

        const pagesDir = path.join(rootDir, 'pages');
        if (fs.existsSync(pagesDir)) {
          const realPagesDir = fs.realpathSync(pagesDir);
          const relToPages = path.relative(realPagesDir, realFilePath);
          if (relToPages.startsWith('..') || path.isAbsolute(relToPages)) {
            throw new Error(`[PageContainer] Đường dẫn file nằm ngoài phạm vi pages root: ${realFilePath}`);
          }
        }

        aliasToRealPath.set(className, realFilePath);
      }

      if (!instanceCache.has(realFilePath)) {
        try {
          const PageModule = require(realFilePath);
          
          // F09: Chỉ chấp nhận direct function, named constructor trùng className hoặc default constructor
          let PageClass = null;
          if (typeof PageModule === 'function') {
            PageClass = PageModule;
          } else if (PageModule && typeof PageModule === 'object') {
            if (typeof PageModule[className] === 'function') {
              PageClass = PageModule[className];
            } else if (typeof PageModule.default === 'function') {
              PageClass = PageModule.default;
            }
          }

          if (typeof PageClass !== 'function') {
            throw new Error(`Module tại '${realFilePath}' không export Class '${className}' hoặc default constructor hợp lệ.`);
          }

          // Khởi tạo Page Object với chuẩn constructor(page, featureName) (R05, T08)
          const instance = new PageClass(page, featureName);
          instanceCache.set(realFilePath, instance);
        } catch (err) {
          const loadError = new Error(`[PageContainer] Lỗi khởi tạo Page Object '${className}': ${err.message}`);
          loadError.cause = err;
          throw loadError;
        }
      }

      return instanceCache.get(realFilePath);
    },

    has: (target, prop) => {
      if (typeof prop === 'symbol' || RESERVED_PROPERTIES.has(prop)) return false;
      try {
        const className = resolvePageClassName(String(prop));
        if (!className) return false;
        return Boolean(findPageClassFile(className, platform, rootDir));
      } catch (_) {
        return false;
      }
    },

    ownKeys: () => {
      if (!cachedOwnKeys) {
        cachedOwnKeys = listAvailablePageAliases(platform, rootDir);
      }
      return cachedOwnKeys;
    },

    getOwnPropertyDescriptor: (target, prop) => {
      if (typeof prop === 'symbol' || RESERVED_PROPERTIES.has(prop)) return undefined;
      return {
        configurable: true,
        enumerable: true,
        writable: false,
      };
    },
  });
}

module.exports = {
  createPageContainer,
  resolvePageClassName,
  findPageClassFile,
  resolveProjectRoot,
  listAvailablePageAliases,
  RESERVED_PROPERTIES,
};

