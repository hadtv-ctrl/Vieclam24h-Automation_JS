'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaOverviewSlice.js
 * Quản lý vẽ Scorecards điều hành, chỉ số thống kê, source bar và modal Briefing.
 */

export class QaOverviewSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderSourceBar(root, summary) {
    const bar = root.querySelector('#qa-source-bar');
    if (!bar) return;
    const boundary = summary && summary.boundary;
    if (!boundary) {
      bar.style.display = 'none';
      return;
    }
    const dot = bar.querySelector('.qa-source-dot');
    const label = bar.querySelector('.qa-source-label');
    const status = (boundary.status || 'UNKNOWN').toUpperCase();
    if (dot) dot.setAttribute('data-status', status);
    if (label) {
      const mode = boundary.mode === 'staged' ? 'Staged' : 'Repo';
      label.textContent = `Boundary: ${status} (${mode})`;
    }
    bar.style.display = 'flex';
  }

  renderStats(root, trace) {
    const setVal = (id, val) => {
      const el = root.querySelector(id);
      if (el) el.textContent = val != null ? String(val) : '—';
    };
    if (!trace) {
      setVal('#qa-stat-req-count', '—');
      setVal('#qa-stat-ac-count', '—');
      setVal('#qa-stat-tc-count', '—');
      setVal('#qa-stat-coverage', '—');
      return;
    }
    const m = trace.metrics || {};
    setVal('#qa-stat-req-count', m.requirements ?? 0);
    setVal('#qa-stat-ac-count', m.acceptanceCriteria ?? 0);
    setVal('#qa-stat-tc-count', m.testCases ?? 0);
    const cov = m.coveragePercent != null ? `${Math.round(m.coveragePercent)}%` : '—';
    setVal('#qa-stat-coverage', cov);
  }

  renderExecutiveScorecard(root, summary, trace) {
    const card = root.querySelector('#qa-scorecard');
    if (!card) return;
    const m = (trace && trace.metrics) || (summary && summary.metrics) || {};
    const b = (summary && summary.boundary) || {};
    const h = (summary && summary.health) || {};

    const cov = m.coveragePercent != null ? Math.round(m.coveragePercent) : 0;
    const covEl = root.querySelector('#qa-score-cov-val');
    const covSub = root.querySelector('#qa-score-cov-sub');
    if (covEl) covEl.textContent = `${cov}%`;
    if (covSub) covSub.textContent = `${m.coveredAc || 0}/${m.acceptanceCriteria || 0} ACs`;

    const bStatus = (b.status || 'ALIGNED').toUpperCase();
    const bEl = root.querySelector('#qa-score-b-val');
    const bSub = root.querySelector('#qa-score-b-sub');
    if (bEl) {
      bEl.textContent = bStatus;
      bEl.setAttribute('data-status', bStatus);
    }
    if (bSub) bSub.textContent = b.scope || 'Repo';

    const healthStatus = (h.status || summary?.systemHealth || 'HEALTHY').toUpperCase();
    const hEl = root.querySelector('#qa-score-h-val');
    const hSub = root.querySelector('#qa-score-h-sub');
    if (hEl) {
      hEl.textContent = healthStatus;
      hEl.setAttribute('data-status', healthStatus);
    }
    if (hSub) {
      const findingsCount = Array.isArray(summary?.findings) ? summary.findings.length : 0;
      hSub.textContent = `${findingsCount} findings`;
    }

    const tcs = m.testCases || 0;
    const automated = m.automatedTestCases || 0;
    const ratio = tcs > 0 ? Math.round((automated / tcs) * 100) : 0;
    const rEl = root.querySelector('#qa-score-r-val');
    const rSub = root.querySelector('#qa-score-r-sub');
    if (rEl) rEl.textContent = `${ratio}%`;
    if (rSub) rSub.textContent = `${automated}/${tcs} TCs`;
  }

  renderTabBadges(root, summary, trace) {
    const setBadge = (id, count) => {
      const el = root.querySelector(id);
      if (!el) return;
      if (count > 0) {
        el.textContent = String(count);
        el.style.display = 'inline-flex';
      } else {
        el.style.display = 'none';
      }
    };

    const docCount = (trace && trace.requirements ? trace.requirements.length : 0);
    setBadge('#qa-badge-docs', docCount);

    const findingsCount = (summary && Array.isArray(summary.findings) ? summary.findings.length : 0);
    setBadge('#qa-badge-findings', findingsCount);

    const candCount = (this.qaSlice.candidates ? this.qaSlice.candidates.length : 0);
    setBadge('#qa-badge-candidates', candCount);

    const decCount = (this.qaSlice.decisions && Array.isArray(this.qaSlice.decisions.decisions)
      ? this.qaSlice.decisions.decisions.length : 0);
    setBadge('#qa-badge-decisions', decCount);

    const conflictCount = (summary && summary.conflicts ? summary.conflicts.length : 0);
    setBadge('#qa-badge-conflicts', conflictCount);
  }

  openReleaseBriefingModal() {
    const modal = document.getElementById('qa-briefing-modal');
    if (!modal) return;
    const summary = this.qaSlice.summary || {};
    const trace = this.qaSlice.trace || {};
    const metrics = trace.metrics || summary.metrics || {};

    const elTitle = modal.querySelector('#qa-briefing-title');
    const elHealth = modal.querySelector('#qa-briefing-health');
    const elCov = modal.querySelector('#qa-briefing-coverage');
    const elFindings = modal.querySelector('#qa-briefing-findings');
    const elRisk = modal.querySelector('#qa-briefing-risk');

    if (elTitle) elTitle.textContent = `Báo Cáo Sẵn Sàng Phát Hành (${new Date().toLocaleDateString('vi-VN')})`;
    if (elHealth) elHealth.textContent = summary.systemHealth || 'HEALTHY';
    if (elCov) elCov.textContent = `${Math.round(metrics.coveragePercent || 0)}%`;
    if (elFindings) elFindings.textContent = `${(summary.findings || []).length} phát hiện`;
    if (elRisk) {
      const risk = (metrics.coveragePercent || 0) >= 80 && (summary.findings || []).length === 0 ? 'Thấp' : 'Trung bình';
      elRisk.textContent = risk;
    }

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }
}
