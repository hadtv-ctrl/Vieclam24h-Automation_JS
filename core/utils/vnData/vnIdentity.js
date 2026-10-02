/**
 * Thuat toan sinh ma dinh danh CCCD, MST va SĐT theo quy chuan Viet Nam.
 */

const { CCCD_PROVINCES, PHONE_PREFIXES, MST_WEIGHTS, MST_PREFIXES } = require('./vnCodes');

const CURRENT_YEAR = new Date().getFullYear();

function mstCheckDigit(nineDigits) {
  const digits = String(nineDigits).split('').map(Number);
  if (digits.length !== 9 || digits.some(Number.isNaN)) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * MST_WEIGHTS[i];
  }
  const rem = sum % 11;
  if (rem === 0) return null;
  return 10 - rem;
}

function generateCccd(rng, opts = {}) {
  let provinceCode = opts.provinceCode;
  if (provinceCode !== undefined && provinceCode !== null) {
    const strCode = String(provinceCode);
    if (!/^\d{3}$/.test(strCode) || !CCCD_PROVINCES.includes(strCode)) {
      const err = new Error(`Ma tinh CCCD khong hop le (phai gom 3 chu so thuoc danh muc): ${opts.provinceCode}`);
      err.field = 'provinceCode';
      throw err;
    }
    provinceCode = strCode;
  } else {
    provinceCode = rng.pick(CCCD_PROVINCES);
  }

  let gender = opts.gender || 'any';
  if (!['any', 'male', 'female'].includes(gender)) {
    const err = new Error(`Gioi tinh khong hop le: ${gender}`);
    err.field = 'gender';
    throw err;
  }
  if (gender === 'any') {
    gender = rng.next() > 0.5 ? 'male' : 'female';
  }

  let birthYear = opts.birthYear;
  if (birthYear !== undefined && birthYear !== null) {
    birthYear = Number(birthYear);
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > CURRENT_YEAR) {
      const err = new Error(`Nam sinh khong hop le: ${opts.birthYear}`);
      err.field = 'birthYear';
      throw err;
    }
  } else {
    birthYear = CURRENT_YEAR - rng.int(18, 60);
  }

  let centuryCode;
  if (birthYear >= 1900 && birthYear <= 1999) {
    centuryCode = gender === 'male' ? 0 : 1;
  } else if (birthYear >= 2000 && birthYear <= 2099) {
    centuryCode = gender === 'male' ? 2 : 3;
  } else {
    centuryCode = gender === 'male' ? 4 : 5;
  }

  const yy = String(birthYear).slice(-2);
  const serial = String(rng.int(0, 999999)).padStart(6, '0');
  const cccd = `${provinceCode}${centuryCode}${yy}${serial}`;

  return {
    cccd,
    provinceCode,
    birthYear,
    gender
  };
}

function generateMst(rng, opts = {}) {
  const kind = opts.mstKind === '13' || opts.kind === '13' ? '13' : '10';

  let nineDigits = '';
  let checkDigit = null;
  let attempts = 0;

  while (checkDigit === null && attempts < 100) {
    attempts++;
    const prefix = rng.pick(MST_PREFIXES);
    const middle = String(rng.int(0, 9999999)).padStart(7, '0');
    nineDigits = `${prefix}${middle}`;
    checkDigit = mstCheckDigit(nineDigits);
  }

  if (checkDigit === null) {
    nineDigits = '010010910';
    checkDigit = 6;
  }

  const mst10 = `${nineDigits}${checkDigit}`;
  if (kind === '13') {
    const sub = String(rng.int(1, 999)).padStart(3, '0');
    return `${mst10}-${sub}`;
  }
  return mst10;
}

function generatePhone(rng, opts = {}) {
  let carrier = opts.carrier || 'any';
  if (!['any', 'viettel', 'vinaphone', 'mobifone'].includes(carrier)) {
    const err = new Error(`Nha mang khong hop le: ${carrier}`);
    err.field = 'carrier';
    throw err;
  }

  let prefix;
  if (carrier === 'any') {
    const all = [
      ...PHONE_PREFIXES.viettel,
      ...PHONE_PREFIXES.vinaphone,
      ...PHONE_PREFIXES.mobifone
    ];
    prefix = rng.pick(all);
  } else {
    prefix = rng.pick(PHONE_PREFIXES[carrier]);
  }

  const suffix = String(rng.int(0, 9999999)).padStart(7, '0');
  return `${prefix}${suffix}`;
}

module.exports = {
  mstCheckDigit,
  generateCccd,
  generateMst,
  generatePhone
};
