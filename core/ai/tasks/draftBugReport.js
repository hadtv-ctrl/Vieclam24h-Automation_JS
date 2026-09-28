/**
 * core/ai/tasks/draftBugReport.js
 * Generates structured Bug Report drafts from Playwright test failures (QA-4).
 * Deterministic rule engine (0 token, no AI call): every line comes from the failure artifacts,
 * nothing is invented. Strict ceiling <= 150 lines.
 */
const TITLE_PREFIX = { product_bug: '[Bug]', test_bug: '[Test]', environment: '[Môi trường]', flaky: '[Flaky]' };
const CRITICAL_RE = /\b500\b|Internal Server Error|crash|fatal|unhandled|data loss|mất dữ liệu|system\s*down/i;

const unquote = (s = '') => String(s).replace(/^\s*['"`]|['"`]\s*$/g, '').trim();

function describeTarget(args = '') {
  const role = args.match(/^\s*['"`](\w+)['"`]\s*,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`]/);
  if (role) return `${role[1]} "${role[2]}"`;
  return unquote(args.split(/,\s*\{/)[0]);
}

// Matches `page.getByRole('button', { name: 'X' }).click()` or `page.locator('#a').fill('v')`.
const ACTION_RE = /(?:page\.)?(?:locator|getBy[A-Za-z]+)\(((?:[^()]|\([^()]*\))*)\)(?:\.(?:first|last|nth)\([^)]*\))*\.(click|dblclick|fill|check|uncheck|selectOption|press)\(([^)]*)\)/;

function stepFromLine(line) {
  const title = line.match(/test\.step\(\s*['"`]([^'"`]+)['"`]/);
  if (title) return title[1];
  const gotoM = line.match(/page\.goto\(\s*['"`]([^'"`]+)['"`]/);
  if (gotoM) return `Mở trang ${gotoM[1]}`;
  const act = line.match(ACTION_RE);
  if (act) {
    const target = describeTarget(act[1]);
    const value = unquote(act[3]);
    if (act[2] === 'fill') return `Nhập "${value}" vào ${target}`;
    if (act[2] === 'selectOption') return `Chọn "${value}" trong ${target}`;
    if (act[2] === 'press') return `Nhấn phím ${value} tại ${target}`;
    if (act[2] === 'check' || act[2] === 'uncheck') return `${act[2] === 'check' ? 'Đánh dấu' : 'Bỏ đánh dấu'} ${target}`;
    return `Click vào ${target}`;
  }
  const clickM = line.match(/page\.click\(\s*['"`]([^'"`]+)['"`]/);
  if (clickM) return `Click vào ${clickM[1]}`;
  const expectM = line.match(/expect\((.*?)\)\.(not\.)?([a-zA-Z]+)\((.*?)\)\s*;?\s*$/);
  if (expectM) return `Kiểm tra ${expectM[1].replace(/^page\.?/, '') || 'trang'} ${expectM[2] || ''}${expectM[3]}(${expectM[4]})`;
  return null;
}

function extractStepsFromSnippet(snippet = '', { testTitle = '', locator = '', url = '', errorText = '' } = {}) {
  const steps = String(snippet).split(/\r?\n|;(?=\s*(?:await|expect))/).map((l) => stepFromLine(l.trim())).filter(Boolean);
  if (url && !steps.some((s) => s.startsWith('Mở trang'))) steps.unshift(`Mở trang ${url}`);
  if (steps.length <= (url ? 1 : 0)) {
    const failedAction = String(errorText).match(/locator\.(\w+)|page\.(\w+)\(/);
    steps.push(`Chạy kịch bản kiểm thử: ${testTitle || 'Playwright spec'}`);
    if (locator) steps.push(`${failedAction ? `Thực hiện ${failedAction[1] || failedAction[2]} trên` : 'Thao tác với'} ${locator}`);
  }
  return steps.map((s, i) => `${i + 1}. ${s}`);
}

function extractResults(errorText = '') {
  const lines = String(errorText).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('at ') && !l.includes('node_modules'));
  const pick = (re) => (lines.find((l) => re.test(l)) || '').replace(re, '').trim();
  const expected = pick(/^Expected(?: string| pattern| substring| value)?\s*:\s*/i);
  const received = pick(/^Received(?: string| value)?\s*:\s*/i);
  const timeout = String(errorText).match(/Timeout (\d+)ms exceeded/i);
  const waitingFor = String(errorText).match(/waiting for ((?:locator|getBy)[^\n]*?)(?: to be (\w+))?\s*$/im);
  if (expected || received) {
    return { expectedResult: expected ? `Giá trị mong đợi: ${expected}` : '', actualResult: received ? `Giá trị thực tế: ${received}` : lines[0] || '' };
  }
  if (timeout && waitingFor) {
    return {
      expectedResult: `${waitingFor[1]} ${waitingFor[2] ? `ở trạng thái "${waitingFor[2]}"` : 'sẵn sàng'} trong ${timeout[1]}ms`,
      actualResult: `Hết ${timeout[1]}ms chờ ${waitingFor[1]}`
    };
  }
  return { expectedResult: '', actualResult: (lines[0] || 'Lỗi kiểm thử Playwright').slice(0, 300) };
}

function heuristicBugReport({ testTitle = '', errorText = '', locator = '', snippet = '', url = '', browser = '', triageCategory = '', triageSummary = '', suggestedFix = '' } = {}) {
  const category = TITLE_PREFIX[triageCategory] ? triageCategory : 'product_bug';
  const severity = CRITICAL_RE.test(errorText) ? 'Critical' : (category === 'test_bug' || category === 'flaky') ? 'Minor' : 'Major';
  const subject = testTitle || triageSummary || `Kiểm thử thất bại: ${locator || errorText.split(/\r?\n/)[0].slice(0, 60)}`;
  const title = `${TITLE_PREFIX[category]} ${subject}`.trim();
  const stepsToReproduce = extractStepsFromSnippet(snippet, { testTitle, locator, url, errorText });
  const results = extractResults(errorText);
  const expectedResult = results.expectedResult || 'Kịch bản chạy qua toàn bộ assertion, phần tử phản hồi đúng nghiệp vụ.';
  const actualResult = results.actualResult.slice(0, 300);
  const environment = [`URL: ${url || 'chưa ghi nhận'}`, `Trình duyệt: ${browser || 'Playwright (chưa ghi nhận project)'}`, `OS: ${process.platform}`].join(', ');
  const fix = suggestedFix || triageSummary || '';
  const evidence = String(errorText).split(/\r?\n/).filter((l) => l.trim() && !l.includes('node_modules')).slice(0, 15).join('\n');
  const markdownReport = [
    `## ${title}`, '', `**Severity:** ${severity}`, `**Environment:** ${environment}`, testTitle ? `**Test:** ${testTitle}` : '', '',
    '### Steps to Reproduce:', ...stepsToReproduce, '',
    '### Expected Result:', expectedResult, '',
    '### Actual Result:', actualResult, '',
    ...(evidence ? ['### Evidence:', '```', evidence, '```', ''] : []),
    ...(fix ? ['### Suggested Fix:', fix] : [])
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n').trim();

  return { ok: true, source: 'rule', title, severity, stepsToReproduce, expectedResult, actualResult, environment, suggestedFix: fix, markdownReport };
}

async function runDraftBugReport(params = {}) {
  return heuristicBugReport(params);
}

module.exports = { heuristicBugReport, extractStepsFromSnippet, extractResults, runDraftBugReport };
