const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPermittedPath,
  isBlockedPath,
  categorizeAsset,
  getGitStatus,
  runFrameworkQualityGate,
  syncSuitesAndConfigs,
} = require('./gitSyncService');

test('gitSyncService security shield blocks sensitive and transient paths', () => {
  assert.equal(isBlockedPath('.env'), true);
  assert.equal(isBlockedPath('.env.local'), true);
  assert.equal(isBlockedPath('playwright-report/index.html'), true);
  assert.equal(isBlockedPath('test-results/video.webm'), true);
  assert.equal(isBlockedPath('evidence/screenshot.png'), true);
  assert.equal(isBlockedPath('.tmp/recording.mp4'), true);
  assert.equal(isBlockedPath('.dashboard-drafts/draft.json'), true);
  assert.equal(isBlockedPath('.dashboard-backups/backup.bak'), true);
  assert.equal(isBlockedPath('ai/personal/config.json'), true);
  assert.equal(isBlockedPath('scratch/test.js'), true);
  assert.equal(isBlockedPath('scratch/check_dang_tin.js'), true);
  assert.equal(isBlockedPath('tests/scratch/my_test.js'), true);
  assert.equal(isBlockedPath('tests/e2e/draft_login.spec.js'), true);
  assert.equal(isBlockedPath('tests/e2e/temp_verify.js'), true);
  assert.equal(isBlockedPath('tests/e2e/ai_quick.spec.js'), true);
  assert.equal(isBlockedPath('test_rec.js'), true);
  assert.equal(isBlockedPath('test_output.txt'), true);
  assert.equal(isBlockedPath('sub/test_output.txt'), true);
  assert.equal(isBlockedPath('run_output.txt'), true);
  assert.equal(isBlockedPath('tests/e2e/login-ai.spec.js'), true);
  assert.equal(isBlockedPath('tests/e2e/payment_ai.spec.ts'), true);
  assert.equal(isBlockedPath('tests/drafts/checkout.spec.js'), true);
  assert.equal(isBlockedPath('tests/dashboard/test-results/video.webm'), true);
  assert.equal(isBlockedPath('tests/e2e/admin-add-company.spec.js'), false);
});

test('gitSyncService whitelist permits core engineering and test assets', () => {
  assert.equal(isPermittedPath('tests/e2e/login.spec.js'), true);
  assert.equal(isPermittedPath('pages/desktop/LoginPage.js'), true);
  assert.equal(isPermittedPath('data/users.json'), true);
  assert.equal(isPermittedPath('core/generator/recordParser.js'), true);
  assert.equal(isPermittedPath('dashboard/public/index.html'), true);
  assert.equal(isPermittedPath('package.json'), true);
  assert.equal(isPermittedPath('playwright.config.js'), true);
  assert.equal(isPermittedPath('unknown/folder/file.bin'), false);
});

test('categorizeAsset classifies test scripts, page objects, data, and suites', () => {
  assert.equal(categorizeAsset('tests/e2e/sample.spec.js').category, 'test_script');
  assert.equal(categorizeAsset('pages/desktop/SamplePage.js').category, 'page_object');
  assert.equal(categorizeAsset('data/sampleData.json').category, 'test_data');
  assert.equal(categorizeAsset('core/config/dashboardConfig.json').category, 'test_suite');
});

test('getGitStatus returns branch, remote, and asset lists', () => {
  const status = getGitStatus();
  assert.equal(status.ok, true);
  assert.ok(status.currentBranch);
  assert.ok(Array.isArray(status.permittedFiles));
  assert.ok(Array.isArray(status.blockedFiles));
  assert.ok(Array.isArray(status.recentCommits));
});

test('runFrameworkQualityGate evaluates framework structure', () => {
  const qg = runFrameworkQualityGate();
  assert.equal(typeof qg.passed, 'boolean');
  assert.ok(Array.isArray(qg.issues));
  // Không khẳng định "dự án chủ nhà sạch" — đó là chất lượng code của từng dự án,
  // không phải hợp đồng của hàm này. File test này do Hub sở hữu và được sync xuống
  // mọi vệ tinh, trong khi `pages/` KHÔNG BAO GIỜ được sync: một vi phạm
  // page.waitForTimeout() ở vệ tinh sẽ làm test của Hub đỏ vĩnh viễn ở đó.
  // Điều cần kiểm là cổng báo cáo NHẤT QUÁN: passed <=> không có issue nào.
  assert.equal(qg.passed, qg.issues.length === 0);
});

test('syncSuitesAndConfigs dryRun executes safely without network modification', () => {
  const res = syncSuitesAndConfigs({ dryRun: true });
  assert.equal(res.ok, true);
  assert.equal(res.dryRun, true);
  assert.ok(res.message);
});
