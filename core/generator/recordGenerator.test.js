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
