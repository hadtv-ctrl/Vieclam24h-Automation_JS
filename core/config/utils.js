function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asFontSize(value, fallback = '') {
  const text = asString(value, '');
  if (!text) return '';
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(text);
  if (!match) return asFontSize(fallback, '');
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size < 11 || size > 18) return asFontSize(fallback, '');
  return `${size}px`;
}

function asBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number)) return fallback;
  if (number < min || number > max) return fallback;
  return number;
}

function assertUrl(value, name) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${name} must be a valid http(s) URL.`);
  }
}

function normalizePort(value, fallback = 4180) {
  if (value === 'random' || value === 0 || value === '0') return 'random';
  if (value === 'auto') return 'auto';
  const number = Number.parseInt(value, 10);
  if (Number.isInteger(number) && number >= 1024 && number <= 65535) return number;
  return fallback;
}

module.exports = {
  clone,
  asString,
  asFontSize,
  asBoolean,
  asInteger,
  assertUrl,
  normalizePort,
};
