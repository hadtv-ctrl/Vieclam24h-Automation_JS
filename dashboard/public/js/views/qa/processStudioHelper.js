/**
 * dashboard/public/js/views/qa/processStudioHelper.js
 * Decoupled controller for Master Process Studio in QA View.
 * Adheres 100% to DOM APIs and Zero innerHTML for safety against XSS.
 */

import { apiClient } from '../../core/apiClient.js';

export class ProcessStudioHelper {
  constructor(slice) {
    this.slice = slice;
    this.isRunning = false;
  }

  bindEvents(root, disposers) {
    const bind = (selector, handler) => {
      const el = root.querySelector(selector);
      if (el) {
        el.addEventListener('click', handler);
        disposers.push(() => el.removeEventListener('click', handler));
      }
    };

    bind('#qa-mp-btn-refresh', () => this.loadStatus(root));
    bind('#qa-mp-btn-doctor', () => this.executeAction('doctor', root, 'Health Check (doctor)'));
    bind('#qa-mp-btn-audit', () => this.executeAction('audit', root, 'Security & Modularity Audit'));
    bind('#qa-mp-btn-optimize', () => this.executeAction('optimize', root, 'Optimize & Archive Learning'));
    bind('#qa-mp-btn-probes', () => this.executeAction('probes', root, '6 Audit Probes Toolkit'));
    bind('#qa-mp-btn-clear', () => {
      const term = root.querySelector('#qa-mp-terminal');
      if (term) term.textContent = 'Sẵn sàng thực thi lệnh Master Process...';
    });
  }

  async loadStatus(root) {
    try {
      const res = await apiClient.get('/api/mp/status');
      this.renderStatusBadges(root, res);
    } catch (err) {
      this.appendLog(root, `[LỖI] Không thể nạp trạng thái: ${err.message}`, true);
    }
  }

  renderStatusBadges(root, data) {
    const q = data?.quality || {};

    const policyEl = root.querySelector('#qa-mp-badge-policy');
    if (policyEl) {
      policyEl.textContent = q.policy_label || 'DEFAULT (Standard 01)';
    }

    const modEl = root.querySelector('#qa-mp-badge-modularity');
    if (modEl && !this._lastAuditRun) {
      modEl.textContent = 'Chưa kiểm tra (Nhấn Audit)';
      modEl.style.color = 'var(--text-muted, #8b949e)';
    }

    const learnEl = root.querySelector('#qa-mp-badge-learning');
    if (learnEl) {
      const count = q.candidates_lines ?? 0;
      const isCritical = count > 50;
      learnEl.textContent = `${count} lines ${isCritical ? '(Needs Curation)' : '(Tốt)'}`;
      learnEl.style.color = isCritical ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)';
    }

    const freezeEl = root.querySelector('#qa-mp-badge-freeze');
    if (freezeEl) {
      const isFrozen = Boolean(q.freeze_active);
      freezeEl.textContent = isFrozen ? `FROZEN: ${q.freeze_reason || 'Blocked'}` : 'NORMAL (Unfrozen)';
      freezeEl.style.color = isFrozen ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)';
    }
  }

  setRunningState(root, running) {
    this.isRunning = running;
    const spinner = root.querySelector('#qa-mp-spinner');
    if (spinner) spinner.style.display = running ? 'flex' : 'none';

    const buttons = root.querySelectorAll('#qa-mp-btn-doctor, #qa-mp-btn-audit, #qa-mp-btn-optimize, #qa-mp-btn-probes, #qa-mp-btn-refresh');
    buttons.forEach((btn) => {
      btn.disabled = running;
      btn.style.opacity = running ? '0.6' : '1';
      btn.style.cursor = running ? 'not-allowed' : 'pointer';
    });
  }

  async executeAction(action, root, label) {
    if (this.isRunning) return;
    this.setRunningState(root, true);
    this.appendLog(root, `\n>>> [BẮT ĐẦU] Đang chạy: ${label}... Vui lòng đợi.`);

    try {
      const res = await apiClient.post('/api/mp/run', { action });
      const out = res.stdout || res.output || '';
      const err = res.stderr || '';

      if (out) this.appendLog(root, out);
      if (err) this.appendLog(root, `[STDERR]\n${err}`, true);

      if (res.scanned !== undefined) {
        this._lastAuditRun = true;
        const modEl = root.querySelector('#qa-mp-badge-modularity');
        if (modEl) {
          const isPass = (res.violations || 0) === 0;
          modEl.textContent = `${res.scanned} Scanned / ${res.violations || 0} Violations (${isPass ? 'PASS' : 'FAIL'})`;
          modEl.style.color = isPass ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';
        }
      }

      const isOk = res.ok !== false && (res.code === 0 || res.exitCode === 0 || res.code === undefined);
      this.appendLog(root, `>>> [HOÀN TẤT] Lệnh ${action} kết thúc với exitCode: ${res.code ?? res.exitCode ?? 0} (${isOk ? 'THÀNH CÔNG' : 'CÓ CẢNH BÁO/LỖI'})`);

      if (this.slice && typeof this.slice.notify === 'function') {
        this.slice.notify(`Master Process: ${label} hoàn tất`);
      }

      await this.loadStatus(root);
    } catch (err) {
      this.appendLog(root, `>>> [LỖI THỰC THI] ${err.message}`, true);
      if (this.slice && typeof this.slice.notify === 'function') {
        this.slice.notify(`Lỗi thực thi ${action}: ${err.message}`);
      }
    } finally {
      this.setRunningState(root, false);
    }
  }

  appendLog(root, text, isError = false) {
    const term = root.querySelector('#qa-mp-terminal');
    if (!term) return;

    const lines = String(text || '').split('\n');
    const frag = document.createDocumentFragment();

    for (const line of lines) {
      const span = document.createElement('span');
      span.style.display = 'block';

      const lower = line.toLowerCase();
      if (isError || lower.includes('fail') || lower.includes('error') || lower.includes('violation') || lower.includes('drift_detected')) {
        span.style.color = '#f85149'; // Red
      } else if (lower.includes('pass') || lower.includes('in_sync') || lower.includes('thành công') || lower.includes('ok')) {
        span.style.color = '#3fb950'; // Green
      } else if (lower.includes('warn') || lower.includes('skip') || lower.includes('chú ý')) {
        span.style.color = '#d29922'; // Yellow
      } else if (line.startsWith('>>>') || line.startsWith('===')) {
        span.style.color = '#58a6ff'; // Blue
        span.style.fontWeight = '600';
      } else {
        span.style.color = '#e6edf3'; // Default White
      }

      span.textContent = line || ' ';
      frag.appendChild(span);
    }

    term.appendChild(frag);
    term.scrollTop = term.scrollHeight;
  }
}
