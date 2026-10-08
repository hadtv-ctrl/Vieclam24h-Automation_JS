'use strict';

/**
 * core/generator/objectRepository/pageParser.js
 * Bóc tách AST / cấu trúc một file Page Object Playwright.
 */

const fs = require('fs');
const path = require('path');
const { PAGE_METADATA, FIXTURE_ALLOWLIST } = require('./metadataCatalog');
const {
  normalizePagePath,
  getReadiness,
  inferElementCategory,
  inferHumanDescription,
} = require('./locatorValidator');
const { parseFixture } = require('./fixtureParser');

function extractLocatorsFromConstructor(constructorBody) {
  const locators = [];
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
  return locators;
}

function extractMethodsFromContent(content) {
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
    methods.push({
      name: methodName,
      params,
      hasCapture: body.includes('capture('),
      isNavigation: body.includes('goto(') || body.includes('navigate('),
      isAssertion: body.includes('expect('),
      signature: `${methodName}(${params.join(', ')})`,
    });
  }
  return methods;
}

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

  const classMatch = content.match(/class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/);
  const className = classMatch ? classMatch[1] : path.basename(relativePath, '.js');
  const baseClass = classMatch ? classMatch[2] || 'None' : 'None';

  const meta = PAGE_METADATA[normalizedRel] || {
    title: className,
    desc: `Page Object quản lý tương tác trên ${className}`,
    icon: isMobile ? 'ph-device-mobile' : 'ph-browsers',
    platform: isBase ? 'base' : (isMobile ? 'mobile-web' : 'desktop'),
    category: isMobile ? 'Mobile Web' : 'Desktop Web',
  };

  let locators = [];
  const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*(\}\s*\n|\}\s*$)/);
  if (constructorMatch) {
    locators = extractLocatorsFromConstructor(constructorMatch[1]);
  }

  const methods = extractMethodsFromContent(content);
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

module.exports = {
  parsePageObject,
};
