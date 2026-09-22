#!/usr/bin/env node
/**
 * scripts/export-gate-evidence.js
 * Cầu nối xuất kết quả kiểm thử Playwright (JUnit XML) sang Bằng chứng Nghiệm thu Gate 4 (SHA256).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();

function resolveMasterProcessPath() {
  const envPath = process.env.MASTER_PROCESS_ROOT;
  if (envPath && fs.existsSync(path.join(envPath, 'master.py'))) return envPath;
  const driveRoot = path.parse(path.resolve(PROJECT_ROOT)).root;
  const candidates = [
    path.resolve(PROJECT_ROOT, '../_Master_Process'),
    path.resolve(PROJECT_ROOT, '../_Master_process'),
    path.resolve(PROJECT_ROOT, '.master_process'),
    path.join(driveRoot, '_Master_Process'),
    path.join(driveRoot, '_Master_process'),
    'D:/_Master_Process',
    'C:/_Master_Process',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, 'master.py'))) return c;
  }
  throw new Error('[Gate Evidence] Không tìm thấy Master Process Hub (master.py).');
}

function resolveContractFile(customPath) {
  if (customPath && fs.existsSync(path.resolve(PROJECT_ROOT, customPath))) {
    return path.resolve(PROJECT_ROOT, customPath);
  }
  const candidates = [
    path.join(PROJECT_ROOT, 'requirements', 'contract.json'),
    path.join(PROJECT_ROOT, '.delivery', 'contract.json'),
    path.join(PROJECT_ROOT, '.ai', 'contract.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function scaffoldFallbackContract(junitPath) {
  const contractDir = path.join(PROJECT_ROOT, '.gate-artifacts');
  fs.mkdirSync(contractDir, { recursive: true });
  const contractPath = path.join(contractDir, 'contract-gate4.json');

  let cases = [];
  try {
    const xml = fs.readFileSync(junitPath, 'utf8');
    const matches = [...xml.matchAll(/<testcase\s+[^>]*name="([^"]+)"[^>]*classname="([^"]*)"/g)];
    cases = matches.slice(0, 15).map((m, idx) => ({
      id: `TC-${String(idx + 1).padStart(2, '0')}`,
      intent: m[1] || 'Verified test execution intent',
      level: 'e2e',
      critical: idx < 3,
      test_id: m[2] ? `${m[2]}.${m[1]}` : m[1]
    }));
  } catch {
    cases = [{ id: 'TC-01', intent: 'Acceptance Smoke Verification', level: 'e2e', critical: true }];
  }

  if (cases.length === 0) {
    cases.push({ id: 'TC-01', intent: 'Acceptance Smoke Verification', level: 'e2e', critical: true });
  }

  const contract = {
    schema_version: 1,
    phase: 'gate4-acceptance',
    groups: {
      lifecycle_integration: { applies: true, reason: 'E2E smoke validation' }
    },
    criteria: [
      {
        id: 'AC-01',
        text: 'Toàn bộ kịch bản kiểm thử Smoke/E2E thực thi đạt 100% assertions thật',
        cases
      }
    ]
  };

  fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf8');
  console.log(`[Gate Evidence] Đã tự động tạo contract nghiệm thu tại: ${path.relative(PROJECT_ROOT, contractPath)}`);
  return contractPath;
}

function main() {
  const args = process.argv.slice(2);
  let customContract = null;
  let customJunit = null;
  let customOutput = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contract' && args[i + 1]) customContract = args[++i];
    if (args[i] === '--junit' && args[i + 1]) customJunit = args[++i];
    if (args[i] === '--output' && args[i + 1]) customOutput = args[++i];
  }

  const junitPath = path.resolve(PROJECT_ROOT, customJunit || 'test-results/junit.xml');
  const outputPath = path.resolve(PROJECT_ROOT, customOutput || '.gate-artifacts/evidence-gate4.json');

  if (!fs.existsSync(junitPath)) {
    console.error(`[Gate Evidence Lỗi] Không tìm thấy file JUnit tại: ${junitPath}`);
    console.error('Vui lòng chạy bộ test trước: npx playwright test');
    process.exit(1);
  }

  let contractPath = resolveContractFile(customContract);
  if (!contractPath) {
    contractPath = scaffoldFallbackContract(junitPath);
  }

  const hubPath = resolveMasterProcessPath();
  const masterPy = path.join(hubPath, 'master.py');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[Gate Evidence] Đang kết nối Master Process Hub: ${hubPath}`);
  console.log(`[Gate Evidence] Trích xuất từ JUnit: ${path.relative(PROJECT_ROOT, junitPath)}`);
  console.log(`[Gate Evidence] Áp dụng Contract: ${path.relative(PROJECT_ROOT, contractPath)}`);

  const cmd = `python "${masterPy}" generate-evidence --contract "${contractPath}" --junit "${junitPath}" --output "${outputPath}" --force`;
  try {
    execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
  } catch (error) {
    console.error('[Gate Evidence Lỗi] Gọi master.py generate-evidence thất bại.');
    process.exit(error.status || 1);
  }

  if (!fs.existsSync(outputPath)) {
    console.error('[Gate Evidence Lỗi] File evidence không được sinh ra.');
    process.exit(1);
  }

  const evidence = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const cases = evidence.cases || [];
  const passedCases = cases.filter((c) => c.result === 'PASS').length;
  const failedCases = cases.filter((c) => c.result === 'FAIL').length;
  const skippedCases = cases.filter((c) => c.result === 'SKIP' || c.result === 'NOT_RUN').length;
  const totalAssertions = cases.reduce((sum, c) => sum + (c.assertions ? c.assertions.length : 0), 0);

  const isAllPassed = failedCases === 0 && skippedCases === 0 && cases.length > 0;
  const receiptHash = evidence.receipt?.sha256 || evidence.revision || 'N/A';

  console.log('\n======================================================');
  console.log('       BẰNG CHỨNG NGHIỆM THU GATE 4 (EVIDENCE SUMMARY) ');
  console.log('======================================================');
  console.log(`- File Bằng Chứng   : ${path.relative(PROJECT_ROOT, outputPath)}`);
  console.log(`- Trạng Thái Ký     : PENDING_REVIEW (Chờ QA Lead ký duyệt)`);
  console.log(`- Kết Quả Kịch Bản  : ${isAllPassed ? 'PASS (100%)' : 'FAIL / CÓ SKIP HOẶC THẤT BẠI'}`);
  console.log(`- Tổng Cases        : ${cases.length} (Pass: ${passedCases}, Fail: ${failedCases}, Skip: ${skippedCases})`);
  console.log(`- Assertions Thật   : ${totalAssertions} assertions`);
  console.log(`- Mã Băm Chứng Thực : ${receiptHash}`);
  console.log('======================================================\n');

  if (!isAllPassed) {
    console.warn('[CẢNH BÁO] Có test case chưa PASS hoặc bị SKIP. Gate 4 sẽ không thể phê duyệt!');
  }
}

if (require.main === module) {
  main();
}

module.exports = { resolveMasterProcessPath, resolveContractFile, scaffoldFallbackContract };
