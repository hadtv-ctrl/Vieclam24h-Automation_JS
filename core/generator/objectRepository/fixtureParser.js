'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FIXTURE_ALLOWLIST, FIXTURE_METADATA_VI } = require('./metadataCatalog');
const { extractExtendObjectBody, parseExtendFixtures } = require('./fixtureAstParser');

function isValidFixtureName(name) {
  return typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
}

function findCustomFixturePath(name, rootDir = process.cwd()) {
  if (!isValidFixtureName(name)) return null;

  const canonicalDir = path.resolve(rootDir, 'fixtures', 'custom');
  const canonicalPath = path.resolve(canonicalDir, `${name}.fixture.js`);
  if (canonicalPath.startsWith(canonicalDir + path.sep) && fs.existsSync(canonicalPath)) {
    return { fullPath: canonicalPath, isCanonical: true };
  }

  const legacyDir = path.resolve(rootDir, 'core', 'fixtures', 'custom');
  const legacyPath = path.resolve(legacyDir, `${name}.fixture.js`);
  if (legacyPath.startsWith(legacyDir + path.sep) && fs.existsSync(legacyPath)) {
    return { fullPath: legacyPath, isCanonical: false };
  }

  return null;
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

function scanAllFixtures(rootDir = process.cwd()) {
  const allFixtures = [];
  const coreFiles = ['core/fixtures/baseTest.js', 'core/fixtures/mobileWebTest.js'];

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
        if (allFixtures.some((f) => f.name === fixName)) continue;

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

module.exports = {
  isValidFixtureName,
  findCustomFixturePath,
  extractExtendObjectBody,
  parseExtendFixtures,
  parseFixture,
  scanAllFixtures,
  getFixtureByName,
};
