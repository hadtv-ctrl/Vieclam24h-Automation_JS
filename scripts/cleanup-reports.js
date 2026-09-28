/**
 * scripts/cleanup-reports.js
 * Xóa các thư mục report và evidence cũ hơn N ngày (configurable qua dashboardConfig).
 *
 * Sử dụng:
 *   node scripts/cleanup-reports.js [--days N] [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'playwright-report');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'evidence');
const TEST_RESULTS_DIR = path.join(ROOT_DIR, 'test-results');

function getRetentionDays() {
  // Ưu tiên CLI arg --days N
  const daysArgIndex = process.argv.indexOf('--days');
  if (daysArgIndex !== -1 && process.argv[daysArgIndex + 1]) {
    const days = parseInt(process.argv[daysArgIndex + 1], 10);
    if (Number.isInteger(days) && days > 0) return days;
  }

  // Fallback: đọc từ dashboardConfig
  try {
    const { getDashboardConfig } = require(path.join(ROOT_DIR, 'core/config/dashboardConfig'));
    const config = getDashboardConfig();
    return config.artifacts?.retentionDays || 14;
  } catch (_) {
    return 14;
  }
}

function isDryRun() {
  return process.argv.includes('--dry-run');
}

/**
 * Xóa đệ quy các thư mục con có tên dạng ngày (YY-MM-DD) cũ hơn retention
 */
function cleanDateBasedDirs(parentDir, retentionMs, dryRun) {
  if (!fs.existsSync(parentDir)) return 0;

  const now = Date.now();
  let cleaned = 0;

  const entries = fs.readdirSync(parentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Thử parse tên thư mục dạng YY-MM-DD
    const match = /^(\d{2})-(\d{2})-(\d{2})$/.exec(entry.name);
    if (!match) continue;

    const [, yy, mm, dd] = match;
    const year = 2000 + parseInt(yy, 10);
    const month = parseInt(mm, 10) - 1;
    const day = parseInt(dd, 10);
    const dirDate = new Date(year, month, day).getTime();

    if (isNaN(dirDate)) continue;

    if (now - dirDate > retentionMs) {
      const fullPath = path.join(parentDir, entry.name);
      if (dryRun) {
        console.log(`[DRY-RUN] Sẽ xóa: ${fullPath}`);
      } else {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`Đã xóa: ${fullPath}`);
        } catch (err) {
          console.warn(`Lỗi khi xóa ${fullPath}: ${err.message}`);
        }
      }
      cleaned++;
    }
  }

  return cleaned;
}

// Main
const retentionDays = getRetentionDays();
const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
const dryRun = isDryRun();

console.log(`\n[cleanup-reports] Retention: ${retentionDays} ngày | Mode: ${dryRun ? 'DRY-RUN' : 'THỰC THI'}\n`);

let total = 0;
total += cleanDateBasedDirs(REPORT_DIR, retentionMs, dryRun);
total += cleanDateBasedDirs(EVIDENCE_DIR, retentionMs, dryRun);
total += cleanDateBasedDirs(TEST_RESULTS_DIR, retentionMs, dryRun);

console.log(`\n[cleanup-reports] Tổng: ${total} thư mục ${dryRun ? 'sẽ bị' : 'đã'} xóa.\n`);
