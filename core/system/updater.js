const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync, spawnSync } = require('child_process');

const ENGINE_DIR = path.resolve(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(ENGINE_DIR, 'package.json');

const GIT_EXECUTABLE = (() => {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\mingw64\\bin\\git.exe',
      'C:\\Program Files\\Git\\cmd\\git.exe',
      'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
      'C:\\Program Files (x86)\\Git\\mingw64\\bin\\git.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'mingw64', 'bin', 'git.exe'),
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
  }
  return 'git';
})();

/**
 * Chạy lệnh git an toàn: trực tiếp binary git với windowsHide: true,
 * tuyệt đối không bao giờ chớp tắt cửa sổ dòng lệnh cmd.exe trên Windows.
 */
function safeGit(args, options = {}) {
  const timeout = options.timeout || 15000;
  const env = { ...process.env, PAGER: 'cat' };
  const res = spawnSync(GIT_EXECUTABLE, args, {
    cwd: options.cwd || ENGINE_DIR,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    ...options,
  });

  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || `Git exited with code ${res.status}`).trim();
    const err = new Error(msg);
    err.status = res.status;
    err.stdout = res.stdout;
    err.stderr = res.stderr;
    throw err;
  }
  return res.stdout || '';
}

/**
 * Lấy thông tin phiên bản hiện tại từ package.json của Engine
 */
function getCurrentVersion() {
  try {
    if (fs.existsSync(PACKAGE_JSON_PATH)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
      return pkg.version || '1.0.0';
    }
  } catch (_) {}
  return '1.0.0';
}

/**
 * So sánh 2 chuỗi phiên bản dạng SemVer (vd: 1.2.0 vs 1.1.0)
 * Trả về: > 0 nếu v1 > v2, < 0 nếu v1 < v2, 0 nếu bằng nhau
 */
function compareSemVer(v1, v2) {
  const parse = (v) => String(v).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
  const parts1 = parse(v1);
  const parts2 = parse(v2);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Gửi HTTP/HTTPS request với timeout
 */
function fetchJson(targetUrl, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.get(
        urlObj,
        {
          headers: {
            'User-Agent': 'QA-Automation-Dashboard-Updater/1.0',
            'Accept': 'application/json',
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchJson(res.headers.location, timeoutMs));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP Status ${res.statusCode}`));
          }
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error('Phản hồi từ máy chủ không phải JSON hợp lệ'));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Kết nối tới máy chủ cập nhật bị timeout (quá thời gian chờ).'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Kiểm tra xem có bản cập nhật Framework qua Git (origin/main hoặc Hub) hay không
 */
function checkGitFrameworkUpdates(rootDir = ENGINE_DIR) {
  const isGitRepo = fs.existsSync(path.join(rootDir, '.git'));
  if (!isGitRepo) return null;

  // Nếu đang ở Hub chính thì không tự báo update của chính mình
  const isHub = fs.existsSync(path.join(rootDir, 'scripts', 'sync-satellites.js'))
    && fs.existsSync(path.join(rootDir, 'ai', 'shared', 'SATELLITE_CORE_MIGRATION.md'));

  // 1. ƯU TIÊN KIỂM TRA NGUỒN LOCAL HUB (D:\_Automation-Project)
  // Vì updateFramework ưu tiên lấy từ Local Hub nên nguồn check cũng phải ưu tiên Local Hub để đồng nhất
  try {
    const localHub = 'D:\\_Automation-Project';
    if (!isHub && path.resolve(rootDir) !== path.resolve(localHub) && fs.existsSync(path.join(localHub, 'dashboard', 'server.js'))) {
      const hubHead = safeGit(['rev-parse', '--short', 'HEAD'], { cwd: localHub }).trim();
      const hubLastLog = safeGit(['log', '-n', '3', '--oneline', '--', 'dashboard', 'core', 'bin', 'scripts'], { cwd: localHub }).trim();

      // Kiểm tra file mẫu trong dashboard xem có khác biệt không
      const sampleFiles = [
        path.join('dashboard', 'public', 'js', 'views', 'qa', 'qaSlice.js'),
        path.join('dashboard', 'public', 'app.js'),
        path.join('dashboard', 'public', 'templates', 'qa.html'),
        path.join('dashboard', 'public', 'styles', 'views', 'qa.css'),
        path.join('dashboard', 'routes', 'qaRoutes.js'),
        path.join('dashboard', 'server.js'),
      ];

      const isDifferent = sampleFiles.some((f) => {
        const pHub = path.join(localHub, f);
        const pSat = path.join(rootDir, f);
        if (!fs.existsSync(pSat) && fs.existsSync(pHub)) return true;
        if (fs.existsSync(pSat) && !fs.existsSync(pHub)) return true;
        return !fs.readFileSync(pHub).equals(fs.readFileSync(pSat));
      });

      if (isDifferent) {
        return {
          hasUpdate: true,
          source: 'local-hub',
          latestVersion: `Hub commit ${hubHead}`,
          releaseName: 'Bản cập nhật Dashboard Framework mới từ Hub',
          releaseNotes: `Các cập nhật mới nhất từ Hub cục bộ:\n${hubLastLog}`,
        };
      }

      // Đã khớp 100% với Local Hub -> Không có bản cập nhật mới
      return {
        hasUpdate: false,
        source: 'local-hub',
        latestVersion: `Hub commit ${hubHead}`,
        message: 'Dashboard Framework đã đồng bộ hoàn toàn với Hub cục bộ.',
      };
    }
  } catch (_) {}

  // 2. Nếu không có Local Hub hoặc ở môi trường riêng, kiểm tra qua remote origin/main
  try {
    const remotes = safeGit(['remote'], { cwd: rootDir });
    if (remotes.includes('origin')) {
      try {
        safeGit(['fetch', 'origin', 'main', '--quiet'], { cwd: rootDir, timeout: 10000 });
      } catch (_) {}

      // Kiểm tra xem origin/main có thực sự có file thay đổi so với HEAD hay không
      let hasFileDiff = false;
      try {
        const diffStat = safeGit(['diff', '--name-only', 'HEAD', 'origin/main', '--', 'dashboard', 'core', 'bin', 'scripts'], {
          cwd: rootDir,
        }).trim();
        if (diffStat) {
          hasFileDiff = true;
        }
      } catch (_) {}

      const diffCommits = safeGit(['log', 'HEAD..origin/main', '--oneline', '-n', '5', '--', 'dashboard', 'core', 'bin', 'scripts'], {
        cwd: rootDir,
      }).trim();

      if (hasFileDiff && diffCommits) {
        const latestCommit = safeGit(['rev-parse', '--short', 'origin/main'], { cwd: rootDir }).trim();
        return {
          hasUpdate: true,
          source: 'origin-main',
          latestVersion: `Commit ${latestCommit}`,
          releaseName: 'Bản cập nhật Dashboard Framework mới trên origin/main',
          releaseNotes: `Các commit mới nhất từ Hub đã được chuyển giao sang origin/main:\n${diffCommits}`,
        };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Kiểm tra xem có bản cập nhật mới hay không
 * @param {Object} options
 * @param {string} [options.updateUrl] URL manifest hoặc GitHub API release
 * @param {string} [options.githubRepo] Ví dụ: "hadinhkms/Automation_playwright_SV"
 */
async function checkForUpdates(options = {}) {
  const currentVersion = getCurrentVersion();
  const rootDir = options.rootDir || ENGINE_DIR;

  // 1. Ưu tiên kiểm tra bản cập nhật Git Framework (áp dụng cho các vệ tinh & nhánh con)
  const gitUpdate = checkGitFrameworkUpdates(rootDir);
  if (gitUpdate && gitUpdate.hasUpdate) {
    return {
      ok: true,
      hasUpdate: true,
      isGitFrameworkUpdate: true,
      currentVersion,
      latestVersion: gitUpdate.latestVersion,
      releaseName: gitUpdate.releaseName,
      releaseNotes: gitUpdate.releaseNotes,
      publishedAt: new Date().toISOString(),
      downloadUrl: `https://github.com/${options.githubRepo || 'hadinhkms/Automation_playwright_SV'}`,
      isOffline: false,
    };
  }

  // 2. Kiểm tra qua GitHub Releases (dành cho chế độ độc lập/release SemVer)
  const githubRepo = options.githubRepo || 'hadinhkms/Automation_playwright_SV';
  const updateUrl = options.updateUrl || `https://api.github.com/repos/${githubRepo}/releases/latest`;

  try {
    const releaseData = await fetchJson(updateUrl);
    const latestVersion = releaseData.tag_name ? releaseData.tag_name.replace(/^v/i, '') : (releaseData.version || currentVersion);
    const hasUpdate = compareSemVer(latestVersion, currentVersion) > 0;

    return {
      ok: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseName: releaseData.name || `Phiên bản v${latestVersion}`,
      releaseNotes: releaseData.body || releaseData.description || 'Bản cập nhật tối ưu hóa tính năng và sửa lỗi hệ thống.',
      publishedAt: releaseData.published_at || new Date().toISOString(),
      downloadUrl: releaseData.html_url || `https://github.com/${githubRepo}`,
      isOffline: false,
    };
  } catch (err) {
    if (String(err.message).includes('404')) {
      return {
        ok: true,
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        isOffline: false,
        message: `Bạn đang sử dụng phiên bản mới nhất (v${currentVersion}). Chưa có bản phát hành mới trên máy chủ.`,
      };
    }
    // Trường hợp thực sự không có mạng (ENOTFOUND, ETIMEDOUT, timeout, etc.)
    return {
      ok: false,
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      isOffline: true,
      error: err.message,
      message: 'Không thể kết nối Internet hoặc máy chủ cập nhật bị quá hạn. Đang chạy ở chế độ ngoại tuyến.',
    };
  }
}

/**
 * Thực hiện lệnh cập nhật (Tùy theo cấu hình dự án là Git repo hay NPM package)
 */
function applyUpdate(options = {}) {
  const root = options.rootDir || ENGINE_DIR;
  const isGitRepo = fs.existsSync(path.join(root, '.git'));
  const log = [];

  try {
    if (isGitRepo) {
      log.push('Phát hiện chế độ Git repository. Đang áp dụng cập nhật Dashboard Framework an toàn (Asset Shield)...');
      try {
        const { updateFramework } = require('../../scripts/update-framework');
        const fwResult = updateFramework({ targetDir: root });
        if (Array.isArray(fwResult.logs)) {
          fwResult.logs.forEach((l) => log.push(l));
        }
        return {
          ok: fwResult.ok,
          message: fwResult.message || 'Đã cập nhật Framework thành công!',
          logs: log,
          newVersion: getCurrentVersion(),
        };
      } catch (fwErr) {
        log.push('Cảnh báo updateFramework: ' + fwErr.message + '. Thử lại với git pull...');
      }

      const pullOutput = safeGit(['pull', '--ff-only'], { cwd: root, timeout: 30000 });
      log.push(pullOutput.trim());
      log.push('Đang cập nhật dependencies...');
      try {
        const npmOutput = execSync('npm install --prefer-offline', { cwd: ENGINE_DIR, encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        log.push('Dependencies đã được cập nhật.');
      } catch (npmErr) {
        log.push('Cảnh báo npm install: ' + npmErr.message);
      }
    } else {
      log.push('Phát hiện chế độ NPM package. Đang chạy lệnh npm update...');
      const pkgName = options.packageName || '@hadinhkms/qa-engine';
      const updateOutput = execSync(`npm install ${pkgName}@latest`, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      log.push(updateOutput.trim());
    }

    return {
      ok: true,
      message: 'Đã hoàn tất cập nhật phiên bản mới. Vui lòng khởi động lại Dashboard để áp dụng thay đổi.',
      logs: log,
      newVersion: getCurrentVersion(),
    };
  } catch (err) {
    return {
      ok: false,
      message: 'Cập nhật thất bại: ' + (err.stderr || err.message),
      logs: log,
      error: err.message,
    };
  }
}

module.exports = {
  getCurrentVersion,
  compareSemVer,
  checkForUpdates,
  applyUpdate,
};
