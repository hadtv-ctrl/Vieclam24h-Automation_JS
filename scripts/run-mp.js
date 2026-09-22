#!/usr/bin/env node
/**
 * scripts/run-mp.js
 * Runner trung gian phân giải Master Process Hub động (không hardcode ổ đĩa/đường dẫn).
 * Cho phép chạy các lệnh `mp:*` trên bất kỳ máy tính nào.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = process.cwd();

function resolveMasterRoot() {
  if (process.env.MASTER_PROCESS_ROOT && fs.existsSync(path.join(process.env.MASTER_PROCESS_ROOT, 'master.py'))) {
    return path.resolve(process.env.MASTER_PROCESS_ROOT);
  }
  const lockFile = path.join(PROJECT_ROOT, '.ai', 'process-lock.json');
  if (fs.existsSync(lockFile)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (lock.hub_path && fs.existsSync(path.join(lock.hub_path, 'master.py'))) {
        return path.resolve(lock.hub_path);
      }
    } catch (_) {}
  }
  const resolvedRoot = path.resolve(PROJECT_ROOT);
  const driveRoot = path.parse(resolvedRoot).root;
  const candidates = [
    path.resolve(resolvedRoot, '../_Master_Process'),
    path.resolve(resolvedRoot, '../_Master_process'),
    path.resolve(resolvedRoot, '.master_process'),
    path.join(driveRoot, '_Master_Process'),
    path.join(driveRoot, '_Master_process'),
    'D:/_Master_Process',
    'C:/_Master_Process',
  ];
  for (const cand of candidates) {
    if (cand && fs.existsSync(path.join(cand, 'master.py'))) {
      return path.resolve(cand);
    }
  }
  console.error('[run-mp Lỗi] Không tìm thấy Master Process Hub (master.py).');
  console.error('Vui lòng thiết lập biến môi trường MASTER_PROCESS_ROOT hoặc clone _Master_Process cùng thư mục với dự án.');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Cách dùng: node scripts/run-mp.js <action> [args...]');
    process.exit(1);
  }

  const masterRoot = resolveMasterRoot();
  const action = args[0];
  const restArgs = args.slice(1);

  if (action === 'probes') {
    const script = path.join(masterRoot, 'scripts', 'audit-probes.ps1');
    if (!fs.existsSync(script)) {
      console.error(`[run-mp Lỗi] Không tìm thấy script audit-probes.ps1 tại: ${script}`);
      process.exit(1);
    }
    const probeId = restArgs[0] || 'ALL';
    const target = restArgs[1] || '.';
    const res = spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProbeId', probeId, target],
      { stdio: 'inherit', cwd: PROJECT_ROOT }
    );
    process.exit(res.status || 0);
  }

  const masterPy = path.join(masterRoot, 'master.py');
  const res = spawnSync('python', [masterPy, ...args], { stdio: 'inherit', cwd: PROJECT_ROOT });
  process.exit(res.status || 0);
}

if (require.main === module) {
  main();
}

module.exports = { resolveMasterRoot };
