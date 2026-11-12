'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Một ô Spec có thể khai nhiều file (desktop + mobile) nối bằng <br> — chính lệnh matrix cũng sinh ra dạng này.
 * @param {string} specCell
 * @returns {string[]}
 */
function splitSpecCell(specCell) {
  return (specCell || '')
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-');
}

/**
 * Trả về các đường dẫn spec trong ô không tồn tại trên đĩa lẫn trong danh sách test Playwright đọc được.
 * @param {string} root
 * @param {string} specCell
 * @param {{tests?: Array<{path?: string, file?: string}>}} automated
 * @param {{projectDir?: string}} [options]
 * @returns {string[]}
 */
function missingSpecPaths(root, specCell, automated, options) {
  const projectDir = (options && options.projectDir) || 'playwright';
  return splitSpecCell(specCell).filter((spec) => {
    if (fs.existsSync(path.resolve(root, spec)) || fs.existsSync(path.resolve(root, projectDir, spec))) return false;
    const s = spec.replace(/\\/g, '/');
    return !(
      automated.tests &&
      automated.tests.some((t) => {
        const f = (t.path || t.file || '').replace(/\\/g, '/');
        return f === s || f.endsWith('/' + s) || s.endsWith('/' + f);
      })
    );
  });
}

module.exports = { splitSpecCell, missingSpecPaths };
