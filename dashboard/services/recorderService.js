/**
 * dashboard/services/recorderService.js
 * Manages Playwright Codegen recorder processes and recordings directory.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function killRecorderProcess(recorder) {
  if (!recorder?.child) return;
  const pid = recorder.child.pid;
  try {
    if (process.platform === 'win32' && pid) {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore', windowsHide: true });
    } else if (recorder.child) {
      recorder.child.kill('SIGTERM');
    }
  } catch (_) {}
}

function normalizeTargetUrl(rawUrl, fallback = 'https://example.com') {
  let urlStr = (rawUrl || '').trim();
  if (!urlStr) return fallback;
  if (!/^https?:\/\//i.test(urlStr)) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(urlStr)) {
      urlStr = 'http://' + urlStr;
    } else {
      urlStr = 'https://' + urlStr;
    }
  }
  return urlStr;
}

function ensureRecordingsDir(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const dir = path.join(root, '.tmp', 'recordings');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listRecentRecordings(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const dir = ensureRecordingsDir(root);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return {
        fileName: entry.name,
        path: `.tmp/recordings/${entry.name}`,
        size: fs.statSync(fullPath).size,
        modifiedAt: new Date(fs.statSync(fullPath).mtimeMs).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

module.exports = {
  isProcessAlive,
  killRecorderProcess,
  normalizeTargetUrl,
  ensureRecordingsDir,
  listRecentRecordings
};
