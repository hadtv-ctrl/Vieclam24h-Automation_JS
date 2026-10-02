const test = require('node:test');
const assert = require('node:assert/strict');
const { createRng } = require('./seededRandom');
const { generateFullName, toAscii } = require('./vnNames');

test('TC-07: Ho ten chuan NFC, phan biet gioi tinh, toAscii chuyen Đ thanh D', () => {
  const rng = createRng('name-test-seed');

  // Kiểm tra chuẩn NFC
  for (let i = 0; i < 100; i++) {
    const { fullName } = generateFullName(rng);
    assert.equal(fullName, fullName.normalize('NFC'), 'Ho ten phai o dang NFC');
  }

  // Kiểm tra diacritics: false chỉ còn ASCII A-Z và khoảng trắng
  for (let i = 0; i < 100; i++) {
    const { fullName } = generateFullName(rng, { diacritics: false });
    assert.match(fullName, /^[a-zA-Z ]+$/, `Ten khong dau '${fullName}' phai chi chua chu cai ASCII va space`);
  }

  // Kiểm tra toAscii chuyển Đ và đ thành D và d
  assert.equal(toAscii('Đỗ Đình Đồng'), 'Do Dinh Dong');
  assert.equal(toAscii('đặng đại đoàn'), 'dang dai doan');
  assert.equal(toAscii('Nguyễn Thị Mai Phương'), 'Nguyen Thi Mai Phuong');

  // Lỗi giới tính lạ
  assert.throws(
    () => generateFullName(rng, { gender: 'alien' }),
    (err) => err.field === 'gender'
  );
});
