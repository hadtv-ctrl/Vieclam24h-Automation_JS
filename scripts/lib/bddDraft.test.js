/**
 * scripts/lib/bddDraft.test.js
 * Chạy tay: node --test scripts/lib/bddDraft.test.js
 *
 * Hai thứ được kiểm ở đây, và chỉ hai thứ:
 *  1. Bóc đúng bảng bước ra khỏi tài liệu Markdown thật.
 *  2. Bản thảo sinh ra KHÔNG chứa gì mà tài liệu không nói.
 * Điểm (2) là lý do tính năng này dừng ở văn bản: mọi dòng phải truy về được một ô trong
 * tài liệu, để người đọc kiểm được bằng mắt.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { extractTestCaseDetails } = require('./qaTrace');
const { buildBddDraft, buildBddDraftDocument, slugify } = require('./bddDraft');

const NL = String.fromCharCode(10);

const DOC = [
  '# Test Cases: REQ-001',
  '',
  '| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |',
  '|---|---|---|---|---|---|',
  '| REQ-001 | AC-001 | TC-001 | Candidate | - | P0 |',
  '',
  '### TC-001: Landing hiển thị đúng ba Entry Point',
  '',
  '- Type: Functional',
  '- Priority: P0',
  '- Automation: Candidate',
  '- Tags: `@p0 @smoke`',
  '- Preconditions: Chưa đăng nhập, xoá sạch session/storage',
  '- Test data: không',
  '',
  '| Step | Action | Expected result |',
  '|---|---|---|',
  '| 1 | Mở landing | Trang tải xong |',
  '| 2 | Đếm Entry Point | Đúng 3 lựa chọn |',
  '',
  '### TC-002: Test case không có bảng bước',
  '',
  '- Priority: P1',
  '',
  'Chỉ có mô tả văn xuôi, không có bảng.',
  '',
  '## Mục khác cùng cấp cao hơn',
  '',
  '| Step | Action | Expected result |',
  '|---|---|---|',
  '| 1 | Bước này KHÔNG thuộc test case nào | không được nhặt |',
  '',
].join(NL);

test('bóc đúng metadata và bảng bước của từng test case', () => {
  const map = extractTestCaseDetails(DOC);
  assert.deepEqual([...map.keys()], ['TC-001', 'TC-002']);

  const tc1 = map.get('TC-001');
  assert.equal(tc1.title, 'Landing hiển thị đúng ba Entry Point');
  assert.equal(tc1.meta.preconditions, 'Chưa đăng nhập, xoá sạch session/storage');
  assert.equal(tc1.meta.tags, '@p0 @smoke', 'dấu backtick phải được gỡ');
  assert.equal(tc1.steps.length, 2);
  assert.deepEqual(tc1.steps[0], { no: '1', action: 'Mở landing', expected: 'Trang tải xong' });
});

test('test case không có bảng bước thì trả mảng rỗng, KHÔNG bịa', () => {
  const tc2 = extractTestCaseDetails(DOC).get('TC-002');
  assert.deepEqual(tc2.steps, []);
  assert.equal(tc2.meta.priority, 'P1');
});

test('bảng nằm ngoài phạm vi test case không bị nhặt nhầm', () => {
  const all = extractTestCaseDetails(DOC);
  const everyStep = [...all.values()].flatMap((d) => d.steps.map((s) => s.action));
  assert.ok(
    !everyStep.some((a) => a.includes('KHÔNG thuộc test case nào')),
    'tiêu đề cùng cấp hoặc cao hơn phải đóng phạm vi test case',
  );
});

test('nhận cột theo TÊN, không theo vị trí', () => {
  const doc = [
    '### TC-009: Cột đảo thứ tự và có cột thừa',
    '',
    '| Expected result | Ghi chú | Action | Step |',
    '|---|---|---|---|',
    '| Thấy trang chủ | n/a | Mở trang | 1 |',
    '',
  ].join(NL);
  const tc = extractTestCaseDetails(doc).get('TC-009');
  assert.deepEqual(tc.steps, [{ no: '1', action: 'Mở trang', expected: 'Thấy trang chủ' }]);
});

test('bảng không phải bảng bước thì bỏ qua', () => {
  const doc = [
    '### TC-010: Có bảng dữ liệu, không phải bảng bước',
    '',
    '| Tài khoản | Mật khẩu |',
    '|---|---|',
    '| a@b.com | 123 |',
    '',
  ].join(NL);
  assert.deepEqual(extractTestCaseDetails(doc).get('TC-010').steps, []);
});

// --- Sinh bản thảo ---

const CANDIDATE = {
  id: 'TC-001',
  req: 'REQ-001',
  acs: ['AC-001'],
  priority: 'P0',
  automation: 'candidate',
  file: 'test-cases/REQ-001.md',
};

test('bản thảo mang đủ truy vết, script contract và các bước Given/When/Then', () => {
  const detail = extractTestCaseDetails(DOC).get('TC-001');
  const { text, stepCount, warnings } = buildBddDraft({ candidate: CANDIDATE, detail, dirs: { specs: 'tests' } });

  assert.equal(stepCount, 2);
  assert.deepEqual(warnings, []);

  assert.ok(text.includes('# TC-001 - Landing hiển thị đúng ba Entry Point'));
  assert.ok(text.includes('- Requirement: REQ-001'));
  assert.ok(text.includes('- Acceptance criteria: AC-001'));
  assert.ok(text.includes('`TC-001 - Landing hiển thị đúng ba Entry Point`'), 'test title theo Script contract');
  assert.ok(text.includes('tests/e2e/'), 'spec path phải theo thư mục spec của repo');

  // Given không được rỗng, phải có assertion kiểm tra trạng thái xuất phát.
  assert.ok(text.includes('Given Tiền điều kiện: Chưa đăng nhập, xoá sạch session/storage'));
  assert.ok(text.includes('Khẳng định trạng thái xuất phát'));

  assert.ok(text.includes('When  [1] Mở landing'));
  assert.ok(text.includes('Then  [1] Trang tải xong'));
  assert.ok(text.includes('When  [2] Đếm Entry Point'));
  assert.ok(text.includes('Then  [2] Đúng 3 lựa chọn'));
});

test('bản thảo KHÔNG chứa nội dung mà tài liệu không nói', () => {
  const detail = extractTestCaseDetails(DOC).get('TC-001');
  const { text } = buildBddDraft({ candidate: CANDIDATE, detail, dirs: { specs: 'tests' } });

  // Chỉ xét PHẦN KỊCH BẢN: đó là nơi bịa đặt sẽ gây hại. Checklist bên dưới được phép
  // nhắc `data-testid` vì đó là TIÊU CHÍ sẵn sàng, không phải locator của test case này.
  const scenario = text.slice(text.indexOf('## Kịch bản BDD'), text.indexOf('## Tài liệu chưa trả lời'));
  assert.ok(scenario.length > 50, 'không cắt được phần kịch bản');
  for (const invented of ['page.click', 'getByRole', 'data-testid', 'await expect(', '.locator(', 'css=']) {
    assert.ok(!scenario.includes(invented), `kịch bản tự bịa "${invented}"`);
  }
  // Và phải nói thẳng là chưa biết những thứ đó.
  assert.ok(text.includes('Locator / Page Object'), 'phải nêu rõ phần tài liệu chưa trả lời được');
});

test('thiếu bảng bước hoặc thiếu precondition thì cảnh báo, không im lặng', () => {
  const detail = extractTestCaseDetails(DOC).get('TC-002');
  const { warnings, stepCount, text } = buildBddDraft({
    candidate: { id: 'TC-002', req: 'REQ-001', acs: [], priority: 'P1', file: 'test-cases/REQ-001.md' },
    detail,
    dirs: { specs: 'tests' },
  });
  assert.equal(stepCount, 0);
  assert.equal(warnings.length, 2, 'thiếu bảng bước VÀ thiếu precondition');
  assert.ok(warnings.some((w) => w.includes('Step | Action | Expected result')));
  assert.ok(warnings.some((w) => w.includes('Preconditions')));
  assert.ok(text.includes('<chưa có bước nào trong tài liệu>'), 'phải nói rõ là chưa có, không để trống');
});

test('không có detail vẫn dựng được khung, không ném lỗi', () => {
  const { text, warnings } = buildBddDraft({ candidate: { id: 'TC-777' }, detail: null, dirs: {} });
  assert.ok(text.includes('# TC-777'));
  assert.equal(warnings.length, 2);
});

test('văn bản gộp chứa kịch bản BDD sạch sẽ, sẵn sàng sử dụng', () => {
  const detail = extractTestCaseDetails(DOC).get('TC-001');
  const drafts = [buildBddDraft({ candidate: CANDIDATE, detail, dirs: { specs: 'tests' } })];
  const doc = buildBddDraftDocument(drafts, { source: 'test-cases/' });

  assert.ok(doc.includes('TC-001'));
  assert.ok(!doc.includes('Bản thảo KHÔNG được lưu lại'), 'disclaimer phải được đưa ra Dashboard UI chứ không nằm trong script BDD');
});

test('cảnh báo của mọi test case được gom lên đầu văn bản', () => {
  const map = extractTestCaseDetails(DOC);
  const drafts = [
    buildBddDraft({ candidate: CANDIDATE, detail: map.get('TC-001'), dirs: {} }),
    buildBddDraft({ candidate: { id: 'TC-002' }, detail: map.get('TC-002'), dirs: {} }),
  ];
  const doc = buildBddDraftDocument(drafts);
  const warnIndex = doc.indexOf('## Cảnh báo');
  assert.ok(warnIndex >= 0);
  assert.ok(warnIndex < doc.indexOf('# TC-001'), 'cảnh báo phải đứng trước nội dung');
});

test('slugify bỏ dấu tiếng Việt để đề xuất tên file hợp lệ', () => {
  assert.equal(slugify('Đăng ký tài khoản người tìm việc'), 'dang-ky-tai-khoan-nguoi-tim-viec');
  assert.equal(slugify('  ---  '), '');
});
