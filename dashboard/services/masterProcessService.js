/**
 * dashboard/services/masterProcessService.js
 * Service kết nối và điều phối Master Process Hub (D:\_Master_Process).
 * Hỗ trợ các tác vụ: Anti-Drift Check, Init, Sync, Git Hook Management, Modularity & Secret Audit.
 */

const fs = require('fs');
const path = require('path');
const { getCircuitBreakerStatus } = require('../../core/utils/circuitBreaker');
const { validateProjectPath, detectMasterRoot, runCommand } = require('./masterProcessUtils');

let currentRunningAction = null;

async function withExecutionLock(actionName, fn) {
  if (currentRunningAction) {
    return {
      code: 409,
      ok: false,
      error: `Tiến trình '${currentRunningAction}' đang chạy. Vui lòng chờ hoàn tất.`,
      stdout: '',
      stderr: `[CONFLICT 409] Tiến trình '${currentRunningAction}' đang thực thi.`,
    };
  }
  currentRunningAction = actionName;
  try {
    return await fn();
  } finally {
    currentRunningAction = null;
  }
}

function runMaster(masterRoot, args, projectRoot) {
  const pyBin = process.platform === 'win32' ? 'python' : 'python3';
  return runCommand(pyBin, [path.join(masterRoot, 'master.py'), ...args], projectRoot);
}

async function getProjectStatus(projectRoot) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) {
    return { available: false, error: 'Không tìm thấy thư mục Master Process Hub (D:/_Master_Process).' };
  }

  const lockFile = path.join(validRoot, '.ai', 'process-lock.json');
  let lockInfo = null;
  if (fs.existsSync(lockFile)) {
    try { lockInfo = JSON.parse(fs.readFileSync(lockFile, 'utf8')); } catch (_) {}
  }

  const hookFile = path.join(validRoot, '.git', 'hooks', 'pre-commit');
  let hookStatus = { installed: false, managedV2: false, pointsToHub: false };
  if (fs.existsSync(hookFile)) {
    try {
      const text = fs.readFileSync(hookFile, 'utf8');
      hookStatus.installed = true;
      hookStatus.managedV2 = text.includes('# MASTER_PROCESS_MANAGED_HOOK_V2');
      const normMaster = masterRoot.replace(/\\/g, '/').toLowerCase();
      const normText = text.replace(/\\/g, '/').toLowerCase();
      hookStatus.pointsToHub = normText.includes(normMaster);
    } catch (_) {}
  }

  const driftResult = await runMaster(masterRoot, ['check-drift', validRoot], validRoot);
  let driftStatus = 'UNPINNED';
  if (driftResult.stdout.includes('IN_SYNC')) driftStatus = 'IN_SYNC';
  else if (driftResult.stdout.includes('DRIFT_DETECTED')) driftStatus = 'DRIFT_DETECTED';

  const policyFile = path.join(validRoot, '.quality-policy.json');
  let policyLabel = 'DEFAULT (Code 250 lines / Knowledge 50 lines)';
  if (fs.existsSync(policyFile)) {
    try {
      const p = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
      const codeL = p.code?.limits?.module ? `${Math.round(p.code.limits.module / 1000)}k` : 'custom';
      policyLabel = `CUSTOM (Code ${codeL} lines / Knowledge ${p.knowledge?.maxLines || 150} lines)`;
    } catch (_) {}
  }

  const candFile = path.join(validRoot, '.ai', 'learning', 'candidates.md');
  let candCount = 0;
  if (fs.existsSync(candFile)) {
    try { candCount = fs.readFileSync(candFile, 'utf8').split('\n').filter(Boolean).length; } catch (_) {}
  }

  const freeze = getCircuitBreakerStatus(validRoot);
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
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return withExecutionLock('init', () => runMaster(masterRoot, ['init', validRoot], validRoot));
}

async function syncProject(projectRoot, { updateTemplates = false, dryRun = false } = {}) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return withExecutionLock('sync', () => {
    const args = ['sync', validRoot];
    if (dryRun) args.push('--dry-run');
    if (updateTemplates) args.push('--update-templates');
    return runMaster(masterRoot, args, validRoot);
  });
}

async function installHooks(projectRoot) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return withExecutionLock('install-hooks', () => runMaster(masterRoot, ['install-hooks', validRoot], validRoot));
}

async function runAudit(projectRoot, { staged = false } = {}) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return withExecutionLock('audit', async () => {
    const args = ['audit', validRoot];
    if (staged) args.push('--staged');
    const res = await runMaster(masterRoot, args, validRoot);
    const matchMod = (res.stdout + '\n' + res.stderr).match(/MODULARITY:\s*scanned=(\d+)\s*violations=(\d+)\s*exempted=(\d+)/i);
    const lines = (res.stdout + '\n' + res.stderr).split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      ...res,
      scanned: matchMod ? parseInt(matchMod[1], 10) : 0,
      violations: matchMod ? parseInt(matchMod[2], 10) : (res.ok ? 0 : 1),
      exempted: matchMod ? parseInt(matchMod[3], 10) : 0,
      details: {
        violations: lines.filter((l) => l.startsWith('VIOLATION:') || l.startsWith('SECRET VIOLATION:')),
        exemptions: lines.filter((l) => l.startsWith('SKIP:')),
      },
    };
  });
}

async function runDoctor(projectRoot) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  return withExecutionLock('doctor', () => runMaster(masterRoot, ['doctor', validRoot], validRoot));
}

async function runProbes(projectRoot, { probeId = 'ALL' } = {}) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  const script = path.join(masterRoot, 'scripts', 'audit-probes.ps1');
  if (!fs.existsSync(script)) throw new Error('Không tìm thấy script audit-probes.ps1');
  return withExecutionLock('probes', () => runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProbeId', probeId, validRoot], validRoot));
}

async function runMasterAction(projectRoot, action, payload = {}) {
  const validRoot = validateProjectPath(projectRoot);
  const masterRoot = detectMasterRoot(validRoot);
  if (!masterRoot) throw new Error('Không tìm thấy Master Process Hub');
  if (action === 'doctor') return runDoctor(validRoot);
  if (action === 'audit') return runAudit(validRoot, payload);
  if (action === 'optimize') return withExecutionLock('optimize', () => runMaster(masterRoot, ['optimize', validRoot], validRoot));
  if (action === 'probes') return runProbes(validRoot, payload);
  throw new Error(`Action không hợp lệ: ${action}. Chỉ chấp nhận: doctor, audit, optimize, probes.`);
}

module.exports = {
  detectMasterRoot,
  validateProjectPath,
  getProjectStatus,
  initProject,
  syncProject,
  installHooks,
  runAudit,
  runDoctor,
  runProbes,
  runMasterAction,
};
