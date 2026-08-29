const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const reportRoot = path.resolve(process.cwd(), 'playwright-report');
const reports = [];

function collectReports(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectReports(absolutePath);
    if (
      entry.isFile() &&
      entry.name === 'index.html' &&
      !absolutePath.includes(`${path.sep}workers${path.sep}`)
    ) {
      reports.push({
        folder: path.dirname(absolutePath),
        modifiedAt: fs.statSync(absolutePath).mtimeMs,
      });
    }
  }
}

collectReports(reportRoot);
const latestReport = reports.sort((a, b) => b.modifiedAt - a.modifiedAt)[0];

if (!latestReport) {
  console.error('Không tìm thấy Playwright report nào.');
  process.exit(1);
}

console.log(`Mở report mới nhất: ${path.relative(process.cwd(), latestReport.folder)}`);
const playwrightCli = require.resolve('@playwright/test/cli');
const result = spawnSync(process.execPath, [playwrightCli, 'show-report', latestReport.folder], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
