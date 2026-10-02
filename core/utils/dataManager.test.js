const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listDatasets,
  jsonToCsv,
  csvToJson,
  generateDynamicValue,
  resolveDynamicValues,
  normalizeDatasetName,
  MAX_DATASET_BYTES,
} = require('./dataManager');

test('DataManager lists existing datasets', () => {
  const list = listDatasets();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);
  assert.ok(list.every((d) => d.fileName.endsWith('.json')));
});

test('DataManager converts JSON array to CSV and back', () => {
  const original = [
    { fullName: 'Test User', otp: '1234', active: true },
    { fullName: 'Second User', otp: '5678', active: false },
  ];
  const csv = jsonToCsv(original);
  assert.ok(csv.includes('fullName,otp,active'));
  assert.ok(csv.includes('Test User,1234,true'));

  const parsed = csvToJson(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].fullName, 'Test User');
  assert.equal(parsed[0].otp, 1234);
  assert.equal(parsed[0].active, true);
});

test('DataManager generates dynamic values correctly', () => {
  const phone = generateDynamicValue('{{random_phone}}');
  assert.match(phone, /^098\d{7}$/);

  const email = generateDynamicValue('{{random_email}}');
  assert.match(email, /^autotest_\d+_\d+@example\.com$/);

  const resolved = resolveDynamicValues({
    phone: '{{random_phone}}',
    user: '{{random_name}}',
    nested: { email: '{{random_email}}' },
  });

  assert.notEqual(resolved.phone, '{{random_phone}}');
  assert.notEqual(resolved.nested.email, '{{random_email}}');
});

test('DataManager rejects malformed CSV and oversized input', () => {
  assert.throws(() => csvToJson('name,value\n"broken,value'), /chưa đóng/);
  assert.throws(() => csvToJson(`name\n${'x'.repeat(MAX_DATASET_BYTES)}`), /1 MB/);
  assert.throws(() => normalizeDatasetName('../outside.json'), /không hợp lệ/);
});

test('TC-11: resolveDynamicValues replaces 5 vn_* placeholders and preserves unknowns', () => {
  const input = {
    user: {
      cccd: '{{vn_cccd}}',
      mst: '{{vn_mst}}',
      phone: '{{vn_phone}}',
      name: '{{vn_name}}',
      email: '{{vn_email}}'
    },
    list: [
      '{{vn_cccd}}',
      '{{vn_unknown}}',
      '{{random_phone}}'
    ]
  };

  const output = resolveDynamicValues(input);
  assert.match(output.user.cccd, /^\d{12}$/, 'cccd phai la 12 chu so');
  assert.match(output.user.mst, /^\d{10}(-\d{3})?$/, 'mst phai hop le 10 hoac 13 so');
  assert.match(output.user.phone, /^0\d{9}$/, 'phone phai la 10 chu so bat dau bang 0');
  assert.notEqual(output.user.name, '{{vn_name}}', 'name phai duoc thay the');
  assert.match(output.user.email, /@example\.com$/, 'email phai co duoi @example.com');

  assert.match(output.list[0], /^\d{12}$/);
  assert.equal(output.list[1], '{{vn_unknown}}', 'Placeholder la khong doi');
  assert.match(output.list[2], /^098\d{7}$/, 'random_phone van hoat dong nhu cu');
});

