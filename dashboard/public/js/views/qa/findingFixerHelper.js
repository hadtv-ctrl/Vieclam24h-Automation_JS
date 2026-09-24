// master-process-disable-size-check: AI Static Finding & Gap fixer helper for QA view
/**
 * dashboard/public/js/views/qa/findingFixerHelper.js
 * Quản lý vòng đời và tương tác của Modal AI Hỗ Trợ Khắc Phục Lỗ Hổng Kỹ Thuật (Static Finding Fixer).
 *
 * Tuân thủ quy chuẩn OWN-01..05:
 * - Quản lý disposers chặt chẽ, dọn sạch listeners khi view unmount.
 * - KHÔNG dùng innerHTML cho dữ liệu đọc từ repo/AI, mọi nội dung dựng bằng textContent và DOM node.
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';

export class FindingFixerHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
    this.currentFinding = null;
    this.currentAnalysis = null;
    this.rootNode = null;
  }

  init(root) {
    this.destroy();
    if (!root) return;
    this.rootNode = root;

    const modal = root.querySelector('#qa-finding-fix-modal');
    const closeBtn = root.querySelector('#qa-finding-fix-close');
    const cancelBtn = root.querySelector('#qa-finding-fix-btn-close');
    const applyBtn = root.querySelector('#qa-finding-fix-btn-apply');
    const copyBtn = root.querySelector('#qa-finding-fix-copy-snippet');

    if (!modal) return;

    const addEvt = (target, evt, handler) => {
      if (!target) return;
      target.addEventListener(evt, handler);
      this.disposers.push(() => target.removeEventListener(evt, handler));
    };

    const closeModal = () => {
      try {
        modal.close();
      } catch (_) {
        modal.removeAttribute('open');
      }
    };

    addEvt(closeBtn, 'click', closeModal);
    addEvt(cancelBtn, 'click', closeModal);
    addEvt(applyBtn, 'click', () => this.applyFix(root));
    addEvt(copyBtn, 'click', () => this.copySnippet());
  }

  destroy() {
    this.disposers.forEach((dispose) => {
      try { dispose(); } catch (_) {}
    });
    this.disposers = [];
    this.currentFinding = null;
    this.currentAnalysis = null;
    this.rootNode = null;
  }

  async openModal(root, finding) {
    if (!root || !finding) return;
    this.rootNode = root;
    this.currentFinding = finding;
    this.currentAnalysis = null;

    const modal = root.querySelector('#qa-finding-fix-modal');
    if (!modal) return;

    // Reset visual states
    this._populateBanner(root, finding);
    this._showLoading(root);
    this.checkAiStatus(root);

    try {
      modal.showModal();
    } catch (_) {
      modal.setAttribute('open', '');
    }

    // Tự động kích hoạt phân tích
    await this.runAnalysis(root, finding);
  }

  _populateBanner(root, finding) {
    const sevBadge = root.querySelector('#qa-fix-issue-severity');
    const kindEl = root.querySelector('#qa-fix-issue-kind');
    const whereEl = root.querySelector('#qa-fix-issue-where');
    const msgEl = root.querySelector('#qa-fix-issue-message');

    const severity = (finding.severity || 'warn').toLowerCase();
    if (sevBadge) {
      sevBadge.textContent = severity.toUpperCase();
      sevBadge.className = `qa-badge qa-badge-${severity === 'blocker' || severity === 'major' ? 'danger' : 'warn'}`;
    }

    if (kindEl) kindEl.textContent = finding.label || finding.kind || 'Lỗ hổng kỹ thuật';
    if (whereEl) whereEl.textContent = finding.where || finding.id || '(Không xác định)';
    if (msgEl) {
      msgEl.textContent = finding.message || finding.detail || '';
      if (finding.action) {
        msgEl.textContent += ` ➔ Hướng dẫn: ${finding.action}`;
      }
    }
  }

  async checkAiStatus(root) {
    const badge = root.querySelector('#qa-fix-ai-engine-badge');
    if (!badge) return;

    badge.textContent = 'Đang kiểm tra AI...';
    badge.style.background = 'rgba(156, 163, 175, 0.15)';
    badge.style.color = 'var(--muted)';

    try {
      const config = await apiClient.get('/api/ai/config');
      if (config && config.hasKey) {
        badge.textContent = `🟢 Sẵn sàng (${config.provider} - ${config.model})`;
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#10b981';
      } else {
        badge.textContent = '⚪ Heuristic Rule Engine (Offline)';
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = '#f59e0b';
      }
    } catch (_) {
      badge.textContent = '⚪ Heuristic Rule Engine';
      badge.style.background = 'rgba(156, 163, 175, 0.15)';
      badge.style.color = 'var(--muted)';
    }
  }

  _showLoading(root) {
    const loading = root.querySelector('#qa-finding-fix-loading');
    const errorBox = root.querySelector('#qa-finding-fix-error');
    const results = root.querySelector('#qa-finding-fix-results');
    const applyBtn = root.querySelector('#qa-finding-fix-btn-apply');

    if (loading) loading.style.display = 'block';
    if (errorBox) errorBox.style.display = 'none';
    if (results) results.style.display = 'none';
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.style.opacity = '0.6';
    }
  }

  async runAnalysis(root, finding) {
    const loading = root.querySelector('#qa-finding-fix-loading');
    const errorBox = root.querySelector('#qa-finding-fix-error');
    const errorMsg = root.querySelector('#qa-finding-fix-error-msg');
    const results = root.querySelector('#qa-finding-fix-results');

    try {
      const res = await apiClient.post('/api/qa/finding/ai-analyze-fix', { finding });

      if (!res || !res.analysis) {
        throw new Error('Dữ liệu phân tích trả về rỗng.');
      }

      this.currentAnalysis = res.analysis;

      if (loading) loading.style.display = 'none';
      if (errorBox) errorBox.style.display = 'none';
      if (results) results.style.display = 'flex';

      this.renderResults(root, res.analysis, finding);
      toast.success(res.engine === 'ai' ? 'AI đã phân tích và thiết kế bản vá!' : 'Đã phân tích qua Heuristic Rule Engine!');
    } catch (err) {
      if (loading) loading.style.display = 'none';
      if (results) results.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'block';
        if (errorMsg) errorMsg.textContent = err.message || 'Không thể kết nối dịch vụ phân tích lỗi.';
      }
      toast.error(`Lỗi phân tích: ${err.message || 'Không xác định'}`);
    }
  }

  renderResults(root, analysis, finding) {
    const rootCauseEl = root.querySelector('#qa-fix-root-cause');
    const explanationEl = root.querySelector('#qa-fix-explanation');
    const diffFileEl = root.querySelector('#qa-fix-diff-file');
    const patchTypeEl = root.querySelector('#qa-fix-patch-type');
    const diffViewer = root.querySelector('#qa-fix-diff-viewer');
    const applyBtn = root.querySelector('#qa-finding-fix-btn-apply');

    if (rootCauseEl) rootCauseEl.textContent = analysis.rootCause || 'Đã phân tích lỗ hổng kỹ thuật.';
    if (explanationEl) explanationEl.textContent = analysis.explanation || 'Áp dụng đề xuất khắc phục.';
    if (diffFileEl) diffFileEl.textContent = analysis.targetFile || finding.where || '';
    if (patchTypeEl) {
      patchTypeEl.textContent = analysis.patchType || 'replace_lines';
      patchTypeEl.className = analysis.patchType === 'create_file'
        ? 'qa-badge qa-badge-success'
        : analysis.patchType === 'replace_lines'
          ? 'qa-badge qa-badge-info'
          : 'qa-badge qa-badge-warn';
    }

    // Render Diff Viewer an toàn không dùng innerHTML
    if (diffViewer) {
      diffViewer.textContent = '';
      const diffText = analysis.diff || '';
      const lines = diffText.split(/\r?\n/);

      if (lines.length > 0 && diffText.trim().length > 0) {
        lines.forEach((line) => {
          const row = document.createElement('div');
          row.style.whiteSpace = 'pre-wrap';
          row.style.wordBreak = 'break-all';
          row.style.padding = '1px 6px';
          row.style.borderRadius = '3px';
          row.style.fontFamily = 'monospace';

          if (line.startsWith('---') || line.startsWith('+++')) {
            row.style.color = 'var(--muted)';
            row.style.fontWeight = '600';
            row.textContent = line;
          } else if (line.startsWith('-')) {
            row.style.background = 'rgba(239, 68, 68, 0.15)';
            row.style.color = '#ef4444';
            row.textContent = line;
          } else if (line.startsWith('+')) {
            row.style.background = 'rgba(16, 185, 129, 0.15)';
            row.style.color = '#10b981';
            row.textContent = line;
          } else {
            row.style.color = 'var(--text)';
            row.textContent = line;
          }
          diffViewer.appendChild(row);
        });
      } else {
        const noDiff = document.createElement('div');
        noDiff.style.color = 'var(--muted)';
        noDiff.style.fontStyle = 'italic';
        noDiff.textContent = '(Không có thay đổi mã nguồn dạng diff, vui lòng xem hướng dẫn chi tiết bên trên)';
        diffViewer.appendChild(noDiff);
      }
    }

    // Kích hoạt nút áp dụng
    if (applyBtn) {
      const isManual = analysis.patchType === 'manual_guide' || (!analysis.fixedSnippet && !analysis.fullContent);
      applyBtn.disabled = isManual;
      applyBtn.style.opacity = isManual ? '0.5' : '1';
      applyBtn.title = isManual ? 'Lỗi này cần thao tác cấu hình thủ công theo chỉ dẫn' : 'Lưu bản vá trực tiếp vào file';
    }
  }

  async applyFix(root) {
    if (!this.currentAnalysis) return;

    const applyBtn = root.querySelector('#qa-finding-fix-btn-apply');
    const origBtnText = applyBtn ? applyBtn.innerHTML : '';

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Đang lưu bản vá...';
    }

    try {
      const res = await apiClient.post('/api/qa/finding/apply-fix', {
        targetFile: this.currentAnalysis.targetFile,
        patchType: this.currentAnalysis.patchType,
        originalSnippet: this.currentAnalysis.originalSnippet,
        fixedSnippet: this.currentAnalysis.fixedSnippet,
        fullContent: this.currentAnalysis.fullContent,
      });

      toast.success(res.message || 'Đã áp dụng bản vá thành công!');

      // Đóng modal
      const modal = root.querySelector('#qa-finding-fix-modal');
      if (modal) {
        try { modal.close(); } catch (_) { modal.removeAttribute('open'); }
      }

      // Quét lại QA để tự động cập nhật danh sách Static Findings
      if (this.qaSlice && typeof this.qaSlice.reload === 'function') {
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Không thể áp dụng bản vá: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerHTML = origBtnText;
      }
    }
  }

  async copySnippet() {
    if (!this.currentAnalysis) return;
    const textToCopy = this.currentAnalysis.fixedSnippet || this.currentAnalysis.fullContent || this.currentAnalysis.diff || '';
    if (!textToCopy) {
      toast.warn('Chưa có đoạn mã đề xuất để sao chép.');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Đã sao chép đoạn mã sửa đổi vào clipboard!');
    } catch (_) {
      toast.warn('Trình duyệt chặn clipboard. Hãy bôi đen để sao chép.');
    }
  }
}
