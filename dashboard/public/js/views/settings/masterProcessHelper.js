/**
 * dashboard/public/js/views/settings/masterProcessHelper.js
 * Master Process integration helper for Settings view.
 * Fully decoupled helper adhering to clean architecture and zero innerHTML.
 */
import { apiClient } from '../../core/apiClient.js';

function setBadge(el, label, cls) {
  if (!el) return;
  el.textContent = ' ' + label;
  const dot = document.createElement('i'); dot.className = 'ph-fill ph-circle';
  el.prepend(dot);
  el.className = `settings-badge-status ${cls}`;
}

export class MasterProcessHelper {
  constructor(slice) {
    this.slice = slice;
    this._status = null;
    this.isRunning = false;
    this._projectsLoaded = false;
  }

  getTarget(root) {
    const sel = root?.querySelector('#mp-project-select');
    return sel?.value || '';
  }

  async loadProjects(root) {
    try {
      const res = await apiClient.get('/api/mp/projects');
      const sel = root.querySelector('#mp-project-select');
      const satWrap = root.querySelector('#mp-satellite-badge-wrap');
      const satName = root.querySelector('#mp-satellite-name');
      if (!res?.projects || !sel) return;
      sel.replaceChildren(...res.projects.map((p) => {
        const opt = document.createElement('option');
        opt.value = p.path; opt.textContent = p.name; if (p.isCurrent) opt.selected = true;
        return opt;
      }));
      sel.style.display = res.isHub ? 'block' : 'none';
      if (satWrap) satWrap.style.display = res.isHub ? 'none' : 'flex';
      if (satName && !res.isHub) satName.textContent = res.currentRoot;
    } catch (_) {}
  }

  bindEvents(root, disposers) {
    const bind = (id, handler) => {
      const el = root.querySelector(id);
      if (el) { el.addEventListener('click', handler); disposers.push(() => el.removeEventListener('click', handler)); }
    };

    const sel = root.querySelector('#mp-project-select');
    if (sel) {
      const onSel = () => this.loadStatus(root);
      sel.addEventListener('change', onSel);
      disposers.push(() => sel.removeEventListener('change', onSel));
    }

    [
      ['#mp-refresh-button', () => this.loadStatus(root)], ['#mp-btn-drift', () => this.loadStatus(root)],
      ['#mp-btn-init', () => this.runAction('/api/mp/init', {}, root, 'Ghim phiên bản Hub')],
      ['#mp-btn-sync-dryrun', () => this.runAction('/api/mp/sync', { dryRun: true, updateTemplates: false }, root, 'Xem trước Đồng bộ (--dry-run)')],
      ['#mp-btn-hook', () => this.runAction('/api/mp/install-hooks', {}, root, 'Cài đặt Git Hook')],
      ['#mp-btn-audit', () => this.runAction('/api/mp/audit', { staged: false }, root, 'Quét Modularity & Secret')],
      ['#mp-btn-audit-staged', () => this.runAction('/api/mp/audit', { staged: true }, root, 'Quét Staged Files')],
      ['#mp-btn-doctor', () => this.runAction('/api/mp/doctor', {}, root, 'Chẩn đoán Doctor')],
      ['#mp-btn-probes', () => this.runAction('/api/mp/probes', { probeId: 'ALL' }, root, 'Chạy Probes P1-P6')],
      ['#mp-btn-export-evidence', () => this.runAction('/api/mp/evidence/export', {}, root, 'Xuất Bằng chứng Gate 4')],
      ['#mp-btn-review-gate4', () => this.runAction('/api/mp/evidence/review', { actor: 'qa-lead' }, root, 'Ký duyệt Gate 4')],
      ['#mp-btn-clear-log', () => { const t = root.querySelector('#mp-terminal-output'); if (t) t.textContent = 'Đã xoá nhật ký thực thi.'; }],
    ].forEach(([id, fn]) => bind(id, fn));

    bind('#mp-btn-sync', () => {
      const chk = root.querySelector('#mp-sync-confirm-checkbox');
      if (!chk?.checked) return this.slice.notify('Vui lòng tích chọn xác nhận ghi đè templates để chạy Đồng bộ');
      this.runAction('/api/mp/sync', { updateTemplates: true, dryRun: false }, root, 'Đồng bộ Hub & Ghi đè Templates');
    });

    const chkSync = root.querySelector('#mp-sync-confirm-checkbox');
    if (chkSync) {
      const onChk = () => {
        const btn = root.querySelector('#mp-btn-sync');
        if (!btn) return;
        btn.disabled = !chkSync.checked; btn.className = chkSync.checked ? 'warning' : 'ghost';
        btn.textContent = chkSync.checked ? '⚠️ Xác nhận Đồng bộ & Ghi đè' : 'Đồng bộ Hub (Sync)';
      };
      chkSync.addEventListener('change', onChk);
      disposers.push(() => chkSync.removeEventListener('change', onChk));
    }

    bind('#mp-btn-freeze-toggle', async () => {
      const reason = window.prompt('Nhập lý do Feature Freeze (P0 Finding):', 'Phát hiện lỗi P0 nghiêm trọng.');
      if (!reason) return;
      await apiClient.post('/api/mp/freeze', { active: true, scope: 'ALL', reason, blocking_findings: ['AUTO-01'], targetPath: this.getTarget(root) });
      this.slice.notify('Đã kích hoạt Feature Freeze Circuit Breaker'); await this.loadFreezeStatus(root);
    });
    bind('#mp-btn-freeze-lift', async () => {
      if (!window.confirm('Xác nhận gỡ bỏ trạng thái Feature Freeze?')) return;
      await apiClient.post('/api/mp/freeze', { active: false, reason: '', blocking_findings: [], targetPath: this.getTarget(root) });
      this.slice.notify('Đã gỡ bỏ Feature Freeze Circuit Breaker'); await this.loadFreezeStatus(root);
    });

    root.querySelectorAll('.mp-pipeline-step-btn').forEach((btn) => {
      const h = () => {
        root.querySelectorAll('.mp-pipeline-step-btn').forEach((b) => b.classList.toggle('active', b === btn));
        const target = root.querySelector(btn.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      btn.addEventListener('click', h);
      disposers.push(() => btn.removeEventListener('click', h));
    });
  }

  setRunningState(root, running, actionName = '') {
    this.isRunning = running;
    const spinner = root.querySelector('#mp-spinner');
    if (spinner) spinner.style.display = running ? 'flex' : 'none';
    const spinnerText = root.querySelector('#mp-spinner-text');
    if (spinnerText && actionName) spinnerText.textContent = `Đang thực thi: ${actionName}... Vui lòng đợi.`;

    root.querySelectorAll('#mp-btn-init, #mp-btn-sync-dryrun, #mp-btn-drift, #mp-btn-hook, #mp-btn-audit, #mp-btn-audit-staged, #mp-btn-doctor, #mp-btn-probes, #mp-refresh-button, #mp-btn-freeze-toggle, #mp-btn-freeze-lift, #mp-btn-export-evidence, #mp-btn-review-gate4, #mp-project-select')
      .forEach((b) => { b.disabled = running; b.style.opacity = running ? '0.6' : '1'; b.style.cursor = running ? 'not-allowed' : 'pointer'; });
    const syncBtn = root.querySelector('#mp-btn-sync');
    const chk = root.querySelector('#mp-sync-confirm-checkbox');
    if (syncBtn) {
      syncBtn.disabled = running || !(chk?.checked);
      syncBtn.style.opacity = (running || !(chk?.checked)) ? '0.6' : '1';
    }
  }

  async loadStatus(root) {
    if (!this._projectsLoaded) {
      await this.loadProjects(root);
      this._projectsLoaded = true;
    }
    const target = this.getTarget(root);
    this.setTerminal(root, `Đang kiểm tra kết nối với Master Process Hub (${target || 'Default'})...`);
    try {
      const q = target ? `?target=${encodeURIComponent(target)}` : '';
      const res = await apiClient.get('/api/mp/status' + q);
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

  targetQuery(root) { const t = this.getTarget(root); return t ? `?target=${encodeURIComponent(t)}` : ''; }

  async loadFreezeStatus(root) {
    try {
      const freeze = await apiClient.get('/api/mp/freeze' + this.targetQuery(root));
      const reasonEl = root.querySelector('#mp-freeze-reason');
      setBadge(root.querySelector('#mp-freeze-badge'), freeze.active ? 'FROZEN (Đang ngắt mạch)' : 'Bình thường (Inactive)', freeze.active ? 'is-error' : 'is-active');
      if (reasonEl) reasonEl.textContent = freeze.reason || (freeze.active ? 'P0 finding đang chặn' : 'Không có');
    } catch (_) {}
  }

  async loadEvidenceStatus(root) {
    try {
      const res = await apiClient.get('/api/mp/evidence' + this.targetQuery(root));
      const hasEv = res.exists && res.evidence;
      const review = res.evidence?.reviews?.gate4;
      setBadge(root.querySelector('#mp-evidence-badge'), review ? `Đã ký (${review.decision || 'PASS'})` : (hasEv ? 'Chờ ký duyệt' : 'Chưa tạo'), review ? 'is-active' : (hasEv ? 'is-warning' : ''));
      const hashEl = root.querySelector('#mp-evidence-hash');
      if (hashEl) hashEl.textContent = res.evidence?.receipt?.sha256 || res.evidence?.revision || '—';
    } catch (_) {}
  }

  renderStatus(root, data) {
    if (!data || !data.available) {
      setBadge(root.querySelector('#mp-drift-badge'), 'Chưa phát hiện Hub', 'is-error');
      return;
    }
    [['#mp-hub-path', data.hub_path], ['#mp-hub-version', data.lock_info?.version || 'Chưa ghim'], ['#mp-hub-commit', data.lock_info?.hub_commit?.slice(0, 10) || 'Chưa ghim']]
      .forEach(([id, val]) => { const el = root.querySelector(id); if (el) el.textContent = val || '—'; });

    const isSync = data.drift_status === 'IN_SYNC';
    const driftLabel = isSync ? 'IN_SYNC (Đồng bộ)' : (data.drift_status === 'DRIFT_DETECTED' ? 'Lệch phiên bản (Drift)' : 'Chưa ghim (Unpinned)');
    setBadge(root.querySelector('#mp-drift-badge'), driftLabel, isSync ? 'is-active' : (data.drift_status === 'DRIFT_DETECTED' ? 'is-error' : 'is-warning'));

    const h = data.hook_status || {};
    const hookOk = h.installed && h.managedV2 && h.pointsToHub;
    const hookLabel = hookOk ? 'Đã kích hoạt (Managed V2, trỏ đúng Hub)' : (h.installed ? (h.managedV2 ? 'Cảnh báo: Chưa trỏ đúng Hub' : 'Hook cũ') : 'Chưa cài đặt');
    setBadge(root.querySelector('#mp-hook-badge'), hookLabel, hookOk ? 'is-active' : (h.installed ? 'is-warning' : 'is-error'));
  }

  async runAction(endpoint, payload, root, actionName) {
    if (this.isRunning) return;
    this.setRunningState(root, true, actionName);
    this.setTerminal(root, `Đang thực thi: ${actionName}... Vui lòng đợi.`);

    try {
      let res;
      const target = this.getTarget(root);
      const reqBody = target ? { ...payload, targetPath: target } : payload;
      try {
        res = await apiClient.post(endpoint, reqBody);
      } catch (postErr) {
        const p = postErr.payload;
        if (p && typeof p === 'object' && (p.stdout !== undefined || p.scanned !== undefined || p.output !== undefined)) res = p;
        else throw postErr;
      }

      const out = (res.stdout || '') + (res.stderr ? '\n[STDERR]\n' + res.stderr : '') || res.output || JSON.stringify(res, null, 2);
      this.setTerminal(root, out);

      if (res.scanned !== undefined) {
        [['#mp-scanned-count', res.scanned], ['#mp-violations-count', res.violations], ['#mp-exempted-count', res.exempted]]
          .forEach(([id, val]) => { const el = root.querySelector(id); if (el) el.textContent = String(val); });
      }

      if (res.details) {
        const detWrap = root.querySelector('#mp-audit-details');
        const renderList = (id, items) => {
          const ul = root.querySelector(id);
          if (ul) ul.replaceChildren(...(items || []).map((item) => { const li = document.createElement('li'); li.textContent = item; return li; }));
        };
        renderList('#mp-audit-violations-list', res.details.violations);
        renderList('#mp-audit-exemptions-list', res.details.exemptions);
        if (detWrap) detWrap.style.display = ((res.details.violations?.length || 0) + (res.details.exemptions?.length || 0)) > 0 ? 'block' : 'none';
      }

      if (res.code === 409) {
        this.slice.notify(`Xung đột: ${res.error || 'Tiến trình khác đang chạy'}`);
      } else if (res.ok === false && (res.code !== 0 || res.violations > 0)) {
        this.slice.notify(`${actionName}: Hoàn tất (Có phát hiện/cảnh báo)`);
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
    if (term) { term.textContent = text; term.scrollTop = term.scrollHeight; }
  }
}
