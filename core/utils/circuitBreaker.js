/**
 * core/utils/circuitBreaker.js
 * Cơ chế Feature Freeze Circuit Breaker bảo vệ 3 tầng theo Tiêu Chuẩn Thẩm Định 04 (§10.3).
 */
const fs = require('fs');
const path = require('path');

function resolveFreezeFilePath(projectRoot = process.cwd()) {
  const candidates = [
    path.join(projectRoot, '.ai', 'audit', 'FREEZE.json'),
    path.join(projectRoot, 'audit', 'FREEZE.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(projectRoot, 'audit', 'FREEZE.json');
}

function getCircuitBreakerStatus(projectRoot = process.cwd()) {
  const filePath = resolveFreezeFilePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {
      active: false,
      scope: 'ALL',
      reason: '',
      blocking_findings: [],
      filePath,
      exemption: { approved: false }
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return { ...data, filePath };
  } catch (error) {
    console.error(`[Circuit Breaker] Lỗi đọc ${filePath}:`, error.message);
    return { active: false, scope: 'ALL', error: error.message, filePath };
  }
}

function isExemptionValid(exemption) {
  if (!exemption || !exemption.approved) return false;
  if (!Array.isArray(exemption.approvers) || exemption.approvers.length === 0) return false;
  if (!exemption.justification) return false;
  if (exemption.expires_at) {
    const expireTime = new Date(exemption.expires_at).getTime();
    if (Number.isFinite(expireTime) && Date.now() > expireTime) return false;
  }
  return true;
}

function assertNotFrozen(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const status = getCircuitBreakerStatus(projectRoot);
  const exitOnError = options.exitOnError !== false;
  const suiteName = String(options.suiteName || '').toLowerCase();

  if (!status.active) return true;

  if (isExemptionValid(status.exemption)) {
    console.warn(`[CIRCUIT BREAKER CẢNH BÁO] Hệ thống đang FROZEN nhưng được chạy dưới quyền Exemption:`);
    console.warn(`- Phê duyệt bởi: ${status.exemption.approvers.join(', ')}`);
    console.warn(`- Lý do: ${status.exemption.justification}`);
    return true;
  }

  const scope = status.scope;
  let matchesScope = true;
  if (scope && scope !== 'ALL') {
    const allowedScopes = Array.isArray(scope) ? scope : [scope];
    matchesScope = allowedScopes.some((s) => suiteName.includes(String(s).toLowerCase()));
  }

  if (matchesScope) {
    const reasonMsg = status.reason || 'P0 blocking finding chưa được khắc phục.';
    const findingsMsg = (status.blocking_findings || []).join(', ') || 'Chưa định danh';
    const message = `[CIRCUIT BREAKER] Release & Regression suite is FROZEN due to P0 finding: ${reasonMsg} (Findings: ${findingsMsg})`;

    console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error(message);
    console.error('Mọi tiến trình test và release đều bị từ chối.');
    console.error('Xem chi tiết và cập nhật tại: audit/FINDINGS_REGISTRY.md');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');

    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(message);
  }

  return true;
}

function updateFreezeState(projectRoot, updateData) {
  const filePath = resolveFreezeFilePath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = getCircuitBreakerStatus(projectRoot);
  const updated = {
    version: '1.0',
    ...current,
    ...updateData,
    filePath: undefined
  };
  delete updated.filePath;
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

module.exports = {
  resolveFreezeFilePath,
  getCircuitBreakerStatus,
  assertNotFrozen,
  updateFreezeState
};
