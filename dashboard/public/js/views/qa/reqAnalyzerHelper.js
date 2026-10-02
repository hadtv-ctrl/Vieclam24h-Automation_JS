// master-process-disable-size-check: Requirement QA Impact and Test Analyzer modal helper
/**
 * dashboard/public/js/views/qa/reqAnalyzerHelper.js
 * Quản lý vòng đời và tương tác của Modal Phân Tích Yêu Cầu & Đánh Giá Tác Động QA (Requirement Analyzer).
 * Tuân thủ quy chuẩn OWN-01..05: quản lý disposer sạch sẽ, không rò rỉ event listeners.
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';
import { mountSpecPanels } from './specStudio/specStudioPanels.js';

export class ReqAnalyzerHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
    this.currentResult = null;
    this.currentTestCases = [];
    this.currentRawText = '';
  }

  init(root) {
    this.destroy();
    if (!root) return;

    const modal = root.querySelector('#qa-req-analyzer-modal');
    const openBtn = root.querySelector('#qa-btn-analyze-req');
    const closeBtn = root.querySelector('#qa-req-analyzer-close');
    const cancelBtn = root.querySelector('#qa-req-analyzer-btn-cancel');
    const submitBtn = root.querySelector('#qa-req-analyzer-btn-submit');
    const sampleBtn = root.querySelector('#qa-req-analyzer-sample-btn');
    const reinputBtn = root.querySelector('#qa-req-analyzer-btn-reinput');
    const copyBtn = root.querySelector('#qa-req-analyzer-btn-copy');
    const scaffoldBtn = root.querySelector('#qa-req-analyzer-btn-scaffold');
    const formatJiraBtn = root.querySelector('#qa-req-btn-format-jira');
    const jiraKeyInput = root.querySelector('#qa-req-jira-key');
    const clarityBtn = root.querySelector('#qa-req-btn-clarity');
    const generateTcBtn = root.querySelector('#qa-req-btn-generate-tc');

    if (!modal) return;

    const addEvt = (target, evt, handler) => {
      if (!target) return;
      target.addEventListener(evt, handler);
      this.disposers.push(() => target.removeEventListener(evt, handler));
    };

    // Chuyển Jira Markup sang Markdown
    addEvt(formatJiraBtn, 'click', () => {
      const textarea = root.querySelector('#qa-req-analyzer-text');
      if (!textarea || !textarea.value.trim()) {
        toast.info('Vui lòng dán nội dung requirement trước khi chuyển đổi.');
        return;
      }
      const original = textarea.value;
      const formatted = this.parseJiraMarkup(original);
      textarea.value = formatted;

      if (jiraKeyInput && !jiraKeyInput.value.trim()) {
        const detectedKey = this.extractJiraKey(original) || this.extractJiraKey(formatted);
        if (detectedKey) jiraKeyInput.value = detectedKey;
      }
      toast.success('Đã chuyển đổi Jira markup sang Markdown.');
    });

    this.specPanels = mountSpecPanels(root, {
      switchTab: (tab) => this.switchTab(root, tab),
      showResults: () => {
        const inSec = root.querySelector('#qa-req-analyzer-input-section');
        const resSec = root.querySelector('#qa-req-analyzer-results-section');
        if (inSec) inSec.style.display = 'none';
        if (resSec) resSec.style.display = 'flex';
      },
      showInput: () => this.showInputView(root)
    });

    // Mở modal
    addEvt(openBtn, 'click', () => this.openModal(root));

    // Đóng modal (có dirty guard)
    const closeModal = async (event) => {
      if (this.specPanels) {
        const canClose = await this.specPanels.confirmClose();
        if (!canClose) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          return;
        }
      }
      try { modal.close(); } catch (_) {}
    };
    addEvt(closeBtn, 'click', closeModal);
    addEvt(cancelBtn, 'click', closeModal);
    addEvt(modal, 'cancel', closeModal);

    // Nạp requirement mẫu
    addEvt(sampleBtn, 'click', () => {
      const textarea = root.querySelector('#qa-req-analyzer-text');
      if (textarea) {
        textarea.value = `Tính năng: Bổ sung trường "Trung tâm sát hạch" trên Hồ sơ Giáo viên
1. Bối cảnh:
- Hồ sơ giáo viên có thêm trường "Trung tâm sát hạch" đứng cạnh "Trung tâm đang công tác".
- Cho phép chọn từ danh sách hoặc "Thêm trung tâm mới" (trung tâm mới ở trạng thái chờ duyệt).
- Có nút "Dùng lại trung tâm đang công tác" để sao chép nhanh khi 2 ô khác nhau.

2. Quy tắc nghiệp vụ (Business Rules):
- Mã số thuế (MST) KHÔNG bắt buộc khi tạo trung tâm sát hạch mới (ở trung tâm công tác thì vẫn bắt buộc).
- Bắt buộc cả khi tạo mới và khi cập nhật — hồ sơ cũ chưa có sẽ bị chặn lưu và hiển thị toast "Vui lòng chọn hoặc tạo trung tâm sát hạch".
- Khu vực đào tạo (phường/xã) nâng giới hạn lựa chọn tối đa từ 6 lên 10 mục. Chọn đến mục thứ 11 sẽ bị hệ thống chặn.
- Nút "Dùng lại trung tâm đang công tác" tự động ẩn đi sau khi bấm do 2 ô đã trùng giá trị.`;
        textarea.focus();
        toast.info('Đã nạp văn bản requirement mẫu.');
      }
    });

    // Quay lại màn hình nhập liệu
    addEvt(reinputBtn, 'click', () => {
      this.showInputView(root);
    });

    // Bắt đầu phân tích
    addEvt(submitBtn, 'click', () => this.runAnalysis(root));

    // BA-1: Soát độ rõ requirement
    addEvt(clarityBtn, 'click', () => this.runClarityCheck(root));

    // QA-1: Sinh test case từ AC
    addEvt(generateTcBtn, 'click', () => this.runGenerateTestCases(root));

    // QA-2: Sinh Playwright spec từ test cases
    const generateSpecBtn = root.querySelector('#qa-req-btn-generate-spec');
    if (generateSpecBtn) {
      addEvt(generateSpecBtn, 'click', () => this.runGenerateSpec(root));
    }

    // Chuyển Tabs kết quả
    const tabBtns = root.querySelectorAll('.qa-req-tab');
    tabBtns.forEach((tabBtn) => {
      addEvt(tabBtn, 'click', () => {
        const tabKey = tabBtn.getAttribute('data-tab');
        this.switchTab(root, tabKey);
      });
    });

    // Sao chép báo cáo Markdown
    addEvt(copyBtn, 'click', () => this.copyMarkdownReport());

    // 1-Click Scaffold
    addEvt(scaffoldBtn, 'click', () => this.scaffoldFiles(root));
  }

  async runClarityCheck(root) {
    const textarea = root.querySelector('#qa-req-analyzer-text');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
      toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi soát độ rõ.');
      if (textarea) textarea.focus();
      return;
    }

    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');

    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
      const res = await apiClient.post('/api/ai/req-clarity', {
        requirementText: rawText,
        title: this.extractJiraKey(rawText) || 'Requirement',
      });

      if (!res.ok) throw new Error(res.error || 'Lỗi khi soát requirement');

      if (loadingSection) loadingSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'flex';

      this.renderClarityResult(root, res);
      const scoreBadge = root.querySelector('#qa-req-tab-clarity-score');
      if (scoreBadge) scoreBadge.textContent = `${res.score}/100`;

      this.switchTab(root, 'clarity');
      toast.success(`Đã soát độ rõ thành công (Điểm: ${res.score}/100)!`);
    } catch (err) {
      if (loadingSection) loadingSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'flex';
      toast.error(`Lỗi soát độ rõ: ${err.message}`);
    }
  }

  renderClarityResult(root, res) {
    const container = root.querySelector('#qa-req-clarity-result');
    if (!container) return;
    container.innerHTML = '';

    const scoreColors = {
      clear: '#10b981',
      needs_clarification: '#f59e0b',
      ambiguous: '#ef4444'
    };
    const statusLabels = {
      clear: 'Rõ ràng (Đạt chuẩn)',
      needs_clarification: 'Cần làm rõ thêm',
      ambiguous: 'Quá mơ hồ / Thiếu tiêu chí'
    };
    const color = scoreColors[res.status] || '#f59e0b';
    const label = statusLabels[res.status] || res.status;

    const ambiguitiesHtml = (res.ambiguities || []).map((a) => `
      <div style="background: var(--surface-2); border: 1px solid var(--line); border-left: 3px solid ${color}; border-radius: 6px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: ${color}; font-size: 13px;">"${this._escape(a.phrase)}"</strong>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--line); color: var(--muted);">Cụm từ định tính</span>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;"><strong>Vấn đề:</strong> ${this._escape(a.reason)}</div>
        <div style="font-size: 12px; color: var(--accent);"><strong>Đề xuất viết lại:</strong> ${this._escape(a.suggestion)}</div>
      </div>
    `).join('');

    const missingHtml = (res.missingAspects || []).map((m) => `
      <span style="font-size: 11.5px; padding: 3px 8px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2);">
        <i class="ph-bold ph-warning"></i> ${this._escape(m)}
      </span>
    `).join(' ');

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; font-weight: 700; color: ${color};">${res.score}/100</span>
            <span style="font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: color-mix(in srgb, ${color} 15%, transparent); color: ${color};">${label}</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 12.5px; color: var(--text);">${this._escape(res.summary || '')}</p>
        </div>
      </div>

      ${res.missingAspects?.length ? `
        <div>
          <strong style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px;">CÁC GÓC CẠNH CÒN THIẾU TIÊU CHÍ KIỂM ĐỊNH:</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">${missingHtml}</div>
        </div>
      ` : ''}

      <div>
        <strong style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px;">DANH SÁCH CỤM TỪ MƠ HỒ CẦN LÀM RÕ (${res.ambiguities?.length || 0}):</strong>
        <div style="display: flex; flex-direction: column; gap: 8px;">${ambiguitiesHtml || '<p style="color: var(--muted); font-size: 12px;">Không phát hiện từ ngữ mơ hồ.</p>'}</div>
      </div>

      ${res.clarifiedDraft ? `
        <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 12.5px; color: var(--accent);"><i class="ph-bold ph-note-pencil"></i> Bản nháp BDD (Given-When-Then) — điền các chỗ &lt;…&gt;:</strong>
            <button type="button" class="btn-text-sm" id="btn-copy-bdd-draft" style="color: var(--accent); font-size: 11.5px; cursor: pointer; border: none; background: transparent;">
              <i class="ph-bold ph-copy"></i> Sao chép BDD
            </button>
          </div>
          <pre style="margin: 0; padding: 10px; background: var(--surface); border-radius: 6px; font-size: 12px; line-height: 1.5; color: var(--text); white-space: pre-wrap; word-break: break-word;"><code>${this._escape(res.clarifiedDraft)}</code></pre>
        </div>
      ` : ''}
    `;

    const copyBddBtn = container.querySelector('#btn-copy-bdd-draft');
    if (copyBddBtn) {
      copyBddBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(res.clarifiedDraft);
          toast.success('Đã sao chép văn bản BDD viết lại vào clipboard!');
        } catch (_) {
          toast.warn('Không thể sao chép tự động.');
        }
      });
    }
  }

  async runGenerateTestCases(root) {
    const textarea = root.querySelector('#qa-req-analyzer-text');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
      toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi sinh test cases.');
      if (textarea) textarea.focus();
      return;
    }

    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');

    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
      const jiraKeyInput = root.querySelector('#qa-req-jira-key');
      const reqId = jiraKeyInput?.value.trim() || this.extractJiraKey(rawText) || 'REQ-001';

      const res = await apiClient.post('/api/ai/generate-tc', {
        criteriaText: rawText,
        startTcNumber: 1
      });

      if (!res.ok) throw new Error(res.error || 'Lỗi khi sinh test cases');

      if (loadingSection) loadingSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'flex';

      const typeLabels = { positive: 'Positive', negative: 'Negative', boundary: 'Boundary' };
      const formattedTcs = (res.testCases || []).map((tc) => ({
        suggestedId: tc.tcId,
        acId: tc.acId,
        title: tc.title,
        type: typeLabels[tc.type] || 'Positive',
        priority: tc.priority || 'P1',
        precondition: tc.given,
        steps: Array.isArray(tc.steps) && tc.steps.length
          ? tc.steps
          : [{ step: 1, action: tc.when, expected: tc.then }],
        testData: tc.testData || ''
      }));

      this.currentTestCasesText = rawText;
      this.renderTestCases(root, formattedTcs);
      const tabTcCount = root.querySelector('#qa-req-tab-tc-count');
      const statTc = root.querySelector('#qa-req-stat-tc');
      if (tabTcCount) tabTcCount.textContent = String(formattedTcs.length);
      if (statTc) statTc.textContent = `${formattedTcs.length} TCs`;

      this.switchTab(root, 'tc');
      toast.success(`Đã sinh ${formattedTcs.length} test case. ${res.coverageNotes || ''}`.trim());
    } catch (err) {
      if (loadingSection) loadingSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'flex';
      toast.error(`Lỗi sinh test cases: ${err.message}`);
    }
  }

  async runGenerateSpec(root) {
    const textarea = root.querySelector('#qa-req-analyzer-text');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
      toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi sinh Playwright spec.');
      if (textarea) textarea.focus();
      return;
    }

    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');

    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
      const jiraKeyInput = root.querySelector('#qa-req-jira-key');
      const reqId = jiraKeyInput?.value.trim() || this.extractJiraKey(rawText) || 'REQ-001';

      const res = await apiClient.post('/api/ai/generate-spec', {
        reqId,
        tcList: this.currentTestCasesText === rawText ? (this.currentTestCases || []) : [],
        criteriaText: rawText
      });

      if (!res.specCode) throw new Error(res.error || 'Không sinh được mã nguồn spec.');

      if (loadingSection) loadingSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'flex';

      this.renderSpecResult(root, res);
      const tabSpecStatus = root.querySelector('#qa-req-tab-spec-status');
      if (tabSpecStatus) tabSpecStatus.textContent = 'Đã sinh';

      this.switchTab(root, 'spec');
      toast.success(`Đã sinh mã Playwright spec (${res.fileName}) thành công!`);
    } catch (err) {
      if (loadingSection) loadingSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'flex';
      toast.error(`Lỗi sinh spec: ${err.message}`);
    }
  }

  renderSpecResult(root, res) {
    const container = root.querySelector('#qa-req-spec-result');
    if (!container) return;

    container.innerHTML = `
      <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <i class="ph-bold ph-file-code" style="color: #6366f1; font-size: 18px;"></i>
            <strong style="font-family: var(--font-mono, monospace); font-size: 13px;">${this._escape(res.fileName || 'spec.js')}</strong>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(99, 102, 241, 0.15); color: #6366f1; font-weight: 600;">
              ${(res.tests || []).filter((t) => t.runnable).length}/${(res.tests || []).length} test chạy được
            </span>
          </div>
          <button type="button" class="btn-secondary-sm" id="btn-copy-spec-code" style="font-size: 11.5px;">
            <i class="ph-bold ph-copy"></i> Sao chép mã Spec
          </button>
        </div>
        <p style="font-size: 12px; color: var(--muted); margin: 0;">${this._escape(res.summary || '')}</p>
        <pre style="margin: 0; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.5; color: var(--text); overflow-x: auto; max-height: 380px;"><code>${this._escape(res.specCode || '')}</code></pre>
      </div>
    `;

    const copyBtn = container.querySelector('#btn-copy-spec-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(res.specCode || '');
          toast.success('Đã sao chép mã Playwright spec vào clipboard!');
        } catch (_) {
          toast.warn('Không thể tự động ghi vào clipboard.');
        }
      });
    }
  }

  async openModal(root) {
    const modal = root.querySelector('#qa-req-analyzer-modal');
    if (!modal) return;

    this.showInputView(root);
    this.checkAiStatus(root);

    try {
      modal.showModal();
    } catch (_) {
      modal.setAttribute('open', '');
    }
  }

  async checkAiStatus(root) {
    const badge = root.querySelector('#qa-req-analyzer-ai-badge');
    if (!badge) return;

    badge.textContent = 'Đang kiểm tra AI...';
    badge.style.background = 'var(--surface-variant, rgba(156, 163, 175, 0.15))';
    badge.style.color = 'var(--muted)';

    try {
      const config = await apiClient.get('/api/ai/config');
      if (config && config.hasKey) {
        badge.textContent = `🟢 Sẵn sàng (${config.provider} - ${config.model})`;
        badge.style.background = 'var(--success-subtle, rgba(16, 185, 129, 0.15))';
        badge.style.color = 'var(--success)';
      } else {
        badge.textContent = '⚪ Chưa cấu hình Key';
        badge.style.background = 'var(--danger-subtle, rgba(239, 68, 68, 0.15))';
        badge.style.color = 'var(--danger)';
      }
    } catch (_) {
      badge.textContent = '⚪ Không khả dụng';
    }
  }

  showInputView(root) {
    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');
    const copyBtn = root.querySelector('#qa-req-analyzer-btn-copy');
    const scaffoldBtn = root.querySelector('#qa-req-analyzer-btn-scaffold');

    if (inputSection) inputSection.style.display = 'flex';
    if (loadingSection) loadingSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
    if (scaffoldBtn) scaffoldBtn.style.display = 'none';
  }

  async runAnalysis(root) {
    const textarea = root.querySelector('#qa-req-analyzer-text');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
      toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi phân tích.');
      if (textarea) textarea.focus();
      return;
    }

    this.currentRawText = rawText;
    const mode = root.querySelector('input[name="qa-req-mode"]:checked')?.value || 'heuristic';
    const scanExisting = Boolean(root.querySelector('#qa-req-analyzer-scan-ctx')?.checked);

    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');

    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    if (this._activeRequest) {
      try { this._activeRequest.cancel(); } catch (_) {}
      this._activeRequest = null;
    }

    if (window.AiStatus && !this._statusBar && loadingSection) {
      this._statusBar = window.AiStatus.createAiStatusBar({
        container: loadingSection,
        onCancel: () => {
          if (this._activeRequest) {
            try { this._activeRequest.cancel(); } catch (_) {}
            this._activeRequest = null;
          }
          if (this._statusBar) this._statusBar.clear();
          this.showInputView(root);
          toast.info('Đã hủy phân tích requirement.');
        },
        onRetry: () => this.runAnalysis(root),
      });
    }

    if (this._statusBar) {
      this._statusBar.setPending(mode === 'ai' ? 'Đang chờ AI phân tích requirement…' : 'Đang phân tích requirement…', { showCancel: true });
    }

    const startAi = window.AiRequest && typeof window.AiRequest.startAiRequest === 'function';
    try {
      let res;
      if (startAi) {
        this._activeRequest = window.AiRequest.startAiRequest({
          url: '/api/qa/analyze-requirement',
          body: { rawText, mode, scanExisting },
          timeoutMs: 60000,
          owner: this,
        });
        res = await this._activeRequest.promise;
      } else {
        res = await apiClient.post('/api/qa/analyze-requirement', { rawText, mode, scanExisting });
      }
      const jiraKeyInput = root.querySelector('#qa-req-jira-key');
      if (jiraKeyInput && !jiraKeyInput.value.trim()) {
        const detected = this.extractJiraKey(rawText);
        if (detected) jiraKeyInput.value = detected;
      }
      if (res && jiraKeyInput?.value.trim()) {
        res.source = jiraKeyInput.value.trim();
      }

      this.currentResult = res;
      if (this._statusBar) this._statusBar.clear();
      if (loadingSection) loadingSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'flex';

      this.currentTestCasesText = rawText;
      this.renderResults(root, res);
      toast.success('Phân tích requirement thành công!');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'CANCELLED' || err.message === 'Tác vụ đã được hủy.') {
        this.showInputView(root);
        return;
      }
      if (this._statusBar) {
        this._statusBar.setError(err.message || 'Lỗi phân tích requirement.', { showRetry: true });
      } else {
        if (loadingSection) loadingSection.style.display = 'none';
        if (inputSection) inputSection.style.display = 'flex';
      }
      toast.error(`Lỗi phân tích: ${err.message || 'Không thể xử lý yêu cầu.'}`);
    } finally {
      this._activeRequest = null;
    }
  }

  renderResults(root, data) {
    // 1. Header scorecard metrics
    const statTc = root.querySelector('#qa-req-stat-tc');
    const statRisk = root.querySelector('#qa-req-stat-risk');
    const statImpacted = root.querySelector('#qa-req-stat-impacted');
    const statLogic = root.querySelector('#qa-req-stat-logic');
    const statQa = root.querySelector('#qa-req-stat-qa');

    const tcCount = data.testCaseEstimation?.totalCount || data.testCaseEstimation?.testCases?.length || 0;
    const riskLevel = data.systemImpact?.riskLevel || 'Trung bình';
    const impactedCount = data.existingTestCasesImpact?.length || 0;
    const logicCount = data.logicClarifications?.length || 0;
    const qaCount = data.qaTeamInquiries?.length || 0;

    if (statTc) statTc.textContent = `${tcCount} TCs`;
    if (statRisk) {
      statRisk.textContent = riskLevel;
      statRisk.style.color = riskLevel === 'Cao' ? 'var(--danger)' : riskLevel === 'Thấp' ? 'var(--success)' : 'var(--warning)';
    }
    if (statImpacted) statImpacted.textContent = `${impactedCount} TC`;
    if (statLogic) statLogic.textContent = String(logicCount);
    if (statQa) statQa.textContent = String(qaCount);

    // Tab counters
    const tabTcCount = root.querySelector('#qa-req-tab-tc-count');
    const tabImpactCount = root.querySelector('#qa-req-tab-impact-count');
    const tabLogicCount = root.querySelector('#qa-req-tab-logic-count');
    const tabQaCount = root.querySelector('#qa-req-tab-qa-count');
    if (tabTcCount) tabTcCount.textContent = String(tcCount);
    if (tabImpactCount) tabImpactCount.textContent = String(impactedCount);
    if (tabLogicCount) tabLogicCount.textContent = String(logicCount);
    if (tabQaCount) tabQaCount.textContent = String(qaCount);

    // Fallback notice nếu có
    const fallbackAlert = root.querySelector('#qa-req-fallback-alert');
    const fallbackText = root.querySelector('#qa-req-fallback-text');
    if (fallbackAlert && fallbackText) {
      if (data.fallbackNotice) {
        fallbackText.textContent = data.fallbackNotice;
        fallbackAlert.style.display = 'block';
      } else {
        fallbackAlert.style.display = 'none';
      }
    }

    // 2. Render Panel 1: Test Cases
    this.renderTestCases(root, data.testCaseEstimation?.testCases || []);

    // 3. Render Panel 2: System Impact & Existing TCs
    this.renderSystemImpact(root, data.systemImpact, data.existingTestCasesImpact || []);

    // 4. Render Panel 3: Logic Clarifications
    this.renderLogicClarifications(root, data.logicClarifications || []);

    // 5. Render Panel 4: QA Inquiries
    this.renderQaInquiries(root, data.qaTeamInquiries || []);

    // Hiển thị action buttons trong footer
    const copyBtn = root.querySelector('#qa-req-analyzer-btn-copy');
    const scaffoldBtn = root.querySelector('#qa-req-analyzer-btn-scaffold');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
    if (scaffoldBtn) scaffoldBtn.style.display = 'inline-flex';

    // Mặc định về Tab 1
    this.switchTab(root, 'tc');
  }

  renderTestCases(root, testCases) {
    // "Sinh Spec" đọc lại đúng danh sách đang hiển thị (từ Phân tích hoặc Sinh Test Case).
    this.currentTestCases = testCases;
    const container = root.querySelector('#qa-req-tc-list');
    if (!container) return;
    container.innerHTML = '';

    if (!testCases.length) {
      container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không có test case nào được đề xuất.</p>';
      return;
    }

    testCases.forEach((tc) => {
      const card = document.createElement('div');
      card.className = 'qa-inferred-card';
      card.style.background = 'var(--surface-2)';

      const typeColors = {
        Positive: '#10b981',
        Negative: '#ef4444',
        Boundary: '#f59e0b',
        'Edge Case': '#8b5cf6',
        Security: '#ec4899',
      };
      const typeColor = typeColors[tc.type] || '#6b7280';

      const stepsHtml = (tc.steps || []).map((s) => `
        <tr>
          <td style="width: 40px; text-align: center; font-weight: 600;">${s.step}</td>
          <td>${this._escape(s.action)}</td>
          <td>${this._escape(s.expected)}</td>
        </tr>
      `).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="qa-inferred-id-badge" style="background: var(--accent);">${this._escape(tc.suggestedId || 'TC')}</span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; background: color-mix(in srgb, ${typeColor} 15%, transparent); color: ${typeColor}; border: 1px solid color-mix(in srgb, ${typeColor} 30%, transparent);">${this._escape(tc.type || 'Functional')}</span>
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: var(--surface); border: 1px solid var(--line);">${this._escape(tc.priority || 'P1')}</span>
          </div>
          ${tc.precondition ? `<small style="font-size: 11.5px; color: var(--muted);"><strong>Tiền điều kiện:</strong> ${this._escape(tc.precondition)}</small>` : ''}
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text);">${this._escape(tc.title)}</div>
        ${tc.testData ? `<div style="font-size: 11.5px; color: var(--muted); font-style: italic;"><strong>Dữ liệu test:</strong> ${this._escape(tc.testData)}</div>` : ''}
        ${stepsHtml ? `
          <table class="qa-inferred-steps-table" style="margin-top: 6px;">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 45%;">Hành động</th>
                <th style="width: 50%;">Kết quả mong đợi</th>
              </tr>
            </thead>
            <tbody>${stepsHtml}</tbody>
          </table>
        ` : ''}
      `;

      container.appendChild(card);
    });
  }

  renderSystemImpact(root, systemImpact, existingImpacts) {
    const summaryEl = root.querySelector('#qa-req-impact-summary');
    const surfacesEl = root.querySelector('#qa-req-impact-surfaces');
    const apisEl = root.querySelector('#qa-req-impact-apis');
    const schemaEl = root.querySelector('#qa-req-impact-schema');
    const rulesEl = root.querySelector('#qa-req-impact-rules');
    const tbody = root.querySelector('#qa-req-existing-impact-tbody');

    if (summaryEl) summaryEl.textContent = systemImpact?.summary || 'Không có mô tả tổng quan.';

    if (surfacesEl) {
      surfacesEl.innerHTML = (systemImpact?.affectedSurfaces || []).map((s) => `
        <li><strong>${this._escape(s.surface)}:</strong> ${this._escape(s.impact)}</li>
      `).join('') || '<li style="color: var(--muted);">Chưa xác định bề mặt ảnh hưởng</li>';
    }

    if (apisEl) {
      apisEl.innerHTML = (systemImpact?.apiEndpoints || []).map((a) => `
        <li><span style="color: #10b981; font-weight: 700;">[${this._escape(a.method || 'API')}]</span> ${this._escape(a.endpoint || '')} <small style="color: var(--muted); font-family: inherit;">— ${this._escape(a.impact)}</small></li>
      `).join('') || '<li style="color: var(--muted); font-family: inherit;">Không có thay đổi API lớn</li>';
    }

    if (schemaEl) {
      schemaEl.innerHTML = (systemImpact?.dataSchemaChanges || []).map((d) => `
        <li><strong>${this._escape(d.field)}:</strong> <span style="font-size: 11px; padding: 1px 4px; border-radius: 3px; background: var(--line);">${this._escape(d.nature || 'Mới')}</span> ${this._escape(d.impact)}</li>
      `).join('') || '<li style="color: var(--muted);">Không có thay đổi cấu trúc dữ liệu</li>';
    }

    if (rulesEl) {
      rulesEl.innerHTML = (systemImpact?.businessLogicChanges || []).map((r) => `
        <li>${this._escape(r)}</li>
      `).join('') || '<li style="color: var(--muted);">Không có thay đổi logic lớn</li>';
    }

    if (tbody) {
      tbody.innerHTML = '';
      if (!existingImpacts.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 16px;">Không phát hiện kịch bản test hiện có nào bị ảnh hưởng trực tiếp hoặc xung đột.</td></tr>';
      } else {
        existingImpacts.forEach((item) => {
          const tr = document.createElement('tr');
          const severityColors = {
            Cao: '#ef4444',
            High: '#ef4444',
            'Trung bình': '#f59e0b',
            Medium: '#f59e0b',
            Thấp: '#10b981',
            Low: '#10b981',
          };
          const sevColor = severityColors[item.severity] || '#6b7280';

          tr.innerHTML = `
            <td style="font-family: var(--font-mono, monospace); font-weight: 600; color: var(--text);">${this._escape(item.identifier)}</td>
            <td style="color: var(--muted);">${this._escape(item.currentBehavior)}</td>
            <td style="color: var(--accent); font-weight: 500;">${this._escape(item.requiredChange)}</td>
            <td>
              <span style="font-size: 11px; font-weight: 700; color: ${sevColor}; display: block; margin-bottom: 2px;">${this._escape(item.severity || 'Medium')}</span>
              <small style="color: var(--muted);">${this._escape(item.reason)}</small>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  }

  renderLogicClarifications(root, clarifications) {
    const container = root.querySelector('#qa-req-logic-list');
    if (!container) return;
    container.innerHTML = '';

    if (!clarifications.length) {
      container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không phát hiện điểm mơ hồ nào cần làm rõ.</p>';
      return;
    }

    clarifications.forEach((q) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-mono, monospace); font-size: 11.5px; font-weight: 700; color: #10b981;">[${this._escape(q.questionId || 'Q')}]</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--surface); border: 1px solid var(--line); color: var(--muted);">${this._escape(q.topic || 'Chung')}</span>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text);">${this._escape(q.question)}</div>
        <div style="font-size: 12px; color: var(--muted);"><strong style="color: var(--text);">Tại sao cần làm rõ:</strong> ${this._escape(q.whyItMatters)}</div>
        <div style="font-size: 12px; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); padding: 6px 10px; border-radius: 6px; border: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);">
          <strong>Đề xuất mặc định:</strong> ${this._escape(q.proposedDefault)}
        </div>
      `;
      container.appendChild(card);
    });
  }

  renderQaInquiries(root, inquiries) {
    const container = root.querySelector('#qa-req-qa-list');
    if (!container) return;
    container.innerHTML = '';

    if (!inquiries.length) {
      container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted); font-size: 13px;">Không có câu hỏi phản biện.</p>';
      return;
    }

    inquiries.forEach((item) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-mono, monospace); font-size: 11.5px; font-weight: 700; color: #8b5cf6;">[${this._escape(item.inquiryId || 'QA')}]</span>
          <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; font-weight: 600;">${this._escape(item.category || 'QA Defense')}</span>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text);">${this._escape(item.question)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; margin-top: 2px;">
          <span style="color: var(--muted); font-style: italic;"><strong>Căn cứ rủi ro:</strong> ${this._escape(item.rationale)}</span>
          <span style="color: var(--accent); font-weight: 600;">Gửi: ${this._escape(item.targetStakeholder || 'Dev Lead')}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  switchTab(root, tabKey) {
    const tabs = root.querySelectorAll('.qa-req-tab');
    const panels = root.querySelectorAll('.qa-req-panel');

    tabs.forEach((t) => {
      const isCur = t.getAttribute('data-tab') === tabKey;
      t.classList.toggle('active', isCur);
      t.style.borderBottomColor = isCur ? '#8b5cf6' : 'transparent';
      t.style.color = isCur ? 'var(--text)' : 'var(--muted)';
    });

    panels.forEach((p) => {
      p.style.display = p.id === `qa-req-panel-${tabKey}` ? 'flex' : 'none';
    });
  }

  async copyMarkdownReport() {
    if (!this.currentResult) return;
    const md = this.buildMarkdownReport(this.currentResult);
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Đã sao chép báo cáo phân tích Markdown vào Clipboard!');
    } catch (_) {
      toast.warn('Không thể tự động ghi vào clipboard. Vui lòng kiểm tra quyền trình duyệt.');
    }
  }

  buildMarkdownReport(data) {
    const lines = [];
    lines.push(`# Báo Cáo Phân Tích Yêu Cầu & Đánh Giá Tác Động QA`);
    lines.push(`\n**Tóm tắt:** ${data.summary || ''}`);
    lines.push(`**Mức độ rủi ro hệ thống:** ${data.systemImpact?.riskLevel || 'Trung bình'}`);
    lines.push(`\n---\n`);

    lines.push(`## 1. Ước Tính & Danh Sách Test Cases Đề Xuất (${data.testCaseEstimation?.totalCount || 0} TCs)`);
    (data.testCaseEstimation?.testCases || []).forEach((tc) => {
      lines.push(`\n### ${tc.suggestedId}: ${tc.title}`);
      lines.push(`- **Loại:** ${tc.type} | **Độ ưu tiên:** ${tc.priority}`);
      if (tc.precondition) lines.push(`- **Tiền điều kiện:** ${tc.precondition}`);
      if (tc.testData) lines.push(`- **Dữ liệu test:** ${tc.testData}`);
      if (tc.steps && tc.steps.length) {
        lines.push(`\n| Bước | Thao tác | Kết quả mong đợi |`);
        lines.push(`|:---|:---|:---|`);
        tc.steps.forEach((s) => lines.push(`| ${s.step} | ${s.action} | ${s.expected} |`));
      }
    });

    lines.push(`\n---\n`);
    lines.push(`## 2. Đánh Giá Tác Động Hệ Thống & Test Cases Có Sẵn`);
    lines.push(`\n${data.systemImpact?.summary || ''}\n`);
    if (data.systemImpact?.affectedSurfaces?.length) {
      lines.push(`**Bề mặt ảnh hưởng:**`);
      data.systemImpact.affectedSurfaces.forEach((s) => lines.push(`- ${s.surface}: ${s.impact}`));
    }
    if (data.existingTestCasesImpact?.length) {
      lines.push(`\n**Các Test Case / Specs hiện có cần sửa đổi:**`);
      lines.push(`| File / Test ID | Hành vi hiện tại | Thay đổi cần sửa | Mức độ / Lý do |`);
      lines.push(`|:---|:---|:---|:---|`);
      data.existingTestCasesImpact.forEach((e) => {
        lines.push(`| \`${e.identifier}\` | ${e.currentBehavior} | ${e.requiredChange} | **${e.severity}**: ${e.reason} |`);
      });
    }

    lines.push(`\n---\n`);
    lines.push(`## 3. Câu Hỏi Làm Rõ Logic Nghiệp Vụ (Gửi PO/BA/Dev)`);
    (data.logicClarifications || []).forEach((q) => {
      lines.push(`\n- **[${q.questionId}] ${q.question}**`);
      lines.push(`  * *Tại sao cần hỏi:* ${q.whyItMatters}`);
      lines.push(`  * *Đề xuất mặc định:* ${q.proposedDefault}`);
    });

    lines.push(`\n---\n`);
    lines.push(`## 4. Bộ Câu Hỏi Phản Biện Của Team QA (Phòng Vệ Rủi Ro)`);
    (data.qaTeamInquiries || []).forEach((item) => {
      lines.push(`\n- **[${item.inquiryId}] (${item.category})** ${item.question}`);
      lines.push(`  * *Đối tượng:* ${item.targetStakeholder} | *Căn cứ kỹ thuật:* ${item.rationale}`);
    });

    return lines.join('\n');
  }

  async scaffoldFiles(root) {
    if (!this.currentResult) return;

    const defaultTitle = this.currentResult.summary || 'Tính năng mới';
    const title = window.prompt('Nhập tiêu đề cho bộ tài liệu Requirement & Test Cases:', defaultTitle);
    if (!title) return;

    const reqId = window.prompt('Nhập mã Requirement (ví dụ REQ-016):', 'REQ-016');
    if (!reqId) return;

    const jiraKeyInput = root?.querySelector?.('#qa-req-jira-key');
    const source = jiraKeyInput?.value.trim() || this.extractJiraKey(this.currentRawText) || this.currentResult.source;

    try {
      const res = await apiClient.post('/api/qa/scaffold-from-analysis', {
        reqId,
        title,
        source: source || undefined,
        analysisResult: this.currentResult,
      });

      if (res.ok) {
        toast.success(`Đã khởi tạo thành công 2 file vào repo: ${res.files.join(', ')}`);
        if (this.qaSlice && typeof this.qaSlice.loadAll === 'function') {
          await this.qaSlice.loadAll();
        }
      }
    } catch (err) {
      toast.error(`Không thể tạo file: ${err.message}`);
    }
  }

  parseJiraMarkup(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw;
    if (/<[a-z][\s\S]*>/i.test(text)) {
      text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, c) => `${'#'.repeat(Number(lvl))} ${c.trim()}\n\n`);
      text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
      text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
      text = text.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
      text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
      text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
      text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
      text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
      text = text.replace(/<[^>]+>/g, '');
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    text = text.replace(/\{code(?::([a-z]+))?\}([\s\S]*?)\{code\}/gi, (_, lang, code) => `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`);
    text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_, code) => `\`\`\`\n${code.trim()}\n\`\`\`\n`);
    text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_, q) => q.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n');
    text = text.replace(/^bq\.\s*(.+)$/gm, '> $1');
    text = text.replace(/^(\s*)#+\s+/gm, '$11. ');
    text = text.replace(/^(\s*)\*\s+/gm, '$1- ');
    text = text.replace(/^h([1-6])\.\s*(.+)$/gm, (_, lvl, title) => `${'#'.repeat(Number(lvl))} ${title.trim()}`);
    text = text.replace(/(^|[\s(])\*([^\s*][^*]*[^\s*])\*([\s).,!?:]|$)/g, '$1**$2**$3');
    text = text.replace(/(^|[\s(])_([^\s_][^_]*[^\s_])_([\s).,!?:]|$)/g, '$1*$2*$3');
    text = text.replace(/(^|[\s(])-([^\s-][^-]*[^\s-])-([\s).,!?:]|$)/g, '$1~~$2~~$3');
    text = text.replace(/\{\{([^{}]+)\}\}/g, '`$1`');
    text = text.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '[$1]($2)');
    text = text.replace(/\[([a-z]+:\/\/[^\]]+)\]/g, '<$1>');
    const lines = text.split('\n');
    const resultLines = [];
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('||') && line.endsWith('||')) {
        const headers = line.slice(2, -2).split('||').map((h) => h.trim());
        resultLines.push(`| ${headers.join(' | ')} |`);
        resultLines.push(`| ${headers.map(() => '---').join(' | ')} |`);
        inTable = true;
      } else if (line.startsWith('|') && line.endsWith('|') && !line.startsWith('||')) {
        const cells = line.slice(1, -1).split('|').map((c) => c.trim());
        resultLines.push(`| ${cells.join(' | ')} |`);
        inTable = true;
      } else {
        if (inTable) inTable = false;
        resultLines.push(lines[i]);
      }
    }
    return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  extractJiraKey(text) {
    if (!text) return null;
    // AC-xxx / TC-xxx là mã truy vết của framework, không phải issue Jira (giống core/ai/tasks/jiraStoryParser.js).
    const keys = String(text).match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
    return keys.find((key) => !['AC', 'TC'].includes(key.split('-')[0])) || null;
  }

  _escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  destroy() {
    if (this._activeRequest) {
      try { this._activeRequest.cancel(); } catch (_) {}
      this._activeRequest = null;
    }
    if (this._statusBar) {
      try { this._statusBar.dispose(); } catch (_) {}
      this._statusBar = null;
    }
    if (this.specPanels) {
      try { this.specPanels.destroy(); } catch (_) {}
      this.specPanels = null;
    }
    this.disposers.forEach((d) => {
      try { d(); } catch (_) {}
    });
    this.disposers = [];
  }
}
