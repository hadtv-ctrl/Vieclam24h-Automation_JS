'use strict';

/**
 * Lõi truy vết REQ -> AC -> TC -> spec. Hàm thuần, không I/O ngoài đọc file, không ghi gì.
 *
 * Phân công: chuẩn viết requirement/test case (template, quy tắc, ví dụ) thuộc repo
 * `hadinhkms/Support_doc_n_TestCase`. File này KHÔNG định nghĩa lại chuẩn đó — nó chỉ đọc
 * đúng những định danh mà chuẩn quy định và trả lời ba câu hỏi bằng máy:
 *
 *   1. Nghiệp vụ nào đã ghi nhận mà chưa có test case?      -> ac-khong-co-tc
 *   2. Test case nào đã viết mà chưa có script?             -> tc-chua-automation  (= ứng viên automation)
 *   3. Script nào đang chạy mà không truy về được nghiệp vụ? -> spec-khong-truy-vet
 *
 * Câu 3 là cái bắt "missing business": một spec không gắn `@REQ-xxx` nghĩa là hành vi nó
 * kiểm chứng không nằm trong tài liệu nào — hoặc tài liệu thiếu, hoặc spec thừa.
 *
 * Quy ước định danh (xem ai/shared/AI_PROMPTS.md mục 3):
 *   requirements/REQ-xxx-<slug>.md   chứa các `AC-yyy`
 *   test-cases/REQ-xxx-<slug>.md     chứa các `TC-zzz` kèm AC liên quan và priority
 *   tests/**\/*.spec.js               `test.describe('... @REQ-xxx')`
 *                                     `test('TC-zzz - AC-yyy <mô tả> @smoke')`
 */


const { DEFAULT_DIRS, KIND_LABEL, isHubRepo, stripCodeBlocks } = require('./qaTraceShared');
const { parseRequirements, parseTestCases } = require('./qaTraceDocs');
const { extractTestCaseDetails } = require('./qaTraceTestCaseDetails');
const { parseSpecs } = require('./qaTraceSpecs');
const { buildTraceReport } = require('./qaTraceReport');

/**
 * Soi một tập thay đổi (từ git) để bắt việc viết script mà KHÔNG ghi nhận nghiệp vụ.
 *
 * Không cưỡng chế được hành vi "phải ghi tài liệu" — nhưng bắt được hậu quả của nó ngay tại
 * commit, thay vì để lộ ra nhiều tháng sau. Hàm thuần: nhận sẵn danh sách file đã đổi.
 *
 * @param {object} report kết quả buildTraceReport
 * @param {string[]} changedFiles đường dẫn tương đối, dùng dấu /
 */
function assessChangeSet(report, changedFiles) {
  const d = report.dirs;
  const isSpec = (f) => f.startsWith(`${d.specs}/`) && /\.spec\.(js|ts)$/.test(f);
  const isDoc = (f) => f.startsWith(`${d.requirements}/`) || f.startsWith(`${d.testCases}/`);

  const changedSpecs = changedFiles.filter(isSpec);
  const changedDocs = changedFiles.filter(isDoc);
  const findings = [];

  for (const file of changedSpecs) {
    const spec = report.specs.find((s) => s.file === file);
    if (!spec) continue; // file đã bị xoá
    if (spec.reqs.length === 0) {
      findings.push({
        kind: 'spec-vua-sua-khong-truy-vet',
        severity: 'major',
        id: file,
        detail: `${file} vừa thay đổi nhưng không gắn @REQ-xxx — nghiệp vụ nó kiểm chứng không nằm trong tài liệu nào`,
      });
    }
  }

  if (changedSpecs.length > 0 && changedDocs.length === 0) {
    findings.push({
      kind: 'sua-script-ma-khong-dong-tai-lieu',
      severity: 'minor',
      id: `${changedSpecs.length} spec`,
      detail: `${changedSpecs.length} spec thay đổi mà không file nào trong ${d.requirements}/ hay ${d.testCases}/ đổi theo`
        + ' — nếu có phát hiện nghiệp vụ mới thì phải ghi lại (AI_PROMPTS.md mục 3.5a)',
    });
  }

  return { changedSpecs, changedDocs, findings };
}

/** Ứng viên automation đã xếp hạng: P0 trước, rồi theo ID. */
function rankAutomationCandidates(report, limit = 7) {
  const weight = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...report.candidates]
    .sort((a, b) => (weight[a.priority] ?? 9) - (weight[b.priority] ?? 9) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

module.exports = {
  isHubRepo,
  DEFAULT_DIRS,
  KIND_LABEL,
  buildTraceReport,
  assessChangeSet,
  rankAutomationCandidates,
  parseRequirements,
  parseTestCases,
  extractTestCaseDetails,
  parseSpecs,
  stripCodeBlocks,
};
