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
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'auth_login_precondition'));
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'open_nocv_job_list'));
  assert.ok(PRESET_ACTIONS.some((p) => p.id === 'verify_applied_jobs'));
});

test('compileVisualScenario compiles blocks into BDD spec', () => {
  const scenario = {
    featureName: 'Ứng tuyển nhanh việc làm không cần CV',
    scenarioName: 'Người dùng nộp hồ sơ và kiểm tra danh sách',
    platform: 'desktop',
    tags: ['@applyjob', '@e2e'],
    steps: [
      {
        stepType: 'Given',
        title: 'Người dùng đã truy cập trang chủ và đăng nhập',
        actionId: 'auth_login_precondition',
      },
      {
        stepType: 'And',
        title: 'Người dùng thấy popup Onboarding và đóng',
        actionId: 'close_onboarding_popup',
      },
      {
        stepType: 'When',
        title: 'Người dùng mở việc làm không cần CV',
        actionId: 'open_nocv_job_list',
      },
      {
        stepType: 'Then',
        title: 'Việc làm hiển thị trong danh sách đã ứng tuyển',
        actionId: 'verify_applied_jobs',
      },
    ],
  };

  const compiled = compileVisualScenario(scenario);
  assert.ok(compiled.specRelativePath.includes('ungtuyennhanhviec-bdd.spec.js'));
  assert.ok(compiled.specCode.includes('Feature: Ứng tuyển nhanh việc làm không cần CV @applyjob @e2e'));
  assert.ok(compiled.specCode.includes('await test.step("Given Người dùng đã truy cập trang chủ và đăng nhập"'));
  assert.ok(compiled.specCode.includes('await test.step("Then Việc làm hiển thị trong danh sách đã ứng tuyển"'));
  assert.ok(compiled.specCode.includes('authenticatedUser'));
  assert.ok(compiled.specCode.includes('onboardingPopup'));
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
      title: 'Điền profile',
      actionId: 'fill_mini_profile',
      evidence: { name: 'profile_submitted' },
    }],
  });
  assert.equal(compiled.valid, true);
  assert.match(compiled.specCode, /fillMiniProfile\(applyData\.noCVApply\.job1\)/);
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

test('compileVisualScenario keeps runtime parity for no-CV application flow', () => {
  const compiled = compileVisualScenario({
    featureName: 'Hoàn thành profile mini và ứng tuyển job không cần CV',
    scenarioName: 'Người dùng hoàn thành tạo profile và ứng tuyển job không cần CV',
    platform: 'desktop',
    tags: ['@applyjob', '@e2e'],
    pageObjects: [
      'pages/desktop/HomePage.js',
      'pages/desktop/JobSearchPage.js',
      'pages/desktop/JobApplyNoCVPage.js',
    ],
    dataSources: [{ file: 'data/applyJobData.json', variable: 'applyData', dataPath: 'noCVApply.job1' }],
    precondition: { auth: 'authenticated', closeOnboarding: true, verifyLandingPage: true, captureInitial: true },
    steps: [
      { stepType: 'When', title: 'Mở danh sách việc không cần CV', actionId: 'open_nocv_job_list' },
      { stepType: 'When', title: 'Mở việc đầu tiên', actionId: 'select_first_job' },
      { stepType: 'And', title: 'Điền profile mini', actionId: 'fill_mini_profile', evidence: { name: 'profile_submitted' } },
      { stepType: 'And', title: 'Ứng tuyển các việc còn lại', actionId: 'bulk_apply_all' },
      { stepType: 'Then', title: 'Kiểm tra việc đã ứng tuyển', actionId: 'verify_applied_jobs' },
    ],
  });

  assert.equal(compiled.valid, true);
  assert.match(compiled.specCode, /require\('\.\.\/\.\.\/\.\.\/data\/applyJobData\.json'\)/);
  assert.match(compiled.specCode, /jobSearchPage\.firstJobLink\.waitFor/);
  assert.match(compiled.specCode, /createJobApplyNoCVPage\(newPage\)/);
  assert.match(compiled.specCode, /startApplyNoCV\(\{ otpCode: usersData\[0\]\?\.otp \}\)/);
  assert.match(compiled.specCode, /fillMiniProfile\(applyData\.noCVApply\.job1\)/);
  assert.match(compiled.specCode, /if \(didBulkApply\)/);
  assert.match(compiled.specCode, /expectAppliedJobsVisible/);
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

