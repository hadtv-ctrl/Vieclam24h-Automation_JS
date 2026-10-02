const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateRecords, resolveVnPlaceholder, VnDataError } = require('./index');

test('TC-08: Persona nhat quan CCCD/gioi tinh/nam sinh/email va khong trung lap 500 ban ghi', () => {
  const result = generateRecords({
    type: 'persona',
    count: 500,
    seed: 'persona-500-test'
  });

  assert.equal(result.records.length, 500, 'Phai sinh du 500 ban ghi persona');
  const seenCccd = new Set();
  const seenPhone = new Set();
  const seenEmail = new Set();

  for (const p of result.records) {
    assert.match(p.cccd, /^\d{12}$/);
    assert.match(p.phone, /^0\d{9}$/);
    assert.match(p.email, /^[a-z0-9.]+@example\.com$/);
    assert.match(p.birthDate, /^\d{4}-\d{2}-\d{2}$/);

    const yearFromDate = p.birthDate.slice(0, 4);
    const yyFromDate = yearFromDate.slice(-2);
    const yyFromCccd = p.cccd.slice(4, 6);
    assert.equal(yyFromDate, yyFromCccd, 'Nam sinh tren birthDate va CCCD phai khop nhau');

    const centuryCode = Number(p.cccd[3]);
    const numYear = Number(yearFromDate);
    if (numYear >= 1900 && numYear <= 1999) {
      assert.equal(centuryCode, p.gender === 'male' ? 0 : 1);
    } else if (numYear >= 2000 && numYear <= 2099) {
      assert.equal(centuryCode, p.gender === 'male' ? 2 : 3);
    }

    seenCccd.add(p.cccd);
    seenPhone.add(p.phone);
    seenEmail.add(p.email);
  }

  assert.equal(seenCccd.size, 500, '500 CCCD phai duy nhat');
  assert.equal(seenPhone.size, 500, '500 SDT phai duy nhat');
  assert.equal(seenEmail.size, 500, '500 email phai duy nhat');
});

test('TC-09: BVA tham so count, type, va cac truong hop seed dac biet', () => {
  // Biên count hợp lệ: 1 và 500
  const r1 = generateRecords({ type: 'cccd', count: 1, seed: 'bva-1' });
  assert.equal(r1.records.length, 1);
  const r500 = generateRecords({ type: 'cccd', count: 500, seed: 'bva-500' });
  assert.equal(r500.records.length, 500);

  // Biên count không hợp lệ: 0, 501, 1.5, "abc", null
  const invalidCounts = [0, 501, 1.5, '10.5', null, -5];
  for (const c of invalidCounts) {
    assert.throws(
      () => generateRecords({ type: 'cccd', count: c }),
      (err) => err instanceof VnDataError && err.field === 'count'
    );
  }

  // Type không hợp lệ
  assert.throws(
    () => generateRecords({ type: 'alien_type', count: 5 }),
    (err) => err instanceof VnDataError && err.field === 'type'
  );

  // Cùng seed phải ra records giống hệt
  const runA = generateRecords({ type: 'phone', count: 20, seed: 'ident-seed' });
  const runB = generateRecords({ type: 'phone', count: 20, seed: 'ident-seed' });
  assert.deepEqual(runA.records, runB.records, 'Cung seed phai ra records giong het 100%');

  // Seed rỗng -> lỗi
  assert.throws(
    () => generateRecords({ type: 'phone', count: 5, seed: '' }),
    (err) => err.field === 'seed'
  );

  // Seed Unicode "Café" -> hành vi xác định
  const runU1 = generateRecords({ type: 'name', count: 5, seed: 'Café' });
  const runU2 = generateRecords({ type: 'name', count: 5, seed: 'Café' });
  assert.deepEqual(runU1.records, runU2.records, 'Seed Unicode phai xac dinh');

  // Seed 1000 ký tự -> hành vi xác định
  const longSeed = 'X'.repeat(1000);
  const runL1 = generateRecords({ type: 'mst', count: 5, seed: longSeed });
  const runL2 = generateRecords({ type: 'mst', count: 5, seed: longSeed });
  assert.deepEqual(runL1.records, runL2.records, 'Seed dai 1000 ky tu phai xac dinh');
});

test('TC-13: INV-1 kiem tra tinh khong import core/ai hoac /api/ai', () => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.ok(!/require\s*\(\s*['"][^'"]*core\/ai/i.test(content), `${file} khong duoc require core/ai`);
    assert.ok(!/from\s*['"][^'"]*core\/ai/i.test(content), `${file} khong duoc import core/ai`);
    assert.ok(!/\/api\/ai/i.test(content), `${file} khong duoc goi endpoint /api/ai`);
  }
});
