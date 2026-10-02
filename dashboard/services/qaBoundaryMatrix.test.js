const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMatrix } = require('./qaBoundaryMatrix');

test('TC-04: buildMatrix khoang 2 phia [18, 60] kieu number', () => {
  const constraint = {
    field: 'Tuổi',
    kind: 'number',
    unit: 'tuổi',
    min: 18,
    max: 60
  };
  const matrix = buildMatrix(constraint);

  // 3 partitions
  assert.equal(matrix.partitions.length, 3);
  assert.deepEqual(matrix.partitions, [
    { label: '< 18', valid: false },
    { label: '18 … 60', valid: true },
    { label: '> 60', valid: false }
  ]);

  // 7 boundary values: 17, 18, 19, 39 (nominal: 18 + floor(42/2)), 59, 60, 61
  assert.equal(matrix.values.length, 7);
  assert.deepEqual(matrix.values.map(v => v.value), [17, 18, 19, 39, 59, 60, 61]);
  assert.deepEqual(matrix.values.map(v => v.valid), [false, true, true, true, true, true, false]);
  assert.equal(matrix.values.find(v => v.value === 39).label, 'Điểm giữa (nominal)');

  // invalidTypes for number
  assert.deepEqual(matrix.invalidTypes, ['', 'abc', '1.5', ' ']);
});

test('TC-05: buildMatrix 1 phia va dung gia tri (single bound, exact bound, no negative for length)', () => {
  // Cận trên max: 50 kiểu length
  const lengthMax = buildMatrix({
    field: 'Họ tên',
    kind: 'length',
    unit: 'ký tự',
    min: null,
    max: 50
  });
  assert.deepEqual(lengthMax.partitions, [
    { label: '≤ 50', valid: true },
    { label: '> 50', valid: false }
  ]);
  // implicit 0, 49, 50, 51. Không có số âm.
  assert.deepEqual(lengthMax.values.map(v => v.value), [0, 49, 50, 51]);
  assert.deepEqual(lengthMax.values.map(v => v.valid), [true, true, true, false]);
  assert.equal(lengthMax.values[0].implicit, true);

  // Cận dưới min: 8 kiểu length
  const lengthMin = buildMatrix({
    field: 'Mật khẩu',
    kind: 'length',
    unit: 'ký tự',
    min: 8,
    max: null
  });
  assert.deepEqual(lengthMin.partitions, [
    { label: '< 8', valid: false },
    { label: '≥ 8', valid: true }
  ]);
  assert.deepEqual(lengthMin.values.map(v => v.value), [7, 8, 9]);
  assert.deepEqual(lengthMin.values.map(v => v.valid), [false, true, true]);

  // Cận dưới min: 0 kiểu number -> có thể có số âm -1
  const numberZero = buildMatrix({
    field: 'Điểm',
    kind: 'number',
    unit: null,
    min: 0,
    max: null
  });
  assert.deepEqual(numberZero.values.map(v => v.value), [-1, 0, 1]);
  assert.deepEqual(numberZero.values.map(v => v.valid), [false, true, true]);

  // min == max: Đố 10 ký tự
  const exactLength = buildMatrix({
    field: 'Số điện thoại',
    kind: 'length',
    unit: 'chữ số',
    min: 10,
    max: 10
  });
  assert.deepEqual(exactLength.partitions, [
    { label: '≠ 10', valid: false },
    { label: '= 10', valid: true }
  ]);
  assert.deepEqual(exactLength.values.map(v => v.value), [9, 10, 11]);
  assert.deepEqual(exactLength.values.map(v => v.valid), [false, true, false]);
});

test('TC-06: Sinh mau chuoi sample cho length va invalidTypes phu hop', () => {
  const lengthConstraint = {
    field: 'Mật khẩu',
    kind: 'length',
    unit: 'ký tự',
    min: 4,
    max: 8
  };
  const matrix = buildMatrix(lengthConstraint);

  // Kiểm tra sample
  for (const v of matrix.values) {
    assert.equal(typeof v.sample, 'string');
    assert.equal(v.sample.length, v.value);
    assert.match(v.sample, /^x*$/);
  }

  // invalidTypes length có min >= 1 gồm '' và '   '
  assert.deepEqual(matrix.invalidTypes, ['', '   ']);

  // number không có sample
  const numberConstraint = {
    field: 'Tuổi',
    kind: 'number',
    min: 18,
    max: 60
  };
  const numMatrix = buildMatrix(numberConstraint);
  for (const v of numMatrix.values) {
    assert.equal(v.sample, undefined);
  }
});
