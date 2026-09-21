/**
 * dashboard/public/js/views/settings/masterProcessHelper.js
 * Master Process integration helper for Settings view.
 * Fully decoupled helper adhering to clean architecture.
 */
import { apiClient } from '../../core/apiClient.js';

export class MasterProcessHelper {
  constructor(slice) {
    this.slice = slice;
    this._status = null;
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
    bind('#mp-btn-sync', () => this.runAction('/api/mp/sync', { updateTemplates: true }, root, 'Đồng bộ Hub'));
    bind('#mp-btn-hook', () => this.runAction('/api/mp/install-hooks', {}, root, 'Cài đặt Git Hook'));
    bind('#mp-btn-audit', () => this.runAction('/api/mp/audit', { staged: false }, root, 'Quét Modularity & Secret'));
    bind('#mp-btn-audit-staged', () => this.runAction('/api/mp/audit', { staged: true }, root, 'Quét Staged Files'));
    bind('#mp-btn-doctor', () => this.runAction('/api/mp/doctor', {}, root, 'Chẩn đoán Doctor'));
    bind('#mp-btn-probes', () => this.runAction('/api/mp/probes', { probeId: 'ALL' }, root, 'Chạy Probes P1-P6'));
    bind('#mp-btn-clear-log', () => {
      const term = root.querySelector('#mp-terminal-output');
      if (term) term.textContent = 'Đã xoá nhật ký thực thi.';
    });
  }

  async loadStatus(root) {
    this.setTerminal(root, 'Đang kiểm tra kết nối với Master Process Hub...');
    try {
      const res = await apiClient.get('/api/mp/status');
      this._status = res;
      this.renderStatus(root, res);
      if (res.raw_drift_output) {
        this.setTerminal(root, res.raw_drift_output);
      }
    } catch (err) {
      this.setTerminal(root, `Lỗi nạp trạng thái: ${err.message}`);
      this.slice.notify('Lỗi nạp Master Process: ' + err.message);
    }
  }

  renderStatus(root, data) {
    if (!data || !data.available) {
      const driftBadge = root.querySelector('#mp-drift-badge');
      if (driftBadge) {
        driftBadge.textContent = 'Chưa phát hiện Hub';
        driftBadge.className = 'settings-badge-status is-error';
      }
      return;
    }

    const setTxt = (id, val) => {
      const el = root.querySelector(id);
      if (el) el.textContent = val || '—';
    };

    setTxt('#mp-hub-path', data.hub_path);
    setTxt('#mp-hub-version', data.lock_info?.version || 'Chưa ghim');
    setTxt('#mp-hub-commit', data.lock_info?.hub_commit ? data.lock_info.hub_commit.slice(0, 10) : 'Chưa ghim');

    const driftBadge = root.querySelector('#mp-drift-badge');
    if (driftBadge) {
      driftBadge.textContent = '';
      const dot = document.createElement('i');
      dot.className = 'ph-fill ph-circle';
      driftBadge.appendChild(dot);
      const label = data.drift_status === 'IN_SYNC' ? 'IN_SYNC (Đồng bộ)' : (data.drift_status === 'DRIFT_DETECTED' ? 'Lệch phiên bản (Drift)' : 'Chưa ghim (Unpinned)');
      driftBadge.appendChild(document.createTextNode(' ' + label));
      driftBadge.className = 'settings-badge-status ' + (data.drift_status === 'IN_SYNC' ? 'is-active' : (data.drift_status === 'DRIFT_DETECTED' ? 'is-error' : 'is-warning'));
    }

    const hookBadge = root.querySelector('#mp-hook-badge');
    if (hookBadge) {
      hookBadge.textContent = '';
      const dot = document.createElement('i');
      dot.className = 'ph-fill ph-circle';
      hookBadge.appendChild(dot);
      const isOk = data.hook_status?.installed && data.hook_status?.managedV2;
      const label = isOk ? 'Đã kích hoạt (Managed V2)' : (data.hook_status?.installed ? 'Hook cũ (Chưa Managed V2)' : 'Chưa cài đặt');
      hookBadge.appendChild(document.createTextNode(' ' + label));
      hookBadge.className = 'settings-badge-status ' + (isOk ? 'is-active' : 'is-error');
    }
  }

  async runAction(endpoint, payload, root, actionName) {
    this.setTerminal(root, `Đang thực thi: ${actionName}... Vui lòng đợi.`);
    try {
      const res = await apiClient.post(endpoint, payload);
      const out = (res.stdout || '') + (res.stderr ? '\n[STDERR]\n' + res.stderr : '') || res.output || JSON.stringify(res, null, 2);
      this.setTerminal(root, out);

      if (res.scanned !== undefined) {
        const setTxt = (id, val) => { const el = root.querySelector(id); if (el) el.textContent = String(val); };
        setTxt('#mp-scanned-count', res.scanned);
        setTxt('#mp-violations-count', res.violations);
        setTxt('#mp-exempted-count', res.exempted);
      }

      this.slice.notify(`Hoàn tất: ${actionName}`);
      await this.loadStatus(root);
    } catch (err) {
      this.setTerminal(root, `Lỗi khi thực thi ${actionName}:\n${err.message}`);
      this.slice.notify(`Lỗi ${actionName}: ${err.message}`);
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
