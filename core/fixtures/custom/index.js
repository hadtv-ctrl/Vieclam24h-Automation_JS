const fs = require('fs');
const path = require('path');

/**
 * Dynamic Custom Fixtures Loader
 * Tự động quét và nạp toàn bộ các custom fixtures do người dùng tạo từ Dashboard Studio
 * trong thư mục core/fixtures/custom/*.fixture.js
 */
function loadCustomFixtures(customDir = __dirname) {
  const fixtures = {};
  if (!fs.existsSync(customDir)) return fixtures;

  const entries = fs.readdirSync(customDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.fixture.js') || (entry.name.endsWith('.js') && entry.name !== 'index.js'))) {
      const fullPath = path.join(customDir, entry.name);
      try {
        const mod = require(fullPath);
        if (typeof mod === 'function') {
          const fixName = path.basename(entry.name, '.fixture.js').replace(/\.js$/, '');
          fixtures[fixName] = mod;
        } else if (mod && typeof mod === 'object') {
          for (const [key, val] of Object.entries(mod)) {
            if (typeof val === 'function' || Array.isArray(val)) {
              fixtures[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`[CustomFixtures Warning] Không thể nạp custom fixture tại '${entry.name}': ${err.message}`);
      }
    }
  }

  return fixtures;
}

const customFixtures = loadCustomFixtures();

module.exports = {
  customFixtures,
  loadCustomFixtures,
};
