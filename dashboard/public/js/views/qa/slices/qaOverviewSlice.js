'use strict';

/**
 * dashboard/public/js/views/qa/slices/qaOverviewSlice.js
 * Quản lý vẽ Scorecards điều hành, chỉ số thống kê, source bar và modal Briefing.
 */

import { apiClient } from '../../../core/apiClient.js';

export class QaOverviewSlice {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
  }

  renderSourceBar(root, summary) {
    const bar = root && root.querySelector('#qa-source-bar');
    if (!bar || !this.qaSlice.trace) return;
    const dirs = this.qaSlice.trace.dirs || {};
    const set = (id, value) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = value;
    };
    set('qa-src-requirements', `${dirs.requirements || '?'}/`);
    set('qa-src-testcases', `${dirs.testCases || '?'}/`);
    set('qa-src-specs', `${dirs.specs || '?'}/`);
    set(
      'qa-src-config',
      this.qaSlice.trace.configPath
        ? `theo ${this.qaSlice.trace.configPath}`
        : 'theo mặc định — khai mục qa trong core/config/dashboardConfig.json để đổi',
    );
    bar.hidden = false;

    this.qaSlice._hideAlert();
    const degraded = this.qaSlice._degradedMessage();
    if (degraded) {
      this.qaSlice._showAlert(degraded, 'danger');
      return;
    }
    if (this.qaSlice.trace.available === false) {
      this.qaSlice._showAlert(
        (this.qaSlice.trace.analyzer && this.qaSlice.trace.analyzer.error) || 'Analyzer chưa sẵn sàng.',
        'danger',
      );
    } else if (this.qaSlice.trace.staleCore) {
      this.qaSlice._showAlert(
        'core/config/dashboardConfig.json có khai mục "qa" nhưng bản core/ của repo này chưa hiểu khóa đó, '
        + 'nên cấu hình đang bị bỏ qua và mục QA đọc theo thư mục mặc định. '
        + 'Hoàn tất migration core/ (ai/shared/SATELLITE_CORE_MIGRATION.md) để sync giao nốt core/.',
        'danger',
      );
    } else if (this.qaSlice.trace.specsDirEmpty) {
      this.qaSlice._showAlert(
        `Không đọc được spec nào trong "${dirs.specs}/". Nếu repo này để spec ở chỗ khác, `
        + 'hãy sửa mục qa.specs trong core/config/dashboardConfig.json — nếu không, mọi thứ sẽ trông như đã sạch.',
      );
    }
  }

  renderStats(root, trace) {
    const box = root && root.querySelector('#qa-stats');
    if (!box || !trace) return;
    if (trace.available === false) { box.hidden = true; return; }
    const c = trace.counts || {};
    const set = (id, v) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = String(v ?? 0);
    };
    set('qa-stat-req', c.requirements);
    set('qa-stat-ac', c.acceptanceCriteria);
    set('qa-stat-tc', c.testCases);
    set('qa-stat-auto', trace.automatedCount);
    const summaryMajor = (this.qaSlice.summary && Array.isArray(this.qaSlice.summary.findings))
      ? this.qaSlice.summary.findings.filter((f) => f.severity === 'major' || f.severity === 'blocker').length
      : 0;
    set('qa-stat-major', (trace.majorCount || 0) + summaryMajor);
    box.hidden = false;
  }

  renderExecutiveScorecard(root, summary, trace) {
    if (!root) return;
    const s = summary || this.qaSlice.summary;
    if (!s || !s.metrics) return;
    const m = s.metrics;

    // 1. Sức khỏe Hệ thống
    const healthBadge = root.querySelector('#qa-health-badge');
    const healthStatus = root.querySelector('#qa-health-status');
    const healthIcon = root.querySelector('#qa-health-icon');
    const healthFindings = root.querySelector('#qa-health-findings-text');
    const isHealthy = s.systemHealth === 'HEALTHY';
    if (healthBadge) {
      healthBadge.className = `qa-health-pill ${isHealthy ? 'is-healthy' : 'is-unhealthy'}`;
    }
    if (healthIcon) {
      healthIcon.className = isHealthy ? 'ph-bold ph-shield-check' : 'ph-bold ph-warning-octagon';
    }
    if (healthStatus) healthStatus.textContent = s.systemHealth || 'HEALTHY';
    if (healthFindings) {
      const count = Array.isArray(s.findings) ? s.findings.length : 0;
      healthFindings.textContent = `${count} phát hiện`;
    }

    // 2. Độ bao phủ AC
    const covPercentEl = root.querySelector('#qa-cov-percent');
    const covRatioEl = root.querySelector('#qa-cov-ratio');
    const covProgressEl = root.querySelector('#qa-cov-progress');
    const covPercent = m.coveragePercent != null ? Math.round(m.coveragePercent) : 0;
    if (covPercentEl) covPercentEl.textContent = `${covPercent}%`;
    if (covRatioEl) covRatioEl.textContent = `${m.coveredAcCount || 0}/${m.acceptanceCriteria || 0} ACs được phủ`;
    if (covProgressEl) covProgressEl.style.width = `${Math.min(100, Math.max(0, covPercent))}%`;

    // 3. Automated vs Candidate
    const autoCountEl = root.querySelector('#qa-auto-count');
    const candCountEl = root.querySelector('#qa-candidate-count');
    const tcTotalEl = root.querySelector('#qa-tc-total-sub');
    if (autoCountEl) autoCountEl.textContent = String(m.automatedTests || 0);
    if (candCountEl) candCountEl.textContent = String(m.candidateTests || 0);
    if (tcTotalEl) tcTotalEl.textContent = `${m.testCases || 0} tổng số test cases`;

    // 4. Asset Shield
    const b = s.boundary || {};
    const bStatus = b.status || 'ALIGNED';
    const shieldBadge = root.querySelector('#qa-shield-badge');
    const shieldIcon = root.querySelector('#qa-shield-icon');
    const shieldStatus = root.querySelector('#qa-shield-status');
    const shieldDetails = root.querySelector('#qa-shield-details');
    if (shieldBadge) {
      shieldBadge.className = 'qa-shield-pill';
      if (bStatus === 'ALIGNED') shieldBadge.classList.add('is-aligned');
      else if (bStatus === 'DRIFTED') shieldBadge.classList.add('is-drifted');
      else shieldBadge.classList.add('is-missing');
    }
    if (shieldIcon) {
      shieldIcon.className = bStatus === 'ALIGNED'
        ? 'ph-bold ph-check-circle'
        : (bStatus === 'DRIFTED' ? 'ph-bold ph-warning' : 'ph-bold ph-shield-slash');
    }
    if (shieldStatus) shieldStatus.textContent = bStatus;
    if (shieldDetails) {
      shieldDetails.textContent = `Ship: ${b.shipCount || 0} · Seed: ${b.seedCount || 0} · Own: ${b.ownCount || 0}`;
    }
  }

  renderTabBadges(root, summary, trace) {
    if (!root) return;
    const t = trace || this.qaSlice.trace;
    const s = summary || this.qaSlice.summary;

    // 1. Badge Tài liệu: tổng số tài liệu hiện có
    const docsBadge = root.querySelector('#qa-tab-badge-docs');
    if (docsBadge) {
      const docCount = this.qaSlice.documents ? this.qaSlice.documents.length : 0;
      if (docCount > 0) {
        docsBadge.textContent = String(docCount);
        docsBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
        docsBadge.title = `${docCount} tài liệu`;
        docsBadge.hidden = false;
      } else {
        docsBadge.hidden = true;
      }
    }

    // 2. Badge Vấn đề
    const findingsBadge = root.querySelector('#qa-tab-badge-findings');
    if (findingsBadge) {
      let blockerCount = 0;
      let majorCount = 0;
      let totalCount = 0;
      if (s && Array.isArray(s.findings)) {
        totalCount += s.findings.length;
        blockerCount += s.findings.filter((f) => f.severity === 'blocker').length;
        majorCount += s.findings.filter((f) => f.severity === 'major').length;
      }
      if (t && t.findings) {
        const tf = t.findings;
        const traceMajor = (tf.major || []).length;
        const traceMinor = (tf.minor || []).length;
        const traceInfo = (tf.info || []).length;
        majorCount += traceMajor;
        totalCount += traceMajor + traceMinor + traceInfo;
      }
      if (totalCount > 0) {
        findingsBadge.textContent = String(totalCount);
        findingsBadge.hidden = false;
        if (blockerCount > 0 || majorCount > 0) {
          findingsBadge.className = 'qa-tab-badge qa-tab-badge-danger';
          findingsBadge.title = `Đang có ${totalCount} vấn đề (${blockerCount > 0 ? `${blockerCount} blocker, ` : ''}${majorCount} major) — Cần ưu tiên xử lý trước`;
        } else {
          findingsBadge.className = 'qa-tab-badge qa-tab-badge-warning';
          findingsBadge.title = `Đang có ${totalCount} cảnh báo`;
        }
      } else {
        findingsBadge.textContent = '0';
        findingsBadge.className = 'qa-tab-badge qa-tab-badge-success';
        findingsBadge.title = 'Hệ thống sạch, không có vấn đề';
        findingsBadge.hidden = false;
      }
    }

    // 3. Badge Ứng viên automation
    const candidatesBadge = root.querySelector('#qa-tab-badge-candidates');
    if (candidatesBadge) {
      const candCount = this.qaSlice.candidates ? this.qaSlice.candidates.length : 0;
      candidatesBadge.textContent = String(candCount);
      candidatesBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
      candidatesBadge.title = `${candCount} ứng viên automation`;
      candidatesBadge.hidden = false;
    }

    // 4. Badge Quyết định
    const decisionsBadge = root.querySelector('#qa-tab-badge-decisions');
    if (decisionsBadge) {
      const decList = this.qaSlice.decisions
        ? (Array.isArray(this.qaSlice.decisions.decisions)
          ? this.qaSlice.decisions.decisions
          : (Array.isArray(this.qaSlice.decisions) ? this.qaSlice.decisions : []))
        : [];
      if (decList.length > 0) {
        decisionsBadge.textContent = String(decList.length);
        decisionsBadge.className = 'qa-tab-badge qa-tab-badge-neutral';
        decisionsBadge.hidden = false;
      } else {
        decisionsBadge.hidden = true;
      }
    }
  }

  async openReleaseBriefingModal() {
    const root = this.qaSlice._root();
    if (!root) return;
    const modal = root.querySelector('#qa-release-briefing-modal');
    const content = root.querySelector('#qa-release-briefing-content');
    const closeBtn = root.querySelector('#qa-release-briefing-close');
    const dismissBtn = root.querySelector('#qa-release-briefing-dismiss');
    const copyBtn = root.querySelector('#qa-release-briefing-copy');
    if (!modal || !content) return;

    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
    content.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);"><div class="spinner" style="margin: 0 auto 10px; width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div><p style="margin: 0; font-size: 13px;">Đang tổng hợp số liệu kiểm thử và phân tích bản tin sẵn sàng phát hành...</p></div>';

    const closeModal = () => {
      try { modal.close(); } catch (_) { modal.removeAttribute('open'); }
    };
    if (closeBtn) closeBtn.onclick = closeModal;
    if (dismissBtn) dismissBtn.onclick = closeModal;

    try {
      const stats = this.qaSlice.summary?.metrics || {};
      const totalReq = this.qaSlice.documents?.length || 10;
      const res = await apiClient.post('/api/ai/release-briefing', {
        testMetrics: {
          total: stats.totalTestCases || 20,
          passed: (stats.totalTestCases || 20) - (stats.failingTestCases || 0),
          failed: stats.failingTestCases || 0,
        },
        uncoveredReqCount: Math.max(0, totalReq - (stats.coveredRequirements || totalReq)),
        openBlockersCount: stats.blockingIssues || 0,
        releaseName: 'Release Readiness Overview',
      });

      const verdictColors = {
        GO: '#10b981',
        GO_WITH_CAUTION: '#f59e0b',
        NO_GO: '#ef4444',
      };
      const verdictColor = verdictColors[res.verdict] || '#6b7280';

      content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line);">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700;">Phán quyết phát hành</span>
              <div style="font-size: 22px; font-weight: 800; color: ${verdictColor};">${res.verdict}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700;">Điểm sẵn sàng</span>
              <div style="font-size: 22px; font-weight: 800; color: var(--text);">${res.readinessScore}/100</div>
            </div>
          </div>
          <div style="font-size: 13.5px; font-weight: 600; color: var(--text);">${res.headline || ''}</div>
          <p style="font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0;">${res.rationale || ''}</p>
          ${res.highlights && res.highlights.length ? `
            <div style="background: var(--surface-2); padding: 10px 14px; border-radius: 6px;">
              <strong style="font-size: 12px; color: var(--text); display: block; margin-bottom: 6px;">Điểm sáng chất lượng:</strong>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: var(--muted);">
                ${res.highlights.map((h) => `<li>${h}</li>`).join('')}
              </ul>
            </div>` : ''}
        </div>
      `;

      if (copyBtn) {
        copyBtn.onclick = async () => {
          const md = `# ${res.headline}\n\n**Phán quyết:** ${res.verdict} (${res.readinessScore}/100)\n\n${res.rationale}`;
          try {
            await navigator.clipboard.writeText(md);
          } catch (_) {}
        };
      }
    } catch (err) {
      content.innerHTML = `<div style="padding: 16px; color: var(--danger);">Lỗi tải bản tin: ${err.message}</div>`;
    }
  }
}
