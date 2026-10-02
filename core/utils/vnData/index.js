/**
 * Entrypoint va dieu phoi sinh du lieu Viet Nam, placeholder resolver va Persona.
 */

const { createRng } = require('./seededRandom');
const { CCCD_PROVINCES, PHONE_PREFIXES } = require('./vnCodes');
const { generateCccd, generateMst, generatePhone } = require('./vnIdentity');
const { generateFullName, toAscii } = require('./vnNames');
const { listPayloads, PAYLOAD_CATEGORIES } = require('./edgePayloads');

class VnDataError extends Error {
  constructor(message, field = 'general', code = 'INVALID_INPUT') {
    super(message);
    this.name = 'VnDataError';
    this.field = field;
    this.code = code;
  }
}

function buildPersona(rng, options = {}, seq = 1) {
  const gender = options.gender && ['male', 'female'].includes(options.gender)
    ? options.gender
    : (rng.next() > 0.5 ? 'male' : 'female');

  const currentYear = new Date().getFullYear();
  const birthYear = options.birthYear ? Number(options.birthYear) : (currentYear - rng.int(18, 60));
  const month = String(rng.int(1, 12)).padStart(2, '0');
  const day = String(rng.int(1, 28)).padStart(2, '0');
  const birthDate = `${birthYear}-${month}-${day}`;

  const cccdObj = generateCccd(rng, { provinceCode: options.provinceCode, gender, birthYear });
  const nameObj = generateFullName(rng, { gender, diacritics: options.diacritics !== false });
  const phone = generatePhone(rng, { carrier: options.carrier });

  const givenAscii = toAscii(nameObj.given).toLowerCase().replace(/[^a-z]/g, '');
  const surnameAscii = toAscii(nameObj.surname).toLowerCase().replace(/[^a-z]/g, '');
  const yy = String(birthYear).slice(-2);
  const emailSeq = String(seq).padStart(2, '0');
  const email = `${givenAscii}.${surnameAscii}${yy}${emailSeq}@example.com`;

  return {
    fullName: nameObj.fullName,
    gender,
    birthDate,
    cccd: cccdObj.cccd,
    phone,
    email
  };
}

function generateRecords({ type, count = 10, seed, options = {} }) {
  const validTypes = ['cccd', 'mst', 'phone', 'name', 'persona'];
  if (!type || !validTypes.includes(type)) {
    throw new VnDataError(`Loai du lieu khong hop le: ${type}`, 'type');
  }

  const numCount = Number(count);
  if (!Number.isInteger(numCount) || numCount < 1 || numCount > 500) {
    throw new VnDataError(`So luong phai la so nguyen tu 1 den 500: ${count}`, 'count');
  }

  let rng;
  try {
    rng = createRng(seed);
  } catch (err) {
    throw new VnDataError(err.message, err.field || 'seed');
  }

  const records = [];
  const seen = new Set();
  const maxAttempts = numCount * 25;
  let attempts = 0;

  while (records.length < numCount && attempts < maxAttempts) {
    attempts++;
    let item;
    let key;

    if (type === 'cccd') {
      item = generateCccd(rng, options).cccd;
      key = item;
    } else if (type === 'mst') {
      item = generateMst(rng, options);
      key = item;
    } else if (type === 'phone') {
      item = generatePhone(rng, options);
      key = item;
    } else if (type === 'name') {
      item = generateFullName(rng, options).fullName;
      key = `${item}-${attempts}`;
    } else if (type === 'persona') {
      item = buildPersona(rng, options, records.length + 1);
      key = `${item.cccd}-${item.phone}-${item.email}`;
    }

    if (!seen.has(key)) {
      seen.add(key);
      records.push(item);
    }
  }

  if (records.length < numCount) {
    throw new VnDataError(`Khong the sinh du ${numCount} ban ghi khong trung lap`, 'count');
  }

  return {
    type,
    count: numCount,
    seed: rng.seed,
    records,
    generatedAt: new Date().toISOString()
  };
}

function resolveVnPlaceholder(token) {
  if (typeof token !== 'string') return token;
  const clean = token.replace(/^\{\{|\}\}$/g, '').trim();
  const rng = createRng();

  switch (clean) {
    case 'vn_cccd':
      return generateCccd(rng).cccd;
    case 'vn_mst':
      return generateMst(rng);
    case 'vn_phone':
      return generatePhone(rng);
    case 'vn_name':
      return generateFullName(rng).fullName;
    case 'vn_email':
      return buildPersona(rng).email;
    default:
      return token;
  }
}

module.exports = {
  VnDataError,
  generateRecords,
  resolveVnPlaceholder,
  createRng,
  generateCccd,
  generateMst,
  generatePhone,
  generateFullName,
  listPayloads,
  PAYLOAD_CATEGORIES,
  CCCD_PROVINCES,
  PHONE_PREFIXES
};
