'use strict';

/**
 * dashboard/public/js/views/qa/reqAnalyzerHelper.js
 * Quản lý vòng đời và tương tác của Modal Phân Tích Yêu Cầu & Đánh Giá Tác Động QA (Requirement Analyzer).
 * Tuân thủ quy chuẩn OWN-01..05 & Modular Decomposition (PLAN-07).
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';
import {
  escapeHtml,
  extractJiraKey,
  parseJiraMarkup,
  buildMarkdownReport,
} from './analyzer/markdownSpecParser.js';
import {
  switchTab,
  renderResults,
  renderClarityResult,
  renderSpecResult,
} from './analyzer/reqAnalyzerRenderer.js';
import {
  renderTestCases,
  renderSystemImpact,
  renderLogicClarifications,
  renderQaInquiries,
} from './analyzer/cardPanelsRenderer.js';
import {
  runClarityCheck,
  runGenerateTestCases,
  runGenerateSpec,
  runAnalysis,
  scaffoldFiles,
  copyMarkdownReport,
} from './analyzer/analyzerActions.js';
import { mountSpecPanels } from './specStudio/specStudioPanels.js';

export class ReqAnalyzerHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
    this.currentResult = null;
    this.currentTestCases = [];
    this.currentRawText = '';
    this.specPanels = null;
  }

  init(root) {
    this.destroy();
    if (!root) return;

    const modal = root.querySelector('#qa-req-analyzer-modal');
    if (!modal) return;

    const addEvt = (target, evt, handler) => {
      if (!target) return;
      target.addEventListener(evt, handler);
      this.disposers.push(() => target.removeEventListener(evt, handler));
    };

    const formatJiraBtn = root.querySelector('#qa-req-btn-format-jira');
    const jiraKeyInput = root.querySelector('#qa-req-jira-key');
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
      showInput: () => this.showInputView(root),
    });

    addEvt(root.querySelector('#qa-btn-analyze-req'), 'click', () => this.openModal(root));

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
    addEvt(root.querySelector('#qa-req-analyzer-close'), 'click', closeModal);
    addEvt(root.querySelector('#qa-req-analyzer-btn-cancel'), 'click', closeModal);
    addEvt(modal, 'cancel', closeModal);

    addEvt(root.querySelector('#qa-req-analyzer-sample-btn'), 'click', () => {
      const textarea = root.querySelector('#qa-req-analyzer-text');
      if (textarea) {
        textarea.value = [
          'Tính năng: Bổ sung trường "Trung tâm sát hạch" trên Hồ sơ Giáo viên',
          '1. Bối cảnh:',
          '- Hồ sơ giáo viên có thêm trường "Trung tâm sát hạch" đứng cạnh "Trung tâm đang công tác".',
          '- Cho phép chọn từ danh sách hoặc "Thêm trung tâm mới".',
          '- Có nút "Dùng lại trung tâm đang công tác".',
          '',
          '2. Quy tắc nghiệp vụ:',
          '- MST KHÔNG bắt buộc khi tạo trung tâm sát hạch mới.',
          '- Bắt buộc cả khi tạo mới và cập nhật.',
          '- Nâng giới hạn chọn phường/xã từ 6 lên 10 mục.',
          '- Nút dùng lại tự động ẩn sau khi bấm.'
        ].join('\n');
        textarea.focus();
        toast.info('Đã nạp văn bản requirement mẫu.');
      }
    });

    addEvt(root.querySelector('#qa-req-analyzer-btn-reinput'), 'click', () => this.showInputView(root));
    addEvt(root.querySelector('#qa-req-analyzer-btn-submit'), 'click', () => this.runAnalysis(root));
    addEvt(root.querySelector('#qa-req-btn-clarity'), 'click', () => this.runClarityCheck(root));
    addEvt(root.querySelector('#qa-req-btn-generate-tc'), 'click', () => this.runGenerateTestCases(root));

    const generateSpecBtn = root.querySelector('#qa-req-btn-generate-spec');
    if (generateSpecBtn) {
      addEvt(generateSpecBtn, 'click', () => this.runGenerateSpec(root));
    }

    const tabBtns = root.querySelectorAll('.qa-req-tab');
    tabBtns.forEach((tabBtn) => {
      addEvt(tabBtn, 'click', () => {
        this.switchTab(root, tabBtn.getAttribute('data-tab'));
      });
    });

    addEvt(root.querySelector('#qa-req-analyzer-btn-copy'), 'click', () => this.copyMarkdownReport());
    addEvt(root.querySelector('#qa-req-analyzer-btn-scaffold'), 'click', () => this.scaffoldFiles(root));
  }

  async runClarityCheck(root) { await runClarityCheck(this, root); }
  async runGenerateTestCases(root) { await runGenerateTestCases(this, root); }
  async runGenerateSpec(root) { await runGenerateSpec(this, root); }
  async runAnalysis(root) { await runAnalysis(this, root); }
  async scaffoldFiles(root) { await scaffoldFiles(this, root); }
  async copyMarkdownReport() { await copyMarkdownReport(this); }

  _setLoadingState(root, isLoading, isError = false) {
    const inputSection = root.querySelector('#qa-req-analyzer-input-section');
    const loadingSection = root.querySelector('#qa-req-analyzer-loading');
    const resultsSection = root.querySelector('#qa-req-analyzer-results-section');
    if (isLoading) {
      if (inputSection) inputSection.style.display = 'none';
      if (loadingSection) loadingSection.style.display = 'block';
      if (resultsSection) resultsSection.style.display = 'none';
    } else if (isError) {
      if (loadingSection) loadingSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'flex';
      if (resultsSection) resultsSection.style.display = 'none';
    } else {
      if (loadingSection) loadingSection.style.display = 'none';
      if (inputSection) inputSection.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'flex';
    }
  }

  async openModal(root) {
    const modal = root.querySelector('#qa-req-analyzer-modal');
    if (!modal) return;
    this.showInputView(root);
    this.checkAiStatus(root);
    try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); }
  }

  async checkAiStatus(root) {
    const badge = root.querySelector('#qa-req-analyzer-ai-badge');
    if (!badge) return;
    badge.textContent = 'Đang kiểm tra AI...';
    try {
      const config = await apiClient.get('/api/ai/config');
      if (config && config.hasKey) {
        badge.textContent = `🟢 Sẵn sàng (${config.provider} - ${config.model})`;
        badge.style.color = 'var(--success)';
      } else {
        badge.textContent = '⚪ Chưa cấu hình Key';
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

  renderResults(root, data) {
    renderResults(this, root, data);
  }

  renderTestCases(root, testCases) {
    this.currentTestCases = testCases;
    renderTestCases(root, testCases);
  }

  renderClarityResult(root, res) { renderClarityResult(root, res); }
  renderSpecResult(root, res) { renderSpecResult(root, res); }
  renderSystemImpact(root, systemImpact, existingImpacts) { renderSystemImpact(root, systemImpact, existingImpacts); }
  renderLogicClarifications(root, clarifications) { renderLogicClarifications(root, clarifications); }
  renderQaInquiries(root, inquiries) { renderQaInquiries(root, inquiries); }
  switchTab(root, tabKey) { switchTab(root, tabKey); }
  parseJiraMarkup(raw) { return parseJiraMarkup(raw); }
  extractJiraKey(text) { return extractJiraKey(text); }
  buildMarkdownReport(data) { return buildMarkdownReport(data); }
  _escape(str) { return escapeHtml(str); }

  destroy() {
    if (this._activeRequest) { try { this._activeRequest.cancel(); } catch (_) {} this._activeRequest = null; }
    if (this._statusBar) { try { this._statusBar.dispose(); } catch (_) {} this._statusBar = null; }
    if (this.specPanels) { try { this.specPanels.destroy(); } catch (_) {} this.specPanels = null; }
    this.disposers.forEach((d) => { try { d(); } catch (_) {} });
    this.disposers = [];
  }
}
