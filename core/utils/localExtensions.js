const fs = require('fs');
const path = require('path');

/**
 * ĐIỂM NỐI MỞ RỘNG CỦA DỰ ÁN — dùng chung cho các module thuộc sở hữu Hub trong core/.
 *
 * `core/` bị sync từ Hub ghi đè toàn bộ; chỉ `core/local/` được loại trừ vĩnh viễn
 * (xem scripts/lib/sync-manifest.js và core/local/README.md). Vì vậy mọi hành vi riêng
 * của dự án phải nằm ở `core/local/<tên>.local.js` thay vì sửa trực tiếp file Hub —
 * bài học từ commit 7ad6984 tại Automation_Carthings.
 */

const LOCAL_DIR = path.join(__dirname, '..', 'local');

/**
 * Trả về `baseExports` đã merge với `core/local/<localFileName>` nếu file đó tồn tại.
 *
 * - File local không tồn tại  -> trả nguyên baseExports, không lỗi.
 * - File local lỗi cú pháp    -> cảnh báo ra stderr rồi trả nguyên baseExports.
 * - Key trùng tên             -> bản local thắng (dự án ghi đè Hub), kèm cảnh báo
 *                                để không vô tình che khuất API chuẩn.
 *
 * @param {string} localFileName ví dụ 'commonUtils.local.js'
 * @param {object} baseExports   export chuẩn của module Hub
 */
function withLocalOverrides(localFileName, baseExports) {
  const localPath = path.join(LOCAL_DIR, localFileName);
  if (!fs.existsSync(localPath)) return baseExports;

  let local;
  try {
    local = require(localPath);
  } catch (err) {
    console.warn(`[core/local] Khong nap duoc ${localFileName}: ${err.message}`);
    return baseExports;
  }

  if (!local || typeof local !== 'object') {
    console.warn(`[core/local] ${localFileName} phai export mot object phang; bo qua.`);
    return baseExports;
  }

  for (const key of Object.keys(local)) {
    if (Object.prototype.hasOwnProperty.call(baseExports, key)) {
      console.warn(`[core/local] ${localFileName} ghi de export chuan cua Hub: "${key}"`);
    }
  }

  return { ...baseExports, ...local };
}

module.exports = { LOCAL_DIR, withLocalOverrides };
