const { maskSecrets } = require('../ai/copilotService');

const MAX_INPUT_LENGTH = 100000;

const CATEGORY_MAP = {
  'flaky-retry': 'flaky',
  'network-unreachable': 'environment',
  'page-crashed': 'environment',
  'gateway-unavailable': 'environment',
  'server-error': 'product_bug',
  'strict-mode-violation': 'test_bug',
  'target-closed': 'test_bug',
  'locator-not-found': 'test_bug',
  'script-error': 'test_bug',
  'fixture-error': 'test_bug',
  'covered-by-overlay': 'flaky',
  'test-timeout': 'flaky',
  'navigation-timeout': 'environment',
  'assertion-mismatch': 'product_bug',
  'unknown': 'unknown'
};

const LOCATOR_PATTERNS = [
  /\b((?:page\.)?getBy(?:Role|Text|Label|Placeholder|AltText|Title|TestId)\((?:[^()]|\([^()]*\))*\))/,
  /\b((?:page\.)?locator\((?:[^()]|\([^()]*\))*\))/,
  /waiting for selector ['"`]([^'"`]+)['"`]/i
];

function evidence(kind, value) {
  return value ? [{ kind, value: maskSecrets(String(value)).slice(0, 2000) }] : [];
}

function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') : (str || '');
}

function extractLocatorFromError(text = '') {
  for (const pattern of LOCATOR_PATTERNS) {
    const match = String(text).match(pattern);
    if (match) return match[1].replace(/^page\./, '');
  }
  return '';
}

function isRetryPass(input) {
  const status = String(input.status || input.outcome || '').toLowerCase();
  if (status === 'flaky') return true;
  return Number(input.retry) > 0 && (status === 'passed' || status === 'expected');
}

function analyzeDiagnostics(input = {}) {
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_INPUT_LENGTH) throw new Error('Diagnostic artifact vượt quá giới hạn.');
  const rawCombined = [input.error, input.message, input.stack, input.testTitle, input.stepTitle]
    .filter(Boolean)
    .map(stripAnsi)
    .join('\n');
  const errorText = maskSecrets(rawCombined);
  const locator = input.locator || extractLocatorFromError(errorText);

  const findings = [];
  const common = { step: input.stepTitle || input.testTitle || null, url: input.url || null };
  const add = (code, message, confidence, fix, sources) => {
    findings.push({
      code,
      category: CATEGORY_MAP[code] || 'test_bug',
      message,
      evidence: [...evidence('error', errorText), ...sources],
      confidence,
      suggestedFix: fix ? { type: fix.type, preview: fix.preview, requiresConfirmation: true } : null,
      ...common
    });
  };

  if (isRetryPass(input)) {
    add('flaky-retry', 'Test thất bại ở lần chạy đầu nhưng qua khi chạy lại (Playwright đánh dấu flaky).', 0.99, { type: 'stabilize', preview: 'Tìm điểm phụ thuộc thời gian hoặc dữ liệu dùng chung; thay chờ cứng bằng web-first assertion.' }, [...evidence('retry', `retry=${input.retry ?? '?'} status=${input.status || input.outcome}`)]);
  }

  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|socket hang up|net::ERR_(?:CONNECTION_[A-Z_]+|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|ADDRESS_UNREACHABLE|TIMED_OUT|NETWORK_CHANGED|CERT_[A-Z_]+|SSL_[A-Z_]+)/i.test(errorText)) {
    add('network-unreachable', 'Không kết nối được tới máy chủ kiểm thử (server chưa chạy, sai host/port, DNS hoặc chứng chỉ).', 0.95, { type: 'environment-check', preview: 'Kiểm tra baseURL, server đích đã khởi động, DNS/VPN và chứng chỉ HTTPS.' }, [...evidence('url', input.url)]);
  }

  if (/page crashed|target crashed|browser has disconnected|browser closed unexpectedly/i.test(errorText)) {
    add('page-crashed', 'Trình duyệt hoặc tab bị crash trong lúc chạy test.', 0.9, { type: 'environment-check', preview: 'Kiểm tra RAM/CPU của máy chạy, giảm số worker hoặc xem log crash của trình duyệt.' }, []);
  } else if (/target (?:page, context or browser )?(?:has been )?closed|has been closed/i.test(errorText)) {
    add('target-closed', 'Trang hoặc context đã đóng trước khi thao tác xong (thường do thiếu await hoặc test đã hết giờ trước đó).', 0.8, { type: 'code-fix', preview: 'Kiểm tra mọi lệnh Playwright đều có await và không đóng page/context sớm.' }, []);
  }

  if (/\b50[234]\b|Bad Gateway|Service Unavailable|Gateway Timeout/i.test(errorText)) {
    add('gateway-unavailable', 'Gateway/proxy trả 502/503/504: dịch vụ đích chưa sẵn sàng hoặc đang deploy.', 0.94, { type: 'environment-check', preview: 'Kiểm tra dịch vụ đích đã chạy, health check và lịch deploy của môi trường.' }, [...evidence('url', input.url)]);
  } else if (/\b5\d\d\b\s*Internal Server Error|(?:status(?:\s*code)?|response)\s*[:=]?\s*5\d\d\b/i.test(errorText)) {
    add('server-error', 'Máy chủ trả lỗi 500: lỗi phía backend/sản phẩm.', 0.93, { type: 'backend-review', preview: 'Xem log backend tại thời điểm lỗi và payload request tương ứng.' }, [...evidence('url', input.url)]);
  }

  if (/ReferenceError|TypeError|SyntaxError|is not defined|is not a function/i.test(errorText)) {
    add('script-error', 'Lỗi thực thi mã nguồn kiểm thử (script bug, thiếu import hoặc gọi hàm sai).', 0.98, { type: 'code-fix', preview: 'Sửa lỗi cú pháp hoặc khai báo hàm trong file spec/fixture.' }, [...evidence('stack', input.stack || input.error)]);
  }

  if (/intercept|covered|overlay|modal|obscure|element is not receiving events|to be hidden|detached from dom/i.test(errorText)) {
    add('covered-by-overlay', 'Phần tử có thể đang bị popup, dialog, lớp phủ che khuất, hoặc bị detach khỏi DOM.', 0.96, { type: 'timeout-or-dismiss-overlay', preview: 'Thêm bước đóng popup hoặc tăng timeout có kiểm soát.' }, [...evidence('screenshot', input.screenshot)]);
  }

  if (/test timeout of \d+ms exceeded/i.test(errorText)) {
    add('test-timeout', 'Thời gian thực thi của test vượt quá giới hạn tổng (hung process hoặc mạng chậm).', 0.95, { type: 'timeout-increase-or-split', preview: 'Tăng test timeout trong config hoặc chia nhỏ kịch bản kiểm thử.' }, [...evidence('test-step', input.testTitle)]);
  }

  const isStrictMode = /strict mode violation/i.test(errorText);
  const isElementFoundAssertion = /Received:\s*visible|expect\(.*not\.toBeVisible|toHaveURL|Received string:|Expected string:|received.*expected|expected.*received|Received: 500|Expected: 200/i.test(errorText);
  const isElementNotFound = /element\(s\)\s+not\s+found|element\s+not\s+found|no element|element is not an? <|Element is not a </i.test(errorText);

  if (isStrictMode) {
    add('strict-mode-violation', 'Locator khớp nhiều hơn một phần tử (strict mode) nên Playwright không biết thao tác với phần tử nào.', 0.97, { type: 'selector-update', preview: 'Thu hẹp locator: thêm name/exact cho getByRole, lọc theo vùng chứa, hoặc dùng .first() có chủ đích.' }, [...evidence('locator', locator)]);
  }

  if (isElementFoundAssertion && !isElementNotFound && !isStrictMode) {
    add('assertion-mismatch', 'Kết quả thực tế không khớp với điều kiện kiểm tra nghiệp vụ (phần tử tồn tại nhưng trạng thái/dữ liệu sai).', 0.95, { type: 'assertion-review', preview: 'Xem expected/received và chỉnh assertion sau khi xác nhận nghiệp vụ.' }, [...evidence('test-step', input.stepTitle)]);
  } else if (/expect\(|toBeVisible|toHaveText|toContainText|toHaveValue|assertion.*fail/i.test(errorText) && !isElementNotFound && !isStrictMode) {
    add('assertion-mismatch', 'Kết quả kiểm tra không thỏa mãn điều kiện mong đợi.', 0.90, { type: 'assertion-review', preview: 'Xem expected/received và chỉnh assertion sau khi xác nhận nghiệp vụ.' }, [...evidence('test-step', input.stepTitle)]);
  }

  if (isElementNotFound || /waiting for (locator|getBy).*(to be visible|to be enabled)/i.test(errorText)) {
    if (!/intercepts pointer events/i.test(errorText)) {
      add('locator-not-found', 'Không tìm thấy phần tử, locator sai, hoặc phần tử không đúng kiểu thẻ HTML.', 0.94, { type: 'selector-update', preview: 'Xem diff selector mới trước khi cập nhật Page Object.' }, [...evidence('locator', locator)]);
    }
  }

  if (/navigation timeout|page\.goto|net::err|exceeded.*navigation/i.test(errorText)) {
    add('navigation-timeout', 'Điều hướng không hoàn tất trong thời gian cho phép.', 0.92, { type: 'timeout', preview: 'Tăng navigation timeout và kiểm tra URL/môi trường.' }, [...evidence('url', input.url)]);
  }

  if (/fixture|beforeAll|beforeEach|authSetup|cannot read propert|undefined/i.test(errorText)) {
    add('fixture-error', 'Fixture hoặc tiền điều kiện không khởi tạo đúng.', 0.78, { type: 'fixture-review', preview: 'Kiểm tra fixture, dữ liệu test và thứ tự tiền điều kiện.' }, [...evidence('console', input.consoleLogs)]);
  }

  if (!findings.length) add('unknown', 'Chưa đủ bằng chứng để xác định nguyên nhân gốc.', 0.2, { type: 'collect-evidence', preview: 'Mở trace (npx playwright show-trace) hoặc dán thêm stack trace đầy đủ, log console và bước test đang chạy.' }, [...evidence('trace', input.trace)]);

  const topFinding = findings.slice().sort((a, b) => b.confidence - a.confidence)[0];
  const topCategory = topFinding ? topFinding.category : 'unknown';

  return { version: 1, deterministic: true, findings, topFinding, topCategory, locator, masked: true };
}

module.exports = { MAX_INPUT_LENGTH, CATEGORY_MAP, analyzeDiagnostics, extractLocatorFromError };
