/**
 * dashboard/public/js/views/qa/qaSlice.js
 * QA Docs & Automation Feature Slice.
 *
 * Quy tắc bắt buộc của file này:
 *  - KHÔNG dùng innerHTML cho bất kỳ dữ liệu nào đọc từ repo. Text của requirement,
 *    finding.detail và nội dung quyết định là dữ liệu không tin cậy; dashboard cũng cố tình
 *    cho `set innerHTML` throw trong agent-ui fixture. Mọi thứ render bằng textContent.
 *  - Mọi listener scope trong #qa-view và đẩy remover vào this._disposers.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { renderMarkdown, parseFrontMatter } from './markdownView.js';
import { parseOpenQuestions, applyAnswers } from './openQuestions.js';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
// Chỉ 4 lớp ưu tiên này có rule trong qa.css. Ghép chuỗi tự do sẽ sinh ra lớp chết
// (vd. qa-prio-none) khiến ô 'chưa có ưu tiên' hiện đậm hơn cả P3 thật.
const KNOWN_PRIORITY = new Set(['p0', 'p1', 'p2', 'p3']);
// severity đến thẳng từ decisions.json của từng dự án, nên phải lọc trước khi làm class.
const KNOWN_SEVERITY = new Set(['blocking', 'urgent']);
const SEVERITY_LABEL = { major: 'Nghiêm trọng', minor: 'Cần xử lý', info: 'Ghi nhận' };
const AUTOMATION_LABEL = {
  yes: 'Khai: có automation',
  no: 'Khai: không automation',
  candidate: 'Khai: ứng viên',
};

export class QaSlice {
  constructor() {
    this._disposers = [];
    // Listener gắn vào node do render sinh ra: phải xả mỗi lượt render, không phải mỗi lượt
    // unmount. Dồn hết vào _disposers thì mỗi lần Làm mới lại chồng thêm một bộ remover
    // trỏ vào node đã bị thay thế.
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
    // Nội dung thô của tài liệu đang mở: là cơ sở cho mọi phép sửa, và `bytes` của nó làm
    // khoá lạc quan để không đè mất thay đổi của người khác.
    this._activeDoc = null;
    this._openQuestions = [];
    this._degraded = [];
    // Tập test case đang chọn để sinh bản thảo. Giữ ngoài DOM để sống qua mỗi lượt render
    // và qua cả bộ lọc ưu tiên.
    this.pickedIds = new Set();
    this.draftText = '';
    this._lastAuthor = '';
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    await this.reload();
  }

  unmount() {
    this._mounted = false;
    this._flushRenderDisposers();
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
    on(root.querySelector('#qa-docs-sidebar-refresh'), 'click', () => this.reload(true));
    on(root.querySelector('#qa-reader-back'), 'click', () => this.showOverview());
    on(root.querySelector('#qa-reader-answer'), 'click', () => this.openAnswerForm());
    on(root.querySelector('#qa-reader-edit'), 'click', () => this.openEditForm());
    on(root.querySelector('#qa-btn-draft'), 'click', () => this.generateDraft());
    on(root.querySelector('#qa-btn-draft-clear'), 'click', () => this.clearPicks());
    on(root.querySelector('#qa-draft-copy'), 'click', () => this.copyDraft());
    on(root.querySelector('#qa-draft-expand'), 'click', () => this.toggleDraftFullscreen());
    on(root.querySelector('#qa-draft-close'), 'click', () => this._closeDraft());
    on(root.querySelector('#qa-pick-all'), 'change', (event) => this.toggleAllPicks(event.target.checked));

    // Smart Action Bar
    on(root.querySelector('#qa-btn-autofix'), 'click', () => this.openAutoFixModal());
    on(root.querySelector('#qa-btn-scaffold'), 'click', () => this.openScaffoldModal());

    // Auto-Fix Modal Events
    const fixModal = root.querySelector('#qa-fix-modal');
    if (fixModal) {
      on(root.querySelector('#qa-fix-modal-close'), 'click', () => fixModal.close());
      on(root.querySelector('#qa-fix-cancel-btn'), 'click', () => fixModal.close());
      on(root.querySelector('#qa-btn-apply-fix'), 'click', () => this.applyAutoFix());
    }

    // Scaffold Modal Events
    const scaffoldModal = root.querySelector('#qa-scaffold-modal');
    if (scaffoldModal) {
      on(root.querySelector('#qa-scaffold-modal-close'), 'click', () => scaffoldModal.close());
      on(root.querySelector('#qa-scaffold-cancel-btn'), 'click', () => scaffoldModal.close());
      on(root.querySelector('#qa-btn-submit-scaffold'), 'click', () => this.submitScaffold());

      root.querySelectorAll('input[name="qa-scaffold-mode"]').forEach((radio) => {
        on(radio, 'change', () => {
          const isInfer = radio.value === 'infer' && radio.checked;
          const newFields = root.querySelector('#qa-scaffold-new-fields');
          const inferFields = root.querySelector('#qa-scaffold-infer-fields');
          const cardNew = root.querySelector('#qa-mode-card-new');
          const cardInfer = root.querySelector('#qa-mode-card-infer');
          if (newFields) newFields.style.display = isInfer ? 'none' : 'flex';
          if (inferFields) inferFields.style.display = isInfer ? 'flex' : 'none';
          if (cardNew) cardNew.classList.toggle('is-selected', !isInfer);
          if (cardInfer) cardInfer.classList.toggle('is-selected', isInfer);
        });
      });
    }

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        const box = root.querySelector('#qa-draft');
        if (box && !box.hidden) {
          if (box.classList.contains('is-fullscreen')) {
            this.toggleDraftFullscreen(false);
          } else {
            this._closeDraft();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    this._disposers.push(() => window.removeEventListener('keydown', handleKeydown));
    on(root.querySelector('#qa-docs-filter'), 'input', (event) => {
      this.docFilter = event.target.value || '';
      this.renderDocList();
    });

    root.querySelectorAll('[data-qa-tab]').forEach((btn) => {
      on(btn, 'click', () => this.switchTab(btn.dataset.qaTab));
    });
    root.querySelectorAll('[data-qa-priority]').forEach((btn) => {
      on(btn, 'click', () => {
        this.priorityFilter = btn.dataset.qaPriority;
        root.querySelectorAll('[data-qa-priority]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.renderCandidates();
      });
    });
  }

  switchTab(tab) {
    if (!tab) return;
    this.activeTab = tab;
    const root = this._root();
    if (!root) return;
    root.querySelectorAll('[data-qa-tab]').forEach((btn) => {
      const active = btn.dataset.qaTab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    ['docs', 'candidates', 'findings', 'decisions'].forEach((name) => {
      const panel = root.querySelector(`#qa-panel-${name}`);
      if (panel) panel.hidden = name !== tab;
    });
  }

  /**
   * Nạp dữ liệu cho cả mục QA.
   *
   * Dùng allSettled chứ không phải all: bốn endpoint này KHÔNG cùng mức thiết yếu. Trước
   * đây một endpoint hỏng là cả màn hình trắng — và có một cách rất dễ gặp để nó hỏng:
   * tiến trình dashboard khởi động từ trước khi endpoint mới ra đời vẫn phục vụ file JS
   * MỚI đọc thẳng từ đĩa, trong khi bảng route của nó là bảng CŨ. Khi đó JS gọi một
   * endpoint mà chính server đang chạy chưa biết, và người dùng thấy "Không tìm thấy tài
   * nguyên" ở một tính năng hoàn toàn lành lặn.
   *
   * `trace` là thiết yếu — không có nó thì không có gì để hiển thị. Ba phần còn lại thiếu
   * thì chỉ mất đúng phần đó.
   */
  async reload(announce = false) {
    const root = this._root();
    if (!root) return;

    const [trace, candidates, decisions, documents, summary] = await Promise.allSettled([
      apiClient.get('/api/qa/trace'),
      apiClient.get('/api/qa/candidates', { limit: 50 }),
      apiClient.get('/api/qa/decisions'),
      apiClient.get('/api/qa/documents'),
      apiClient.get('/api/qa/summary'),
    ]);

    if (trace.status !== 'fulfilled') {
      this._showAlert(
        `Không tải được dữ liệu QA: ${trace.reason && trace.reason.message}`,
        'danger',
      );
      return;
    }

    this.trace = trace.value;
    this.summary = summary.status === 'fulfilled' ? summary.value : null;
    this.candidates = candidates.status === 'fulfilled' && Array.isArray(candidates.value.candidates)
      ? candidates.value.candidates
      : [];
    this.decisions = decisions.status === 'fulfilled' ? decisions.value : null;
    this.documents = documents.status === 'fulfilled' && Array.isArray(documents.value.documents)
      ? documents.value.documents
      : [];

    this._degraded = [
      candidates.status === 'rejected' ? { part: 'ứng viên automation', reason: candidates.reason } : null,
      decisions.status === 'rejected' ? { part: 'sổ quyết định', reason: decisions.reason } : null,
      documents.status === 'rejected' ? { part: 'danh sách tài liệu', reason: documents.reason } : null,
      summary.status === 'rejected' ? { part: 'bộ chỉ số QA Core', reason: summary.reason } : null,
    ].filter(Boolean);

    this.renderAll();
    if (announce) this.notify('Đã làm mới dữ liệu QA.');
  }

  /**
   * Endpoint thiếu hẳn (404) gần như luôn có cùng một nguyên nhân: server đang chạy là bản
   * cũ hơn file JS nó phục vụ. Nói thẳng cách sửa thay vì để người dùng đoán.
   */
  _degradedMessage() {
    if (!this._degraded || !this._degraded.length) return null;
    const parts = this._degraded.map((d) => d.part).join(', ');
    const anyMissing = this._degraded.some((d) => d.reason && d.reason.status === 404);
    return anyMissing
      ? `Server đang chạy là bản cũ hơn giao diện: thiếu API cho ${parts}.`
        + ' Dừng rồi khởi động lại dashboard (Stop_Dashboard.bat rồi Start_Dashboard.bat).'
      : `Chưa tải được ${parts}. Phần còn lại vẫn dùng bình thường.`;
  }

  renderAll() {
    this._flushRenderDisposers();
    // Làm mới không được đá người đọc về tổng quan; chỉ về nếu file đã biến mất.
    if (this.activeDocPath && !this.documents.some((d) => d.path === this.activeDocPath)) {
      this.activeDocPath = null;
    }
    this._renderSourceBar();
    this._renderStats();
    this._renderExecutiveScorecard();
    this.renderDocs();
    this.renderCandidates();
    this.renderFindings();
    this.renderDecisions();
  }

  // --- helpers render an toàn ---

  _el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  _row(cells) {
    const tr = document.createElement('tr');
    cells.forEach((c) => tr.appendChild(c instanceof Node ? c : this._el('td', c)));
    return tr;
  }

  _cell(text, className) {
    return this._el('td', text, className);
  }

  /**
   * @param {string} text
   * @param {'warn'|'danger'} severity Hỏng thật (danger) phải khác lời nhắc mềm (warn):
   *   cùng một dải vàng thì người dùng không phân biệt được màn hình chết với lời khuyên.
   */
  _showAlert(text, severity = 'warn') {
    const root = this._root();
    const box = root && root.querySelector('#qa-alert');
    const span = root && root.querySelector('#qa-alert-text');
    if (!box || !span) return;
    span.textContent = text;
    box.classList.toggle('qa-alert-danger', severity === 'danger');
    box.classList.toggle('qa-alert-warn', severity !== 'danger');
    box.hidden = false;
  }

  _hideAlert() {
    const box = this._root() && this._root().querySelector('#qa-alert');
    if (box) box.hidden = true;
  }

  _setEmpty(id, lines) {
    const node = this._root() && this._root().querySelector(`#${id}`);
    if (!node) return;
    node.textContent = '';
    if (!lines || !lines.length) { node.hidden = true; return; }
    lines.forEach((line, i) => {
      node.appendChild(this._el('p', line, i === 0 ? 'qa-empty-title' : 'qa-empty-line'));
    });
    node.hidden = false;
  }

  // --- panel 0: nguồn dữ liệu + thống kê ---

  _renderSourceBar() {
    const root = this._root();
    const bar = root && root.querySelector('#qa-source-bar');
    if (!bar || !this.trace) return;
    const dirs = this.trace.dirs || {};
    const set = (id, value) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = value;
    };
    set('qa-src-requirements', `${dirs.requirements || '?'}/`);
    set('qa-src-testcases', `${dirs.testCases || '?'}/`);
    set('qa-src-specs', `${dirs.specs || '?'}/`);
    set(
      'qa-src-config',
      this.trace.configPath
        ? `theo ${this.trace.configPath}`
        : 'theo mặc định — khai mục qa trong core/config/dashboardConfig.json để đổi',
    );
    bar.hidden = false;

    this._hideAlert();
    const degraded = this._degradedMessage();
    if (degraded) {
      this._showAlert(degraded, 'danger');
      return;
    }
    if (this.trace.available === false) {
      this._showAlert(
        (this.trace.analyzer && this.trace.analyzer.error) || 'Analyzer chưa sẵn sàng.',
        'danger',
      );
    } else if (this.trace.staleCore) {
      this._showAlert(
        'core/config/dashboardConfig.json có khai mục "qa" nhưng bản core/ của repo này chưa hiểu khóa đó, '
        + 'nên cấu hình đang bị bỏ qua và mục QA đọc theo thư mục mặc định. '
        + 'Hoàn tất migration core/ (ai/shared/SATELLITE_CORE_MIGRATION.md) để sync giao nốt core/.',
        'danger',
      );
    } else if (this.trace.specsDirEmpty) {
      this._showAlert(
        `Không đọc được spec nào trong "${dirs.specs}/". Nếu repo này để spec ở chỗ khác, `
        + 'hãy sửa mục qa.specs trong core/config/dashboardConfig.json — nếu không, mọi thứ sẽ trông như đã sạch.',
      );
    }
  }

  _renderStats() {
    const root = this._root();
    const box = root && root.querySelector('#qa-stats');
    if (!box || !this.trace) return;
    if (this.trace.available === false) { box.hidden = true; return; }
    const c = this.trace.counts || {};
    const set = (id, v) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = String(v ?? 0);
    };
    set('qa-stat-req', c.requirements);
    set('qa-stat-ac', c.acceptanceCriteria);
    set('qa-stat-tc', c.testCases);
    set('qa-stat-auto', this.trace.automatedCount);
    set('qa-stat-major', this.trace.majorCount);
    box.hidden = false;
  }

  _renderExecutiveScorecard() {
    const root = this._root();
    if (!root) return;
    const summary = this.summary;
    if (!summary) return;

    // 1. Health Badge
    const healthStatus = summary.systemHealth || summary.health?.status || 'HEALTHY';
    const badge = root.querySelector('#qa-health-badge');
    const icon = root.querySelector('#qa-health-icon');
    const statusText = root.querySelector('#qa-health-status');
    const findingsText = root.querySelector('#qa-health-findings-text');

    if (badge) {
      badge.className = 'qa-health-pill';
      if (healthStatus === 'HEALTHY') badge.classList.add('is-healthy');
      else if (healthStatus === 'WARNING') badge.classList.add('is-warning');
      else badge.classList.add('is-critical');
    }
    if (icon) {
      icon.className = healthStatus === 'HEALTHY'
        ? 'ph-bold ph-shield-check'
        : (healthStatus === 'WARNING' ? 'ph-bold ph-warning' : 'ph-bold ph-warning-octagon');
    }
    if (statusText) statusText.textContent = healthStatus;
    if (findingsText) {
      const count = summary.health?.totalFindings ?? (summary.findings || []).length;
      findingsText.textContent = `${count} phát hiện`;
    }

    // 2. AC Coverage
    const m = summary.metrics || {};
    const covPercent = m.coveragePercent ?? 0;
    const covPercentEl = root.querySelector('#qa-cov-percent');
    const covRatioEl = root.querySelector('#qa-cov-ratio');
    const covProgressEl = root.querySelector('#qa-cov-progress');

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
    const b = summary.boundary || {};
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

  async openAutoFixModal() {
    const root = this._root();
    if (!root) return;
    const modal = root.querySelector('#qa-fix-modal');
    const summaryText = root.querySelector('#qa-fix-summary-text');
    const listEl = root.querySelector('#qa-fix-changes-list');
    const applyBtn = root.querySelector('#qa-btn-apply-fix');
    if (!modal || !summaryText || !listEl || !applyBtn) return;

    summaryText.textContent = 'Đang quét phân tích và chuẩn hóa ma trận (dry-run)...';
    listEl.textContent = '';
    const loadingLi = document.createElement('li');
    loadingLi.textContent = 'Đang tải thông tin...';
    listEl.appendChild(loadingLi);
    applyBtn.disabled = true;

    modal.showModal();

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: true });
      listEl.textContent = '';
      this._fixChanges = res.changes || [];

      if (!res.ok && res.error) {
        summaryText.textContent = `Lỗi: ${res.message || res.error}`;
        applyBtn.disabled = true;
        return;
      }

      summaryText.textContent = res.message || 'Hoàn tất quét xem trước.';
      if (this._fixChanges.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.style.color = 'var(--success, #10b981)';
        emptyLi.textContent = 'Tất cả liên kết spec và candidate đã ở trạng thái chuẩn.';
        listEl.appendChild(emptyLi);
        applyBtn.disabled = true;
      } else {
        applyBtn.disabled = false;
        for (const change of this._fixChanges) {
          const li = document.createElement('li');
          if (change.kind === 'chuan-hoa-duong-dan-spec') {
            li.textContent = `[Đường dẫn] ${change.file}:${change.line} -> ${change.to}`;
          } else if (change.kind === 'them-test-case-chua-khai-bao') {
            li.textContent = `[Candidate mới] ${change.file}:${change.line} -> ${change.tcId} (${change.acId}) [${change.spec}]`;
          } else {
            li.textContent = `[Thay đổi] ${change.file}:${change.line || ''} -> ${change.kind}`;
          }
          listEl.appendChild(li);
        }
      }
    } catch (err) {
      summaryText.textContent = `Lỗi kết nối khi quét Auto-Fix: ${err.message}`;
      listEl.textContent = '';
      applyBtn.disabled = true;
    }
  }

  async applyAutoFix() {
    const root = this._root();
    if (!root) return;
    const modal = root.querySelector('#qa-fix-modal');
    const applyBtn = root.querySelector('#qa-btn-apply-fix');
    const summaryText = root.querySelector('#qa-fix-summary-text');
    if (!applyBtn) return;

    applyBtn.disabled = true;
    if (summaryText) summaryText.textContent = 'Đang thực thi live fix và đồng bộ ma trận...';

    try {
      const res = await apiClient.post('/api/qa/fix', { dryRun: false });
      if (modal) modal.close();
      this.notify(res.message || 'Đã chuẩn hóa thành công các liên kết.');
      await this.reload(true);
    } catch (err) {
      if (summaryText) summaryText.textContent = `Lỗi khi thực thi: ${err.message}`;
      applyBtn.disabled = false;
    }
  }

  async openScaffoldModal() {
    const root = this._root();
    if (!root) return;
    const modal = root.querySelector('#qa-scaffold-modal');
    const reqInput = root.querySelector('#qa-scaffold-req-id');
    const titleInput = root.querySelector('#qa-scaffold-title');
    const domainInput = root.querySelector('#qa-scaffold-domain');
    const domainsList = root.querySelector('#qa-scaffold-domains-list');
    const acCountInput = root.querySelector('#qa-scaffold-ac-count');
    const specPathInput = root.querySelector('#qa-scaffold-spec-path');
    const radioNew = root.querySelector('input[name="qa-scaffold-mode"][value="new"]');
    if (!modal) return;

    if (radioNew) {
      radioNew.checked = true;
      radioNew.dispatchEvent(new Event('change'));
    }
    if (titleInput) titleInput.value = '';
    if (specPathInput) specPathInput.value = '';
    if (acCountInput) acCountInput.value = '2';

    modal.showModal();

    try {
      const meta = await apiClient.get('/api/qa/scaffold/meta');
      if (reqInput && meta.nextReqId) reqInput.value = meta.nextReqId;
      if (domainsList && Array.isArray(meta.existingDomains)) {
        domainsList.textContent = '';
        for (const d of meta.existingDomains) {
          const opt = document.createElement('option');
          opt.value = d;
          domainsList.appendChild(opt);
        }
      }
      if (domainInput && meta.existingDomains && meta.existingDomains.length > 0) {
        domainInput.value = meta.existingDomains[0];
      }
    } catch (_) {
      // fallback
    }
  }

  async submitScaffold() {
    const root = this._root();
    if (!root) return;
    const modal = root.querySelector('#qa-scaffold-modal');
    const submitBtn = root.querySelector('#qa-btn-submit-scaffold');
    const mode = root.querySelector('input[name="qa-scaffold-mode"]:checked')?.value || 'new';

    if (mode === 'infer') {
      const specPath = root.querySelector('#qa-scaffold-spec-path')?.value.trim();
      if (!specPath) {
        this.notify('Vui lòng nhập đường dẫn spec để suy luận ngược.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await apiClient.post('/api/qa/scaffold', { inferFromSpecPath: specPath });
        if (modal) modal.close();
        this.notify(res.message || 'Đã suy luận tài liệu từ spec thành công.');
        await this.reload(true);
      } catch (err) {
        this.notify(`Lỗi suy luận: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    } else {
      const reqId = root.querySelector('#qa-scaffold-req-id')?.value.trim().toUpperCase();
      const title = root.querySelector('#qa-scaffold-title')?.value.trim();
      const domain = root.querySelector('#qa-scaffold-domain')?.value.trim() || 'general';
      const acCount = parseInt(root.querySelector('#qa-scaffold-ac-count')?.value, 10) || 2;

      if (!reqId || !/^REQ-\d{3}$/.test(reqId)) {
        this.notify('Mã Requirement không hợp lệ (yêu cầu dạng REQ-001).');
        return;
      }
      if (!title) {
        this.notify('Vui lòng nhập tiêu đề tính năng.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await apiClient.post('/api/qa/scaffold', { reqId, title, domain, acCount });
        if (modal) modal.close();
        this.notify(res.message || `Đã tạo thành công bộ kịch bản cho ${reqId}.`);
        await this.reload(true);
      } catch (err) {
        this.notify(`Lỗi khởi tạo: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }
  }

  // --- panel 1: tài liệu ---

  renderDocs() {
    const root = this._root();
    if (!root || !this.trace) return;
    const workspace = root.querySelector('#qa-docs-workspace');
    const tbody = root.querySelector('#qa-docs-tbody');
    if (!workspace || !tbody) return;
    tbody.textContent = '';

    if (this.trace.available === false) {
      workspace.hidden = true;
      this._setEmpty('qa-docs-empty', [
        'Chưa có analyzer trong repo này',
        (this.trace.analyzer && this.trace.analyzer.error) || '',
        'Chạy một lượt sync từ Hub để nhận scripts/lib/qaTrace.js.',
      ].filter(Boolean));
      return;
    }

    const reqs = this.trace.requirements || [];
    if (!reqs.length && !this.documents.length) {
      workspace.hidden = true;
      this._setEmpty('qa-docs-empty', [
        'Repo này chưa có tài liệu requirement',
        `Chưa thấy thư mục "${(this.trace.dirs || {}).requirements}/" hoặc thư mục đó chưa có file nào đúng quy ước.`,
        'Đây là trạng thái bình thường khi dự án bắt đầu từ script. Mỗi requirement là một file'
          + ' Markdown mang mã REQ-xxx, bên trong có các AC-yyy.',
        `Hiện có ${(this.trace.counts || {}).specs || 0} spec chưa truy vết được về nghiệp vụ nào —`
          + ' đó chính là vùng rủi ro sót nghiệp vụ.',
      ]);
      return;
    }

    this._setEmpty('qa-docs-empty', null);
    workspace.hidden = false;

    reqs.forEach((r) => {
      const firstFile = (r.files || [])[0];
      const cellFile = firstFile
        ? this._docLink(firstFile, (r.files || []).join(', '))
        : this._cell('—', 'qa-dim');
      const action = this._el('td');
      if (firstFile) {
        const btn = this._el('button', 'Mở tài liệu', 'btn-secondary-sm');
        btn.type = 'button';
        const handler = () => this.openDocument(firstFile);
        btn.addEventListener('click', handler);
        this._renderDisposers.push(() => btn.removeEventListener('click', handler));
        action.appendChild(btn);
      }
      tbody.appendChild(this._row([
        this._cell(r.id, 'qa-mono'),
        this._cell(r.acCount),
        this._cell(r.tcCount),
        cellFile,
        action,
      ]));
    });

    this.renderDocList();
    // Giữ nguyên trạng thái đang đọc sau mỗi lượt render, và nạp lại nội dung vì file có thể
    // đã đổi trên đĩa giữa hai lần Làm mới.
    if (this.activeDocPath) this.openDocument(this.activeDocPath);
    else this.showOverview();
  }

  /** Ô "File" bấm được — đường dẫn chính là thứ người ta muốn mở. */
  _docLink(relPath, label) {
    const td = this._el('td');
    const btn = this._el('button', label || relPath, 'qa-file-link qa-mono');
    btn.type = 'button';
    btn.title = `Mở ${relPath}`;
    const handler = () => this.openDocument(relPath);
    btn.addEventListener('click', handler);
    this._renderDisposers.push(() => btn.removeEventListener('click', handler));
    td.appendChild(btn);
    return td;
  }

  renderDocList() {
    const root = this._root();
    const list = root && root.querySelector('#qa-docs-list');
    const empty = root && root.querySelector('#qa-docs-list-empty');
    if (!list || !empty) return;
    list.textContent = '';

    const needle = (this.docFilter || '').trim().toLowerCase();
    const matches = this.documents.filter((d) => !needle
      || d.path.toLowerCase().includes(needle)
      || (d.ids || []).some((id) => id.toLowerCase().includes(needle)));

    empty.hidden = matches.length > 0;
    const countEl = root && root.querySelector('#qa-docs-count');
    if (countEl) countEl.textContent = matches.length;

    const GROUPS = [
      { kind: 'requirement', label: 'Requirement' },
      { kind: 'test-case', label: 'Test case' },
    ];
    for (const group of GROUPS) {
      const items = matches.filter((d) => d.kind === group.kind);
      if (!items.length) continue;
      list.appendChild(this._el('p', `${group.label} (${items.length})`, 'qa-docs-group'));
      for (const doc of items) list.appendChild(this._docListItem(doc));
    }
  }

  _docListItem(doc) {
    const active = this.activeDocPath === doc.path;
    const btn = this._el('div', null, `qa-doc-item dashboard-list-card${active ? ' is-active active' : ''}`);
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-current', active ? 'true' : 'false');

    const isReq = doc.kind === 'requirement' || (doc.path && doc.path.startsWith('requirements'));
    const iconClass = isReq ? 'ph-file-text' : 'ph-check-square-offset';
    const iconWrap = this._el('div', null, 'qa-doc-icon dashboard-list-card__icon');
    const icon = this._el('i', null, `ph-bold ${iconClass}`);
    iconWrap.appendChild(icon);
    btn.appendChild(iconWrap);

    const body = this._el('div', null, 'qa-doc-item-body dashboard-list-card__body');
    body.appendChild(this._el('span', doc.name, 'qa-doc-item-name'));

    const ids = doc.ids || [];
    if (ids.length) {
      const idsWrap = this._el('div', null, 'qa-doc-item-ids');
      const maxShown = 3;
      const shown = ids.slice(0, maxShown);
      for (const id of shown) {
        idsWrap.appendChild(this._el('span', id, 'qa-doc-id-chip'));
      }
      if (ids.length > maxShown) {
        idsWrap.appendChild(this._el('span', `+${ids.length - maxShown}`, 'qa-doc-id-chip qa-doc-id-chip--more'));
      }
      body.appendChild(idsWrap);
    }
    btn.appendChild(body);

    const handler = () => this.openDocument(doc.path);
    btn.addEventListener('click', handler);
    this._renderDisposers.push(() => btn.removeEventListener('click', handler));
    return btn;
  }

  showOverview() {
    const root = this._root();
    if (!root) return;
    this.activeDocPath = null;
    this._activeDoc = null;
    this._closeReaderForm();
    const overview = root.querySelector('#qa-reader-overview');
    const doc = root.querySelector('#qa-reader-doc');
    if (overview) overview.hidden = false;
    if (doc) doc.hidden = true;
    this.renderDocList();
  }

  async openDocument(relPath) {
    const root = this._root();
    if (!root || !relPath) return;
    const overview = root.querySelector('#qa-reader-overview');
    const pane = root.querySelector('#qa-reader-doc');
    const body = root.querySelector('#qa-reader-body');
    const chips = root.querySelector('#qa-reader-chips');
    if (!pane || !body) return;

    this.activeDocPath = relPath;
    this._activeDoc = null;
    this._closeReaderForm();
    if (overview) overview.hidden = true;
    pane.hidden = false;
    this.renderDocList();

    body.textContent = '';
    if (chips) chips.textContent = '';
    body.appendChild(this._el('p', 'Đang mở tài liệu…', 'qa-reader-loading'));

    let doc;
    try {
      doc = await apiClient.get('/api/qa/document', { path: relPath });
    } catch (error) {
      body.textContent = '';
      body.appendChild(this._el(
        'div',
        error.status === 404
          ? `Không tìm thấy ${relPath} trong danh sách tài liệu đọc được của repo này.`
          : `Không mở được tài liệu: ${error.message}`,
        'qa-reader-error',
      ));
      this._setReaderHead(relPath, null);
      return;
    }

    // Người dùng có thể đã bấm sang tài liệu khác trong lúc chờ mạng.
    if (this.activeDocPath !== relPath) return;

    this._activeDoc = doc;
    const { meta, body: markdown } = parseFrontMatter(doc.content);
    this._setReaderHead(doc.path, doc, meta);
    this._setReaderActions(doc, doc.content);
    this._renderDocMeta(meta);
    if (chips) this._renderDocChips(chips, doc);

    body.textContent = '';
    body.appendChild(renderMarkdown(markdown));
    body.scrollTop = 0;
    this._renderOutline(body);
  }

  /**
   * Bật/tắt hai nút hành động. Chỉ tài liệu requirement mới sửa được — test-cases/ là đầu
   * ra của quy trình viết test, sửa tay ở đây sẽ lệch khỏi thứ sinh ra nó.
   */
  _setReaderActions(doc, markdown) {
    const root = this._root();
    if (!root) return;
    const answerBtn = root.querySelector('#qa-reader-answer');
    const answerLabel = root.querySelector('#qa-reader-answer-label');
    const editBtn = root.querySelector('#qa-reader-edit');
    const editable = Boolean(doc) && doc.kind === 'requirement';

    if (editBtn) editBtn.hidden = !editable;
    if (!answerBtn) return;

    const parsed = editable ? parseOpenQuestions(markdown) : { found: false, questions: [] };
    this._openQuestions = parsed.questions;
    const pending = parsed.questions.filter((q) => !q.answered).length;
    answerBtn.hidden = !parsed.found || !parsed.questions.length;
    if (answerLabel) {
      answerLabel.textContent = pending
        ? `Trả lời câu hỏi (${pending})`
        : 'Câu hỏi đã chốt';
    }
  }

  _closeReaderForm() {
    const box = this._root() && this._root().querySelector('#qa-reader-form');
    if (!box) return;
    box.textContent = '';
    box.hidden = true;
  }

  /** Khung chung cho hai biểu mẫu: tiêu đề, vùng thân, ô người chốt, nút lưu/huỷ. */
  _formShell(title, hint) {
    const box = this._root().querySelector('#qa-reader-form');
    box.textContent = '';
    box.hidden = false;
    box.appendChild(this._el('p', title, 'qa-form-title'));
    if (hint) box.appendChild(this._el('p', hint, 'qa-form-hint'));

    const body = this._el('div', null, 'qa-form-body');
    box.appendChild(body);

    const footer = this._el('div', null, 'qa-form-footer');
    const byWrap = this._el('label', null, 'qa-form-by');
    byWrap.appendChild(this._el('span', 'Người chốt', 'qa-field-label'));
    const by = document.createElement('input');
    by.type = 'text';
    by.placeholder = 'Tên bạn';
    by.value = this._lastAuthor || '';
    byWrap.appendChild(by);
    footer.appendChild(byWrap);

    const save = this._el('button', 'Lưu vào tài liệu', 'btn-primary-sm');
    save.type = 'button';
    const cancel = this._el('button', 'Huỷ', 'btn-secondary-sm');
    cancel.type = 'button';
    const status = this._el('span', '', 'qa-form-status');
    footer.appendChild(save);
    footer.appendChild(cancel);
    footer.appendChild(status);
    box.appendChild(footer);

    const onCancel = () => this._closeReaderForm();
    cancel.addEventListener('click', onCancel);
    this._renderDisposers.push(() => cancel.removeEventListener('click', onCancel));

    return { box, body, by, save, status };
  }

  /**
   * Gửi nội dung mới lên server. Mọi biểu mẫu đều đi qua đúng đường này: một chỗ ghi duy
   * nhất thì chỉ có một chỗ phải bảo vệ và kiểm thử.
   */
  async _saveDocument(content, status, save) {
    const doc = this._activeDoc;
    if (!doc) return false;
    save.disabled = true;
    status.className = 'qa-form-status';
    status.textContent = 'Đang lưu…';
    try {
      const res = await apiClient.put('/api/qa/document', {
        path: doc.path,
        content,
        expectedBytes: doc.bytes,
      });
      status.textContent = res.changed ? `Đã lưu. Bản sao lưu: ${res.backup}` : 'Không có thay đổi nào.';
      this._closeReaderForm();
      await this.reload();
      this.notify(res.changed ? 'Đã cập nhật tài liệu requirement.' : 'Tài liệu không thay đổi.');
      return true;
    } catch (error) {
      status.className = 'qa-form-status is-error';
      status.textContent = error.status === 409
        ? 'Tài liệu đã đổi trên đĩa (hoặc AI Agent đang chạy). Bấm Làm mới rồi thử lại.'
        : `Không lưu được: ${error.message}`;
      save.disabled = false;
      return false;
    }
  }

  /** Biểu mẫu trả lời từng câu hỏi treo trong mục Open questions. */
  openAnswerForm() {
    if (!this._activeDoc || !this._openQuestions || !this._openQuestions.length) return;
    const { body, by, save, status } = this._formShell(
      'Trả lời câu hỏi treo',
      'Câu trả lời được ghi thẳng vào dòng câu hỏi, thay cho đuôi "cần ... xác nhận".'
        + ' Phần còn lại của tài liệu giữ nguyên từng dòng.',
    );

    const inputs = [];
    for (const q of this._openQuestions) {
      const card = this._el('div', null, `qa-question${q.answered ? ' is-answered' : ''}`);
      card.appendChild(this._el('p', q.text, 'qa-question-text'));
      if (q.answered) {
        card.appendChild(this._el('p', 'Câu này đã có kết luận trong tài liệu.', 'qa-question-note'));
      } else {
        const area = document.createElement('textarea');
        area.className = 'qa-textarea';
        area.style.width = '100%';
        area.style.boxSizing = 'border-box';
        area.rows = 2;
        area.placeholder = 'Kết luận của bạn…';
        card.appendChild(area);
        inputs.push({ line: q.line, area });
      }
      body.appendChild(card);
    }

    const handler = async () => {
      const author = by.value.trim();
      if (!author) {
        status.className = 'qa-form-status is-error';
        status.textContent = 'Cần tên người chốt để ghi vào tài liệu.';
        return;
      }
      const answers = inputs
        .map((i) => ({ line: i.line, answer: i.area.value }))
        .filter((a) => a.answer.trim());
      if (!answers.length) {
        status.className = 'qa-form-status is-error';
        status.textContent = 'Chưa nhập câu trả lời nào.';
        return;
      }
      this._lastAuthor = author;
      const stamp = new Date().toISOString().slice(0, 10);
      const next = applyAnswers(this._activeDoc.content, answers, { author, date: stamp });
      await this._saveDocument(next.content, status, save);
    };
    save.addEventListener('click', handler);
    this._renderDisposers.push(() => save.removeEventListener('click', handler));
  }

  /** Sửa trực tiếp Markdown thô. Dành cho việc viết lại đoạn văn, không chỉ trả lời. */
  openEditForm() {
    if (!this._activeDoc) return;
    const { body, by, save, status } = this._formShell(
      'Sửa tài liệu requirement',
      'Sửa trực tiếp Markdown. Bản cũ được sao lưu tự động trước khi ghi đè.',
    );

    const area = document.createElement('textarea');
    area.className = 'qa-textarea qa-edit-area';
    area.style.width = '100%';
    area.style.boxSizing = 'border-box';
    area.rows = 22;
    area.value = this._activeDoc.content;
    area.spellcheck = false;
    body.appendChild(area);

    const handler = async () => {
      const author = by.value.trim();
      if (author) this._lastAuthor = author;
      await this._saveDocument(area.value, status, save);
    };
    save.addEventListener('click', handler);
    this._renderDisposers.push(() => save.removeEventListener('click', handler));
  }

  /**
   * Mục lục dựng từ CHÍNH các tiêu đề đã render, không phải từ một lượt phân tích thứ hai.
   * Một nguồn sự thật duy nhất: mục lục không thể lệch khỏi nội dung đang hiển thị.
   */
  _renderOutline(body) {
    const box = this._root() && this._root().querySelector('#qa-reader-outline');
    if (!box) return;
    box.textContent = '';

    const headings = [...body.querySelectorAll('.qa-md-h')];
    // Một hai tiêu đề thì mục lục chỉ tốn chỗ; để trống cho :empty ẩn đi.
    if (headings.length < 3) return;

    box.appendChild(this._el('p', 'Mục lục', 'qa-outline-title'));
    headings.forEach((heading, index) => {
      const level = Number((heading.className.match(/qa-md-h(\d)/) || [, '1'])[1]);
      const link = this._el('button', heading.textContent, `qa-outline-link qa-outline-l${level}`);
      link.type = 'button';
      link.title = heading.textContent;
      const handler = () => {
        body.scrollTop = heading.offsetTop - body.offsetTop;
      };
      link.addEventListener('click', handler);
      this._renderDisposers.push(() => link.removeEventListener('click', handler));
      box.appendChild(link);
      void index;
    });
  }

  /** Frontmatter thành dải key/value gọn ở đầu — đây là thứ người đọc liếc trước tiên. */
  _renderDocMeta(meta) {
    const box = this._root() && this._root().querySelector('#qa-reader-meta');
    if (!box) return;
    box.textContent = '';
    // `title` đã lên tiêu đề, `id` đã nằm trong chip — nhắc lại chỉ tốn chỗ.
    const SKIP = new Set(['title', 'id', 'slug']);
    for (const [key, value] of meta) {
      if (SKIP.has(key.toLowerCase()) || !value) continue;
      box.appendChild(this._el('dt', key));
      box.appendChild(this._el('dd', value));
    }
  }

  _setReaderHead(relPath, doc, meta = []) {
    const root = this._root();
    if (!root) return;
    const kind = root.querySelector('#qa-reader-kind');
    const title = root.querySelector('#qa-reader-title');
    const pathEl = root.querySelector('#qa-reader-path');
    const label = doc && doc.kind === 'test-case' ? 'TÀI LIỆU TEST CASE' : 'TÀI LIỆU REQUIREMENT';
    // Tiêu đề thật của tài liệu nằm trong frontmatter; tên file chỉ là phương án dự phòng.
    const fromMeta = (meta.find(([k]) => k.toLowerCase() === 'title') || [])[1];
    if (kind) kind.textContent = doc ? label : 'TÀI LIỆU';
    if (title) title.textContent = doc ? (fromMeta || doc.name) : relPath;
    if (pathEl) {
      pathEl.textContent = doc
        ? `${doc.path} · ${Math.max(1, Math.round(doc.bytes / 1024))} KB`
        : relPath;
    }
  }

  /**
   * Chip phía trên tài liệu: với requirement thì hiện từng AC kèm trạng thái đã/chưa có
   * test case. Đây chính là câu hỏi người đọc mang theo khi mở file, nên trả lời ngay
   * thay vì bắt họ tự đối chiếu với bảng ở tab khác.
   */
  _renderDocChips(container, doc) {
    container.textContent = '';
    const req = (this.trace.requirements || []).find((r) => (r.files || []).includes(doc.path));

    if (doc.kind === 'requirement' && req) {
      const uncovered = new Set(
        (this.trace.findings.major || [])
          .filter((f) => f.kind === 'ac-khong-co-tc')
          .map((f) => f.id),
      );
      for (const ac of (req.acs || []).slice().sort()) {
        const covered = !uncovered.has(ac);
        const chip = this._el('span', null, `qa-chip ${covered ? 'qa-chip-covered' : 'qa-chip-uncovered'}`);
        chip.appendChild(this._el('span', ac));
        chip.appendChild(this._el('span', covered ? 'có TC' : 'chưa có TC'));
        chip.title = covered ? `${ac} đã có test case` : `${ac} chưa có test case nào phủ`;
        container.appendChild(chip);
      }
      return;
    }

    for (const id of (doc.ids || []).slice(0, 24)) {
      container.appendChild(this._el('span', id, 'qa-chip'));
    }
    if ((doc.ids || []).length > 24) {
      container.appendChild(this._el('span', `+${doc.ids.length - 24}`, 'qa-chip'));
    }
  }

  renderCandidates() {
    const root = this._root();
    if (!root) return;
    const wrap = root.querySelector('#qa-candidates-wrap');
    const tbody = root.querySelector('#qa-candidates-tbody');
    if (!wrap || !tbody) return;
    tbody.textContent = '';

    const list = this.candidates
      .filter((c) => this.priorityFilter === 'all' || c.priority === this.priorityFilter)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
        || String(a.id).localeCompare(String(b.id)));

    if (!list.length) {
      wrap.hidden = true;
      this._syncPickState();
      this._setEmpty('qa-candidates-empty', this.candidates.length
        ? ['Không có ứng viên nào ở mức ưu tiên này']
        : [
          'Không có test case nào đang chờ automation',
          'Hoặc mọi test case đã có script, hoặc repo chưa có thư mục test-cases/.',
        ]);
      return;
    }

    this._setEmpty('qa-candidates-empty', null);
    list.forEach((c) => {
      const prioKey = String(c.priority || '').toLowerCase();
      const prioClass = KNOWN_PRIORITY.has(prioKey) ? ` qa-prio-${prioKey}` : '';
      const prio = this._cell(c.priority || '—', `qa-prio${prioClass}`);
      tbody.appendChild(this._row([
        this._pickCell(c.id),
        this._cell(c.id, 'qa-mono'),
        this._cell(c.req || '—', 'qa-mono'),
        this._cell((c.acs || []).join(', ') || '—', 'qa-mono'),
        prio,
        this._cell(AUTOMATION_LABEL[c.automation] || 'Chưa khai', 'qa-dim'),
        this._cell(c.file || '—', 'qa-mono qa-dim'),
      ]));
    });
    wrap.hidden = false;
    this._syncPickState();
  }

  /** Ô chọn của một ứng viên. Trạng thái giữ trong Set để không phụ thuộc DOM. */
  _pickCell(id) {
    const td = this._el('td', null, 'qa-pick-col');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.pickedIds.has(id);
    box.setAttribute('aria-label', `Chọn ${id}`);
    const handler = () => {
      if (box.checked) this.pickedIds.add(id);
      else this.pickedIds.delete(id);
      this._syncPickState();
    };
    box.addEventListener('change', handler);
    this._renderDisposers.push(() => box.removeEventListener('change', handler));
    td.appendChild(box);
    return td;
  }

  /** Đồng bộ nút và ô "chọn tất cả" theo tập đang chọn. */
  _syncPickState() {
    const root = this._root();
    if (!root) return;
    const visible = [...root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')];
    const picked = visible.filter((b) => b.checked).length;

    const all = root.querySelector('#qa-pick-all');
    if (all) {
      all.checked = visible.length > 0 && picked === visible.length;
      all.indeterminate = picked > 0 && picked < visible.length;
    }

    const btn = root.querySelector('#qa-btn-draft');
    const label = root.querySelector('#qa-btn-draft-label');
    const clear = root.querySelector('#qa-btn-draft-clear');
    if (btn) btn.disabled = this.pickedIds.size === 0;
    if (label) {
      label.textContent = this.pickedIds.size
        ? `Sinh bản thảo BDD (${this.pickedIds.size})`
        : 'Sinh bản thảo BDD';
    }
    if (clear) clear.hidden = this.pickedIds.size === 0;
  }

  toggleAllPicks(checked) {
    const root = this._root();
    if (!root) return;
    for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) {
      box.checked = checked;
      const id = (box.getAttribute('aria-label') || '').replace('Chọn ', '').trim();
      if (checked) this.pickedIds.add(id);
      else this.pickedIds.delete(id);
    }
    this._syncPickState();
  }

  clearPicks() {
    this.pickedIds.clear();
    const root = this._root();
    if (root) {
      for (const box of root.querySelectorAll('#qa-candidates-tbody .qa-pick-col input')) box.checked = false;
    }
    this._closeDraft();
    this._syncPickState();
  }

  _closeDraft() {
    const box = this._root() && this._root().querySelector('#qa-draft');
    if (box) {
      box.classList.remove('is-fullscreen');
      const expandIcon = box.querySelector('#qa-draft-expand-icon');
      const expandLabel = box.querySelector('#qa-draft-expand-label');
      const expandBtn = box.querySelector('#qa-draft-expand');
      if (expandIcon) expandIcon.className = 'ph-bold ph-corners-out';
      if (expandLabel) expandLabel.textContent = 'Phóng to';
      if (expandBtn) expandBtn.title = 'Phóng to toàn màn hình';
      box.hidden = true;
    }
  }

  toggleDraftFullscreen(forceState) {
    const box = this._root() && this._root().querySelector('#qa-draft');
    if (!box) return;
    const isFull = typeof forceState === 'boolean' ? forceState : !box.classList.contains('is-fullscreen');
    box.classList.toggle('is-fullscreen', isFull);
    const expandIcon = box.querySelector('#qa-draft-expand-icon');
    const expandLabel = box.querySelector('#qa-draft-expand-label');
    const expandBtn = box.querySelector('#qa-draft-expand');
    if (expandIcon) expandIcon.className = isFull ? 'ph-bold ph-corners-in' : 'ph-bold ph-corners-out';
    if (expandLabel) expandLabel.textContent = isFull ? 'Thu nhỏ' : 'Phóng to';
    if (expandBtn) expandBtn.title = isFull ? 'Thu nhỏ khung xem (Esc)' : 'Phóng to toàn màn hình';
  }

  /**
   * Sinh bản thảo. KHÔNG lưu ở đâu cả — mỗi lần bấm là dựng lại từ tài liệu hiện tại, vì
   * test case còn thay đổi theo hệ thống. Muốn giữ thì người dùng tự sao chép ra.
   */
  async generateDraft() {
    const root = this._root();
    if (!root || !this.pickedIds.size) return;
    const box = root.querySelector('#qa-draft');
    const body = root.querySelector('#qa-draft-body');
    const meta = root.querySelector('#qa-draft-meta');
    const warn = root.querySelector('#qa-draft-warnings');
    if (!box || !body) return;

    box.hidden = false;
    body.style.width = '100%';
    body.style.maxWidth = 'none';
    body.textContent = 'Đang dựng bản thảo…';
    if (warn) warn.textContent = '';
    if (meta) meta.textContent = '';

    const ids = [...this.pickedIds].sort();
    let res;
    try {
      res = await apiClient.get('/api/qa/bdd-draft', { ids: ids.join(',') });
    } catch (error) {
      body.textContent = '';
      if (meta) meta.textContent = '';
      if (warn) {
        warn.textContent = '';
        warn.appendChild(this._el('p', `Không dựng được bản thảo: ${error.message}`, 'qa-draft-error'));
      }
      return;
    }

    this.draftText = res.text || '';
    body.textContent = this.draftText;
    if (meta) {
      const missing = (res.missing || []).length ? ` · không có trong tài liệu: ${res.missing.join(', ')}` : '';
      meta.textContent = `${(res.ids || []).length} test case · dựng từ ${(res.dirs || {}).testCases}/${missing}`;
    }
    if (warn) {
      warn.textContent = '';
      for (const w of res.warnings || []) warn.appendChild(this._el('p', w, 'qa-draft-warn'));
    }
    body.scrollTop = 0;
  }

  async copyDraft() {
    const root = this._root();
    const copyBtn = root && root.querySelector('#qa-draft-copy');
    const status = root && root.querySelector('#qa-draft-meta');
    if (!this.draftText) return;
    try {
      await navigator.clipboard.writeText(this.draftText);
      this.notify('Đã sao chép kịch bản BDD vào bộ nhớ tạm.');
      if (copyBtn) {
        const origContent = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="ph-bold ph-check"></i> <span>Đã sao chép!</span>';
        copyBtn.style.borderColor = 'var(--success, #10b981)';
        copyBtn.style.color = 'var(--success, #10b981)';
        setTimeout(() => {
          copyBtn.innerHTML = origContent;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 1800);
      }
    } catch (_) {
      // Không có quyền clipboard thì vẫn phải có đường thoát: bôi đen sẵn cho người dùng.
      const body = root && root.querySelector('#qa-draft-body');
      if (body && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(body);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (status) status.textContent = 'Trình duyệt chặn clipboard — nội dung đã được bôi đen, bấm Ctrl+C.';
    }
  }

  // --- panel 3: findings ---

  renderFindings() {
    const root = this._root();
    if (!root) return;

    // 1. Render Static Findings & Gaps Card
    const staticGapsCard = root.querySelector('#qa-static-gaps-card');
    const staticGapsBadge = root.querySelector('#qa-static-gaps-badge');
    const staticGapsList = root.querySelector('#qa-static-gaps-list');

    const allFindings = (this.summary && Array.isArray(this.summary.findings))
      ? this.summary.findings
      : [];

    const staticGaps = allFindings.filter((f) =>
      f.kind === 'assertion-thieu-await' ||
      f.kind === 'rule-thieu-boundary-test' ||
      f.kind === 'thieu-kiem-tra-bien' ||
      f.kind === 'doc-duoc-0-spec' ||
      f.kind === 'drift' ||
      f.kind === 'chuan-hoa-duong-dan-spec'
    );

    if (staticGapsCard && staticGapsList) {
      staticGapsList.textContent = '';
      if (staticGaps.length === 0) {
        staticGapsCard.hidden = true;
      } else {
        staticGapsCard.hidden = false;
        if (staticGapsBadge) staticGapsBadge.textContent = `${staticGaps.length} cảnh báo kỹ thuật`;

        for (const gap of staticGaps) {
          const row = document.createElement('div');
          row.className = 'qa-static-gap-row';

          const iconCol = document.createElement('div');
          iconCol.className = 'qa-gap-icon-col';
          const icon = document.createElement('i');
          if (gap.kind === 'assertion-thieu-await') {
            icon.className = 'ph-bold ph-warning-circle';
            icon.style.color = 'var(--danger)';
          } else if (gap.kind === 'rule-thieu-boundary-test' || gap.kind === 'thieu-kiem-tra-bien') {
            icon.className = 'ph-bold ph-compass';
            icon.style.color = 'var(--warning)';
          } else {
            icon.className = 'ph-bold ph-git-diff';
            icon.style.color = 'var(--accent)';
          }
          iconCol.appendChild(icon);
          row.appendChild(iconCol);

          const contentCol = document.createElement('div');
          contentCol.className = 'qa-gap-content-col';

          const title = document.createElement('div');
          title.className = 'qa-gap-title';
          const labelSpan = document.createElement('span');
          labelSpan.textContent = gap.label || gap.kind;
          title.appendChild(labelSpan);

          if (gap.where || gap.id) {
            const loc = document.createElement('span');
            loc.className = 'qa-gap-location';
            loc.textContent = gap.where || gap.id;
            title.appendChild(loc);
          }
          contentCol.appendChild(title);

          const detail = document.createElement('div');
          detail.className = 'qa-gap-detail';
          detail.textContent = gap.detail || gap.message || '';
          if (gap.action) {
            detail.textContent += ` ➔ Hướng dẫn: ${gap.action}`;
          }
          contentCol.appendChild(detail);

          row.appendChild(contentCol);
          staticGapsList.appendChild(row);
        }
      }
    }

    // 2. Render nhóm Findings chung từ trace
    const box = root.querySelector('#qa-findings-groups');
    if (!box || !this.trace) return;
    box.textContent = '';

    const groups = this.trace.findings || {};
    const total = ['major', 'minor', 'info'].reduce((n, k) => n + ((groups[k] || []).length), 0);
    if (!total && staticGaps.length === 0) {
      this._setEmpty('qa-findings-empty', this.trace.bootstrap
        ? ['Chưa có gì để đối chiếu', 'Repo chưa có tài liệu nên chưa thể tìm khoảng hở nào.']
        : ['Không còn khoảng hở nào trong ma trận truy vết']);
      return;
    }
    this._setEmpty('qa-findings-empty', null);

    ['major', 'minor', 'info'].forEach((severity) => {
      const items = groups[severity] || [];
      if (!items.length) return;
      const section = this._el('div', null, `qa-finding-group qa-finding-${severity}`);
      section.appendChild(this._el('h4', `${SEVERITY_LABEL[severity]} (${items.length})`, 'qa-finding-head'));

      const byKind = new Map();
      items.forEach((f) => {
        if (!byKind.has(f.kind)) byKind.set(f.kind, { label: f.label, rows: [] });
        byKind.get(f.kind).rows.push(f);
      });
      byKind.forEach(({ label, rows }) => {
        section.appendChild(this._el('p', `${label} — ${rows.length}`, 'qa-finding-kind'));
        const ul = this._el('ul', null, 'qa-finding-list');
        rows.slice(0, 50).forEach((f) => ul.appendChild(this._el('li', f.detail)));
        if (rows.length > 50) ul.appendChild(this._el('li', `… và ${rows.length - 50} mục nữa`, 'qa-dim'));
        section.appendChild(ul);
      });
      box.appendChild(section);
    });
  }

  // --- panel 4: quyết định ---

  renderDecisions() {
    const root = this._root();
    if (!root) return;
    const box = root.querySelector('#qa-decisions-list');
    if (!box) return;
    box.textContent = '';

    const data = this.decisions;
    if (!data || !data.exists || !data.decisions.length) {
      this._setEmpty('qa-decisions-empty', [
        'Chưa có sổ quyết định',
        `Tạo file "${(data && data.file) || 'decisions.json'}" ở gốc repo khi cần ghi lại các quyết định`
          + ' còn treo. Thiếu file là trạng thái bình thường, không phải lỗi.',
      ]);
      return;
    }
    this._setEmpty('qa-decisions-empty', null);

    data.decisions.forEach((d) => box.appendChild(this._decisionCard(d)));
  }

  _decisionCard(d) {
    const card = this._el('article', null, `qa-decision ${d.answered ? 'is-answered' : 'is-pending'}`);

    const head = this._el('div', null, 'qa-decision-head');
    head.appendChild(this._el('span', d.id, 'qa-mono'));
    head.appendChild(this._el('strong', d.title || '(không có tiêu đề)', 'qa-decision-title'));
    if (d.severity) {
      const sevClass = KNOWN_SEVERITY.has(d.severity) ? ` qa-badge-${d.severity}` : '';
      head.appendChild(this._el('span', d.severity, `qa-badge${sevClass}`));
    }
    head.appendChild(this._el('span', d.answered ? 'Đã chốt' : 'Đang chờ', 'qa-decision-state'));
    card.appendChild(head);

    if (d.blocks) card.appendChild(this._el('p', `Đang chặn: ${d.blocks}`, 'qa-decision-blocks'));
    if (d.context) card.appendChild(this._el('p', d.context, 'qa-decision-context'));

    const form = this._el('div', null, 'qa-decision-form');
    const groupName = `qa-decision-${d.id}`;
    (d.options || []).forEach((opt) => {
      const label = this._el('label', null, 'qa-option');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = opt.id;
      input.checked = d.answer.optionId === opt.id;
      label.appendChild(input);
      const text = this._el('span', null, 'qa-option-text');
      text.appendChild(this._el('strong', opt.label || opt.id));
      if (opt.id === d.recommended) text.appendChild(this._el('span', 'Đề xuất', 'qa-badge qa-badge-rec'));
      if (opt.consequence) text.appendChild(this._el('small', opt.consequence, 'qa-option-conseq'));
      label.appendChild(text);
      form.appendChild(label);
    });
    if (d.recommendationReason) {
      form.appendChild(this._el('p', `Lý do đề xuất: ${d.recommendationReason}`, 'qa-decision-reason'));
    }

    // answer.note mang hai nghĩa: chưa chốt thì là gợi ý cho người điền, đã chốt thì là lý do.
    const noteWrap = this._el('div', null, 'qa-field');
    noteWrap.appendChild(this._el('label', d.answered ? 'Lý do đã ghi' : 'Lý do chọn', 'qa-field-label'));
    const note = document.createElement('textarea');
    note.className = 'qa-textarea';
    note.rows = 2;
    note.value = d.answered ? (d.answer.note || '') : '';
    if (!d.answered && d.answer.note) note.placeholder = d.answer.note;
    noteWrap.appendChild(note);
    form.appendChild(noteWrap);

    const byWrap = this._el('div', null, 'qa-field');
    byWrap.appendChild(this._el('label', 'Người chốt (bắt buộc)', 'qa-field-label'));
    const by = document.createElement('input');
    by.type = 'text';
    // input đã được ui-primitives tạo kiểu sẵn; không cần lớp riêng.
    by.value = d.answer.confirmedBy || '';
    byWrap.appendChild(by);
    form.appendChild(byWrap);

    const actions = this._el('div', null, 'qa-decision-actions');
    const save = this._el('button', 'Lưu quyết định', 'btn-primary-sm');
    save.type = 'button';
    const status = this._el('span', d.answer.confirmedAt ? `Chốt lúc ${d.answer.confirmedAt}` : '', 'qa-decision-stamp');
    const handler = async () => {
      const picked = form.querySelector(`input[name="${groupName}"]:checked`);
      save.disabled = true;
      status.textContent = 'Đang lưu…';
      try {
        const res = await apiClient.put('/api/qa/decision', {
          id: d.id,
          optionId: picked ? picked.value : null,
          note: note.value,
          confirmedBy: by.value,
        });
        status.textContent = res.decision && res.decision.answered
          ? `Đã chốt lúc ${res.decision.answer.confirmedAt}`
          : 'Đã lưu nháp — còn thiếu người chốt nên chưa tính là đã trả lời.';
        this.notify('Đã lưu quyết định.');
        await this.reload();
        this.switchTab('decisions');
      } catch (error) {
        // 409 khi AI agent đang chạy: nói thẳng, đừng nuốt lỗi.
        status.textContent = error.status === 409
          ? 'Không lưu được: AI Agent đang chạy. Dừng tác vụ rồi thử lại.'
          : `Không lưu được: ${error.message}`;
      } finally {
        save.disabled = false;
      }
    };
    save.addEventListener('click', handler);
    this._disposers.push(() => save.removeEventListener('click', handler));
    actions.appendChild(save);
    actions.appendChild(status);
    form.appendChild(actions);

    card.appendChild(form);
    return card;
  }

  notify(msg) {
    eventBus.emit('ui:notify', { message: msg });
  }
}

export const qaSlice = new QaSlice();
