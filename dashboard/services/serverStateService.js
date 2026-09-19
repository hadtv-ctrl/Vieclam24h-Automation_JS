/**
 * dashboard/services/serverStateService.js
 * Vị trí file trạng thái runtime của dashboard, và việc bảo đảm nó không bị commit.
 *
 * `.dashboard-server.json` chứa port + pid của tiến trình đang chạy. Nó là trạng thái của
 * MỘT MÁY, không phải tài sản của dự án: mỗi người chạy dashboard sẽ sinh ra một bản khác
 * nhau, và commit nó lên chỉ tạo xung đột vô nghĩa.
 *
 * File nằm ở gốc repo vì `Start_Dashboard.bat` đọc nó bằng đường dẫn tương đối, mà .bat đó
 * lại nằm trong ROOT_FILES_TO_SYNC — dời file đi sẽ kéo theo sửa cả .bat ở mọi vệ tinh.
 * Vì vậy cách xử lý là: thứ nào TẠO RA artifact thì thứ đó lo luôn phần ignore, ngay tại
 * repo đang chạy. Hub không thể làm hộ, vì `.gitignore` thuộc về từng dự án và không bao
 * giờ được đồng bộ (ghi đè nó sẽ xoá mất các mục riêng của dự án).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const STATE_FILE_NAME = '.dashboard-server.json';

const IGNORE_COMMENT = '# Trạng thái runtime của dashboard (port + pid), sinh lại mỗi lần chạy.';

function stateFilePath(root) {
  return path.join(root, STATE_FILE_NAME);
}

/**
 * Bảo đảm `.gitignore` của repo đang chạy có bỏ qua file trạng thái.
 *
 * Chỉ THÊM một dòng, không bao giờ sửa hay sắp xếp lại nội dung sẵn có — `.gitignore` là
 * tài sản của dự án. Không phải repo git thì không làm gì. Ghi hỏng cũng không được phép
 * làm sập dashboard: đây là tiện ích, không phải điều kiện để chạy.
 *
 * @param {string} root Gốc repo đang chạy (context.root).
 * @returns {string|null} Đường dẫn .gitignore vừa được bổ sung, hoặc null nếu không cần.
 */
function ensureStateFileIgnored(root) {
  try {
    if (!root || !fs.existsSync(path.join(root, '.git'))) return null;

    const gitignorePath = path.join(root, '.gitignore');
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

    // Chấp nhận mọi cách viết tương đương: có/không dấu gạch chéo đầu, có/không "!"đảo.
    const alreadyIgnored = existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .some((line) => line === STATE_FILE_NAME || line === `/${STATE_FILE_NAME}`);
    if (alreadyIgnored) return null;

    const prefix = existing.length && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(
      gitignorePath,
      `${prefix}\n${IGNORE_COMMENT}\n/${STATE_FILE_NAME}\n`,
      'utf8',
    );
    return gitignorePath;
  } catch (_) {
    return null;
  }
}

/**
 * File đã LỠ được commit thì `.gitignore` không còn tác dụng: git vẫn theo dõi nó, và mỗi
 * lần chạy dashboard sẽ tạo ra một thay đổi chờ commit. Trường hợp này phải gỡ khỏi index
 * bằng tay — không tự làm hộ, vì `git rm --cached` là thao tác trên repo của người khác.
 *
 * @returns {boolean} true nếu git đang theo dõi file trạng thái ở repo này.
 */
function isStateFileTracked(root) {
  try {
    if (!root || !fs.existsSync(path.join(root, '.git'))) return false;
    execFileSync('git', ['ls-files', '--error-unmatch', STATE_FILE_NAME], {
      cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000,
    });
    return true;
  } catch (_) {
    return false;
  }
}

/** Câu lệnh gỡ file khỏi index, in ra cho người vận hành chạy đúng một lần. */
function untrackCommand() {
  return `git rm --cached ${STATE_FILE_NAME}`;
}

module.exports = {
  STATE_FILE_NAME,
  IGNORE_COMMENT,
  stateFilePath,
  ensureStateFileIgnored,
  isStateFileTracked,
  untrackCommand,
};
