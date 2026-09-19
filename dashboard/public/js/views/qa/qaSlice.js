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
    this.candidates = [];
    this.decisions = null;
    this.activeTab = 'docs';
    this.priorityFilter = 'all';
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
    on(root.querySelector('#qa-detail-close'), 'click', () => {
      const box = root.querySelector('#qa-docs-detail');
      if (box) box.hidden = true;
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

  async reload(announce = false) {
    const root = this._root();
    if (!root) return;
    try {
      const [trace, candidates, decisions] = await Promise.all([
        apiClient.get('/api/qa/trace'),
        apiClient.get('/api/qa/candidates', { limit: 50 }),
        apiClient.get('/api/qa/decisions'),
      ]);
      this.trace = trace;
      this.candidates = Array.isArray(candidates.candidates) ? candidates.candidates : [];
      this.decisions = decisions;
    } catch (error) {
      this._showAlert(`Không tải được dữ liệu QA: ${error.message}`, 'danger');
      return;
    }
    this.renderAll();
    if (announce) this.notify('Đã làm mới dữ liệu QA.');
  }

  renderAll() {
    this._flushRenderDisposers();
    this._renderSourceBar();
    this._renderStats();
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
    if (this.trace.available === false) {
      this._showAlert(
        (this.trace.analyzer && this.trace.analyzer.error) || 'Analyzer chưa sẵn sàng.',
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

  // --- panel 1: tài liệu ---

  renderDocs() {
    const root = this._root();
    if (!root || !this.trace) return;
    const wrap = root.querySelector('#qa-docs-table-wrap');
    const tbody = root.querySelector('#qa-docs-tbody');
    if (!wrap || !tbody) return;
    tbody.textContent = '';

    if (this.trace.available === false) {
      wrap.hidden = true;
      this._setEmpty('qa-docs-empty', [
        'Chưa có analyzer trong repo này',
        (this.trace.analyzer && this.trace.analyzer.error) || '',
        'Chạy một lượt sync từ Hub để nhận scripts/lib/qaTrace.js.',
      ].filter(Boolean));
      return;
    }

    const reqs = this.trace.requirements || [];
    if (!reqs.length) {
      wrap.hidden = true;
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
    reqs.forEach((r) => {
      const btn = this._el('button', 'Xem chi tiết', 'btn-secondary-sm');
      btn.type = 'button';
      const handler = () => this._showDetail(r);
      btn.addEventListener('click', handler);
      this._renderDisposers.push(() => btn.removeEventListener('click', handler));
      const action = this._el('td');
      action.appendChild(btn);

      tbody.appendChild(this._row([
        this._cell(r.id, 'qa-mono'),
        this._cell(r.acCount),
        this._cell(r.tcCount),
        this._cell((r.files || []).join(', '), 'qa-mono qa-dim'),
        action,
      ]));
    });
    wrap.hidden = false;
  }

  _showDetail(req) {
    const root = this._root();
    const box = root && root.querySelector('#qa-docs-detail');
    const title = root && root.querySelector('#qa-detail-title');
    const body = root && root.querySelector('#qa-detail-body');
    if (!box || !title || !body) return;
    title.textContent = `${req.id} — ${req.acCount} acceptance criteria, ${req.tcCount} test case`;
    body.textContent = '';

    body.appendChild(this._el('p', 'Acceptance criteria:', 'qa-detail-label'));
    const list = this._el('ul', null, 'qa-detail-list');
    (req.acs || []).slice().sort().forEach((ac) => {
      const covered = (this.trace.findings.major || []).some((f) => f.kind === 'ac-khong-co-tc' && f.id === ac);
      list.appendChild(this._el('li', covered ? `${ac} — chưa có test case` : `${ac} — đã có test case`));
    });
    body.appendChild(list);

    body.appendChild(this._el('p', 'File nguồn:', 'qa-detail-label'));
    const files = this._el('ul', null, 'qa-detail-list qa-mono');
    (req.files || []).forEach((f) => files.appendChild(this._el('li', f)));
    body.appendChild(files);
    box.hidden = false;
  }

  // --- panel 2: ứng viên automation ---

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
        this._cell(c.id, 'qa-mono'),
        this._cell(c.req || '—', 'qa-mono'),
        this._cell((c.acs || []).join(', ') || '—', 'qa-mono'),
        prio,
        this._cell(AUTOMATION_LABEL[c.automation] || 'Chưa khai', 'qa-dim'),
        this._cell(c.file || '—', 'qa-mono qa-dim'),
      ]));
    });
    wrap.hidden = false;
  }

  // --- panel 3: findings ---

  renderFindings() {
    const root = this._root();
    if (!root || !this.trace) return;
    const box = root.querySelector('#qa-findings-groups');
    if (!box) return;
    box.textContent = '';

    const groups = this.trace.findings || {};
    const total = ['major', 'minor', 'info'].reduce((n, k) => n + ((groups[k] || []).length), 0);
    if (!total) {
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
