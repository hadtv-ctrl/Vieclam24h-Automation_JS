const test = require('node:test');
const assert = require('node:assert/strict');
const { UiActions } = require('./commonUtils');

class MockLocator {
  constructor(name) {
    this.name = name;
    this.waitCalls = [];
    this.clickCalls = [];
    this.fillCalls = [];
    this.checkCalls = [];
  }

  first() {
    return this;
  }

  async waitFor(options = {}) {
    this.waitCalls.push(options);
  }

  async click(options = {}) {
    this.clickCalls.push(options);
  }

  async fill(value, options = {}) {
    this.fillCalls.push({ value, options });
  }

  async check(options = {}) {
    this.checkCalls.push(options);
  }
}

class MockPage {
  constructor() {
    this.locators = {};
  }

  locator(selector) {
    if (!this.locators[selector]) {
      this.locators[selector] = new MockLocator(selector);
    }
    return this.locators[selector];
  }
}

test('UiActions waits for visibility before click/fill/check', async () => {
  const page = new MockPage();
  const actions = new UiActions(page);

  const clickLocator = await actions.click('#submit', { force: true });
  assert.equal(clickLocator.clickCalls.length, 1);
  assert.deepEqual(clickLocator.waitCalls[0], { state: 'visible', timeout: 15000 });

  const fillLocator = await actions.fill('#name', 'Jane');
  assert.equal(fillLocator.fillCalls.length, 1);
  assert.equal(fillLocator.fillCalls[0].value, 'Jane');

  const checkLocator = await actions.check('#agree');
  assert.equal(checkLocator.checkCalls.length, 1);
});

test('UiActions normalizes selector strings before waiting', async () => {
  const page = new MockPage();
  const actions = new UiActions(page);

  const locator = await actions.waitForVisible('#dynamic', { timeout: 5000 });

  assert.ok(locator);
  assert.deepEqual(page.locators['#dynamic'].waitCalls[0], { state: 'visible', timeout: 5000 });
});

test('UiActions rejects bare locator methods like .first instead of .first()', async () => {
  const page = new MockPage();
  const actions = new UiActions(page);

  await assert.rejects(
    () => actions.waitForVisible(page.locator('#submit').first),
    /call \.first\(\) /i
  );
});
