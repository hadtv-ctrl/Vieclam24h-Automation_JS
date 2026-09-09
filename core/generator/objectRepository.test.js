const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const {
  scanAllPageObjects,
  parsePageObject,
  parseFixture,
  scanAllFixtures,
  getFixtureByName,
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
  updateLocatorSelector,
  getCoreCapabilities,
  inferElementCategory,
  inferHumanDescription,
  validateLocatorExpression,
  normalizePagePath,
  deletePageObject,
} = require('./objectRepository');

test('inferElementCategory categorizes buttons, inputs, links and modals correctly', () => {
  const btn = inferElementCategory('btnApplyNow', "this.page.getByRole('button')");
  assert.equal(btn.type, 'button');

  const txt = inferElementCategory('txtFullName', "this.page.getByRole('textbox')");
  assert.equal(txt.type, 'input');

  const link = inferElementCategory('noCVJobLink', "this.page.getByRole('link')");
  assert.equal(link.type, 'link');

  const modal = inferElementCategory('mobileEntryPopup', "this.page.locator('.mbep-popup')");
  assert.equal(modal.type, 'modal');
});

test('inferHumanDescription extracts meaningful text or clean name', () => {
  const desc1 = inferHumanDescription('btnApplyNow', "this.page.getByRole('button', { name: 'Nộp hồ sơ ngay' })");
  assert.match(desc1, /Nộp hồ sơ ngay/i);

  const desc2 = inferHumanDescription('txtFullName', "this.page.getByRole('textbox')");
  assert.match(desc2, /Full Name/i);
});

test('scanAllPageObjects scans only Page Objects and BasePage (excluding fixtures from catalog - R01, R06)', () => {
  const pages = scanAllPageObjects(process.cwd());
  assert.ok(pages.length >= 3);

  // Mọi item trong catalog đều không phải fixture
  assert.ok(pages.every((p) => p.platform !== 'fixture'));

  // Có BasePage với cờ isBase: true
  const basePage = pages.find((p) => p.className === 'BasePage');
  assert.ok(basePage);
  assert.equal(basePage.platform, 'base');
  assert.equal(basePage.isBase, true);

  // Có sample business page
  const sample = pages.find((p) => p.className !== 'BasePage');
  assert.ok(sample);
  assert.ok(sample.locatorCount >= 1 || sample.methodCount >= 1);
});

test('parsePageObject and parseFixture support allowlisted fixtures for BDD Inspector (R01, T11)', () => {
  const baseTestParsed = parsePageObject('core/fixtures/baseTest.js', process.cwd());
  assert.ok(baseTestParsed);
  assert.equal(baseTestParsed.platform, 'fixture');
  assert.equal(baseTestParsed.resourceKind, 'fixture');
  assert.equal(baseTestParsed.permissions.canDelete, false);
  assert.ok(baseTestParsed.methodCount >= 1);

  const mobileWebTestParsed = parsePageObject('core/fixtures/mobileWebTest.js', process.cwd());
  assert.ok(mobileWebTestParsed);
  assert.equal(mobileWebTestParsed.platform, 'fixture');
  assert.ok(mobileWebTestParsed.methodCount >= 1);
});

test('updateLocatorSelector and deletePageObject protect BasePage from modification (R04, T12)', () => {
  assert.throws(
    () => updateLocatorSelector({
      pageRelativePath: 'pages/BasePage.js',
      locatorName: 'btnTest',
      newExpression: "page.locator('button')",
      rootDir: process.cwd(),
    }),
    /BasePage\.js/
  );
  assert.throws(
    () => deletePageObject('pages/BasePage.js', process.cwd()),
    /BasePage\.js/
  );
});

test('getCoreCapabilities returns 5 core pillars with tags and status', () => {
  const caps = getCoreCapabilities();
  assert.equal(caps.length, 5);
  assert.ok(caps.some((c) => c.id === 'core_smart_evidence'));
  assert.ok(caps.some((c) => c.id === 'core_anti_flaky'));
  assert.ok(caps.some((c) => c.id === 'core_data_manager'));
});

test('updateLocatorSelector updates expression safely with backup', () => {
  const tmpDir = path.join(process.cwd(), 'pages', 'desktop', '.repo_test');
  fs.mkdirSync(tmpDir, { recursive: true });
  const sampleFile = path.join(tmpDir, 'SamplePage.js');
  fs.writeFileSync(
    sampleFile,
    `class SamplePage {
  constructor(page) {
    this.page = page;
    this.btnTest = page.getByRole('button', { name: 'Old' });
  }
}
module.exports = { SamplePage };
`,
    'utf8'
  );

  const res = updateLocatorSelector({
    pageRelativePath: 'pages/desktop/.repo_test/SamplePage.js',
    locatorName: 'btnTest',
    newExpression: "page.getByRole('button', { name: 'New Updated' })",
    rootDir: process.cwd(),
  });

  assert.equal(res.success, true);
  const updatedContent = fs.readFileSync(sampleFile, 'utf8');
  assert.match(updatedContent, /New Updated/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Object Repository rejects unsafe paths and locator statements', () => {
  assert.throws(() => normalizePagePath('../pages/desktop/HomePage.js'), /thư mục pages/);
  assert.throws(() => validateLocatorExpression('page.locator("button"); process.exit()'), /locator Playwright/);
  assert.doesNotThrow(() => validateLocatorExpression("page.getByRole('button', { name: 'Nộp hồ sơ' })"));
});

test('parsed Page Objects expose backend readiness metadata', () => {
  const pages = scanAllPageObjects(process.cwd());
  const sample = pages.find((p) => p.platform !== 'fixture');
  assert.ok(sample);
  const page = parsePageObject(sample.relativePath, process.cwd());
  assert.ok(page.fixtureName);
  assert.equal(page.readiness.ready, true);
  assert.equal(page.readiness.status, 'ready');
  assert.equal(page.readiness.checks.export, true);
});

test('F04: parseFixture returns complete key set for baseTest and mobileWebTest', () => {
  const baseFixture = parseFixture('core/fixtures/baseTest.js', process.cwd());
  const fixtureNames = baseFixture.methods.map((m) => m.name);

  // Phải bao gồm tất cả các fixtures kể cả option tuples và fixtures sau test.step
  assert.ok(fixtureNames.includes('workerUserData'));
  assert.ok(fixtureNames.includes('featureName'));
  assert.ok(fixtureNames.includes('basePage'));
  assert.ok(fixtureNames.includes('pageObjectsRoot'));
  assert.ok(fixtureNames.includes('pageObjectsPlatform'));
  assert.ok(fixtureNames.includes('pages'));
  assert.ok(fixtureNames.includes('authenticatedUser'));

  const mobileFixture = parseFixture('core/fixtures/mobileWebTest.js', process.cwd());
  const mobileNames = mobileFixture.methods.map((m) => m.name);
  assert.ok(mobileNames.includes('failureTrackerHook'));
  assert.ok(mobileNames.includes('authenticatedUser'));
  assert.ok(mobileNames.includes('pages'));
});

test('F05: parseFixture handles invalid syntax and sets ready=false, status=error', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test_f05_fixture');
  const fixDir = path.join(tmpDir, 'core', 'fixtures');
  fs.mkdirSync(fixDir, { recursive: true });
  const malformedFile = path.join(fixDir, 'baseTest.js');
  fs.writeFileSync(malformedFile, 'const test = ; invalid syntax here\nmodule.exports = {};', 'utf8');

  try {
    const parsed = parseFixture('core/fixtures/baseTest.js', tmpDir);
    assert.equal(parsed.readiness.ready, false);
    assert.equal(parsed.readiness.status, 'error');
    assert.equal(parsed.readiness.checks.syntax, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F06: parseExistingSpecFile recognizes pages.<alias>.<action> from pages fixture', () => {
  const { parseExistingSpecFile } = require('./visualBuilderCompiler');
  const parsed = parseExistingSpecFile('tests/e2e/desktop/sample_pages_fixture.spec.js', process.cwd());

  assert.ok(parsed.pages && parsed.pages.length > 0);
  const samplePageEntry = parsed.pages.find((p) => p.className === 'SamplePage');
  assert.ok(samplePageEntry);
  assert.ok(samplePageEntry.actions.includes('open'));
});

test('scanAllFixtures, createCustomFixture and deleteCustomFixture manage custom fixtures safely', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test_fixture_mgmt');
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Quét fixtures hiện tại
    const fixtures = scanAllFixtures(process.cwd());
    assert.ok(fixtures.length > 0);
    assert.ok(fixtures.some((f) => f.name === 'pages'));
    assert.ok(fixtures.some((f) => f.name === 'authenticatedUser'));

    // 2. Tạo Custom Fixture xóa user bằng template cleanup_api
    const created = createCustomFixture({
      name: 'ephemeralUserTest',
      title: 'Tự động tạo & xóa user',
      description: 'Tạo user thử nghiệm và tự động xóa sau test qua API',
      template: 'cleanup_api',
      config: {
        url: '/api/users/:id',
        method: 'DELETE',
      },
      rootDir: tmpDir,
    });

    assert.equal(created.success, true);
    assert.equal(created.name, 'ephemeralUserTest');

    // Quét lại trong tmpDir
    const customFixturesList = scanAllFixtures(tmpDir);
    assert.ok(customFixturesList.some((f) => f.name === 'ephemeralUserTest' && f.isCustom === true));

    // 3. Từ chối tạo fixture trùng tên bảo vệ
    assert.throws(
      () => createCustomFixture({ name: 'pages', rootDir: tmpDir }),
      /trùng với từ khóa hoặc Core Fixture/
    );

    // 4. Từ chối xóa Core Fixture
    assert.throws(
      () => deleteCustomFixture('pages', tmpDir),
      /Không thể xóa Core Fixture/
    );

    // 5. Xóa Custom Fixture vừa tạo
    const deleted = deleteCustomFixture('ephemeralUserTest', tmpDir);
    assert.equal(deleted.success, true);

    const postDeleteList = scanAllFixtures(tmpDir);
    assert.ok(!postDeleteList.some((f) => f.name === 'ephemeralUserTest'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('validateCustomFixtureSource, getFixtureByName, and updateCustomFixture with conflict detection', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test_fixture_crud');
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Validate source
    const validResult = validateCustomFixtureSource({
      name: 'myTestFixture',
      sourceCode: 'const myTestFixture = async ({ page }, use) => { await use(); }; module.exports = { myTestFixture };',
      rootDir: tmpDir,
    });
    assert.equal(validResult.valid, true);
    assert.ok(validResult.revision);

    const invalidSyntax = validateCustomFixtureSource({
      name: 'badFixture',
      sourceCode: 'const bad = { ;',
      rootDir: tmpDir,
    });
    assert.equal(invalidSyntax.valid, false);
    assert.match(invalidSyntax.error, /Lỗi cú pháp/);

    const reservedName = validateCustomFixtureSource({
      name: 'pages',
      sourceCode: 'const pages = async () => {};',
      rootDir: tmpDir,
    });
    assert.equal(reservedName.valid, false);
    assert.match(reservedName.error, /trùng với từ khóa/);

    // 2. Tạo fixture
    const created = createCustomFixture({
      name: 'myTestFixture',
      title: 'Fixture thử nghiệm',
      rawCode: 'const myTestFixture = async ({ page }, use) => { await use(); }; module.exports = { myTestFixture };',
      rootDir: tmpDir,
    });
    assert.equal(created.success, true);

    // 3. getFixtureByName
    const fetched = getFixtureByName('myTestFixture', tmpDir);
    assert.ok(fetched);
    assert.equal(fetched.name, 'myTestFixture');
    assert.equal(fetched.revision, created.revision);

    // 4. Update với conflict expectedRevision
    assert.throws(
      () => updateCustomFixture({
        name: 'myTestFixture',
        sourceCode: 'const myTestFixture = async ({ page }, use) => { console.log(1); await use(); }; module.exports = { myTestFixture };',
        expectedRevision: 'wrong_hash_123',
        rootDir: tmpDir,
      }),
      /Conflict/
    );

    // 5. Update thành công với đúng expectedRevision
    const updated = updateCustomFixture({
      name: 'myTestFixture',
      sourceCode: 'const myTestFixture = async ({ page }, use) => { console.log(1); await use(); }; module.exports = { myTestFixture };',
      expectedRevision: fetched.revision,
      rootDir: tmpDir,
    });
    assert.equal(updated.success, true);
    assert.notEqual(updated.revision, fetched.revision);

    // 6. Xóa với revision
    const deleted = deleteCustomFixture('myTestFixture', tmpDir, updated.revision);
    assert.equal(deleted.success, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


