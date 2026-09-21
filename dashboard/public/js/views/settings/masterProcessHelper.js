/**
 * dashboard/public/js/views/settings/masterProcessHelper.js
 * Master Process integration helper for Settings view.
 * Fully decoupled helper adhering to clean architecture and zero innerHTML.
 */
import { apiClient } from '../../core/apiClient.js';

function setBadge(el, label, cls) {
  if (!el) return;
  el.textContent = '';
  const dot = document.createElement('i');
  dot.className = 'ph-fill ph-circle';
  el.appendChild(dot);
  el.appendChild(document.createTextNode(' ' + label));
  el.className = 'settings-badge-status ' + cls;
}

export class MasterProcessHelper {
  constructor(slice) {
    this.slice = slice;
    this._status = null;
    this.isRunning = false;
  }

  bindEvents(root, disposers) {
    const bind = (id, handler) => {
      const el = root.querySelector(id);
      if (el) {
        el.addEventListener('click', handler);
        disposers.push(() => el.removeEventListener('click', handler));
      }
    };

    bind('#mp-refresh-button', () => this.loadStatus(root));
    bind('#mp-btn-drift', () => this.loadStatus(root));
    bind('#mp-btn-init', () => this.runAction('/api/mp/init', {}, root, 'Ghim phiên bản Hub'));
    bind('#mp-btn-sync-dryrun', () => this.runAction('/api/mp/sync', { dryRun: true, updateTemplates: false }, root, 'Xem trước Đồng bộ (--dry-run)'));
    bind('#mp-btn-sync', () => {
      const chk = root.querySelector('#mp-sync-confirm-checkbox');
      if (!chk?.checked) return this.slice.notify('Vui lòng tích chọn xác nhận ghi đè templates để chạy Đồng bộ');
      this.runAction('/api/mp/sync', { updateTemplates: true, dryRun: false }, root, 'Đồng bộ Hub & Ghi đè Templates');
    });

    const chkSync = root.querySelector('#mp-sync-confirm-checkbox');
    if (chkSync) {
      const onChkChange = () => {
        const btn = root.querySelector('#mp-btn-sync');
        if (!btn) return;
        btn.disabled = !chkSync.checked;
        btn.className = chkSync.checked ? 'warning' : 'ghost';
        btn.textContent = chkSync.checked ? '⚠️ Xác nhận Đồng bộ & Ghi đè' : 'Đồng bộ Hub (Sync)';
      };
      chkSync.addEventListener('change', onChkChange);
      disposers.push(() => chkSync.removeEventListener('change', onChkChange));
    }

    bind('#mp-btn-hook', () => this.runAction('/api/mp/install-hooks', {}, root, 'Cài đặt Git Hook'));
    bind('#mp-btn-audit', () => this.runAction('/api/mp/audit', { staged: false }, root, 'Quét Modularity & Secret'));
    bind('#mp-btn-audit-staged', () => this.runAction('/api/mp/audit', { staged: true }, root, 'Quét Staged Files'));
    bind('#mp-btn-doctor', () => this.runAction('/api/mp/doctor', {}, root, 'Chẩn đoán Doctor'));
    bind('#mp-btn-probes', () => this.runAction('/api/mp/probes', { probeId: 'ALL' }, root, 'Chạy Probes P1-P6'));

    bind('#mp-btn-freeze-toggle', async () => {
      const reason = window.prompt('Nhập lý do kích hoạt Feature Freeze (P0 Finding):', 'Phát hiện lỗi P0 nghiêm trọng.');
      if (reason) {
        await apiClient.post('/api/mp/freeze', { active: true, scope: 'ALL', reason, blocking_findings: ['AUTO-01'], activated_at: new Date().toISOString(), activated_by: 'QA-Dashboard' });
        this.slice.notify('Đã kích hoạt Feature Freeze Circuit Breaker');
        await this.loadFreezeStatus(root);
      }
    });
    bind('#mp-btn-freeze-lift', async () => {
      if (window.confirm('Xác nhận gỡ bỏ trạng thái Feature Freeze?')) {
        await apiClient.post('/api/mp/freeze', { active: false, reason: '', blocking_findings: [] });
        this.slice.notify('Đã gỡ bỏ Feature Freeze Circuit Breaker');
        await this.loadFreezeStatus(root);
      }
    });
    bind('#mp-btn-export-evidence', () => {
      this.slice.notify('Chạy lệnh: npm run test:gate4 để xuất bằng chứng mới');
      this.loadEvidenceStatus(root);
    });
    bind('#mp-btn-review-gate4', () => {
      this.slice.notify('Chạy lệnh: npm run review:gate4 để ký duyệt bằng chứng');
      this.loadEvidenceStatus(root);
    });
    bind('#mp-btn-clear-log', () => {
      const term = root.querySelector('#mp-terminal-output');
      if (term) term.textContent = 'Đã xoá nhật ký thực thi.';
    });
  }

  setRunningState(root, running, actionName = '') {
    this.isRunning = running;
    const spinner = root.querySelector('#mp-spinner');
    if (spinner) spinner.style.display = running ? 'flex' : 'none';
    const spinnerText = root.querySelector('#mp-spinner-text');
    if (spinnerText && actionName) spinnerText.textContent = `Đang thực thi: ${actionName}... Vui lòng đợi.`;

    const buttons = root.querySelectorAll('#mp-btn-init, #mp-btn-sync-dryrun, #mp-btn-drift, #mp-btn-hook, #mp-btn-audit, #mp-btn-audit-staged, #mp-btn-doctor, #mp-btn-probes, #mp-refresh-button, #mp-btn-freeze-toggle, #mp-btn-freeze-lift');
    buttons.forEach((btn) => {
      btn.disabled = running;
      btn.style.opacity = running ? '0.6' : '1';
      btn.style.cursor = running ? 'not-allowed' : 'pointer';
    });
    const syncBtn = root.querySelector('#mp-btn-sync');
    const chk = root.querySelector('#mp-sync-confirm-checkbox');
    if (syncBtn) {
      syncBtn.disabled = running || !(chk?.checked);
      syncBtn.style.opacity = (running || !(chk?.checked)) ? '0.6' : '1';
    }
  }

  async loadStatus(root) {
    this.setTerminal(root, 'Đang kiểm tra kết nối với Master Process Hub...');
    try {
      const res = await apiClient.get('/api/mp/status');
      this._status = res;
      this.renderStatus(root, res);
      if (res.raw_drift_output) this.setTerminal(root, res.raw_drift_output);
      await this.loadFreezeStatus(root);
      await this.loadEvidenceStatus(root);
    } catch (err) {
      this.setTerminal(root, `Lỗi nạp trạng thái: ${err.message}`);
      this.slice.notify('Lỗi nạp Master Process: ' + err.message);
    }
  }

  async loadFreezeStatus(root) {
    try {
      const freeze = await apiClient.get('/api/mp/freeze');
      const badge = root.querySelector('#mp-freeze-badge');
      const reasonEl = root.querySelector('#mp-freeze-reason');
      setBadge(badge, freeze.active ? 'FROZEN (Đang ngắt mạch)' : 'Bình thường (Inactive)', freeze.active ? 'is-error' : 'is-active');
      if (reasonEl) reasonEl.textContent = freeze.reason || (freeze.active ? 'P0 finding đang chặn' : 'Không có');
    } catch (_) {}
  }

  async loadEvidenceStatus(root) {
    try {
      const res = await apiClient.get('/api/mp/evidence');
      const badge = root.querySelector('#mp-evidence-badge');
      const hashEl = root.querySelector('#mp-evidence-hash');
      const hasEvidence = res.exists && res.evidence;
      const review = res.evidence?.reviews?.gate4;
      const label = review ? `Đã ký (${review.decision || 'PASS'})` : (hasEvidence ? 'Chờ ký duyệt' : 'Chưa tạo');
      setBadge(badge, label, review ? 'is-active' : (hasEvidence ? 'is-warning' : ''));
      if (hashEl) hashEl.textContent = res.evidence?.receipt?.sha256 || res.evidence?.revision || '—';
    } catch (_) {}
  }

  renderStatus(root, data) {
    if (!data || !data.available) {
      const driftBadge = root.querySelector('#mp-drift-badge');
      setBadge(driftBadge, 'Chưa phát hiện Hub', 'is-error');
      return;
    }

    const setTxt = (id, val) => { const el = root.querySelector(id); if (el) el.textContent = val || '—'; };
    setTxt('#mp-hub-path', data.hub_path);
    setTxt('#mp-hub-version', data.lock_info?.version || 'Chưa ghim');
    setTxt('#mp-hub-commit', data.lock_info?.hub_commit ? data.lock_info.hub_commit.slice(0, 10) : 'Chưa ghim');

    const driftLabel = data.drift_status === 'IN_SYNC' ? 'IN_SYNC (Đồng bộ)' : (data.drift_status === 'DRIFT_DETECTED' ? 'Lệch phiên bản (Drift)' : 'Chưa ghim (Unpinned)');
    const driftCls = data.drift_status === 'IN_SYNC' ? 'is-active' : (data.drift_status === 'DRIFT_DETECTED' ? 'is-error' : 'is-warning');
    setBadge(root.querySelector('#mp-drift-badge'), driftLabel, driftCls);

    const h = data.hook_status || {};
    let hookLabel = 'Chưa cài đặt';
    let hookCls = 'is-error';
    if (h.installed && h.managedV2 && h.pointsToHub) {
      hookLabel = 'Đã kích hoạt (Managed V2, trỏ đúng Hub)';
      hookCls = 'is-active';
    } else if (h.installed && h.managedV2 && !h.pointsToHub) {
      hookLabel = 'Cảnh báo: Chưa trỏ đúng Hub';
      hookCls = 'is-warning';
    } else if (h.installed && !h.managedV2) {
      hookLabel = 'Hook cũ (Chưa Managed V2)';
      hookCls = 'is-warning';
    }
    setBadge(root.querySelector('#mp-hook-badge'), hookLabel, hookCls);
  }

  async runAction(endpoint, payload, root, actionName) {
    if (this.isRunning) return;
    this.setRunningState(root, true, actionName);
    this.setTerminal(root, `Đang thực thi: ${actionName}... Vui lòng đợi.`);

    try {
      let res;
      try {
        res = await apiClient.post(endpoint, payload);
      } catch (postErr) {
        if (postErr.payload && typeof postErr.payload === 'object' && postErr.payload.scanned !== undefined) {
          res = postErr.payload;
        } else {
          throw postErr;
        }
      }

      const out = (res.stdout || '') + (res.stderr ? '\n[STDERR]\n' + res.stderr : '') || res.output || JSON.stringify(res, null, 2);
      this.setTerminal(root, out);

      if (res.scanned !== undefined) {
        const setTxt = (id, val) => { const el = root.querySelector(id); if (el) el.textContent = String(val); };
        setTxt('#mp-scanned-count', res.scanned);
        setTxt('#mp-violations-count', res.violations);
        setTxt('#mp-exempted-count', res.exempted);
      }

      if (res.details) {
        const detWrap = root.querySelector('#mp-audit-details');
        const renderList = (id, items) => {
          const ul = root.querySelector(id);
          if (!ul) return;
          ul.textContent = '';
          (items || []).forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
          });
        };
        renderList('#mp-audit-violations-list', res.details.violations);
        renderList('#mp-audit-exemptions-list', res.details.exemptions);
        if (detWrap) detWrap.style.display = ((res.details.violations?.length || 0) + (res.details.exemptions?.length || 0)) > 0 ? 'block' : 'none';
      }

      if (res.code === 409) {
        this.slice.notify(`Xung đột: ${res.error || 'Tiến trình khác đang chạy'}`);
      } else {
        this.slice.notify(`Hoàn tất: ${actionName}`);
      }
      await this.loadStatus(root);
    } catch (err) {
      this.setTerminal(root, `Lỗi khi thực thi ${actionName}:\n${err.message}`);
      this.slice.notify(`Lỗi ${actionName}: ${err.message}`);
    } finally {
      this.setRunningState(root, false);
    }
  }

  setTerminal(root, text) {
    const term = root.querySelector('#mp-terminal-output');
    if (term) {
      term.textContent = text;
      term.scrollTop = term.scrollHeight;
    }
  }
}
