const $ = (selector) => document.querySelector(selector);
const form = $('#run-form');
const consoleOutput = $('#console');
let currentRun = null;
let timer = null;
let resourceCatalog = { documents: [], data: [], evidence: [], evidenceDetails: [], reports: [], reportDetails: [] };
let currentResource = null;
let activeResourceCategory = 'evidence';
let currentResourceCategory = '';
let evidenceNavigation = [];
const openEvidenceFolders = new Set();
const openReportFolders = new Set();
let codeFiles = [];
let activeCodeRoot = 'all';
let currentCodeFile = null;
let originalCodeContent = '';

function preferredTheme() {
  const savedTheme = localStorage.getItem('playwright-dashboard-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  $('#theme-button').setAttribute('aria-pressed', String(isLight));
  $('.theme-icon').textContent = isLight ? '☾' : '☀';
  $('#theme-label').textContent = isLight ? 'Dark' : 'Light';
}

applyTheme(preferredTheme());

function fillSelect(selector, values, allLabel) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(value)}</option>`
  ).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function appendLog(payload) {
  if (consoleOutput.querySelector('.muted')) consoleOutput.textContent = '';
  const line = document.createElement('span');
  line.className = payload.stream === 'stderr' ? 'stderr' : '';
  line.textContent = payload.text;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—';
}

function renderRun(run) {
  currentRun = run;
  const status = run?.status || 'idle';
  const labels = { idle: 'Sẵn sàng', running: 'Đang chạy', passed: 'Đã pass', failed: 'Đã fail', stopped: 'Đã dừng' };
  $('#status-card').className = `status-card ${status}`;
  $('#status-label').textContent = labels[status];
  $('#status-detail').textContent = run
    ? `${run.mode === 'ui' ? 'UI MODE' : run.options.environment.toUpperCase()} · ${run.options.project === 'all' ? 'Tất cả projects' : run.options.project}`
    : 'Chưa có test run trong phiên này.';
  $('#started-at').textContent = formatDate(run?.startedAt);
  $('#exit-code').textContent = run?.exitCode ?? '—';
  $('#command').textContent = run?.command || 'npx playwright test';
  const running = status === 'running';
  $('#run-button').disabled = running;
  $('#stop-button').disabled = !running;
  $('#ui-button').disabled = running;
  form.querySelectorAll('input, select').forEach((control) => { control.disabled = running; });
  clearInterval(timer);
  const updateDuration = () => {
    if (!run?.startedAt) return $('#duration').textContent = '—';
    const end = run.finishedAt ? new Date(run.finishedAt) : new Date();
    const seconds = Math.max(0, Math.floor((end - new Date(run.startedAt)) / 1000));
    $('#duration').textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  updateDuration();
  if (running) timer = setInterval(updateDuration, 1000);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Có lỗi xảy ra.');
  return body;
}

function renderResourceList(filter = '') {
  const query = filter.trim().toLowerCase();
  const groups = [
    ['Reports', 'reports', resourceCatalog.reports],
    ['Evidence', 'evidence', resourceCatalog.evidence],
    ['Tài liệu', 'documents', resourceCatalog.documents],
    ['Test data', 'data', resourceCatalog.data],
  ];
  $('#resource-list').innerHTML = groups.map(([label, category, files]) => {
    if (activeResourceCategory !== 'all' && activeResourceCategory !== category) return '';
    const matches = files.filter((file) => file.toLowerCase().includes(query));
    if (!matches.length) return '';
    if (category === 'reports') {
      return `<section class="resource-group report-group"><h3>${label}<span>${matches.length}</span></h3>${renderReportTree(matches)}</section>`;
    }
    if (category === 'evidence') {
      evidenceNavigation = matches;
      return `<section class="resource-group evidence-group"><h3>${label}<span>${matches.length}</span></h3>${renderEvidenceTree(matches)}</section>`;
    }
    return `<section class="resource-group"><h3>${label}<span>${matches.length}</span></h3>${matches.map((file) =>
      `<button class="resource-item${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="${category}"><span>${category === 'reports' ? 'R' : file.endsWith('.json') ? '{}' : /\.(png|jpe?g|webp)$/i.test(file) ? '▧' : 'M↓'}</span><div><strong>${escapeHtml(category === 'reports' ? file.split('/').slice(-2,-1)[0] || 'Report' : file.split('/').pop())}</strong><small>${escapeHtml(file)}</small></div></button>`
    ).join('')}</section>`;
  }).join('') || '<p class="empty-resource">Không tìm thấy file.</p>';
  document.querySelectorAll('.resource-item').forEach((button) => button.addEventListener('click', () => loadResource(button.dataset.path, false, button.dataset.category)));
  document.querySelectorAll('.evidence-folder').forEach((folder) => folder.addEventListener('toggle', () => {
    if (folder.classList.contains('report-folder')) return;
    if (folder.open) openEvidenceFolders.add(folder.dataset.folder); else openEvidenceFolders.delete(folder.dataset.folder);
  }));
  document.querySelectorAll('.report-folder').forEach((folder) => folder.addEventListener('toggle', () => {
    if (folder.open) openReportFolders.add(folder.dataset.reportFolder); else openReportFolders.delete(folder.dataset.reportFolder);
  }));
  document.querySelectorAll('.delete-folder-button').forEach((button) => button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await deleteEvidenceFolder(button.dataset.folder);
  }));
}

function renderReportTree(files) {
  const root = {};
  files.forEach((file) => {
    let branch = root;
    file.split('/').forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__reports = branch.__reports || [];
        branch.__reports.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });
  const countReports = (branch) => (branch.__reports?.length || 0) + Object.entries(branch)
    .filter(([key]) => key !== '__reports')
    .reduce((total, [, child]) => total + countReports(child), 0);
  const reportItems = (items) => items.map((file) => {
    const detail = resourceCatalog.reportDetails.find((item) => item.path === file);
    const createdAt = detail?.modifiedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(detail.modifiedAt)) : 'Không rõ thời gian';
    return `<button class="resource-item report-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="reports"><span>R</span><div><strong>Playwright Report</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
  }).join('');
  const branchHtml = (branch, parentPath = '') => Object.entries(branch)
    .filter(([key]) => key !== '__reports')
    .map(([folder, child]) => {
      const folderPath = parentPath ? `${parentPath}/${folder}` : folder;
      const open = openReportFolders.has(folderPath) ? ' open' : '';
      return `<details class="evidence-folder report-folder" data-report-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${countReports(child)}</small></summary><div>${branchHtml(child, folderPath)}${reportItems(child.__reports || [])}</div></details>`;
    }).join('');
  return branchHtml(root) + reportItems(root.__reports || []);
}

function renderEvidenceTree(files) {
  const root = {};
  files.forEach((file) => {
    let branch = root;
    file.split('/').forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__files = branch.__files || [];
        branch.__files.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });

  const renderBranch = (branch, depth = 0, parentPath = '') => Object.entries(branch)
    .filter(([key]) => key !== '__files')
    .map(([folder, child]) => {
      const childFiles = countTreeFiles(child);
      const folderPath = parentPath ? `${parentPath}/${folder}` : folder;
      const open = openEvidenceFolders.has(folderPath) ? ' open' : '';
      return `<details class="evidence-folder" data-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${childFiles}</small><button class="delete-folder-button" type="button" data-folder="${escapeHtml(folderPath)}" title="Xóa folder">×</button></summary><div>${renderBranch(child, depth + 1, folderPath)}${renderFiles(child.__files || [])}</div></details>`;
    }).join('');

  const renderFiles = (items) => items.map((file) => {
    const detail = resourceCatalog.evidenceDetails.find((item) => item.path === file);
    const createdAt = detail?.modifiedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(detail.modifiedAt)) : 'Không rõ thời gian';
    return `<button class="resource-item evidence-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="evidence"><span>▧</span><div><strong>${escapeHtml(file.split('/').pop())}</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
  }).join('');

  return renderBranch(root) + renderFiles(root.__files || []);
}

function countTreeFiles(branch) {
  return (branch.__files?.length || 0) + Object.entries(branch)
    .filter(([key]) => key !== '__files')
    .reduce((total, [, child]) => total + countTreeFiles(child), 0);
}

function hideResourcePreviews() {
  $('#resource-empty').hidden = true;
  $('#resource-content').hidden = true;
  $('#evidence-preview').hidden = true;
  $('#report-preview').hidden = true;
  $('#resource-editor').hidden = true;
  $('#evidence-image').removeAttribute('src');
  $('#report-frame').removeAttribute('src');
}

async function loadResource(resourcePath, reveal = false, category = '') {
  hideResourcePreviews();
  currentResourceCategory = category || currentResourceCategory;
  $('#edit-button').hidden = true;
  $('#delete-button').hidden = !['reports', 'evidence'].includes(currentResourceCategory);
  if (category === 'reports') {
    currentResource = resourcePath;
    const reportUrl = `/reports/${resourcePath.split('/').map(encodeURIComponent).join('/')}`;
    $('#resource-name').textContent = resourcePath;
    $('#resource-type').textContent = 'PLAYWRIGHT REPORT';
    $('#report-preview').hidden = false;
    $('#report-frame').src = reportUrl;
    $('#report-open').href = reportUrl;
    $('#reveal-button').hidden = true;
    $('#delete-button').hidden = false;
    updateActiveResource();
    return;
  }
  if (/\.(png|jpe?g|webp)$/i.test(resourcePath)) {
    currentResource = resourcePath;
    const imageUrl = `/evidence/${resourcePath.split('/').map(encodeURIComponent).join('/')}`;
    $('#resource-name').textContent = resourcePath;
    $('#resource-type').textContent = 'TEST EVIDENCE';
    $('#evidence-preview').hidden = false;
    $('#evidence-image').src = imageUrl;
    $('#evidence-open').href = imageUrl;
    updateEvidencePosition();
    $('#reveal-button').hidden = true;
    $('#delete-button').hidden = false;
    updateActiveResource();
    return;
  }
  try {
    const resource = await request(`/api/resource?path=${encodeURIComponent(resourcePath)}&reveal=${reveal}`);
    currentResource = resourcePath;
    $('#resource-name').textContent = resource.path;
    $('#resource-type').textContent = resource.type === 'json' ? 'JSON DATA' : 'MARKDOWN';
    $('#resource-content').textContent = resource.content;
    $('#resource-content').hidden = false;
    $('#evidence-preview').hidden = true;
    $('#resource-content').className = resource.type;
    $('#reveal-button').hidden = resource.type !== 'json';
    $('#edit-button').hidden = !resource.editable;
    $('#delete-button').hidden = true;
    $('#reveal-button').textContent = resource.masked ? 'Hiện dữ liệu gốc' : 'Che dữ liệu nhạy cảm';
    $('#reveal-button').dataset.revealed = String(!resource.masked);
    renderResourceList($('#resource-search').value);
  } catch (error) { notify(error.message); }
}

function updateActiveResource() {
  document.querySelectorAll('.resource-item').forEach((item) => item.classList.toggle('active', item.dataset.path === currentResource));
}

function updateEvidencePosition() {
  const sequence = currentEvidenceSequence();
  const index = sequence.indexOf(currentResource);
  $('#evidence-position').textContent = index >= 0 ? `${index + 1} / ${sequence.length}` : '—';
  $('#previous-evidence').disabled = index <= 0;
  $('#next-evidence').disabled = index < 0 || index >= sequence.length - 1;
}

function navigateEvidence(direction) {
  const sequence = currentEvidenceSequence();
  const index = sequence.indexOf(currentResource);
  const target = sequence[index + direction];
  if (target) loadResource(target, false, 'evidence');
}

function currentEvidenceSequence() {
  const parentFolder = currentResource?.includes('/') ? currentResource.slice(0, currentResource.lastIndexOf('/')) : '';
  return evidenceNavigation.filter((item) => item.slice(0, item.lastIndexOf('/')) === parentFolder);
}

async function deleteEvidenceFolder(folderPath) {
  const imageCount = resourceCatalog.evidence.filter((item) => item.startsWith(`${folderPath}/`)).length;
  if (!window.confirm(`Xóa folder evidence này và ${imageCount} ảnh bên trong?\n\n${folderPath}`)) return;
  try {
    const result = await request('/api/artifact', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'evidence-folder', path: folderPath }),
    });
    notify(result.message);
    if (currentResource?.startsWith(`${folderPath}/`)) {
      currentResource = null;
      currentResourceCategory = '';
      hideResourcePreviews();
      $('#resource-empty').hidden = false;
    }
    openEvidenceFolders.clear();
    await openExplorer();
  } catch (error) { notify(error.message); }
}

async function editCurrentResource() {
  if (!currentResource) return;
  try {
    const resource = await request(`/api/resource?path=${encodeURIComponent(currentResource)}&reveal=true`);
    $('#resource-edit-content').value = resource.content;
    $('#resource-content').hidden = true;
    $('#resource-editor').hidden = false;
    $('#edit-button').hidden = true;
    $('#reveal-button').hidden = true;
  } catch (error) { notify(error.message); }
}

async function saveCurrentResource() {
  const saveButton = $('#save-resource-button');
  saveButton.disabled = true;
  try {
    const result = await request('/api/resource', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentResource, content: $('#resource-edit-content').value }),
    });
    notify(`${result.message} Backup: ${result.backup}`);
    await loadResource(currentResource, false, currentResourceCategory);
  } catch (error) { notify(error.message); }
  finally { saveButton.disabled = false; }
}

async function deleteCurrentArtifact() {
  if (!currentResource || !['reports', 'evidence'].includes(currentResourceCategory)) return;
  const label = currentResourceCategory === 'reports' ? 'toàn bộ folder report, gồm HTML, data, trace/video đóng gói bên trong' : 'evidence';
  if (!window.confirm(`Bạn chắc chắn muốn xóa ${label}?\n\n${currentResource}`)) return;
  try {
    const result = await request('/api/artifact', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentResourceCategory === 'reports' ? 'report' : 'evidence', path: currentResource }),
    });
    notify(result.message);
    currentResource = null;
    currentResourceCategory = '';
    hideResourcePreviews();
    $('#resource-empty').hidden = false;
    $('#resource-name').textContent = 'Chọn một mục để xem chi tiết';
    $('#resource-type').textContent = 'RESOURCE';
    $('#delete-button').hidden = true;
    await openExplorer();
  } catch (error) { notify(error.message); }
}

async function openExplorer() {
  try {
    resourceCatalog = await request('/api/resources');
    $('#resource-summary').innerHTML = `<span><strong>${resourceCatalog.reports.length}</strong> reports</span><span><strong>${resourceCatalog.evidence.length}</strong> evidence</span><span><strong>${resourceCatalog.documents.length + resourceCatalog.data.length}</strong> files</span>`;
    renderResourceList();
  } catch (error) { notify(error.message); }
}

async function openCodeWorkspace() {
  try {
    const result = await request('/api/code-files');
    codeFiles = result.files;
    $('#code-file-count').textContent = `${codeFiles.length} files`;
    renderCodeTree();
  } catch (error) { notify(error.message); }
}

function renderCodeTree() {
  const query = $('#code-search').value.trim().toLowerCase();
  const matches = codeFiles.filter((file) => (activeCodeRoot === 'all' || file.startsWith(`${activeCodeRoot}/`)) && file.toLowerCase().includes(query));
  const grouped = { tests: [], pages: [], core: [] };
  matches.forEach((file) => grouped[file.split('/')[0]]?.push(file));
  $('#code-tree').innerHTML = Object.entries(grouped).map(([root, files]) => {
    if (!files.length) return '';
    return `<details class="code-folder" open><summary><span>▾</span><strong>${root}</strong><small>${files.length}</small></summary><div>${renderCodeBranch(files, root)}</div></details>`;
  }).join('') || '<p class="empty-resource">Không tìm thấy source file.</p>';
  document.querySelectorAll('.code-file').forEach((button) => button.addEventListener('click', () => loadCodeFile(button.dataset.path)));
}

function renderCodeBranch(files, root) {
  const tree = {};
  files.forEach((file) => {
    let branch = tree;
    file.split('/').slice(1).forEach((segment, index, parts) => {
      if (index === parts.length - 1) {
        branch.__files = branch.__files || [];
        branch.__files.push(file);
      } else {
        branch[segment] = branch[segment] || {};
        branch = branch[segment];
      }
    });
  });
  const branchHtml = (branch) => Object.entries(branch).filter(([key]) => key !== '__files').map(([folder, child]) =>
    `<details class="code-folder nested" open><summary><span>▾</span><strong>${escapeHtml(folder)}</strong><small>${countTreeFiles(child)}</small></summary><div>${branchHtml(child)}${fileHtml(child.__files || [])}</div></details>`
  ).join('');
  const fileHtml = (items) => items.map((file) => `<button class="code-file${file === currentCodeFile ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}"><span>JS</span><strong>${escapeHtml(file.split('/').pop())}</strong></button>`).join('');
  return branchHtml(tree) + fileHtml(tree.__files || []);
}

async function loadCodeFile(filePath) {
  try {
    const source = await request(`/api/code?path=${encodeURIComponent(filePath)}`);
    currentCodeFile = filePath;
    originalCodeContent = source.content;
    $('#code-file-name').textContent = filePath;
    $('#code-language').textContent = filePath.endsWith('.json') ? 'JSON' : 'JAVASCRIPT';
    $('#code-editor').value = source.content;
    $('#code-preview code').innerHTML = highlightCode(source.content, filePath.endsWith('.json'));
    $('#code-editor-stage').hidden = false;
    $('#code-editor-stage').classList.remove('editing');
    $('#code-editor').hidden = true;
    $('#code-empty').hidden = true;
    $('#code-edit-button').hidden = false;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = `${source.content.split('\n').length} lines`;
    document.querySelectorAll('.code-file').forEach((item) => item.classList.toggle('active', item.dataset.path === filePath));
  } catch (error) { notify(error.message); }
}

function highlightCode(content, isJson = false) {
  const pattern = isJson
    ? /("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|class|extends|new|function|async|await|return|if|else|for|while|try|catch|throw|require|module|exports|this|super|import|from|export|default|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g;
  let html = '';
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    html += escapeHtml(content.slice(cursor, match.index));
    const token = match[0];
    let type = 'number';
    if (isJson) type = match[1] ? 'string' : match[2] ? 'keyword' : 'number';
    else type = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'keyword' : 'number';
    html += `<span class="syntax-${type}">${escapeHtml(token)}</span>`;
    cursor = match.index + token.length;
  }
  return html + escapeHtml(content.slice(cursor));
}

function enterCodeEditMode() {
  if (!currentCodeFile) return;
  $('#code-editor-stage').classList.add('editing');
  $('#code-editor').hidden = false;
  $('#code-editor').focus();
  $('#code-edit-button').hidden = true;
  $('#code-save-button').hidden = false;
  $('#code-save-button').disabled = true;
  $('#code-cancel-button').hidden = false;
  $('#code-status-text').textContent = 'Editing';
}

function leaveCodeEditMode() {
  $('#code-editor').value = originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile?.endsWith('.json'));
  $('#code-editor-stage').classList.remove('editing');
  $('#code-editor').hidden = true;
  $('#code-edit-button').hidden = false;
  $('#code-save-button').hidden = true;
  $('#code-cancel-button').hidden = true;
  $('#code-status-text').textContent = 'Ready';
}

async function saveCodeFile() {
  if (!currentCodeFile) return;
  const button = $('#code-save-button');
  button.disabled = true;
  try {
    const result = await request('/api/code', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentCodeFile, content: $('#code-editor').value }),
    });
    originalCodeContent = $('#code-editor').value;
    $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile.endsWith('.json'));
    $('#code-editor-stage').classList.remove('editing');
    $('#code-editor').hidden = true;
    $('#code-edit-button').hidden = false;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = 'Saved';
    notify(`${result.message} Backup: ${result.backup}`);
  } catch (error) {
    $('#code-status-text').textContent = 'Save failed';
    notify(error.message);
    button.disabled = false;
  }
}

async function initialize() {
  try {
    const [config, state] = await Promise.all([request('/api/config'), request('/api/state')]);
    fillSelect('#environment', config.environments, '');
    fillSelect('#project', config.projects, 'Tất cả projects');
    fillSelect('#spec', ['all', ...config.specs], 'Tất cả specs');
    state.logs.forEach((entry) => appendLog(entry.payload));
    renderRun(state.activeRun || state.lastRun);
  } catch (error) { notify(error.message); }

  const events = new EventSource('/api/events');
  events.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === 'log') appendLog(event.payload);
    if (event.type === 'status') renderRun(event.payload);
  };
  events.onerror = () => notify('Mất kết nối tới dashboard server.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    environment: $('#environment').value, project: $('#project').value,
    spec: $('#spec').value, grep: $('#grep').value, workers: Number($('#workers').value),
    headed: $('#headed').checked,
  };
  consoleOutput.textContent = '';
  $('#run-button').disabled = true;
  $('#run-button').textContent = 'Đang khởi động…';
  try {
    const run = await request('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderRun(run);
  } catch (error) {
    notify(error.message);
    $('#run-button').disabled = false;
  } finally {
    $('#run-button').textContent = '▶ Chạy test';
  }
});

function selectedOptions() {
  return {
    environment: $('#environment').value, project: $('#project').value,
    spec: $('#spec').value, grep: $('#grep').value, workers: Number($('#workers').value),
    headed: true,
  };
}

$('#ui-button').addEventListener('click', async () => {
  const button = $('#ui-button');
  button.disabled = true;
  button.innerHTML = '<span>◌</span> Đang mở UI…';
  try {
    const run = await request('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedOptions()) });
    renderRun(run);
    notify('Playwright UI đang được mở trong cửa sổ riêng.');
  } catch (error) {
    notify(error.message);
    button.disabled = false;
  } finally {
    button.innerHTML = '<span>◫</span> Open Playwright UI';
  }
});

$('#stop-button').addEventListener('click', async () => {
  try { await request('/api/stop', { method: 'POST' }); } catch (error) { notify(error.message); }
});
$('#clear-button').addEventListener('click', () => { consoleOutput.textContent = ''; });
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', async () => {
  document.querySelectorAll('.view-tab').forEach((tab) => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', String(tab === button)); });
  document.querySelectorAll('.dashboard-view').forEach((view) => { const active = view.id === button.dataset.view; view.hidden = !active; view.classList.toggle('active', active); });
  if (button.dataset.view === 'resources-view') await openExplorer();
  if (button.dataset.view === 'code-view') await openCodeWorkspace();
}));
document.querySelectorAll('.resource-filter').forEach((button) => button.addEventListener('click', () => {
  activeResourceCategory = button.dataset.category;
  document.querySelectorAll('.resource-filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderResourceList($('#resource-search').value);
}));
$('#resource-search').addEventListener('input', (event) => renderResourceList(event.target.value));
$('#reveal-button').addEventListener('click', () => loadResource(currentResource, $('#reveal-button').dataset.revealed !== 'true'));
$('#edit-button').addEventListener('click', editCurrentResource);
$('#save-resource-button').addEventListener('click', saveCurrentResource);
$('#cancel-edit-button').addEventListener('click', () => loadResource(currentResource, false, currentResourceCategory));
$('#delete-button').addEventListener('click', deleteCurrentArtifact);
$('#previous-evidence').addEventListener('click', () => navigateEvidence(-1));
$('#next-evidence').addEventListener('click', () => navigateEvidence(1));
$('#code-search').addEventListener('input', renderCodeTree);
document.querySelectorAll('.code-root-filter').forEach((button) => button.addEventListener('click', () => {
  activeCodeRoot = button.dataset.root;
  document.querySelectorAll('.code-root-filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderCodeTree();
}));
$('#code-editor').addEventListener('input', () => {
  const changed = $('#code-editor').value !== originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, currentCodeFile?.endsWith('.json')) + '\n';
  $('#code-save-button').disabled = !changed;
  $('#code-cancel-button').hidden = !changed;
  $('#code-status-text').textContent = changed ? 'Modified' : 'Ready';
});
$('#code-editor').addEventListener('scroll', () => {
  $('#code-preview').scrollTop = $('#code-editor').scrollTop;
  $('#code-preview').scrollLeft = $('#code-editor').scrollLeft;
});
$('#code-edit-button').addEventListener('click', enterCodeEditMode);
$('#code-cancel-button').addEventListener('click', leaveCodeEditMode);
$('#code-save-button').addEventListener('click', saveCodeFile);
$('#theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('playwright-dashboard-theme', theme);
  applyTheme(theme);
});

initialize();
