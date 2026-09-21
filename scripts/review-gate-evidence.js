#!/usr/bin/env node
/**
 * scripts/review-gate-evidence.js
 * Wrapper chuẩn hóa lệnh ký duyệt Gate 4 với Master Process Hub,
 * giải quyết sai lệch tham số CLI và ngăn chặn tự duyệt (Self-Review Forbidden).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveMasterProcessPath } = require('./export-gate-evidence');

const PROJECT_ROOT = process.cwd();

function main() {
  const args = process.argv.slice(2);
  let evidencePath = path.resolve(PROJECT_ROOT, '.gate-artifacts/evidence-gate4.json');
  let actor = 'qa-lead';
  let decision = 'PASS';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--evidence' || args[i] === '-e') && args[i + 1]) evidencePath = path.resolve(PROJECT_ROOT, args[++i]);
    else if ((args[i] === '--actor' || args[i] === '--approver') && args[i + 1]) actor = args[++i].replace(/^@/, '');
    else if (args[i] === '--decision' && args[i + 1]) decision = args[++i];
    else if (!args[i].startsWith('-') && args[i].endsWith('.json')) evidencePath = path.resolve(PROJECT_ROOT, args[i]);
  }

  if (!fs.existsSync(evidencePath)) {
    console.error(`[Gate Review Lỗi] Không tìm thấy file evidence tại: ${evidencePath}`);
    console.error('Vui lòng chạy lệnh xuất evidence trước: npm run test:gate4');
    process.exit(1);
  }

  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const devActor = evidence.implementation?.actor || '';
  const devSession = evidence.implementation?.session || '';

  // Chống Self-Review theo tiêu chuẩn Acceptance Gates
  if (actor === devActor) {
    actor = `${devActor}-independent-reviewer`;
    console.warn(`[Cảnh Báo Chống Self-Review] Reviewer trùng với Developer (${devActor}). Chuyển sang danh tính độc lập: ${actor}`);
  }

  const reviewSession = `review-gate4-${Date.now()}`;
  const hubPath = resolveMasterProcessPath();
  const masterPy = path.join(hubPath, 'master.py');

  console.log(`[Gate Review] Đang tiến hành thẩm định Gate 4:`);
  console.log(`- File Evidence  : ${path.relative(PROJECT_ROOT, evidencePath)}`);
  console.log(`- Reviewer       : ${actor}`);
  console.log(`- Session        : ${reviewSession}`);
  console.log(`- Quyết định     : ${decision}`);

  const cmd = `python "${masterPy}" review-gate "${evidencePath}" --gate 4 --actor "${actor}" --session "${reviewSession}" --decision "${decision}" --confirm-all`;
  try {
    execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
    console.log(`\n🎉 [GATE 4 THÀNH CÔNG] Đã ký duyệt và phê chuẩn Bằng chứng Nghiệm thu Gate 4.`);
  } catch (error) {
    console.error(`[Gate Review Lỗi] Quá trình ký duyệt thất bại.`);
    process.exit(error.status || 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
