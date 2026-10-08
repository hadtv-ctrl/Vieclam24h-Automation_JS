'use strict';

const path = require('path');

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
    try {
      new Function(content);
      return true;
    } catch (_) {
      return false;
    }
  })();
  const exportReady =
    new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${className}\\b`).test(content) ||
    new RegExp(`module\\.exports\\s*=\\s*\\b${className}\\b`).test(content) ||
    className === 'BasePage';
  const importReady = /require\(['"][^'"]+['"]\)/.test(content) || baseClass === 'BasePage' || className === 'BasePage';
  const platformReady = relativePath.startsWith('pages/');
  const checks = { syntax, export: exportReady, import: importReady, platform: platformReady };
  const passed = Object.values(checks).every(Boolean);
  return {
    status: passed ? 'ready' : 'blocked',
    ready: passed,
    checks,
    reason: passed ? null : Object.entries(checks).filter(([, value]) => !value).map(([key]) => key).join(', '),
  };
}

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

function inferHumanDescription(name, expr) {
  let cleanName = name
    .replace(/^(btn|txt|chk|icon|msg|lbl|opt|div)/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();

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

module.exports = {
  LOCATOR_EXPRESSION,
  normalizePagePath,
  validateLocatorExpression,
  getReadiness,
  inferElementCategory,
  inferHumanDescription,
};
