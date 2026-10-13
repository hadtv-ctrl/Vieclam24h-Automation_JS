'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Đăng ký thông tin vệ tinh mới vào RAW_SATELLITES trong sync-manifest.js
 * @param {string} satelliteName Tên định danh vệ tinh
 * @param {string} targetDir Thư mục chứa dự án vệ tinh
 * @param {string} [repo] Đường dẫn repository (tùy chọn)
 * @param {string} [hubRoot] Thư mục gốc Hub
 * @returns {boolean} True nếu đăng ký mới thành công, False nếu đã tồn tại
 */
function registerInManifest(satelliteName, targetDir, repo = '', hubRoot = path.resolve(__dirname, '..', '..')) {
  const manifestPath = path.join(hubRoot, 'scripts', 'lib', 'sync-manifest.js');
  if (!fs.existsSync(manifestPath)) return false;

  let content = fs.readFileSync(manifestPath, 'utf8');
  if (content.includes(`name: '${satelliteName}'`) || content.includes(`name: "${satelliteName}"`)) {
    return false;
  }

  const escapedPath = targetDir.replace(/\\/g, '\\\\');
  const envVar = `SATELLITE_${satelliteName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_PATH`;
  const repoName = repo || `hadinhkms/${satelliteName}`;

  const entry = `  {
    name: '${satelliteName}',
    repo: '${repoName}',
    branch: 'main',
    localPath: '${escapedPath}',
    candidates: ['${escapedPath}'],
    envVar: '${envVar}',
    autoSync: true,
  },`;

  content = content.replace(/(const RAW_SATELLITES = \[\s*\n)/, `$1${entry}\n`);
  fs.writeFileSync(manifestPath, content, 'utf8');
  return true;
}

module.exports = {
  registerInManifest,
};
