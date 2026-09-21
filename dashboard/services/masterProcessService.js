/**
 * dashboard/services/masterProcessService.js
 * Service kết nối và điều phối Master Process Hub (D:\_Master_Process).
 * Hỗ trợ các tác vụ: Anti-Drift Check, Init, Sync, Git Hook Management, Modularity & Secret Audit.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getCircuitBreakerStatus } = require('../../core/utils/circuitBreaker');

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

function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      resolve({ code: code || 0, stdout: stdout.trim(), stderr: stderr.trim(), ok: code === 0 });
    });
    proc.on('error', (err) => {
      resolve({ code: 1, stdout: '', stderr: err.message, ok: false });
    });
  });
}

function runMaster(masterRoot, args, projectRoot) {
  const pyBin = process.platform === 'win32' ? 'python' : 'python3';
  const masterPy = path.join(masterRoot, 'master.py');
  return runCommand(pyBin, [masterPy, ...args], projectRoot);
}

async function getProjectStatus(projectRoot) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) {
    return { available: false, error: 'Không tìm thấy thư mục Master Process Hub (D:/_Master_Process).' };
  }

  const lockFile = path.join(projectRoot, '.ai', 'process-lock.json');
  let lockInfo = null;
  if (fs.existsSync(lockFile)) {
    try {
      lockInfo = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    } catch (_) {}
  }

  const hookFile = path.join(projectRoot, '.git', 'hooks', 'pre-commit');
  let hookStatus = { installed: false, managedV2: false, pointsToHub: false };
  if (fs.existsSync(hookFile)) {
    try {
      const text = fs.readFileSync(hookFile, 'utf8');
      hookStatus.installed = true;
      hookStatus.managedV2 = text.includes('# MASTER_PROCESS_MANAGED_HOOK_V2');
      hookStatus.pointsToHub = text.includes(masterRoot.replace(/\\/g, '/')) || text.includes('master.py');
    } catch (_) {}
  }

  const driftResult = await runMaster(masterRoot, ['check-drift', projectRoot], projectRoot);
  let driftStatus = 'UNPINNED';
  if (driftResult.stdout.includes('IN_SYNC')) driftStatus = 'IN_SYNC';
  else if (driftResult.stdout.includes('DRIFT_DETECTED')) driftStatus = 'DRIFT_DETECTED';

  // Quality metrics (Policy, Candidates, Freeze)
  const policyFile = path.join(projectRoot, '.quality-policy.json');
  let policyLabel = 'DEFAULT (Code 250 lines / Knowledge 50 lines)';
  if (fs.existsSync(policyFile)) {
    try {
      const p = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
      const codeL = p.code?.limits?.module ? `${Math.round(p.code.limits.module / 1000)}k` : 'custom';
      policyLabel = `CUSTOM (Code ${codeL} lines / Knowledge ${p.knowledge?.maxLines || 150} lines)`;
    } catch (_) {}
  }

  const candFile = path.join(projectRoot, '.ai', 'learning', 'candidates.md');
  let candCount = 0;
  if (fs.existsSync(candFile)) {
    try { candCount = fs.readFileSync(candFile, 'utf8').split('\n').filter(Boolean).length; } catch (_) {}
  }

  const freeze = getCircuitBreakerStatus(projectRoot);

  return {
    available: true,
    hub_path: masterRoot,
    is_bound: Boolean(lockInfo),
    drift_status: driftStatus,
    hook_status: hookStatus,
    lock_info: lockInfo,
    raw_drift_output: driftResult.stdout,
    quality: {
      policy_label: policyLabel,
      candidates_lines: candCount,
      candidates_status: candCount > 50 ? 'NEEDS_CURATION' : 'NORMAL',
      freeze_active: freeze.active,
      freeze_reason: freeze.reason,
    },
  };
}

async function initProject(projectRoot) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return runMaster(masterRoot, ['init', projectRoot], projectRoot);
}

async function syncProject(projectRoot, { updateTemplates = false, dryRun = false } = {}) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  const args = ['sync', projectRoot];
  if (dryRun) args.push('--dry-run');
  if (updateTemplates) args.push('--update-templates');
  return runMaster(masterRoot, args, projectRoot);
}

async function installHooks(projectRoot) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return runMaster(masterRoot, ['install-hooks', projectRoot], projectRoot);
}

async function runAudit(projectRoot, { staged = false } = {}) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  const args = ['audit', projectRoot];
  if (staged) args.push('--staged');
  const res = await runMaster(masterRoot, args, projectRoot);
  const matchMod = (res.stdout + '\n' + res.stderr).match(/MODULARITY:\s*scanned=(\d+)\s*violations=(\d+)\s*exempted=(\d+)/i);
  return {
    ...res,
    scanned: matchMod ? parseInt(matchMod[1], 10) : 0,
    violations: matchMod ? parseInt(matchMod[2], 10) : (res.ok ? 0 : 1),
    exempted: matchMod ? parseInt(matchMod[3], 10) : 0,
  };
}

async function runDoctor(projectRoot) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return runMaster(masterRoot, ['doctor', projectRoot], projectRoot);
}

async function runProbes(projectRoot, { probeId = 'ALL' } = {}) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  const script = path.join(masterRoot, 'scripts', 'audit-probes.ps1');
  if (!fs.existsSync(script)) throw new Error('Không tìm thấy script audit-probes.ps1');
  return runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProbeId', probeId, projectRoot], projectRoot);
}

async function runMasterAction(projectRoot, action, payload = {}) {
  const masterRoot = detectMasterRoot(projectRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  if (action === 'doctor') return runDoctor(projectRoot);
  if (action === 'audit') return runAudit(projectRoot, payload);
  if (action === 'optimize') return runMaster(masterRoot, ['optimize', projectRoot], projectRoot);
  if (action === 'probes') return runProbes(projectRoot, payload);
  throw new Error(`Action không hợp lệ: ${action}. Chỉ chấp nhận: doctor, audit, optimize, probes.`);
}

module.exports = {
  detectMasterRoot,
  getProjectStatus,
  initProject,
  syncProject,
  installHooks,
  runAudit,
  runDoctor,
  runProbes,
  runMasterAction,
};
