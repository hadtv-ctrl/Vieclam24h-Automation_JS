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
let settingsCache = null;
let currentResourceType = '';

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
  $('#theme-label').textContent = isLight ? 'Tối' : 'Sáng';
}

applyTheme(preferredTheme());

function fillSelect(selector, values, allLabel) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(value)}</option>`
  ).join('');
}

function fillSettingSelect(selector, values, selected) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`
  ).join('');
}

function setInputValue(selector, value) {
  $(selector).value = value ?? '';
}

function setChecked(selector, value) {
  $(selector).checked = value === true;
}

function readNumber(selector) {
  return Number($(selector).value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function formatJsonText(content) {
  return JSON.stringify(JSON.parse(content), null, 2);
}

function formatMarkdownText(content) {
  return String(content).replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/g, '')).join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}

function renderInlineMarkdown(content) {
  return escapeHtml(content)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(content) {
  const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeBuffer = [];
  let listType = '';
  let tableBuffer = [];

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = '';
  };
  const closeTable = () => {
    if (!tableBuffer.length) return;
    closeList();
    const rows = tableBuffer.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
    const header = rows.shift() || [];
    if (rows[0] && rows[0].every((cell) => /^:?-{3,}:?$/.test(cell))) rows.shift();
    html.push('<table><thead><tr>' + header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('') + '</tr></thead><tbody>');
    rows.forEach((row) => html.push('<tr>' + row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('') + '</tr>'));
    html.push('</tbody></table>');
    tableBuffer = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      closeTable();
      closeList();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line)) {
      tableBuffer.push(line);
      continue;
    }

    closeTable();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (/^\s*>\s+/.test(line)) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(line.replace(/^\s*>\s+/, ''))}</blockquote>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  closeTable();
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function renderResourceContent(resource) {
  const container = $('#resource-content');
  container.className = `resource-content ${resource.type}`;

  if (resource.type === 'json') {
    const formatted = formatJsonText(resource.content);
    container.innerHTML = `<pre><code>${highlightCode(formatted, true)}</code></pre>`;
    return;
  }

  if (resource.type === 'markdown') {
    container.innerHTML = renderMarkdown(resource.content);
    return;
  }

  container.textContent = resource.content;
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
    ? `${run.mode === 'ui' ? 'UI mode' : run.options.environment.toUpperCase()} · ${run.options.project === 'all' ? 'Tất cả nhóm test' : run.options.project}`
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
    ['Báo cáo', 'reports', resourceCatalog.reports],
    ['Evidence', 'evidence', resourceCatalog.evidence],
    ['Tài liệu', 'documents', resourceCatalog.documents],
    ['Dữ liệu test', 'data', resourceCatalog.data],
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
      `<button class="resource-item${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="${category}"><span>${category === 'reports' ? 'R' : file.endsWith('.json') ? '{}' : /\.(png|jpe?g|webp)$/i.test(file) ? '▧' : 'M↓'}</span><div><strong>${escapeHtml(category === 'reports' ? file.split('/').slice(-2,-1)[0] || 'Báo cáo' : file.split('/').pop())}</strong><small>${escapeHtml(file)}</small></div></button>`
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
    return `<button class="resource-item report-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="reports"><span>R</span><div><strong>Báo cáo Playwright</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
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
    $('#resource-type').textContent = 'BÁO CÁO PLAYWRIGHT';
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
    $('#resource-type').textContent = 'ẢNH EVIDENCE';
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
    currentResourceType = resource.type;
    $('#resource-name').textContent = resource.path;
    $('#resource-type').textContent = resource.type === 'json' ? 'DỮ LIỆU JSON' : 'MARKDOWN';
    renderResourceContent(resource);
    $('#resource-content').hidden = false;
    $('#evidence-preview').hidden = true;
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
    currentResourceType = resource.type;
    $('#resource-edit-content').value = resource.type === 'json' ? formatJsonText(resource.content) : resource.type === 'markdown' ? formatMarkdownText(resource.content) : resource.content;
    $('#resource-content').hidden = true;
    $('#resource-editor').hidden = false;
    $('#edit-button').hidden = true;
    $('#reveal-button').hidden = true;
  } catch (error) { notify(error.message); }
}

function formatCurrentResourceEditor() {
  const editor = $('#resource-edit-content');
  try {
    if (currentResourceType === 'json' || currentResource?.endsWith('.json')) {
      editor.value = formatJsonText(editor.value);
      notify('Đã định dạng JSON.');
      return;
    }
    if (currentResourceType === 'markdown' || currentResource?.endsWith('.md')) {
      editor.value = formatMarkdownText(editor.value);
      notify('Đã định dạng Markdown.');
      return;
    }
    notify('File này không có định dạng tự động.');
  } catch (error) {
    notify(`Không thể định dạng: ${error.message}`);
  }
}

async function saveCurrentResource() {
  const saveButton = $('#save-resource-button');
  saveButton.disabled = true;
  try {
    const content = currentResourceType === 'json' || currentResource?.endsWith('.json')
      ? formatJsonText($('#resource-edit-content').value)
      : $('#resource-edit-content').value;
    const result = await request('/api/resource', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentResource, content }),
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
    $('#resource-summary').innerHTML = `<span><strong>${resourceCatalog.reports.length}</strong> báo cáo</span><span><strong>${resourceCatalog.evidence.length}</strong> evidence</span><span><strong>${resourceCatalog.documents.length + resourceCatalog.data.length}</strong> tệp</span>`;
    renderResourceList();
  } catch (error) { notify(error.message); }
}

async function openCodeWorkspace() {
  try {
    const result = await request('/api/code-files');
    codeFiles = result.files;
    $('#code-file-count').textContent = `${codeFiles.length} tệp`;
    renderCodeTree();
  } catch (error) { notify(error.message); }
}

function renderCodeTree() {
  const query = $('#code-search').value.trim().toLowerCase();
  const matches = codeFiles.filter((file) => (activeCodeRoot === 'all' || file.startsWith(`${activeCodeRoot}/`)) && file.toLowerCase().includes(query));
  const grouped = { tests: [], pages: [], core: [] };
  const rootLabels = { tests: 'Test', pages: 'Page Object', core: 'Core' };
  matches.forEach((file) => grouped[file.split('/')[0]]?.push(file));
  $('#code-tree').innerHTML = Object.entries(grouped).map(([root, files]) => {
    if (!files.length) return '';
    return `<details class="code-folder" open><summary><span>▾</span><strong>${rootLabels[root] || root}</strong><small>${files.length}</small></summary><div>${renderCodeBranch(files, root)}</div></details>`;
  }).join('') || '<p class="empty-resource">Không tìm thấy file mã nguồn.</p>';
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
    $('#code-format-button').hidden = true;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = `${source.content.split('\n').length} dòng`;
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
  $('#code-format-button').hidden = !currentCodeFile.endsWith('.json');
  $('#code-save-button').hidden = false;
  $('#code-save-button').disabled = true;
  $('#code-cancel-button').hidden = false;
  $('#code-status-text').textContent = 'Đang chỉnh sửa';
}

function leaveCodeEditMode() {
  $('#code-editor').value = originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile?.endsWith('.json'));
  $('#code-editor-stage').classList.remove('editing');
  $('#code-editor').hidden = true;
  $('#code-edit-button').hidden = false;
  $('#code-format-button').hidden = true;
  $('#code-save-button').hidden = true;
  $('#code-cancel-button').hidden = true;
  $('#code-status-text').textContent = 'Sẵn sàng';
}

function formatCurrentCodeEditor() {
  if (!currentCodeFile?.endsWith('.json')) {
    notify('Chỉ hỗ trợ định dạng tự động cho JSON.');
    return;
  }
  try {
    $('#code-editor').value = formatJsonText($('#code-editor').value);
    $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, true) + '\n';
    $('#code-save-button').disabled = $('#code-editor').value === originalCodeContent;
    $('#code-cancel-button').hidden = $('#code-editor').value === originalCodeContent;
    $('#code-status-text').textContent = 'Đã định dạng';
  } catch (error) {
    notify(`Không thể định dạng JSON: ${error.message}`);
  }
}

async function saveCodeFile() {
  if (!currentCodeFile) return;
  const button = $('#code-save-button');
  button.disabled = true;
  try {
    const content = currentCodeFile.endsWith('.json') ? formatJsonText($('#code-editor').value) : $('#code-editor').value;
    const result = await request('/api/code', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentCodeFile, content }),
    });
    originalCodeContent = content;
    $('#code-editor').value = content;
    $('#code-preview code').innerHTML = highlightCode(originalCodeContent, currentCodeFile.endsWith('.json'));
    $('#code-editor-stage').classList.remove('editing');
    $('#code-editor').hidden = true;
    $('#code-edit-button').hidden = false;
    $('#code-format-button').hidden = true;
    $('#code-save-button').hidden = true;
    $('#code-cancel-button').hidden = true;
    $('#code-status-text').textContent = 'Đã lưu';
    notify(`${result.message} Backup: ${result.backup}`);
  } catch (error) {
    $('#code-status-text').textContent = 'Lưu thất bại';
    notify(error.message);
    button.disabled = false;
  }
}

function renderSettings(settings) {
  settingsCache = settings;
  const environmentEntries = Object.entries(settings.environments || {});
  $('#environment-settings').innerHTML = environmentEntries.map(([key, env]) => `
    <div class="environment-row" data-env="${escapeHtml(key)}">
      <div class="environment-key"><strong>${escapeHtml(key)}</strong><small>${escapeHtml(env.label || key.toUpperCase())}</small></div>
      <div class="environment-fields">
        <label>Tên hiển thị<small>Tên dễ đọc của môi trường trong dashboard.</small><input data-setting="environment-label" value="${escapeHtml(env.label || '')}"></label>
        <label>URL website<small>Địa chỉ web seeker dùng cho UI test.</small><input data-setting="environment-base-url" value="${escapeHtml(env.baseURL || '')}"></label>
        <label>URL API<small>Địa chỉ API tương ứng với môi trường này.</small><input data-setting="environment-api-base-url" value="${escapeHtml(env.apiBaseURL || '')}"></label>
      </div>
    </div>
  `).join('');

  fillSettingSelect('#settings-default-environment', environmentEntries.map(([key]) => key), settings.runtime.defaultEnvironment);
  fillSettingSelect('#settings-trace', settings.options.trace, settings.runtime.trace);
  fillSettingSelect('#settings-screenshot', settings.options.screenshot, settings.runtime.screenshot);
  fillSettingSelect('#settings-video', settings.options.video, settings.runtime.video);

  setInputValue('#settings-workers', settings.runtime.workers);
  setInputValue('#settings-test-timeout', settings.runtime.testTimeout);
  setInputValue('#settings-navigation-timeout', settings.runtime.navigationTimeout);
  setInputValue('#settings-action-timeout', settings.runtime.actionTimeout);
  setInputValue('#settings-retries-local', settings.runtime.retriesLocal);
  setInputValue('#settings-retries-ci', settings.runtime.retriesCI);
  setInputValue('#settings-viewport-width', settings.runtime.viewport.width);
  setInputValue('#settings-viewport-height', settings.runtime.viewport.height);
  setChecked('#settings-show-env-banner', settings.runtime.showEnvBanner);
  setChecked('#settings-debug-optional-popups', settings.runtime.debugOptionalPopups);

  setInputValue('#settings-registration-token', '');
  setInputValue('#settings-api-branch', settings.api.branch);
  setInputValue('#settings-api-lang', settings.api.lang);
  setInputValue('#settings-register-retries', settings.api.registerRetries);
  setInputValue('#settings-register-timeout', settings.api.registerTimeout);
  setInputValue('#settings-consent-retries', settings.api.consentRetries);
  setInputValue('#settings-consent-timeout', settings.api.consentTimeout);
  $('#settings-token-status').textContent = settings.api.hasRegistrationBearerToken
    ? 'Đã lưu bearer token. Để trống ô token nếu không muốn thay đổi.'
    : 'Chưa có bearer token được lưu.';

  setInputValue('#settings-retention-days', settings.artifacts.retentionDays);
  setInputValue('#settings-max-reports-per-day', settings.artifacts.maxReportsPerDay);
  setChecked('#settings-auto-cleanup-evidence', settings.artifacts.autoCleanupEvidence);
  setChecked('#settings-auto-cleanup-reports', settings.artifacts.autoCleanupReports);
}

function collectSettingsPayload() {
  const environments = {};
  document.querySelectorAll('.environment-row').forEach((row) => {
    environments[row.dataset.env] = {
      label: row.querySelector('[data-setting="environment-label"]').value,
      baseURL: row.querySelector('[data-setting="environment-base-url"]').value,
      apiBaseURL: row.querySelector('[data-setting="environment-api-base-url"]').value,
    };
  });

  const api = {
    branch: $('#settings-api-branch').value,
    lang: $('#settings-api-lang').value,
    registerRetries: readNumber('#settings-register-retries'),
    registerTimeout: readNumber('#settings-register-timeout'),
    consentRetries: readNumber('#settings-consent-retries'),
    consentTimeout: readNumber('#settings-consent-timeout'),
  };
  const token = $('#settings-registration-token').value.trim();
  if (token) api.registrationBearerToken = token;

  return {
    environments,
    runtime: {
      defaultEnvironment: $('#settings-default-environment').value,
      workers: readNumber('#settings-workers'),
      testTimeout: readNumber('#settings-test-timeout'),
      navigationTimeout: readNumber('#settings-navigation-timeout'),
      actionTimeout: readNumber('#settings-action-timeout'),
      retriesLocal: readNumber('#settings-retries-local'),
      retriesCI: readNumber('#settings-retries-ci'),
      trace: $('#settings-trace').value,
      screenshot: $('#settings-screenshot').value,
      video: $('#settings-video').value,
      viewport: {
        width: readNumber('#settings-viewport-width'),
        height: readNumber('#settings-viewport-height'),
      },
      showEnvBanner: $('#settings-show-env-banner').checked,
      debugOptionalPopups: $('#settings-debug-optional-popups').checked,
    },
    api,
    artifacts: {
      retentionDays: readNumber('#settings-retention-days'),
      maxReportsPerDay: readNumber('#settings-max-reports-per-day'),
      autoCleanupEvidence: $('#settings-auto-cleanup-evidence').checked,
      autoCleanupReports: $('#settings-auto-cleanup-reports').checked,
    },
  };
}

async function openSettings() {
  try {
    renderSettings(await request('/api/settings'));
  } catch (error) { notify(error.message); }
}

async function saveSettings() {
  const button = $('#save-settings-button');
  button.disabled = true;
  try {
    const result = await request('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectSettingsPayload()),
    });
    renderSettings(result.settings);
    notify(`${result.message} Backup: ${result.backup}`);
    const config = await request('/api/config');
    fillSelect('#environment', config.environments, '');
    if (config.defaults?.environment) $('#environment').value = config.defaults.environment;
    if (config.defaults?.workers) $('#workers').value = config.defaults.workers;
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
}

async function initialize() {
  try {
    const [config, state] = await Promise.all([request('/api/config'), request('/api/state')]);
    fillSelect('#environment', config.environments, '');
    fillSelect('#project', config.projects, 'Tất cả nhóm test');
    fillSelect('#spec', ['all', ...config.specs], 'Tất cả file test');
    if (config.defaults?.environment) $('#environment').value = config.defaults.environment;
    if (config.defaults?.workers) $('#workers').value = config.defaults.workers;
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
    $('#run-button').textContent = 'Đang khởi động...';
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
    button.innerHTML = '<span>◌</span> Đang mở UI...';
  try {
    const run = await request('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedOptions()) });
    renderRun(run);
    notify('Playwright UI đang được mở trong cửa sổ riêng.');
  } catch (error) {
    notify(error.message);
    button.disabled = false;
  } finally {
    button.innerHTML = '<span>◫</span> Mở Playwright UI';
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
  if (button.dataset.view === 'settings-view') await openSettings();
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
  $('#code-status-text').textContent = changed ? 'Đã chỉnh sửa' : 'Sẵn sàng';
});
$('#code-editor').addEventListener('scroll', () => {
  $('#code-preview').scrollTop = $('#code-editor').scrollTop;
  $('#code-preview').scrollLeft = $('#code-editor').scrollLeft;
});
$('#code-edit-button').addEventListener('click', enterCodeEditMode);
$('#code-format-button').addEventListener('click', formatCurrentCodeEditor);
$('#code-cancel-button').addEventListener('click', leaveCodeEditMode);
$('#code-save-button').addEventListener('click', saveCodeFile);
$('#format-resource-button').addEventListener('click', formatCurrentResourceEditor);
$('#reload-settings-button').addEventListener('click', openSettings);
$('#save-settings-button').addEventListener('click', saveSettings);
$('#theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('playwright-dashboard-theme', theme);
  applyTheme(theme);
});

initialize();
