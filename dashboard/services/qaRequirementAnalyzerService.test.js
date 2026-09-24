/**
 * dashboard/services/qaRequirementAnalyzerService.test.js
 * Kiểm thử đơn vị cho qaRequirementAnalyzerService.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  gatherRepoContext,
  analyzeRequirement,
  scaffoldFromAnalysis,
} = require('./qaRequirementAnalyzerService');

const ROOT = path.resolve(__dirname, '..', '..');

async function runTests() {
  console.log('--- TEST 1: gatherRepoContext ---');
  const context = gatherRepoContext(ROOT);
  assert(context && typeof context === 'object', 'Repo context must be an object');
  assert(Array.isArray(context.testCases), 'testCases should be an array');
  assert(Array.isArray(context.specs), 'specs should be an array');
  console.log(`✓ gatherRepoContext returned ${context.testCases.length} test-cases files, ${context.specs.length} specs`);

  console.log('\n--- TEST 2: analyzeRequirement (Heuristic mode with BVA) ---');
  const sampleReq = `Tính năng cập nhật hồ sơ giáo viên:
Trường "Trung tâm sát hạch" là bắt buộc cả khi tạo mới và khi cập nhật.
Khu vực đào tạo (phường/xã) tối đa 10 mục. Bỏ trống trung tâm sát hạch sẽ bị chặn lưu và hiển thị thông báo toast lỗi.`;

  const result = await analyzeRequirement({
    root: ROOT,
    rawText: sampleReq,
    mode: 'heuristic',
    scanExisting: true,
  });

  assert(result.engine === 'heuristic', 'Engine should be heuristic');
  assert(result.testCaseEstimation && result.testCaseEstimation.totalCount > 0, 'Should estimate test cases');
  assert(result.testCaseEstimation.testCases.length > 0, 'Should have test cases array');
  assert(result.systemImpact && result.systemImpact.riskLevel, 'Should have systemImpact with riskLevel');
  assert(Array.isArray(result.logicClarifications) && result.logicClarifications.length > 0, 'Should have logicClarifications');
  assert(Array.isArray(result.qaTeamInquiries) && result.qaTeamInquiries.length > 0, 'Should have qaTeamInquiries');
  console.log(`✓ Heuristic generated ${result.testCaseEstimation.totalCount} test cases, ${result.logicClarifications.length} clarifications, ${result.qaTeamInquiries.length} QA inquiries`);

  console.log('\n--- TEST 3: scaffoldFromAnalysis ---');
  const testRoot = path.join(ROOT, '.tmp', 'test-analyzer-scaffold');
  fs.mkdirSync(testRoot, { recursive: true });

  const scaffoldRes = scaffoldFromAnalysis(testRoot, {
    reqId: 'REQ-999',
    title: 'Kiểm tra Phân Tích Thử Nghiệm',
    analysisResult: result,
  });

  assert(scaffoldRes.ok === true, 'Scaffold must succeed');
  assert(scaffoldRes.files.length === 2, 'Scaffold must create 2 files');
  assert(fs.existsSync(path.join(testRoot, scaffoldRes.files[0])), 'Req file must exist');
  assert(fs.existsSync(path.join(testRoot, scaffoldRes.files[1])), 'TC file must exist');

  // Dọn dẹp thư mục test
  fs.rmSync(testRoot, { recursive: true, force: true });
  console.log('✓ Scaffold created REQ and TC files successfully and cleaned up');

  console.log('\n========================================');
  console.log('ALL TESTS PASSED FOR qaRequirementAnalyzerService!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
