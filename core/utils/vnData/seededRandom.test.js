const test = require('node:test');
const assert = require('node:assert/strict');
const { createRng } = require('./seededRandom');

test('TC-01: seededRandom PRNG determinism and boundary coverage', () => {
  const seed1 = 'test-seed-123';
  const rng1a = createRng(seed1);
  const rng1b = createRng(seed1);

  // Cung seed phai ra cung day so
  const seq1 = Array.from({ length: 20 }, () => rng1a.next());
  const seq2 = Array.from({ length: 20 }, () => rng1b.next());
  assert.deepEqual(seq1, seq2, 'Cung seed phai sinh ra day so giong nhau 100%');

  // Khac seed phai ra day so khac nhau
  const rng2 = createRng('different-seed-456');
  const seq3 = Array.from({ length: 20 }, () => rng2.next());
  assert.notDeepEqual(seq1, seq3, 'Khac seed phai sinh ra day so khac nhau');

  // int(min, max) phai sinh du min va max trong 10.000 lan va khong vuot bien
  const min = 5;
  const max = 15;
  const counts = new Set();
  const testRng = createRng('boundary-seed');

  for (let i = 0; i < 10000; i++) {
    const val = testRng.int(min, max);
    assert.ok(val >= min && val <= max, `Gia tri ${val} nam ngoai pham vi [${min}, ${max}]`);
    counts.add(val);
  }

  assert.ok(counts.has(min), `Khong sinh ra gia tri min ${min}`);
  assert.ok(counts.has(max), `Khong sinh ra gia tri max ${max}`);
  assert.equal(counts.size, max - min + 1, 'Phai xuat hien day du cac gia tri nguyen trong khoang');
});
