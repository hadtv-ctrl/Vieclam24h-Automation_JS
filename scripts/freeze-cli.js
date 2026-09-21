#!/usr/bin/env node
/**
 * scripts/freeze-cli.js
 * Tiện ích CLI quản trị Circuit Breaker (Tránh sửa tay JSON dễ lỗi cú pháp).
 */
const { getCircuitBreakerStatus, updateFreezeState } = require('../core/utils/circuitBreaker');

const PROJECT_ROOT = process.cwd();
const command = (process.argv[2] || 'status').toLowerCase();
const args = process.argv.slice(3);

function parseFlags() {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    }
  }
  return flags;
}

const flags = parseFlags();

if (command === 'status') {
  const status = getCircuitBreakerStatus(PROJECT_ROOT);
  console.log('\n=== CIRCUIT BREAKER STATUS ===');
  console.log(`- Trạng Thái     : ${status.active ? '🔴 ACTIVE (FROZEN)' : '🟢 INACTIVE (NORMAL)'}`);
  console.log(`- Scope          : ${JSON.stringify(status.scope)}`);
  console.log(`- Lý Do          : ${status.reason || '(Không có)'}`);
  console.log(`- Findings Chặn  : ${(status.blocking_findings || []).join(', ') || '(Không có)'}`);
  console.log(`- Kích Hoạt Lúc  : ${status.activated_at || 'N/A'}`);
  console.log(`- Kích Hoạt Bởi  : ${status.activated_by || 'N/A'}`);
  console.log(`- Exemption      : ${status.exemption?.approved ? `Duyệt bởi ${status.exemption.approvers.join(', ')}` : 'Không'}`);
  console.log('==============================\n');
} else if (command === 'set') {
  const reason = flags.reason || 'Kích hoạt Circuit Breaker do phát hiện lỗi P0.';
  const finding = flags.finding ? [flags.finding] : ['AUTO-01'];
  const scope = flags.scope || 'ALL';
  const by = flags.by || process.env.USER || 'qa-auditor';

  updateFreezeState(PROJECT_ROOT, {
    active: true,
    scope,
    reason,
    blocking_findings: finding,
    activated_at: new Date().toISOString(),
    activated_by: by,
    exemption: { approved: false, approvers: [], justification: '', expires_at: null }
  });

  console.log(`\n🔴 ĐÃ KÍCH HOẠT FEATURE FREEZE:`);
  console.log(`- Lý do: ${reason}`);
  console.log(`- Scope: ${scope}`);
  console.log(`- Findings chặn: ${finding.join(', ')}`);
  console.log(`Mọi lệnh chạy test và release đều bị từ chối.\n`);
} else if (command === 'lift') {
  const approver = flags.approver || flags.by || '@tech-lead';
  updateFreezeState(PROJECT_ROOT, {
    active: false,
    reason: '',
    blocking_findings: [],
    activated_at: null,
    activated_by: null,
    exemption: { approved: false, approvers: [], justification: '', expires_at: null }
  });

  console.log(`\n🟢 ĐÃ GỠ BỎ FEATURE FREEZE (LIFTED):`);
  console.log(`- Người thực hiện: ${approver}`);
  console.log(`Hệ thống kiểm thử và release trở lại trạng thái bình thường.\n`);
} else {
  console.log('Cách dùng:');
  console.log('  node scripts/freeze-cli.js status');
  console.log('  node scripts/freeze-cli.js set --reason "Lý do P0" --finding AUTO-02');
  console.log('  node scripts/freeze-cli.js lift --approver @tech-lead');
}
