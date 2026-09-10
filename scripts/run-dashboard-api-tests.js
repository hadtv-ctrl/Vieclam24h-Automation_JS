/**
 * scripts/run-dashboard-api-tests.js
 * Enumerates all test files in tests/dashboard-api/ and invokes node --test
 * safely without depending on shell glob interpolation on Windows.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const apiTestsDir = path.resolve(__dirname, '../tests/dashboard-api');
if (!fs.existsSync(apiTestsDir)) {
  console.error(`Tests directory not found: ${apiTestsDir}`);
  process.exit(1);
}

const testFiles = fs.readdirSync(apiTestsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(apiTestsDir, f));

if (testFiles.length === 0) {
  console.error('No API test files found.');
  process.exit(1);
}

console.log(`Discovered ${testFiles.length} API test files in tests/dashboard-api/`);
testFiles.forEach((f) => console.log(` - ${path.basename(f)}`));

const args = ['--test', ...testFiles];
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

process.exit(result.status ?? 0);
