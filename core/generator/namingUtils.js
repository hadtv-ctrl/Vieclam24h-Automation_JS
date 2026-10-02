/**
 * Naming and Warning Analysis Utilities for UI Recorder
 */

function sanitizeToIdentifier(str, preservePascal = false) {
  if (!str) return '';
  // Chuyển tiếng Việt có dấu sang không dấu
  const nonAccent = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

  // Tách từ theo khoảng trắng, gạch dưới, gạch ngang hoặc chuyển đổi chữ hoa chữ thường
  const splitWords = nonAccent
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (splitWords.length === 0) return '';

  if (preservePascal) {
    return splitWords
      .slice(0, 4)
      .map((w) => capitalize(w.toLowerCase()))
      .join('');
  }

  // camelCase
  return splitWords
    .slice(0, 4)
    .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase())))
    .join('');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Trích xuất tên biến locator gợi ý từ Playwright locator string
 * Ví dụ: page.getByRole('button', { name: 'Đăng nhập' }) -> loginBtn
 */
function generateLocatorName(locatorStr) {
  if (!locatorStr) return 'targetElement';

  // 1. getByRole('button', { name: '...' })
  const roleMatch = locatorStr.match(/getByRole\(\s*['"](\w+)['"]\s*,\s*\{\s*name:\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/)/i);
  if (roleMatch) {
    const role = roleMatch[1].toLowerCase();
    const name = (roleMatch[2] || roleMatch[3] || '').trim();
    const cleanName = sanitizeToIdentifier(name);
    if (role === 'button') return cleanName ? `${cleanName}Btn` : 'submitBtn';
    if (role === 'link') return cleanName ? `${cleanName}Link` : 'navLink';
    if (role === 'textbox') return cleanName ? `${cleanName}Input` : 'inputField';
    if (role === 'checkbox') return cleanName ? `${cleanName}Checkbox` : 'checkbox';
    if (role === 'combobox') return cleanName ? `${cleanName}Select` : 'dropdownSelect';
    if (role === 'dialog') return cleanName ? `${cleanName}Dialog` : 'modalDialog';
    return cleanName ? `${cleanName}${capitalize(role)}` : role;
  }

  // 2. getByLabel('...')
  const labelMatch = locatorStr.match(/getByLabel\(\s*['"`]([^'"`]+)['"`]/i);
  if (labelMatch) {
    const cleanName = sanitizeToIdentifier(labelMatch[1]);
    return cleanName ? `${cleanName}Input` : 'inputField';
  }

  // 3. getByPlaceholder('...')
  const placeholderMatch = locatorStr.match(/getByPlaceholder\(\s*['"`]([^'"`]+)['"`]/i);
  if (placeholderMatch) {
    const cleanName = sanitizeToIdentifier(placeholderMatch[1]);
    return cleanName ? `${cleanName}Input` : 'inputField';
  }

  // 4. getByTestId('...')
  const testIdMatch = locatorStr.match(/getByTestId\(\s*['"`]([^'"`]+)['"`]/i);
  if (testIdMatch) {
    const cleanName = sanitizeToIdentifier(testIdMatch[1]);
    return cleanName || 'testElement';
  }

  // 5. getByText('...')
  const textMatch = locatorStr.match(/getByText\(\s*['"`]([^'"`]+)['"`]/i);
  if (textMatch) {
    const cleanName = sanitizeToIdentifier(textMatch[1]);
    return cleanName ? `${cleanName}Text` : 'textElement';
  }

  // 6. locator('#id' / '.class' / 'input[name="..."]')
  const cssMatch = locatorStr.match(/locator\(\s*['"`]([^'"`]+)['"`]/i);
  if (cssMatch) {
    const sel = cssMatch[1]
      .replace(/^[#.\[\]]+/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanName = sanitizeToIdentifier(sel);
    return cleanName || 'customElement';
  }

  return 'targetElement';
}

/**
 * Phân tích và phát hiện các locator yếu hoặc vi phạm AI_PROMPTS.md
 * @param {string} locatorStr
 * @returns {string[]} Danh sách các cảnh báo
 */
function analyzeLocatorWarnings(locatorStr) {
  if (!locatorStr) return [];
  const warnings = [];

  // 1. Cảnh báo .first(), .last(), .nth()
  if (/\.first\s*\(\s*\)/.test(locatorStr)) {
    warnings.push('Sử dụng `.first()`: Hãy scope vào modal/container trước hoặc kiểm tra tính duy nhất.');
  }
  if (/\.last\s*\(\s*\)/.test(locatorStr)) {
    warnings.push('Sử dụng `.last()`: Thứ tự phần tử có thể không ổn định khi dữ liệu thay đổi.');
  }
  if (/\.nth\s*\(\s*\d+\s*\)/.test(locatorStr)) {
    warnings.push('Sử dụng `.nth()`: Tránh hardcode index vị trí trừ khi thứ tự là bất biến.');
  }

  // 2. Cảnh báo XPath
  if (/\/\/[a-zA-Z0-9_*\[\]@]/.test(locatorStr) || /xpath=/i.test(locatorStr)) {
    warnings.push('Sử dụng XPath: Khuyến nghị thay thế bằng `getByRole()`, `getByLabel()` hoặc `getByTestId()`.');
  }

  // 3. Cảnh báo CSS Selector sâu/yếu
  if (/>\s*(?:div|span|p|li)\s*>/i.test(locatorStr) || /:nth-child/i.test(locatorStr)) {
    warnings.push('CSS selector phụ thuộc cấu trúc phân cấp sâu: Dễ bị hỏng khi UI thay đổi layout.');
  }

  return warnings;
}

module.exports = {
  sanitizeToIdentifier,
  capitalize,
  generateLocatorName,
  analyzeLocatorWarnings,
};
