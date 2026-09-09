const fs = require('fs');
const path = require('path');
const { sanitizeToIdentifier } = require('./namingUtils');
const { ASSERTION_DEFINITIONS, getAssertionDefinition } = require('./actionRegistry');
const {
  SCHEMA_VERSION,
  SUPPORTED_PLATFORMS,
  validateScenario,
  hashText,
} = require('./wizardSchema');

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

function quote(value) {
  return JSON.stringify(String(value ?? ''));
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
    codeTemplate: (step, ctx) => `      await page.goto(${quote(step.url || 'https://example.com')});`,
  },
  {
    id: 'wait_visible',
    category: 'interaction',
    stepType: 'Then',
    name: 'Chờ phần tử hiển thị',
    desc: 'Chờ cho phần tử xuất hiện trên DOM và hiển thị',
    codeTemplate: (step, ctx) => `      await page.locator(${quote(step.locator || 'div')}).waitFor({ state: 'visible', timeout: 15000 });`,
  },
  {
    id: 'take_screenshot',
    category: 'evidence',
    stepType: 'And',
    name: 'Chụp ảnh màn hình (Evidence)',
    desc: 'Chụp ảnh màn hình lưu vào bằng chứng kiểm thử',
    codeTemplate: (step, ctx) => `      await page.screenshot({ path: \`evidence/\${Date.now()}_screenshot.png\` });`,
  },
  {
    id: 'click_element',
    category: 'interaction',
    stepType: 'When',
    name: 'Bấm chuột (Click)',
    desc: 'Thực hiện click an toàn với cơ chế wait visible',
    codeTemplate: (step, ctx) => `      await page.locator(${quote(step.locator || 'button')}).click();`,
  },
  {
    id: 'fill_text',
    category: 'interaction',
    stepType: 'When',
    name: 'Nhập văn bản (Type/Fill)',
    desc: 'Nhập giá trị vào ô input',
    codeTemplate: (step, ctx) => `      await page.locator(${quote(step.locator || 'input')}).fill(${quote(step.value || '')});`,
  },
  {
    id: 'assert_visible',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra phần tử đang hiển thị (Visible)',
    desc: 'Xác nhận phần tử xuất hiện trên màn hình',
    codeTemplate: (step, ctx) => `      await expect(page.locator(${quote(step.locator || 'div')})).toBeVisible();`,
  },
  {
    id: 'assert_text',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra văn bản phần tử (Text)',
    desc: 'Xác nhận phần tử chứa đúng đoạn chữ mong đợi',
    codeTemplate: (step, ctx) => `      await expect(page.locator(${quote(step.locator || 'div')})).toContainText(${quote(step.expectedVal || '')});`,
  },
  {
    id: 'assert_url',
    category: 'assertion',
    stepType: 'Then',
    name: 'Kiểm tra chuyển trang đúng URL',
    desc: 'Xác nhận URL sau khi thao tác khớp đường dẫn mong đợi',
    codeTemplate: (step, ctx) => `      await expect(page).toHaveURL(new RegExp(${quote(step.expectedVal || '')}));`,
  },
  {
    id: 'cleanup_action',
    category: 'teardown',
    stepType: 'Teardown',
    name: 'Dọn dẹp sau test (Cleanup Hook)',
    desc: 'Đăng ký tác vụ dọn dẹp dữ liệu (xóa user, xóa đơn hàng) luôn chạy trong finally',
    fixture: 'cleanupQueue',
    codeTemplate: (step, ctx) => `      cleanupQueue(async () => {\n        // Dọn dẹp dữ liệu sau test: ${step.name || 'Cleanup action'}\n        ${step.code ? String(step.code).trim() : `console.log('Hoàn tất dọn dẹp dữ liệu.');`}\n      });`,
  },
];

/**
 * Biên dịch kịch bản dạng khối Visual Steps thành mã Playwright BDD Spec hoàn chỉnh
 * @param {Object} scenarioData
 * @returns {{ specRelativePath: string, specCode: string, requiredFixtures: string[], warnings: string[] }}
 */
function compileVisualScenario(scenarioData, options = {}) {
  const previewMode = Boolean(options?.previewMode || scenarioData?.previewMode);
  const {
    featureName = 'Tạo kịch bản kiểm thử trực quan',
    scenarioName = 'Thực hiện luồng thao tác người dùng',
    platform = 'desktop',
    tags = ['@e2e', '@visualBuilder'],
    steps = [],
  } = scenarioData || {};

  const actionIds = [
    ...PRESET_ACTIONS.map((preset) => preset.id),
    ...ASSERTION_DEFINITIONS.map((definition) => `assertion_${definition.type}`),
  ];
  const validation = validateScenario(scenarioData, { actionIds, previewMode });
  if (validation.errors.length > 0) {
    return {
      valid: false,
      specCode: '',
      specRelativePath: '',
      requiredFixtures: [],
      warnings: validation.warnings,
      errors: validation.errors,
      compiledHash: null,
    };
  }
  const normalized = validation.scenario;

  const cleanFeatureName = normalized.featureName;
  const cleanScenarioName = normalized.scenarioName;
  const cleanTagStr = normalized.tags.join(' ');

  const fileNameSlug = sanitizeToIdentifier(cleanFeatureName).toLowerCase() || 'visual_scenario';
  const specFileName = normalized.fileName || `${fileNameSlug}-bdd.spec.js`;
  const specRelativePath = `tests/e2e/${normalized.platform}/${specFileName}`;

  // 1. Phân tích các fixtures cần import
  const fixtureSet = new Set(['test']);
  const dataImports = new Set();

  normalized.dataSources.forEach((source) => {
    const variable = source.variable;
    dataImports.add(`const ${variable} = require('../../../${source.file}');`);
  });
  normalized.pageObjects.forEach((pageObject) => {
    const relativePath = typeof pageObject === 'string' ? pageObject : pageObject?.path || pageObject?.relativePath;
    if (relativePath) {
      const baseName = relativePath.split('/').pop().replace(/\.js$/, '');
      fixtureSet.add(baseName.charAt(0).toLowerCase() + baseName.slice(1));
    }
  });
  if (normalized.precondition.auth === 'authenticated') fixtureSet.add('authenticatedUser');

  normalized.steps.forEach((step) => {
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);
    if (preset && preset.fixture) {
      preset.fixture.split(',').forEach((f) => fixtureSet.add(f.trim()));
    }
    if (step.actionId && (step.actionId.startsWith('assert_') || step.actionId.startsWith('assertion_'))) {
      fixtureSet.add('expect');
    }
  });

  const isMobile = normalized.platform === 'mobile-web';
  const fixtureImportPath = isMobile
    ? '../../../core/fixtures/mobileWebTest'
    : '../../../core/fixtures/baseTest';

  // 2. Tạo phần thân các bước BDD test.step()
  const stepBlocks = [];
  const preconditionLines = [];
  if (normalized.precondition.auth === 'authenticated') preconditionLines.push('      // Precondition: Đã chứng thực người dùng');
  if (normalized.precondition.verifyLandingPage) preconditionLines.push('      // Precondition: Xác thực trang đích');
  if (normalized.precondition.captureInitial) preconditionLines.push("      await page.screenshot({ path: 'evidence/precondition_initial_state.png' });");
  if (!preconditionLines.length) preconditionLines.push('      // Precondition đã sẵn sàng.');
  normalized.steps.forEach((step, idx) => {
    const stepType = step.stepType || (idx === 0 ? 'Given' : 'When');
    const stepTitle = step.title || step.name || `Bước ${idx + 1}`;
    const preset = PRESET_ACTIONS.find((p) => p.id === step.actionId);

    let stepBody = '';
    const assertionCode = compileAssertionStep(step);
    if (assertionCode) {
      stepBody = assertionCode;
    } else {
      stepBody = compilePresetStep(step, preset, { platform: normalized.platform, isMobile, allowCustomCode: normalized.allowCustomCode });
    }

    if (!stepBody) {
      const dataExpression = resolveDataExpression(step.dataRef || step.dataSource);
      if (step.actionId === 'fill_text' && dataExpression) {
        stepBody = `      await page.locator(${quote(step.locator || 'input')}).fill(${dataExpression});`;
      } else if (step.actionId === 'custom_code' && !normalized.allowCustomCode) {
        stepBody = '';
      }
    }

    if (!stepBody) {
      if (previewMode) {
        stepBody = '      // ⏳ Đang cấu hình hành động cho bước này trong Wizard...';
      } else {
        stepBody = '      throw new Error("BDD step has no executable action.");';
      }
    }

    const evidenceFixture = step.pageFixture || preset?.fixture?.split(',')[0]?.trim() || 'page';
    if (evidenceFixture === 'page') fixtureSet.add('page');
    stepBody += compileStepEvidence(step, { fixture: evidenceFixture });

    stepBlocks.push(`    await test.step(${quote(`${stepType} ${stepTitle}`)}, async () => {\n${stepBody}\n    });`);
  });

  // 3. Ghép thành file Spec hoàn chỉnh
  const fixturesArgList = Array.from(fixtureSet)
    .filter((f) => f !== 'test' && f !== 'expect')
    .join(',\n    ');

  const specCode = `const { test, expect } = require('${fixtureImportPath}');
${Array.from(dataImports).join('\n')}

test.describe(${quote(`Feature: ${cleanFeatureName} ${cleanTagStr}`)}, () => {

  test(${quote(cleanScenarioName)}, async ({
    ${fixturesArgList || 'page'}
  }, testInfo) => {
    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: ${quote(normalized.precondition.description || 'Khởi tạo bối cảnh và kiểm chứng tiền điều kiện kịch bản BDD')},
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

const FIXTURE_PAGE_MAP = {
  samplePage: { name: 'SamplePage.js', relativePath: 'pages/desktop/SamplePage.js', className: 'SamplePage' },
  sampleMobilePage: { name: 'SampleMobilePage.js', relativePath: 'pages/mobile/SampleMobilePage.js', className: 'SampleMobilePage' },
};

function getFixturePageMap(rootDir = process.cwd()) {
  const map = { ...FIXTURE_PAGE_MAP };
  const scanDirs = [
    { dir: 'pages/desktop', platform: 'desktop' },
    { dir: 'pages/mobile', platform: 'mobile' },
    { dir: 'pages/mobile-web', platform: 'mobile-web' },
    { dir: 'pages', platform: 'base' },
  ];
  for (const item of scanDirs) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        const base = path.basename(file, '.js');
        const fix = base.charAt(0).toLowerCase() + base.slice(1);
        const shortAlias = fix.endsWith('Page') ? fix.slice(0, -4) : fix;
        const pageEntry = {
          name: file,
          relativePath: `${item.dir}/${file}`.replace(/\\/g, '/'),
          className: base,
        };
        if (!map[fix]) map[fix] = pageEntry;
        if (shortAlias && !map[shortAlias]) map[shortAlias] = pageEntry;
      }
    }
  }
  return map;
}

/**
 * Trích xuất các bước BDD và metadata từ một file Spec có sẵn trong Framework
 * @param {string} filePath
 * @param {string} rootDir
 */
function parseExistingSpecFile(filePath, rootDir = process.cwd()) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file kịch bản: ${filePath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isMobile = normalizedPath.includes('mobile-web');

  // 1. Trích xuất Feature Name & Tags (Chỉ lấy tags trong test.describe)
  let featureName = path.basename(filePath, '.spec.js');
  let tags = '';
  const descMatch = content.match(/test\.describe\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/i);
  if (descMatch) {
    const rawDescribeString = descMatch[1] || descMatch[2] || descMatch[3] || '';
    
    // Chỉ lấy tags nằm trong chuỗi của test.describe
    const describeTagMatches = rawDescribeString.match(/@[\w-]+/g) || [];
    tags = Array.from(new Set(describeTagMatches)).join(' ');

    const rawDesc = rawDescribeString.replace(/^Feature:\s*/i, '');
    featureName = rawDesc.replace(/@[\w-]+/g, '').trim();
  }

  // 2. Trích xuất Scenario Name
  let scenarioName = 'Kịch bản kiểm thử';
  const testMatch = content.match(/test\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
  if (testMatch) {
    scenarioName = (testMatch[1] || testMatch[2] || testMatch[3] || '').trim();
  }

  // 3. Trích xuất Data Source & Data Files
  let dataSource = 'none';
  const dataFiles = [];
  const dataRegex = /require\(\s*['"`](?:.*\/)?data\/([^'"`]+)['"`]\s*\)/gi;
  let dMatch;
  while ((dMatch = dataRegex.exec(content)) !== null) {
    const dName = dMatch[1];
    if (!dataFiles.some((d) => d.name === dName)) {
      dataFiles.push({
        name: dName,
        relativePath: `data/${dName}`,
      });
    }
  }
  if (dataFiles.length > 0) {
    dataSource = dataFiles[0].name;
  }

  // 4. Trích xuất Fixtures từ arguments của test()
  const fixtures = [];
  const argsMatch = content.match(/test\([^,]+,\s*async\s*\(\s*\{([^}]*)\}\s*\)/);
  if (argsMatch) {
    const rawArgs = argsMatch[1];
    rawArgs.split(',').forEach((arg) => {
      const trimmed = arg.trim();
      if (trimmed && trimmed !== 'page' && trimmed !== 'test' && trimmed !== 'expect') {
        fixtures.push(trimmed);
      }
    });
  }

  // 5. Trích xuất các Page Objects tham gia (1 script -> nhiều pages)
  const pageMap = new Map();
  const fixturePageMap = getFixturePageMap(rootDir);

  // 5a. Nhận diện từ pages container: pages.<alias>.<action>(...)
  const pagesCallRegex = /\bpages\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(/g;
  let pcMatch;
  while ((pcMatch = pagesCallRegex.exec(content)) !== null) {
    const alias = pcMatch[1];
    const act = pcMatch[2];
    const pageInfo = fixturePageMap[alias] || fixturePageMap[alias.toLowerCase()];
    if (pageInfo) {
      const existing = pageMap.get(pageInfo.relativePath);
      if (existing) {
        if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !existing.actions.includes(act)) {
          existing.actions.push(act);
          existing.actionCount = existing.actions.length;
        }
      } else {
        const actions = ['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) ? [] : [act];
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name,
          className: pageInfo.className,
          relativePath: pageInfo.relativePath,
          actions,
          actionCount: actions.length,
        });
      }
    }
  }

  // 5b. Nhận diện từ individual fixtures hoặc local instances
  for (const [fixName, pageInfo] of Object.entries(fixturePageMap)) {
    const fixRegex = new RegExp(`\\b${fixName}\\b`);
    if (fixRegex.test(content) || fixtures.includes(fixName)) {
      const actRegex = new RegExp(`\\b${fixName}\\.([a-zA-Z0-9_]+)\\s*\\(`, 'g');
      const actions = [];
      let aMatch;
      while ((aMatch = actRegex.exec(content)) !== null) {
        const act = aMatch[1];
        if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !actions.includes(act)) {
          actions.push(act);
        }
      }

      const existing = pageMap.get(pageInfo.relativePath);
      if (existing) {
        actions.forEach((a) => {
          if (!existing.actions.includes(a)) existing.actions.push(a);
        });
        existing.actionCount = existing.actions.length;
      } else if (actions.length > 0 || fixtures.includes(fixName)) {
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name,
          className: pageInfo.className,
          relativePath: pageInfo.relativePath,
          actions,
          actionCount: actions.length,
        });
      }
    }
  }
  const pages = Array.from(pageMap.values());

  // 6. Trích xuất Steps từ test.step()
  const stepRegex = /await\s+test\.step\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\);/g;
  const steps = [];
  let match;
  while ((match = stepRegex.exec(content)) !== null) {
    const rawTitle = (match[1] || match[2] || match[3] || '').trim();
    const body = (match[4] || '').trim();
    let stepType = 'When';
    let cleanTitle = rawTitle;

    const typeMatch = rawTitle.match(/^(Given|When|Then|And)\s+(.+)$/i);
    if (typeMatch) {
      stepType = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
      if (stepType === 'And') stepType = 'And';
      cleanTitle = typeMatch[2].trim();
    }

    let matchedActionId = '';

    // 1. Kiểm tra chính xác các method invocation chuẩn
    if (body.includes('.goto(')) {
      matchedActionId = 'navigate_url';
    } else if (body.includes('.waitFor({') || body.includes('.waitFor(')) {
      matchedActionId = 'wait_visible';
    } else if (body.includes('.screenshot(') || body.includes('.capture(')) {
      matchedActionId = 'take_screenshot';
    } else if (body.includes('.click(')) {
      matchedActionId = 'click_element';
    } else if (body.includes('.fill(')) {
      matchedActionId = 'fill_text';
    }

    // 2. Khớp assertion nếu có
    if (!matchedActionId) {
      const assertionMatch = body.match(/\.((?:toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toHaveURL|toBeEnabled|toBeDisabled))\s*\(/);
      if (assertionMatch) {
        matchedActionId = `assertion_${assertionMatch[1]}`;
      }
    }

    // 3. Khớp chính xác theo tên mẫu preset
    if (!matchedActionId) {
      const exactPreset = PRESET_ACTIONS.find((p) => p.name.toLowerCase() === cleanTitle.toLowerCase());
      if (exactPreset) {
        matchedActionId = exactPreset.id;
      }
    }

    steps.push({
      id: `s_${Date.now()}_${steps.length + 1}`,
      stepType,
      title: cleanTitle,
      actionId: matchedActionId,
      code: body,
    });
  }

  return {
    filePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
    featureName,
    scenarioName,
    platform: isMobile ? 'mobile-web' : 'desktop',
    tags: tags || '@e2e @visualBuilder',
    dataSource,
    dataFiles,
    primaryDataFile: dataFiles[0]?.name || (dataSource !== 'none' ? dataSource : null),
    pages,
    pageCount: pages.length,
    fixtures,
    steps,
    stepCount: steps.length,
    specCode: content,
  };
}

/**
 * Quét toàn bộ kịch bản test hiện có trong framework
 * @param {string} rootDir
 */
function scanAllProjectScripts(rootDir = process.cwd()) {
  const scripts = [];
  const dirsToScan = [
    { dir: 'tests/e2e/desktop', platform: 'desktop' },
    { dir: 'tests/e2e/mobile-web', platform: 'mobile-web' },
    { dir: 'tests/api', platform: 'api' },
    { dir: 'tests/setup', platform: 'setup' },
  ];

  for (const item of dirsToScan) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.spec.js') || f.endsWith('.setup.js') || f.endsWith('.js'));
      for (const file of files) {
        try {
          const relPath = path.join(item.dir, file).replace(/\\/g, '/');
          const parsed = parseExistingSpecFile(relPath, rootDir);
          scripts.push({
            id: path.basename(file, '.spec.js').replace(/\.setup$/, '').replace(/\.js$/, ''),
            fileName: file,
            relativePath: relPath,
            featureName: parsed.featureName,
            scenarioName: parsed.scenarioName,
            platform: item.platform,
            tags: parsed.tags,
            dataFiles: parsed.dataFiles,
            primaryDataFile: parsed.primaryDataFile,
            pages: parsed.pages,
            pageCount: parsed.pages.length,
            stepCount: parsed.steps.length,
            steps: parsed.steps,
            specCode: parsed.specCode,
          });
        } catch (err) {
          console.error(`Error parsing script ${file}:`, err.message);
        }
      }
    }
  }
  return scripts;
}

module.exports = {
  PRESET_ACTIONS,
  compileVisualScenario,
  parseExistingSpecFile,
  scanAllProjectScripts,
  getFixturePageMap,
};
