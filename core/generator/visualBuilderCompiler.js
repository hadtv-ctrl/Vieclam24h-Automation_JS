/**
 * core/generator/visualBuilderCompiler.js
 * Visual Step Scenario Compiler into Playwright BDD spec files.
 * Budget <= 200 lines.
 */
const { sanitizeToIdentifier } = require('./namingUtils');
const { ASSERTION_DEFINITIONS } = require('./actionRegistry');
const { SCHEMA_VERSION, validateScenario, hashText } = require('./wizardSchema');
const {
  quote, compileAssertionStep, compilePresetStep,
  resolveDataExpression, compileStepEvidence, PRESET_ACTIONS,
} = require('./visualBuilderPresets');
const { FIXTURE_PAGE_MAP, getFixturePageMap, parseExistingSpecFile } = require('./visualSpecParser');
const { scanAllProjectScripts, invalidateScriptCache } = require('./visualScriptScanner');

/**
 * Biên dịch kịch bản dạng khối Visual Steps thành mã Playwright BDD Spec hoàn chỉnh
 */
function compileVisualScenario(scenarioData, options = {}) {
  const previewMode = Boolean(options?.previewMode || scenarioData?.previewMode);
  const actionIds = [
    ...PRESET_ACTIONS.map((p) => p.id),
    ...ASSERTION_DEFINITIONS.map((d) => `assertion_${d.type}`),
  ];
  const validation = validateScenario(scenarioData, { actionIds, previewMode });
  if (validation.errors.length > 0) {
    return {
      valid: false, specCode: '', specRelativePath: '', requiredFixtures: [],
      warnings: validation.warnings, errors: validation.errors, compiledHash: null,
    };
  }
  const norm = validation.scenario;
  const fileNameSlug = sanitizeToIdentifier(norm.featureName).toLowerCase() || 'visual_scenario';
  const specFileName = norm.fileName || `${fileNameSlug}-bdd.spec.js`;
  const specRelativePath = `tests/e2e/${norm.platform}/${specFileName}`;

  const fixtureSet = new Set(['test']);
  const dataImports = new Set();
  norm.dataSources.forEach((s) => dataImports.add(`const ${s.variable} = require('../../../${s.file}');`));
  norm.pageObjects.forEach((po) => {
    const rel = typeof po === 'string' ? po : po?.path || po?.relativePath;
    if (rel) {
      const base = rel.split('/').pop().replace(/\.js$/, '');
      fixtureSet.add(base.charAt(0).toLowerCase() + base.slice(1));
    }
  });
  if (norm.precondition.auth === 'authenticated') fixtureSet.add('authenticatedUser');

  norm.steps.forEach((step) => {
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);
    if (preset?.fixture) preset.fixture.split(',').forEach((f) => fixtureSet.add(f.trim()));
    if (step.actionId && (step.actionId.startsWith('assert_') || step.actionId.startsWith('assertion_'))) {
      fixtureSet.add('expect');
    }
  });

  const isMobile = norm.platform === 'mobile-web';
  const fixtureImportPath = isMobile ? '../../../core/fixtures/mobileWebTest' : '../../../core/fixtures/baseTest';

  const stepBlocks = [];
  const preconditionLines = [];
  if (norm.precondition.auth === 'authenticated') preconditionLines.push('      // Precondition: Đã chứng thực người dùng');
  if (norm.precondition.verifyLandingPage) preconditionLines.push('      // Precondition: Xác thực trang đích');
  if (norm.precondition.captureInitial) preconditionLines.push("      await page.screenshot({ path: 'evidence/precondition_initial_state.png' });");
  if (!preconditionLines.length) preconditionLines.push('      // Precondition đã sẵn sàng.');

  norm.steps.forEach((step, idx) => {
    const stepType = step.stepType || (idx === 0 ? 'Given' : 'When');
    const stepTitle = step.title || step.name || `Bước ${idx + 1}`;
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);

    let stepBody = compileAssertionStep(step) || compilePresetStep(step, preset, { platform: norm.platform, isMobile, allowCustomCode: norm.allowCustomCode });
    if (!stepBody) {
      const dataExpr = resolveDataExpression(step.dataRef || step.dataSource);
      if (step.actionId === 'fill_text' && dataExpr) {
        stepBody = `      await page.locator(${quote(step.locator || 'input')}).fill(${dataExpr});`;
      } else if (step.actionId === 'custom_code' && !norm.allowCustomCode) {
        stepBody = '';
      }
    }
    if (!stepBody) {
      stepBody = previewMode ? '      // ⏳ Đang cấu hình hành động cho bước này trong Wizard...' : '      throw new Error("BDD step has no executable action.");';
    }

    const evFixture = step.pageFixture || preset?.fixture?.split(',')[0]?.trim() || 'page';
    if (evFixture === 'page') fixtureSet.add('page');
    stepBody += compileStepEvidence(step, { fixture: evFixture });
    stepBlocks.push(`    await test.step(${quote(`${stepType} ${stepTitle}`)}, async () => {\n${stepBody}\n    });`);
  });

  const fixturesArgList = Array.from(fixtureSet).filter((f) => f !== 'test' && f !== 'expect').join(',\n    ');
  const specCode = `const { test, expect } = require('${fixtureImportPath}');
${Array.from(dataImports).join('\n')}

test.describe(${quote(`Feature: ${norm.featureName} ${norm.tags.join(' ')}`)}, () => {

  test(${quote(norm.scenarioName)}, async ({
    ${fixturesArgList || 'page'}
  }, testInfo) => {
    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: ${quote(norm.precondition.description || 'Khởi tạo bối cảnh và kiểm chứng tiền điều kiện kịch bản BDD')},
    });

    await test.step("Given Tiền điều kiện ban đầu", async () => {
${preconditionLines.join('\n')}
    });

${stepBlocks.join('\n\n')}
  });
});
`;

  return {
    valid: true,
    schemaVersion: SCHEMA_VERSION,
    specRelativePath,
    specFileName,
    specCode,
    requiredFixtures: Array.from(fixtureSet),
    warnings: validation.warnings,
    errors: [],
    compiledHash: hashText(specCode),
  };
}

module.exports = {
  PRESET_ACTIONS,
  compileVisualScenario,
  parseExistingSpecFile,
  scanAllProjectScripts,
  getFixturePageMap,
  FIXTURE_PAGE_MAP,
  invalidateScriptCache,
};
