const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  extractAcs,
  extractDecidedQuestions,
  getNextTcId,
  inferWithHeuristic,
  appendTestCasesToDocument,
} = require('./qaInferenceService');

const sampleReq = `# REQ-001: Đăng ký tài khoản ứng viên

## Acceptance criteria

### AC-001: Đăng ký hợp lệ
Ứng viên đăng ký tài khoản thành công với email và mật khẩu hợp lệ.

### AC-002: Kiểm tra mật khẩu
Mật khẩu phải đáp ứng độ dài và độ phức tạp.

## Open questions

1. Độ dài và độ phức tạp mật khẩu là bao nhiêu? — cần PO xác nhận **Đã chốt (PO Minh, 2026-03-21):** Mật khẩu từ 8 đến 32 ký tự, bắt buộc có ít nhất 1 chữ cái và 1 chữ số.
2. Có bắt buộc nhập số điện thoại khi đăng ký bằng email không? — cần PO xác nhận **Đã chốt (PO Minh, 2026-03-21):** Không bắt buộc số điện thoại khi đăng ký bằng email.
3. Câu hỏi chưa chốt thì sao? — cần QA Lead xác nhận
`;

console.log('--- Test 1: extractAcs ---');
const acs = extractAcs(sampleReq);
assert.strictEqual(acs.length, 2, 'Phải trích xuất được 2 AC');
assert.strictEqual(acs[0].id, 'AC-001');
assert.strictEqual(acs[1].id, 'AC-002');
console.log('✓ extractAcs passed:', acs.map((a) => a.id));

console.log('--- Test 2: extractDecidedQuestions ---');
const decided = extractDecidedQuestions(sampleReq);
assert.strictEqual(decided.length, 2, 'Phải trích xuất được đúng 2 câu hỏi đã chốt');
assert.strictEqual(decided[0].id, 'Q-1');
assert.ok(decided[0].decision.includes('8 đến 32 ký tự'));
assert.strictEqual(decided[1].id, 'Q-2');
assert.ok(decided[1].decision.includes('Không bắt buộc'));
console.log('✓ extractDecidedQuestions passed:', decided.map((d) => `${d.id}: ${d.decision.slice(0, 30)}...`));

console.log('--- Test 3: getNextTcId ---');
const next1 = getNextTcId(['TC-001', 'TC-002', 'TC-005']);
assert.strictEqual(next1, 'TC-006', 'Mã kế tiếp của max TC-005 phải là TC-006');
console.log('✓ getNextTcId passed:', next1);

console.log('--- Test 4: inferWithHeuristic ---');
const inferred = inferWithHeuristic({
  reqId: 'REQ-001',
  decidedQuestions: decided,
  existingTcIds: ['TC-001', 'TC-002'],
  existingTcTitles: ['TC-001: Đăng ký thành công', 'TC-002: Đăng ký thất bại khi email sai'],
  acs,
});
assert.ok(inferred.length >= 4, `Phải sinh ra ít nhất 4 test cases (thực tế: ${inferred.length})`);
console.log('Inferred test cases:');
inferred.forEach((tc) => {
  console.log(`  - [${tc.suggestedId}] (${tc.acId}, ${tc.priority}) ${tc.title}`);
});

// Check boundary below (7 chars)
const below7 = inferred.find((tc) => tc.title.includes('7 ký tự'));
assert.ok(below7, 'Phải có test case kiểm tra biên dưới 7 ký tự');
assert.strictEqual(below7.priority, 'P1');

// Check boundary above (33 chars)
const above33 = inferred.find((tc) => tc.title.includes('33 ký tự'));
assert.ok(above33, 'Phải có test case kiểm tra biên trên 33 ký tự');

// Check missing number / letter
const missingNum = inferred.find((tc) => tc.title.includes('thiếu chữ số') || tc.title.includes('chỉ chứa chữ cái'));
assert.ok(missingNum, 'Phải có test case kiểm tra thiếu số');

// Check optional field
const optPhone = inferred.find((tc) => tc.title.includes('bỏ trống số điện thoại'));
assert.ok(optPhone, 'Phải có test case kiểm tra bỏ trống số điện thoại');

console.log('✓ inferWithHeuristic passed all scenario validations!');

console.log('--- Test 5: appendTestCasesToDocument ---');
const tmpDir = path.join(__dirname, '../../.tmp/test-inference');
fs.mkdirSync(path.join(tmpDir, 'test-cases'), { recursive: true });
const tmpTcFile = path.join(tmpDir, 'test-cases/REQ-001.md');
fs.writeFileSync(tmpTcFile, `# Test Cases: REQ-001

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-001 | AC-001 | Đăng ký thành công | P0 | yes | tests/auth/reg.spec.js |
| TC-002 | AC-001 | Email không hợp lệ | P1 | yes | tests/auth/reg.spec.js |

## Test cases

### TC-001 — Đăng ký thành công
- Preconditions: Trang chủ
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang | Trang mở |
`, 'utf8');

const appendResult = appendTestCasesToDocument(tmpDir, {
  reqId: 'REQ-001',
  tcPath: 'test-cases/REQ-001.md',
  testCases: [below7, optPhone],
});

assert.strictEqual(appendResult.addedCount, 2);
const updatedContent = fs.readFileSync(tmpTcFile, 'utf8');
assert.ok(updatedContent.includes(below7.suggestedId));
assert.ok(updatedContent.includes(optPhone.suggestedId));
assert.ok(updatedContent.includes('### ' + below7.suggestedId));
assert.ok(updatedContent.includes('### ' + optPhone.suggestedId));
console.log('✓ appendTestCasesToDocument passed!');

// Dọn dẹp tmp
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('\n=== TẤT CẢ UNIT TESTS CỦA QA INFERENCE SERVICE ĐÃ PASS 100%! ===\n');
