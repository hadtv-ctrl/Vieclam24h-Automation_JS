const test = require('node:test');
const assert = require('node:assert/strict');
const { createRng } = require('./seededRandom');
const { generateCccd, generateMst, generatePhone } = require('./vnIdentity');

// Danh sach 63 ma tinh viet tay doc lap (Phu luc A)
const ORACLE_PROVINCES = new Set([
  '001', '002', '004', '006', '008', '010', '011', '012', '014', '015',
  '017', '019', '020', '022', '024', '025', '026', '027', '030', '031',
  '033', '034', '035', '036', '037', '038', '040', '042', '044', '045',
  '046', '048', '049', '051', '052', '054', '056', '058', '060', '062',
  '064', '066', '067', '068', '070', '072', '074', '075', '077', '079',
  '080', '082', '083', '084', '086', '087', '089', '091', '092', '093',
  '094', '095', '096'
]);

// Oracle checksum MST 10 so viet tay doc lap
function oracleVerifyMst(mst) {
  if (typeof mst !== 'string' || !/^\d{10}$/.test(mst)) return false;
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  const digits = mst.split('').map(Number);
  let s = 0;
  for (let i = 0; i < 9; i++) {
    s += digits[i] * weights[i];
  }
  const rem = s % 11;
  if (rem === 0) return false;
  return digits[9] === (10 - rem);
}

// Dau so nha mang viet tay doc lap (Phu luc B)
const ORACLE_PREFIXES = {
  viettel: new Set(['032', '033', '034', '035', '036', '037', '038', '039', '086', '096', '097', '098']),
  vinaphone: new Set(['081', '082', '083', '084', '085', '088', '091', '094']),
  mobifone: new Set(['070', '076', '077', '078', '079', '089', '090', '093'])
};

test('TC-02: 1.000 CCCD seed co dinh dung 12 chu so, ma tinh va the ky/gioi tinh', () => {
  const rng = createRng('fixed-cccd-seed-999');
  const seen = new Set();

  for (let i = 0; i < 1000; i++) {
    const { cccd, provinceCode, birthYear, gender } = generateCccd(rng);
    assert.match(cccd, /^\d{12}$/, 'CCCD phai gom dung 12 chu so');
    assert.ok(ORACLE_PROVINCES.has(provinceCode), `Ma tinh ${provinceCode} khong co trong oracle 63 tinh`);
    assert.equal(cccd.slice(0, 3), provinceCode, '3 so dau phai la ma tinh');

    const centuryChar = Number(cccd[3]);
    if (birthYear >= 1900 && birthYear <= 1999) {
      assert.equal(centuryChar, gender === 'male' ? 0 : 1, 'The ky 20 phai co ma 0 (nam) hoac 1 (nu)');
    } else if (birthYear >= 2000 && birthYear <= 2099) {
      assert.equal(centuryChar, gender === 'male' ? 2 : 3, 'The ky 21 phai co ma 2 (nam) hoac 3 (nu)');
    }

    assert.equal(cccd.slice(4, 6), String(birthYear).slice(-2), '2 so tiep theo phai la 2 so cuoi nam sinh');
    seen.add(cccd);
  }

  assert.equal(seen.size, 1000, '1.000 so CCCD sinh ra khong duoc trung lap');
});

test('TC-03: Tuy chon CCCD sai tra ve loi kem field', () => {
  const rng = createRng('err-test');
  const invalidProvinces = ['003', '000', '097', '79'];

  for (const prov of invalidProvinces) {
    assert.throws(
      () => generateCccd(rng, { provinceCode: prov }),
      (err) => err.field === 'provinceCode'
    );
  }

  assert.throws(
    () => generateCccd(rng, { birthYear: 1899 }),
    (err) => err.field === 'birthYear'
  );
  assert.throws(
    () => generateCccd(rng, { birthYear: new Date().getFullYear() + 1 }),
    (err) => err.field === 'birthYear'
  );
  assert.throws(
    () => generateCccd(rng, { gender: 'invalid_gender' }),
    (err) => err.field === 'gender'
  );
});

test('TC-04: Oracle checksum MST va 1.000 MST sinh ra', () => {
  // Test oracle voi 2 MST cong khai
  assert.ok(oracleVerifyMst('0100109106'), 'MST 0100109106 phai hop le');
  assert.ok(oracleVerifyMst('0300588569'), 'MST 0300588569 phai hop le');
  assert.ok(!oracleVerifyMst('0100109107'), 'MST bi sua so cuoi phai khong hop le');
  assert.ok(!oracleVerifyMst('0300588568'), 'MST bi sua so cuoi phai khong hop le');

  const rng = createRng('fixed-mst-seed-888');
  for (let i = 0; i < 1000; i++) {
    const mst = generateMst(rng, { mstKind: '10' });
    assert.ok(oracleVerifyMst(mst), `MST ${mst} khong vuot qua oracle checksum`);
  }
});

test('TC-05: MST 13 so dinh dang <MST10>-<001..999>', () => {
  const rng = createRng('fixed-mst13-seed');
  for (let i = 0; i < 100; i++) {
    const mst13 = generateMst(rng, { mstKind: '13' });
    assert.match(mst13, /^\d{10}-\d{3}$/, 'MST 13 so phai co dinh dang NNNNNNNNNN-NNN');
    const [mst10, sub] = mst13.split('-');
    assert.ok(oracleVerifyMst(mst10), `10 so dau ${mst10} phai vuot qua oracle`);
    const subNum = Number(sub);
    assert.ok(subNum >= 1 && subNum <= 999, `Hau to ${sub} phai tu 001 den 999`);
  }
});

test('TC-06: 1.000 SDT khop dinh dang va dau so 3 nha mang', () => {
  const rng = createRng('fixed-phone-seed');
  const allPrefixes = new Set([
    ...ORACLE_PREFIXES.viettel,
    ...ORACLE_PREFIXES.vinaphone,
    ...ORACLE_PREFIXES.mobifone
  ]);

  for (let i = 0; i < 1000; i++) {
    const phone = generatePhone(rng);
    assert.match(phone, /^0\d{9}$/, 'SDT phai gom 10 chu so bat dau bang 0');
    const pfx = phone.slice(0, 3);
    assert.ok(allPrefixes.has(pfx), `Dau so ${pfx} phai thuoc danh muc 3 nha mang`);
  }

  // Test carrier cu the
  for (const [carrier, pfxSet] of Object.entries(ORACLE_PREFIXES)) {
    for (let i = 0; i < 50; i++) {
      const phone = generatePhone(rng, { carrier });
      assert.ok(pfxSet.has(phone.slice(0, 3)), `SDT ${phone} khong dung dau so cua nha mang ${carrier}`);
    }
  }

  assert.throws(
    () => generatePhone(rng, { carrier: 'unknown_carrier' }),
    (err) => err.field === 'carrier'
  );
});
