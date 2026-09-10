(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let form = byId('agent-form'), model = byId('agent-model'), prompt = byId('agent-prompt'), start = byId('agent-start'), stop = byId('agent-stop'), history = byId('agent-history'), events = byId('agent-events');
  let available = false, activeId = null, selectedId = null, working = false;
  let refreshPending = false, timer, generation = 0, lastRender = '', pollFailures = 0;
  const labels = { running: 'Đang làm việc', completed: 'Đã kết thúc', failed: 'Chưa hoàn tất', stopped: 'Đã dừng' };

  function getClientAiConfig() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      const raw = localStorage.getItem('qa_studio_ai_personal_config');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.enabled && parsed.apiKey) return parsed;
    } catch {}
    return null;
  }

  async function api(url, body) {
    const clientCfg = getClientAiConfig();
    const headers = { 'Content-Type': 'application/json', 'X-Dashboard-Agent': '1' };
    if (clientCfg) { try { headers['X-AI-Config'] = btoa(unescape(encodeURIComponent(JSON.stringify(clientCfg)))); } catch {} }
    const reqBody = body === undefined ? undefined : { ...body, ...(clientCfg ? { clientConfig: clientCfg } : {}) };
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15000), ...(reqBody === undefined ? (clientCfg ? { headers: { 'X-AI-Config': headers['X-AI-Config'] } } : {}) : { method: 'POST', headers, body: JSON.stringify(reqBody) }) });
    } catch { throw new Error('Mất kết nối Dashboard. Kiểm tra máy chủ rồi thử lại.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('Dashboard chưa trả về kết quả hợp lệ. Hãy tải lại trang.'); }
    if (!response.ok) throw new Error(data.error || 'Không thực hiện được yêu cầu.');
    return data;
  }
  function feedback(message = '') { const el = byId('agent-feedback'); if (el) { el.textContent = message; el.hidden = !message; } }
  function controls() {
    if (!start || !stop || !model || !prompt || !history) return;
    start.disabled = !available || Boolean(activeId) || working || refreshPending;
    stop.disabled = !activeId || working;
    model.disabled = prompt.readOnly = history.disabled = Boolean(activeId) || working;
    if (!available) model.disabled = true;
  }
  function getUnsavedCodeReason() {
    if ([...document.querySelectorAll('textarea')].some(input => !input.readOnly && input.__sharedEditor?.isDirty())) {
      const pmDirty = window.pageManagerCodeEditor?.isDirty?.();
      return pmDirty ? 'Mã nguồn tại "Quản lý Page Object" đang có thay đổi chưa lưu. Hãy bấm "Lưu thay đổi" (Ctrl+S) hoặc F5 trước khi giao việc cho Agent.' : 'Có mã nguồn đang được chỉnh sửa chưa lưu. Hãy bấm "Lưu thay đổi" (Ctrl+S) hoặc F5 trước khi giao việc cho Agent.';
    }
    if (typeof currentCodeFile !== 'undefined' && currentCodeFile && byId('code-editor')?.value !== originalCodeContent) {
      return `Tệp "${currentCodeFile}" tại Kịch bản BDD chưa được lưu. Hãy bấm "Lưu" (Ctrl+S) hoặc F5 trước khi giao việc cho Agent.`;
    }
    if (typeof pageDirectEditMode !== 'undefined' && pageDirectEditMode) {
      const isDirty = window.pageManagerCodeEditor?.isDirty?.() || false;
      const val = document.getElementById('page-manager-code-editor')?.value;
      if (isDirty || (typeof currentInspectedCode !== 'undefined' && val && val !== currentInspectedCode)) {
        return 'Mã nguồn tại "Quản lý Page Object" đang chỉnh sửa chưa lưu. Hãy bấm "Lưu thay đổi" (Ctrl+S) hoặc F5 trước khi giao việc cho Agent.';
      }
      if (typeof toggleDirectCodeEdit === 'function') toggleDirectCodeEdit(false); else pageDirectEditMode = false;
    }
    if (byId('resource-editor') && !byId('resource-editor').hidden) return 'Trình sửa tài nguyên (Resource Editor) đang mở. Hãy lưu hoặc đóng lại trước khi giao việc cho Agent.';
    return null;
  }
  function hasUnsavedCode() { return Boolean(getUnsavedCodeReason()); }
  async function loadHistory() {
    const data = await api('/api/agent/sessions');
    history.replaceChildren();
    if (!data.sessions.length) history.add(new Option('Chưa có phiên nào', ''));
    for (const session of data.sessions) history.add(new Option(`${labels[session.status] || 'Phiên'} · ${session.prompt.slice(0, 65)}`, session.id));
    if (selectedId) history.value = selectedId;
    return data.sessions;
  }
  function formatTokens(num) { return (Number(num) || 0).toLocaleString('vi-VN'); }

  function updateTokenQuota(quota, session = null) {
    const percent = Math.max(0, Math.min(100, typeof quota?.remainingPercent === 'number' ? quota.remainingPercent : 100));
    const percentText = `${percent}%`;
    const pillPercent = byId('agent-quota-pill-percent'), quotaPercent = byId('agent-quota-percent');
    if (pillPercent) pillPercent.textContent = percentText;
    if (quotaPercent) quotaPercent.textContent = percentText;
    const isHealthy = percent >= 50, isWarning = percent >= 20 && percent < 50, isDanger = percent < 20;
    for (const el of [byId('agent-quota-pill'), byId('agent-quota-badge'), byId('agent-quota-bar-fill')]) {
      el?.classList?.toggle?.('is-healthy', isHealthy);
      el?.classList?.toggle?.('is-warning', isWarning);
      el?.classList?.toggle?.('is-danger', isDanger);
    }
    const barFill = byId('agent-quota-bar-fill');
    if (barFill?.style) barFill.style.width = `${percent}%`;
    byId('agent-quota-progressbar')?.setAttribute?.('aria-valuenow', String(percent));
    if (byId('agent-quota-model')) byId('agent-quota-model').textContent = quota?.modelName || model?.value || 'gemini-2.5-flash';
    if (byId('agent-quota-used')) byId('agent-quota-used').textContent = formatTokens(quota?.usedTokens || 0);
    if (byId('agent-quota-limit')) byId('agent-quota-limit').textContent = formatTokens(quota?.limitTokens || 1000000);
    if (byId('agent-quota-session-tokens')) byId('agent-quota-session-tokens').textContent = formatTokens(session?.tokenUsage?.totalTokens ?? quota?.sessionTokens?.totalTokens ?? 0);
    if (byId('agent-quota-alltime-tokens')) byId('agent-quota-alltime-tokens').textContent = formatTokens(quota?.totalAllTimeTokens || 0);
    const summaryTokens = byId('agent-summary-tokens');
    if (summaryTokens) {
      const hasTokens = session?.tokenUsage && session.tokenUsage.totalTokens > 0;
      summaryTokens.textContent = hasTokens ? `${formatTokens(session.tokenUsage.totalTokens)} tokens (Prompt: ${formatTokens(session.tokenUsage.promptTokens)} · Output: ${formatTokens(session.tokenUsage.completionTokens)})` : '';
      summaryTokens.hidden = !hasTokens;
    }
  }

  function render(session) {
    selectedId = session.id;
    activeId = session.status === 'running' ? session.id : null;
    byId('agent-state').textContent = labels[session.status] || 'Sẵn sàng';
    byId('agent-state').classList.toggle('modified', session.status === 'running');
    byId('agent-session-task').textContent = session.prompt;
    byId('agent-event-count').textContent = `${session.events.length} hoạt động`;
    updateTokenQuota(session.tokenQuota, session);
    feedback(session.error || '');
    const renderKey = JSON.stringify(session.events);
    if (lastRender !== renderKey) {
      const expanded = new Set([...events.querySelectorAll('details[open]')].map(node => node.dataset.eventId));
      const nearEnd = events.scrollHeight - events.clientHeight - events.scrollTop < 60, priorScroll = events.scrollTop;
      events.replaceChildren();
      for (const event of session.events) {
        const row = document.createElement(event.type === 'command' ? 'details' : 'article');
        row.className = `agent-event agent-event-${['message', 'command', 'file_change', 'status', 'error'].includes(event.type) ? event.type : 'status'}`;
        row.dataset.eventId = event.id;
        if (event.type === 'command') {
          const title = document.createElement('summary');
          title.textContent = `${event.exitCode === null ? 'Lệnh' : `Mã thoát ${event.exitCode}`} · ${event.command || event.text}`;
          const output = document.createElement('pre');
          output.textContent = event.output || 'Chưa có đầu ra.';
          row.append(title, output);
          row.open = expanded.has(event.id);
        } else {
          row.textContent = event.text || '';
          if (event.files?.length) {
            const fileList = document.createElement('p');
            fileList.textContent = event.files.map(f => f.path).join('\n');
            row.append(fileList);
          }
        }
        events.append(row);
      }
      if (!session.events.length) events.textContent = 'Chưa có hoạt động.';
      events.scrollTop = nearEnd ? events.scrollHeight : priorScroll;
      lastRender = renderKey;
    }
    byId('agent-summary-section').hidden = session.status === 'running' || !session.summary;
    byId('agent-summary').textContent = session.summary || '';
    byId('agent-files-section').hidden = !session.changedFiles.length;
    byId('agent-files').replaceChildren(...session.changedFiles.map(file => {
      const item = document.createElement('li');
      item.textContent = `${({ add: 'Thêm', delete: 'Xóa', update: 'Sửa' })[file.kind] || 'Sửa'} · ${file.path}`;
      return item;
    }));
    controls();
  }
  async function poll(id, token) {
    try {
      const { session } = await api(`/api/agent/sessions/${id}`);
      if (token !== generation) return;
      render(session); pollFailures = 0;
      if (session.status === 'running') timer = setTimeout(() => poll(id, token), 1500);
      else await loadHistory();
    } catch (error) {
      if (token !== generation) return;
      feedback(error.message);
      if (++pollFailures < 5) timer = setTimeout(() => poll(id, token), 3000);
      else feedback(`${error.message} Bấm “Kiểm tra lại” để nối lại tiến trình.`);
    }
  }
  function watch(session) {
    clearTimeout(timer); generation += 1; pollFailures = 0; lastRender = '';
    render(session);
    if (session.status === 'running') timer = setTimeout(() => poll(session.id, generation), 1000);
  }
  async function refresh() {
    if (refreshPending) return;
    refreshPending = true; controls();
    const refreshBtn = byId('agent-refresh');
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const state = await api('/api/agent/status?refresh=1');
      available = state.available;
      if (model) {
        const previous = model.value;
        model.replaceChildren();
        if (!state.models.length) model.add(new Option('Chưa có model Gemini', ''));
        for (const item of state.models) model.add(new Option(item.name, item.name));
        model.value = state.models.some(item => item.name === previous) ? previous : state.selectedModel;
      }
      const conn = byId('agent-connection');
      if (conn) conn.textContent = state.message;
      updateTokenQuota(state.tokenQuota, null);
      if (byId('agent-eyebrow')) byId('agent-eyebrow').textContent = state.provider ? state.provider.toUpperCase() : 'AI AGENT';
      const sessions = await loadHistory();
      activeId = state.activeSessionId;
      const id = activeId || (selectedId && sessions.some(s => s.id === selectedId) ? selectedId : sessions[0]?.id);
      if (id) watch((await api(`/api/agent/sessions/${id}`)).session);
      else feedback();
    } catch {
      available = false;
      const message = 'Mất kết nối Dashboard. Kiểm tra máy chủ rồi thử lại.';
      const conn = byId('agent-connection');
      if (conn) conn.textContent = message;
      feedback(message);
    } finally {
      refreshPending = false;
      const rBtn = byId('agent-refresh');
      if (rBtn) rBtn.disabled = false;
      controls();
    }
  }
  function bind() {
    form = byId('agent-form');
    if (!form || form._b) return;
    form._b = true;
    model = byId('agent-model'); prompt = byId('agent-prompt'); start = byId('agent-start');
    stop = byId('agent-stop'); history = byId('agent-history'); events = byId('agent-events');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (working || activeId || refreshPending || !available) return;
      if (!prompt.value.trim()) { feedback('Hãy nhập yêu cầu cho Agent.'); prompt.focus(); return; }
      if (prompt.value.length > prompt.maxLength) { feedback(`Yêu cầu tối đa ${prompt.maxLength} ký tự.`); prompt.focus(); return; }
      const unsavedReason = getUnsavedCodeReason();
      if (unsavedReason) { feedback(unsavedReason); return; }
      working = true; controls(); feedback();
      try {
        const { session } = await api('/api/agent/sessions', { prompt: prompt.value, model: model.value });
        watch(session); await loadHistory();
      } catch (error) { feedback(error.message); }
      finally { working = false; controls(); }
    });
    stop?.addEventListener('click', async () => {
      if (!activeId || working) return;
      working = true; controls();
      try { watch((await api(`/api/agent/sessions/${activeId}/stop`, {})).session); }
      catch (error) { feedback(error.message); }
      finally { working = false; controls(); }
    });
    history?.addEventListener('change', async () => {
      if (!history.value || activeId) return;
      working = true; controls();
      try { watch((await api(`/api/agent/sessions/${history.value}`)).session); }
      catch (error) { feedback(error.message); }
      finally { working = false; controls(); }
    });
    prompt?.addEventListener('input', () => feedback(''));
    prompt?.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!start?.disabled) form?.requestSubmit(); }
    });
  }
  byId('agent-refresh')?.addEventListener('click', refresh);
  byId('agent-tab')?.addEventListener('click', refresh);
  window.addEventListener('beforeunload', () => { clearTimeout(timer); generation += 1; });
  bind();
  if (byId('agent-view') && !byId('agent-view').hidden) refresh();
})();
