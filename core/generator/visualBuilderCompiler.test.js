const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { compileVisualScenario, PRESET_ACTIONS, parseExistingSpecFile } = require('./visualBuilderCompiler');
const { ASSERTION_DEFINITIONS } = require('./actionRegistry');

test('PRESET_ACTIONS contains business and interaction blocks', () => {
  assert.ok(PRESET_ACTIONS.length >= 8);
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'navigate_url'));
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'click_element'));
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'fill_text'));
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'wait_visible'));
});

test('compileVisualScenario compiles blocks into BDD spec', () => {
  const scenario = {
    featureName: 'User login flow',
    scenarioName: 'User submits credentials',
    platform: 'desktop',
    tags: ['@login', '@e2e'],
    steps: [
      {
        stepType: 'Given',
        title: 'User navigates to login page',
        actionId: 'navigate_url',
        url: 'https://example.com/login',
      },
      {
        stepType: 'When',
        title: 'User fills credentials',
        actionId: 'fill_text',
        locator: 'input#username',
        value: 'tester@example.com',
      },
      {
        stepType: 'And',
        title: 'User clicks submit',
        actionId: 'click_element',
        locator: 'button#submit',
      },
      {
        stepType: 'Then',
        title: 'Welcome message is visible',
        actionId: 'assert_visible',
        locator: 'div.welcome-msg',
      },
    ],
  };

  const compiled = compileVisualScenario(scenario);
  assert.ok(compiled.valid);
  assert.ok(compiled.specRelativePath.includes('userloginflow-bdd.spec.js'));
  assert.ok(compiled.specCode.includes('Feature: User login flow @login @e2e'));
  assert.ok(compiled.specCode.includes('Given User navigates to login page'));
  assert.ok(compiled.specCode.includes('await page.goto("https://example.com/login")'));
  assert.ok(compiled.specCode.includes('Then Welcome message is visible'));
});


test('all registered assertions compile to executable expect statements', () => {
  for (const definition of ASSERTION_DEFINITIONS) {
    const compiled = compileVisualScenario({
      featureName: `assertion-${definition.type}`,
      scenarioName: `scenario-${definition.type}`,
      steps: [{ actionId: `assertion_${definition.type}`, locator: 'button.submit', expectedVal: 'Done' }],
    });
    assert.match(compiled.specCode, new RegExp(`expect\\((?:page|page\\.locator\\(["']button\\.submit["']\\))\\)\\.${definition.type}\\(`));
  }
});

test('compileVisualScenario rejects invalid actions and unsafe custom code defaults', () => {
  const invalid = compileVisualScenario({
    featureName: 'Invalid flow',
    scenarioName: 'Unknown action',
    platform: 'desktop',
    steps: [{ actionId: 'missing_action', stepType: 'When' }],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('missing_action')));
  assert.equal(invalid.specCode, '');

  const custom = compileVisualScenario({
    featureName: 'Custom flow',
    scenarioName: 'Custom action',
    steps: [{ actionId: 'custom_code', code: 'await page.pause();' }],
  });
  assert.equal(custom.valid, false);
  assert.ok(custom.errors.some((error) => error.includes('allowCustomCode')));
});

test('compileVisualScenario preserves executable preset actions and step evidence', () => {
  const compiled = compileVisualScenario({
    featureName: 'Apply flow',
    scenarioName: 'Submit profile',
    steps: [{
      stepType: 'And',
      title: 'Điền thông tin',
      actionId: 'fill_text',
      locator: 'input#name',
      value: 'Test User',
      evidence: { name: 'profile_submitted' },
    }],
  });
  assert.equal(compiled.valid, true);
  assert.match(compiled.specCode, /page\.locator\("input#name"\)\.fill\("Test User"\)/);
  assert.match(compiled.specCode, /capture\("profile_submitted"\)/);
});

test('compileVisualScenario rejects a step without an executable action', () => {
  const compiled = compileVisualScenario({
    featureName: 'Incomplete flow',
    scenarioName: 'Missing action',
    steps: [{ stepType: 'When', title: 'Chỉ có mô tả' }],
  });
  assert.equal(compiled.valid, false);
  assert.ok(compiled.errors.some((error) => error.includes('chưa chọn action')));
});

test('compileVisualScenario keeps runtime parity for generic application flow', () => {
  const compiled = compileVisualScenario({
    featureName: 'Hoàn thành tạo biểu mẫu và xác nhận thông tin',
    scenarioName: 'Người dùng hoàn thành biểu mẫu',
    platform: 'desktop',
    tags: ['@smoke', '@e2e'],
    pageObjects: [
      'pages/desktop/SamplePage.js',
    ],
    steps: [
      { stepType: 'When', title: 'Mở trang web mẫu', actionId: 'navigate_url', url: 'https://example.com' },
      { stepType: 'And', title: 'Nhập thông tin người dùng', actionId: 'fill_text', locator: 'input#username', value: 'tester@example.com', evidence: { name: 'profile_submitted' } },
      { stepType: 'Then', title: 'Kiểm tra tiêu đề', actionId: 'assert_visible', locator: 'h1' },
    ],
  });

  assert.equal(compiled.valid, true);
  assert.match(compiled.specCode, /page\.goto\("https:\/\/example\.com"\)/);
  assert.match(compiled.specCode, /page\.locator\("input#username"\)\.fill\("tester@example\.com"\)/);
  assert.match(compiled.specCode, /capture\("profile_submitted"\)/);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-parity-'));
  const tempFile = path.join(tempDir, 'parity.spec.js');
  fs.writeFileSync(tempFile, compiled.specCode, 'utf8');
  execFileSync(process.execPath, ['--check', tempFile], { stdio: 'pipe' });
  fs.rmSync(tempDir, { recursive: true, force: true });
});


test('compileVisualScenario produces a deterministic compiled hash', () => {
  const scenario = { featureName: 'Stable flow', scenarioName: 'Stable scenario', steps: [{ actionId: 'navigate_url', url: 'https://example.com' }] };
  const first = compileVisualScenario(scenario);
  const second = compileVisualScenario(scenario);
  assert.equal(first.valid, true);
  assert.equal(first.compiledHash, second.compiledHash);
  assert.equal(first.specCode, second.specCode);
});

test('parseExistingSpecFile preserves canonical assertion steps for round-trip editing', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-builder-'));
  const specPath = path.join(root, 'tests', 'e2e', 'desktop', 'roundtrip.spec.js');
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, `const { test, expect } = require('x');\ntest.describe("Feature: Roundtrip @e2e", () => {\n  test("Scenario", async ({ page }) => {\n    await test.step("Then Result", async () => {\n      await expect(page.locator(".result")).toBeVisible();\n    });\n  });\n});`);
  const parsed = parseExistingSpecFile('tests/e2e/desktop/roundtrip.spec.js', root);
  assert.equal(parsed.steps[0].actionId, 'assertion_toBeVisible');
  fs.rmSync(root, { recursive: true, force: true });
});

test('compileVisualScenario in previewMode compiles incomplete draft steps into valid JS syntax', () => {
  const scenario = {
    featureName: 'Draft Feature',
    scenarioName: 'Draft Scenario',
    steps: [
      { id: 'step_1', stepType: 'When', title: 'User is doing something', actionId: '' },
      { id: 'step_2', stepType: 'Then', title: 'User expects something', actionId: '' },
    ],
  };
  const compiled = compileVisualScenario(scenario, { previewMode: true });
  assert.equal(compiled.valid, true);
  assert.match(compiled.specCode, /\/\/ ⏳ Đang cấu hình hành động/);
  assert.doesNotThrow(() => new Function(compiled.specCode));
});

