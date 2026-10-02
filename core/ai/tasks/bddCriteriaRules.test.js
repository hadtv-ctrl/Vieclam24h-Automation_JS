const test = require('node:test');
const assert = require('node:assert/strict');
const { extractAcBlocks, validateScenarios, renderBddMarkdown } = require('./bddCriteriaRules');

test('TC-16: extractAcBlocks boc tach cac dinh dang AC va ghi nhan warning near-miss', () => {
  const sample = `
# Tài liệu đặc tả yêu cầu

### AC-001 - Đăng nhập với mật khẩu đúng
Người dùng nhập đúng thông tin.

### AC-002: Đăng nhập sai quá 5 lần
Tài khoản bị khoá tạm thời.

AC-003: Đổi mật khẩu thành công
Gửi email thông báo.

**AC-004** Quên mật khẩu
Gửi link đặt lại mật khẩu.

### AC-8: Tiêu chí viết sai quy cách
Mã này thiếu số 0.

### AC_012 - Dấu gạch dưới
Mã này dùng gạch dưới.

ac-001 chữ thường
Mã này viết thường.
`;

  const { acs, warnings } = extractAcBlocks(sample);

  // Chỉ nhận diện 4 AC hợp lệ: AC-001, AC-002, AC-003, AC-004
  assert.equal(acs.length, 4);
  assert.deepEqual(acs.map(a => a.id), ['AC-001', 'AC-002', 'AC-003', 'AC-004']);
  assert.equal(acs[0].title, 'Đăng nhập với mật khẩu đúng');
  assert.equal(acs[1].title, 'Đăng nhập sai quá 5 lần');
  assert.equal(acs[2].title, 'Đổi mật khẩu thành công');
  assert.equal(acs[3].title, 'Quên mật khẩu');

  // Warnings chứa mã gần đúng: AC-8, AC_012, ac-001
  assert.ok(warnings.length >= 3);
  assert.ok(warnings.some(w => w.includes('AC-8')));
  assert.ok(warnings.some(w => w.includes('AC_012')));
  assert.ok(warnings.some(w => w.includes('ac-001')));
});

test('TC-15: validateScenarios bat loi thieu/thua/lap, kiem dinh buoc va tach proposals', () => {
  const inputAcs = [
    { id: 'AC-001', title: 'Đăng nhập thành công' },
    { id: 'AC-002', title: 'Đăng nhập sai mật khẩu' }
  ];

  // 1. Dữ liệu hợp lệ, tự bỏ từ khoá đầu bước, tự điền title từ input
  const validData = {
    scenarios: [
      {
        acId: 'AC-001',
        title: '',
        given: ['Given người dùng ở trang đăng nhập', 'Và đã có tài khoản'],
        when: ['Khi nhập đúng email và password', 'And nhấn nút Đăng nhập'],
        then: ['Thì chuyển hướng vào trang chủ', 'Và hiển thị thông báo chào mừng']
      },
      {
        acId: 'AC-002',
        title: 'Đăng nhập sai thông tin',
        given: ['Cho người dùng ở trang đăng nhập'],
        when: ['Biết người dùng nhập sai mật khẩu'],
        then: ['Nhưng hệ thống báo lỗi thông tin không chính xác']
      },
      {
        acId: null,
        title: 'Đăng nhập khi mất kết nối mạng',
        given: ['Người dùng mất mạng internet'],
        when: ['Bấm đăng nhập'],
        then: ['Hiển thị cảnh báo mất kết nối']
      }
    ],
    openQuestions: ['Có giới hạn số lần thử trong 1 phút không?']
  };

  const res1 = validateScenarios(validData, inputAcs);
  assert.equal(res1.ok, true);
  assert.equal(res1.scenarios.length, 2);
  assert.equal(res1.proposals.length, 1);
  assert.equal(res1.openQuestions.length, 1);

  // Kiểm tra title được bù từ inputAcs khi rỗng
  assert.equal(res1.scenarios[0].title, 'Đăng nhập thành công');
  // Kiểm tra các bước đã bị bóc từ khoá
  assert.equal(res1.scenarios[0].given[0], 'người dùng ở trang đăng nhập');
  assert.equal(res1.scenarios[0].given[1], 'đã có tài khoản');
  assert.equal(res1.scenarios[0].when[0], 'nhập đúng email và password');
  assert.equal(res1.scenarios[0].then[0], 'chuyển hướng vào trang chủ');
  assert.equal(res1.scenarios[1].then[0], 'hệ thống báo lỗi thông tin không chính xác');

  // 2. acId lạ không có trong input -> BDD_UNKNOWN_AC
  const unknownAcData = {
    scenarios: [
      { acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] },
      { acId: 'AC-999', title: 'T2', given: ['G'], when: ['W'], then: ['T'] }
    ]
  };
  const resUnknown = validateScenarios(unknownAcData, inputAcs);
  assert.equal(resUnknown.ok, false);
  assert.equal(resUnknown.code, 'BDD_UNKNOWN_AC');

  // 3. Thiếu mã AC đầu vào (thiếu AC-002) -> BDD_MISSING_AC
  const missingAcData = {
    scenarios: [
      { acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] }
    ]
  };
  const resMissing = validateScenarios(missingAcData, inputAcs);
  assert.equal(resMissing.ok, false);
  assert.equal(resMissing.code, 'BDD_MISSING_AC');
  assert.deepEqual(resMissing.details, ['AC-002']);

  // 4. Lặp mã AC đầu vào -> BDD_MISSING_AC
  const dupAcData = {
    scenarios: [
      { acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] },
      { acId: 'AC-001', title: 'T1 dup', given: ['G'], when: ['W'], then: ['T'] },
      { acId: 'AC-002', title: 'T2', given: ['G'], when: ['W'], then: ['T'] }
    ]
  };
  const resDup = validateScenarios(dupAcData, inputAcs);
  assert.equal(resDup.ok, false);
  assert.equal(resDup.code, 'BDD_MISSING_AC');

  // 5. Bước quá 300 ký tự -> BDD_INVALID
  const longStepData = {
    scenarios: [
      { acId: 'AC-001', title: 'T1', given: ['a'.repeat(301)], when: ['W'], then: ['T'] },
      { acId: 'AC-002', title: 'T2', given: ['G'], when: ['W'], then: ['T'] }
    ]
  };
  const resLong = validateScenarios(longStepData, inputAcs);
  assert.equal(resLong.ok, false);
  assert.equal(resLong.code, 'BDD_INVALID');

  // 6. Số lượng scenario = 0 hoặc > 30 -> BDD_INVALID
  assert.equal(validateScenarios({ scenarios: [] }, inputAcs).ok, false);
  const tooMany = Array.from({ length: 31 }, (_, i) => ({ acId: null, title: `P${i}`, given: ['G'], when: ['W'], then: ['T'] }));
  assert.equal(validateScenarios({ scenarios: tooMany }, []).ok, false);
});

test('TC-17: renderBddMarkdown xuat dung dinh dang Gherkin markdown', () => {
  const scenarios = [
    {
      acId: 'AC-001',
      title: 'Nộp hồ sơ thiếu số điện thoại',
      given: ['ứng viên đang ở màn hình Nộp hồ sơ'],
      when: ['ứng viên để trống "Số điện thoại" và bấm "Nộp hồ sơ"'],
      then: ['hệ thống hiển thị lỗi "Số điện thoại không được để trống"', 'hồ sơ không được gửi']
    },
    {
      acId: 'AC-002',
      title: 'Nộp hồ sơ thành công',
      given: ['ứng viên đã điền đủ thông tin'],
      when: ['bấm "Nộp hồ sơ"'],
      then: ['hệ thống gửi email xác nhận']
    }
  ];

  const proposals = [
    {
      acId: null,
      title: 'Nộp hồ sơ khi mất mạng',
      given: ['mạng internet bị ngắt'],
      when: ['ứng viên bấm "Nộp hồ sơ"'],
      then: ['hệ thống lưu bản nháp cục bộ']
    }
  ];

  const md = renderBddMarkdown({ scenarios, proposals });

  assert.ok(md.includes('### AC-001: Nộp hồ sơ thiếu số điện thoại'));
  assert.ok(md.includes('**Given** ứng viên đang ở màn hình Nộp hồ sơ'));
  assert.ok(md.includes('**When** ứng viên để trống "Số điện thoại" và bấm "Nộp hồ sơ"'));
  assert.ok(md.includes('**Then** hệ thống hiển thị lỗi "Số điện thoại không được để trống"'));
  assert.ok(md.includes('**And** hồ sơ không được gửi'));

  assert.ok(md.includes('### AC-002: Nộp hồ sơ thành công'));
  assert.ok(md.includes('#### Đề xuất AC mới (gán mã AC-xxx trước khi dán vào tài liệu)'));
  assert.ok(md.includes('- Nộp hồ sơ khi mất mạng'));
  assert.ok(md.includes('  - **Given** mạng internet bị ngắt'));
});
