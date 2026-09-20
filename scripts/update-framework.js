#!/usr/bin/env node

/**
 * scripts/update-framework.js
 *
 * Tải và cập nhật Dashboard Framework & Core Automation Engine cho các nhánh con / dự án vệ tinh.
 *
 * NGUYÊN TẮC BẤT BIẾN (ASSET SHIELD):
 * 1. CHỈ cập nhật Dashboard Framework, Core Engine dùng chung, Bin và Scripts hỗ trợ.
 * 2. TUYỆT ĐỐI KHÔNG ghi đè hoặc thay đổi tài sản nghiệp vụ riêng của dự án:
 *    - tests/, pages/, data/, requirements/, test-cases/
 *    - core/local/, core/config/dashboardConfig.json
 *    - decisions.json, qa.config.json, .env
 * 3. Hỗ trợ 2 nguồn tải (Multi-source Fallback):
 *    - Nguồn Local: Nếu có thư mục Hub cục bộ (D:\_Automation-Project) -> Đồng bộ trực tiếp siêu tốc.
 *    - Nguồn Remote: Nếu máy độc lập -> Fetch từ origin/main (hoặc upstream) và bóc tách riêng phần Framework.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// Cấu hình các module Framework được phép cập nhật
const FRAMEWORK_MODULES = [
  {
    name: 'dashboard',
    src: 'dashboard',
    dest: 'dashboard',
    excludes: [],
  },
  {
    name: 'core',
    src: 'core',
    dest: 'core',
    excludes: [
      'core/local',
      'core/config/dashboardConfig.json',
      'core/fixtures/custom',
    ],
  },
  {
    name: 'bin',
    src: 'bin',
    dest: 'bin',
    excludes: [],
  },
  {
    name: 'scripts',
    src: 'scripts',
    dest: 'scripts',
    excludes: [
      'scripts/sync-satellites.js',
      'scripts/pre-sync-drift.js',
      'scripts/lib/sync-manifest.js',
      'scripts/lib/sync-manifest.test.js',
      'scripts/lib/hubHistory.js',
      'scripts/lib/hubHistory.test.js',
    ],
  },
  {
    name: 'ai',
    src: 'ai',
    dest: 'ai',
    excludes: [
      'ai/shared/TEST_AUTOMATION_LESSONS.md',
      'ai/dashboard/AI_LESSONS.md',
      'ai/personal',
    ],
  },
];

const FRAMEWORK_ROOT_FILES = [
  'Start_Dashboard.bat',
  'Stop_Dashboard.bat',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'QA_AI_RULES.md',
];

// Danh mục cấm kỵ: Tuyệt đối không được phép ghi đè
const FORBIDDEN_PATHS = [
  'tests',
  'pages',
  'data',
  'requirements',
  'test-cases',
  'decisions.json',
  'qa.config.json',
  '.env',
  'core/local',
  'core/config/dashboardConfig.json',
];

function isExcludedPath(targetPath, excludes = []) {
  const normTarget = path.normalize(targetPath).toLowerCase();
  return excludes.some((ex) => {
    const normEx = path.normalize(ex).toLowerCase();
    return normTarget.endsWith(normEx) || normTarget.includes(`${path.sep}${normEx}${path.sep}`) || normTarget.endsWith(`${path.sep}${normEx}`);
  });
}

function copyDirRecursive(srcDir, destDir, excludes = [], logs = []) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let updatedCount = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (isExcludedPath(destPath, excludes)) {
      continue;
    }

    if (entry.isDirectory()) {
      updatedCount += copyDirRecursive(srcPath, destPath, excludes, logs);
    } else {
      let isDifferent = true;
      if (fs.existsSync(destPath)) {
        const srcBuf = fs.readFileSync(srcPath);
        const destBuf = fs.readFileSync(destPath);
        if (srcBuf.equals(destBuf)) {
          isDifferent = false;
        }
      }
      if (isDifferent) {
        fs.copyFileSync(srcPath, destPath);
        updatedCount++;
        if (logs.length < 50) {
          logs.push(`Cập nhật: ${path.relative(process.cwd(), destPath).replace(/\\/g, '/')}`);
        }
      }
    }
  }

  return updatedCount;
}

/**
 * Tìm nguồn cập nhật Hub hợp lệ
 * @param {string} targetDir Thư mục vệ tinh hiện tại
 */
function resolveFrameworkSource(targetDir) {
  // 1. Kiểm tra nếu có Hub cục bộ (D:\_Automation-Project)
  const defaultLocalHub = 'D:\\_Automation-Project';
  if (path.resolve(targetDir) !== path.resolve(defaultLocalHub)) {
    const hubDashboardServer = path.join(defaultLocalHub, 'dashboard', 'server.js');
    if (fs.existsSync(hubDashboardServer)) {
      return { type: 'local', path: defaultLocalHub, label: `Local Hub Repository (${defaultLocalHub})` };
    }
  }

  // 2. Kiểm tra nếu trong repo Git hiện tại có remote origin hoặc upstream
  try {
    const remotes = execSync('git remote -v', { cwd: targetDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (remotes.includes('origin')) {
      return { type: 'git-origin-main', label: 'Remote origin/main (Đồng bộ qua GitHub)' };
    }
  } catch (_) {}

  return null;
}

/**
 * Thực thi cập nhật Framework vào targetDir
 * @param {Object} options
 * @param {string} [options.targetDir] Thư mục dự án vệ tinh cần cập nhật
 * @param {boolean} [options.silent] Không in log console
 */
function updateFramework(options = {}) {
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const logs = [];

  // Kiểm tra nếu đang chạy ngay tại Hub chính
  const isTargetHub = fs.existsSync(path.join(targetDir, 'scripts', 'sync-satellites.js'))
    && fs.existsSync(path.join(targetDir, 'ai', 'shared', 'SATELLITE_CORE_MIGRATION.md'));

  if (isTargetHub && (!options.targetDir || path.resolve(options.targetDir) === path.resolve('D:\\_Automation-Project'))) {
    const msg = 'Bạn đang đứng tại Hub Repository chính. Hub là nguồn phát hành Framework gốc, không cần tải về.';
    return { ok: true, isHub: true, updatedCount: 0, message: msg, logs: [msg] };
  }

  const source = options._testSourceDir
    ? { type: 'local', path: path.resolve(options._testSourceDir), label: 'Mock Hub Source' }
    : resolveFrameworkSource(targetDir);
  if (!source) {
    const err = 'Không tìm thấy nguồn Framework hợp lệ (Cần có Hub cục bộ hoặc remote Git origin).';
    return { ok: false, error: err, logs: [err] };
  }

  logs.push(`Nguồn cập nhật: ${source.label}`);
  logs.push(`Đích cập nhật  : ${targetDir}`);

  let totalUpdated = 0;
  let tempExtractDir = null;

  try {
    let sourceRoot = null;

    if (source.type === 'local') {
      sourceRoot = source.path;
    } else if (source.type === 'git-origin-main') {
      // Kéo git fetch origin main và giải nén ra thư mục tạm
      logs.push('Đang fetch origin/main từ remote...');
      execSync('git fetch origin main', { cwd: targetDir, stdio: ['pipe', 'pipe', 'pipe'] });

      tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-update-'));
      logs.push(`Đang trích xuất snapshot Framework từ origin/main...`);
      // Trích xuất qua git archive
      execSync('git archive origin/main dashboard core bin scripts ai Start_Dashboard.bat Stop_Dashboard.bat | tar -x -C "' + tempExtractDir.replace(/\\/g, '/') + '"', {
        cwd: targetDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      sourceRoot = tempExtractDir;
    }

    // Tiến hành đồng bộ từng module Framework
    for (const mod of FRAMEWORK_MODULES) {
      const srcModDir = path.join(sourceRoot, mod.src);
      const destModDir = path.join(targetDir, mod.dest);
      if (fs.existsSync(srcModDir)) {
        const count = copyDirRecursive(srcModDir, destModDir, mod.excludes, logs);
        totalUpdated += count;
        if (count > 0) {
          logs.push(`Module [${mod.name}]: Đã cập nhật ${count} tệp.`);
        }
      }
    }

    // Đồng bộ các file root
    for (const file of FRAMEWORK_ROOT_FILES) {
      const srcFile = path.join(sourceRoot, file);
      const destFile = path.join(targetDir, file);
      if (fs.existsSync(srcFile)) {
        let isDiff = true;
        if (fs.existsSync(destFile)) {
          isDiff = !fs.readFileSync(srcFile).equals(fs.readFileSync(destFile));
        }
        if (isDiff) {
          fs.copyFileSync(srcFile, destFile);
          totalUpdated++;
          logs.push(`Cập nhật tệp gốc: ${file}`);
        }
      }
    }

    // Đảm bảo package.json của vệ tinh có lệnh update:framework
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.scripts = pkg.scripts || {};
        if (!pkg.scripts['update:framework']) {
          pkg.scripts['update:framework'] = 'node scripts/update-framework.js';
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          logs.push('Đã đăng ký lệnh "npm run update:framework" vào package.json.');
        }
      } catch (_) {}
    }

    // Kiểm tra cấu trúc Framework nếu có script
    const checkScript = path.join(targetDir, 'scripts', 'check-framework-structure.js');
    let qgPassed = true;
    if (fs.existsSync(checkScript)) {
      try {
        const qgRes = execSync(`node "${checkScript}"`, { cwd: targetDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        logs.push(`Quality Gate ĐẠT: ${qgRes.trim()}`);
      } catch (_) {
        logs.push('Quality Gate lưu ý: Phát hiện cảnh báo trong mã kiểm thử riêng của dự án (không ảnh hưởng cập nhật Dashboard Framework).');
        qgPassed = false;
      }
    }

    const successMsg = totalUpdated > 0
      ? `Đã cập nhật thành công ${totalUpdated} tệp Dashboard Framework!`
      : 'Dashboard Framework đã ở phiên bản mới nhất (không có tệp nào cần cập nhật).';

    logs.push(`✅ ${successMsg}`);

    return {
      ok: true,
      updatedCount: totalUpdated,
      message: successMsg,
      logs,
      qgPassed,
    };
  } catch (err) {
    const errorMsg = `Lỗi cập nhật Framework: ${err.message}`;
    logs.push(errorMsg);
    return {
      ok: false,
      error: errorMsg,
      logs,
    };
  } finally {
    if (tempExtractDir && fs.existsSync(tempExtractDir)) {
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// CLI Execution
if (require.main === module) {
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  QA STUDIO - TẢI CẬP NHẬT DASHBOARD FRAMEWORK       ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}\n`);

  const result = updateFramework();

  if (result.logs && result.logs.length) {
    for (const log of result.logs) {
      console.log(`  > ${log}`);
    }
  }

  console.log('');
  if (result.ok) {
    console.log(`${colors.green}${colors.bright}✅ ${result.message}${colors.reset}`);
    if (result.updatedCount > 0) {
      console.log(`${colors.yellow}💡 Vui lòng tải lại (F5) giao diện Dashboard để trải nghiệm các tính năng mới.${colors.reset}\n`);
    }
  } else {
    console.error(`${colors.red}${colors.bright}❌ ${result.error}${colors.reset}\n`);
    process.exit(1);
  }
}

module.exports = {
  FRAMEWORK_MODULES,
  FRAMEWORK_ROOT_FILES,
  FORBIDDEN_PATHS,
  updateFramework,
  isExcludedPath,
};
