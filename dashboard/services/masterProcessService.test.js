const assert = require('assert');
const path = require('path');
const {
  detectMasterRoot,
  validateProjectPath,
  getProjectStatus,
  runMasterAction,
  syncProject,
} = require('./masterProcessService');
const { runCommand } = require('./masterProcessUtils');

async function testMasterProcessService() {
  const projectRoot = path.resolve(__dirname, '../..');
  console.log('Testing Master Process Service with projectRoot:', projectRoot);

  // Test 1: detectMasterRoot
  const hubRoot = detectMasterRoot(projectRoot);
  assert(hubRoot, 'detectMasterRoot should return a valid path');
  console.log('  [PASS] detectMasterRoot:', hubRoot);

  // Test 2: validateProjectPath (Whitelist validation)
  const validPath = validateProjectPath(projectRoot);
  assert.strictEqual(path.resolve(validPath), path.resolve(projectRoot));
  assert.throws(() => {
    validateProjectPath('C:\\Windows\\System32');
  }, (err) => err.statusCode === 403, 'Should reject non-whitelisted path with 403');
  console.log('  [PASS] validateProjectPath rejects non-whitelisted paths with 403');

  // Test 3: Subprocess Timeout & Kill handling
  const start = Date.now();
  const resTimeout = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], projectRoot, { timeout: 300 });
  const elapsed = Date.now() - start;
  assert(elapsed < 4000, `Process should be terminated promptly, took ${elapsed}ms`);
  assert(resTimeout.timedOut === true || resTimeout.code === 124, 'Result should indicate timeout');
  console.log(`  [PASS] Subprocess timeout enforced in ${elapsed}ms with timedOut: true`);

  // Test 4: getProjectStatus
  const status = await getProjectStatus(projectRoot);
  assert(status.available, 'Status should be available');
  assert(status.drift_status, 'Status should have drift_status');
  assert(typeof status.quality?.candidates_lines === 'number', 'Status should contain quality metrics');
  console.log('  [PASS] getProjectStatus drift_status:', status.drift_status, 'candidates:', status.quality.candidates_lines);

  // Test 5: Mutex Execution Lock (Conflict 409)
  const p1 = runMasterAction(projectRoot, 'doctor');
  const p2 = await runMasterAction(projectRoot, 'doctor');
  assert.strictEqual(p2.code, 409, 'Parallel execution should return conflict 409');
  assert.strictEqual(p2.ok, false, 'Parallel execution should not succeed');
  await p1; // wait for first to complete
  console.log('  [PASS] Mutex prevents concurrent executions with 409 conflict');

  // Test 6: Sync with dryRun
  const syncDry = await syncProject(projectRoot, { dryRun: true });
  assert(typeof syncDry.code === 'number', 'sync dryRun should execute and return exit code');
  console.log('  [PASS] syncProject with dryRun executed successfully, code:', syncDry.code);

  console.log('\nAll Master Process Service tests passed 100%!');
}

testMasterProcessService().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
