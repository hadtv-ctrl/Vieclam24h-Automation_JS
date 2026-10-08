'use strict';

/**
 * dashboard/public/js/views/qa/qaSlice.js
 * QA Docs & Automation Root Feature Slice.
 * Tuân thủ quy chuẩn OWN-01..05 & Modular Decomposition (PLAN-07).
 */

import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { toast } from '../../core/toast.js';
import { ProcessStudioHelper } from './processStudioHelper.js';
import { ReqAnalyzerHelper } from './reqAnalyzerHelper.js';
import { BatchController } from './batch/batchController.js';
import { ConflictStudioHelper } from './conflictStudioHelper.js';
import { openSmartLinkerForSpec, updateSmartLinkButton } from './smartLinkerHelper.js';

import { QaOverviewSlice } from './slices/qaOverviewSlice.js';
import { QaDocsSlice } from './slices/qaDocsSlice.js';
import { QaInferenceSlice } from './slices/qaInferenceSlice.js';
import { QaConflictSlice } from './slices/qaConflictSlice.js';
import { QaBatchSlice } from './slices/qaBatchSlice.js';
import { QaCandidatesSlice } from './slices/qaCandidatesSlice.js';
import { QaDecisionsSlice } from './slices/qaDecisionsSlice.js';

export class QaSlice {
  constructor() {
    this._disposers = [];
    this._renderDisposers = [];
    this._mounted = false;
    this.trace = null;
    this.summary = null;
    this._fixChanges = [];
    this.candidates = [];
    this.decisions = null;
    this.activeTab = 'docs';
    this.priorityFilter = 'all';
    this.documents = [];
    this.activeDocPath = null;
    this.docFilter = '';
    this._activeDoc = null;
    this._openQuestions = [];
    this._degraded = [];
    this.pickedIds = new Set();
    this.draftText = '';
    this._summarySeq = 0;

    // Sub-modules & Tab Slices
    this.reqAnalyzer = new ReqAnalyzerHelper(this);
    this.batch = new BatchController(this);
    this.conflictStudio = new ConflictStudioHelper(this);

    this.overviewSlice = new QaOverviewSlice(this);
    this.docsSlice = new QaDocsSlice(this);
    this.inferenceSlice = new QaInferenceSlice(this);
    this.conflictSlice = new QaConflictSlice(this);
    this.batchSlice = new QaBatchSlice(this);
    this.candidatesSlice = new QaCandidatesSlice(this);
    this.decisionsSlice = new QaDecisionsSlice(this);
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    if (this.reqAnalyzer) this.reqAnalyzer.init(this._root());
    if (this.batch) this.batch.init(this._root());
    if (this.conflictStudio) this.conflictStudio.init(this._root());
    await this.reload();
  }

  unmount() {
    this._mounted = false;
    this._flushRenderDisposers();
    if (this.reqAnalyzer) this.reqAnalyzer.destroy();
    if (this.batch) this.batch.destroy();
    if (this.conflictStudio) this.conflictStudio.destroy();
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _flushRenderDisposers() {
    this._renderDisposers.forEach((d) => { try { d(); } catch (_) {} });
    this._renderDisposers = [];
  }

  _root() {
    return document.getElementById('qa-view');
  }

  _bindDomEvents() {
    const root = this._root();
    if (!root) return;
    const on = (el, evt, fn) => {
      if (!el) return;
      el.addEventListener(evt, fn);
      this._disposers.push(() => el.removeEventListener(evt, fn));
    };

    on(root.querySelector('#qa-btn-refresh'), 'click', () => this.reload(true));
    on(root.querySelector('#qa-btn-release-briefing'), 'click', () => this.overviewSlice.openReleaseBriefingModal());
    on(root.querySelector('#qa-docs-sidebar-refresh'), 'click', () => this.reload(true));
    on(root.querySelector('#qa-reader-back'), 'click', () => this.docsSlice.showOverview());
    on(root.querySelector('#qa-reader-answer'), 'click', () => this.docsSlice.openAnswerForm());
    on(root.querySelector('#qa-reader-infer'), 'click', () => this.inferenceSlice.openInferModal());
    on(root.querySelector('#qa-reader-edit'), 'click', () => this.docsSlice.openEditForm());
    on(root.querySelector('#qa-btn-draft'), 'click', () => this.candidatesSlice.generateDraft());
    on(root.querySelector('#qa-btn-draft-clear'), 'click', () => this.candidatesSlice.clearPicks());
    on(root.querySelector('#qa-draft-copy'), 'click', () => this.candidatesSlice.copyDraft());
    on(root.querySelector('#qa-draft-expand'), 'click', () => this.candidatesSlice.toggleDraftFullscreen());
    on(root.querySelector('#qa-draft-close'), 'click', () => this.candidatesSlice.closeDraft());
    on(root.querySelector('#qa-pick-all'), 'change', (e) => this.candidatesSlice.toggleAllPicks(e.target.checked));

    on(root.querySelector('.qa-score-health'), 'click', () => this.switchTab('findings'));
    on(root.querySelector('.qa-score-coverage'), 'click', () => this.switchTab('docs'));
    on(root.querySelector('.qa-score-ratio'), 'click', () => this.switchTab('candidates'));
    on(root.querySelector('.qa-score-boundary'), 'click', () => this.switchTab('findings'));

    on(root.querySelector('#qa-btn-autofix'), 'click', () => this.batchSlice.openAutoFixModal());
    on(root.querySelector('#qa-btn-scaffold'), 'click', () => this.batchSlice.openScaffoldModal());

    const onSmartLinkApplied = () => this.reload(true);
    window.addEventListener('qa:smart-link:applied', onSmartLinkApplied);
    this._disposers.push(() => window.removeEventListener('qa:smart-link:applied', onSmartLinkApplied));

    const fixModal = root.querySelector('#qa-fix-modal');
    if (fixModal) {
      on(root.querySelector('#qa-fix-modal-close'), 'click', () => fixModal.close());
      on(root.querySelector('#qa-fix-cancel-btn'), 'click', () => fixModal.close());
      on(root.querySelector('#qa-btn-apply-fix'), 'click', () => this.batchSlice.applyAutoFix());
    }

    const scaffoldModal = root.querySelector('#qa-scaffold-modal');
    if (scaffoldModal) {
      on(root.querySelector('#qa-scaffold-modal-close'), 'click', () => scaffoldModal.close());
      on(root.querySelector('#qa-scaffold-cancel-btn'), 'click', () => scaffoldModal.close());
      on(root.querySelector('#qa-btn-submit-scaffold'), 'click', () => this.batchSlice.submitScaffold());
      on(root.querySelector('#qa-btn-extract-raw'), 'click', () => this.batchSlice.extractRawScaffold());
    }

    const inferModal = root.querySelector('#qa-infer-modal');
    if (inferModal) {
      on(root.querySelector('#qa-infer-modal-close'), 'click', () => inferModal.close());
      on(root.querySelector('#qa-infer-cancel-btn'), 'click', () => inferModal.close());
      on(root.querySelector('#qa-btn-run-infer'), 'click', () => this.inferenceSlice.runInference());
      on(root.querySelector('#qa-infer-pick-all'), 'change', (e) => this.inferenceSlice.toggleAllInferred(e.target.checked));
      on(root.querySelector('#qa-btn-submit-inferred'), 'click', () => this.inferenceSlice.submitInferredTestCases());
    }

    root.querySelectorAll('.qa-tab-btn').forEach((btn) => {
      on(btn, 'click', () => this.switchTab(btn.dataset.tab));
    });
  }

  switchTab(tabName) {
    if (!tabName) return;
    this.activeTab = tabName;
    const root = this._root();
    if (!root) return;

    root.querySelectorAll('.qa-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    root.querySelectorAll('.qa-tab-panel').forEach((panel) => {
      panel.style.display = panel.id === `qa-tab-${tabName}` ? 'block' : 'none';
    });

    if (tabName === 'conflicts') {
      this.conflictSlice.renderConflicts(root);
    }
  }

  async reload(force = false) {
    if (!this._mounted) return;
    const seq = ++this._summarySeq;
    const root = this._root();
    if (!root) return;

    try {
      const [summary, trace, candRes, decRes, docsRes] = await Promise.all([
        apiClient.get('/api/qa/summary').catch(() => null),
        apiClient.get('/api/qa/trace').catch(() => null),
        apiClient.get('/api/qa/candidates').catch(() => ({ candidates: [] })),
        apiClient.get('/api/qa/decisions').catch(() => ({ decisions: [] })),
        apiClient.get('/api/qa/documents').catch(() => ({ documents: [] })),
      ]);

      if (seq !== this._summarySeq || !this._mounted) return;

      this.summary = summary;
      this.trace = trace;
      this.candidates = candRes?.candidates || [];
      this.decisions = decRes;
      this.documents = docsRes?.documents || [];

      this.renderAll();
    } catch (err) {
      toast.error(`Lỗi cập nhật dữ liệu QA: ${err.message}`);
    }
  }

  renderAll() {
    const root = this._root();
    if (!root || !this._mounted) return;
    this._flushRenderDisposers();

    this.overviewSlice.renderSourceBar(root, this.summary);
    this.overviewSlice.renderStats(root, this.trace);
    this.overviewSlice.renderExecutiveScorecard(root, this.summary, this.trace);
    this.overviewSlice.renderTabBadges(root, this.summary, this.trace);

    this.docsSlice.renderDocs(root);
    this.batchSlice.renderFindings(root);
    this.candidatesSlice.renderCandidates(root);
    this.decisionsSlice.renderDecisions(root);

    this.switchTab(this.activeTab);
  }

  async loadAll() {
    await this.reload(true);
  }

  showOverview() { this.docsSlice.showOverview(); }
  openDocument(p) { this.docsSlice.openDocument(p); }
  openAnswerForm() { this.docsSlice.openAnswerForm(); }
  openEditForm() { this.docsSlice.openEditForm(); }
  openInferModal() { this.inferenceSlice.openInferModal(); }
  openAutoFixModal() { this.batchSlice.openAutoFixModal(); }
  applyAutoFix() { this.batchSlice.applyAutoFix(); }
  openScaffoldModal() { this.batchSlice.openScaffoldModal(); }
  extractRawScaffold() { this.batchSlice.extractRawScaffold(); }
  submitScaffold() { this.batchSlice.submitScaffold(); }
  generateDraft() { this.candidatesSlice.generateDraft(); }
  clearPicks() { this.candidatesSlice.clearPicks(); }
  copyDraft() { this.candidatesSlice.copyDraft(); }
  toggleDraftFullscreen() { this.candidatesSlice.toggleDraftFullscreen(); }
  _closeDraft() { this.candidatesSlice.closeDraft(); }
  toggleAllPicks(c) { this.candidatesSlice.toggleAllPicks(c); }
  openReleaseBriefingModal() { this.overviewSlice.openReleaseBriefingModal(); }
  openDeleteRequirementModal(d) { this.conflictSlice.openDeleteRequirementModal(d); }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
  }

  _el(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
}
