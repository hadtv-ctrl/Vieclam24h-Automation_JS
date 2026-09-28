/**
 * core/ai/tasks/generatePlaywrightSpec.js
 * Generates a Playwright spec from BDD test cases (QA-2). Deterministic (0 token, no AI call).
 * A step that names its UI target in quotes (bấm nút "Lưu", nhập "a@b.vn" vào "Email", hiển thị "Đã lưu",
 * mở trang "/login") becomes a BasePage/UiActions call, so specs never touch page locators directly.
 * A test with any untranslated step is emitted as test.fixme: it cannot pass without real automation.
 * Strict ceiling <= 150 lines.
 */
const vm = require('vm');
const { buildRuleTestCases } = require('./generateTestCases');

const jsStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;
const attr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const role = (r, name) => jsStr(`role=${r}[name="${attr(name)}"]`);
const textSel = (t) => jsStr(`text=${t}`);
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (s = '') => String(s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const CLICK_ROLES = { 'nút': 'button', button: 'button', 'liên kết': 'link', link: 'link', tab: 'tab', menu: 'menuitem' };

// Ordered: the first matching rule wins. "không hiển thị" must be tested before "hiển thị".
// Step text is normalized first so every quoted UI name is delimited by straight double quotes.
const RULES = [
  { kind: 'assert', re: /(?:chuyển\s*(?:hướng\s*)?(?:đến|tới|sang)|điều\s*hướng\s*(?:đến|tới|sang)|redirect(?:ed)?\s+to|url\s+(?:là|chứa|contains?))\s*(?:trang\s*)?"?((?:https?:\/\/|\/)[^\s",;]*)/iu,
    code: (m) => `await expect(basePage.page).toHaveURL(new RegExp(${jsStr(escapeRegExp(m[1]))}));` },
  { kind: 'assert', re: /(?:không\s+(?:còn\s+)?hiển\s*thị|biến\s*mất|(?<![\p{L}])ẩn(?![\p{L}])|not\s+(?:be\s+)?(?:visible|displayed|shown)|hidden|disappears?)[^"]*"([^"]+)"/iu,
    code: (m) => `await expect(basePage.actions.resolveLocator(${textSel(m[1])})).toBeHidden();` },
  { kind: 'assert', re: /(?:nút|button)\s*"([^"]+)"\s*(?:bị\s+)?(?:vô\s*hiệu|mờ|disabled|không\s+bấm\s+được)/iu,
    code: (m) => `await expect(basePage.actions.resolveLocator(${role('button', m[1])})).toBeDisabled();` },
  { kind: 'assert', re: /(?:hiển\s*thị|xuất\s*hiện|(?<![\p{L}])(?:thấy|hiện)(?![\p{L}])|displays?|displayed|shows?|shown|sees?)[^"]*"([^"]+)"/iu,
    code: (m) => `await expect(basePage.actions.resolveLocator(${textSel(m[1])})).toBeVisible();` },
  { kind: 'action', re: /(?:mở|truy\s*cập|điều\s*hướng|vào|đi\s*(?:tới|đến)|(?:ở|tại)\s+(?:trang|màn\s*hình)|navigate|go\s+to|open|visit)[^"\/]*"?((?:https?:\/\/|\/)[^\s",;]*)/iu,
    code: (m) => `await basePage.navigate(${jsStr(m[1])});` },
  { kind: 'action', re: /(?:nhập|điền|gõ|fill|enter|type)\s+"([^"]*)"\s+(?:vào|in|into)\s+(?:ô|trường|field|input)?\s*"([^"]+)"/iu,
    code: (m) => `await basePage.fillInput(${role('textbox', m[2])}, ${jsStr(m[1])});` },
  { kind: 'action', re: /(?:nhập|điền)\s+(?:ô|trường)?\s*"([^"]+)"\s+(?:là|bằng|=|:)\s*"([^"]*)"/iu,
    code: (m) => `await basePage.fillInput(${role('textbox', m[1])}, ${jsStr(m[2])});` },
  { kind: 'action', re: /(?:đánh\s*dấu|tích\s+chọn|check)\s+(?:ô\s+|checkbox\s+)?"([^"]+)"/iu,
    code: (m) => `await basePage.actions.check(${role('checkbox', m[1])});` },
  { kind: 'action', re: /(bấm|nhấn|nhấp|click|tap|chọn)\s+(?:vào\s+)?(nút|button|liên\s*kết|link|tab|menu)?\s*"([^"]+)"/iu,
    code: (m) => {
      const noun = (m[2] || '').toLowerCase().replace(/\s+/g, ' ');
      const r = CLICK_ROLES[noun] || (/chọn/i.test(m[1]) ? null : 'button');
      return `await basePage.clickElement(${r ? role(r, m[3]) : textSel(m[3])});`;
    } }
];

function normalizeQuotes(text) {
  const t = clean(text).replace(/[“”]/g, '"');
  return t.includes('"') ? t : t.replace(/'([^']+)'/g, '"$1"');
}

const OUTSIDE_QUOTES = '(?=(?:[^"]*"[^"]*")*[^"]*$)';
const CLAUSE_SPLIT = new RegExp(`\\s*[;,]\\s*${OUTSIDE_QUOTES}|\\s+(?:và|and|rồi|then)\\s+${OUTSIDE_QUOTES}`, 'iu');

function translateStep(text) {
  // Split compound steps only outside quotes, so `bấm nút "Lưu và đóng"` stays whole.
  const parts = normalizeQuotes(text).split(CLAUSE_SPLIT).map((p) => p.trim()).filter(Boolean);
  const lines = [];
  let asserts = 0;
  for (const part of parts) {
    const rule = RULES.find((r) => r.re.test(part));
    if (!rule) return null;
    const m = part.match(rule.re);
    // A clause that still names a quoted target the rule did not consume would be dropped silently.
    const quoted = (part.match(/"[^"]*"/g) || []).map((q) => q.slice(1, -1));
    if (quoted.some((q) => !m.slice(1).includes(q))) return null;
    lines.push(rule.code(m));
    if (rule.kind === 'assert') asserts += 1;
  }
  return lines.length ? { lines, asserts } : null;
}

function normalizeCase(tc, idx) {
  const id = clean(tc.tcId || tc.suggestedId || tc.id || `TC-${String(idx + 1).padStart(3, '0')}`);
  const precondition = clean(tc.given || tc.precondition || '');
  const steps = precondition ? [{ keyword: 'Given', text: precondition }] : [];
  if (Array.isArray(tc.steps) && tc.steps.length) {
    for (const s of tc.steps) {
      String(s.action || '').split(/;\s*/).filter(Boolean).forEach((t) => steps.push({ keyword: 'When', text: clean(t) }));
      String(s.expected || '').split(/;\s*/).filter(Boolean).forEach((t) => steps.push({ keyword: 'Then', text: clean(t) }));
    }
  } else {
    String(tc.when || '').split(/;\s*/).filter(Boolean).forEach((t) => steps.push({ keyword: 'When', text: clean(t) }));
    String(tc.then || '').split(/;\s*/).filter(Boolean).forEach((t) => steps.push({ keyword: 'Then', text: clean(t) }));
  }
  return { id, acId: clean(tc.acId || 'AC-001'), title: clean(tc.title || `Kịch bản ${id}`), precondition, steps };
}

function renderTest(tc) {
  const translated = tc.steps.map((s) => ({ ...s, result: translateStep(s.text) }));
  const unmappedSteps = translated.filter((s) => !s.result).map((s) => `${s.keyword} ${s.text}`);
  const asserts = translated.reduce((n, s) => n + (s.result ? s.result.asserts : 0), 0);
  const runnable = translated.length > 0 && !unmappedSteps.length && asserts > 0;
  const body = translated.map((s) => {
    const inner = s.result
      ? s.result.lines.map((l) => `      ${l}`).join('\n')
      : `      throw new Error(${jsStr(`Chưa hiện thực bước: ${s.keyword} ${s.text}`)});`;
    return `    await test.step(${jsStr(`${s.keyword} ${s.text}`)}, async () => {\n${inner}\n    });`;
  });
  const annotation = `    testInfo.annotations.push({ type: 'Precondition', description: ${jsStr(tc.precondition || 'Chưa mô tả tiền điều kiện')} });`;
  const code = `  test${runnable ? '' : '.fixme'}(${jsStr(`${tc.id} - ${tc.acId} ${tc.title}`)}, async ({ basePage }, testInfo) => {\n${[annotation, ...body].join('\n\n')}\n  });`;
  return { code, meta: { id: tc.id, title: tc.title, runnable, unmappedSteps } };
}

function validateScriptSyntax(code = '') {
  try {
    new vm.Script(code);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function buildRuleSpec({ reqId = 'REQ-001', requirementTitle = '', tcList = [], criteriaText = '' } = {}) {
  const source = Array.isArray(tcList) && tcList.length ? tcList : (criteriaText.trim() ? buildRuleTestCases({ criteriaText }).testCases : []);
  if (!source.length) {
    return { ok: false, source: 'rule', error: 'Chưa có test case nào để sinh spec. Nhập Acceptance Criteria hoặc sinh test case trước.' };
  }
  const cleanReq = clean(reqId) || 'REQ-001';
  const fileName = `tests/e2e/${cleanReq.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}.spec.js`;
  const rendered = source.map((tc, i) => renderTest(normalizeCase(tc, i)));
  const describeTitle = `${cleanReq}${requirementTitle ? ` - ${clean(requirementTitle)}` : ''} @${cleanReq}`;
  const specCode = `const { test, expect } = require('../../core/fixtures/baseTest');\n\ntest.describe(${jsStr(describeTitle)}, () => {\n${rendered.map((r) => r.code).join('\n\n')}\n});\n`;
  const syntax = validateScriptSyntax(specCode);
  const tests = rendered.map((r) => r.meta);
  const runnable = tests.filter((t) => t.runnable).length;
  const summary = `${tests.length} test: ${runnable} chạy được, ${tests.length - runnable} để test.fixme vì còn bước chưa sinh được code. `
    + 'Ghi tên nút, ô nhập, thông báo và đường dẫn trong dấu ngoặc kép (ví dụ: bấm nút "Lưu") để bước được sinh code tự động.';
  return { ok: true, source: 'rule', fileName, specCode, usedPageObjects: ['BasePage'], syntaxValid: syntax.valid, syntaxError: syntax.error, summary, tests };
}

async function runGeneratePlaywrightSpec(params = {}) {
  return buildRuleSpec(params);
}

module.exports = { runGeneratePlaywrightSpec, buildRuleSpec, translateStep, validateScriptSyntax };
