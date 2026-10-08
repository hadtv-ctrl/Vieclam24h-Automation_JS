'use strict';

/**
 * core/generator/objectRepository/fixtureAstParser.js
 * Phân tích cú pháp AST / cấu trúc test.extend({...}) của Playwright Fixtures.
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

  return endBrace !== -1 ? content.slice(openBrace + 1, endBrace) : null;
}

function classifyFixture(fixName, val) {
  let cat = 'Đối tượng trang (Page Objects)';
  let badgeColor = '#10b981';
  let icon = 'ph-bold ph-browsers';

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

  return { cat, badgeColor, icon };
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
        const { cat, badgeColor, icon } = classifyFixture(fixName, val);
        let params = [];
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

module.exports = {
  extractExtendObjectBody,
  parseExtendFixtures,
};
