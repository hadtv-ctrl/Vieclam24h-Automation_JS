/**
 * Mulberry32 Seeded Pseudo-Random Number Generator (PRNG).
 * Dam bao tinh xac dinh (determinism) 100% qua cac lan chay voi cung seed.
 */

function hashSeed(seed) {
  if (typeof seed === 'number' && !Number.isNaN(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a) {
  let state = a >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function createRng(seed) {
  if (seed === '') {
    const err = new Error('Seed khong duoc de trong');
    err.field = 'seed';
    throw err;
  }
  const actualSeed = seed === undefined || seed === null ? newSeed() : String(seed);
  const u32 = hashSeed(actualSeed);
  const rawRng = mulberry32(u32);

  return {
    seed: actualSeed,
    next: rawRng,
    int(min, max) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return lo + Math.floor(rawRng() * (hi - lo + 1));
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[Math.floor(rawRng() * arr.length)];
    }
  };
}

module.exports = {
  createRng,
  newSeed,
  hashSeed
};
