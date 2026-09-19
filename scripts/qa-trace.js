#!/usr/bin/env node
'use strict';

/**
 * QA TRACE — cổng truy vết REQ -> AC -> TC -> spec. CHỈ ĐỌC, không ghi gì.
 *
 * Vì sao cần: `ai/shared/AI_PROMPTS.md` mục 3 bắt đọc requirement trước khi viết script và
 * ghi nhận ngược nghiệp vụ sau khi viết. Nhưng đó là rule bằng văn bản — không có gì cưỡng chế,
 * bỏ qua thì không ai biết. Công cụ này biến ba câu hỏi đó thành exit code.
 *
 * Phân công: chuẩn viết requirement/test case thuộc repo `hadinhkms/Support_doc_n_TestCase`.
 * Công cụ này không định nghĩa lại chuẩn — nó chỉ kiểm tra việc tuân thủ, và chạy được ở mọi
 * repo vệ tinh vì `scripts/` được Hub sync xuống.
 *
 * Cách dùng:
 *   node scripts/qa-trace.js                 # báo cáo đầy đủ
 *   node scripts/qa-trace.js gaps            # chỉ những chỗ đang hổng
 *   node scripts/qa-trace.js suggest         # test case đáng automation tiếp theo
 *   node scripts/qa-trace.js --strict        # exit 1 khi còn finding mức major
 *   node scripts/qa-trace.js --since=origin/main   # chỉ soi phần vừa thay đổi
 *   node scripts/qa-trace.js --json
 *   node scripts/qa-trace.js --root=D:/_Script_automation --specs=playwright/tests
 */

const {
  buildTraceReport, rankAutomationCandidates, assessChangeSet, KIND_LABEL,
} = require('./lib/qaTrace');

const { changedFilesSince } = require('./lib/gitChanges');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const SEVERITY_ORDER = { major: 0, minor: 1, info: 2 };

function printSummary(report) {
  const c = report.counts;
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  QA TRACE — REQ -> AC -> TC -> spec (read-only)     ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.dim}Root: ${report.root}${colors.reset}`);
  console.log(
    `\n  requirements ${c.requirements}  |  AC ${c.acceptanceCriteria}  |  test case ${c.testCases}`
    + `  |  spec ${c.specs}  |  spec chưa gắn @REQ ${c.specsWithoutTrace}`,
  );
}

function printBootstrapHint(report) {
  console.log(`\n${colors.yellow}Repo chưa có ${report.dirs.requirements}/ và ${report.dirs.testCases}/.${colors.reset}`);
  console.log(`${colors.dim}  Đây là trạng thái mặc định khi dự án bắt đầu từ script. Lối vào:`);
  console.log(`  1. Dựng ngược tài liệu từ chính spec đang có — xem AI_PROMPTS.md mục 3.4.`);
  console.log(`  2. Template và quy tắc viết: repo hadinhkms/Support_doc_n_TestCase.`);
  console.log(`  3. Chạy lại lệnh này để thấy độ phủ tăng dần.${colors.reset}`);
  console.log(`\n${colors.bright}${report.counts.specs} spec hiện có, tất cả đều chưa truy vết được về nghiệp vụ nào.${colors.reset}`);
  console.log(`${colors.dim}Đó chính là vùng rủi ro "missing business": không có cách nào biết spec đã phủ hết nghiệp vụ hay chưa.${colors.reset}`);
}

function printFindings(report, onlyGaps) {
  const findings = [...report.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.kind.localeCompare(b.kind),
  );
  const shown = onlyGaps ? findings.filter((f) => f.severity !== 'info') : findings;

  if (!shown.length) {
    console.log(`\n${colors.green}Không còn khoảng hở nào trong ma trận truy vết.${colors.reset}`);
    return;
  }

  let currentKind = null;
  for (const f of shown) {
    if (f.kind !== currentKind) {
      currentKind = f.kind;
      console.log(`\n${colors.bright}${KIND_LABEL[f.kind] || f.kind}${colors.reset}`);
    }
    const color = f.severity === 'major' ? colors.red : f.severity === 'minor' ? colors.yellow : colors.dim;
    console.log(`  ${color}[${f.severity}]${colors.reset} ${f.detail}`);
  }
}

function printCandidates(report, limit) {
  const ranked = rankAutomationCandidates(report, limit);
  console.log(`\n${colors.bright}Test case đáng automation tiếp theo${colors.reset}`);
  if (!ranked.length) {
    console.log(`  ${colors.dim}(không có — mọi test case đã có script, hoặc chưa có test-cases/)${colors.reset}`);
    return;
  }
  const w = Math.max(10, ...ranked.map((t) => t.file.length));
  console.log(`  ${'TC'.padEnd(8)} ${'AC'.padEnd(10)} ${'Ưu tiên'.padEnd(8)} ${'Nguồn'.padEnd(w)}`);
  console.log(`  ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(8)} ${'-'.repeat(w)}`);
  for (const t of ranked) {
    console.log(`  ${t.id.padEnd(8)} ${(t.acs.join(',') || '-').padEnd(10)} ${(t.priority || '-').padEnd(8)} ${t.file.padEnd(w)}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const asJson = argv.includes('--json');
  const command = argv.find((a) => !a.startsWith('-')) || 'report';
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) || 7 : 7;

  // Repo có layout khác (ví dụ spec nằm trong playwright/tests) thì khai ở đây,
  // đừng sửa lõi. Mặc định: requirements/ , test-cases/ , tests/
  const flag = (name) => {
    const found = argv.find((a) => a.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : undefined;
  };
  const dirs = {};
  if (flag('requirements')) dirs.requirements = flag('requirements');
  if (flag('test-cases')) dirs.testCases = flag('test-cases');
  if (flag('specs')) dirs.specs = flag('specs');

  const root = flag('root') || process.cwd();
  const report = buildTraceReport({ root, dirs });

  // --since: chỉ soi phần vừa thay đổi. Dùng ở pre-commit hoặc PR gate, nơi bắt được
  // việc "viết script xong mà không ghi lại nghiệp vụ" đúng lúc nó vừa xảy ra.
  const since = flag('since');
  let changeSet = null;
  if (since) {
    const changed = changedFilesSince(root, since);
    if (changed) {
      changeSet = assessChangeSet(report, changed);
      report.findings.push(...changeSet.findings);
    }
  }

  const majors = report.findings.filter((f) => f.severity === 'major');

  if (asJson) {
    console.log(JSON.stringify({ ...report, majorCount: majors.length }, null, 2));
  } else if (command === 'suggest') {
    printCandidates(report, limit);
  } else {
    printSummary(report);
    if (report.bootstrap) {
      printBootstrapHint(report);
    } else {
      printFindings(report, command === 'gaps');
      printCandidates(report, limit);
    }
    console.log(
      `\n${colors.bright}Tổng kết: ${majors.length} finding mức major`
      + `, ${report.findings.length} finding tất cả các mức.${colors.reset}`,
    );
  }

  if (strict && majors.length > 0) {
    if (!asJson) console.error(`${colors.red}${colors.bright}STRICT: còn ${majors.length} finding mức major.${colors.reset}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
