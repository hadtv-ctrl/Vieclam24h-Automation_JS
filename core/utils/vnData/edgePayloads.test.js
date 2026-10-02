const test = require('node:test');
const assert = require('node:assert/strict');
const { listPayloads, PAYLOAD_CATEGORIES } = require('./edgePayloads');

test('TC-10: 6 nhom payload bien day du, do dai length dung nguong, Unicode NFC va NFD', () => {
  const allPayloads = listPayloads();
  assert.ok(Array.isArray(allPayloads), 'Phai tra ve danh sach mang');

  // Kiem tra 6 nhom
  const categories = new Set(allPayloads.map((p) => p.category));
  assert.equal(categories.size, 6, 'Phai co du 6 nhom payload');
  for (const cat of ['xss', 'sqli', 'unicode', 'whitespace', 'length', 'csv-formula']) {
    assert.ok(categories.has(cat), `Thieu nhom ${cat}`);
  }

  // Kiem tra nhom length
  const p255 = allPayloads.find((p) => p.id === 'length-255');
  const p256 = allPayloads.find((p) => p.id === 'length-256');
  const p1024 = allPayloads.find((p) => p.id === 'length-1024');

  assert.ok(p255 && p255.value.length === 255, 'length-255 phai dai dung 255 ky tu');
  assert.ok(p256 && p256.value.length === 256, 'length-256 phai dai dung 256 ky tu');
  assert.ok(p1024 && p1024.value.length === 1024, 'length-1024 phai dai dung 1024 ky tu');

  // Kiem tra NFC vs NFD
  const nfc = allPayloads.find((p) => p.id === 'unicode-01');
  const nfd = allPayloads.find((p) => p.id === 'unicode-02');
  assert.ok(nfc && nfd, 'Phai co payload unicode-01 va unicode-02');
  assert.notEqual(Buffer.byteLength(nfc.value), Buffer.byteLength(nfd.value), 'NFC va NFD phai khac so bytes');
  assert.equal(nfc.value.normalize('NFC'), nfd.value.normalize('NFC'), 'NFC va NFD phai bang nhau sau khi normalize NFC');

  // Kiem tra loc theo category
  const xssOnly = listPayloads('xss');
  assert.ok(xssOnly.every((p) => p.category === 'xss'), 'Chi chua cac payload thuoc nhom xss');

  assert.throws(
    () => listPayloads('invalid_category'),
    (err) => err.field === 'category'
  );
});
