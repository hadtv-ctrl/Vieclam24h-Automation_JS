/**
 * dashboard/services/masterProcessUtils.js
 * Tiện ích hỗ trợ Master Process: Whitelist Path Validation,
 * Master Root Detection, Subprocess Execution có Timeout 60s, Graceful Kill và windowsHide.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ALLOWED_PROJECT_ROOTS = [
  'D:\\_Automation-Project',
  'D:/_Automation-Project',
  'D:\\_Master_Process',
  'D:/_Master_Process',
  'D:\\_SieuVietGroup',
  'D:/_SieuVietGroup',
  'D:\\_CarThings\\Automation_Carthings',
  'D:/_CarThings/Automation_Carthings',
];

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function validateProjectPath(targetPath, fallbackRoot) {
  const chosen = targetPath || fallbackRoot || process.cwd();
  const resolved = path.resolve(chosen);
  const normalized = normalizePath(resolved);

  const isAllowed = ALLOWED_PROJECT_ROOTS.some((allowed) => {
    const normAllowed = normalizePath(allowed);
    return normalized === normAllowed || normalized.startsWith(normAllowed + '/');
  });

  if (!isAllowed) {
    const err = new Error(`Target path '${targetPath}' is outside allowed project whitelist.`);
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}

function detectMasterRoot(projectRoot) {
  if (process.env.MASTER_PROCESS_ROOT && fs.existsSync(path.join(process.env.MASTER_PROCESS_ROOT, 'master.py'))) {
    return path.resolve(process.env.MASTER_PROCESS_ROOT);
  }
  const lockFile = path.join(projectRoot, '.ai', 'process-lock.json');
  if (fs.existsSync(lockFile)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (lock.hub_path && fs.existsSync(path.join(lock.hub_path, 'master.py'))) {
        return path.resolve(lock.hub_path);
      }
    } catch (_) {}
  }
  const candidates = [
    'D:/_Master_Process',
    'D:\\_Master_Process',
    path.resolve(projectRoot, '../_Master_Process'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(path.join(cand, 'master.py'))) {
      return path.resolve(cand);
    }
  }
  return null;
}

function runCommand(cmd, args, cwd, options = {}) {
  const timeout = options.timeout || 60000;
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 2000);
    }, timeout);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          code: 124,
          stdout: stdout.trim(),
          stderr: (stderr + '\n[TIMEOUT] Subprocess timed out after 60s').trim(),
          ok: false,
          timedOut: true,
        });
      } else {
        resolve({ code: code || 0, stdout: stdout.trim(), stderr: stderr.trim(), ok: code === 0, timedOut: false });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: '', stderr: err.message, ok: false, timedOut: false });
    });
  });
}

module.exports = {
  ALLOWED_PROJECT_ROOTS,
  validateProjectPath,
  detectMasterRoot,
  runCommand,
};
