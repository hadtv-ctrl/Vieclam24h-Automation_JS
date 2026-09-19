'use strict';

const { execSync } = require('child_process');

/**
 * Danh sách file đã thay đổi so với `ref`, GỒM CẢ thay đổi chưa commit.
 *
 * Tách riêng khỏi lõi qaTrace để lõi vẫn là hàm thuần, không đụng tới git.
 * Trả về `null` khi không đọc được (không phải git repo, ref không tồn tại) — người gọi
 * phải phân biệt "không có thay đổi nào" với "không kiểm tra được", đừng coi là như nhau.
 *
 * @param {string} root thư mục repo
 * @param {string} ref ví dụ 'HEAD~1', 'origin/main'
 * @returns {string[]|null} đường dẫn tương đối, dùng dấu /
 */
function changedFilesSince(root, ref) {
  const run = (cmd) => execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const toLines = (out) => String(out).split(/\r?\n/);
  const toPosix = (p) => p.split('\\').join('/');

  try {
    const committed = toLines(run(`git diff --name-only ${ref}`));
    // `git status --porcelain` có 2 ký tự trạng thái + 1 khoảng trắng ở đầu mỗi dòng.
    const working = toLines(run('git status --porcelain')).map((line) => line.slice(3));
    return [...new Set(committed.concat(working))].filter(Boolean).map(toPosix);
  } catch (err) {
    console.error(`Khong doc duoc thay doi git tu "${ref}": ${toLines(err.message)[0]}`);
    return null;
  }
}

module.exports = { changedFilesSince };
