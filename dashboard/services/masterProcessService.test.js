const assert = require('assert');
const path = require('path');
const {
  detectMasterRoot,
  getProjectStatus,
  runAudit,
} = require('./masterProcessService');

async function testMasterProcessService() {
  const projectRoot = path.resolve(__dirname, '../..');
  console.log('Testing Master Process Service with projectRoot:', projectRoot);

  // Test 1: detectMasterRoot
  const hubRoot = detectMasterRoot(projectRoot);
  assert(hubRoot, 'detectMasterRoot should return a valid path');
  console.log('  [PASS] detectMasterRoot detected:', hubRoot);

  // Test 2: getProjectStatus
  const status = await getProjectStatus(projectRoot);
  assert(status.available, 'Status should be available');
  assert(status.drift_status, 'Status should have drift_status');
  assert(status.hook_status, 'Status should have hook_status');
  console.log('  [PASS] getProjectStatus drift_status:', status.drift_status, 'hook_status:', status.hook_status);

  // Test 3: runAudit
  const audit = await runAudit(projectRoot);
  assert(typeof audit.code === 'number', 'Audit should return an exit code');
  assert(audit.scanned > 0, 'Scanned files should be > 0');
  assert(typeof audit.violations === 'number', 'Violations should be a number');
  console.log(`  [PASS] runAudit scanned=${audit.scanned}, violations=${audit.violations}, exempted=${audit.exempted}`);

  console.log('All masterProcessService tests passed successfully!');
}

testMasterProcessService().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
