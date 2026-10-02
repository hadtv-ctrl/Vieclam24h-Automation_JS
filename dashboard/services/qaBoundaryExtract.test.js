const test = require('node:test');
const assert = require('node:assert/strict');
const { extractConstraints } = require('./qaBoundaryExtract');

test('TC-01: Corpus duong tinh Phu luc A (34 cau)', () => {
  const corpusA = [
    { id: 1, text: 'Độ tuổi tham gia từ 18 đến 60 tuổi.', field: 'Độ tuổi tham gia', kind: 'number', unit: 'tuổi', min: 18, max: 60, needsReview: false },
    { id: 2, text: 'Mật khẩu dài từ 8 đến 32 ký tự.', field: 'Mật khẩu', kind: 'length', unit: 'ký tự', min: 8, max: 32, needsReview: false },
    { id: 3, text: 'Mật khẩu có độ dài từ 8 đến 32 ký tự.', field: 'Mật khẩu', kind: 'length', unit: 'ký tự', min: 8, max: 32, needsReview: false },
    { id: 4, text: 'Tên đăng nhập từ 6 tới 20 ký tự.', field: 'Tên đăng nhập', kind: 'length', unit: 'ký tự', min: 6, max: 20, needsReview: false },
    { id: 5, text: 'Mã giảm giá dài 6-12 ký tự.', field: 'Mã giảm giá', kind: 'length', unit: 'ký tự', min: 6, max: 12, needsReview: false },
    { id: 6, text: 'Điểm thi từ 0 đến 10.', field: 'Điểm thi', kind: 'number', unit: null, min: 0, max: 10, needsReview: false },
    { id: 7, text: 'Password must be between 8 and 64 characters.', field: 'Password', kind: 'length', unit: 'characters', min: 8, max: 64, needsReview: false },
    { id: 8, text: 'Họ tên tối đa 50 ký tự.', field: 'Họ tên', kind: 'length', unit: 'ký tự', min: null, max: 50, needsReview: false },
    { id: 9, text: 'Mô tả không vượt quá 1.000 ký tự.', field: 'Mô tả', kind: 'length', unit: 'ký tự', min: null, max: 1000, needsReview: false },
    { id: 10, text: 'Số lượng ảnh tải lên không quá 10 ảnh.', field: 'Số lượng ảnh tải lên', kind: 'number', unit: 'ảnh', min: null, max: 10, needsReview: false },
    { id: 11, text: 'Khu vực đào tạo cho phép chọn tối đa 10 mục.', field: 'Khu vực đào tạo', kind: 'number', unit: 'mục', min: null, max: 10, needsReview: false },
    { id: 12, text: 'Số lần nhập sai OTP tối đa 5 lần.', field: 'Số lần nhập sai OTP', kind: 'number', unit: 'lần', min: null, max: 5, needsReview: false },
    { id: 13, text: 'Ghi chú không được dài hơn 255 ký tự.', field: 'Ghi chú', kind: 'length', unit: 'ký tự', min: null, max: 255, needsReview: false },
    { id: 14, text: 'Số file đính kèm không nhiều hơn 5 file.', field: 'Số file đính kèm', kind: 'number', unit: 'file', min: null, max: 5, needsReview: false },
    { id: 15, text: 'Tiêu đề: tối đa 120 ký tự.', field: 'Tiêu đề', kind: 'length', unit: 'ký tự', min: null, max: 120, needsReview: false },
    { id: 16, text: 'Số lượng khách tối đa: 20.', field: 'Số lượng khách', kind: 'number', unit: null, min: null, max: 20, needsReview: false },
    { id: 17, text: 'Bio must be at most 160 characters.', field: 'Bio', kind: 'length', unit: 'characters', min: null, max: 160, needsReview: false },
    { id: 18, text: 'Mật khẩu tối thiểu 8 ký tự.', field: 'Mật khẩu', kind: 'length', unit: 'ký tự', min: 8, max: null, needsReview: false },
    { id: 19, text: 'Số người tham gia ít nhất 2 người.', field: 'Số người tham gia', kind: 'number', unit: 'người', min: 2, max: null, needsReview: false },
    { id: 20, text: 'Username must be at least 3 characters.', field: 'Username', kind: 'length', unit: 'characters', min: 3, max: null, needsReview: false },
    { id: 21, text: 'Tuổi từ 18 tuổi trở lên.', field: 'Tuổi', kind: 'number', unit: 'tuổi', min: 18, max: null, needsReview: false },
    { id: 22, text: 'Trẻ em từ 12 tuổi trở xuống được miễn phí.', field: 'Trẻ em', kind: 'number', unit: 'tuổi', min: null, max: 12, needsReview: false },
    { id: 23, text: 'Tuổi phải lớn hơn 18.', field: 'Tuổi', kind: 'number', unit: null, min: 19, max: null, needsReview: false },
    { id: 24, text: 'Số lượng đặt hàng phải nhỏ hơn 100.', field: 'Số lượng đặt hàng', kind: 'number', unit: null, min: null, max: 99, needsReview: false },
    { id: 25, text: 'Quantity must be greater than 0.', field: 'Quantity', kind: 'number', unit: null, min: 1, max: null, needsReview: false },
    { id: 26, text: 'Age must be less than 100.', field: 'Age', kind: 'number', unit: null, min: null, max: 99, needsReview: false },
    { id: 27, text: 'Số điện thoại gồm đúng 10 chữ số.', field: 'Số điện thoại', kind: 'length', unit: 'chữ số', min: 10, max: 10, needsReview: false },
    { id: 28, text: '- Mã OTP gồm 6 chữ số.', field: 'Mã OTP', kind: 'length', unit: 'chữ số', min: 6, max: 6, needsReview: false },
    { id: 29, text: 'Mật khẩu tối thiểu 8 ký tự và tối đa 32 ký tự.', field: 'Mật khẩu', kind: 'length', unit: 'ký tự', min: 8, max: 32, needsReview: false },
    { id: 30, text: 'Số tiền nạp tối thiểu 10000 và tối đa 5000000.', field: 'Số tiền nạp', kind: 'number', unit: null, min: 10000, max: 5000000, needsReview: false },
    { id: 31, text: 'Số lượng sản phẩm trong giỏ >= 1 và <= 99.', field: 'Số lượng sản phẩm trong giỏ', kind: 'number', unit: null, min: 1, max: 99, needsReview: false },
    { id: 32, text: 'Tuổi từ 18 đến 60, mật khẩu từ 8 đến 32 ký tự.', multi: [
      { field: 'Tuổi', kind: 'number', unit: null, min: 18, max: 60, needsReview: false },
      { field: 'Mật khẩu', kind: 'length', unit: 'ký tự', min: 8, max: 32, needsReview: false }
    ]},
    { id: 33, text: 'Thời gian chờ trên 30 giây sẽ báo lỗi.', field: 'Thời gian chờ', kind: 'number', unit: 'giây', min: 31, max: null, needsReview: true },
    { id: 34, text: 'Độ ẩm trong khoảng 40 đến 80.', field: 'Độ ẩm', kind: 'number', unit: null, min: 40, max: 80, needsReview: false }
  ];

  for (const item of corpusA) {
    const res = extractConstraints(item.text);
    if (item.multi) {
      assert.equal(res.constraints.length, item.multi.length, `Sentence #${item.id} should yield ${item.multi.length} constraints`);
      for (let idx = 0; idx < item.multi.length; idx++) {
        const exp = item.multi[idx];
        const act = res.constraints[idx];
        assert.equal(act.field, exp.field, `#${item.id}[${idx}] field`);
        assert.equal(act.kind, exp.kind, `#${item.id}[${idx}] kind`);
        assert.equal(act.unit, exp.unit, `#${item.id}[${idx}] unit`);
        assert.equal(act.min, exp.min, `#${item.id}[${idx}] min`);
        assert.equal(act.max, exp.max, `#${item.id}[${idx}] max`);
        assert.equal(act.needsReview, exp.needsReview, `#${item.id}[${idx}] needsReview`);
      }
    } else {
      assert.equal(res.constraints.length, 1, `Sentence #${item.id} should yield 1 constraint`);
      const act = res.constraints[0];
      assert.equal(act.field, item.field, `#${item.id} field`);
      assert.equal(act.kind, item.kind, `#${item.id} kind`);
      assert.equal(act.unit, item.unit, `#${item.id} unit`);
      assert.equal(act.min, item.min, `#${item.id} min`);
      assert.equal(act.max, item.max, `#${item.id} max`);
      assert.equal(act.needsReview, item.needsReview, `#${item.id} needsReview`);
    }
  }
});

test('TC-02: Corpus am tinh Phu luc B (10 cau)', () => {
  const corpusB = [
    { id: 1, text: 'Báo cáo xuất vào ngày 15 hằng tháng.', expectUnrec: true },
    { id: 2, text: 'Áp dụng từ tháng 1 đến tháng 3.', expectUnrec: true },
    { id: 3, text: 'Ngày hiệu lực từ 01/01/2026 đến 31/12/2026.', expectUnrec: true },
    { id: 4, text: 'Giờ làm việc từ 8:00 đến 17:30.', expectUnrec: true },
    { id: 5, text: 'Cân nặng từ 0,5 đến 2,5 kg.', expectUnrec: true },
    { id: 6, text: 'Giá từ 1 triệu đến 5 triệu.', expectUnrec: true },
    { id: 7, text: 'Chọn đến mục thứ 11 sẽ bị hệ thống chặn.', expectUnrec: true },
    { id: 8, text: 'API v2 trả về mã 200 khi thành công.', expectUnrec: true },
    { id: 9, text: 'Hệ thống phản hồi nhanh.', expectUnrec: false },
    { id: 10, text: 'Hỗ trợ tối đa người dùng đồng thời.', expectUnrec: false }
  ];

  for (const item of corpusB) {
    const res = extractConstraints(item.text);
    assert.equal(res.constraints.length, 0, `Negative #${item.id} must yield 0 constraints`);
    const hasUnrec = res.unrecognized.length > 0;
    assert.equal(hasUnrec, item.expectUnrec, `Negative #${item.id} unrecognized state`);
  }
});

test('TC-03: Da dong, so dong nguon, chuan hoa NFC/NFD va ky hieu', () => {
  const multiline = `
Tiêu đề không có chữ số.
Mật khẩu dài từ 8 đến 32 ký tự.
Thời gian làm việc từ 8:00 đến 17:00.
Số lượng sản phẩm trong giỏ >= 1 và <= 99.
Mô tả không vượt quá 1.000 ký tự.
`;
  const res = extractConstraints(multiline);
  assert.equal(res.constraints.length, 3);
  assert.equal(res.constraints[0].source.line, 3); // Dòng 3
  assert.equal(res.constraints[1].source.line, 5); // Dòng 5
  assert.equal(res.constraints[2].source.line, 6); // Dòng 6
  assert.equal(res.constraints[2].max, 1000); // 1.000 -> 1000

  // Unrecognized lines
  assert.equal(res.unrecognized.length, 1);
  assert.equal(res.unrecognized[0].line, 4);

  // Parity between NFC and NFD
  const nfcText = 'Tuổi từ 18 đến 60 tuổi.'.normalize('NFC');
  const nfdText = 'Tuổi từ 18 đến 60 tuổi.'.normalize('NFD');
  const resNfc = extractConstraints(nfcText);
  const resNfd = extractConstraints(nfdText);
  assert.deepEqual(resNfc.constraints[0].field, resNfd.constraints[0].field);
  assert.deepEqual(resNfc.constraints[0].min, resNfd.constraints[0].min);
  assert.deepEqual(resNfc.constraints[0].max, resNfd.constraints[0].max);

  // Symbols ≥ ≤ – —
  const symText = 'Số lượng sản phẩm ≥ 5 và ≤ 50.';
  const resSym = extractConstraints(symText);
  assert.equal(resSym.constraints.length, 1);
  assert.equal(resSym.constraints[0].min, 5);
  assert.equal(resSym.constraints[0].max, 50);
});
