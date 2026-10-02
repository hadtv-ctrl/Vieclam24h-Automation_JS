const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlaywrightScript } = require('./recordParser');
const { transformToPomAndSpec } = require('./recordTransformer');

test('recordParser parses actions and assertions', () => {
  const sampleScript = `
    test('User login flow', async ({ page }) => {
      await page.goto('https://example.com/login');
      await page.getByPlaceholder('Nhập số điện thoại').fill('0987654321');
      await page.getByRole('button', { name: 'Tiếp tục' }).click();
      await expect(page.getByText('Nhập mã OTP')).toBeVisible();
    });
  `;

  const parsed = parsePlaywrightScript(sampleScript);
  assert.equal(parsed.scenarioName, 'User login flow');
  assert.equal(parsed.detectedUrl, 'https://example.com/login');
  assert.equal(parsed.actions.length, 4);
  assert.equal(parsed.actions[0].type, 'goto');
  assert.equal(parsed.actions[1].type, 'fill');
  assert.equal(parsed.actions[2].type, 'click');
  assert.equal(parsed.actions[3].type, 'assertion');
  assert.equal(parsed.actions[3].assertionType, 'toBeVisible');
});

test('recordTransformer generates POM and Spec with assertions', () => {
  const actions = [
    { type: 'goto', url: 'https://example.com/login' },
    { type: 'fill', locator: 'page.getByPlaceholder("Phone")', locatorVar: 'phoneInput', value: '0987654321' },
    { type: 'click', locator: 'page.getByRole("button", { name: "Submit" })', locatorVar: 'submitBtn' },
    { type: 'assertion', locatorVar: 'otpText', assertionType: 'toBeVisible' },
  ];

  const result = transformToPomAndSpec({
    platform: 'desktop',
    actions,
    pageClassName: 'LoginPage',
    methodName: 'loginWithPhone',
    featureName: 'User Login',
  });

  assert.ok(result.pomDraft.content.includes('class LoginPage extends BasePage'));
  assert.ok(result.pomDraft.content.includes('await this.actions.fill(this.phoneInput, \'0987654321\')'));
  assert.ok(result.pomDraft.content.includes('await expect(this.otpText).toBeVisible()'));
  assert.ok(result.specDraft.content.includes('Feature: User Login @record @e2e'));
  assert.ok(result.specDraft.content.includes('await loginPage.loginWithPhone()'));
});

test('generateLocatorName prevents identifier starting with numbers', () => {
  const { generateLocatorName } = require('./namingUtils');

  assert.equal(generateLocatorName("page.getByRole('link', { name: '2', exact: true })"), 'link2');
  assert.equal(generateLocatorName("page.getByRole('link', { name: '3', exact: true })"), 'link3');
  assert.equal(generateLocatorName("page.getByRole('button', { name: '1 năm', exact: true })"), 'btn1Nam');
  assert.equal(generateLocatorName("page.getByRole('button', { name: '- 15 triệu' })"), 'btn15Trieu');
  assert.equal(generateLocatorName("page.getByText('100% bảo mật')"), 'text100BaoMat');
});

test('transformToPomAndSpec produces syntactically valid JavaScript with numeric locators', () => {
  const sampleScript = `
    test('Job search pagination and filters', async ({ page }) => {
      await page.goto('https://vieclam24h.vn/');
      await page.getByRole('link', { name: '2', exact: true }).click();
      await page.getByRole('button', { name: '1 năm', exact: true }).click();
      await page.getByRole('button', { name: '- 15 triệu' }).click();
    });
  `;

  const parsed = parsePlaywrightScript(sampleScript);
  const result = transformToPomAndSpec({
    platform: 'desktop',
    actions: parsed.actions,
    pageClassName: 'ChopChatbotPage',
    methodName: 'performRecordedActions',
  });

  // Verify that the generated Page Object code is valid JavaScript syntax
  assert.doesNotThrow(() => {
    new Function(result.pomDraft.content);
  });
  assert.doesNotThrow(() => {
    new Function(result.specDraft.content);
  });
  assert.ok(result.pomDraft.content.includes('this.link2 = page.getByRole'));
  assert.ok(result.pomDraft.content.includes('this.btn1Nam = page.getByRole'));
  assert.ok(result.pomDraft.content.includes('this.btn15Trieu = page.getByRole'));
});
