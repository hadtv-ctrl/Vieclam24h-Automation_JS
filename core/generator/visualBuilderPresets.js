/**
 * core/generator/visualBuilderPresets.js
 * Preset action blocks and step compilation helpers for Visual Scenario Builder.
 * Budget <= 150 lines.
 */
const { getAssertionDefinition } = require('./actionRegistry');

function quote(value) {
  return JSON.stringify(String(value ?? ''));
}

function compileAssertionStep(step) {
  const type = step.assertionType || step.actionId?.replace(/^assertion_/, '');
  const definition = getAssertionDefinition(type);
  if (!definition) return null;
  const target = definition.target === 'page' ? 'page' : `page.locator(${quote(step.locator || 'div')})`;
  const expected = definition.requiresValue
    ? definition.type === 'toHaveURL' ? `(new RegExp(${quote(step.expectedVal || '')}))` : `(${quote(step.expectedVal || '')})`
    : '()';
  return `      await expect(${target}).${definition.type}${expected};`;
}

function compilePresetStep(step, preset, context) {
  if (preset) return preset.codeTemplate(step, context);
  if (step.actionId === 'custom_code' && context.allowCustomCode) return String(step.code).trim();
  return null;
}

function resolveDataExpression(dataRef) {
  if (!dataRef || !dataRef.variable || !dataRef.path) return null;
  const segments = String(dataRef.path).split('.').filter(Boolean);
  if (!segments.every((segment) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment))) return null;
  return `${dataRef.variable}${segments.map((segment) => `.${segment}`).join('')}`;
}

function compileStepEvidence(step, context) {
  if (!step.evidence || step.evidence === false || !step.evidence.name) return '';
  const fixture = context.fixture || 'page';
  return `\n      await ${fixture}.capture(${quote(step.evidence.name)});`;
}

/**
 * Danh mục các mẫu hành động có sẵn (Preset Action Blocks)
 */
const PRESET_ACTIONS = [
  {
    id: 'navigate_url',
    category: 'interaction',
    stepType: 'Given',
    name: 'Mở đường dẫn URL',
    desc: 'Điều hướng trình duyệt đến một trang cụ thể',
    codeTemplate: (step) => `      await page.goto(${quote(step.url || 'https://example.com')});`,
  },
  {
    id: 'wait_visible',
    category: 'interaction',
    stepType: 'Then',
    name: 'Chờ phần tử hiển thị',
    desc: 'Chờ cho phần tử xuất hiện trên DOM và hiển thị',
    codeTemplate: (step) => `      await page.locator(${quote(step.locator || 'div')}).waitFor({ state: 'visible', timeout: 15000 });`,
  },
  {
    id: 'take_screenshot',
    category: 'evidence',
    stepType: 'And',
    name: 'Chụp ảnh màn hình (Evidence)',
    desc: 'Chụp ảnh màn hình lưu vào bằng chứng kiểm thử',
    codeTemplate: () => `      await page.screenshot({ path: \`evidence/\${Date.now()}_screenshot.png\` });`,
  },
  {
    id: 'click_element',
    category: 'interaction',
    stepType: 'When',
    name: 'Bấm chuột (Click)',
    desc: 'Thực hiện click an toàn với cơ chế wait visible',
    codeTemplate: (step) => `      await page.locator(${quote(step.locator || 'button')}).click();`,
  },
  {
    id: 'fill_text',
    category: 'interaction',
    stepType: 'When',
    name: 'Nhập văn bản (Type/Fill)',
    desc: 'Nhập giá trị vào ô input',
    codeTemplate: (step) => `      await page.locator(${quote(step.locator || 'input')}).fill(${quote(step.value || '')});`,
  },
  {
    id: 'assert_visible',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra phần tử đang hiển thị (Visible)',
    desc: 'Xác nhận phần tử xuất hiện trên màn hình',
    codeTemplate: (step) => `      await expect(page.locator(${quote(step.locator || 'div')})).toBeVisible();`,
  },
  {
    id: 'assert_text',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra văn bản phần tử (Text)',
    desc: 'Xác nhận phần tử chứa đúng đoạn chữ mong đợi',
    codeTemplate: (step) => `      await expect(page.locator(${quote(step.locator || 'div')})).toContainText(${quote(step.expectedVal || '')});`,
  },
  {
    id: 'assert_url',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra chuyển trang đúng URL',
    desc: 'Xác nhận URL sau khi thao tác khớp đường dẫn mong đợi',
    codeTemplate: (step) => `      await expect(page).toHaveURL(new RegExp(${quote(step.expectedVal || '')}));`,
  },
  {
    id: 'cleanup_action',
    category: 'teardown',
    stepType: 'Teardown',
    name: 'Dọn dẹp sau test (Cleanup Hook)',
    desc: 'Đăng ký tác vụ dọn dẹp dữ liệu (xóa user, xóa đơn hàng) luôn chạy trong finally',
    fixture: 'cleanupQueue',
    codeTemplate: (step) => `      cleanupQueue(async () => {\n        // Dọn dẹp dữ liệu sau test: ${step.name || 'Cleanup action'}\n        ${step.code ? String(step.code).trim() : `console.log('Hoàn tất dọn dẹp dữ liệu.');`}\n      });`,
  },
];

module.exports = {
  quote,
  compileAssertionStep,
  compilePresetStep,
  resolveDataExpression,
  compileStepEvidence,
  PRESET_ACTIONS,
};
