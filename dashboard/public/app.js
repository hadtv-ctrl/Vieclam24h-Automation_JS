// master-process-disable-size-check: Monolith being incrementally decomposed via Plan 09 strangler pattern
// --- APPLY CONFIG ---
function normalizeFontSizePx(value) {
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(String(value || '').trim());
  if (!match) return null;
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size < 11 || size > 18) return null;
  return size;
}

function applyFontScale(root, fontSize) {
  const body = normalizeFontSizePx(fontSize);
  if (!body) return;
  root.style.setProperty('--font-meta', `${Math.max(9, body - 4)}px`);
  root.style.setProperty('--font-caption', `${Math.max(10, body - 3)}px`);
  root.style.setProperty('--font-control', `${Math.max(11, body - 2)}px`);
  root.style.setProperty('--font-body', `${body}px`);
  root.style.setProperty('--font-panel-title', `${body + 3}px`);
}

function applyLogoElement(element, logoUrl) {
  if (!element) return;
  const cleanUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  if (!cleanUrl) {
    element.classList.remove('has-logo');
    if (element.tagName === 'IMG') {
      element.src = '';
    } else {
      element.textContent = 'QA';
    }
    element.style.backgroundImage = '';
    element.style.background = '';
    element.style.boxShadow = '';
    element.style.border = '';
    return;
  }
  if (element.tagName === 'IMG') {
    element.src = cleanUrl;
    return;
  }
  element.classList.add('has-logo');
  element.style.backgroundImage = '';
  element.style.background = 'transparent';
  element.style.boxShadow = 'none';
  element.style.border = 'none';
  element.innerHTML = `<img src="${String(cleanUrl).replace(/"/g, '&quot;')}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; display: block;" onerror="this.parentElement.classList.remove('has-logo'); this.parentElement.textContent='QA';">`;
}

function applyAppConfig(config) {
  if (!config) return;
  
  if (config.pageTitle) document.title = config.pageTitle;
  
  const brandName = document.getElementById('brand-name');
  if (brandName && config.projectName) brandName.innerText = config.projectName;
  
  const brandSubtitle = document.getElementById('brand-subtitle');
  if (brandSubtitle && config.projectSubtitle) brandSubtitle.innerText = config.projectSubtitle;
  
  const brandLogo = document.getElementById('brand-logo');
  if (brandLogo) {
    applyLogoElement(brandLogo, config.logoUrl);
  }
  
  const favicon = document.getElementById('favicon');
  if (favicon && config.logoUrl) favicon.href = config.logoUrl;

  const root = document.documentElement;
  if (config.primaryColor) {
    root.style.setProperty('--accent', config.primaryColor);
  }
  window.__dashboardCustomBg = config.backgroundColor || '';
  const activeTheme = document.documentElement.dataset.theme || preferredTheme();
  if (activeTheme === 'light' && config.backgroundColor) {
    root.style.setProperty('--bg', config.backgroundColor);
  } else {
    root.style.removeProperty('--bg');
  }
  applyFontScale(root, config.fontSize);
}

const $ = (selector) => document.querySelector(selector);
const form = $('#run-form');
const consoleOutput = $('#console');
let currentRun = null;
let timer = null;
let resourceCatalog = { documents: [], data: [], evidence: [], evidenceDetails: [], reports: [], reportDetails: [] };
let currentResource = null;
let activeResourceCategory = 'reports';
let activeEvidencePlatform = 'all';
let areFoldersExpanded = false;
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
  const root = document.documentElement;
  const customBg = window.__dashboardCustomBg || '';
  if (isLight && customBg) {
    root.style.setProperty('--bg', customBg);
  } else {
    root.style.removeProperty('--bg');
  }
  const btn = $('#theme-button');
  if (btn) {
    btn.setAttribute('aria-pressed', String(isLight));
    btn.setAttribute('data-tooltip', isLight ? 'Giao diện Tối' : 'Giao diện Sáng');
    btn.setAttribute('aria-label', isLight ? 'Chuyển sang giao diện Tối' : 'Chuyển sang giao diện Sáng');
  }
  const icon = $('.theme-icon');
  if (icon) icon.innerHTML = isLight ? '<i class="ph-fill ph-sun"></i>' : '<i class="ph-fill ph-moon"></i>';
  const label = $('#theme-label');
  if (label) label.textContent = isLight ? 'Sáng' : 'Tối';
}

$('#theme-button')?.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || preferredTheme();
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('playwright-dashboard-theme', nextTheme);
  applyTheme(nextTheme);
  notify(`Đã chuyển sang giao diện ${nextTheme === 'dark' ? 'Tối (Dark Mode)' : 'Sáng (Light Mode)'}`);
});

applyTheme(preferredTheme());

function fillSelect(selector, values, allLabel) {
  $(selector).innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(value)}</option>`
  ).join('');
}

let testCatalog = { specs: [], specProjects: {} };

function refreshSpecOptions() {
  const project = $('#project').value;
  const selectedSpec = $('#spec').value;
  const hasProjectMapping = Object.keys(testCatalog.specProjects).length > 0;
  const specs = project === 'all' || !hasProjectMapping
    ? testCatalog.specs
    : testCatalog.specs.filter((spec) => testCatalog.specProjects[spec]?.includes(project));
  fillSelect('#spec', ['all', ...specs], 'Tất cả file test');
  if (specs.includes(selectedSpec)) $('#spec').value = selectedSpec;
  updateWorkersForSpec();
  populateBuilderSpecOptions();
}

function updateWorkersForSpec() {
  const spec = $('#spec').value;
  const workersInput = $('#workers');
  if (spec !== 'all') {
    if (!workersInput.disabled) workersInput.dataset.previousValue = workersInput.value;
    workersInput.value = '1';
    workersInput.disabled = true;
  } else {
    workersInput.disabled = false;
    if (workersInput.dataset.previousValue) {
      workersInput.value = workersInput.dataset.previousValue;
    }
  }
  updateManualSpecsPreview();
}

$('#project')?.addEventListener('change', refreshSpecOptions);
$('#spec')?.addEventListener('change', updateWorkersForSpec);
$('#grep')?.addEventListener('input', updateManualSpecsPreview);

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

function readNumber(target, fallback = 0) {
  if (typeof target === 'string' && (target.startsWith('#') || target.startsWith('.'))) {
    const el = $(target);
    if (!el) return fallback;
    const val = Number(el.value);
    return Number.isFinite(val) ? val : fallback;
  }
  const val = Number(target);
  return Number.isFinite(val) ? val : fallback;
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
    container.innerHTML = `<pre><code>${highlightCode(formatted, getCodeLanguage(resource.path || 'data.json'))}</code></pre>`;
    return;
  }

  if (resource.type === 'markdown') {
    container.innerHTML = renderMarkdown(resource.content);
    return;
  }

  container.textContent = resource.content;
}

function notify(message, type = 'info') {
  const toast = document.getElementById('toast') || document.querySelector('#toast');
  if (!toast) {
    console.log(`[Toast ${type}]`, message);
    return;
  }
  toast.textContent = message;
  toast.className = `show ${type}`;
  clearTimeout(toast.__timeout);
  toast.__timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function showToast(message, type = 'info') {
  notify(message, type);
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
  if (!response.ok) {
    const errorMsg = body.error || (Array.isArray(body.errors) && body.errors.length ? body.errors.join('; ') : '') || 'Có lỗi xảy ra.';
    throw new Error(errorMsg);
  }
  return body;
}

function renderResourceList(filter = '') {
  const query = filter.trim().toLowerCase();
  let totalMatches = 0;
  const groups = [
    ['Báo cáo', 'reports', resourceCatalog.reports],
    ['Evidence', 'evidence', resourceCatalog.evidence],
  ];

  // Tự động mở thư mục ngày gần nhất khi khởi tạo
  if (!query && openReportFolders.size === 0 && resourceCatalog.reports.length) {
    const firstReport = resourceCatalog.reports[0];
    const firstFolder = firstReport.split('/')[0];
    if (firstFolder) openReportFolders.add(firstFolder);
  }
  if (!query && openEvidenceFolders.size === 0 && resourceCatalog.evidence.length) {
    const firstEv = resourceCatalog.evidence[0];
    const parts = firstEv.split('/');
    if (parts.length > 0) openEvidenceFolders.add(parts[0]);
    if (parts.length > 1) openEvidenceFolders.add(`${parts[0]}/${parts[1]}`);
  }

  const html = groups.map(([label, category, files]) => {
    if (activeResourceCategory !== 'all' && activeResourceCategory !== category) return '';
    let matches = files.filter((file) => file.toLowerCase().includes(query));
    if (category === 'evidence' && activeEvidencePlatform !== 'all') {
      if (activeEvidencePlatform === 'desktop') {
        matches = matches.filter((file) => file.toLowerCase().includes('/desktop/'));
      } else if (activeEvidencePlatform === 'mobile') {
        matches = matches.filter((file) => file.toLowerCase().includes('/mobile-web/') || file.toLowerCase().includes('/mobile/'));
      }
    }
    totalMatches += matches.length;
    if (!matches.length) return '';
    if (category === 'reports') {
      return `<section class="resource-group report-group">${renderReportTree(matches, !!query)}</section>`;
    }
    if (category === 'evidence') {
      evidenceNavigation = matches;
      return `<section class="resource-group evidence-group">${renderEvidenceTree(matches, !!query)}</section>`;
    }
    return `<section class="resource-group">${matches.map((file) =>
      `<button class="resource-item${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="${category}"><span>${category === 'reports' ? 'R' : file.endsWith('.json') ? '{}' : /\.(png|jpe?g|webp)$/i.test(file) ? '▧' : 'M↓'}</span><div><strong>${escapeHtml(category === 'reports' ? file.split('/').slice(-2,-1)[0] || 'Báo cáo' : file.split('/').pop())}</strong><small>${escapeHtml(file)}</small></div></button>`
    ).join('')}</section>`;
  }).join('');

  $('#resource-list').innerHTML = html || `
    <div class="resource-empty-state">
      <i class="ph ph-magnifying-glass"></i>
      <p>Không tìm thấy file nào phù hợp.</p>
    </div>
  `;

  // Cập nhật toolbar tiêu đề & số lượng
  const countEl = $('#resource-list-count');
  const titleEl = $('#resource-list-title');
  if (countEl) {
    countEl.textContent = `${totalMatches} ${activeResourceCategory === 'reports' ? 'báo cáo' : 'ảnh'}`;
  }
  if (titleEl) {
    titleEl.textContent = activeResourceCategory === 'reports' ? 'DANH MỤC BÁO CÁO' : 'DANH MỤC ẢNH EVIDENCE';
  }

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
    if (button.dataset.type === 'report-folder') {
      await deleteReportFolder(button.dataset.folder);
    } else {
      await deleteEvidenceFolder(button.dataset.folder);
    }
  }));
}

function renderReportTree(files, isSearching = false) {
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
    return `<button class="resource-item report-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="reports"><span class="res-item-icon-report"><i class="ph-bold ph-file-html"></i></span><div><strong>Báo cáo Playwright</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
  }).join('');
  const branchHtml = (branch, parentPath = '') => Object.entries(branch)
    .filter(([key]) => key !== '__reports')
    .map(([folder, child]) => {
      const folderPath = parentPath ? `${parentPath}/${folder}` : folder;
      const open = (isSearching || areFoldersExpanded || openReportFolders.has(folderPath)) ? ' open' : '';
      return `<details class="evidence-folder report-folder" data-report-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${countReports(child)}</small><button class="delete-folder-button" type="button" data-folder="${escapeHtml(folderPath)}" data-type="report-folder" title="Xóa folder báo cáo">×</button></summary><div>${branchHtml(child, folderPath)}${reportItems(child.__reports || [])}</div></details>`;
    }).join('');
  return branchHtml(root) + reportItems(root.__reports || []);
}

function renderEvidenceTree(files, isSearching = false) {
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
      const open = (isSearching || areFoldersExpanded || openEvidenceFolders.has(folderPath)) ? ' open' : '';
      return `<details class="evidence-folder" data-folder="${escapeHtml(folderPath)}"${open}><summary><span class="folder-icon">▸</span><strong>${escapeHtml(folder)}</strong><small>${childFiles}</small><button class="delete-folder-button" type="button" data-folder="${escapeHtml(folderPath)}" data-type="evidence-folder" title="Xóa folder">×</button></summary><div>${renderBranch(child, depth + 1, folderPath)}${renderFiles(child.__files || [])}</div></details>`;
    }).join('');

  const renderFiles = (items) => [...items].reverse().map((file) => {
    const detail = resourceCatalog.evidenceDetails.find((item) => item.path === file);
    const createdAt = detail?.modifiedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(detail.modifiedAt)) : 'Không rõ thời gian';
    return `<button class="resource-item evidence-file${file === currentResource ? ' active' : ''}" type="button" data-path="${escapeHtml(file)}" data-category="evidence"><span class="res-item-icon-evidence"><i class="ph-bold ph-image"></i></span><div><strong>${escapeHtml(file.split('/').pop())}</strong><small>${escapeHtml(createdAt)}</small></div></button>`;
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
    if (currentResource && (currentResource === folderPath || currentResource.startsWith(`${folderPath}/`))) {
      currentResource = null;
      currentResourceCategory = '';
      hideResourcePreviews();
      $('#resource-empty').hidden = false;
      $('#resource-name').textContent = 'Chọn một mục để xem chi tiết';
      $('#resource-type').textContent = 'RESOURCE';
      $('#delete-button').hidden = true;
    }
    openEvidenceFolders.delete(folderPath);
    for (const openFolder of Array.from(openEvidenceFolders)) {
      if (openFolder === folderPath || openFolder.startsWith(`${folderPath}/`)) {
        openEvidenceFolders.delete(openFolder);
      }
    }
    await openExplorer();
  } catch (error) { notify(error.message); }
}

async function deleteReportFolder(folderPath) {
  const reportCount = resourceCatalog.reports.filter((item) => item.startsWith(`${folderPath}/`)).length;
  const promptText = reportCount > 0
    ? `Xóa folder báo cáo này và toàn bộ ${reportCount} báo cáo (gồm HTML, data, trace/video) bên trong?\n\n${folderPath}`
    : `Xóa folder báo cáo này?\n\n${folderPath}`;
  if (!window.confirm(promptText)) return;
  try {
    const result = await request('/api/artifact', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'report-folder', path: folderPath }),
    });
    notify(result.message);
    if (currentResource && (currentResource === folderPath || currentResource.startsWith(`${folderPath}/`))) {
      currentResource = null;
      currentResourceCategory = '';
      hideResourcePreviews();
      $('#resource-empty').hidden = false;
      $('#resource-name').textContent = 'Chọn một mục để xem chi tiết';
      $('#resource-type').textContent = 'RESOURCE';
      $('#delete-button').hidden = true;
    }
    openReportFolders.delete(folderPath);
    for (const openFolder of Array.from(openReportFolders)) {
      if (openFolder === folderPath || openFolder.startsWith(`${folderPath}/`)) {
        openReportFolders.delete(openFolder);
      }
    }
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
    if (currentResourceType === 'json' || getCodeLanguage(currentResource) === 'json') {
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
    const content = currentResourceType === 'json' || getCodeLanguage(currentResource) === 'json'
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
    $('#resource-summary').innerHTML = `
      <div class="hero-stat-card"><strong>${resourceCatalog.reports.length}</strong><small>Báo cáo</small></div>
      <div class="hero-stat-card"><strong>${resourceCatalog.evidence.length}</strong><small>Ảnh evidence</small></div>
      <div class="hero-stat-card"><strong>${resourceCatalog.documents.length}</strong><small>Tài liệu</small></div>
    `;

    // Cập nhật số lượng trên các tab chuyển đổi Segmented Switcher
    const reportsBadge = $('#badge-reports-count');
    const evidenceBadge = $('#badge-evidence-count');
    if (reportsBadge) reportsBadge.textContent = resourceCatalog.reports?.length || 0;
    if (evidenceBadge) evidenceBadge.textContent = resourceCatalog.evidence?.length || 0;

    renderResourceList($('#resource-search')?.value || '');
  } catch (error) { notify(error.message); }
}

// ============================================================================
// OBJECT REPOSITORY & CORE CAPABILITIES CONTROLLER (NON-TECH MODE)
// ============================================================================
let activeCodeMode = 'visual'; // 'visual' | 'raw'
let repoPages = [];
let repoCapabilities = [];
let selectedRepoPage = null;
let activeRepoCategory = 'all'; // 'all' | 'desktop' | 'mobile-web' | 'core'
let activeRepoTypeFilter = 'all';
let currentEditingLocator = null;
let objectRepoInitialized = false;
let pageStudioLocators = [];
let pageStudioActions = [];

function renderPageStudioRows() {
  const locators = $('#new-page-locators');
  const actions = $('#new-page-actions');
  if (locators) {
    locators.innerHTML = pageStudioLocators.map((item, index) => `
      <div class="page-studio-row" data-index="${index}">
        <input class="new-page-locator-name" placeholder="Tên biến, ví dụ: submitButton" value="${escapeHtml(item.name)}">
        <input class="new-page-locator-expression" placeholder="page.getByRole('button', { name: 'Lưu' })" value="${escapeHtml(item.expression)}">
        <button type="button" class="btn-icon-subtle page-studio-remove" aria-label="Xóa locator"><i class="ph-bold ph-trash"></i></button>
      </div>`).join('');
  }
  if (actions) {
    actions.innerHTML = pageStudioActions.map((item, index) => `
      <div class="page-studio-row" data-index="${index}">
        <input class="new-page-action-name" placeholder="Tên action, ví dụ: submitForm" value="${escapeHtml(item.name)}">
        <select class="new-page-action-locator">${pageStudioLocators.map((locator) => `<option value="${escapeHtml(locator.name)}"${locator.name === item.locatorName ? ' selected' : ''}>${escapeHtml(locator.name || 'Chọn locator')}</option>`).join('')}</select>
        <select class="new-page-action-operation"><option value="click"${item.operation === 'click' ? ' selected' : ''}>Bấm</option><option value="fill"${item.operation === 'fill' ? ' selected' : ''}>Nhập</option></select>
        <button type="button" class="btn-icon-subtle page-studio-remove" aria-label="Xóa action"><i class="ph-bold ph-trash"></i></button>
      </div>`).join('');
  }
  document.querySelectorAll('.page-studio-remove').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('.page-studio-row');
    const index = Number(row.dataset.index);
    const collection = row.parentElement.id === 'new-page-locators' ? pageStudioLocators : pageStudioActions;
    collection.splice(index, 1);
    renderPageStudioRows();
    updatePageStudioPreview();
  }));
  document.querySelectorAll('#new-page-locators input, #new-page-actions input, #new-page-actions select').forEach((control) => control.addEventListener('input', syncPageStudioState));
  document.querySelectorAll('#new-page-actions select').forEach((control) => control.addEventListener('change', syncPageStudioState));
}

function syncPageStudioState() {
  pageStudioLocators = Array.from(document.querySelectorAll('#new-page-locators .page-studio-row')).map((row) => ({
    name: row.querySelector('.new-page-locator-name').value,
    expression: row.querySelector('.new-page-locator-expression').value,
  }));
  pageStudioActions = Array.from(document.querySelectorAll('#new-page-actions .page-studio-row')).map((row) => ({
    name: row.querySelector('.new-page-action-name').value,
    locatorName: row.querySelector('.new-page-action-locator').value,
    operation: row.querySelector('.new-page-action-operation').value,
  }));
  updatePageStudioPreview();
}

function pageStudioCode() {
  const className = $('#new-page-class')?.value.trim() || 'NewPage';
  const basePageImport = $('#new-page-platform')?.value === 'mobile-web' ? "require('../../pages/BasePage')" : "require('../BasePage')";
  const locatorLines = pageStudioLocators.filter((item) => item.name && item.expression).map((item) => {
    let expr = item.expression.trim();
    if (expr.startsWith('this.page.')) {
      expr = expr.replace(/^this\./, '');
    }
    return `    this.${item.name} = ${expr};`;
  }).join('\n') || '    // Thêm locator của màn hình tại đây.';
  const methodLines = pageStudioActions.filter((item) => item.name).map((item) => item.operation === 'fill'
    ? `  async ${item.name}(value) {\n    await this.${item.locatorName || 'page'}.fill(value);\n  }`
    : `  async ${item.name}() {\n    await this.${item.locatorName || 'page'}.click();\n  }`).join('\n\n');
  return `const { BasePage } = ${basePageImport};\n\nclass ${className} extends BasePage {\n  constructor(page, featureName) {\n    super(page, featureName);\n${locatorLines}\n  }${methodLines ? `\n\n${methodLines}` : ''}\n}\n\nmodule.exports = { ${className} };\n`;
}

function updatePageStudioPreview() {
  const preview = $('#new-page-preview code');
  if (preview) preview.innerHTML = highlightCode(pageStudioCode());
  const status = $('#new-page-status');
  if (status) status.textContent = `${pageStudioLocators.length} locator · ${pageStudioActions.length} action`;
}

let pageManagerLocators = [];
let pageManagerActions = [];
let pageManagerMode = 'inspect'; // 'inspect' | 'create'
let currentInspectedPage = null;
let pageDirectEditMode = false;
let currentInspectedCode = '';
let existingPageFilter = 'desktop';

function pageManagerCode() {
  const className = $('#page-manager-class')?.value.trim() || 'NewPage';
  const basePageImport = $('#page-manager-platform')?.value === 'mobile-web' ? "require('../../pages/BasePage')" : "require('../BasePage')";
  const locatorLines = pageManagerLocators.filter((item) => item.name && item.expression).map((item) => {
    let expr = item.expression.trim();
    if (expr.startsWith('this.page.')) {
      expr = expr.replace(/^this\./, '');
    }
    return `    this.${item.name} = ${expr};`;
  }).join('\n') || '    // Thêm locator của màn hình tại đây.';
  const methodLines = pageManagerActions.filter((item) => item.name && item.locatorName).map((item) => item.operation === 'fill'
    ? `  async ${item.name}(value) {\n    await this.${item.locatorName}.fill(value);\n  }`
    : `  async ${item.name}() {\n    await this.${item.locatorName}.click();\n  }`).join('\n\n');
  return `const { BasePage } = ${basePageImport};\n\nclass ${className} extends BasePage {\n  constructor(page, featureName) {\n    super(page, featureName);\n${locatorLines}\n  }${methodLines ? `\n\n${methodLines}` : ''}\n}\n\nmodule.exports = { ${className} };\n`;
}

function renderPageManagerRows() {
  const locatorContainer = $('#page-manager-locators');
  const actionContainer = $('#page-manager-actions');

  if (locatorContainer) {
    if (pageManagerLocators.length === 0) {
      locatorContainer.innerHTML = `
        <div class="pm-empty-row-state">
          <i class="ph-bold ph-crosshair"></i>
          <div>
            <strong>Chưa có phần tử giao diện nào</strong>
            <p>Bấm nút <span>+ Thêm locator</span> ở góc trên để khai báo phần tử đầu tiên cho Page Object.</p>
          </div>
        </div>
      `;
    } else {
      locatorContainer.innerHTML = pageManagerLocators.map((item, index) => `
        <div class="page-manager-row pm-modern-row" data-index="${index}">
          <div class="pm-row-field">
            <label class="pm-row-label">Tên biến (camelCase)</label>
            <input class="page-manager-locator-name pm-form-control font-mono" placeholder="ví dụ: submitButton" value="${escapeHtml(item.name)}">
          </div>
          <div class="pm-row-field" style="flex: 1.6;">
            <label class="pm-row-label">Playwright Selector</label>
            <input class="page-manager-locator-expression pm-form-control font-mono" placeholder="page.getByRole('button', { name: 'Lưu' })" value="${escapeHtml(item.expression)}">
          </div>
          <button type="button" class="btn-icon-subtle page-manager-remove" title="Xóa locator này" aria-label="Xóa locator"><i class="ph-bold ph-trash"></i></button>
        </div>`).join('');
    }
  }

  if (actionContainer) {
    if (pageManagerActions.length === 0) {
      actionContainer.innerHTML = `
        <div class="pm-empty-row-state">
          <i class="ph-bold ph-lightning"></i>
          <div>
            <strong>Chưa có hành động nghiệp vụ nào</strong>
            <p>Bấm nút <span>+ Thêm action</span> ở góc trên để định nghĩa phương thức nghiệp vụ.</p>
          </div>
        </div>
      `;
    } else {
      actionContainer.innerHTML = pageManagerActions.map((item, index) => `
        <div class="page-manager-row page-manager-action-row pm-modern-row" data-index="${index}">
          <div class="pm-row-field">
            <label class="pm-row-label">Tên hàm Action</label>
            <input class="page-manager-action-name pm-form-control font-mono" placeholder="ví dụ: clickSubmit" value="${escapeHtml(item.name)}">
          </div>
          <div class="pm-row-field">
            <label class="pm-row-label">Locator liên kết</label>
            <select class="page-manager-action-locator pm-form-control">
              <option value="">-- Chọn locator --</option>
              ${pageManagerLocators.map((locator) => `<option value="${escapeHtml(locator.name)}"${locator.name === item.locatorName ? ' selected' : ''}>${escapeHtml(locator.name || 'Locator chưa đặt tên')}</option>`).join('')}
            </select>
          </div>
          <div class="pm-row-field" style="max-width: 140px;">
            <label class="pm-row-label">Thao tác</label>
            <select class="page-manager-action-operation pm-form-control">
              <option value="click"${item.operation === 'click' ? ' selected' : ''}>click() - Nhấp</option>
              <option value="fill"${item.operation === 'fill' ? ' selected' : ''}>fill() - Điền</option>
            </select>
          </div>
          <button type="button" class="btn-icon-subtle page-manager-remove" title="Xóa action này" aria-label="Xóa action"><i class="ph-bold ph-trash"></i></button>
        </div>`).join('');
    }
  }

  // Update counts in section heads
  if ($('#pm-locators-count-display')) $('#pm-locators-count-display').textContent = `${pageManagerLocators.length} locator${pageManagerLocators.length !== 1 ? 's' : ''}`;
  if ($('#pm-actions-count-display')) $('#pm-actions-count-display').textContent = `${pageManagerActions.length} action${pageManagerActions.length !== 1 ? 's' : ''}`;

  document.querySelectorAll('.page-manager-remove').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('.page-manager-row');
    if (!row) return;
    const collection = row.classList.contains('page-manager-action-row') ? pageManagerActions : pageManagerLocators;
    collection.splice(Number(row.dataset.index), 1);
    renderPageManagerRows();
    updatePageManagerPreview();
  }));
  document.querySelectorAll('#page-manager-locators input, #page-manager-actions input, #page-manager-actions select').forEach((control) => control.addEventListener('input', syncPageManagerState));
  document.querySelectorAll('#page-manager-actions select').forEach((control) => control.addEventListener('change', syncPageManagerState));
}

function syncPageManagerState() {
  pageManagerLocators = Array.from(document.querySelectorAll('#page-manager-locators .page-manager-row')).map((row) => ({
    name: row.querySelector('.page-manager-locator-name')?.value || '',
    expression: row.querySelector('.page-manager-locator-expression')?.value || ''
  }));
  pageManagerActions = Array.from(document.querySelectorAll('#page-manager-actions .page-manager-action-row')).map((row) => ({
    name: row.querySelector('.page-manager-action-name')?.value || '',
    locatorName: row.querySelector('.page-manager-action-locator')?.value || '',
    operation: row.querySelector('.page-manager-action-operation')?.value || 'click'
  }));
  updatePageManagerPreview();
  debounceSavePageDraft();
}

function initPageManagerCodeEditor() {
  if (window.pageManagerCodeEditor) return window.pageManagerCodeEditor;
  const textarea = document.getElementById('page-manager-code-editor');
  const preview = document.getElementById('page-manager-preview-code') || document.querySelector('#page-manager-preview code');
  if (!textarea || !preview) return null;

  window.pageManagerCodeEditor = createSharedCodeEditor({
    textarea,
    preview,
    language: 'javascript',
    badge: document.getElementById('pm-code-status'),
    revertBtn: document.getElementById('pm-btn-revert-code'),
    copyBtn: document.getElementById('pm-btn-copy-code'),
    saveBtn: document.getElementById('pm-btn-save-code'),
    onSave: async () => {
      await saveCurrentPageCode();
    },
    onInput: (editor) => {
      currentInspectedCode = editor.getValue();
    },
  });
  return window.pageManagerCodeEditor;
}

function updatePageManagerPreview() {
  const code = pageManagerCode();
  initPageManagerCodeEditor();
  if (window.pageManagerCodeEditor) {
    window.pageManagerCodeEditor.setValue(code, { markClean: true, readOnly: true });
  } else {
    const preview = $('#page-manager-preview code') || $('#page-manager-preview-code');
    if (preview) preview.innerHTML = highlightCode(code);
    const editor = $('#page-manager-code-editor');
    if (editor) editor.value = code;
  }
  const count = $('#page-manager-count');
  if (count) count.innerHTML = `<i class="ph-bold ph-crosshair"></i> ${pageManagerLocators.length} locator · <i class="ph-bold ph-lightning"></i> ${pageManagerActions.length} action`;
  if ($('#pm-locators-count-display')) $('#pm-locators-count-display').textContent = `${pageManagerLocators.length} locator${pageManagerLocators.length !== 1 ? 's' : ''}`;
  if ($('#pm-actions-count-display')) $('#pm-actions-count-display').textContent = `${pageManagerActions.length} action${pageManagerActions.length !== 1 ? 's' : ''}`;
}

// --- Page Manager Draft Management (.dashboard-drafts/pages/) ---
const PAGE_MANAGER_DRAFT_KEY = 'qa_studio_page_manager_draft';
let activePageDraftId = null;
let pageDraftDebounceTimer = null;

function updatePageDraftStatusBadge(statusText, state = 'saved', fullTitle = '') {
  const badge = $('#pm-draft-status-badge');
  if (!badge) return;
  if (state === 'none' || !statusText) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.className = 'draft-status-pill ' + state;
  badge.title = fullTitle || statusText;
  let icon = '<i class="ph-bold ph-floppy-disk"></i>';
  if (state === 'saved') icon = '<i class="ph-bold ph-check"></i>';
  if (state === 'modified') icon = '<i class="ph-bold ph-pencil-simple"></i>';
  badge.innerHTML = `${icon} <span>${escapeHtml(statusText)}</span>`;
}

function getPageManagerDraftPayload() {
  const platform = $('#page-manager-platform')?.value || 'desktop';
  const title = $('#page-manager-title')?.value.trim() || '';
  const className = $('#page-manager-class')?.value.trim() || '';
  const description = $('#page-manager-description')?.value.trim() || '';
  return {
    platform,
    title,
    className,
    description,
    locators: pageManagerLocators || [],
    actions: pageManagerActions || [],
    savedAt: Date.now(),
  };
}

async function savePageDraft(forceServer = false) {
  const draft = getPageManagerDraftPayload();
  if (!draft.title && !draft.className && draft.locators.length === 0 && draft.actions.length === 0) {
    clearPageDraft(true);
    updatePageDraftStatusBadge('', 'none');
    return null;
  }

  try {
    localStorage.setItem(PAGE_MANAGER_DRAFT_KEY, JSON.stringify(draft));
    if (!activePageDraftId) {
      activePageDraftId = 'draft_page_active';
    }

    updatePageDraftStatusBadge('Đang lưu...', 'modified');

    const res = await fetch('/api/drafts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'page',
        id: activePageDraftId,
        data: draft,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      updatePageDraftStatusBadge('Đã lưu nháp', 'saved', `Bản nháp máy chủ (${timeStr})`);
      if (forceServer) {
        showToast(`Đã lưu bản nháp Page Object vào máy chủ (.dashboard-drafts/pages/)`, 'success');
      }
    }
    return draft;
  } catch (err) {
    console.warn('Lỗi lưu page draft:', err.message);
    updatePageDraftStatusBadge('Đã lưu cục bộ', 'saved');
    return draft;
  }
}

function debounceSavePageDraft() {
  if (pageDraftDebounceTimer) clearTimeout(pageDraftDebounceTimer);
  pageDraftDebounceTimer = setTimeout(() => {
    savePageDraft(false);
  }, 600);
}

function restorePageDraft(draft) {
  if (!draft) return;
  if ($('#page-manager-platform') && draft.platform) $('#page-manager-platform').value = draft.platform;
  if ($('#page-manager-title') && draft.title) $('#page-manager-title').value = draft.title;
  if ($('#page-manager-class') && draft.className) $('#page-manager-class').value = draft.className;
  if ($('#page-manager-description') && draft.description) $('#page-manager-description').value = draft.description;

  pageManagerLocators = Array.isArray(draft.locators) ? draft.locators : [];
  pageManagerActions = Array.isArray(draft.actions) ? draft.actions : [];

  renderPageManagerRows();
  updatePageManagerPreview();
  const timeStr = draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString('vi-VN') : '';
  updatePageDraftStatusBadge(timeStr ? `Đã khôi phục (${timeStr})` : 'Đã khôi phục', 'saved');
  const banner = $('#pm-draft-recovery-banner');
  if (banner) banner.style.display = 'none';
  showToast('Đã khôi phục dữ liệu bản nháp Page Object!', 'success');
}

async function checkPageDraftOnCreateMode() {
  let localDraft = null;
  try {
    const raw = localStorage.getItem(PAGE_MANAGER_DRAFT_KEY);
    if (raw) localDraft = JSON.parse(raw);
  } catch {}

  try {
    const res = await fetch('/api/drafts?type=page');
    const data = await res.json();
    const serverDrafts = data.drafts || [];
    const latestServerDraft = serverDrafts[0];

    const draftCandidate = latestServerDraft?.data || localDraft;
    if (draftCandidate && (draftCandidate.title || draftCandidate.className || (draftCandidate.locators && draftCandidate.locators.length > 0))) {
      activePageDraftId = latestServerDraft?.id || 'draft_page_active';
      const banner = $('#pm-draft-recovery-banner');
      const text = $('#pm-draft-recovery-text');
      if (banner && text) {
        const name = draftCandidate.className || draftCandidate.title || 'Page Object chưa đặt tên';
        const dateStr = latestServerDraft?.updatedAt ? new Date(latestServerDraft.updatedAt).toLocaleTimeString('vi-VN') : '';
        text.textContent = `Phát hiện bản nháp "${name}"${dateStr ? ` (lưu lúc ${dateStr} trên máy chủ)` : ''}.`;
        banner.style.display = 'flex';

        const btnRestore = $('#pm-btn-restore-draft');
        if (btnRestore) btnRestore.onclick = () => restorePageDraft(draftCandidate);
        const btnDismiss = $('#pm-btn-dismiss-draft');
        if (btnDismiss) btnDismiss.onclick = () => { banner.style.display = 'none'; };
      }
    } else {
      const banner = $('#pm-draft-recovery-banner');
      if (banner) banner.style.display = 'none';
    }
  } catch (err) {
    if (localDraft) {
      const banner = $('#pm-draft-recovery-banner');
      if (banner) {
        banner.style.display = 'flex';
        const btnRestore = $('#pm-btn-restore-draft');
        if (btnRestore) btnRestore.onclick = () => restorePageDraft(localDraft);
        const btnDismiss = $('#pm-btn-dismiss-draft');
        if (btnDismiss) btnDismiss.onclick = () => { banner.style.display = 'none'; };
      }
    }
  }
}

async function clearPageDraft(skipConfirm = false) {
  if (!skipConfirm) {
    const draft = getPageManagerDraftPayload();
    if (draft.title || draft.className || draft.locators.length > 0) {
      const ok = window.confirm('Bạn có chắc muốn xóa bản nháp Page Object này và làm mới form?');
      if (!ok) return;
    }
  }

  try {
    localStorage.removeItem(PAGE_MANAGER_DRAFT_KEY);
    if (activePageDraftId) {
      await fetch('/api/drafts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'page', id: activePageDraftId }),
      });
      activePageDraftId = null;
    }
  } catch {}

  if ($('#page-manager-title')) $('#page-manager-title').value = '';
  if ($('#page-manager-class')) $('#page-manager-class').value = '';
  if ($('#page-manager-description')) $('#page-manager-description').value = '';
  pageManagerLocators = [];
  pageManagerActions = [];
  renderPageManagerRows();
  updatePageManagerPreview();
  updatePageDraftStatusBadge('', 'none');
  const banner = $('#pm-draft-recovery-banner');
  if (banner) banner.style.display = 'none';
  if (!skipConfirm) {
    showToast('Đã xóa bản nháp Page Object và làm mới form.', 'info');
  }
}

function renderInspectedLocators(locators = []) {
  const container = $('#pm-inspect-locators-list');
  if (!container) return;

  if (currentInspectedPage?.platform === 'fixture') {
    container.innerHTML = `
      <div style="padding: 14px 16px; border-radius: 8px; border: 1px dashed color-mix(in srgb, #8b5cf6 35%, var(--line)); background: color-mix(in srgb, #8b5cf6 6%, var(--surface)); color: var(--text); font-size: 12px; line-height: 1.5;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #8b5cf6; font-weight: 700;">
          <i class="ph-bold ph-lightning" style="font-size: 15px;"></i>
          <span>Dependency Injection & Fixture Capabilities</span>
        </div>
        <p style="margin: 0; color: var(--muted);">
          File Fixture đóng vai trò nạp sẵn các Page Objects, quản lý Precondition và khởi tạo Session test. Các locator được đóng gói bên trong từng Page Object riêng biệt.
        </p>
      </div>
    `;
    return;
  }

  const filterQuery = ($('#pm-quick-search-input')?.value || '').toLowerCase().trim();

  const filtered = locators.filter((l) => {
    if (!filterQuery) return true;
    return (l.name || '').toLowerCase().includes(filterQuery) ||
      (l.expression || '').toLowerCase().includes(filterQuery) ||
      (l.description || '').toLowerCase().includes(filterQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-resource" style="padding:16px 0; font-size:12px;">${filterQuery ? 'Không tìm thấy locator nào khớp với từ khóa.' : 'Chưa có locator nào được định nghĩa trong constructor.'}</p>`;
    return;
  }

  container.innerHTML = filtered.map((l) => {
    const badgeColor = l.badgeColor || '#6b7280';
    const categoryIcon = l.categoryIcon || 'ph-bold ph-crosshair';
    const categoryLabel = l.categoryLabel || 'Phần tử';
    return `
      <div class="pm-locator-card" data-name="${escapeHtml(l.name)}">
        <div class="pm-locator-top">
          <div class="pm-locator-title">
            <span class="pm-locator-name">this.${escapeHtml(l.name)}</span>
            <span class="pm-locator-category-pill" style="background:${badgeColor};">
              <i class="${categoryIcon}"></i> ${escapeHtml(categoryLabel)}
            </span>
          </div>
          <div class="pm-locator-actions">
            <button type="button" class="pm-btn-loc-action pm-btn-copy-loc" data-expr="${escapeHtml(l.expression)}" title="Sao chép selector">
              <i class="ph-bold ph-copy"></i> Copy
            </button>
            <button type="button" class="pm-btn-loc-action pm-btn-edit-loc" data-name="${escapeHtml(l.name)}" data-expr="${escapeHtml(l.expression)}" title="Chỉnh sửa selector">
              <i class="ph-bold ph-pencil-simple"></i> Sửa
            </button>
          </div>
        </div>
        <code class="pm-locator-expr">${escapeHtml(l.expression)}</code>
        ${l.description ? `<p class="pm-locator-desc"><i class="ph ph-info"></i> ${escapeHtml(l.description)}</p>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.pm-btn-copy-loc').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.expr);
      notify('Đã sao chép biểu thức selector vào clipboard!', 'success');
    });
  });

  container.querySelectorAll('.pm-btn-edit-loc').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pagePath = currentInspectedPage ? currentInspectedPage.relativePath : undefined;
      openLocatorEditModal(btn.dataset.name, btn.dataset.expr, pagePath);
    });
  });
}

function renderInspectedActions(actions = []) {
  const container = $('#pm-inspect-actions-list');
  if (!container) return;
  const filterQuery = ($('#pm-quick-search-input')?.value || '').toLowerCase().trim();
  const reservedKeywords = new Set(['for', 'if', 'while', 'catch', 'switch', 'function', 'return', 'try', 'finally', 'constructor']);

  const validActions = (actions || []).filter((a) => {
    if (!a || !a.name) return false;
    const name = a.name.trim();
    if (reservedKeywords.has(name) || name.startsWith('_')) return false;
    if (name.startsWith('for(') || name.startsWith('for ') || name.startsWith('catch(') || name.startsWith('if(')) return false;
    return true;
  });

  const filtered = validActions.filter((a) => {
    if (!filterQuery) return true;
    return (a.signature || a.name || '').toLowerCase().includes(filterQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-resource" style="padding:16px 0; font-size:12px;">${filterQuery ? 'Không tìm thấy mục nào khớp từ khóa.' : 'Chưa định nghĩa method hoặc fixture nào.'}</p>`;
    return;
  }

  if (currentInspectedPage?.platform === 'fixture') {
    container.innerHTML = filtered.map((a) => {
      const badgeColor = a.badgeColor || '#8b5cf6';
      const cat = a.category || 'Fixture Injected';
      return `
        <div class="pm-action-card">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="${a.icon || 'ph-bold ph-lightning'}" style="color: ${badgeColor}; font-size: 15px;"></i>
              <span class="pm-action-sig" style="color: var(--text); font-weight: 700;">${escapeHtml(a.name)}</span>
            </div>
            <button type="button" class="btn-secondary-sm pm-btn-copy-fixture" data-name="${escapeHtml(a.name)}" title="Sao chép tên fixture parameter" style="font-size: 11px; padding: 3px 8px;">
              <i class="ph-bold ph-copy"></i> Copy fixture
            </button>
          </div>
          <div class="pm-action-flags" style="margin-top: 6px;">
            <span class="pm-flag-pill" style="background: ${badgeColor}18; color: ${badgeColor}; border: 1px solid ${badgeColor}35;">
              ${escapeHtml(cat)}
            </span>
            <span style="font-size: 11px; color: var(--muted); font-family: var(--font-mono);">async ({ ${escapeHtml(a.params.join(', ') || 'page')} }, use)</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pm-btn-copy-fixture').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(btn.dataset.name);
        notify(`Đã sao chép fixture "${btn.dataset.name}" vào clipboard!`, 'success');
      });
    });
    return;
  }

  container.innerHTML = filtered.map((a) => {
    return `
      <div class="pm-action-card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="pm-action-sig">${escapeHtml(a.signature || a.name + '()')}</span>
          <button type="button" class="pm-btn-use-bdd" data-action="${escapeHtml(a.name)}" title="Chèn method này vào kịch bản BDD">
            <i class="ph-bold ph-tree-structure"></i> Dùng trong BDD
          </button>
        </div>
        <div class="pm-action-flags">
          ${a.hasCapture ? '<span class="pm-flag-pill pm-flag-capture"><i class="ph-bold ph-camera"></i> Evidence</span>' : ''}
          ${a.isNavigation ? '<span class="pm-flag-pill pm-flag-nav"><i class="ph-bold ph-compass"></i> Điều hướng</span>' : ''}
          ${a.isAssertion ? '<span class="pm-flag-pill pm-flag-assert"><i class="ph-bold ph-check-circle"></i> Assertion</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.pm-btn-use-bdd').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInsertPomActionModal(currentInspectedPage, btn.dataset.action);
    });
  });
}

async function inspectPage(relativePath, doScroll = false) {
  try {
    pageManagerMode = 'inspect';
    $('#pm-btn-inspect-mode')?.classList.add('active');
    $('#pm-btn-create-mode')?.classList.remove('active');
    $('#pm-subnav-inspect')?.classList.add('active');
    $('#pm-subnav-edit')?.classList.remove('active');
    $('#pm-subnav-create')?.classList.remove('active');
    if ($('#page-manager-create-form')) $('#page-manager-create-form').style.display = 'none';
    if ($('#page-manager-inspect-panel')) {
      $('#page-manager-inspect-panel').style.display = 'flex';
      $('#page-manager-inspect-panel').scrollTop = 0;
    }
    if ($('#pm-btn-toggle-edit')) $('#pm-btn-toggle-edit').style.display = 'inline-flex';

    const result = await request(`/api/object-repository/page?file=${encodeURIComponent(relativePath)}`);
    currentInspectedPage = result;
    currentInspectedCode = result.rawCode || '';

    // Đồng bộ dropdown select
    if ($('#page-manager-select-page')) $('#page-manager-select-page').value = relativePath;

    // Cập nhật Left Panel: Thông tin Page (Phần 01)
    const isFixture = result.platform === 'fixture' || result.resourceKind === 'fixture';
    const isFoundation = result.isBase || result.platform === 'base' || result.resourceKind === 'foundation';
    const platformLabel = isFixture ? 'Fixture Nền Tảng' : (isFoundation ? 'Lớp Nền Tảng (Core Foundation)' : (result.platform === 'mobile-web' ? 'Mobile Web' : 'Desktop Web'));
    if ($('#pm-inspect-title-text')) $('#pm-inspect-title-text').textContent = result.title ? `${result.title} (${result.className})` : result.className;
    if ($('#pm-input-title')) $('#pm-input-title').textContent = `${result.className}.js`;
    if ($('#pm-inspect-platform')) $('#pm-inspect-platform').textContent = platformLabel;
    if ($('#pm-inspect-file')) $('#pm-inspect-file').textContent = result.relativePath;
    if ($('#pm-inspect-class')) $('#pm-inspect-class').textContent = isFixture ? `${result.className}.extend({ ... })` : `${result.className}${result.baseClass && result.baseClass !== 'None' ? ` extends ${result.baseClass}` : ''}`;
    if ($('#pm-inspect-desc')) $('#pm-inspect-desc').textContent = result.desc || (isFixture ? 'Fixture quản lý Dependency Injection và vòng đời kiểm thử.' : (isFoundation ? 'Lớp cơ sở nền tảng dùng chung của toàn bộ framework.' : `Page Object quản lý tương tác trên ${result.className}.`));
    if ($('#pm-inspect-loc-count')) $('#pm-inspect-loc-count').textContent = isFixture ? '—' : (result.locators || []).length;
    if ($('#pm-locators-badge-count')) $('#pm-locators-badge-count').textContent = isFixture ? '0' : (result.locators || []).length;
    if ($('#pm-inspect-act-count')) $('#pm-inspect-act-count').textContent = (result.methods || []).length;
    if ($('#pm-actions-badge-count')) $('#pm-actions-badge-count').textContent = (result.methods || []).length;
    if ($('#pm-inspect-caps-count')) $('#pm-inspect-caps-count').textContent = isFixture ? ((result.capabilities || []).length || (result.methods || []).length) : (result.methods || []).length;

    // Cập nhật banner tag & readonly grid (chuẩn BDD Studio)
    if ($('#pm-inspect-base-tag')) $('#pm-inspect-base-tag').textContent = isFixture ? 'extends test' : `extends ${result.baseClass || 'BasePage'}`;
    if ($('#pm-grid-platform')) $('#pm-grid-platform').textContent = platformLabel;
    if ($('#pm-grid-path')) $('#pm-grid-path').textContent = result.relativePath;
    if ($('#pm-grid-base')) $('#pm-grid-base').textContent = result.baseClass || (isFixture ? 'playwright/test' : 'BasePage');
    if ($('#pm-grid-ctor')) $('#pm-grid-ctor').textContent = isFixture ? 'test.extend({ ... })' : 'constructor(page, featureName)';

    const isLockedResource = isFixture || isFoundation;
    const pmDelBtn = $('#pm-subnav-delete-btn');
    if (pmDelBtn) {
      pmDelBtn.disabled = isLockedResource;
      pmDelBtn.style.opacity = isLockedResource ? '0.35' : '1';
      pmDelBtn.title = isFixture ? 'Không thể xóa Fixture nền tảng' : (isFoundation ? 'Không thể xóa BasePage.js (lớp nền tảng dùng chung)' : 'Xóa Page Object này khỏi dự án');
    }

    const quickAddBox = document.querySelector('.pm-inline-add-box');
    const quickAddBtn = $('#pm-subnav-add-locator-btn');
    if (quickAddBox) quickAddBox.style.display = isLockedResource ? 'none' : 'block';
    if (quickAddBtn) quickAddBtn.style.display = isLockedResource ? 'none' : 'inline-flex';

    const quickActionBox = $('#pm-inline-add-action-box');
    const quickActionBtn = $('#pm-subnav-add-action-btn');
    const headActionBtn = $('#pm-btn-add-action-toggle');
    if (quickActionBox) quickActionBox.style.display = isLockedResource ? 'none' : 'block';
    if (quickActionBtn) quickActionBtn.style.display = isLockedResource ? 'none' : 'inline-flex';
    if (headActionBtn) headActionBtn.style.display = isLockedResource ? 'none' : 'inline-flex';

    // Render locators và actions
    renderInspectedLocators(result.locators || []);
    renderInspectedActions(result.methods || []);
    populateInlineActionLocators(result.locators || []);

    // Cập nhật Right Panel: Mã nguồn
    if ($('#pm-code-eyebrow')) $('#pm-code-eyebrow').textContent = 'MÃ NGUỒN HIỆN TẠI';
    if ($('#pm-code-title')) $('#pm-code-title').textContent = `${result.className}.js`;

    initPageManagerCodeEditor();
    if (window.pageManagerCodeEditor) {
      window.pageManagerCodeEditor.setValue(currentInspectedCode, { markClean: true, readOnly: true });
    } else {
      if ($('#page-manager-preview code')) $('#page-manager-preview code').innerHTML = highlightCode(currentInspectedCode);
      if ($('#page-manager-code-editor')) $('#page-manager-code-editor').value = currentInspectedCode;
    }

    const statusPill = $('#pm-code-status');
    if (statusPill) {
      statusPill.innerHTML = '<i class="ph-bold ph-check"></i> Đang mở từ disk';
      statusPill.classList.remove('modified');
    }

    // Reset về chế độ view code (không mở textarea ngay)
    pageDirectEditMode = false;
    const stage = $('#pm-code-stage');
    if (stage) stage.classList.remove('editing');
    const editor = $('#page-manager-code-editor');
    if (editor) editor.setAttribute('readonly', 'true');
    if ($('#pm-btn-save-code')) $('#pm-btn-save-code').style.display = 'none';
    if ($('#pm-btn-revert-code')) $('#pm-btn-revert-code').style.display = 'none';
    if ($('#pm-edit-btn-text')) $('#pm-edit-btn-text').textContent = 'Chỉnh sửa mã';
    if ($('#pm-code-help-text')) $('#pm-code-help-text').textContent = 'Nhấn "Chỉnh sửa mã" để gõ trực tiếp hoặc Ctrl+S để lưu file. Tự động sao lưu backup (.bak) an toàn.';

    // Đánh dấu card active ở danh sách dưới (đồng bộ cả is-selected và active)
    document.querySelectorAll('.page-manager-file-card').forEach((card) => {
      const isThis = card.dataset.path === relativePath;
      card.classList.toggle('is-selected', isThis);
      card.classList.toggle('active', isThis);
    });

    const subnavActions = document.getElementById('pm-subnav-actions');
    if (subnavActions) subnavActions.style.display = 'flex';
    if ($('#pm-subnav-save-btn')) $('#pm-subnav-save-btn').style.display = 'none';

    if (doScroll) {
      $('#page-manager-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    notify(`Không thể tải chi tiết Page Object: ${error.message}`);
  }
}

function switchToCreatePageMode() {
  pageManagerMode = 'create';
  pageDirectEditMode = false;
  $('#pm-btn-create-mode')?.classList.add('active');
  $('#pm-btn-inspect-mode')?.classList.remove('active');
  $('#pm-subnav-inspect')?.classList.remove('active');
  $('#pm-subnav-edit')?.classList.remove('active');
  $('#pm-subnav-create')?.classList.add('active');
  if ($('#pm-input-title')) $('#pm-input-title').textContent = 'Tạo Page Object mới';
  if ($('#page-manager-create-form')) $('#page-manager-create-form').style.display = 'flex';
  if ($('#page-manager-inspect-panel')) $('#page-manager-inspect-panel').style.display = 'none';
  if ($('#pm-btn-toggle-edit')) $('#pm-btn-toggle-edit').style.display = 'none';
  if ($('#pm-btn-save-code')) $('#pm-btn-save-code').style.display = 'none';
  if ($('#pm-btn-revert-code')) $('#pm-btn-revert-code').style.display = 'none';

  // Đồng bộ chuẩn BDD Studio: Ẩn các nút action trên subnav khi đang ở chế độ Tạo mới
  const subnavActions = document.getElementById('pm-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'none';

  if ($('#pm-code-eyebrow')) $('#pm-code-eyebrow').textContent = 'LIVE PREVIEW';
  if ($('#pm-code-title')) $('#pm-code-title').textContent = 'Mã framework sẽ sinh ra';
  const stage = $('#pm-code-stage');
  if (stage) stage.classList.remove('editing');
  const editor = $('#page-manager-code-editor');
  if (editor) editor.setAttribute('readonly', 'true');
  const statusPill = $('#pm-code-status');
  if (statusPill) {
    statusPill.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
    statusPill.classList.remove('modified');
  }
  if ($('#pm-code-help-text')) $('#pm-code-help-text').textContent = 'Mã nguồn Page Object được sinh realtime theo từng ô nhập. File chỉ được tạo khi bạn bấm "Tạo file Page Object".';

  document.querySelectorAll('.page-manager-file-card').forEach((card) => {
    card.classList.remove('is-selected');
    card.classList.remove('active');
  });

  renderPageManagerRows();
  updatePageManagerPreview();
  checkPageDraftOnCreateMode();
}

function toggleDirectCodeEdit(forceState) {
  if (pageManagerMode !== 'inspect' || !currentInspectedPage) return;
  pageDirectEditMode = (forceState !== undefined) ? forceState : !pageDirectEditMode;

  const stage = $('#pm-code-stage');
  const editor = $('#page-manager-code-editor');
  const preview = $('#page-manager-preview');
  const saveBtn = $('#pm-btn-save-code');
  const revertBtn = $('#pm-btn-revert-code');
  const editText = $('#pm-edit-btn-text');
  const statusPill = $('#pm-code-status');

  initPageManagerCodeEditor();

  if (pageDirectEditMode) {
    $('#pm-subnav-inspect')?.classList.remove('active');
    $('#pm-subnav-edit')?.classList.add('active');
    $('#pm-subnav-create')?.classList.remove('active');

    if (stage) stage.classList.add('editing');
    if (editor) {
      editor.removeAttribute('readonly');
      if (preview) {
        editor.scrollTop = preview.scrollTop;
        editor.scrollLeft = preview.scrollLeft;
      }
      editor.focus();
    }
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (revertBtn) {
      const isDirty = window.pageManagerCodeEditor ? window.pageManagerCodeEditor.isDirty() : false;
      revertBtn.style.display = isDirty ? 'inline-flex' : 'none';
    }
    if (editText) editText.textContent = 'Chế độ xem';
    if (statusPill) {
      statusPill.innerHTML = '<i class="ph-bold ph-pencil"></i> Chế độ chỉnh sửa';
      statusPill.classList.add('modified');
    }
  } else {
    $('#pm-subnav-inspect')?.classList.add('active');
    $('#pm-subnav-edit')?.classList.remove('active');
    $('#pm-subnav-create')?.classList.remove('active');

    if (stage) stage.classList.remove('editing');
    if (editor) {
      editor.setAttribute('readonly', 'true');
      if (preview) {
        preview.scrollTop = editor.scrollTop;
        preview.scrollLeft = editor.scrollLeft;
      }
    }
    if (saveBtn) saveBtn.style.display = 'none';
    if (revertBtn) revertBtn.style.display = 'none';
    if (editText) editText.textContent = 'Chỉnh sửa mã';
    if (statusPill) {
      const isDirty = window.pageManagerCodeEditor ? window.pageManagerCodeEditor.isDirty() : false;
      statusPill.innerHTML = isDirty ? '<i class="ph-bold ph-pencil-simple"></i> Đã thay đổi (chưa lưu)' : '<i class="ph-bold ph-check"></i> Đang mở từ disk';
      statusPill.classList.toggle('modified', isDirty);
    }
  }
}

async function saveCurrentPageCode() {
  if (!currentInspectedPage) return;
  const newContent = window.pageManagerCodeEditor ? window.pageManagerCodeEditor.getValue() : $('#page-manager-code-editor')?.value;
  if (!newContent) {
    notify('Nội dung mã nguồn không được để trống.');
    return;
  }

  const saveBtn = $('#pm-btn-save-code');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const result = await request('/api/code', {
      method: 'PUT',
      body: JSON.stringify({
        path: currentInspectedPage.relativePath,
        content: newContent,
      }),
    });

    notify(result.message || `Đã lưu file ${currentInspectedPage.className}.js thành công!`, 'success');
    if (window.pageManagerCodeEditor) {
      window.pageManagerCodeEditor.markSaved(newContent);
    }
    currentInspectedCode = newContent;
    toggleDirectCodeEdit(false);
    await inspectPage(currentInspectedPage.relativePath);
  } catch (error) {
    notify(`Không thể lưu file: ${error.message}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function copyCurrentPageManagerCode() {
  const code = window.pageManagerCodeEditor
    ? window.pageManagerCodeEditor.getValue()
    : (pageManagerMode === 'inspect' ? ($('#page-manager-code-editor')?.value || currentInspectedCode) : pageManagerCode());

  if (!code) {
    notify('Chưa có mã nguồn để sao chép.');
    return;
  }

  navigator.clipboard.writeText(code);
  notify('Đã sao chép toàn bộ mã nguồn vào clipboard!', 'success');
}

function openAddLocatorToPageModal() {
  if (!currentInspectedPage) {
    notify('Vui lòng chọn một Page Object để thêm locator.');
    return;
  }
  const box = document.querySelector('.pm-inline-add-box');
  const input = $('#pm-inline-loc-name');
  if (box) {
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.classList.add('pm-box-highlight');
    setTimeout(() => box.classList.remove('pm-box-highlight'), 1500);
  }
  if (input) input.focus();
}

function closeAddLocatorToPageModal() {
  const modal = $('#modal-add-locator-to-page');
  if (modal) modal.hidden = true;
}

async function saveAddLocatorToPage() {
  if (!currentInspectedPage) return;
  const name = $('#add-loc-name').value.trim();
  const expr = $('#add-loc-expr').value.trim();

  if (!name || !expr) {
    notify('Vui lòng nhập đầy đủ tên biến phần tử và biểu thức định vị.');
    return;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    notify('Tên biến phải bắt đầu bằng chữ cái và chỉ chứa ký tự chữ số/gạch dưới (camelCase).');
    return;
  }

  let cleanExpr = expr.replace(/;$/, '').trim();
  if (cleanExpr.startsWith('this.page.')) {
    cleanExpr = cleanExpr.replace(/^this\./, '');
  } else if (!cleanExpr.startsWith('page.') && !cleanExpr.startsWith('this.')) {
    cleanExpr = `page.${cleanExpr}`;
  }

  try {
    // Đọc mã nguồn hiện tại
    const fileRes = await request(`/api/code?path=${encodeURIComponent(currentInspectedPage.relativePath)}`);
    const originalContent = fileRes.content || '';

    // Tìm constructor và chèn thêm dòng locator
    const constructorMatch = originalContent.match(/(constructor\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*\}\s*\n|\n\s*\}\s*$)/);
    if (!constructorMatch) {
      notify('Không tìm thấy hàm constructor trong Page Object để chèn locator.');
      return;
    }

    const insertion = `\n    this.${name} = ${cleanExpr};`;
    const updatedContent = originalContent.slice(0, constructorMatch.index + constructorMatch[1].length) +
      insertion +
      originalContent.slice(constructorMatch.index + constructorMatch[1].length);

    await request('/api/code', {
      method: 'PUT',
      body: JSON.stringify({
        path: currentInspectedPage.relativePath,
        content: updatedContent,
      }),
    });

    notify(`Đã thêm phần tử "${name}" vào ${currentInspectedPage.className} thành công!`, 'success');
    closeAddLocatorToPageModal();
    await inspectPage(currentInspectedPage.relativePath);
  } catch (error) {
    notify(`Lỗi thêm locator: ${error.message}`);
  }
}

async function addInlineLocatorToPage() {
  if (!currentInspectedPage) {
    notify('Vui lòng chọn một Page Object để thêm locator.');
    return;
  }
  const nameInput = $('#pm-inline-loc-name');
  const exprInput = $('#pm-inline-loc-expr');
  const name = nameInput ? nameInput.value.trim() : '';
  const expr = exprInput ? exprInput.value.trim() : '';

  if (!name || !expr) {
    notify('Vui lòng nhập đầy đủ tên biến phần tử và biểu thức định vị (selector).');
    return;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    notify('Tên biến phải bắt đầu bằng chữ cái và theo chuẩn camelCase.');
    return;
  }

  let cleanExpr = expr.replace(/;$/, '').trim();
  if (cleanExpr.startsWith('this.page.')) {
    cleanExpr = cleanExpr.replace(/^this\./, '');
  } else if (!cleanExpr.startsWith('page.') && !cleanExpr.startsWith('this.')) {
    cleanExpr = `page.${cleanExpr}`;
  }

  try {
    const fileRes = await request(`/api/code?path=${encodeURIComponent(currentInspectedPage.relativePath)}`);
    const originalContent = fileRes.content || '';
    const constructorMatch = originalContent.match(/(constructor\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*\}\s*\n|\n\s*\}\s*$)/);
    if (!constructorMatch) {
      notify('Không tìm thấy hàm constructor trong Page Object để chèn locator.');
      return;
    }

    const insertion = `\n    this.${name} = ${cleanExpr};`;
    const updatedContent = originalContent.slice(0, constructorMatch.index + constructorMatch[1].length) +
      insertion +
      originalContent.slice(constructorMatch.index + constructorMatch[1].length);

    await request('/api/code', {
      method: 'PUT',
      body: JSON.stringify({
        path: currentInspectedPage.relativePath,
        content: updatedContent,
      }),
    });

    notify(`Đã thêm phần tử "this.${name}" vào ${currentInspectedPage.className} thành công!`, 'success');
    if (nameInput) nameInput.value = '';
    if (exprInput) exprInput.value = '';
    await inspectPage(currentInspectedPage.relativePath);
  } catch (error) {
    notify(`Lỗi thêm locator: ${error.message}`);
  }
}

function populateInlineActionLocators(locators = []) {
  const select = $('#pm-inline-act-loc');
  if (!select) return;
  if (!locators || locators.length === 0) {
    select.innerHTML = '<option value="">-- Chọn locator liên kết (chưa có) --</option>';
    return;
  }
  select.innerHTML = '<option value="">-- Chọn locator liên kết --</option>' +
    locators.map((l) => `<option value="${escapeHtml(l.name)}">this.${escapeHtml(l.name)}</option>`).join('');
}

function focusAddActionInput() {
  const box = $('#pm-inline-add-action-box');
  const input = $('#pm-inline-act-name');
  if (box) {
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.classList.add('pm-box-highlight');
    setTimeout(() => box.classList.remove('pm-box-highlight'), 1500);
  }
  if (input) input.focus();
}

async function addInlineActionToPage() {
  if (!currentInspectedPage) {
    notify('Vui lòng chọn một Page Object để thêm action.');
    return;
  }
  const nameInput = $('#pm-inline-act-name');
  const locSelect = $('#pm-inline-act-loc');
  const opSelect = $('#pm-inline-act-op');

  let name = nameInput ? nameInput.value.trim() : '';
  const locName = locSelect ? locSelect.value.trim() : '';
  const op = opSelect ? opSelect.value : 'click';

  if (!name) {
    if (locName) {
      const cleanLoc = locName.replace(/^this\./, '').replace(/^btn|^button/i, '');
      const capitalized = cleanLoc.charAt(0).toUpperCase() + cleanLoc.slice(1);
      if (op === 'click') name = `click${capitalized}`;
      else if (op === 'fill') name = `input${capitalized}`;
      else if (op === 'check') name = `check${capitalized}`;
      else if (op === 'hover') name = `hover${capitalized}`;
      else if (op === 'assert') name = `expect${capitalized}Visible`;
    } else {
      notify('Vui lòng nhập tên hàm action (ví dụ: clickSubmit, inputSearch).');
      nameInput?.focus();
      return;
    }
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    notify('Tên hàm phải bắt đầu bằng chữ cái và theo chuẩn camelCase.');
    nameInput?.focus();
    return;
  }

  const existingMethods = (currentInspectedPage.methods || []).map((m) => typeof m === 'string' ? m : m.name);
  if (existingMethods.includes(name)) {
    notify(`Hàm "${name}" đã tồn tại trong ${currentInspectedPage.className}.js.`);
    nameInput?.focus();
    return;
  }

  let methodBody = '';
  const targetLoc = locName ? `this.${locName.replace(/^this\./, '')}` : 'this.page';
  if (op === 'fill') {
    methodBody = `    await this.clickElement(${targetLoc});\n    await ${targetLoc}.fill(value);`;
  } else if (op === 'check') {
    methodBody = `    await ${targetLoc}.check();`;
  } else if (op === 'hover') {
    methodBody = `    await ${targetLoc}.hover();`;
  } else if (op === 'assert') {
    methodBody = `    await expect(${targetLoc}).toBeVisible();`;
  } else {
    methodBody = `    await this.clickElement(${targetLoc});`;
  }

  const paramStr = op === 'fill' ? 'value' : '';
  const methodCode = `\n  async ${name}(${paramStr}) {\n${methodBody}\n  }\n`;

  try {
    const fileRes = await request(`/api/code?path=${encodeURIComponent(currentInspectedPage.relativePath)}`);
    const originalContent = fileRes.content || '';

    const match = originalContent.match(/(\n\s*\}\s*)(?:\n\s*module\.exports|\s*$)/);
    if (!match) {
      notify('Không tìm thấy vị trí thích hợp trong class để chèn action.');
      return;
    }

    const insertIdx = match.index;
    const updatedContent = originalContent.slice(0, insertIdx) + methodCode + originalContent.slice(insertIdx);

    await request('/api/code', {
      method: 'PUT',
      body: JSON.stringify({
        path: currentInspectedPage.relativePath,
        content: updatedContent,
      }),
    });

    notify(`Đã thêm action "${name}()" vào ${currentInspectedPage.className} thành công!`, 'success');
    if (nameInput) nameInput.value = '';
    await inspectPage(currentInspectedPage.relativePath);
  } catch (error) {
    notify(`Lỗi thêm action: ${error.message}`);
  }
}

function renderPageManagerFiles() {
  const container = $('#page-manager-existing-list');
  if (!container) return;

  const searchQuery = ($('#pm-filter-input')?.value || '').toLowerCase().trim();

  // Tương thích: Nếu phiên cũ lưu filter 'fixture', tự động chuyển về 'all'
  if (existingPageFilter === 'fixture') existingPageFilter = 'all';

  const filtered = repoPages.filter((page) => {
    if (existingPageFilter !== 'all') {
      if (existingPageFilter === 'base') {
        if (!page.isBase && page.platform !== 'base' && page.relativePath !== 'pages/BasePage.js') return false;
      } else if (page.platform !== existingPageFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const matchName = (page.className || '').toLowerCase().includes(searchQuery);
      const matchPath = (page.relativePath || '').toLowerCase().includes(searchQuery);
      const matchTitle = (page.title || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchPath && !matchTitle) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-resource" style="grid-column:1/-1;">Không có Page Object nào phù hợp với bộ lọc.</p>';
    return;
  }

  container.innerHTML = filtered.map((page) => {
    const isCurrent = currentInspectedPage && currentInspectedPage.relativePath === page.relativePath;
    const isBase = page.relativePath === 'pages/BasePage.js' || page.isBase || page.platform === 'base';
    const platformLabel = isBase ? 'Nền tảng (Core)' : (page.platform === 'mobile-web' ? 'Mobile' : 'Desktop');
    const platformClass = isBase ? 'setup' : (page.platform === 'mobile-web' ? 'mobile' : 'desktop');
    const platformIcon = isBase ? 'ph-shield-check' : (page.icon || (page.platform === 'mobile-web' ? 'ph-device-mobile' : 'ph-browsers'));

    return `
      <div class="dashboard-list-card page-manager-file-card script-card-item ${isCurrent ? 'is-selected active' : ''}" data-path="${escapeHtml(page.relativePath)}">
        <span class="dashboard-list-card__icon script-card-platform-icon ${platformClass}"><i class="ph-bold ${platformIcon}"></i></span>
        <div class="dashboard-list-card__body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
            <div class="script-card-title">${escapeHtml(page.title || page.className)}</div>
            ${!isBase ? `
            <button type="button" class="btn-icon-subtle item-delete-hover-btn pm-page-delete-btn" data-path="${escapeHtml(page.relativePath)}" title="Xóa Page Object" style="padding: 2px; font-size: 14px; flex-shrink: 0;">
              <i class="ph ph-trash"></i>
            </button>` : ''}
          </div>
          <div class="script-card-file">
            <i class="ph ph-file-js"></i> ${escapeHtml(page.relativePath)}
          </div>
          <div class="script-card-pills">
            <span class="script-card-badge-platform ${platformClass}">
              <i class="ph ${platformIcon}"></i> ${platformLabel}
            </span>
            <span class="script-card-badge-pages">
              <i class="ph ph-crosshair"></i> ${page.locatorCount || 0} Locators
            </span>
            <span class="script-card-badge-data" title="${page.methodCount || 0} Actions">
              <i class="ph ph-lightning"></i> ${page.methodCount || 0} Actions
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.page-manager-file-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.pm-page-delete-btn')) return;
      inspectPage(card.dataset.path, true);
    });
  });

  container.querySelectorAll('.pm-page-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pagePath = btn.dataset.path;
      inspectPage(pagePath, true).then(() => {
        handleDeleteCurrentPage();
      });
    });
  });
}

function populatePageSelectorDropdown() {
  const select = $('#page-manager-select-page');
  if (!select) return;

  const desktopPages = repoPages.filter((p) => p.platform === 'desktop');
  const mobilePages = repoPages.filter((p) => p.platform === 'mobile-web');
  const basePages = repoPages.filter((p) => p.platform === 'base');
  const fixturePages = repoPages.filter((p) => p.platform === 'fixture');

  let html = '<option value="" disabled>-- Chọn Page Object để xem song song --</option>';

  if (desktopPages.length > 0) {
    html += '<optgroup label="Desktop Web">';
    desktopPages.forEach((p) => {
      html += `<option value="${escapeHtml(p.relativePath)}">${escapeHtml(p.className)}.js (${p.locatorCount || 0} locators)</option>`;
    });
    html += '</optgroup>';
  }

  if (mobilePages.length > 0) {
    html += '<optgroup label="Mobile Web">';
    mobilePages.forEach((p) => {
      html += `<option value="${escapeHtml(p.relativePath)}">${escapeHtml(p.className)}.js (${p.locatorCount || 0} locators)</option>`;
    });
    html += '</optgroup>';
  }

  if (basePages.length > 0) {
    html += '<optgroup label="Trang cơ sở">';
    basePages.forEach((p) => {
      html += `<option value="${escapeHtml(p.relativePath)}">${escapeHtml(p.className)}.js</option>`;
    });
    html += '</optgroup>';
  }

  if (fixturePages.length > 0) {
    html += '<optgroup label="Fixture Nền Tảng">';
    fixturePages.forEach((p) => {
      html += `<option value="${escapeHtml(p.relativePath)}">${escapeHtml(p.className)}.js (${p.methodCount || 0} fixtures)</option>`;
    });
    html += '</optgroup>';
  }

  select.innerHTML = html;
}

async function openPageManager() {
  pageManagerLocators = [];
  pageManagerActions = [];
  initPageManagerCodeEditor();
  // Đảm bảo filter mặc định (Desktop) luôn được kích hoạt đồng bộ
  if (!existingPageFilter) existingPageFilter = 'desktop';
  const pmPills = document.querySelectorAll('#pm-sidebar .pm-filter-pill');
  if (pmPills.length > 0) {
    pmPills.forEach((p) => p.classList.toggle('active', (p.dataset.platform || 'desktop') === existingPageFilter));
  }
  try {
    const result = await request('/api/object-repository/pages');
    repoPages = result.pages || [];

    // Cập nhật thống kê header
    const desktopCount = repoPages.filter((p) => p.platform === 'desktop').length;
    const mobileCount = repoPages.filter((p) => p.platform === 'mobile-web').length;
    if ($('#pm-stat-total')) $('#pm-stat-total').textContent = repoPages.length;
    if ($('#pm-stat-desktop')) $('#pm-stat-desktop').textContent = desktopCount;
    if ($('#pm-stat-mobile')) $('#pm-stat-mobile').textContent = mobileCount;
    if ($('#pm-total-pages-count')) $('#pm-total-pages-count').textContent = repoPages.length;
    if ($('#pm-rail-count')) $('#pm-rail-count').textContent = repoPages.length;

    populatePageSelectorDropdown();
    renderPageManagerFiles();

    // Nếu đang ở inspect mode hoặc chưa chọn page nào -> mở trang đầu tiên (ưu tiên desktop)
    if (pageManagerMode === 'inspect') {
      const defaultPage = (currentInspectedPage && repoPages.some((p) => p.relativePath === currentInspectedPage.relativePath))
        ? currentInspectedPage.relativePath
        : (repoPages.find((p) => p.relativePath.includes('HomePage.js'))?.relativePath || repoPages[0]?.relativePath);

      if (defaultPage) {
        await inspectPage(defaultPage, false);
      }
    } else {
      switchToCreatePageMode();
    }
  } catch (error) {
    notify(`Không thể tải danh sách Page Object: ${error.message}`);
  }
}

async function createPageFromManager() {
  syncPageManagerState();
  const title = $('#page-manager-title').value.trim();
  const className = $('#page-manager-class').value.trim();
  if (!title || !className) { notify('Vui lòng nhập tên màn hình và tên class.'); return; }
  const button = $('#page-manager-create');
  button.disabled = true;
  try {
    const result = await request('/api/object-repository/create-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: $('#page-manager-platform').value,
        title,
        className,
        description: $('#page-manager-description').value,
        locators: pageManagerLocators,
        actions: pageManagerActions,
        draftId: activePageDraftId,
      }),
    });
    notify(result.message, 'success');
    await clearPageDraft(true);
    await openPageManager();
    if (result.relativePath) {
      await inspectPage(result.relativePath, true);
    }
    // Tự động gắn Page Object mới vào bản nháp BDD script nếu đang có draft
    try {
      const rawDraft = localStorage.getItem(BDD_WIZARD_DRAFT_KEY);
      if (rawDraft) {
        const draftObj = JSON.parse(rawDraft);
        if (draftObj && Array.isArray(draftObj.selectedPoms)) {
          if (!draftObj.selectedPoms.includes(result.relativePath)) {
            draftObj.selectedPoms.push(result.relativePath);
          }
          if (!draftObj.primaryPage) {
            draftObj.primaryPage = result.relativePath;
          }
          localStorage.setItem(BDD_WIZARD_DRAFT_KEY, JSON.stringify(draftObj));
          saveWizardDraft(true);
          showToast('Đã thêm Page Object mới vào bản nháp kịch bản BDD. Bạn có thể quay lại tab "Kịch bản test (BDD)" để tiếp tục.', 'success');
        }
      }
    } catch (e) {}
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
}

function openPageStudio() {
  pageStudioLocators = [];
  pageStudioActions = [];
  $('#new-page-platform').value = activeRepoCategory === 'mobile-web' ? 'mobile-web' : 'desktop';
  $('#new-page-title').value = '';
  $('#new-page-class').value = '';
  $('#new-page-description').value = '';
  renderPageStudioRows();
  updatePageStudioPreview();
  $('#modal-create-page').showModal();
  $('#new-page-title').focus();
}

async function createPageFromStudio(event) {
  event.preventDefault();
  syncPageStudioState();
  const submit = $('#create-page-submit');
  submit.disabled = true;
  try {
    const result = await request('/api/object-repository/create-page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: $('#new-page-platform').value,
        title: $('#new-page-title').value,
        className: $('#new-page-class').value,
        description: $('#new-page-description').value,
        locators: pageStudioLocators,
        actions: pageStudioActions,
      }),
    });
    $('#modal-create-page').close();
    notify(`${result.message}. Hãy mở BDD Studio để dùng Page Object mới.`);
    selectedRepoPage = null;
    await loadObjectRepository();
  } catch (error) {
    notify(error.message);
  } finally {
    submit.disabled = false;
  }
}

function initObjectRepository() {
  if (objectRepoInitialized) return;
  objectRepoInitialized = true;

  // Mode Switcher
  $('#btn-switch-visual-mode')?.addEventListener('click', () => setCodeViewMode('visual'));
  $('#btn-switch-raw-mode')?.addEventListener('click', () => setCodeViewMode('raw'));
  $('#btn-return-to-visual')?.addEventListener('click', () => setCodeViewMode('visual'));

  // Category Tabs
  document.querySelectorAll('.repo-cat-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.repo-cat-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeRepoCategory = tab.dataset.cat;
      if (activeRepoCategory === 'core') {
        openCoreCapabilitiesView();
      } else {
        renderRepoPagesList();
        if (repoPages.length > 0) {
          const match = repoPages.find((p) => activeRepoCategory === 'all' || p.platform === activeRepoCategory);
          if (match) selectRepoPage(match);
        }
      }
    });
  });

  // Search Input
  $('#repo-search-input')?.addEventListener('input', () => {
    renderRepoPagesList();
  });

  // Subnav Tabs (Locators vs Actions)
  document.querySelectorAll('.repo-subnav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.repo-subnav-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.sub;
      $('#repo-locators-pane').hidden = target !== 'locators';
      $('#repo-actions-pane').hidden = target !== 'actions';
    });
  });

  // Type Filter Chips for Locators
  document.querySelectorAll('.repo-type-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.repo-type-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeRepoTypeFilter = chip.dataset.type;
      renderLocatorsTable();
    });
  });

  // Jump to raw code button
  $('#repo-jump-to-code-btn')?.addEventListener('click', async () => {
    if (!selectedRepoPage) return;
    setCodeViewMode('raw');
    await loadCodeFile(selectedRepoPage.relativePath);
  });

  // Modal event listeners
  $('#btn-close-locator-modal')?.addEventListener('click', closeLocatorEditModal);
  $('#btn-cancel-locator-edit')?.addEventListener('click', closeLocatorEditModal);
  $('#btn-save-locator-edit')?.addEventListener('click', saveLocatorEdit);
  $('#repo-add-page-button')?.addEventListener('click', openPageStudio);
  $('#new-page-add-locator')?.addEventListener('click', () => { pageStudioLocators.push({ name: '', expression: '' }); renderPageStudioRows(); updatePageStudioPreview(); });
  $('#new-page-add-action')?.addEventListener('click', () => { pageStudioActions.push({ name: '', locatorName: pageStudioLocators[0]?.name || '', operation: 'click' }); renderPageStudioRows(); updatePageStudioPreview(); });
  $('#form-create-page')?.addEventListener('submit', createPageFromStudio);
  $('#close-create-page')?.addEventListener('click', () => $('#modal-create-page').close());
  $('#cancel-create-page')?.addEventListener('click', () => $('#modal-create-page').close());
  ['#new-page-title', '#new-page-class', '#new-page-description'].forEach((selector) => $(selector)?.addEventListener('input', updatePageStudioPreview));
}

function setCodeViewMode(mode) {
  activeCodeMode = mode;
  $('#btn-switch-visual-mode')?.classList.toggle('active', mode === 'visual');
  $('#btn-switch-raw-mode')?.classList.toggle('active', mode === 'raw');
  $('#btn-switch-visual-mode')?.setAttribute('aria-selected', mode === 'visual' ? 'true' : 'false');
  $('#btn-switch-raw-mode')?.setAttribute('aria-selected', mode === 'raw' ? 'true' : 'false');

  const headerBadge = $('#code-header-badge');
  if (headerBadge) {
    headerBadge.innerHTML = mode === 'visual'
      ? '<i class="ph-bold ph-tree-structure"></i> Đối tượng &amp; Selector'
      : '<i class="ph-bold ph-code-block"></i> Trình sửa mã JS';
  }

  $('#code-visual-container').hidden = mode !== 'visual';
  $('#code-raw-container').hidden = mode !== 'raw';

  if (mode === 'visual') {
    loadObjectRepository();
  } else {
    request('/api/code-files').then((res) => {
      codeFiles = res.files;
      $('#code-file-count').textContent = `${codeFiles.length} tệp`;
      renderCodeTree();
    }).catch((e) => notify(e.message));
  }
}

async function loadObjectRepository() {
  initObjectRepository();
  try {
    const [pagesRes, capsRes] = await Promise.all([
      request('/api/object-repository/pages'),
      request('/api/core/capabilities'),
    ]);

    repoPages = pagesRes.pages || [];
    repoCapabilities = capsRes.capabilities || [];

    // Update count badges
    const desktopCount = repoPages.filter((p) => p.platform === 'desktop').length;
    const mobileCount = repoPages.filter((p) => p.platform === 'mobile-web').length;
    if ($('#repo-total-count')) $('#repo-total-count').textContent = `${repoPages.length} màn hình`;
    if ($('#count-repo-all')) $('#count-repo-all').textContent = repoPages.length;
    if ($('#count-repo-desktop')) $('#count-repo-desktop').textContent = desktopCount;
    if ($('#count-repo-mobile')) $('#count-repo-mobile').textContent = mobileCount;

    renderRepoPagesList();

    if (activeRepoCategory === 'core') {
      openCoreCapabilitiesView();
    } else {
      const targetPage = selectedRepoPage ? repoPages.find((p) => p.className === selectedRepoPage.className) : repoPages[0];
      if (targetPage) {
        selectRepoPage(targetPage);
      }
    }
  } catch (error) {
    notify(`Lỗi nạp Kho phần tử: ${error.message}`);
  }
}

function renderRepoPagesList() {
  const query = $('#repo-search-input')?.value.trim().toLowerCase() || '';
  const filtered = repoPages.filter((p) => {
    const matchesCat = activeRepoCategory === 'all' || p.platform === activeRepoCategory;
    const matchesQuery = !query || 
      p.className.toLowerCase().includes(query) || 
      p.title.toLowerCase().includes(query) ||
      p.locators.some((l) => l.name.toLowerCase().includes(query) || l.expression.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  const listEl = $('#repo-pages-list');
  if (!listEl) return;

  const contextTitle = $('#repo-context-title');
  const contextDescription = $('#repo-context-description');
  const contextByCategory = {
    all: ['pages/', 'Tất cả Page Object trong framework'],
    desktop: ['pages/desktop/', 'Page Object cho Desktop Web'],
    'mobile-web': ['pages/mobile-web/', 'Page Object cho Mobile Web'],
  };
  const [contextPath, contextText] = contextByCategory[activeRepoCategory] || ['core/', 'Năng lực dùng chung của framework'];
  if (contextTitle) contextTitle.textContent = contextPath;
  if (contextDescription) contextDescription.textContent = contextText;
  const addPageButton = $('#repo-add-page-button');
  if (addPageButton) {
    addPageButton.disabled = activeRepoCategory === 'core';
    addPageButton.title = activeRepoCategory === 'core' ? 'Chọn Desktop hoặc Mobile để tạo Page Object' : 'Tạo Page Object mới';
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<p style="padding:16px; color:var(--muted); font-size:12.5px; text-align:center;">Không tìm thấy màn hình nào phù hợp.</p>';
    return;
  }

  listEl.innerHTML = filtered.map((p) => {
    const isActive = selectedRepoPage?.className === p.className;
    return `
      <div class="repo-page-card ${isActive ? 'active' : ''}" data-class="${escapeHtml(p.className)}">
        <div class="repo-page-card-icon">
          <i class="ph-bold ${p.icon || 'ph-browsers'}"></i>
        </div>
        <div class="repo-page-card-info">
          <div class="repo-page-card-title">${escapeHtml(p.title)}</div>
          <div class="repo-page-card-file">${escapeHtml(p.className)}.js</div>
          <div class="repo-page-card-badges">
            <span class="repo-page-badge" style="background:${p.platform === 'desktop' ? 'rgba(37,99,235,0.08)' : 'rgba(16,185,129,0.08)'}; color:${p.platform === 'desktop' ? '#2563eb' : '#10b981'}; font-weight:600;">
              ${p.platform === 'desktop' ? 'Desktop' : (p.platform === 'base' ? 'Base' : 'Mobile')}
            </span>
            <span class="repo-page-badge">${p.locatorCount} locators</span>
            <span class="repo-page-badge">${p.methodCount} actions</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.repo-page-card').forEach((card) => {
    card.addEventListener('click', () => {
      const cls = card.dataset.class;
      const page = repoPages.find((p) => p.className === cls);
      if (page) selectRepoPage(page);
    });
  });
}

function selectRepoPage(page) {
  selectedRepoPage = page;
  if ($('#repo-page-view')) $('#repo-page-view').hidden = false;
  if ($('#repo-core-view')) $('#repo-core-view').hidden = true;

  // Highlight in sidebar
  document.querySelectorAll('.repo-page-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.class === page.className);
  });

  // Populate Banner
  if ($('#repo-banner-icon')) $('#repo-banner-icon').innerHTML = `<i class="ph-bold ${page.icon || 'ph-browsers'}"></i>`;
  if ($('#repo-banner-platform')) $('#repo-banner-platform').textContent = page.platform === 'desktop' ? 'Desktop Web' : (page.platform === 'base' ? 'Base Architecture' : 'Mobile Web');
  if ($('#repo-banner-class')) $('#repo-banner-class').textContent = `${page.className}.js`;
  if ($('#repo-banner-base')) $('#repo-banner-base').textContent = page.baseClass !== 'None' ? `extends ${page.baseClass}` : '';
  if ($('#repo-banner-title')) $('#repo-banner-title').textContent = page.title;
  if ($('#repo-banner-desc')) $('#repo-banner-desc').textContent = page.desc;

  // Counts in subnav
  if ($('#repo-sub-loc-count')) $('#repo-sub-loc-count').textContent = page.locators.length;
  if ($('#repo-sub-act-count')) $('#repo-sub-act-count').textContent = page.methods.length;

  // Render Locators Table & Actions Grid
  renderLocatorsTable();
  renderActionsGrid();
}

function renderLocatorsTable() {
  if (!selectedRepoPage) return;
  const locators = selectedRepoPage.locators || [];

  // Update type counts
  const counts = { all: locators.length, button: 0, input: 0, link: 0, modal: 0, other: 0 };
  locators.forEach((l) => {
    if (counts[l.category] !== undefined) counts[l.category]++;
    else counts.other++;
  });

  if ($('#type-count-all')) $('#type-count-all').textContent = counts.all;
  if ($('#type-count-button')) $('#type-count-button').textContent = counts.button;
  if ($('#type-count-input')) $('#type-count-input').textContent = counts.input;
  if ($('#type-count-link')) $('#type-count-link').textContent = counts.link;
  if ($('#type-count-modal')) $('#type-count-modal').textContent = counts.modal;
  if ($('#type-count-other')) $('#type-count-other').textContent = counts.other;

  // Filter
  const filtered = locators.filter((l) => {
    if (activeRepoTypeFilter === 'all') return true;
    if (activeRepoTypeFilter === 'other') return !['button', 'input', 'link', 'modal'].includes(l.category);
    return l.category === activeRepoTypeFilter;
  });

  const tbody = $('#repo-locator-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--muted);">Chưa có phần tử nào trong nhóm này.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((l) => {
    return `
      <tr>
        <td>
          <span class="repo-element-tag" style="background:rgba(37,99,235,0.08); color:${l.badgeColor || 'var(--text)'};">
            <i class="${l.categoryIcon}"></i> ${escapeHtml(l.categoryLabel)}
          </span>
        </td>
        <td>
          <strong style="font-family:var(--font-mono); font-size:12.5px; color:var(--text);">${escapeHtml(l.name)}</strong>
        </td>
        <td style="color:var(--muted); font-size:12.5px;">
          ${escapeHtml(l.description || '')}
        </td>
        <td>
          <span class="repo-expr-code">${escapeHtml(l.expression)}</span>
        </td>
        <td style="text-align:center;">
          <button type="button" class="btn-edit-locator" data-name="${escapeHtml(l.name)}" data-expr="${escapeHtml(l.expression)}">
            <i class="ph-bold ph-pencil-simple"></i> Sửa
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-edit-locator').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const expr = btn.dataset.expr;
      openLocatorEditModal(name, expr);
    });
  });
}

function renderActionsGrid() {
  if (!selectedRepoPage) return;
  const actions = selectedRepoPage.methods || [];
  const grid = $('#repo-actions-grid');
  if (!grid) return;

  if (actions.length === 0) {
    grid.innerHTML = '<p style="padding:24px; color:var(--muted); text-align:center; grid-column:1/-1;">Trang này chưa định nghĩa hành động nghiệp vụ riêng.</p>';
    return;
  }

  grid.innerHTML = actions.map((act) => {
    return `
      <div class="repo-action-card">
        <div class="repo-action-sig">${escapeHtml(act.signature)}</div>
        <div class="repo-action-flags">
          ${act.hasCapture ? '<span class="repo-flag-pill repo-flag-capture"><i class="ph-bold ph-camera"></i> Có chụp Evidence</span>' : ''}
          ${act.isNavigation ? '<span class="repo-flag-pill repo-flag-nav"><i class="ph-bold ph-compass"></i> Điều hướng URL</span>' : ''}
          ${act.isAssertion ? '<span class="repo-flag-pill repo-flag-assert"><i class="ph-bold ph-check-circle"></i> Có Assertion</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openCoreCapabilitiesView() {
  if ($('#repo-page-view')) $('#repo-page-view').hidden = true;
  if ($('#repo-core-view')) $('#repo-core-view').hidden = false;
  const addPageButton = $('#repo-add-page-button');
  if (addPageButton) {
    addPageButton.disabled = true;
    addPageButton.title = 'Chọn Desktop hoặc Mobile để tạo Page Object';
  }

  document.querySelectorAll('.repo-page-card').forEach((c) => c.classList.remove('active'));

  const grid = $('#repo-capabilities-grid');
  if (!grid) return;

  grid.innerHTML = repoCapabilities.map((cap) => {
    return `
      <div class="repo-capability-card" style="--cap-color: ${cap.color};">
        <div class="repo-capability-accent"></div>
        <div class="repo-capability-header">
          <div class="repo-capability-icon">
            <i class="ph-bold ${cap.icon}"></i>
          </div>
          <div>
            <h3 class="repo-capability-title">${escapeHtml(cap.title)}</h3>
          </div>
        </div>
        <p class="repo-capability-desc">${escapeHtml(cap.desc)}</p>
        <div class="repo-capability-tags">
          ${(cap.tags || []).map((t) => `<span class="repo-capability-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="repo-capability-footer">
          <span class="repo-capability-status">
            <i class="ph-bold ph-check-circle"></i> ${escapeHtml(cap.status)}
          </span>
          <button type="button" class="repo-capability-link" data-jump="${escapeHtml(cap.linkTab)}">
            ${escapeHtml(cap.linkLabel)} <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.repo-capability-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.jump;
      if (tabName) {
        const tabBtn = document.querySelector(`.view-tab[data-view="${tabName}"]`);
        if (tabBtn) tabBtn.click();
      }
    });
  });
}

function openLocatorEditModal(name, expr, pageRelativePath) {
  const targetPath = pageRelativePath || selectedRepoPage?.relativePath || currentInspectedPage?.relativePath;
  if (!targetPath) return;
  currentEditingLocator = { name, pageRelativePath: targetPath };

  $('#edit-loc-name').value = name;
  $('#edit-loc-page').value = targetPath;
  $('#edit-loc-expr').value = expr;
  $('#modal-edit-locator').hidden = false;
}

function closeLocatorEditModal() {
  $('#modal-edit-locator').hidden = true;
  currentEditingLocator = null;
}

async function saveLocatorEdit() {
  if (!currentEditingLocator) return;
  const newExpr = $('#edit-loc-expr').value.trim();
  if (!newExpr) {
    notify('Vui lòng nhập biểu thức định vị (Selector expression).');
    return;
  }

  try {
    const res = await request('/api/object-repository/update-locator', {
      method: 'POST',
      body: JSON.stringify({
        pageRelativePath: currentEditingLocator.pageRelativePath,
        locatorName: currentEditingLocator.name,
        newExpression: newExpr,
      }),
    });

    notify(res.message || 'Đã cập nhật selector thành công!', 'success');
    closeLocatorEditModal();

    // Re-fetch page details
    const updatedPage = await request(`/api/object-repository/page?file=${encodeURIComponent(currentEditingLocator.pageRelativePath)}`);
    const idx = repoPages.findIndex((p) => p.relativePath === currentEditingLocator.pageRelativePath);
    if (idx !== -1) repoPages[idx] = updatedPage;
    if (selectedRepoPage && selectedRepoPage.relativePath === currentEditingLocator.pageRelativePath) {
      selectRepoPage(updatedPage);
    }
    if (currentInspectedPage && currentInspectedPage.relativePath === currentEditingLocator.pageRelativePath) {
      await inspectPage(currentEditingLocator.pageRelativePath);
    }
  } catch (error) {
    notify(`Lỗi cập nhật selector: ${error.message}`);
  }
}

async function openCodeWorkspace() {
  if (activeCodeMode === 'visual') {
    await loadObjectRepository();
  } else {
    try {
      const result = await request('/api/code-files');
      codeFiles = result.files;
      $('#code-file-count').textContent = `${codeFiles.length} tệp`;
      renderCodeTree();
    } catch (error) { notify(error.message); }
  }
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
    $('#code-language').textContent = getCodeLanguageLabel(getCodeLanguage(filePath));
    $('#code-editor').value = source.content;
    $('#code-preview code').innerHTML = highlightCode(source.content, getCodeLanguage(filePath));
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

const CODE_LANGUAGE_REGISTRY = Object.freeze({
  js: 'javascript', spec: 'javascript', json: 'json', html: 'markup', htm: 'markup', css: 'css', md: 'markdown',
});

function getCodeLanguage(filePath = '') {
  const extension = String(filePath).toLowerCase().split('.').pop();
  return CODE_LANGUAGE_REGISTRY[extension] || 'plaintext';
}

function getCodeLanguageLabel(language) {
  return ({ javascript: 'JAVASCRIPT', json: 'JSON', markup: 'HTML', css: 'CSS', markdown: 'MARKDOWN', plaintext: 'TEXT' })[language] || 'TEXT';
}

function highlightCode(content, languageOrJson = 'javascript') {
  if (!content) return '';
  const language = typeof languageOrJson === 'boolean'
    ? (languageOrJson ? 'json' : 'javascript')
    : languageOrJson;
  if (typeof Prism !== 'undefined' && Prism.languages) {
    try {
      const grammar = Prism.languages[language];
      if (grammar) {
        return Prism.highlight(content, grammar, language);
      }
    } catch (e) {}
  }
  if (!['javascript', 'json'].includes(language)) return escapeHtml(content);
  const isJson = language === 'json';
  const pattern = isJson
    ? /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(const|let|var|class|extends|new|function|async|await|return|if|else|for|while|try|catch|throw|require|module|exports|this|super|import|from|export|default|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g;
  let html = '';
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    html += escapeHtml(content.slice(cursor, match.index));
    const token = match[0];
    let type = 'number';
    if (isJson) {
      if (match[1]) type = 'property';
      else if (match[2]) type = 'string';
      else if (match[3]) type = 'keyword';
      else type = 'number';
    } else {
      type = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'keyword' : 'number';
    }
    html += `<span class="syntax-${type}">${escapeHtml(token)}</span>`;
    cursor = match.index + token.length;
  }
  return html + escapeHtml(content.slice(cursor));
}

function formatJavaScriptCode(code) {
  if (!code || typeof code !== 'string') return code || '';

  const rawLines = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const formattedLines = [];
  let indentLevel = 0;
  const indentSize = 2;
  let inBlockComment = false;
  let inTemplateLiteral = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // 1. Preserve single blank line (collapse consecutive blanks)
    if (!trimmed) {
      if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
        formattedLines.push('');
      }
      continue;
    }

    // 2. Multiline block comments
    if (inBlockComment) {
      formattedLines.push(' '.repeat(Math.max(0, indentLevel * indentSize)) + trimmed);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
      inBlockComment = true;
      formattedLines.push(' '.repeat(Math.max(0, indentLevel * indentSize)) + trimmed);
      continue;
    }

    // 3. Multiline template literals
    if (inTemplateLiteral) {
      formattedLines.push(rawLine);
      const backticks = (rawLine.match(/(?<!\\)`/g) || []).length;
      if (backticks % 2 === 1) inTemplateLiteral = false;
      continue;
    }

    // 4. Determine closing tokens at start of line
    let closuresAtStart = 0;
    const startClosureMatch = trimmed.match(/^([}\]\)])+/);
    if (startClosureMatch) {
      closuresAtStart = startClosureMatch[1].length;
      if (/^\}\s*\)\s*[;,]?$/.test(trimmed) || /^\}\s*\]\s*[;,]?$/.test(trimmed)) {
        closuresAtStart = 1;
      }
    } else if (/^(?:else|catch|finally)\b/.test(trimmed)) {
      closuresAtStart = 1;
    }

    const currentIndent = Math.max(0, (indentLevel - closuresAtStart) * indentSize);
    formattedLines.push(' '.repeat(currentIndent) + trimmed);

    // 5. Calculate indentation delta for next line
    let netBlockDelta = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;

    for (let c = 0; c < trimmed.length; c++) {
      const char = trimmed[c];
      const prev = c > 0 ? trimmed[c - 1] : '';

      if (char === '/' && trimmed[c + 1] === '/' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
        break;
      }
      if (char === "'" && prev !== '\\' && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && prev !== '\\' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === '`' && prev !== '\\' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (char === '{' || char === '[') {
          netBlockDelta++;
        } else if (char === '}' || char === ']') {
          netBlockDelta--;
        }
      }
    }

    if (inBacktick) {
      inTemplateLiteral = true;
    }

    indentLevel = Math.max(0, indentLevel + netBlockDelta);
  }

  let result = formattedLines.join('\n');
  if (!result.endsWith('\n')) result += '\n';
  return result;
}

function createSharedCodeEditor({
  textarea,
  preview,
  language = 'json',
  badge = null,
  revertBtn = null,
  copyBtn = null,
  saveBtn = null,
  formatBtn = null,
  onInput = null,
  onSave = null,
  onFormat = null,
} = {}) {
  if (!textarea || !preview) return null;
  if (textarea.__sharedEditor) return textarea.__sharedEditor;

  const scrollContainer = preview.tagName === 'CODE'
    ? (preview.closest('.code-preview') || preview.closest('pre') || preview.parentElement || preview)
    : preview;
  const codeElement = preview.tagName === 'CODE'
    ? preview
    : (preview.querySelector('code') || preview);

  const stageEl = textarea.closest('.code-editor-stage') || scrollContainer.parentElement || textarea.parentElement;

  let suggestTimer = null;
  let suggestAbort = null;

  // Create floating suggest indicator if stageEl exists
  let suggestPill = stageEl ? stageEl.querySelector('.editor-ai-suggest-pill') : null;
  if (stageEl && !suggestPill && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      suggestPill = document.createElement('div');
      suggestPill.className = 'editor-ai-suggest-pill';
      suggestPill.title = 'AI Inline Suggestion (Tab: chèn, Esc: hủy, bấm để bật/tắt)';
      suggestPill.innerHTML = '<i class="ph-bold ph-sparkle"></i> <span class="suggest-msg"><kbd>Tab</kbd> chèn</span>';
      stageEl.appendChild(suggestPill);
      suggestPill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.toggleSuggest();
      });
    } catch {}
  }

  const editor = {
    original: '',
    language,
    currentSuggestion: '',
    suggestionPos: -1,
    suggestEnabled: typeof localStorage !== 'undefined' && localStorage ? (localStorage.getItem('qa_studio_ai_suggest_enabled') !== 'false') : true,
    isSuggestLoading: false,

    setSuggestion(text, pos) {
      this.currentSuggestion = text;
      this.suggestionPos = pos;
      this.render();
      this.updateSuggestUI();
    },

    clearSuggestion() {
      if (!this.currentSuggestion && this.suggestionPos === -1 && !this.isSuggestLoading) return;
      this.currentSuggestion = '';
      this.suggestionPos = -1;
      this.render();
      this.updateSuggestUI();
    },

    setSuggestLoading(loading) {
      this.isSuggestLoading = loading;
      this.updateSuggestUI();
    },

    toggleSuggest() {
      this.suggestEnabled = !this.suggestEnabled;
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem('qa_studio_ai_suggest_enabled', String(this.suggestEnabled));
      }
      if (!this.suggestEnabled) {
        this.clearSuggestion();
      }
      this.updateSuggestUI();
      if (typeof notify === 'function') {
        notify(this.suggestEnabled ? 'Đã bật AI Inline Suggestion.' : 'Đã tắt AI Inline Suggestion.');
      }
    },

    updateSuggestUI() {
      if (!suggestPill) return;
      if (!this.suggestEnabled) {
        suggestPill.className = 'editor-ai-suggest-pill is-visible';
        suggestPill.innerHTML = '<i class="ph-bold ph-sparkle-slash"></i> <span class="suggest-msg">AI: Tắt (bấm để bật)</span>';
        return;
      }
      if (this.isSuggestLoading) {
        suggestPill.className = 'editor-ai-suggest-pill is-visible is-loading';
        suggestPill.innerHTML = '<i class="ph-bold ph-circle-notch spinner"></i> <span class="suggest-msg">Đang gợi ý...</span>';
        return;
      }
      if (this.currentSuggestion && this.suggestionPos >= 0) {
        suggestPill.className = 'editor-ai-suggest-pill is-visible is-active';
        suggestPill.innerHTML = '<i class="ph-bold ph-sparkle"></i> <span class="suggest-msg"><kbd>Tab</kbd> chèn · <kbd>Esc</kbd> hủy</span>';
        return;
      }
      suggestPill.className = 'editor-ai-suggest-pill';
    },

    setValue(value, options = {}) {
      const markClean = options.markClean !== false;
      const readOnly = options.readOnly;
      this.clearSuggestion();
      textarea.value = value || '';
      if (markClean) this.original = textarea.value;
      if (typeof readOnly === 'boolean') {
        if (readOnly) textarea.setAttribute('readonly', 'true');
        else textarea.removeAttribute('readonly');
      }
      this.render();
      this.updateState();
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
      scrollContainer.scrollTop = 0;
      scrollContainer.scrollLeft = 0;
    },
    getValue() { return textarea.value; },
    revert() {
      this.clearSuggestion();
      this.setValue(this.original, { markClean: true });
      if (typeof notify === 'function') notify('Đã khôi phục về mã nguồn gốc.');
    },
    isDirty() { return textarea.value !== this.original; },
    setReadOnly(readOnly) {
      if (readOnly) {
        textarea.setAttribute('readonly', 'true');
        this.clearSuggestion();
      } else {
        textarea.removeAttribute('readonly');
      }
    },
    render() {
      const val = textarea.value;
      if (this.currentSuggestion && this.suggestionPos >= 0 && this.suggestionPos <= val.length) {
        const prefix = val.slice(0, this.suggestionPos);
        const suffix = val.slice(this.suggestionPos);
        const isJson = this.language === 'json';
        const highlightedPrefix = highlightCode(prefix, isJson);
        const highlightedSuffix = highlightCode(suffix, isJson);
        const ghostHtml = `<span class="editor-ghost-text">${escapeHtml(this.currentSuggestion)}</span>`;
        codeElement.innerHTML = highlightedPrefix + ghostHtml + highlightedSuffix + '\n';
      } else {
        codeElement.innerHTML = highlightCode(val, this.language === 'json') + '\n';
      }
    },
    updateState() {
      const dirty = this.isDirty();
      textarea.classList.toggle('is-dirty', dirty);
      if (badge) {
        if (dirty) {
          badge.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Đã thay đổi (chưa lưu)';
          badge.classList.add('modified');
          badge.style.display = 'inline-flex';
        } else {
          badge.classList.remove('modified');
          if (badge.dataset.hideWhenClean === 'true') {
            badge.style.display = 'none';
          } else if ((typeof scriptBuilderMode !== 'undefined' && scriptBuilderMode === 'create') || (typeof pageManagerMode !== 'undefined' && pageManagerMode === 'create') || (typeof dataSubnavMode !== 'undefined' && dataSubnavMode === 'create')) {
            badge.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
            badge.style.display = 'inline-flex';
          } else {
            badge.innerHTML = '<i class="ph-bold ph-check"></i> Đang mở từ disk';
            badge.style.display = 'inline-flex';
          }
        }
      }
      if (revertBtn) {
        revertBtn.style.display = dirty ? 'inline-flex' : 'none';
      }
    },
    markSaved(newContent = null) {
      this.clearSuggestion();
      if (newContent !== null) textarea.value = newContent;
      this.original = textarea.value;
      this.render();
      this.updateState();
    },
  };

  const suggestCache = new Map();

  function getLocalSuggestion(prefix, language) {
    if (!prefix || language !== 'javascript') return null;
    const lines = prefix.split('\n');
    const currentLine = lines[lines.length - 1] || '';

    // 1. Vietnamese/English Playwright BDD Comments
    if (/^\s*\/\/\s*$/.test(currentLine)) {
      return 'Given Người dùng mở trang chủ và khởi tạo kịch bản';
    }
    if (/^\s*\/\/\s*B(?:ước)?\s*$/i.test(currentLine)) {
      return 'ước 1: Khởi tạo dữ liệu kiểm thử';
    }
    if (/^\s*\/\/\s*k(?:iểm)?\s*t(?:ra)?\s*$/i.test(currentLine)) {
      return 'tra kết quả thực thi kịch bản thành công';
    }
    if (/^\s*\/\/\s*đ(?:ăng)?\s*n(?:hập)?\s*$/i.test(currentLine)) {
      return 'hập vào hệ thống với tài khoản đã xác thực';
    }

    // 2. Playwright Step and Block Constructs
    if (/^\s*test\.describe\($/.test(currentLine)) {
      return "'Tên tính năng kiểm thử', () => {\n  \n});";
    }
    if (/^\s*(?:await\s+)?test\.step\($/.test(currentLine)) {
      return "'Tên bước kiểm thử', async () => {\n    \n  });";
    }
    if (/^\s*(?:await\s+)?expect\($/.test(currentLine)) {
      return "page).toHaveURL(/example/);";
    }

    // 3. Framework Page Objects & Fixture Actions
    if (/^\s*await\s+[a-zA-Z0-9_]+Page\.$/.test(currentLine)) {
      return "capture('action_step');";
    }
    if (/^\s*await\s+page\.$/.test(currentLine)) {
      return "goto('/');";
    }

    return null;
  }

  function triggerSuggestion() {
    if (suggestTimer) clearTimeout(suggestTimer);
    if (suggestAbort) {
      try { suggestAbort.abort(); } catch {}
      suggestAbort = null;
    }
    if (!editor.suggestEnabled || textarea.readOnly || textarea.selectionStart !== textarea.selectionEnd) {
      editor.clearSuggestion();
      return;
    }
    const pos = textarea.selectionStart;
    const val = textarea.value;
    if (!val || !val.trim() || pos < 2) {
      editor.clearSuggestion();
      return;
    }
    const prefix = val.slice(0, pos);
    const suffix = val.slice(pos);

    // Tier 1: Instant Local Syntactic Match (0ms latency)
    const local = getLocalSuggestion(prefix, editor.language);
    if (local) {
      editor.setSuggestion(local, pos);
      return;
    }

    // Tier 2: In-Memory LRU Cache (0ms latency)
    const cacheKey = `${editor.language}:${prefix.slice(-100)}`;
    if (suggestCache.has(cacheKey)) {
      const cached = suggestCache.get(cacheKey);
      if (cached && typeof cached === 'string') {
        editor.setSuggestion(cached, pos);
        return;
      }
    }

    // Tier 3: Adaptive low-latency debounce (40ms for trigger chars, 120ms for typing)
    const lastChar = prefix.slice(-1);
    const isTriggerChar = ['.', '(', '\n', ' '].includes(lastChar);
    const delay = isTriggerChar ? 40 : 120;

    suggestTimer = setTimeout(async () => {
      if (textarea.selectionStart !== pos || textarea.value !== val) return;
      suggestAbort = new AbortController();
      editor.setSuggestLoading(true);
      try {
        let clientConfig = null;
        try {
          const rawCfg = localStorage.getItem('qa_studio_ai_personal_config');
          if (rawCfg) {
            const p = JSON.parse(rawCfg);
            if (p && p.enabled && p.apiKey) clientConfig = p;
          }
        } catch {}

        const headers = { 'Content-Type': 'application/json' };
        if (clientConfig) {
          try { headers['X-AI-Config'] = btoa(unescape(encodeURIComponent(JSON.stringify(clientConfig)))); } catch {}
        }
        const res = await fetch('/api/ai/inline-suggest', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prefix,
            suffix,
            language: editor.language,
            clientConfig,
          }),
          signal: suggestAbort.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.suggestion && textarea.selectionStart === pos && textarea.value === val) {
          if (suggestCache.size > 100) {
            const firstKey = suggestCache.keys().next().value;
            suggestCache.delete(firstKey);
          }
          suggestCache.set(cacheKey, data.suggestion);
          editor.setSuggestion(data.suggestion, pos);
        }
      } catch (err) {
        // Ignored on abort or network error
      } finally {
        editor.setSuggestLoading(false);
      }
    }, delay);
  }

  let prevInputPos = textarea.selectionStart;
  let prevInputVal = textarea.value;

  textarea.addEventListener('input', () => {
    const pos = textarea.selectionStart;
    const val = textarea.value;

    // Fast Ghost Text Prefix Matching (0ms):
    // If user is typing forward through the existing ghost suggestion, keep ghost text alive!
    let matchedGhost = false;
    if (editor.currentSuggestion && editor.suggestionPos >= 0 && pos === editor.suggestionPos + 1 && val.length === prevInputVal.length + 1) {
      const typedChar = val[editor.suggestionPos];
      if (typedChar && editor.currentSuggestion[0] === typedChar) {
        editor.currentSuggestion = editor.currentSuggestion.slice(1);
        editor.suggestionPos = pos;
        matchedGhost = true;
      }
    }

    if (!matchedGhost) {
      editor.clearSuggestion();
    }

    prevInputPos = pos;
    prevInputVal = val;
    editor.render();
    editor.updateState();
    onInput?.(editor);

    if (!matchedGhost) {
      triggerSuggestion();
    }
  });

  let isSyncingScroll = false;
  const syncScrollFromTextarea = () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    scrollContainer.scrollTop = textarea.scrollTop;
    scrollContainer.scrollLeft = textarea.scrollLeft;
    requestAnimationFrame(() => { isSyncingScroll = false; });
  };
  const syncScrollFromContainer = () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    textarea.scrollTop = scrollContainer.scrollTop;
    textarea.scrollLeft = scrollContainer.scrollLeft;
    requestAnimationFrame(() => { isSyncingScroll = false; });
  };

  textarea.addEventListener('scroll', syncScrollFromTextarea, { passive: true });
  scrollContainer.addEventListener('scroll', syncScrollFromContainer, { passive: true });

  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      editor.clearSuggestion();
      if (saveBtn) saveBtn.click();
      else onSave?.(editor);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      if (editor.currentSuggestion && editor.suggestionPos >= 0) {
        const pos = textarea.selectionStart;
        const insertText = editor.currentSuggestion;
        editor.clearSuggestion();
        textarea.setRangeText(insertText, pos, pos, 'end');
        textarea.dispatchEvent(new Event('input'));
        return;
      }
      const start = textarea.selectionStart;
      textarea.setRangeText('  ', start, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input'));
      return;
    }
    if (event.key === 'Escape') {
      if (editor.currentSuggestion) {
        event.preventDefault();
        editor.clearSuggestion();
        return;
      }
    }
  });

  textarea.addEventListener('click', () => {
    if (editor.currentSuggestion && textarea.selectionStart !== editor.suggestionPos) {
      editor.clearSuggestion();
    }
  });

  textarea.addEventListener('keyup', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      if (editor.currentSuggestion && textarea.selectionStart !== editor.suggestionPos) {
        editor.clearSuggestion();
      }
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const val = editor.getValue();
      if (val) {
        navigator.clipboard.writeText(val);
        if (typeof notify === 'function') notify('Đã sao chép mã nguồn vào bộ nhớ tạm!');
      }
    });
  }
  if (revertBtn) {
    revertBtn.addEventListener('click', () => editor.revert());
  }
  if (saveBtn && onSave) {
    saveBtn.addEventListener('click', () => onSave(editor));
  }
  if (formatBtn) {
    formatBtn.addEventListener('click', () => {
      if (onFormat) {
        onFormat(editor);
      } else if (editor.language === 'json') {
        try {
          const formatted = JSON.stringify(JSON.parse(editor.getValue()), null, 2);
          editor.setValue(formatted, { markClean: false });
          if (typeof notify === 'function') notify('✨ Đã định dạng JSON!');
        } catch (e) {
          if (typeof notify === 'function') notify('Lỗi cú pháp JSON, không thể format: ' + e.message);
        }
      } else if (editor.language === 'javascript') {
        try {
          const formatted = formatJavaScriptCode(editor.getValue());
          editor.setValue(formatted, { markClean: false });
          if (typeof notify === 'function') notify('✨ Đã định dạng mã nguồn JavaScript Playwright!');
        } catch (e) {
          if (typeof notify === 'function') notify('Lỗi khi định dạng: ' + e.message);
        }
      }
    });
  }
  textarea.__sharedEditor = editor;
  return editor;
}

function enterCodeEditMode() {
  if (!currentCodeFile) return;
  $('#code-editor-stage').classList.add('editing');
  $('#code-editor').hidden = false;
  $('#code-editor').focus();
  $('#code-edit-button').hidden = true;
  $('#code-format-button').hidden = getCodeLanguage(currentCodeFile) !== 'json';
  $('#code-save-button').hidden = false;
  $('#code-save-button').disabled = true;
  $('#code-cancel-button').hidden = false;
  $('#code-status-text').textContent = 'Đang chỉnh sửa';
}

function leaveCodeEditMode() {
  $('#code-editor').value = originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode(originalCodeContent, getCodeLanguage(currentCodeFile));
  $('#code-editor-stage').classList.remove('editing');
  $('#code-editor').hidden = true;
  $('#code-edit-button').hidden = false;
  $('#code-format-button').hidden = true;
  $('#code-save-button').hidden = true;
  $('#code-cancel-button').hidden = true;
  $('#code-status-text').textContent = 'Sẵn sàng';
}

function formatCurrentCodeEditor() {
  if (getCodeLanguage(currentCodeFile) !== 'json') {
    notify('Chỉ hỗ trợ định dạng tự động cho JSON.');
    return;
  }
  try {
    $('#code-editor').value = formatJsonText($('#code-editor').value);
    $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, getCodeLanguage(currentCodeFile)) + '\n';
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
    const content = getCodeLanguage(currentCodeFile) === 'json' ? formatJsonText($('#code-editor').value) : $('#code-editor').value;
    const result = await request('/api/code', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentCodeFile, content }),
    });
    originalCodeContent = content;
    $('#code-editor').value = content;
    $('#code-preview code').innerHTML = highlightCode(originalCodeContent, getCodeLanguage(currentCodeFile));
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

let currentRunnerMode = 'suite';

function renderRunnerSuiteOptions(suites, activeId = '') {
  const select = $('#runner-suite-select');
  if (!select) return;
  const entries = Object.entries(suites || {});
  if (entries.length === 0) {
    select.innerHTML = '<option value="">(Chưa có kịch bản nào)</option>';
    updateSuiteSummaryBox('');
    return;
  }
  select.innerHTML = entries.map(([id, suite]) => {
    const isComposite = suite.type === 'composite';
    let fileLabel = 'Tất cả file';
    if (isComposite) {
      const childCount = Array.isArray(suite.suites) ? suite.suites.length : 0;
      fileLabel = `⚡ Tổng hợp ${childCount} suite con`;
    } else if (Array.isArray(suite.specs) && suite.specs.length > 0) {
      fileLabel = `${suite.specs.length} file`;
    } else if (suite.spec && suite.spec !== 'all') {
      fileLabel = '1 file';
    }
    const platIcon = isComposite ? '⚡' : (suite.platform === 'mobile' || suite.project === 'mobile-chrome' ? '📱' : '🖥️');
    return `<option value="${escapeHtml(id)}" ${activeId === id ? 'selected' : ''}>${platIcon} ${escapeHtml(suite.label || id)} (${fileLabel})</option>`;
  }).join('');

  const targetId = (activeId && entries.some(([id]) => id === activeId)) ? activeId : entries[0][0];
  select.value = targetId;
  updateSuiteSummaryBox(targetId);
}

function updateSuiteSummaryBox(suiteId) {
  const suite = window.dashboardSuites?.[suiteId];
  const summaryBox = $('#suite-summary-box');
  if (!suite || !summaryBox) {
    window.activeSuiteSpecs = null;
    $('#test-suite').value = '';
    return;
  }
  $('#test-suite').value = suiteId;

  const isComposite = suite.type === 'composite';
  if ($('#suite-sum-project')) {
    if (isComposite) {
      $('#suite-sum-project').textContent = 'Đa nền tảng (Composite)';
    } else {
      $('#suite-sum-project').textContent = suite.project === 'all' ? 'Tất cả nhóm' : (suite.project || 'Mặc định');
    }
  }
  
  const vp = suite.viewport || { preset: 'default', width: 1920, height: 1080 };
  const vpText = isComposite ? 'Tự động theo Suite con' : (vp.preset === 'default' ? 'Mặc định' : `${vp.width}x${vp.height}`);
  $('#suite-sum-viewport').textContent = vpText;

  $('#suite-sum-grep').textContent = isComposite ? 'Theo từng Suite' : (suite.grep ? suite.grep : 'Không tag');
  $('#suite-sum-workers').textContent = `${suite.workers || 2} luồng`;

  const filesList = $('#suite-sum-files-list');
  const filesCount = $('#suite-sum-count');

  if (isComposite) {
    const childIds = Array.isArray(suite.suites) ? suite.suites : [];
    const allChildSuites = window.dashboardSuites || {};
    window.activeSuiteSpecs = null;
    if (filesCount) filesCount.textContent = `${childIds.length} suites con`;
    if (filesList) {
      filesList.innerHTML = childIds.map((cid) => {
        const child = allChildSuites[cid] || {};
        const isMob = child.platform === 'mobile' || child.project === 'mobile-chrome';
        const icon = isMob ? 'ph-device-mobile' : 'ph-desktop';
        return `
          <span class="suite-summary-pill" title="${escapeHtml(child.label || cid)}" style="border-color:var(--accent);">
            <i class="ph-bold ${icon}"></i> ${escapeHtml(child.label || cid)}
          </span>
        `;
      }).join('');
    }
    return;
  }

  let specs = suite.specs;
  if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];

  if (Array.isArray(specs) && specs.length > 0) {
    window.activeSuiteSpecs = specs;
    if (filesCount) filesCount.textContent = String(specs.length);
    if (filesList) {
      filesList.innerHTML = specs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  } else {
    window.activeSuiteSpecs = null;
    if (filesCount) filesCount.textContent = 'Toàn bộ';
    if (filesList) {
      filesList.innerHTML = `<span class="suite-summary-pill"><i class="ph-bold ph-files"></i> Toàn bộ file .spec.js</span>`;
    }
  }
}

function parseSelectedTags(value = '') {
  return Array.from(new Set(String(value).match(/@[\w-]+/g) || []));
}

function getManualGrepValue() {
  const tags = parseSelectedTags($('#grep')?.value || '');
  if (tags.length <= 1) return tags[0] || '';
  return `(?:${tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
}

function uniqueSpecs(specs = []) {
  return Array.from(new Set(specs));
}

function renderTagChips(tags = []) {
  const container = $('#runner-tag-chips');
  if (!container) return;
  if (tags.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = tags.map((t) =>
    `<button type="button" class="tag-chip-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join('');

  container.querySelectorAll('.tag-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const grepInput = $('#grep');
      if (!grepInput) return;
      const selectedTags = parseSelectedTags(grepInput.value);
      const tagIndex = selectedTags.findIndex((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase());
      if (tagIndex >= 0) {
        selectedTags.splice(tagIndex, 1);
      } else {
        selectedTags.push(tag);
      }
      grepInput.value = selectedTags.join(' ');
      updateManualSpecsPreview();
    });
  });
}

function updateManualSpecsPreview() {
  let manualScope = 'all';
  document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
    if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
  });

  const project = $('#project')?.value || 'all';
  const hasProjectMapping = testCatalog.specProjects && Object.keys(testCatalog.specProjects).length > 0;
  const projectSpecs = project === 'all' || !hasProjectMapping
    ? (testCatalog.specs || [])
    : (testCatalog.specs || []).filter((spec) => testCatalog.specProjects[spec]?.includes(project));
  const uniqueProjectSpecs = uniqueSpecs(projectSpecs);

  const titleSpan = $('#manual-specs-preview-title');
  const countSpan = $('#manual-specs-preview-count');
  const listContainer = $('#manual-specs-preview-list');
  if (!listContainer) return;

  if (manualScope === 'file') {
    const selectedFile = $('#spec')?.value;
    if (selectedFile && selectedFile !== 'all') {
      if (titleSpan) titleSpan.textContent = 'File đã chọn';
      if (countSpan) countSpan.textContent = '1 file';
      listContainer.innerHTML = `
        <span class="suite-summary-pill" title="${escapeHtml(selectedFile)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(selectedFile.split('/').pop())}
        </span>
      `;
    } else {
      if (titleSpan) titleSpan.textContent = 'Chưa chọn file';
      if (countSpan) countSpan.textContent = '0';
      listContainer.innerHTML = `<span style="color:var(--muted); font-size:11px; padding:4px;">Vui lòng chọn 1 file trong danh sách thả xuống</span>`;
    }
  } else if (manualScope === 'grep') {
    const rawGrep = $('#grep')?.value.trim() || '';
    const selectedTags = parseSelectedTags(rawGrep);
    const grepLower = rawGrep.toLowerCase();

    // Update active class on tag chips
    document.querySelectorAll('#runner-tag-chips .tag-chip-btn').forEach((b) => {
      b.classList.toggle('active', selectedTags.some((tag) => tag.toLowerCase() === b.dataset.tag.toLowerCase()));
    });

    if (grepLower) {
      const matchedSpecs = uniqueSpecs(uniqueProjectSpecs.filter((spec) => {
        const tags = testCatalog.specTags?.[spec] || [];
        return selectedTags.length > 0
          ? selectedTags.some((selectedTag) => tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase()))
          : tags.some((tag) => tag.toLowerCase().includes(grepLower) || grepLower.includes(tag.toLowerCase()));
      }));

      if (matchedSpecs.length > 0) {
        if (titleSpan) titleSpan.textContent = `Tìm thấy ${matchedSpecs.length} file có tag "${rawGrep}"`;
        if (countSpan) countSpan.textContent = `${matchedSpecs.length} files`;
        listContainer.innerHTML = matchedSpecs.map((s) => {
          const tags = testCatalog.specTags?.[s] || [];
          return `
            <span class="suite-summary-pill" title="${escapeHtml(s)} (Tags: ${tags.join(', ')})">
              <i class="ph-bold ph-tag"></i> ${escapeHtml(s.split('/').pop())}
            </span>
          `;
        }).join('');
      } else {
        if (titleSpan) titleSpan.textContent = `Không tìm thấy file nào có tag "${rawGrep}"`;
        if (countSpan) countSpan.textContent = `0 files`;
        listContainer.innerHTML = `<span style="color:var(--danger,#ef4444); font-size:11px; padding:4px;"><i class="ph-bold ph-warning"></i> Không có file .spec.js nào chứa tag này trong nhóm ${project === 'all' ? 'dự án' : project}</span>`;
      }
    } else {
      if (titleSpan) titleSpan.textContent = 'Chọn hoặc nhập Tag để lọc file test';
      if (countSpan) countSpan.textContent = `${uniqueProjectSpecs.length} files sẵn có`;
      listContainer.innerHTML = uniqueProjectSpecs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  } else {
    // all
    if (titleSpan) titleSpan.textContent = project === 'all' ? 'Tất cả file test' : `File test thuộc ${project}`;
    if (countSpan) countSpan.textContent = `${uniqueProjectSpecs.length} files`;
    if (uniqueProjectSpecs.length === 0) {
      listContainer.innerHTML = `<span style="color:var(--muted); font-size:11px; padding:4px;">Không có file test nào phù hợp với nhóm này</span>`;
    } else {
      listContainer.innerHTML = uniqueProjectSpecs.map((s) => `
        <span class="suite-summary-pill" title="${escapeHtml(s)}">
          <i class="ph-bold ph-file-js"></i> ${escapeHtml(s.split('/').pop())}
        </span>
      `).join('');
    }
  }
}

function setRunnerMode(mode) {
  currentRunnerMode = mode;
  document.querySelectorAll('.runner-mode-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  const suitePanel = $('#runner-suite-mode');
  const manualPanel = $('#runner-manual-mode');
  if (suitePanel) suitePanel.hidden = mode !== 'suite';
  if (manualPanel) manualPanel.hidden = mode !== 'manual';

  if (mode === 'suite') {
    const selectedId = $('#runner-suite-select')?.value;
    if (selectedId) updateSuiteSummaryBox(selectedId);
  } else {
    window.activeSuiteSpecs = null;
    $('#test-suite').value = '';
    updateManualSpecsPreview();
  }
}

/* ==============================================================================
   TEST SUITES STUDIO - PARENT-CHILD (COMPOSITE) ARCHITECTURE CONTROLLER
============================================================================== */
let currentSelectedSuiteId = null;
let currentSuiteFilter = 'all';
let currentSuiteSearch = '';
let suitesCache = {};
let savedSuitesCache = {};
let suitesViewInitialized = false;

function normalizeSuiteInMemory(suite = {}) {
  const isComposite = suite.type === 'composite';
  if (isComposite) {
    return {
      type: 'composite',
      label: (suite.label || '').trim(),
      description: (suite.description || '').trim(),
      suites: Array.isArray(suite.suites) ? suite.suites.filter(Boolean) : [],
      workers: parseInt(suite.workers, 10) || 2
    };
  }

  const rawProject = (suite.project || '').trim();
  const rawPlatform = suite.platform || (rawProject === 'mobile-chrome' ? 'mobile' : 'desktop');
  const platform = rawPlatform === 'mobile' ? 'mobile' : 'desktop';

  return {
    type: 'single',
    platform,
    label: (suite.label || '').trim(),
    description: (suite.description || '').trim(),
    project: rawProject || (platform === 'mobile' ? 'mobile-chrome' : 'chromium'),
    device: (suite.device || '').trim(),
    workers: parseInt(suite.workers, 10) || 2,
    viewport: {
      preset: suite.viewport?.preset || 'default',
      width: parseInt(suite.viewport?.width, 10) || (platform === 'mobile' ? 393 : 1920),
      height: parseInt(suite.viewport?.height, 10) || (platform === 'mobile' ? 851 : 1080)
    },
    spec: typeof suite.spec === 'string' ? suite.spec : 'all',
    specs: Array.isArray(suite.specs) ? [...suite.specs].sort() : (suite.specs === 'all' ? 'all' : []),
    grep: (suite.grep || '').trim()
  };
}

function isCurrentSuiteDirty() {
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) return false;
  const saved = savedSuitesCache[currentSelectedSuiteId];
  if (!saved) return true;
  const current = suitesCache[currentSelectedSuiteId];
  return JSON.stringify(normalizeSuiteInMemory(current)) !== JSON.stringify(normalizeSuiteInMemory(saved));
}

function updateSuiteRunButtonState() {
  const isDirty = isCurrentSuiteDirty();
  const runBtn = $('#suites-subnav-run-btn');
  const badge = $('#suite-dirty-badge');

  if (badge) {
    badge.style.display = isDirty ? 'inline-flex' : 'none';
  }

  if (runBtn) {
    if (isDirty) {
      runBtn.classList.add('is-dirty-locked');
      runBtn.setAttribute('title', 'Kịch bản có thay đổi chưa lưu. Vui lòng bấm "Lưu thay đổi" trước khi chạy.');
    } else {
      runBtn.classList.remove('is-dirty-locked');
      runBtn.setAttribute('title', 'Chạy ngay kịch bản Test Suite này');
    }
  }
}

function renderSuitesView(suites) {
  suitesCache = Object.assign({}, suites || {});
  if (Object.keys(savedSuitesCache).length === 0 || !suitesViewInitialized) {
    savedSuitesCache = JSON.parse(JSON.stringify(suitesCache));
  }

  // Populate projects in single-suite editor
  const projSelect = $('#suite-platform-project') || $('#suite-field-project');
  if (projSelect) {
    const rawProjects = testCatalog?.projects || ['chromium', 'mobile-chrome'];
    const projectList = Array.from(new Set(['all', ...rawProjects]));
    projSelect.innerHTML = projectList.map((p) =>
      `<option value="${escapeHtml(p)}">${p === 'all' ? 'Tất cả nhóm browser (all)' : escapeHtml(p)}</option>`
    ).join('');
  }

  // Update Hero Stats
  const entries = Object.entries(suitesCache);
  const total = entries.length;
  const compositeCount = entries.filter(([_, s]) => s.type === 'composite').length;
  const desktopCount = entries.filter(([_, s]) => {
    if (s.type === 'composite') return false;
    const plat = s.platform || (s.project === 'mobile-chrome' ? 'mobile' : 'desktop');
    return plat !== 'mobile';
  }).length;
  const mobileCount = entries.filter(([_, s]) => {
    if (s.type === 'composite') return false;
    const plat = s.platform || (s.project === 'mobile-chrome' ? 'mobile' : 'desktop');
    return plat === 'mobile';
  }).length;

  if ($('#suites-stat-total')) $('#suites-stat-total').textContent = total;
  if ($('#suites-stat-composite')) $('#suites-stat-composite').textContent = compositeCount;
  if ($('#suites-stat-desktop')) $('#suites-stat-desktop').textContent = desktopCount;
  if ($('#suites-stat-mobile')) $('#suites-stat-mobile').textContent = mobileCount;

  // Render Sidebar List & Dropdown selector
  renderSuitesSidebarList();
  renderSuiteDropdown();

  // If no suite selected or selected does not exist, select first
  const keys = Object.keys(suitesCache);
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) {
    currentSelectedSuiteId = keys.length > 0 ? keys[0] : null;
  }

  if (currentSelectedSuiteId) {
    selectSuite(currentSelectedSuiteId);
  } else {
    loadSuiteIntoEditor(null, null);
  }
  updateSuiteRunButtonState();
}


function renderSuitesSidebarList() {
  const container = $('#suites-sidebar-list');
  const countEl = $('#suites-total-count');
  const railCountEl = $('#suites-rail-count');
  if (!container) return;

  const entries = Object.entries(suitesCache);
  if (countEl) countEl.textContent = entries.length;
  if (railCountEl) railCountEl.textContent = entries.length;

  const query = (currentSuiteSearch || '').toLowerCase().trim();
  const filter = currentSuiteFilter || 'all';

  const filtered = entries.filter(([id, suite]) => {
    const isComp = suite.type === 'composite';
    const plat = isComp ? 'composite' : (suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop'));

    if (filter === 'composite' && !isComp) return false;
    if (filter === 'desktop' && (isComp || plat === 'mobile')) return false;
    if (filter === 'mobile' && (isComp || plat !== 'mobile')) return false;

    if (query) {
      const matchKey = id.toLowerCase().includes(query);
      const matchLabel = (suite.label || '').toLowerCase().includes(query);
      const matchGrep = (suite.grep || '').toLowerCase().includes(query);
      const matchDesc = (suite.description || '').toLowerCase().includes(query);
      const matchProject = (suite.project || '').toLowerCase().includes(query);
      if (!matchKey && !matchLabel && !matchGrep && !matchDesc && !matchProject) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: var(--muted); font-size: 12px;">
        <i class="ph-bold ph-stack" style="font-size: 24px; display: block; margin-bottom: 6px; opacity: 0.6;"></i>
        Không tìm thấy Test Suite phù hợp
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(([id, suite]) => {
    const isSelected = id === currentSelectedSuiteId;
    const isComp = suite.type === 'composite';
    const plat = isComp ? 'composite' : (suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop'));
    const label = suite.label || id;
    const workers = suite.workers || 2;

    let badgeHtml = '';
    let detailMeta = '';

    if (isComp) {
      const childCount = Array.isArray(suite.suites) ? suite.suites.length : 0;
      badgeHtml = `<span class="suite-nav-badge suite-badge-composite"><i class="ph-bold ph-lightning"></i> Suite Cha</span>`;
      detailMeta = `
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-stack"></i> ${childCount} con</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> ${workers}W</span>
      `;
    } else if (plat === 'mobile') {
      badgeHtml = `<span class="suite-nav-badge suite-badge-mobile"><i class="ph-bold ph-device-mobile"></i> Mobile</span>`;
      const specCount = Array.isArray(suite.specs) ? suite.specs.length : (suite.specs === 'all' || !suite.specs ? 'All specs' : '1 spec');
      detailMeta = `
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-files"></i> ${specCount}</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> ${workers}W</span>
      `;
    } else {
      badgeHtml = `<span class="suite-nav-badge suite-badge-desktop"><i class="ph-bold ph-desktop"></i> Desktop</span>`;
      const specCount = Array.isArray(suite.specs) ? suite.specs.length : (suite.specs === 'all' || !suite.specs ? 'All specs' : '1 spec');
      detailMeta = `
        <span class="suite-nav-badge suite-badge-proj"><i class="ph-bold ph-files"></i> ${specCount}</span>
        <span class="suite-nav-badge suite-badge-count"><i class="ph-bold ph-cpu"></i> ${workers}W</span>
      `;
    }

    if (suite.grep) {
      detailMeta += `<span class="suite-nav-badge suite-badge-tag"><i class="ph-bold ph-tag"></i> ${escapeHtml(suite.grep)}</span>`;
    }

    return `
      <div class="dashboard-list-card script-card-item suite-nav-item ${isSelected ? 'is-selected active' : ''}" data-suite-id="${escapeHtml(id)}">
        <div class="suite-nav-top">
          <div class="suite-nav-title" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
          ${badgeHtml}
        </div>
        <div class="suite-nav-meta">
          ${detailMeta}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.suite-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const suiteId = item.dataset.suiteId;
      if (suiteId && suitesCache[suiteId]) {
        selectSuite(suiteId);
      }
    });
  });
}

function renderSuiteDropdown() {
  const select = $('#suite-picker-select');
  if (!select) return;

  const entries = Object.entries(suitesCache);
  if (entries.length === 0) {
    select.innerHTML = '<option value="">(Chưa có Test Suite nào)</option>';
    return;
  }

  const compositeSuites = entries.filter(([_, s]) => s.type === 'composite');
  const singleSuites = entries.filter(([_, s]) => s.type !== 'composite');

  let html = '';
  if (compositeSuites.length > 0) {
    html += `<optgroup label="⚡ Test Suite Cha (Tổng hợp đa nền tảng)">`;
    html += compositeSuites.map(([id, s]) => {
      const childCount = Array.isArray(s.suites) ? s.suites.length : 0;
      return `<option value="${escapeHtml(id)}">⚡ ${escapeHtml(s.label || id)} (${childCount} suite con)</option>`;
    }).join('');
    html += `</optgroup>`;
  }

  if (singleSuites.length > 0) {
    html += `<optgroup label="📦 Test Suite Con (Đơn lẻ theo nền tảng)">`;
    html += singleSuites.map(([id, s]) => {
      const plat = s.platform || (s.project === 'mobile-chrome' ? 'mobile' : 'desktop');
      const icon = plat === 'mobile' ? '📱' : '🖥️';
      return `<option value="${escapeHtml(id)}">${icon} ${escapeHtml(s.label || id)} [${plat.toUpperCase()}]</option>`;
    }).join('');
    html += `</optgroup>`;
  }

  select.innerHTML = html;
  if (currentSelectedSuiteId && suitesCache[currentSelectedSuiteId]) {
    select.value = currentSelectedSuiteId;
  }
}

function selectSuite(id) {
  if (!suitesCache[id]) return;
  currentSelectedSuiteId = id;

  const select = $('#suite-picker-select');
  if (select && select.value !== id) {
    select.value = id;
  }

  // Update active state in sidebar list
  document.querySelectorAll('#suites-sidebar-list .suite-nav-item').forEach(item => {
    const isThis = item.dataset.suiteId === id;
    item.classList.toggle('active', isThis);
    item.classList.toggle('is-selected', isThis);
  });

  loadSuiteIntoEditor(id, suitesCache[id]);
  updateSuitePreview(id, suitesCache[id]);
  updateSuiteRunButtonState();
}

function updateSuitePlatformContext(platform, currentValues = {}) {
  const isMob = platform === 'mobile';

  // 1. Emulation field: Hide entirely for Desktop, Show for Mobile
  const deviceLabel = $('#suite-platform-device-label');
  const deviceSelect = $('#suite-platform-device');
  const row1 = $('#suite-platform-row1');
  if (deviceLabel) {
    deviceLabel.style.display = isMob ? 'flex' : 'none';
  }
  if (row1) {
    row1.classList.toggle('is-mobile', isMob);
    row1.classList.toggle('is-desktop', !isMob);
    row1.style.gridTemplateColumns = '';
  }
  if (deviceSelect) {
    if (!isMob) {
      deviceSelect.value = '';
    } else if (currentValues.device !== undefined) {
      deviceSelect.value = currentValues.device;
    }
  }

  // 2. Browser Project dropdown: filter desktop vs mobile projects
  const projSelect = $('#suite-platform-project') || $('#suite-field-project');
  if (projSelect) {
    const rawProjects = testCatalog?.projects || ['chromium', 'mobile-chrome'];
    const filteredProjects = rawProjects.filter(p => {
      const pLower = p.toLowerCase();
      if (isMob) {
        return pLower.includes('mobile') || pLower.includes('android') || pLower.includes('ios');
      } else {
        return !pLower.includes('mobile') && !pLower.includes('android') && !pLower.includes('ios');
      }
    });

    // Fallback if none found
    if (filteredProjects.length === 0) {
      filteredProjects.push(isMob ? 'mobile-chrome' : 'chromium');
    }

    projSelect.innerHTML = filteredProjects.map(p =>
      `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
    ).join('');

    if (currentValues.project && filteredProjects.includes(currentValues.project)) {
      projSelect.value = currentValues.project;
    } else {
      projSelect.value = filteredProjects[0];
    }
  }

  // 3. Viewport Presets dropdown: filter desktop vs mobile presets
  const vpPresetSelect = $('#suite-platform-viewport-preset') || $('#suite-field-viewport-preset');
  if (vpPresetSelect) {
    let presetsHtml = '';
    if (isMob) {
      presetsHtml = `
        <option value="default">📱 Mặc định theo thiết bị</option>
        <option value="390x844">📱 Mobile iPhone 14/13 (390 x 844)</option>
        <option value="393x851">📱 Mobile Pixel 7 (393 x 851)</option>
        <option value="360x800">📱 Mobile Android Chuẩn (360 x 800)</option>
        <option value="412x915">📱 Mobile Galaxy S20/S21 (412 x 915)</option>
        <option value="custom">⚙️ Tự nhập kích thước (Custom)</option>
      `;
    } else {
      presetsHtml = `
        <option value="default">🖥️ Mặc định theo hệ thống</option>
        <option value="1920x1080">🖥️ Desktop Full HD (1920 x 1080)</option>
        <option value="1366x768">💻 Desktop Laptop (1366 x 768)</option>
        <option value="1440x900">🖥️ Desktop HD+ (1440 x 900)</option>
        <option value="2560x1440">🖥️ Desktop 2K Quad HD (2560 x 1440)</option>
        <option value="custom">⚙️ Tự nhập kích thước (Custom)</option>
      `;
    }
    vpPresetSelect.innerHTML = presetsHtml;

    if (currentValues.preset) {
      const match = vpPresetSelect.querySelector(`option[value="${currentValues.preset}"]`);
      if (match) {
        vpPresetSelect.value = currentValues.preset;
      } else {
        vpPresetSelect.value = isMob ? (currentValues.preset === '1920x1080' ? 'default' : currentValues.preset) : (currentValues.preset.includes('x') && parseInt(currentValues.preset) < 800 ? '1920x1080' : currentValues.preset);
      }
    } else {
      vpPresetSelect.value = isMob ? 'default' : '1920x1080';
    }
  }

  // 4. Custom Viewport Dimension Inputs
  const vpWidthInput = $('#suite-platform-vp-width') || $('#suite-field-vp-width');
  const vpHeightInput = $('#suite-platform-vp-height') || $('#suite-field-vp-height');
  if (vpWidthInput && vpHeightInput) {
    if (currentValues.width && currentValues.height) {
      vpWidthInput.value = currentValues.width;
      vpHeightInput.value = currentValues.height;
    } else {
      vpWidthInput.value = isMob ? 393 : 1920;
      vpHeightInput.value = isMob ? 851 : 1080;
    }
  }

  // 5. Spec Checklist: filter specs belonging to the platform
  const allSpecs = testCatalog?.specs || [];
  const checklistContainer = $('#suite-specs-checklist-container');
  const selectedSpecs = Array.isArray(currentValues.specs) ? currentValues.specs : [];

  if (checklistContainer) {
    const platformSpecs = allSpecs.filter(s => {
      const sLower = s.toLowerCase();
      const isMobileSpec = sLower.includes('/mobile/') || sLower.includes('/mobile-web/') || sLower.includes('.mobile.') || sLower.includes('-mobile') || sLower.includes('_mobile');
      return isMob ? isMobileSpec : !isMobileSpec;
    });

    if (platformSpecs.length === 0) {
      checklistContainer.innerHTML = `<p style="color:var(--muted); font-size:11.5px; padding:8px 4px;">Không tìm thấy file spec nào cho nền tảng <strong>${isMob ? 'Mobile Web' : 'Desktop Web'}</strong>.</p>`;
    } else {
      checklistContainer.innerHTML = platformSpecs.map((s) => {
        const parts = s.split('/');
        const fileName = parts.pop();
        const dirPath = parts.length > 0 ? parts.join('/') + '/' : '';
        const isChecked = selectedSpecs.includes(s);
        return `
          <label class="suite-card-fields suite-spec-item" style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:5px; cursor:pointer;">
            <input type="checkbox" class="suite-spec-cb" value="${escapeHtml(s)}" ${isChecked ? 'checked' : ''}>
            <span class="suite-spec-name" style="font-size:11.5px; font-family:var(--font-mono);"><span style="color:var(--muted);">${escapeHtml(dirPath)}</span><strong>${escapeHtml(fileName)}</strong></span>
          </label>
        `;
      }).join('');

      checklistContainer.querySelectorAll('.suite-spec-cb').forEach((cb) => {
        cb.addEventListener('change', () => {
          syncCurrentSuiteFromInputs();
        });
      });
    }

    const countLabel = $('#suite-specs-count-label');
    const checkedCount = checklistContainer.querySelectorAll('.suite-spec-cb:checked').length;
    if (countLabel) countLabel.textContent = `Đã chọn: ${checkedCount} file`;
  }
}

function loadSuiteIntoEditor(id, suite) {
  const emptyBox = $('#suite-middle-empty');
  const formInner = $('#suite-editor-form');

  if (!suite) {
    if (emptyBox) emptyBox.style.display = 'flex';
    if (formInner) formInner.style.display = 'none';
    if ($('#suite-active-title')) $('#suite-active-title').textContent = 'Chưa chọn kịch bản';
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';
  if (formInner) formInner.style.display = 'flex';

  const isComposite = suite.type === 'composite';

  // Active Key badge & Title
  if ($('#suite-active-key-label')) $('#suite-active-key-label').textContent = id;
  if ($('#suite-active-title')) $('#suite-active-title').textContent = suite.label || id;
  if ($('#suite-field-label')) $('#suite-field-label').value = suite.label || '';
  if ($('#suite-field-key')) $('#suite-field-key').value = id;
  if ($('#suite-field-desc')) $('#suite-field-desc').value = suite.description || '';

  // Type badge
  const typeBadge = $('#suite-type-badge');
  if (typeBadge) {
    if (isComposite) {
      typeBadge.className = 'suite-type-badge composite';
      typeBadge.innerHTML = '<i class="ph-bold ph-folders"></i> Suite Cha (Tổng hợp)';
    } else {
      typeBadge.className = 'suite-type-badge single';
      typeBadge.innerHTML = '<i class="ph-bold ph-file-text"></i> Suite Con (Đơn lẻ)';
    }
  }

  // Kind Pills (Single vs Composite)
  const singleRadio = document.querySelector('input[name="suite-form-kind"][value="single"]');
  const compRadio = document.querySelector('input[name="suite-form-kind"][value="composite"]');
  if (isComposite) {
    if (compRadio) compRadio.checked = true;
    $('#suite-kind-pill-composite')?.classList.add('active');
    $('#suite-kind-pill-single')?.classList.remove('active');
    if ($('#suite-single-section')) $('#suite-single-section').style.display = 'none';
    if ($('#suite-composite-section')) $('#suite-composite-section').style.display = 'block';
  } else {
    if (singleRadio) singleRadio.checked = true;
    $('#suite-kind-pill-single')?.classList.add('active');
    $('#suite-kind-pill-composite')?.classList.remove('active');
    if ($('#suite-single-section')) $('#suite-single-section').style.display = 'block';
    if ($('#suite-composite-section')) $('#suite-composite-section').style.display = 'none';
  }

  if (isComposite) {
    // Render child suites checkboxes
    if ($('#suite-composite-workers')) $('#suite-composite-workers').value = suite.workers || 2;
    const childrenList = $('#suite-composite-children-list');
    if (childrenList) {
      const selectedChildren = Array.isArray(suite.suites) ? suite.suites : [];
      const singleEntries = Object.entries(suitesCache).filter(([k, s]) => k !== id && s.type !== 'composite');

      if (singleEntries.length === 0) {
        childrenList.innerHTML = `
          <div style="padding:16px; text-align:center; color:var(--muted); font-size:12px; background:var(--surface); border-radius:8px; border:1px dashed var(--line);">
            Chưa có kịch bản con đơn lẻ nào. Hãy tạo kịch bản con Desktop hoặc Mobile trước để gom vào Suite Cha này.
          </div>
        `;
      } else {
        childrenList.innerHTML = singleEntries.map(([cid, cs]) => {
          const isChecked = selectedChildren.includes(cid);
          const plat = cs.platform || (cs.project === 'mobile-chrome' ? 'mobile' : 'desktop');
          const isMob = plat === 'mobile';
          const platBadgeClass = isMob ? 'mobile' : 'desktop';
          const platIcon = isMob ? 'ph-device-mobile' : 'ph-desktop';
          const platLabel = isMob ? 'Mobile' : 'Desktop';
          const specsCount = Array.isArray(cs.specs) ? `${cs.specs.length} files` : (cs.grep ? `Tag: ${cs.grep}` : 'All files');

          return `
            <label class="suite-child-card-label ${isChecked ? 'selected' : ''}">
              <div class="suite-child-card-left">
                <input type="checkbox" class="suite-child-cb suite-child-card-checkbox" value="${escapeHtml(cid)}" ${isChecked ? 'checked' : ''}>
                <div class="suite-child-card-info">
                  <span class="suite-child-card-title">
                    <i class="ph-bold ${platIcon}" style="color:${isMob ? '#10b981' : '#3b82f6'};"></i>
                    ${escapeHtml(cs.label || cid)}
                  </span>
                  <span class="suite-child-card-desc">${escapeHtml(cs.description || `Kịch bản kiểm thử ${platLabel}`)}</span>
                </div>
              </div>
              <div class="suite-child-card-right">
                <span class="suite-child-badge ${platBadgeClass}">${platLabel}</span>
                <span class="suite-child-meta">${escapeHtml(specsCount)}</span>
              </div>
            </label>
          `;
        }).join('');

        childrenList.querySelectorAll('.suite-child-cb').forEach((cb) => {
          cb.addEventListener('change', () => {
            cb.closest('.suite-child-card-label')?.classList.toggle('selected', cb.checked);
            syncCurrentSuiteFromInputs();
          });
        });
      }
    }
  } else {
    // Single suite settings
    const platform = suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop');
    const platDesktopRadio = document.querySelector('input[name="suite-single-platform"][value="desktop"]');
    const platMobileRadio = document.querySelector('input[name="suite-single-platform"][value="mobile"]');

    if (platform === 'mobile') {
      if (platMobileRadio) platMobileRadio.checked = true;
      $('#single-plat-mobile-label')?.classList.add('active');
      $('#single-plat-desktop-label')?.classList.remove('active');
      if ($('#platform-scope-title-text')) $('#platform-scope-title-text').textContent = 'Mobile Web';
    } else {
      if (platDesktopRadio) platDesktopRadio.checked = true;
      $('#single-plat-desktop-label')?.classList.add('active');
      $('#single-plat-mobile-label')?.classList.remove('active');
      if ($('#platform-scope-title-text')) $('#platform-scope-title-text').textContent = 'Desktop Web';
    }

    const workersInput = $('#suite-platform-workers') || $('#suite-field-workers');
    if (workersInput) workersInput.value = suite.workers || 2;

    const vpPreset = suite.viewport?.preset || 'default';
    const vpWidth = suite.viewport?.width || (platform === 'mobile' ? 393 : 1920);
    const vpHeight = suite.viewport?.height || (platform === 'mobile' ? 851 : 1080);

    // Scope mode
    let selectedSpecs = [];
    if (Array.isArray(suite.specs)) selectedSpecs = suite.specs;
    else if (typeof suite.spec === 'string' && suite.spec !== 'all') selectedSpecs = [suite.spec];

    let scopeMode = 'all';
    if (suite.grep && suite.grep.trim().length > 0) scopeMode = 'grep';
    else if (selectedSpecs.length > 0) scopeMode = 'custom';

    const radio = document.querySelector(`input[name="suite-scope-mode"][value="${scopeMode}"]`);
    if (radio) radio.checked = true;

    document.querySelectorAll('.scope-mode-option').forEach((opt) => {
      opt.classList.toggle('active', opt.querySelector('input')?.value === scopeMode);
    });

    const grepBox = $('#suite-grep-box');
    const filesBox = $('#suite-files-box');
    if (grepBox) grepBox.style.display = scopeMode === 'grep' ? 'block' : 'none';
    if (filesBox) filesBox.style.display = scopeMode === 'custom' ? 'flex' : 'none';

    const grepInput = $('#suite-field-grep');
    if (grepInput) grepInput.value = suite.grep || '';

    // Dynamically update platform context (emulation, projects, presets, specs)
    updateSuitePlatformContext(platform, {
      project: suite.project,
      device: suite.device,
      preset: vpPreset,
      width: vpWidth,
      height: vpHeight,
      specs: selectedSpecs
    });

    const customVpBox = $('#suite-platform-custom-vp-box') || $('#suite-custom-vp-box');
    if (customVpBox) customVpBox.style.display = vpPreset === 'custom' ? 'grid' : 'none';
  }

  updateSuiteRunButtonState();
}

function resolveSuiteSpecs(suite, allSuites = suitesCache) {
  if (!suite) return [];
  const allAvailableSpecs = (typeof testCatalog !== 'undefined' && Array.isArray(testCatalog?.specs)) ? testCatalog.specs : [];
  const specTagsMap = (typeof testCatalog !== 'undefined' && testCatalog?.specTags) ? testCatalog.specTags : {};

  // Case 1: Composite Suite (Suite Cha)
  if (suite.type === 'composite' || (Array.isArray(suite.suites) && suite.suites.length > 0)) {
    const childKeys = Array.isArray(suite.suites) ? suite.suites : [];
    const aggregated = [];
    const seenKeys = new Set();

    childKeys.forEach((cid) => {
      const childSuite = allSuites ? allSuites[cid] : null;
      if (!childSuite) return;
      const childSpecs = resolveSuiteSpecs(childSuite, allSuites);
      childSpecs.forEach((item) => {
        const uniqueKey = `${item.path}::${item.platform}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          aggregated.push({
            ...item,
            childOrigin: childSuite.label || cid
          });
        }
      });
    });
    return aggregated;
  }

  // Case 2: Single Suite
  const plat = suite.platform || (suite.project && suite.project.toLowerCase().includes('mobile') ? 'mobile' : 'desktop');

  // 2a. Explicitly selected files
  if (Array.isArray(suite.specs) && suite.specs.length > 0 && suite.specs !== 'all') {
    return suite.specs.map((path) => {
      const isMob = path.includes('mobile');
      const isApi = path.includes('api');
      return {
        path,
        name: path.split('/').pop(),
        platform: isMob ? 'mobile' : (isApi ? 'api' : 'desktop'),
        tags: specTagsMap[path] || [],
        childOrigin: null
      };
    });
  }

  // 2b. Grep by Tag
  if (suite.grep && suite.grep.trim()) {
    const rawGrep = suite.grep.trim();
    const grepParts = rawGrep.split('|').map((s) => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

    return allAvailableSpecs.filter((path) => {
      const isMob = path.includes('mobile');
      if (plat === 'mobile' && !isMob) return false;
      if (plat === 'desktop' && isMob) return false;

      const fileTags = (specTagsMap[path] || []).map((t) => t.toLowerCase().replace(/^@/, ''));
      const fileNameLower = path.toLowerCase();

      return grepParts.some((part) => fileTags.some((t) => t.includes(part)) || fileNameLower.includes(part));
    }).map((path) => {
      const isMob = path.includes('mobile');
      const isApi = path.includes('api');
      return {
        path,
        name: path.split('/').pop(),
        platform: isMob ? 'mobile' : (isApi ? 'api' : 'desktop'),
        tags: specTagsMap[path] || [],
        childOrigin: null
      };
    });
  }

  // 2c. All specs for the suite's platform
  return allAvailableSpecs.filter((path) => {
    const isMob = path.includes('mobile');
    if (plat === 'mobile') return isMob;
    if (plat === 'desktop') return !isMob;
    return true;
  }).map((path) => {
    const isMob = path.includes('mobile');
    const isApi = path.includes('api');
    return {
      path,
      name: path.split('/').pop(),
      platform: isMob ? 'mobile' : (isApi ? 'api' : 'desktop'),
      tags: specTagsMap[path] || [],
      childOrigin: null
    };
  });
}

function renderSuiteScriptsPreview(specs = []) {
  const container = $('#suite-scripts-list');
  const countBadge = $('#suite-scripts-count');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${specs.length} kịch bản`;
  }

  if (specs.length === 0) {
    container.innerHTML = `
      <div class="suite-scripts-empty">
        <i class="ph-bold ph-files"></i>
        <span>Không tìm thấy test script nào khớp với bộ lọc kịch bản này.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = specs.map((item) => {
    const platClass = item.platform || 'desktop';
    const platLabel = platClass.toUpperCase();
    const tagsHtml = (item.tags || []).map((t) => `<span class="suite-script-tag">${escapeHtml(t)}</span>`).join('');
    const originHtml = item.childOrigin ? `<span class="suite-script-origin-pill" title="Thuộc kịch bản con"><i class="ph-bold ph-git-commit"></i> ${escapeHtml(item.childOrigin)}</span>` : '';

    return `
      <div class="suite-script-item" data-path="${escapeHtml(item.path)}" title="Bấm để xem mã nguồn test script">
        <div class="suite-script-main">
          <i class="ph-bold ph-file-js suite-script-icon"></i>
          <div class="suite-script-info">
            <div class="suite-script-name-row">
              <span class="suite-script-badge ${platClass}">${platLabel}</span>
              <span class="suite-script-name">${escapeHtml(item.name || item.path.split('/').pop())}</span>
              ${originHtml}
            </div>
            <span class="suite-script-path">${escapeHtml(item.path)}</span>
            ${tagsHtml ? `<div class="suite-script-tags">${tagsHtml}</div>` : ''}
          </div>
        </div>
        <div class="suite-script-actions" onclick="event.stopPropagation();">
          <button type="button" class="btn-icon-subtle btn-copy-spec-path" data-path="${escapeHtml(item.path)}" title="Sao chép đường dẫn file">
            <i class="ph-bold ph-copy"></i>
          </button>
          <button type="button" class="btn-icon-subtle btn-open-spec-code" data-path="${escapeHtml(item.path)}" title="Xem mã nguồn">
            <i class="ph-bold ph-code"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function openSuiteSpecModal(filePath) {
  if (!filePath) return;
  const modal = $('#modal-suite-spec-viewer');
  if (!modal) return;

  const fileName = filePath.split('/').pop();
  $('#suite-spec-modal-title').textContent = fileName;
  $('#suite-spec-modal-path').textContent = filePath;
  const isMob = filePath.includes('mobile');
  const isApi = filePath.includes('api');
  const plat = isMob ? 'mobile' : (isApi ? 'api' : 'desktop');
  const badge = $('#suite-spec-modal-badge');
  if (badge) {
    badge.className = `suite-script-badge ${plat}`;
    badge.textContent = plat.toUpperCase();
  }
  const codeEl = $('#suite-spec-modal-code');
  if (codeEl) codeEl.textContent = 'Đang tải mã nguồn test script...';
  $('#suite-spec-modal-meta').textContent = 'Đang tải...';

  modal.showModal();

  try {
    const res = await request(`/api/code?path=${encodeURIComponent(filePath)}`);
    const content = res.content || '';
    const lineCount = content.split('\n').length;
    $('#suite-spec-modal-meta').textContent = `${lineCount} dòng · JavaScript`;
    if (codeEl) {
      codeEl.innerHTML = highlightCode(content, 'javascript');
    }
  } catch (err) {
    if (codeEl) codeEl.textContent = `// Lỗi tải file: ${err.message}`;
    notify(`Không thể tải mã nguồn: ${err.message}`);
  }
}

function updateSuitePreview(id, suite) {
  if (!suite) return;

  const cardsContainer = $('#suite-matrix-cards');
  const cliBox = $('#suite-cli-command');
  const summaryPill = $('#suite-matrix-summary-pill');
  const isComposite = suite.type === 'composite';

  if (isComposite) {
    if (summaryPill) {
      summaryPill.innerHTML = `<i class="ph-bold ph-folders"></i> <span>Suite Tổng Hợp</span>`;
    }

    const childIds = Array.isArray(suite.suites) ? suite.suites : [];
    const allChildSuites = suitesCache || {};

    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="suite-matrix-composite-card">
          <div class="matrix-composite-head">
            <div class="matrix-composite-title">
              <i class="ph-bold ph-lightning" style="color:var(--accent);"></i>
              <span>Kịch bản tổng hợp: <strong>${escapeHtml(suite.label || id)}</strong></span>
            </div>
            <span class="suite-type-badge composite">${childIds.length} Suites con</span>
          </div>
          <div class="matrix-composite-children-list">
            ${childIds.length === 0 ? '<div style="color:var(--muted); font-size:11.5px; padding:8px;">Chưa chọn kịch bản con nào.</div>' : childIds.map((cid) => {
              const cs = allChildSuites[cid] || {};
              const plat = cs.platform || (cs.project === 'mobile-chrome' ? 'mobile' : 'desktop');
              const isMob = plat === 'mobile';
              const platIcon = isMob ? 'ph-device-mobile' : 'ph-desktop';
              return `
                <div class="matrix-child-row">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <i class="ph-bold ${platIcon}" style="color:${isMob ? '#10b981' : '#3b82f6'};"></i>
                    <strong>${escapeHtml(cs.label || cid)}</strong>
                    <small>(${cs.project || 'all'})</small>
                  </div>
                  <span class="suite-child-badge ${isMob ? 'mobile' : 'desktop'}">${plat.toUpperCase()}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (cliBox) {
      cliBox.textContent = `node scripts/run-suite.js ${id} qc`;
    }
  } else {
    const platform = suite.platform || (suite.project === 'mobile-chrome' ? 'mobile' : 'desktop');
    const isMob = platform === 'mobile';

    if (summaryPill) {
      summaryPill.innerHTML = `<i class="ph-bold ${isMob ? 'ph-device-mobile' : 'ph-desktop'}"></i> <span>Suite ${isMob ? 'Mobile' : 'Desktop'}</span>`;
    }

    const vpPreset = suite.viewport?.preset || 'default';
    const vpText = vpPreset === 'custom'
      ? `${suite.viewport?.width || 1920}x${suite.viewport?.height || 1080}`
      : (vpPreset !== 'default' ? vpPreset : (isMob ? '393x851' : '1920x1080'));

    let scopeText = 'Toàn bộ dự án';
    if (suite.grep && suite.grep.trim()) scopeText = `Tag: ${suite.grep.trim()}`;
    else if (Array.isArray(suite.specs) && suite.specs.length > 0) scopeText = `${suite.specs.length} files`;

    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="suite-matrix-platform-card">
          <div class="matrix-card-head">
            <div class="matrix-card-title">
              <i class="ph-bold ${isMob ? 'ph-device-mobile' : 'ph-desktop'}"></i>
              <strong>${escapeHtml(suite.label || id)}</strong>
            </div>
            <span class="matrix-card-status-tag active">${isMob ? 'Mobile Web' : 'Desktop Web'}</span>
          </div>
          <div class="matrix-card-grid">
            <div><small>Browser / Project</small><span>${escapeHtml(suite.project || 'all')}</span></div>
            <div><small>Luồng chạy</small><span>${suite.workers || 2} workers</span></div>
            <div><small>Độ phân giải</small><span>${escapeHtml(vpText)}</span></div>
            <div><small>Phạm vi test</small><span>${escapeHtml(scopeText)}</span></div>
          </div>
        </div>
      `;
    }

    const cliParts = ['npx playwright test'];
    if (Array.isArray(suite.specs) && suite.specs.length > 0) {
      cliParts.push(suite.specs.join(' '));
    }
    if (suite.project && suite.project !== 'all') {
      cliParts.push(`--project="${suite.project}"`);
    }
    if (suite.grep && suite.grep.trim()) {
      cliParts.push(`--grep="${suite.grep.trim()}"`);
    }
    if (suite.workers) {
      cliParts.push(`--workers=${suite.workers}`);
    }

    if (cliBox) {
      cliBox.textContent = cliParts.join(' ');
    }
  }

  // Live render the test scripts box for this suite
  try {
    const resolvedSpecs = resolveSuiteSpecs(suite, suitesCache);
    renderSuiteScriptsPreview(resolvedSpecs);
  } catch (err) {
    console.warn('[Suite Preview] Error resolving test scripts:', err);
  }
}

function syncCurrentSuiteFromInputs() {
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) return;

  const kindRadio = document.querySelector('input[name="suite-form-kind"]:checked');
  const isComposite = kindRadio ? kindRadio.value === 'composite' : (suitesCache[currentSelectedSuiteId].type === 'composite');

  const label = $('#suite-field-label')?.value.trim() || 'Kịch bản mới';
  const newKey = $('#suite-field-key')?.value.trim() || currentSelectedSuiteId;
  const description = $('#suite-field-desc')?.value.trim() || '';

  let updatedSuite = {};

  if (isComposite) {
    const workers = parseInt($('#suite-composite-workers')?.value, 10) || 2;
    const selectedChildSuites = Array.from(document.querySelectorAll('#suite-composite-children-list .suite-child-cb:checked')).map((cb) => cb.value);

    updatedSuite = {
      type: 'composite',
      label,
      description,
      suites: selectedChildSuites,
      workers
    };
  } else {
    const platRadio = document.querySelector('input[name="suite-single-platform"]:checked');
    const platform = platRadio ? platRadio.value : 'desktop';
    const project = ($('#suite-platform-project') || $('#suite-field-project'))?.value || (platform === 'mobile' ? 'mobile-chrome' : 'chromium');
    const device = $('#suite-platform-device')?.value.trim() || '';
    const workers = parseInt(($('#suite-platform-workers') || $('#suite-field-workers'))?.value, 10) || 2;
    const vpPreset = ($('#suite-platform-viewport-preset') || $('#suite-field-viewport-preset'))?.value || 'default';
    const vpWidth = parseInt(($('#suite-platform-vp-width') || $('#suite-field-vp-width'))?.value, 10) || (platform === 'mobile' ? 393 : 1920);
    const vpHeight = parseInt(($('#suite-platform-vp-height') || $('#suite-field-vp-height'))?.value, 10) || (platform === 'mobile' ? 851 : 1080);

    const scopeRadio = document.querySelector('input[name="suite-scope-mode"]:checked');
    const scopeMode = scopeRadio ? scopeRadio.value : 'all';

    let grep = '';
    let specs = 'all';
    let spec = 'all';

    if (scopeMode === 'grep') {
      grep = $('#suite-field-grep')?.value.trim() || '';
    } else if (scopeMode === 'custom') {
      const checked = Array.from(document.querySelectorAll('#suite-specs-checklist-container .suite-spec-cb:checked')).map((cb) => cb.value);
      if (checked.length > 0) {
        specs = checked;
        spec = checked.length === 1 ? checked[0] : 'custom';
      }
      const countLabel = $('#suite-specs-count-label');
      if (countLabel) countLabel.textContent = `Đã chọn: ${checked.length} file`;
    }

    updatedSuite = {
      type: 'single',
      platform,
      label,
      description,
      project,
      device,
      workers,
      viewport: { preset: vpPreset, width: vpWidth, height: vpHeight },
      spec,
      specs,
      grep
    };
  }

  if (newKey !== currentSelectedSuiteId) {
    delete suitesCache[currentSelectedSuiteId];
    currentSelectedSuiteId = newKey;
  }
  suitesCache[currentSelectedSuiteId] = updatedSuite;

  if ($('#suite-active-title')) $('#suite-active-title').textContent = label;
  if ($('#suite-active-key-label')) $('#suite-active-key-label').textContent = currentSelectedSuiteId;

  renderSuitesSidebarList();
  renderSuiteDropdown();
  updateSuitePreview(currentSelectedSuiteId, updatedSuite);

  if (!window.dashboardSuites) window.dashboardSuites = {};
  window.dashboardSuites[currentSelectedSuiteId] = updatedSuite;
  renderRunnerSuiteOptions(window.dashboardSuites, currentSelectedSuiteId);
  updateSuiteRunButtonState();
}

function createNewSuite() {
  const newId = `suite-${Date.now().toString(36)}`;
  const newSuite = {
    type: 'single',
    platform: 'desktop',
    label: 'Kịch bản mới',
    description: '',
    project: 'chromium',
    device: '',
    workers: 2,
    viewport: { preset: '1920x1080', width: 1920, height: 1080 },
    spec: 'all',
    specs: 'all',
    grep: ''
  };

  suitesCache[newId] = newSuite;
  currentSelectedSuiteId = newId;

  renderSuitesView(suitesCache);

  setTimeout(() => {
    const lbl = $('#suite-field-label');
    if (lbl) {
      lbl.focus();
      lbl.select();
    }
  }, 60);

  notify('Đã tạo kịch bản Test Suite mới.');
}

function duplicateCurrentSuite() {
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) return;
  const orig = suitesCache[currentSelectedSuiteId];
  const newId = `suite-${Date.now().toString(36)}`;
  const cloned = JSON.parse(JSON.stringify(orig));
  cloned.label = `${orig.label || 'Kịch bản'} (Bản sao)`;

  suitesCache[newId] = cloned;
  currentSelectedSuiteId = newId;

  renderSuitesView(suitesCache);
  notify(`Đã nhân bản kịch bản thành "${cloned.label}".`);
}

function deleteCurrentSuite() {
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) return;
  const label = suitesCache[currentSelectedSuiteId].label || currentSelectedSuiteId;
  delete suitesCache[currentSelectedSuiteId];

  const remainingKeys = Object.keys(suitesCache);
  currentSelectedSuiteId = remainingKeys.length > 0 ? remainingKeys[0] : null;

  renderSuitesView(suitesCache);
  notify(`Đã xóa kịch bản "${label}".`);
}

function runCurrentSuiteNow() {
  if (!currentSelectedSuiteId || !suitesCache[currentSelectedSuiteId]) return;
  syncCurrentSuiteFromInputs();

  if (isCurrentSuiteDirty()) {
    notify('Kịch bản Test Suite đang có thay đổi chưa lưu. Vui lòng bấm "Lưu thay đổi" trước khi chạy.', 'warning');
    const saveBtn = $('#suites-save-btn');
    if (saveBtn) {
      saveBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      saveBtn.classList.remove('btn-highlight-pulse');
      void saveBtn.offsetWidth; // trigger reflow
      saveBtn.classList.add('btn-highlight-pulse');
      setTimeout(() => saveBtn.classList.remove('btn-highlight-pulse'), 2000);
    }
    return;
  }

  const suite = suitesCache[currentSelectedSuiteId];
  const runnerSelect = $('#runner-suite-select');
  if (runnerSelect) {
    runnerSelect.value = currentSelectedSuiteId;
    updateSuiteSummaryBox(currentSelectedSuiteId);
  }
  setRunnerMode('suite');
  document.querySelector('.view-tab[data-view="runner-view"]')?.click();
  notify(`Đã nạp kịch bản "${suite.label || currentSelectedSuiteId}" vào Chạy test.`);
}

function initSuitesView() {
  if (suitesViewInitialized) return;
  suitesViewInitialized = true;


  // Suites Sidebar Search & Filter Pills
  $('#suites-search-input')?.addEventListener('input', (e) => {
    currentSuiteSearch = e.target.value;
    renderSuitesSidebarList();
  });

  document.querySelectorAll('.suite-filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.suite-filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentSuiteFilter = pill.dataset.filter || 'all';
      renderSuitesSidebarList();
    });
  });

  $('#suites-refresh-btn')?.addEventListener('click', () => {
    renderSuitesSidebarList();
    notify('Đã làm mới danh sách Test Suite.');
  });

  // Suites Sidebar Collapse / Expand toggles
  const suitesWorkspace = $('#suites-workspace');
  const toggleSuitesSidebar = () => {
    if (suitesWorkspace) {
      suitesWorkspace.classList.toggle('sidebar-collapsed');
    }
  };

  $('#btn-collapse-suites-sidebar')?.addEventListener('click', () => {
    suitesWorkspace?.classList.add('sidebar-collapsed');
  });

  $('#btn-expand-suites-sidebar')?.addEventListener('click', () => {
    suitesWorkspace?.classList.remove('sidebar-collapsed');
  });

  $('#btn-toggle-suites-sidebar-head')?.addEventListener('click', toggleSuitesSidebar);

  // Dropdown Picker change
  $('#suite-picker-select')?.addEventListener('change', (e) => {
    const chosenId = e.target.value;
    if (chosenId && suitesCache[chosenId]) {
      selectSuite(chosenId);
    }
  });

  // Top action buttons
  $('#suites-subnav-create')?.addEventListener('click', createNewSuite);
  $('#suites-subnav-duplicate-btn')?.addEventListener('click', duplicateCurrentSuite);
  $('#suites-subnav-delete-btn')?.addEventListener('click', deleteCurrentSuite);
  $('#suites-subnav-sync-btn')?.addEventListener('click', () => {
    document.getElementById('sync-git-button')?.click();
  });
  $('#suites-subnav-run-btn')?.addEventListener('click', runCurrentSuiteNow);

  // Save Settings button
  $('#suites-save-btn')?.addEventListener('click', async () => {
    const btn = $('#suites-save-btn');
    if (btn) btn.disabled = true;
    try {
      syncCurrentSuiteFromInputs();
      await saveSettings();
      updateSuiteRunButtonState();
      notify('Đã lưu toàn bộ cấu hình Test Suites thành công!');
    } catch (err) {
      notify(`Lỗi lưu Test Suites: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
      updateSuiteRunButtonState();
    }
  });

  $('#suites-sync-git-btn')?.addEventListener('click', () => {
    document.getElementById('sync-git-button')?.click();
  });

  $('#suite-btn-copy-cli')?.addEventListener('click', () => {
    const cmd = $('#suite-cli-command')?.textContent || '';
    if (cmd) {
      navigator.clipboard?.writeText(cmd);
      notify('Đã sao chép lệnh terminal Playwright CLI!');
    }
  });

  $('#suite-btn-copy-all-specs')?.addEventListener('click', () => {
    const specItems = Array.from(document.querySelectorAll('#suite-scripts-list .suite-script-item'));
    const paths = specItems.map((el) => el.dataset.path).filter(Boolean);
    if (paths.length === 0) {
      notify('Không có test script nào để sao chép.');
      return;
    }
    navigator.clipboard?.writeText(paths.join(' '));
    notify(`Đã sao chép đường dẫn của ${paths.length} test script!`);
  });

  $('#suite-scripts-list')?.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.btn-copy-spec-path');
    if (copyBtn) {
      const path = copyBtn.dataset.path;
      if (path) {
        navigator.clipboard?.writeText(path);
        notify(`Đã sao chép: ${path}`);
      }
      return;
    }

    const item = e.target.closest('.suite-script-item');
    if (item) {
      const path = item.dataset.path;
      if (path) {
        openSuiteSpecModal(path);
      }
    }
  });

  $('#suite-spec-modal-copy-btn')?.addEventListener('click', () => {
    const code = $('#suite-spec-modal-code')?.textContent || '';
    if (code) {
      navigator.clipboard?.writeText(code);
      notify('Đã sao chép toàn bộ mã nguồn test script!');
    }
  });

  // Suite Kind radio pills (single vs composite)
  document.querySelectorAll('input[name="suite-form-kind"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isComp = radio.value === 'composite';
      $('#suite-kind-pill-composite')?.classList.toggle('active', isComp);
      $('#suite-kind-pill-single')?.classList.toggle('active', !isComp);
      if ($('#suite-single-section')) $('#suite-single-section').style.display = isComp ? 'none' : 'block';
      if ($('#suite-composite-section')) $('#suite-composite-section').style.display = isComp ? 'block' : 'none';
      syncCurrentSuiteFromInputs();
    });
  });

  // Single platform radio pills (desktop vs mobile)
  document.querySelectorAll('input[name="suite-single-platform"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isMob = radio.value === 'mobile';
      const plat = isMob ? 'mobile' : 'desktop';
      $('#single-plat-mobile-label')?.classList.toggle('active', isMob);
      $('#single-plat-desktop-label')?.classList.toggle('active', !isMob);
      if ($('#platform-scope-title-text')) {
        $('#platform-scope-title-text').textContent = isMob ? 'Mobile Web' : 'Desktop Web';
      }

      // Collect current selected specs if any
      const currentCheckedSpecs = Array.from(document.querySelectorAll('#suite-specs-checklist-container .suite-spec-cb:checked')).map((cb) => cb.value);

      // Re-render context options for the newly chosen platform
      updateSuitePlatformContext(plat, {
        preset: isMob ? 'default' : '1920x1080',
        width: isMob ? 393 : 1920,
        height: isMob ? 851 : 1080,
        specs: currentCheckedSpecs
      });

      syncCurrentSuiteFromInputs();
    });
  });

  // Inputs live sync
  const syncFieldSelectors = [
    '#suite-field-label',
    '#suite-field-key',
    '#suite-field-desc',
    '#suite-platform-project',
    '#suite-platform-device',
    '#suite-platform-workers',
    '#suite-platform-viewport-preset',
    '#suite-platform-vp-width',
    '#suite-platform-vp-height',
    '#suite-composite-workers',
    '#suite-field-grep'
  ];

  syncFieldSelectors.forEach((sel) => {
    $(sel)?.addEventListener('input', syncCurrentSuiteFromInputs);
    $(sel)?.addEventListener('change', syncCurrentSuiteFromInputs);
  });

  // Viewport preset change
  const vpSelect = $('#suite-platform-viewport-preset') || $('#suite-field-viewport-preset');
  vpSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const customBox = $('#suite-platform-custom-vp-box') || $('#suite-custom-vp-box');
    if (customBox) {
      customBox.style.display = val === 'custom' ? 'grid' : 'none';
    }
    if (val && val.includes('x') && val !== 'custom') {
      const [w, h] = val.split('x').map((n) => parseInt(n, 10));
      if (w && h) {
        const wInp = $('#suite-platform-vp-width') || $('#suite-field-vp-width');
        const hInp = $('#suite-platform-vp-height') || $('#suite-field-vp-height');
        if (wInp) wInp.value = w;
        if (hInp) hInp.value = h;
      }
    }
    syncCurrentSuiteFromInputs();
  });

  // Device select change (auto select default preset or update viewport)
  $('#suite-platform-device')?.addEventListener('change', (e) => {
    const dev = e.target.value;
    const devMap = {
      'iPhone 14': [390, 844],
      'iPhone 13': [390, 844],
      'Pixel 7': [393, 851],
      'Galaxy S9+': [360, 740]
    };
    if (devMap[dev]) {
      const [w, h] = devMap[dev];
      const wInp = $('#suite-platform-vp-width') || $('#suite-field-vp-width');
      const hInp = $('#suite-platform-vp-height') || $('#suite-field-vp-height');
      if (wInp) wInp.value = w;
      if (hInp) hInp.value = h;
    }
    syncCurrentSuiteFromInputs();
  });

  // Scope mode radios
  document.querySelectorAll('input[name="suite-scope-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.scope-mode-option').forEach((opt) => {
        opt.classList.toggle('active', opt.querySelector('input') === radio);
      });
      const grepBox = $('#suite-grep-box');
      const filesBox = $('#suite-files-box');
      if (grepBox) grepBox.style.display = radio.value === 'grep' ? 'block' : 'none';
      if (filesBox) filesBox.style.display = radio.value === 'custom' ? 'flex' : 'none';
      syncCurrentSuiteFromInputs();
    });
  });

  // Tag chip suggestions
  document.querySelectorAll('#suite-tag-suggestions .btn-tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const grepInput = $('#suite-field-grep');
      if (grepInput) {
        const tag = chip.dataset.tag || chip.textContent.trim();
        const currentVal = grepInput.value.trim();
        if (!currentVal) {
          grepInput.value = tag;
        } else if (!currentVal.includes(tag)) {
          grepInput.value = `${currentVal} ${tag}`;
        }
        grepInput.dispatchEvent(new Event('input'));
      }
    });
  });

  // Select/Deselect all specs
  $('#btn-suite-select-all')?.addEventListener('click', () => {
    document.querySelectorAll('#suite-specs-checklist-container .suite-spec-cb').forEach((cb) => {
      cb.checked = true;
    });
    syncCurrentSuiteFromInputs();
  });

  $('#btn-suite-deselect-all')?.addEventListener('click', () => {
    document.querySelectorAll('#suite-specs-checklist-container .suite-spec-cb').forEach((cb) => {
      cb.checked = false;
    });
    syncCurrentSuiteFromInputs();
  });

  // Specs search filter
  $('#suite-specs-search-input')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#suite-specs-checklist-container .suite-spec-item').forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
    });
  });
}

function renderSettings(settings) {
  settingsCache = settings;
  savedSuitesCache = JSON.parse(JSON.stringify(settings.suites || {}));
  renderSuitesView(settings.suites || {});
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

  if (settings.discord) {
    setInputValue('#settings-discord-webhook', settings.discord.webhookUrl);
    setInputValue('#settings-discord-channel', settings.discord.channelName);
    setChecked('#settings-discord-notify-finish', settings.discord.notifyOnFinish);
    setChecked('#settings-discord-notify-fail-only', settings.discord.notifyOnlyOnFailure);
  }

  if (settings.branding) {
    setInputValue('#settings-project-name', settings.branding.projectName);
    setInputValue('#settings-project-subtitle', settings.branding.projectSubtitle);
    setInputValue('#settings-page-title', settings.branding.pageTitle);
    setInputValue('#settings-logo-url', settings.branding.logoUrl);
    setInputValue('#settings-primary-color', settings.branding.primaryColor || '#0A65CC');
    setInputValue('#settings-background-color', settings.branding.backgroundColor || '');
    setInputValue('#settings-font-size', settings.branding.fontSize || '14px');
    if ($('#settings-primary-color-picker') && /^#[0-9A-Fa-f]{6}$/.test(settings.branding.primaryColor)) {
      $('#settings-primary-color-picker').value = settings.branding.primaryColor;
    }
    if ($('#settings-background-color-picker') && /^#[0-9A-Fa-f]{6}$/.test(settings.branding.backgroundColor)) {
      $('#settings-background-color-picker').value = settings.branding.backgroundColor;
    }

    if ($('#brand-name') && settings.branding.projectName) {
      $('#brand-name').textContent = settings.branding.projectName;
    }
    if ($('#brand-subtitle') && settings.branding.projectSubtitle) {
      $('#brand-subtitle').textContent = settings.branding.projectSubtitle;
    }
    if (settings.branding.pageTitle) {
      document.title = settings.branding.pageTitle;
    }

    updateBrandingPreview();
  }
}

function updateBrandingPreview() {
  const name = $('#settings-project-name')?.value.trim() || 'QA Automation Studio';
  const subtitle = $('#settings-project-subtitle')?.value.trim() || 'Playwright Automation Platform';
  const title = $('#settings-page-title')?.value.trim() || name;
  const logoUrl = $('#settings-logo-url')?.value.trim();
  const primaryColor = $('#settings-primary-color')?.value.trim() || '#0A65CC';
  const backgroundColor = $('#settings-background-color')?.value.trim() || '';
  const fontSize = $('#settings-font-size')?.value.trim() || '14px';
  const preview = $('#mockup-window') || $('.branding-preview');
  const logo = $('#branding-preview-logo');
  const favicon = $('#mockup-tab-favicon');

  if (!preview) return;

  if ($('#branding-preview-name')) $('#branding-preview-name').textContent = name;
  if ($('#branding-preview-subtitle')) $('#branding-preview-subtitle').textContent = subtitle;
  if ($('#branding-preview-title')) $('#branding-preview-title').textContent = title;

  if (logo) applyLogoElement(logo, logoUrl);
  if (favicon) applyLogoElement(favicon, logoUrl);
  const brandLogo = $('#brand-logo');
  if (brandLogo) applyLogoElement(brandLogo, logoUrl);

  // Sync primary color
  if (/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    if ($('#settings-primary-color-picker')) $('#settings-primary-color-picker').value = primaryColor;
    const swatchPreview = $('.color-picker-preview');
    if (swatchPreview) swatchPreview.style.backgroundColor = primaryColor;
  }

  document.querySelectorAll('.color-swatch-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === primaryColor.toLowerCase());
  });

  // Sync background color
  const bgPickerPreview = $('.bg-picker-preview');
  if (/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) {
    if ($('#settings-background-color-picker')) $('#settings-background-color-picker').value = backgroundColor;
    if (bgPickerPreview) bgPickerPreview.style.backgroundColor = backgroundColor;
  } else {
    if (bgPickerPreview) bgPickerPreview.style.backgroundColor = 'var(--surface)';
  }

  document.querySelectorAll('.bg-swatch-btn').forEach((btn) => {
    const btnBg = btn.dataset.bg || '';
    btn.classList.toggle('active', btnBg.toLowerCase() === backgroundColor.toLowerCase());
  });

  // Sync font size buttons
  document.querySelectorAll('.font-size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === fontSize);
  });

  if (primaryColor) preview.style.setProperty('--accent', primaryColor);
  else preview.style.removeProperty('--accent');

  const appBody = preview.querySelector('.mockup-app-body');
  if (backgroundColor) {
    preview.style.backgroundColor = backgroundColor;
    if (appBody) appBody.style.backgroundColor = backgroundColor;
  } else {
    preview.style.removeProperty('background-color');
    if (appBody) appBody.style.removeProperty('background-color');
  }

  applyFontScale(preview, fontSize);
}

function collectSettingsPayload() {
  if (typeof syncCurrentSuiteFromInputs === 'function' && currentSelectedSuiteId) {
    syncCurrentSuiteFromInputs();
  }
  const suites = Object.assign({}, suitesCache || settingsCache?.suites || {});

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

  const discord = {
    webhookUrl: $('#settings-discord-webhook')?.value.trim() || '',
    channelName: $('#settings-discord-channel')?.value.trim() || '#qa-automation-reports',
    notifyOnFinish: $('#settings-discord-notify-finish')?.checked === true,
    notifyOnlyOnFailure: $('#settings-discord-notify-fail-only')?.checked === true,
  };

  return {
    suites,
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
    discord,
    artifacts: {
      retentionDays: readNumber('#settings-retention-days'),
      maxReportsPerDay: readNumber('#settings-max-reports-per-day'),
      autoCleanupEvidence: $('#settings-auto-cleanup-evidence').checked,
      autoCleanupReports: $('#settings-auto-cleanup-reports').checked,
    },
    branding: {
      projectName: $('#settings-project-name').value.trim(),
      projectSubtitle: $('#settings-project-subtitle').value.trim(),
      pageTitle: $('#settings-page-title').value.trim(),
      logoUrl: $('#settings-logo-url').value.trim(),
      primaryColor: $('#settings-primary-color').value.trim(),
      backgroundColor: $('#settings-background-color').value.trim(),
      fontSize: $('#settings-font-size').value.trim(),
    },
  };
}

function renderBotSettings(cfg, currentBranch = 'main') {
  if (!cfg) return;
  setInputValue('#settings-bot-token', '');
  const botTokenDesc = $('#settings-bot-token-desc');
  if (botTokenDesc) {
    botTokenDesc.textContent = cfg.hasDiscordToken
      ? `Đã lưu: ${cfg.discordToken} (để trống nếu giữ token cũ)`
      : 'Token xác thực bot (chưa lưu token).';
  }

  setInputValue('#settings-bot-channel-id', cfg.allowedChannelId || '');
  setInputValue('#settings-bot-gh-token', '');
  const ghTokenDesc = $('#settings-bot-gh-token-desc');
  if (ghTokenDesc) {
    ghTokenDesc.textContent = cfg.hasGithubToken
      ? `Đã lưu: ${cfg.githubToken} (để trống nếu giữ token cũ)`
      : 'GitHub Token quyền Workflow Dispatch (chưa lưu token).';
  }

  setInputValue('#settings-bot-gh-owner', cfg.githubOwner || 'hadinhkms');
  setInputValue('#settings-bot-gh-repo', cfg.githubRepo || 'Automation_playwright_SV');
  setInputValue('#settings-bot-gh-workflow', cfg.githubWorkflow || 'discord-run-playwright.yml');
  setInputValue('#settings-bot-gh-ref', cfg.githubRef || 'main');
  setInputValue('#settings-git-current-branch', `${currentBranch} (origin/${currentBranch})`);
}

async function openSettings() {
  try {
    const [settings, botData] = await Promise.all([
      request('/api/settings'),
      request('/api/discord-bot/config').catch(() => null)
    ]);
    renderSettings(settings);
    if (botData?.config) renderBotSettings(botData.config, botData.currentGitBranch);
    if (typeof loadAiSettings === 'function') loadAiSettings().catch(() => null);
  } catch (error) { notify(error.message); }
}

async function saveSettings() {
  const button = $('#save-settings-button');
  button.disabled = true;
  try {
    const botPayload = {
      discordToken: $('#settings-bot-token')?.value.trim() || undefined,
      allowedChannelId: $('#settings-bot-channel-id')?.value.trim(),
      githubToken: $('#settings-bot-gh-token')?.value.trim() || undefined,
      githubOwner: $('#settings-bot-gh-owner')?.value.trim(),
      githubRepo: $('#settings-bot-gh-repo')?.value.trim(),
      githubWorkflow: $('#settings-bot-gh-workflow')?.value.trim(),
      githubRef: $('#settings-bot-gh-ref')?.value.trim(),
    };

    const [result] = await Promise.all([
      request('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectSettingsPayload()),
      }),
      request('/api/discord-bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botPayload),
      }).catch((e) => console.error('Lưu Bot config:', e.message))
    ]);

    renderSettings(result.settings);
    savedSuitesCache = JSON.parse(JSON.stringify(result.settings?.suites || suitesCache));
    updateSuiteRunButtonState();
    if (result.settings.branding) applyAppConfig(result.settings.branding);
    notify(`${result.message} Backup: ${result.backup}`);
    const config = await request('/api/config');
    fillSelect('#environment', config.environments, '');
    if (config.defaults?.environment) $('#environment').value = config.defaults.environment;
    if (config.defaults?.workers) $('#workers').value = config.defaults.workers;

    testCatalog = { specs: config.specs, specProjects: config.specProjects || {}, projects: config.projects || [] };
    window.dashboardSuites = config.suites || {};
    renderRunnerSuiteOptions(window.dashboardSuites);
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
}

$('#sync-git-button')?.addEventListener('click', async () => {
  const btn = $('#sync-git-button');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang đồng bộ...';
  try {
    const result = await request('/api/git/sync', { method: 'POST' });
    notify(result.message || 'Đã đồng bộ hóa Test Suites lên GitHub thành công!');
  } catch (err) {
    notify(`Lỗi đồng bộ Git: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-cloud-arrow-up"></i> Đồng bộ lên GitHub';
  }
});

$('#test-discord-button')?.addEventListener('click', async () => {
  const btn = $('#test-discord-button');
  const webhookUrl = $('#settings-discord-webhook')?.value.trim();
  const channelName = $('#settings-discord-channel')?.value.trim();
  if (!webhookUrl) {
    notify('Vui lòng dán Discord Webhook URL trước khi thử.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang gửi...';
  try {
    const result = await request('/api/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, channelName }),
    });
    notify(result.message || 'Đã gửi tin nhắn thử nghiệm thành công về Discord!');
  } catch (err) {
    notify(`Gửi tin nhắn thử thất bại: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Gửi tin nhắn thử';
  }
});

async function initialize() {
  try {
    const [config, state] = await Promise.all([request('/api/config'), request('/api/state')]);
    if (config.branding) applyAppConfig(config.branding);
    fillSelect('#environment', config.environments, '');
    fillSelect('#project', config.projects, 'Tất cả nhóm test');
    
    testCatalog = {
      specs: config.specs,
      specTags: config.specTags || {},
      availableTags: config.availableTags || [],
      specProjects: config.specProjects || {},
      projects: config.projects || [],
    };
    renderTagChips(config.availableTags || []);
    refreshSpecOptions();

    window.dashboardSuites = config.suites || {};
    renderRunnerSuiteOptions(window.dashboardSuites);

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
    if (event.type === 'recorder_status') onRecorderStatusUpdate(event.payload);
  };
  events.onerror = () => notify('Mất kết nối tới dashboard server.');
}

document.querySelectorAll('.runner-mode-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    setRunnerMode(tab.dataset.mode);
  });
});

document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.manualScope;
    document.querySelectorAll('.runner-scope-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    const fileBox = $('#runner-file-filter-box');
    const grepBox = $('#runner-grep-filter-box');
    if (fileBox) fileBox.style.display = mode === 'file' ? 'block' : 'none';
    if (grepBox) grepBox.style.display = mode === 'grep' ? 'block' : 'none';
    updateManualSpecsPreview();
  });
});

$('#runner-suite-select')?.addEventListener('change', (e) => {
  updateSuiteSummaryBox(e.target.value);
});

document.querySelectorAll('.settings-subtab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.subtab;
    document.querySelectorAll('.settings-subtab').forEach((t) => t.classList.toggle('active', t === tab));
    
    const suitesPanel = document.querySelector('.settings-suites');
    const documentsPanel = document.querySelector('.settings-documents');
    const brandingPanel = document.querySelector('.settings-branding');
    const discordPanel = document.querySelector('.settings-discord');
    const aiPanel = document.querySelector('.settings-ai');
    const runtimePanel = document.querySelector('.settings-runtime');
    const envPanel = document.querySelector('.settings-environments');
    const apiPanel = document.querySelector('.settings-api');
    const artifactsPanel = document.querySelector('.settings-artifacts');

    if (suitesPanel) suitesPanel.hidden = target !== 'suites';
    if (documentsPanel) {
      documentsPanel.hidden = target !== 'documents';
      if (target === 'documents') {
        openSettingsDocuments();
      }
    }
    if (brandingPanel) brandingPanel.hidden = target !== 'branding';
    if (discordPanel) discordPanel.hidden = target !== 'discord';
    if (aiPanel) {
      aiPanel.hidden = target !== 'ai';
      if (target === 'ai') {
        initAiSettings();
      }
    }
    
    const isGeneral = target === 'general';
    if (runtimePanel) runtimePanel.hidden = !isGeneral;
    if (envPanel) envPanel.hidden = !isGeneral;
    if (apiPanel) apiPanel.hidden = !isGeneral;
    if (artifactsPanel) artifactsPanel.hidden = !isGeneral;
  });
});

const AI_PRESETS = {
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIzaSy...',
    keyDesc: 'Lấy API Key tại Google AI Studio (miễn phí, tốc độ cao)',
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-proj-... hoặc sk-...',
    keyDesc: 'Lấy API Key tại OpenAI Platform',
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    keyDesc: 'Lấy API Key tại DeepSeek Platform (rẻ, thông minh)',
  },
  claude: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-...',
    keyDesc: 'Lấy API Key tại Anthropic Console',
  },
  custom: {
    name: 'Tùy chỉnh (OpenAI-Compatible)',
    baseURL: 'http://localhost:11434/v1',
    models: ['qwen2.5-coder:7b', 'llama3.1:8b', 'mistral-nemo'],
    defaultModel: 'qwen2.5-coder:7b',
    keyPlaceholder: 'Bearer Token hoặc để trống nếu local',
    keyDesc: 'Dùng cho Ollama (11434/v1), vLLM, OpenRouter hoặc AI proxy nội bộ',
  },
};

let aiSettingsInitialized = false;

function initAiSettings() {
  if (aiSettingsInitialized) {
    loadAiSettings();
    return;
  }
  aiSettingsInitialized = true;

  const providerSelect = $('#settings-ai-provider');
  const baseUrlInput = $('#settings-ai-base-url');
  const modelPresetSelect = $('#settings-ai-model-preset');
  const customModelInput = $('#settings-ai-custom-model');
  const apiKeyInput = $('#settings-ai-api-key');
  const toggleEyeBtn = $('#toggle-ai-key-vis');
  const pasteKeyBtn = $('#paste-ai-key');
  const testBtn = $('#test-ai-button');
  const saveBtn = $('#save-ai-button');
  const alertBox = $('#settings-ai-status-alert');
  const alertTitle = $('#settings-ai-alert-title');
  const alertMsg = $('#settings-ai-alert-msg');
  const alertClose = $('#settings-ai-alert-close');
  const scopeClient = $('#settings-ai-scope-client');

  function updateModelPresets(provider, selectedModel) {
    const preset = AI_PRESETS[provider] || AI_PRESETS.custom;
    if (!modelPresetSelect) return;
    modelPresetSelect.innerHTML = '';
    preset.models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m + (m === preset.defaultModel ? ' (Mặc định)' : '');
      modelPresetSelect.appendChild(opt);
    });
    const optCustom = document.createElement('option');
    optCustom.value = 'custom';
    optCustom.textContent = 'Tùy chỉnh khác...';
    modelPresetSelect.appendChild(optCustom);

    if (selectedModel && preset.models.includes(selectedModel)) {
      modelPresetSelect.value = selectedModel;
      if (customModelInput) customModelInput.value = selectedModel;
    } else if (selectedModel) {
      modelPresetSelect.value = 'custom';
      if (customModelInput) customModelInput.value = selectedModel;
    } else {
      modelPresetSelect.value = preset.defaultModel;
      if (customModelInput) customModelInput.value = preset.defaultModel;
    }
  }

  providerSelect?.addEventListener('change', () => {
    const p = providerSelect.value;
    const preset = AI_PRESETS[p] || AI_PRESETS.custom;
    if (baseUrlInput) {
      baseUrlInput.placeholder = preset.baseURL;
      if (p !== 'custom') {
        baseUrlInput.value = '';
      } else {
        baseUrlInput.value = preset.baseURL;
      }
    }
    if (apiKeyInput) apiKeyInput.placeholder = preset.keyPlaceholder;
    const desc = $('#settings-ai-key-desc');
    if (desc) desc.textContent = preset.keyDesc;
    updateModelPresets(p, null);
  });

  modelPresetSelect?.addEventListener('change', () => {
    if (modelPresetSelect.value !== 'custom') {
      if (customModelInput) customModelInput.value = modelPresetSelect.value;
    } else {
      if (customModelInput) customModelInput.focus();
    }
  });

  toggleEyeBtn?.addEventListener('click', () => {
    if (!apiKeyInput) return;
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    toggleEyeBtn.innerHTML = isPass ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
  });

  pasteKeyBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && apiKeyInput) {
        apiKeyInput.value = text.trim();
        notify('Đã dán API Key từ Clipboard!');
      }
    } catch {
      notify('Không thể đọc Clipboard. Hãy dán bằng tay (Ctrl+V).');
    }
  });

  alertClose?.addEventListener('click', () => {
    if (alertBox) alertBox.hidden = true;
  });

  function showAlert(success, title, msg) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = `settings-card settings-card-wide settings-ai-alert ${success ? 'settings-ai-alert--success' : 'settings-ai-alert--error'}`;
    const icon = alertBox.querySelector('.settings-ai-alert-icon');
    if (icon) icon.className = success ? 'ph-fill ph-check-circle settings-ai-alert-icon' : 'ph-fill ph-warning-circle settings-ai-alert-icon';
    if (alertTitle) alertTitle.textContent = title;
    if (alertMsg) alertMsg.textContent = msg;
  }

  testBtn?.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Đang kiểm tra...';
    try {
      const payload = {
        provider: providerSelect?.value || 'gemini',
        apiKey: apiKeyInput?.value.trim() || '',
        baseURL: baseUrlInput?.value.trim() || '',
        model: customModelInput?.value.trim() || modelPresetSelect?.value || '',
      };
      const res = await request('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showAlert(true, 'Kết nối thành công!', `${res.message} (Model: ${res.model}, Thời gian phản hồi: ${res.latencyMs}ms)`);
    } catch (err) {
      showAlert(false, 'Kết nối thất bại', err.message || 'Không thể kết nối đến nhà cung cấp AI này.');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="ph-bold ph-plugs"></i> Kiểm tra kết nối';
    }
  });

  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ph ph-spinner-gap spin"></i> Đang lưu...';
    try {
      const isClientScope = scopeClient?.checked;
      const provider = providerSelect?.value || 'gemini';
      const apiKey = apiKeyInput?.value.trim() || '';
      const baseURL = baseUrlInput?.value.trim() || '';
      const model = customModelInput?.value.trim() || modelPresetSelect?.value || '';

      if (isClientScope) {
        if (!apiKey) throw new Error('Vui lòng nhập API Key cho cấu hình cá nhân.');
        const personalConfig = {
          enabled: true,
          provider,
          apiKey,
          baseURL,
          model,
        };
        localStorage.setItem('qa_studio_ai_personal_config', JSON.stringify(personalConfig));
        showAlert(true, 'Đã lưu cấu hình cá nhân', 'Cấu hình AI đã được lưu trên trình duyệt này! Tab AI Agent sẽ ưu tiên dùng key và model này.');
        notify('Đã lưu cấu hình AI cá nhân vào LocalStorage!');
      } else {
        localStorage.removeItem('qa_studio_ai_personal_config');
        const res = await request('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey, baseURL, model }),
        });
        showAlert(true, 'Đã lưu cấu hình máy chủ (.env)', res.message || 'Cấu hình AI đã được cập nhật vào file .env thành công.');
        notify(res.message || 'Đã lưu cấu hình AI vào file .env!');
      }
      await loadAiSettings();
      const refreshBtn = document.getElementById('agent-refresh');
      if (refreshBtn) refreshBtn.click();
    } catch (err) {
      showAlert(false, 'Lỗi lưu cấu hình', err.message);
      notify(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ph-fill ph-floppy-disk"></i> Lưu cấu hình AI';
    }
  });

  loadAiSettings();
}

async function loadAiSettings() {
  const providerSelect = $('#settings-ai-provider');
  const baseUrlInput = $('#settings-ai-base-url');
  const modelPresetSelect = $('#settings-ai-model-preset');
  const customModelInput = $('#settings-ai-custom-model');
  const apiKeyInput = $('#settings-ai-api-key');
  const keyBadge = $('#settings-ai-key-badge');
  const scopeServer = $('#settings-ai-scope-server');
  const scopeClient = $('#settings-ai-scope-client');

  let personal = null;
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage ? localStorage.getItem('qa_studio_ai_personal_config') : null;
    if (raw) personal = JSON.parse(raw);
  } catch {}

  const serverConfig = await request('/api/ai/config').catch(() => ({ provider: 'gemini', model: 'gemini-2.5-flash', hasKey: false }));

  if (personal && personal.enabled && personal.apiKey) {
    if (scopeClient) scopeClient.checked = true;
    if (providerSelect) providerSelect.value = personal.provider || 'gemini';
    if (baseUrlInput) baseUrlInput.value = personal.baseURL || '';
    if (apiKeyInput) apiKeyInput.value = personal.apiKey;
    if (keyBadge) {
      keyBadge.className = 'settings-badge-status settings-badge-status--client';
      keyBadge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Đang dùng Key cá nhân (${personal.apiKey.slice(0, 4)}...${personal.apiKey.slice(-4)})`;
    }
    const preset = AI_PRESETS[personal.provider || 'gemini'] || AI_PRESETS.custom;
    if (baseUrlInput) baseUrlInput.placeholder = preset.baseURL;
    const desc = $('#settings-ai-key-desc');
    if (desc) desc.textContent = preset.keyDesc;
    if (providerSelect) {
      const p = personal.provider || 'gemini';
      const m = personal.model || preset.defaultModel;
      const modelPreset = AI_PRESETS[p] || AI_PRESETS.custom;
      if (modelPresetSelect) {
        modelPresetSelect.innerHTML = '';
        modelPreset.models.forEach((item) => {
          const opt = document.createElement('option');
          opt.value = item;
          opt.textContent = item + (item === modelPreset.defaultModel ? ' (Mặc định)' : '');
          modelPresetSelect.appendChild(opt);
        });
        const optCustom = document.createElement('option');
        optCustom.value = 'custom';
        optCustom.textContent = 'Tùy chỉnh khác...';
        modelPresetSelect.appendChild(optCustom);
        if (modelPreset.models.includes(m)) {
          modelPresetSelect.value = m;
        } else {
          modelPresetSelect.value = 'custom';
        }
      }
      if (customModelInput) customModelInput.value = m;
    }
  } else {
    if (scopeServer) scopeServer.checked = true;
    if (providerSelect) providerSelect.value = serverConfig.provider || 'gemini';
    if (baseUrlInput) {
      const isCustomUrl = serverConfig.provider === 'custom' || (serverConfig.baseURL && (serverConfig.baseURL.includes('googleapis') || serverConfig.baseURL.includes('gemini')));
      baseUrlInput.value = isCustomUrl ? (serverConfig.baseURL || '') : '';
    }
    if (apiKeyInput) apiKeyInput.value = '';
    if (keyBadge) {
      if (serverConfig.hasKey) {
        keyBadge.className = 'settings-badge-status settings-badge-status--server';
        keyBadge.innerHTML = `<i class="ph-fill ph-shield-check"></i> Đã lưu key trong .env (${serverConfig.maskedKey || 'bảo mật'})`;
      } else {
        keyBadge.className = 'settings-badge-status settings-badge-status--empty';
        keyBadge.innerHTML = `<i class="ph-fill ph-x-circle"></i> Chưa cấu hình API Key`;
      }
    }
    const p = serverConfig.provider || 'gemini';
    const preset = AI_PRESETS[p] || AI_PRESETS.custom;
    if (baseUrlInput) baseUrlInput.placeholder = preset.baseURL;
    const desc = $('#settings-ai-key-desc');
    if (desc) desc.textContent = preset.keyDesc;
    const m = serverConfig.model || preset.defaultModel;
    if (modelPresetSelect) {
      modelPresetSelect.innerHTML = '';
      preset.models.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item + (item === preset.defaultModel ? ' (Mặc định)' : '');
        modelPresetSelect.appendChild(opt);
      });
      const optCustom = document.createElement('option');
      optCustom.value = 'custom';
      optCustom.textContent = 'Tùy chỉnh khác...';
      modelPresetSelect.appendChild(optCustom);
      if (preset.models.includes(m)) {
        modelPresetSelect.value = m;
      } else {
        modelPresetSelect.value = 'custom';
      }
    }
    if (customModelInput) customModelInput.value = m;
  }
}

/* ==============================================================================
   DOCS & KNOWLEDGE HUB CONTROLLER (TRUNG TÂM HƯỚNG DẪN STANDALONE)
============================================================================== */
let docsCatalog = [];
let currentDocFile = null;
let currentDocFilter = 'all';
let isDeveloperSession = false;

const DOCS_METADATA = {
  'docs/SETUP_GUIDE.md': {
    title: 'Hướng dẫn cài đặt & sử dụng',
    badge: 'Setup',
    icon: 'ph-bold ph-rocket-launch',
    iconClass: 'type-guide',
    category: 'guides'
  },
  'docs/DISCORD_BOT_SETUP_GUIDE.md': {
    title: 'Cấu hình Bot Discord CI/CD',
    badge: 'Discord',
    icon: 'ph-bold ph-bell-ringing',
    iconClass: 'type-guide',
    category: 'guides'
  },
  'GIT_WORKFLOW.md': {
    title: 'Quy trình Git & Đóng gói Release',
    badge: 'Git',
    icon: 'ph-bold ph-git-branch',
    iconClass: 'type-guide',
    category: 'guides'
  },
  'README.md': {
    title: 'Tổng quan QA Automation Studio',
    badge: 'Overview',
    icon: 'ph-bold ph-book',
    iconClass: 'type-guide',
    category: 'guides'
  },
  'ai/shared/AI_PROMPTS.md': {
    title: 'Playbook Prompt AI Playwright',
    badge: 'Prompt',
    icon: 'ph-bold ph-sparkle',
    iconClass: 'type-prompt',
    category: 'prompts'
  },
  'ai/shared/TEST_AUTOMATION_LESSONS.md': {
    title: 'Bài học kinh nghiệm Test Automation',
    badge: 'Lessons',
    icon: 'ph-bold ph-lightbulb',
    iconClass: 'type-prompt',
    category: 'prompts'
  },
  '.agents/skills/playwright_test/SKILL.md': {
    title: 'Skill: Playwright Test Generator',
    badge: 'Skill',
    icon: 'ph-bold ph-brain',
    iconClass: 'type-skill',
    category: 'skills'
  }
};

const DOC_GROUP_CONFIG = [
  { id: 'guides', title: 'Hướng dẫn & Khởi đầu', icon: 'ph-bold ph-book-open' },
  { id: 'prompts', title: 'Quy tắc & Prompts AI', icon: 'ph-bold ph-sparkle' },
  { id: 'skills', title: 'Bộ Kỹ năng (Skills)', icon: 'ph-bold ph-brain' }
];

function getDocMetadata(filePath) {
  if (DOCS_METADATA[filePath]) return DOCS_METADATA[filePath];
  const filename = filePath.split('/').pop();
  let category = 'guides';
  let iconClass = 'type-guide';
  let icon = 'ph-bold ph-file-text';
  let badge = 'DOC';

  if (filePath.includes('skill')) {
    category = 'skills';
    iconClass = 'type-skill';
    icon = 'ph-bold ph-brain';
    badge = 'SKILL';
  } else if (filePath.includes('prompt') || filePath.includes('rules')) {
    category = 'prompts';
    iconClass = 'type-prompt';
    icon = 'ph-bold ph-sparkle';
    badge = 'PROMPT';
  } else if (filePath.includes('agent') || filePath.includes('gemini') || filePath.includes('claude')) {
    category = 'context';
    iconClass = 'type-context';
    icon = 'ph-bold ph-robot';
    badge = 'AGENT';
  }
  return { title: filename, badge, icon, iconClass, category };
}

async function openDocsView(targetDoc = null) {
  try {
    const res = await request('/api/resources');
    docsCatalog = res.documents || [];
    isDeveloperSession = Boolean(res.isDeveloper);
    updateDocsRoleIndicator();
    initDocsSubnav();
    initPromptHub();
    initCliCheatSheet();
    renderDocsTreeList($('#docs-search-input')?.value || '', currentDocFilter);

    if (targetDoc) {
      switchDocsSubtab('guides');
      await loadDocFile(targetDoc);
    } else {
      switchDocsSubtab(currentDocsSubtab || 'prompts');
      const docToLoad = currentDocFile || (docsCatalog.includes('docs/SETUP_GUIDE.md') ? 'docs/SETUP_GUIDE.md' : docsCatalog[0]);
      if (docToLoad) {
        await loadDocFile(docToLoad);
      }
    }
  } catch (err) {
    notify(`Lỗi nạp thư viện tài liệu: ${err.message}`);
  }
}

let currentDocsSubtab = 'prompts';
let currentBuilderType = 'bdd_spec';
let currentPromptFilter = 'all';
let currentCliFilter = 'all';

const CURATED_PROMPTS = [
  {
    id: 'bdd_spec',
    category: 'spec',
    badge: 'BDD SPEC',
    icon: 'ph-bold ph-tree-structure',
    title: 'Viết Kịch Bản BDD E2E Mới',
    desc: 'Sinh file kịch bản .spec.js chuẩn BDD với các bước Given/When/Then, gắn tag Precondition và gọi Page Object Model.',
    template: `Đóng vai Senior Automation QA Lead tuân thủ nghiêm ngặt ai/shared/AI_PROMPTS.md và ai/shared/TEST_AUTOMATION_LESSONS.md.
Hãy viết kịch bản Playwright E2E cho tính năng: "{FEATURE}"
- Tiền điều kiện: {PRECONDITION}
- Các bước thực hiện:
{STEPS}

Yêu cầu kỹ thuật bắt buộc:
1. Đặt trong tests/e2e/{FEATURE_SLUG}.spec.js
2. Gắn tag: testInfo.annotations.push({ type: 'Precondition', description: '{PRECONDITION}' })
3. Tách bạch các bước bằng await test.step('Given...', async () => {}), When, Then
4. Không gọi trực tiếp page.locator() trong spec, toàn bộ locator phải thuộc Page Object trong pages/
5. Dữ liệu kiểm thử đọc từ data/ hoặc test fixture`
  },
  {
    id: 'page_object',
    category: 'pom',
    badge: 'PAGE OBJECT',
    icon: 'ph-bold ph-browsers',
    title: 'Tạo / Cập Nhật Page Object Model',
    desc: 'Tạo class Page Object chứa locator an toàn, methods tương tác tái sử dụng UiActions trong core/utils/commonUtils.js.',
    template: `Đóng vai Senior Automation QA Engineer, hãy tạo Page Object Model cho trang/chức năng: "{FEATURE}"
File đích: pages/{FEATURE_CLASS}Page.js

Yêu cầu quy chuẩn:
1. Export class {FEATURE_CLASS}Page có constructor(page).
2. Định nghĩa selector/locator bằng data-testid, aria-label, hoặc css bền vững (không dùng dynamic id).
3. Các action method tái sử dụng UiActions trong core/utils/commonUtils.js nếu phù hợp.
4. Viết sẵn assertion method rõ ràng (ví dụ expectVisible(), expectSuccessToast(), expectNavigationTo()).
5. Tuyệt đối không gọi page.waitForTimeout(), sử dụng auto-wait của Playwright.`
  },
  {
    id: 'fix_flaky',
    category: 'heal',
    badge: 'SELF-HEALING',
    icon: 'ph-bold ph-first-aid',
    title: 'Chẩn Đoán & Sửa Lỗi Test Flaky',
    desc: 'Tự động phân tích console log, timeout hoặc screenshot lỗi để vá locator và xử lý timing race condition.',
    template: `Đóng vai Chuyên gia Tối ưu hóa Test Automation, hãy phân tích và sửa lỗi cho kịch bản sau:
File lỗi: tests/e2e/{FEATURE_SLUG}.spec.js
Chi tiết lỗi / Log terminal:
{STEPS}

Quy chuẩn khắc phục (ai/shared/TEST_AUTOMATION_LESSONS.md):
1. Không thêm page.waitForTimeout() để giải quyết tạm thời.
2. Kiểm tra animation, backdrop modal hoặc timing chuyển trang (ưu tiên page.waitForURL hoặc locator.waitFor).
3. Đảm bảo trạng thái tiền điều kiện (Precondition) và authState hợp lệ trước khi thao tác.
4. Trả về file diff rõ ràng và giải thích nguyên nhân gốc rễ (Root Cause).`
  },
  {
    id: 'test_data',
    category: 'data',
    badge: 'TEST DATA',
    icon: 'ph-bold ph-database',
    title: 'Sinh Bộ Dữ Liệu Kiểm Thử JSON',
    desc: 'Sinh tập dữ liệu đa trường hợp (Happy path, Boundary validation, Ký tự đặc biệt, XSS check) lưu vào data/*.json.',
    template: `Đóng vai QA Data Analyst, hãy sinh bộ dữ liệu kiểm thử (Test Data) chuẩn JSON cho tính năng: "{FEATURE}"
File đích: data/{FEATURE_SLUG}.json

Cấu trúc yêu cầu:
{
  "valid_candidates": [ /* 3 bộ dữ liệu đầy đủ trường hợp hợp lệ */ ],
  "boundary_cases": [ /* Giá trị biên: độ dài min/max, chữ hoa, chữ thường, số, ký tự đặc biệt */ ],
  "invalid_cases": [ /* Email sai định dạng, mật khẩu yếu, số điện thoại thiếu số */ ],
  "security_payloads": [ /* Thử nghiệm ký tự nhạy cảm <script>, SQL injection quotes */ ]
}
Đảm bảo định dạng JSON hợp lệ 100% để import trực tiếp vào Playwright spec.`
  },
  {
    id: 'qa_audit',
    category: 'qa',
    badge: 'QA AUDIT',
    icon: 'ph-bold ph-shield-check',
    title: 'Senior QA Review & Quality Gate Audit',
    desc: 'Audit toàn diện test script trước khi commit: phát hiện hardcode URL, catch rỗng, vi phạm POM và rò rỉ bộ nhớ.',
    template: `Hãy đóng vai Senior QA Engineer với hơn 10 năm kinh nghiệm kiểm thử Playwright.
Thực hiện Audit toàn diện file kịch bản: "{FEATURE}"
File nội dung:
{STEPS}

Kiểm tra nghiêm ngặt các tiêu chí sau:
1. Quality Gate: Không hardcode URL (phải qua baseURL), không dùng waitForTimeout(), không catch {} rỗng.
2. Cấu trúc: Tách bạch rõ ràng giữa Spec (tests/) và Page Object (pages/).
3. Assertion: Có kiểm tra trạng thái ở bước Given (Precondition check) và có chụp screenshot bằng chứng không?
4. Đánh giá chất lượng (Pass/Fail) và đưa ra code refactor tối ưu nhất.`
  },
  {
    id: 'api_spec',
    category: 'spec',
    badge: 'API SPEC',
    icon: 'ph-bold ph-cloud',
    title: 'Viết Kịch Bản Kiểm Thử API',
    desc: 'Tạo kịch bản kiểm thử API độc lập qua request context của Playwright, kiểm tra status code, schema JSON và response time.',
    template: `Đóng vai Automation QA Lead, hãy viết kịch bản kiểm thử API cho: "{FEATURE}"
Endpoint: /api/{FEATURE_SLUG}
Yêu cầu:
1. Đặt trong tests/e2e/api/{FEATURE_SLUG}.api.spec.js
2. Dùng fixture { request } từ @playwright/test
3. Kiểm tra các mã trạng thái: 200/201 (Thành công), 400 (Dữ liệu không hợp lệ), 401/403 (Chưa xác thực)
4. Validate cấu trúc Schema JSON trả về và thời gian phản hồi (Response Time < 1500ms).`
  }
];

const CLI_COMMANDS = [
  { cmd: 'npm run suite:smoke', group: 'suite', tag: 'Chạy Test Suite', desc: 'Chạy bộ Smoke Tests cơ bản (nhanh nhất, kiểm tra luồng chính của hệ thống)' },
  { cmd: 'npm run suite:regression', group: 'suite', tag: 'Chạy Test Suite', desc: 'Chạy toàn bộ Regression Tests hệ thống cho tất cả kịch bản đã duyệt' },
  { cmd: 'npm run suite:desktop', group: 'suite', tag: 'Chạy Test Suite', desc: 'Chạy toàn bộ kịch bản trên môi trường máy tính (Desktop Chromium)' },
  { cmd: 'npm run suite:mobile', group: 'suite', tag: 'Chạy Test Suite', desc: 'Chạy kịch bản trên giả lập thiết bị di động (Chrome Android & Safari iOS)' },
  { cmd: 'npm run suite:api', group: 'suite', tag: 'Chạy Test Suite', desc: 'Chạy riêng bộ kiểm thử API độc lập không mở giao diện web' },
  { cmd: 'npm run test:ui', group: 'debug', tag: 'Debug & UI Mode', desc: 'Mở giao diện Playwright UI tương tác (Time-travel debugging, xem DOM snapshot)' },
  { cmd: 'npx playwright test --debug', group: 'debug', tag: 'Debug & UI Mode', desc: 'Chạy test ở chế độ gỡ lỗi từng bước với cửa sổ Playwright Inspector' },
  { cmd: 'npx playwright codegen http://localhost:3000', group: 'debug', tag: 'Debug & UI Mode', desc: 'Mở trình duyệt ghi lại thao tác người dùng và tự động sinh code Playwright' },
  { cmd: 'npm run report', group: 'report', tag: 'Báo Cáo', desc: 'Khởi động máy chủ cục bộ mở Playwright HTML Report chi tiết lần chạy gần nhất' },
  { cmd: 'npm run check:framework', group: 'quality', tag: 'Quality Gate', desc: 'Quét tự động toàn bộ test script để phát hiện vi phạm quy chuẩn POM, URL hardcode' },
];

function initDocsSubnav() {
  document.querySelectorAll('.docs-subtab').forEach((tab) => {
    tab.onclick = () => switchDocsSubtab(tab.dataset.docsSubtab);
  });

  const quickPrompts = document.getElementById('pill-quick-prompts');
  const quickCli = document.getElementById('pill-quick-cli');
  const quickGuide = document.getElementById('pill-quick-guide');

  if (quickPrompts) quickPrompts.onclick = () => switchDocsSubtab('prompts');
  if (quickCli) quickCli.onclick = () => switchDocsSubtab('cli');
  if (quickGuide) {
    quickGuide.onclick = async () => {
      switchDocsSubtab('guides');
      await loadDocFile(quickGuide.dataset.quickDoc || 'docs/SETUP_GUIDE.md');
    };
  }
}

function switchDocsSubtab(targetSubtab) {
  if (!targetSubtab) return;
  currentDocsSubtab = targetSubtab;

  document.querySelectorAll('.docs-subtab').forEach((tab) => {
    const isActive = tab.dataset.docsSubtab === targetSubtab;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const panels = {
    prompts: document.getElementById('docs-subpanel-prompts'),
    cli: document.getElementById('docs-subpanel-cli'),
    guides: document.getElementById('docs-subpanel-guides'),
  };

  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) panel.hidden = (key !== targetSubtab);
  });

  const pillPrompts = document.getElementById('pill-quick-prompts');
  const pillCli = document.getElementById('pill-quick-cli');
  if (pillPrompts) pillPrompts.classList.toggle('active', targetSubtab === 'prompts');
  if (pillCli) pillCli.classList.toggle('active', targetSubtab === 'cli');

  if (targetSubtab === 'guides' && !currentDocFile) {
    const defaultDoc = docsCatalog.includes('docs/SETUP_GUIDE.md') ? 'docs/SETUP_GUIDE.md' : docsCatalog[0];
    if (defaultDoc) loadDocFile(defaultDoc);
  }
}

function initPromptHub() {
  updateBuilderPromptPreview();
  renderPromptCards(currentPromptFilter);

  // Builder Type Pills
  document.querySelectorAll('#prompt-builder-type-pills .builder-type-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#prompt-builder-type-pills .builder-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentBuilderType = btn.dataset.type;
      updateBuilderPromptPreview();
    };
  });

  // Builder Input Listeners
  ['builder-input-feature', 'builder-input-precondition', 'builder-input-steps'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = updateBuilderPromptPreview;
    }
  });

  // Builder Copy Button
  const copyBuilderBtn = document.getElementById('btn-copy-builder-prompt');
  if (copyBuilderBtn) {
    copyBuilderBtn.onclick = () => {
      const text = document.getElementById('prompt-preview-box')?.textContent || '';
      if (text) {
        navigator.clipboard?.writeText(text);
        showToast('Đã sao chép Prompt vào bộ nhớ tạm!', 'success');
        copyBuilderBtn.innerHTML = '<i class="ph-bold ph-check"></i> <span>Đã sao chép!</span>';
        setTimeout(() => {
          copyBuilderBtn.innerHTML = '<i class="ph-bold ph-copy"></i> <span>Sao chép Prompt</span>';
        }, 2000);
      }
    };
  }

  // Filter tags for cards
  document.querySelectorAll('#prompt-filter-tags .prompt-tag-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#prompt-filter-tags .prompt-tag-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentPromptFilter = btn.dataset.filter || 'all';
      renderPromptCards(currentPromptFilter);
    };
  });
}

function updateBuilderPromptPreview() {
  const featureInput = document.getElementById('builder-input-feature');
  const preconditionInput = document.getElementById('builder-input-precondition');
  const stepsInput = document.getElementById('builder-input-steps');
  const previewBox = document.getElementById('prompt-preview-box');
  if (!previewBox) return;

  const feature = featureInput?.value.trim() || 'Tính năng kiểm thử';
  const precondition = preconditionInput?.value.trim() || 'Khách vãng lai truy cập từ trang chủ';
  const steps = stepsInput?.value.trim() || '1. Thao tác bước 1\n2. Thao tác bước 2\n3. Kiểm tra kết quả';
  const slug = feature.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'feature';
  const className = feature.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^a-zA-Z0-9]/g, '') || 'Feature';

  const templateObj = CURATED_PROMPTS.find((p) => p.id === currentBuilderType) || CURATED_PROMPTS[0];
  let promptText = templateObj.template
    .replace(/\{FEATURE\}/g, feature)
    .replace(/\{PRECONDITION\}/g, precondition)
    .replace(/\{STEPS\}/g, steps)
    .replace(/\{FEATURE_SLUG\}/g, slug)
    .replace(/\{FEATURE_CLASS\}/g, className);

  previewBox.textContent = promptText;
}

function renderPromptCards(filter = 'all') {
  const container = document.getElementById('prompt-cards-grid');
  if (!container) return;

  const filtered = CURATED_PROMPTS.filter((p) => filter === 'all' || p.category === filter);
  container.innerHTML = filtered.map((item) => `
    <div class="prompt-card" data-prompt-id="${item.id}">
      <div class="prompt-card-top">
        <div class="prompt-card-icon-title">
          <span class="prompt-card-icon"><i class="${item.icon}"></i></span>
          <h4 class="prompt-card-title">${escapeHtml(item.title)}</h4>
        </div>
        <span class="prompt-card-badge">${item.badge}</span>
      </div>
      <p class="prompt-card-desc">${escapeHtml(item.desc)}</p>
      <div class="prompt-card-snippet">${escapeHtml(item.template.slice(0, 160))}...</div>
      <div class="prompt-card-actions">
        <button type="button" class="btn-card-copy" data-copy-prompt-id="${item.id}">
          <i class="ph-bold ph-copy"></i> Sao chép Prompt
        </button>
        <button type="button" class="btn-card-load" data-load-builder-id="${item.id}" title="Nạp mẫu này vào Trình tạo Prompt để tùy chỉnh">
          <i class="ph-bold ph-arrow-up-right"></i> Nạp Builder
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-copy-prompt-id]').forEach((btn) => {
    btn.onclick = () => {
      const item = CURATED_PROMPTS.find((p) => p.id === btn.dataset.copyPromptId);
      if (item) {
        navigator.clipboard?.writeText(item.template);
        showToast(`Đã sao chép prompt: ${item.title}!`, 'success');
      }
    };
  });

  container.querySelectorAll('[data-load-builder-id]').forEach((btn) => {
    btn.onclick = () => {
      currentBuilderType = btn.dataset.loadBuilderId;
      document.querySelectorAll('#prompt-builder-type-pills .builder-type-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.type === currentBuilderType);
      });
      updateBuilderPromptPreview();
      document.querySelector('.prompt-builder-card')?.scrollIntoView({ behavior: 'smooth' });
      showToast('Đã nạp mẫu vào Trình tạo Prompt!', 'info');
    };
  });
}

function initCliCheatSheet() {
  renderCliCheatSheet(currentCliFilter);

  document.querySelectorAll('#cli-filter-tags .cli-tag-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#cli-filter-tags .cli-tag-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCliFilter = btn.dataset.filter || 'all';
      renderCliCheatSheet(currentCliFilter);
    };
  });
}

function renderCliCheatSheet(filter = 'all') {
  const tbody = document.getElementById('cli-cheatsheet-tbody');
  if (!tbody) return;

  const filtered = CLI_COMMANDS.filter((c) => filter === 'all' || c.group === filter);
  tbody.innerHTML = filtered.map((item) => `
    <tr>
      <td>
        <span class="cli-cmd-pill"><code>${escapeHtml(item.cmd)}</code></span>
      </td>
      <td>${escapeHtml(item.desc)}</td>
      <td>
        <span class="cli-group-pill ${item.group}">${escapeHtml(item.tag)}</span>
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-cli-copy" data-cli-cmd="${escapeHtml(item.cmd)}">
          <i class="ph-bold ph-copy"></i> Copy
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-cli-cmd]').forEach((btn) => {
    btn.onclick = () => {
      navigator.clipboard?.writeText(btn.dataset.cliCmd);
      showToast(`Đã sao chép: ${btn.dataset.cliCmd}`, 'success');
    };
  });
}

function updateDocsRoleIndicator() {
  const rolePill = document.getElementById('docs-role-pill');
  if (rolePill) rolePill.remove();
}

function renderDocsTreeList(query = '', filter = 'all') {
  const container = document.getElementById('docs-tree-list');
  const countEl = document.getElementById('docs-total-count');
  if (!container) return;

  const q = query.trim().toLowerCase();
  let filtered = docsCatalog.filter((f) => {
    const meta = getDocMetadata(f);
    const matchesFilter = (filter === 'all' || meta.category === filter);
    const matchesQuery = !q || f.toLowerCase().includes(q) || meta.title.toLowerCase().includes(q) || meta.badge.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (countEl) {
    countEl.innerHTML = `<i class="ph-bold ph-files"></i> ${docsCatalog.length} tài liệu`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 28px 16px; text-align: center; color: var(--muted); font-size: 12.5px;">
        <i class="ph ph-file-search" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
        Không tìm thấy tài liệu phù hợp.
      </div>`;
    return;
  }

  const grouped = DOC_GROUP_CONFIG.map((group) => {
    const files = filtered.filter((f) => getDocMetadata(f).category === group.id);
    return { ...group, files };
  }).filter((g) => g.files.length > 0);

  container.innerHTML = grouped.map((group) => `
    <div class="doc-tree-group">
      <div class="doc-group-header">
        <span><i class="${group.icon}"></i> ${group.title}</span>
        <span class="group-count">${group.files.length}</span>
      </div>
      ${group.files.map((file) => {
        const meta = getDocMetadata(file);
        const isActive = file === currentDocFile;
        return `
          <button type="button" class="doc-tree-item${isActive ? ' active' : ''}" data-doc-path="${escapeHtml(file)}">
            <span class="doc-item-icon ${meta.iconClass}"><i class="${meta.icon}"></i></span>
            <div class="doc-item-meta">
              <strong class="doc-item-title">${escapeHtml(meta.title)}</strong>
              <small class="doc-item-path">${escapeHtml(file)}</small>
            </div>
            <span class="doc-item-badge">${escapeHtml(meta.badge)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `).join('');

  container.querySelectorAll('[data-doc-path]').forEach((btn) => {
    btn.addEventListener('click', () => loadDocFile(btn.dataset.docPath));
  });
}

function renderDocsToc(markdownBody, bodyContainer) {
  const tocPane = document.getElementById('docs-toc-pane');
  const tocList = document.getElementById('docs-toc-list');
  if (!tocPane || !tocList) return;

  const headings = markdownBody.querySelectorAll('h1, h2, h3');
  if (!headings || headings.length === 0) {
    tocPane.hidden = true;
    return;
  }

  tocPane.hidden = false;
  tocList.innerHTML = '';

  headings.forEach((h, idx) => {
    const text = h.textContent.trim();
    if (!text) return;
    const id = h.id || `doc-heading-${idx}`;
    h.id = id;

    const link = document.createElement('a');
    link.className = `docs-toc-link ${h.tagName.toLowerCase() === 'h3' ? 'is-h3' : ''}`;
    link.textContent = text;
    link.title = text;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      tocList.querySelectorAll('.docs-toc-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
    tocList.appendChild(link);
  });
}

async function loadDocFile(filePath) {
  if (!filePath) return;
  currentDocFile = filePath;

  // Highlight active tree item
  document.querySelectorAll('#docs-tree-list [data-doc-path]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.docPath === filePath);
  });

  const meta = getDocMetadata(filePath);
  const group = DOC_GROUP_CONFIG.find((g) => g.id === meta.category);

  // Update Breadcrumb & Header
  const crumbCategory = document.getElementById('docs-crumb-category');
  const crumbFilename = document.getElementById('docs-crumb-filename');
  const typePill = document.getElementById('docs-type-pill');
  const pathText = document.getElementById('docs-path-text');
  const editorFilepath = document.getElementById('docs-editor-filepath');

  if (crumbCategory) crumbCategory.textContent = group ? group.title : 'Tài liệu';
  if (crumbFilename) crumbFilename.textContent = filePath.split('/').pop();
  if (typePill) typePill.textContent = meta.badge.toUpperCase();
  if (pathText) pathText.textContent = filePath;
  if (editorFilepath) editorFilepath.textContent = filePath;

  // Toggle sections
  const emptyState = document.getElementById('docs-empty-state');
  const bodyContainer = document.getElementById('docs-body-container');
  const editorPane = document.getElementById('docs-editor-pane');
  const markdownBody = document.getElementById('docs-markdown-body');
  const editTextarea = document.getElementById('docs-edit-textarea');

  if (emptyState) emptyState.hidden = true;
  if (editorPane) editorPane.hidden = true;
  if (bodyContainer) bodyContainer.hidden = false;

  try {
    const res = await request(`/api/resource?path=${encodeURIComponent(filePath)}&reveal=true`);
    const editBtn = document.getElementById('doc-btn-edit');
    if (editBtn) {
      if (res.editable) {
        editBtn.disabled = false;
        editBtn.classList.remove('btn-doc-locked');
        editBtn.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> <span>Chỉnh sửa</span>';
        editBtn.title = 'Chỉnh sửa tài liệu này (Quyền Nhà phát triển)';
      } else {
        editBtn.disabled = true;
        editBtn.classList.add('btn-doc-locked');
        editBtn.innerHTML = '<i class="ph-bold ph-lock"></i> <span>Chỉ xem</span>';
        editBtn.title = 'Tài liệu chuẩn của framework được bảo vệ - Chỉ nhà phát triển mới có quyền cập nhật';
      }
    }
    if (markdownBody) {
      markdownBody.innerHTML = renderMarkdown(res.content);
      // Auto-attach copy button to code blocks
      markdownBody.querySelectorAll('pre').forEach((pre) => {
        if (pre.querySelector('.btn-copy-code')) return;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy-code';
        copyBtn.type = 'button';
        copyBtn.title = 'Sao chép đoạn code';
        copyBtn.innerHTML = '<i class="ph-bold ph-copy"></i>';
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const code = pre.querySelector('code')?.innerText || '';
          navigator.clipboard?.writeText(code);
          showToast('Đã sao chép đoạn code!', 'success');
          copyBtn.innerHTML = '<i class="ph-bold ph-check" style="color:#22c55e;"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="ph-bold ph-copy"></i>';
          }, 1500);
        });
        pre.appendChild(copyBtn);
      });
      renderDocsToc(markdownBody, bodyContainer);
      bodyContainer.scrollTop = 0;
    }
    if (editTextarea) editTextarea.value = res.content || '';
  } catch (err) {
    notify(`Lỗi tải tài liệu: ${err.message}`);
  }
}

// Event Listeners for Docs View
document.getElementById('docs-search-input')?.addEventListener('input', (e) => {
  renderDocsTreeList(e.target.value, currentDocFilter);
});

document.querySelectorAll('.doc-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.doc-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentDocFilter = chip.dataset.filter || 'all';
    renderDocsTreeList(document.getElementById('docs-search-input')?.value || '', currentDocFilter);
  });
});

document.getElementById('doc-refresh-btn')?.addEventListener('click', async () => {
  try {
    const res = await request('/api/resources');
    docsCatalog = res.documents || [];
    isDeveloperSession = Boolean(res.isDeveloper);
    updateDocsRoleIndicator();
    renderDocsTreeList(document.getElementById('docs-search-input')?.value || '', currentDocFilter);
    showToast('Đã làm mới danh mục tài liệu!', 'success');
  } catch (err) {
    notify(`Lỗi làm mới: ${err.message}`);
  }
});

function copyDocPath() {
  if (currentDocFile) {
    navigator.clipboard?.writeText(currentDocFile);
    showToast(`Đã sao chép đường dẫn: ${currentDocFile}`, 'success');
  }
}

document.getElementById('doc-btn-copy-path')?.addEventListener('click', copyDocPath);
document.getElementById('docs-path-pill')?.addEventListener('click', copyDocPath);

document.getElementById('doc-btn-copy-content')?.addEventListener('click', () => {
  const content = document.getElementById('docs-edit-textarea')?.value || '';
  if (content) {
    navigator.clipboard?.writeText(content);
    showToast('Đã sao chép toàn bộ nội dung Markdown!', 'success');
  }
});

document.getElementById('doc-btn-edit')?.addEventListener('click', () => {
  if (!currentDocFile) return;
  const editBtn = document.getElementById('doc-btn-edit');
  if (editBtn && editBtn.disabled) {
    showToast('Tài liệu chuẩn được bảo vệ - Chỉ nhà phát triển mới có quyền chỉnh sửa!', 'error');
    return;
  }
  const bodyContainer = document.getElementById('docs-body-container');
  const editorPane = document.getElementById('docs-editor-pane');
  if (bodyContainer) bodyContainer.hidden = true;
  if (editorPane) editorPane.hidden = false;
  document.getElementById('docs-edit-textarea')?.focus();
});

document.getElementById('doc-btn-cancel-edit')?.addEventListener('click', () => {
  const bodyContainer = document.getElementById('docs-body-container');
  const editorPane = document.getElementById('docs-editor-pane');
  if (bodyContainer) bodyContainer.hidden = false;
  if (editorPane) editorPane.hidden = true;
});

document.getElementById('doc-btn-format')?.addEventListener('click', () => {
  const textarea = document.getElementById('docs-edit-textarea');
  if (textarea) {
    textarea.value = formatMarkdownText(textarea.value);
    showToast('Đã tự động định dạng Markdown!', 'success');
  }
});

document.getElementById('doc-btn-save')?.addEventListener('click', async () => {
  const saveBtn = document.getElementById('doc-btn-save');
  if (!currentDocFile) return;
  if (saveBtn) saveBtn.disabled = true;
  try {
    const content = document.getElementById('docs-edit-textarea')?.value || '';
    const headers = { 'Content-Type': 'application/json' };
    if (isDeveloperSession) {
      headers['X-Developer-Mode'] = 'true';
    }
    const result = await request('/api/resource', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ path: currentDocFile, content }),
    });
    showToast(result.message || 'Đã lưu tài liệu thành công!', 'success');
    await loadDocFile(currentDocFile);
  } catch (err) {
    notify(`Lỗi lưu tài liệu: ${err.message}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
});

// Backward compatibility alias for any existing caller
async function openSettingsDocuments() {
  await openDocsView();
}
async function loadSettingsDocument(filePath) {
  await loadDocFile(filePath);
}

const GUIDE_STEP_TITLES = {
  1: 'Tạo Bot trên Discord',
  2: 'Lấy Channel ID & Webhook URL',
  3: 'Tạo GitHub Personal Access Token',
  4: 'Cấu hình GitHub Actions Secret',
  5: 'Bật Bot & Bắt Đầu Thưởng Thức!',
};

function setGuideStep(step) {
  const stepNum = parseInt(step, 10) || 1;
  document.querySelectorAll('.guide-nav-btn').forEach((b) => {
    const s = parseInt(b.dataset.guideStep, 10);
    b.classList.toggle('active', s === stepNum);
    b.classList.toggle('completed', s < stepNum);
  });
  document.querySelectorAll('.guide-pane').forEach((p) => {
    p.classList.toggle('active', p.id === `guide-pane-${stepNum}`);
  });
  const numEl = document.getElementById('guide-current-step-num');
  const titleEl = document.getElementById('guide-current-step-title');
  const pctEl = document.getElementById('guide-progress-pct');
  const barEl = document.getElementById('guide-progress-bar-fill');
  if (numEl) numEl.textContent = stepNum;
  if (titleEl) titleEl.textContent = GUIDE_STEP_TITLES[stepNum] || '';
  if (pctEl) pctEl.textContent = `${stepNum * 20}% Hoàn thành`;
  if (barEl) barEl.style.width = `${stepNum * 20}%`;
}

document.querySelectorAll('.guide-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setGuideStep(btn.dataset.guideStep);
  });
});

document.addEventListener('click', (e) => {
  const nextBtn = e.target.closest('[data-next-step]');
  if (nextBtn) {
    setGuideStep(nextBtn.dataset.nextStep);
    return;
  }
  const prevBtn = e.target.closest('[data-prev-step]');
  if (prevBtn) {
    setGuideStep(prevBtn.dataset.prevStep);
    return;
  }
});

$('#test-discord-button')?.addEventListener('click', async () => {
  const button = $('#test-discord-button');
  const webhookUrl = $('#settings-discord-webhook')?.value.trim();
  if (!webhookUrl) {
    notify('Vui lòng nhập Discord Webhook URL trước khi bấm thử.');
    $('#settings-discord-webhook')?.focus();
    return;
  }
  button.disabled = true;
  button.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang gửi...';
  try {
    const result = await request('/api/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    notify(result.message || 'Đã gửi tin nhắn thử nghiệm tới Discord!');
  } catch (err) {
    notify(err.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Gửi tin nhắn thử';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let payload = {};
  if (currentRunnerMode === 'suite') {
    const suiteId = $('#runner-suite-select')?.value;
    const suite = window.dashboardSuites?.[suiteId] || {};
    let specs = suite.specs;
    if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];

    payload = {
      environment: $('#environment').value,
      project: suite.project || 'all',
      grep: suite.grep || '',
      workers: Number(suite.workers || 2),
      viewport: suite.viewport,
      suiteLabel: suite.label || suiteId,
      headed: $('#headed').checked,
    };
    if (Array.isArray(specs) && specs.length > 0) {
      payload.specs = specs;
    } else {
      payload.spec = 'all';
    }
  } else {
    let manualScope = 'all';
    document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
      if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
    });

    let spec = 'all';
    let grep = '';
    if (manualScope === 'file') {
      spec = $('#spec')?.value || 'all';
    } else if (manualScope === 'grep') {
      grep = getManualGrepValue();
    }

    payload = {
      environment: $('#environment').value,
      project: $('#project').value,
      spec,
      grep,
      workers: Number($('#workers').value),
      headed: $('#headed').checked,
    };
  }

  consoleOutput.textContent = '';
  $('#run-button').disabled = true;
  $('#run-button').innerHTML = '<i class="ph ph-spinner-gap"></i> Đang khởi động...';
  try {
    const run = await request('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderRun(run);
  } catch (error) {
    notify(error.message);
    $('#run-button').disabled = false;
  } finally {
    $('#run-button').innerHTML = '<i class="ph-fill ph-play"></i> Chạy test';
  }
});

function selectedOptions() {
  if (currentRunnerMode === 'suite') {
    const suiteId = $('#runner-suite-select')?.value;
    const suite = window.dashboardSuites?.[suiteId] || {};
    let specs = suite.specs;
    if (!specs && suite.spec) specs = suite.spec === 'all' ? 'all' : [suite.spec];
    const opts = {
      environment: $('#environment').value,
      project: suite.project || 'all',
      grep: suite.grep || '',
      workers: Number(suite.workers || 2),
      headed: true,
    };
    if (Array.isArray(specs) && specs.length > 0) {
      opts.specs = specs;
    } else {
      opts.spec = 'all';
    }
    return opts;
  }
  let manualScope = 'all';
  document.querySelectorAll('.runner-scope-tab-btn').forEach((btn) => {
    if (btn.classList.contains('active')) manualScope = btn.dataset.manualScope;
  });

  let spec = 'all';
  let grep = '';
  if (manualScope === 'file') {
    spec = $('#spec')?.value || 'all';
  } else if (manualScope === 'grep') {
    grep = getManualGrepValue();
  }

  return {
    environment: $('#environment').value,
    project: $('#project').value,
    spec,
    grep,
    workers: Number($('#workers').value),
    headed: true,
  };
}

$('#ui-button').addEventListener('click', async () => {
  const button = $('#ui-button');
  button.disabled = true;
  button.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang mở UI...';
  try {
    const run = await request('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedOptions()) });
    renderRun(run);
    notify('Playwright UI đang được mở trong cửa sổ riêng.');
  } catch (error) {
    notify(error.message);
    button.disabled = false;
  } finally {
    button.innerHTML = '<i class="ph ph-browser"></i> Mở Playwright UI';
  }
});

$('#stop-button').addEventListener('click', async () => {
  try { await request('/api/stop', { method: 'POST' }); } catch (error) { notify(error.message); }
});
$('#clear-button').addEventListener('click', () => { consoleOutput.textContent = ''; });
const toolsDropdown = $('#nav-tools-dropdown');
const toolsBtn = $('#nav-tools-btn');
const toolsLabel = $('#nav-tools-label');
const toolShortLabels = {
  'suites-view': 'Test Suites',
  'recorder-view': 'Ghi kịch bản',
  'data-view': 'Dữ liệu test',
  'fixtures-view': 'Fixtures & Hooks',
  'compare-view': 'So sánh ảnh',
  'git-view': 'Đồng bộ Git',
};

toolsBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toolsDropdown?.classList.toggle('open');
  toolsBtn.setAttribute('aria-expanded', String(toolsDropdown?.classList.contains('open')));
});

document.addEventListener('click', (e) => {
  if (toolsDropdown && !toolsDropdown.contains(e.target)) {
    toolsDropdown.classList.remove('open');
    toolsBtn?.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toolsDropdown?.classList.contains('open')) {
    toolsDropdown.classList.remove('open');
    toolsBtn?.setAttribute('aria-expanded', 'false');
    toolsBtn?.focus();
  }
});

document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', async () => {
  document.querySelectorAll('.view-tab').forEach((tab) => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', String(tab === button)); });
  const isDropdownTool = button.classList.contains('nav-dropdown-item');
  if (toolsBtn) {
    toolsBtn.classList.toggle('active', isDropdownTool);
    if (toolsLabel) toolsLabel.textContent = isDropdownTool ? (toolShortLabels[button.dataset.view] || 'Tiện ích') : 'Tiện ích';
  }
  if (toolsDropdown) {
    toolsDropdown.classList.remove('open');
    toolsBtn?.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('.dashboard-view').forEach((view) => { const active = view.id === button.dataset.view; view.hidden = !active; view.classList.toggle('active', active); });
  if (button.dataset.view === 'resources-view') await openExplorer();
  if (button.dataset.view === 'docs-view') await openDocsView();
  if (button.dataset.view === 'page-manager-view') await openPageManager();
  if (button.dataset.view === 'settings-view') await openSettings();
  if (button.dataset.view === 'suites-view') await openSuitesManager();
  if (button.dataset.view === 'recorder-view') await openRecorderStudio();
  if (button.dataset.view === 'data-view') await openDataManager();
  if (button.dataset.view === 'fixtures-view') await openFixturesStudio();
  if (button.dataset.view === 'builder-view') await initVisualBuilder();
  if (button.dataset.view === 'git-view') await openGitStudio();
}));
function switchResourceCategory(category) {
  activeResourceCategory = category;
  document.querySelectorAll('.resource-seg-btn').forEach((btn) => {
    const isActive = btn.dataset.category === category;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Tương thích ngược nếu có phần tử cũ
  document.querySelectorAll('.resource-filter').forEach((filter) => filter.classList.toggle('active', filter.dataset.category === category));
  document.querySelectorAll('.results-orientation-item').forEach((item) => item.classList.toggle('active', item.dataset.resultsCategory === category));

  const searchInput = $('#resource-search');
  const platformPills = $('#resource-platform-pills');
  const titleEl = $('#resource-list-title');

  if (category === 'reports') {
    if (searchInput) searchInput.placeholder = 'Tìm báo cáo theo ngày, lần chạy...';
    if (platformPills) platformPills.style.display = 'none';
    if (titleEl) titleEl.textContent = 'DANH MỤC BÁO CÁO';
  } else if (category === 'evidence') {
    if (searchInput) searchInput.placeholder = 'Tìm ảnh theo ngày, platform, spec...';
    if (platformPills) platformPills.style.display = 'flex';
    if (titleEl) titleEl.textContent = 'DANH MỤC ẢNH EVIDENCE';
  }

  renderResourceList(searchInput ? searchInput.value : '');
}

document.querySelectorAll('.resource-seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchResourceCategory(btn.dataset.category));
});

// Fallback handlers cho tương thích
document.querySelectorAll('.resource-filter').forEach((button) => button.addEventListener('click', () => {
  switchResourceCategory(button.dataset.category);
}));
document.querySelectorAll('.results-orientation-item').forEach((item) => item.addEventListener('click', () => {
  switchResourceCategory(item.dataset.resultsCategory);
}));

const resSearchInput = $('#resource-search');
const resSearchClearBtn = $('#resource-search-clear-btn');
if (resSearchInput) {
  resSearchInput.addEventListener('input', (event) => {
    if (resSearchClearBtn) resSearchClearBtn.hidden = !event.target.value;
    renderResourceList(event.target.value);
  });
}
if (resSearchClearBtn && resSearchInput) {
  resSearchClearBtn.addEventListener('click', () => {
    resSearchInput.value = '';
    resSearchClearBtn.hidden = true;
    resSearchInput.focus();
    renderResourceList('');
  });
}

document.querySelectorAll('.resource-plat-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    activeEvidencePlatform = pill.dataset.platform;
    document.querySelectorAll('.resource-plat-pill').forEach((p) => p.classList.toggle('active', p === pill));
    renderResourceList($('#resource-search')?.value || '');
  });
});

$('#resource-toggle-tree-btn')?.addEventListener('click', () => {
  areFoldersExpanded = !areFoldersExpanded;
  const folders = document.querySelectorAll('#resource-list details');
  folders.forEach((f) => {
    f.open = areFoldersExpanded;
    if (f.dataset.folder) {
      if (areFoldersExpanded) openEvidenceFolders.add(f.dataset.folder);
      else openEvidenceFolders.delete(f.dataset.folder);
    }
    if (f.dataset.reportFolder) {
      if (areFoldersExpanded) openReportFolders.add(f.dataset.reportFolder);
      else openReportFolders.delete(f.dataset.reportFolder);
    }
  });
  const btn = $('#resource-toggle-tree-btn');
  if (btn) {
    if (areFoldersExpanded) {
      btn.innerHTML = '<i class="ph-bold ph-arrows-in-simple"></i><span>Thu gọn</span>';
      btn.title = 'Thu gọn tất cả thư mục';
    } else {
      btn.innerHTML = '<i class="ph-bold ph-arrows-out-simple"></i><span>Mở tất cả</span>';
      btn.title = 'Mở rộng tất cả thư mục';
    }
  }
});

$('#resource-refresh-btn')?.addEventListener('click', async () => {
  const btn = $('#resource-refresh-btn');
  if (btn) btn.classList.add('rotating');
  await openExplorer();
  if (btn) setTimeout(() => btn.classList.remove('rotating'), 500);
});

// Điều hướng ảnh bằng bàn phím mũi tên Trái / Phải
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const resourcesView = $('#resources-view');
  if (!resourcesView || resourcesView.hidden) return;
  const evidencePreview = $('#evidence-preview');
  if (!evidencePreview || evidencePreview.hidden) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateEvidence(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateEvidence(1);
  }
});
$('#reveal-button').addEventListener('click', () => loadResource(currentResource, $('#reveal-button').dataset.revealed !== 'true'));
$('#edit-button').addEventListener('click', editCurrentResource);
$('#save-resource-button').addEventListener('click', saveCurrentResource);
$('#cancel-edit-button').addEventListener('click', () => loadResource(currentResource, false, currentResourceCategory));
$('#delete-button').addEventListener('click', deleteCurrentArtifact);
$('#previous-evidence').addEventListener('click', () => navigateEvidence(-1));
$('#next-evidence').addEventListener('click', () => navigateEvidence(1));
$('#code-search')?.addEventListener('input', renderCodeTree);
document.querySelectorAll('.code-root-filter').forEach((button) => button.addEventListener('click', () => {
  activeCodeRoot = button.dataset.root;
  document.querySelectorAll('.code-root-filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderCodeTree();
}));
$('#code-editor')?.addEventListener('input', () => {
  const changed = $('#code-editor').value !== originalCodeContent;
  $('#code-preview code').innerHTML = highlightCode($('#code-editor').value, getCodeLanguage(currentCodeFile)) + '\n';
  if ($('#code-save-button')) $('#code-save-button').disabled = !changed;
  if ($('#code-cancel-button')) $('#code-cancel-button').hidden = !changed;
  if ($('#code-status-text')) $('#code-status-text').textContent = changed ? 'Đã chỉnh sửa' : 'Sẵn sàng';
});
$('#code-editor')?.addEventListener('scroll', () => {
  if ($('#code-preview')) {
    $('#code-preview').scrollTop = $('#code-editor').scrollTop;
    $('#code-preview').scrollLeft = $('#code-editor').scrollLeft;
  }
});
$('#code-edit-button')?.addEventListener('click', enterCodeEditMode);
$('#code-format-button')?.addEventListener('click', formatCurrentCodeEditor);
$('#code-cancel-button')?.addEventListener('click', leaveCodeEditMode);
$('#code-save-button')?.addEventListener('click', saveCodeFile);
$('#page-manager-add-locator')?.addEventListener('click', () => { pageManagerLocators.push({ name: '', expression: '' }); renderPageManagerRows(); updatePageManagerPreview(); debounceSavePageDraft(); });
$('#page-manager-add-action')?.addEventListener('click', () => { pageManagerActions.push({ name: '', locatorName: pageManagerLocators[0]?.name || '', operation: 'click' }); renderPageManagerRows(); updatePageManagerPreview(); debounceSavePageDraft(); });
$('#page-manager-create')?.addEventListener('click', createPageFromManager);
$('#pm-btn-save-draft')?.addEventListener('click', () => savePageDraft(true));
$('#pm-btn-save-draft-footer')?.addEventListener('click', () => savePageDraft(true));
$('#pm-btn-reset-draft')?.addEventListener('click', () => clearPageDraft(false));
$('#page-manager-refresh')?.addEventListener('click', openPageManager);
['#page-manager-platform', '#page-manager-title', '#page-manager-class', '#page-manager-description'].forEach((selector) => $(selector)?.addEventListener('input', () => { updatePageManagerPreview(); debounceSavePageDraft(); }));
$('#page-manager-platform')?.addEventListener('change', () => { updatePageManagerPreview(); debounceSavePageDraft(); });

// Event listeners mới cho Page Manager Side-by-Side & Subnav chuẩn BDD
$('#pm-subnav-inspect')?.addEventListener('click', () => {
  if (currentInspectedPage) {
    inspectPage(currentInspectedPage.relativePath);
  } else if (repoPages.length > 0) {
    inspectPage(repoPages[0].relativePath);
  }
});
$('#pm-subnav-edit')?.addEventListener('click', () => toggleDirectCodeEdit(true));
$('#pm-subnav-create')?.addEventListener('click', switchToCreatePageMode);
$('#pm-subnav-delete-btn')?.addEventListener('click', handleDeleteCurrentPage);
$('#pm-subnav-add-locator-btn')?.addEventListener('click', openAddLocatorToPageModal);
$('#pm-inspect-edit-btn')?.addEventListener('click', () => toggleDirectCodeEdit(true));
$('#pm-subnav-save-btn')?.addEventListener('click', saveCurrentPageCode);
$('#pm-refresh-btn')?.addEventListener('click', async () => {
  await openPageManager();
  notify('Đã làm mới danh sách Page Objects.');
});

$('#pm-btn-inspect-mode')?.addEventListener('click', () => {
  if (currentInspectedPage) {
    inspectPage(currentInspectedPage.relativePath);
  } else if (repoPages.length > 0) {
    inspectPage(repoPages[0].relativePath);
  }
});
$('#pm-btn-cancel-create')?.addEventListener('click', () => {
  if (currentInspectedPage) {
    inspectPage(currentInspectedPage.relativePath);
  } else if (repoPages.length > 0) {
    inspectPage(repoPages[0].relativePath);
  }
});
$('#pm-btn-create-mode')?.addEventListener('click', switchToCreatePageMode);
$('#page-manager-select-page')?.addEventListener('change', (e) => {
  if (e.target.value) inspectPage(e.target.value, false);
});
$('#pm-quick-search-input')?.addEventListener('input', () => {
  if (currentInspectedPage) {
    renderInspectedLocators(currentInspectedPage.locators || []);
    renderInspectedActions(currentInspectedPage.methods || []);
  }
});
$('#pm-btn-toggle-edit')?.addEventListener('click', () => toggleDirectCodeEdit());
$('#pm-btn-save-code')?.addEventListener('click', saveCurrentPageCode);
$('#pm-btn-revert-code')?.addEventListener('click', () => {
  if (window.pageManagerCodeEditor) {
    window.pageManagerCodeEditor.revert();
  }
});
$('#pm-btn-copy-code')?.addEventListener('click', copyCurrentPageManagerCode);
$('#pm-btn-toggle-wrap')?.addEventListener('click', () => {
  const stage = $('#pm-code-stage');
  if (!stage) return;
  const isWrapped = stage.classList.toggle('word-wrap');
  const btn = $('#pm-btn-toggle-wrap');
  if (btn) {
    btn.classList.toggle('active', isWrapped);
    btn.title = isWrapped
      ? 'Chuyển sang chế độ cuộn ngang (giữ nguyên độ dài dòng code)'
      : 'Bật/Tắt tự động xuống dòng (Word Wrap) hoặc cuộn ngang';
  }
  const icon = $('#pm-wrap-icon');
  if (icon) {
    icon.className = isWrapped ? 'ph-bold ph-text-align-justify' : 'ph-bold ph-text-align-left';
  }
  notify(isWrapped ? 'Đã bật chế độ tự động xuống dòng (Word Wrap)' : 'Đã bật chế độ cuộn ngang (Horizontal Scroll)', 'info');
});

$('#pm-btn-add-quick-locator')?.addEventListener('click', openAddLocatorToPageModal);
$('#btn-close-add-locator-modal')?.addEventListener('click', closeAddLocatorToPageModal);
$('#btn-cancel-add-locator')?.addEventListener('click', closeAddLocatorToPageModal);
$('#btn-save-add-locator')?.addEventListener('click', saveAddLocatorToPage);

// Quick Add Locator Inline Form
$('#pm-btn-inline-add-loc')?.addEventListener('click', addInlineLocatorToPage);
['#pm-inline-loc-name', '#pm-inline-loc-expr'].forEach((sel) => {
  $(sel)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInlineLocatorToPage();
    }
  });
});

// Quick Add Action Form & Buttons
$('#pm-subnav-add-action-btn')?.addEventListener('click', focusAddActionInput);
$('#pm-btn-add-action-toggle')?.addEventListener('click', focusAddActionInput);
$('#pm-btn-inline-add-act')?.addEventListener('click', addInlineActionToPage);
$('#pm-inline-act-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addInlineActionToPage();
  }
});
$('#pm-inline-act-loc')?.addEventListener('change', (e) => {
  const nameInput = $('#pm-inline-act-name');
  const locVal = e.target.value;
  const op = $('#pm-inline-act-op')?.value || 'click';
  if (nameInput && !nameInput.value && locVal) {
    const cleanLoc = locVal.replace(/^this\./, '').replace(/^btn|^button/i, '');
    const capitalized = cleanLoc.charAt(0).toUpperCase() + cleanLoc.slice(1);
    if (op === 'click') nameInput.value = `click${capitalized}`;
    else if (op === 'fill') nameInput.value = `input${capitalized}`;
    else if (op === 'check') nameInput.value = `check${capitalized}`;
    else if (op === 'hover') nameInput.value = `hover${capitalized}`;
    else if (op === 'assert') nameInput.value = `expect${capitalized}Visible`;
  }
});
$('#pm-inline-act-op')?.addEventListener('change', () => {
  const locVal = $('#pm-inline-act-loc')?.value;
  const nameInput = $('#pm-inline-act-name');
  const op = $('#pm-inline-act-op')?.value || 'click';
  if (nameInput && locVal && (!nameInput.value || /^(click|input|check|hover|expect)/.test(nameInput.value))) {
    const cleanLoc = locVal.replace(/^this\./, '').replace(/^btn|^button/i, '');
    const capitalized = cleanLoc.charAt(0).toUpperCase() + cleanLoc.slice(1);
    if (op === 'click') nameInput.value = `click${capitalized}`;
    else if (op === 'fill') nameInput.value = `input${capitalized}`;
    else if (op === 'check') nameInput.value = `check${capitalized}`;
    else if (op === 'hover') nameInput.value = `hover${capitalized}`;
    else if (op === 'assert') nameInput.value = `expect${capitalized}Visible`;
  }
});

$('#pm-filter-input')?.addEventListener('input', renderPageManagerFiles);
document.querySelectorAll('#pm-sidebar .pm-filter-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#pm-sidebar .pm-filter-pill').forEach((p) => p.classList.toggle('active', p === btn));
    existingPageFilter = btn.dataset.platform || 'all';
    renderPageManagerFiles();
  });
});

// Sidebar Collapse / Expand feature for BDD Studio and Page Manager
function initSidebarCollapse() {
  // 1. BDD Studio Sidebar
  const scriptWorkspace = document.querySelector('.script-workspace-panel');
  const btnCollapseScript = document.getElementById('btn-collapse-script-sidebar');
  const btnExpandScript = document.getElementById('btn-expand-script-sidebar');
  const railScript = document.getElementById('script-sidebar-collapsed-strip');
  const btnToggleScriptHead = document.getElementById('btn-toggle-script-sidebar-head');

  function setScriptSidebarCollapsed(collapsed) {
    if (!scriptWorkspace) return;
    scriptWorkspace.classList.toggle('sidebar-collapsed', collapsed);
    if (btnToggleScriptHead) {
      btnToggleScriptHead.classList.toggle('btn-sidebar-toggle-active', collapsed);
      btnToggleScriptHead.title = collapsed ? 'Mở rộng danh sách kịch bản' : 'Thu gọn danh sách kịch bản';
    }
    try { localStorage.setItem('bdd_sidebar_collapsed', collapsed ? '1' : '0'); } catch (_) {}
  }

  btnCollapseScript?.addEventListener('click', (e) => {
    e.stopPropagation();
    setScriptSidebarCollapsed(true);
    notify('📐 Đã thu gọn danh sách kịch bản. Bấm vào thanh bên hoặc nút trên thanh công cụ để mở lại.');
  });

  btnExpandScript?.addEventListener('click', (e) => {
    e.stopPropagation();
    setScriptSidebarCollapsed(false);
  });

  railScript?.addEventListener('click', () => {
    setScriptSidebarCollapsed(false);
  });

  btnToggleScriptHead?.addEventListener('click', () => {
    const isCollapsed = scriptWorkspace?.classList.contains('sidebar-collapsed');
    setScriptSidebarCollapsed(!isCollapsed);
  });

  try {
    if (localStorage.getItem('bdd_sidebar_collapsed') === '1') {
      setScriptSidebarCollapsed(true);
    }
  } catch (_) {}

  // 2. Page Manager Sidebar
  const pmWorkspace = document.getElementById('page-manager-workspace');
  const btnCollapsePm = document.getElementById('btn-collapse-pm-sidebar');
  const btnExpandPm = document.getElementById('btn-expand-pm-sidebar');
  const railPm = document.getElementById('pm-sidebar-collapsed-strip');
  const btnTogglePmHead = document.getElementById('btn-toggle-pm-sidebar-head');

  function setPmSidebarCollapsed(collapsed) {
    if (!pmWorkspace) return;
    pmWorkspace.classList.toggle('sidebar-collapsed', collapsed);
    if (btnTogglePmHead) {
      btnTogglePmHead.classList.toggle('btn-sidebar-toggle-active', collapsed);
      btnTogglePmHead.title = collapsed ? 'Mở rộng danh sách Page' : 'Thu gọn danh sách Page';
    }
    try { localStorage.setItem('pm_sidebar_collapsed', collapsed ? '1' : '0'); } catch (_) {}
  }

  btnCollapsePm?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPmSidebarCollapsed(true);
    notify('📐 Đã thu gọn danh sách Page. Bấm vào thanh bên hoặc nút trên thanh công cụ để mở lại.');
  });

  btnExpandPm?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPmSidebarCollapsed(false);
  });

  railPm?.addEventListener('click', () => {
    setPmSidebarCollapsed(false);
  });

  btnTogglePmHead?.addEventListener('click', () => {
    const isCollapsed = pmWorkspace?.classList.contains('sidebar-collapsed');
    setPmSidebarCollapsed(!isCollapsed);
  });

  try {
    if (localStorage.getItem('pm_sidebar_collapsed') === '1') {
      setPmSidebarCollapsed(true);
    }
  } catch (_) {}

  // 3. Test Data Studio Sidebar
  const dataWorkspace = document.getElementById('data-workspace-panel');
  const btnCollapseData = document.getElementById('btn-collapse-data-sidebar');
  const btnExpandData = document.getElementById('btn-expand-data-sidebar');
  const railData = document.getElementById('data-sidebar-collapsed-strip');
  const btnToggleDataHead = document.getElementById('btn-toggle-data-sidebar-head');

  function setDataSidebarCollapsed(collapsed) {
    if (!dataWorkspace) return;
    dataWorkspace.classList.toggle('sidebar-collapsed', collapsed);
    if (btnToggleDataHead) {
      btnToggleDataHead.classList.toggle('btn-sidebar-toggle-active', collapsed);
      btnToggleDataHead.title = collapsed ? 'Mở rộng danh sách dữ liệu' : 'Thu gọn danh sách dữ liệu';
    }
    try { localStorage.setItem('testdata_sidebar_collapsed', collapsed ? '1' : '0'); } catch (_) {}
  }

  btnCollapseData?.addEventListener('click', (e) => {
    e.stopPropagation();
    setDataSidebarCollapsed(true);
    notify('📐 Đã thu gọn danh sách dữ liệu. Bấm vào thanh bên hoặc nút trên thanh công cụ để mở lại.');
  });

  btnExpandData?.addEventListener('click', (e) => {
    e.stopPropagation();
    setDataSidebarCollapsed(false);
  });

  railData?.addEventListener('click', () => {
    setDataSidebarCollapsed(false);
  });

  btnToggleDataHead?.addEventListener('click', () => {
    const isCollapsed = dataWorkspace?.classList.contains('sidebar-collapsed');
    setDataSidebarCollapsed(!isCollapsed);
  });

  try {
    if (localStorage.getItem('testdata_sidebar_collapsed') === '1') {
      setDataSidebarCollapsed(true);
    }
  } catch (_) {}

  // 4. Phím tắt Ctrl + B / Cmd + B để bật tắt sidebar
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      const activeBuilder = document.getElementById('builder-view')?.classList.contains('active') || !document.getElementById('builder-view')?.hidden;
      const activePm = document.getElementById('page-manager-view')?.classList.contains('active') || !document.getElementById('page-manager-view')?.hidden;
      const activeData = document.getElementById('data-view')?.classList.contains('active') || !document.getElementById('data-view')?.hidden;
      if (activeBuilder) {
        e.preventDefault();
        const isCollapsed = scriptWorkspace?.classList.contains('sidebar-collapsed');
        setScriptSidebarCollapsed(!isCollapsed);
      } else if (activePm) {
        e.preventDefault();
        const isCollapsed = pmWorkspace?.classList.contains('sidebar-collapsed');
        setPmSidebarCollapsed(!isCollapsed);
      } else if (activeData) {
        e.preventDefault();
        const isCollapsed = dataWorkspace?.classList.contains('sidebar-collapsed');
        setDataSidebarCollapsed(!isCollapsed);
      }
    }
  });
}
initSidebarCollapse();

$('#format-resource-button').addEventListener('click', formatCurrentResourceEditor);
$('#reload-settings-button').addEventListener('click', openSettings);
$('#save-settings-button').addEventListener('click', saveSettings);
[
  '#settings-project-name',
  '#settings-project-subtitle',
  '#settings-page-title',
  '#settings-logo-url',
  '#settings-primary-color',
  '#settings-background-color',
  '#settings-font-size',
].forEach((selector) => $(selector)?.addEventListener('input', updateBrandingPreview));

$('#settings-primary-color-picker')?.addEventListener('input', (e) => {
  if ($('#settings-primary-color')) $('#settings-primary-color').value = e.target.value;
  updateBrandingPreview();
});

document.querySelectorAll('.color-swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    if ($('#settings-primary-color')) $('#settings-primary-color').value = color;
    if ($('#settings-primary-color-picker')) $('#settings-primary-color-picker').value = color;
    updateBrandingPreview();
  });
});

$('#settings-background-color-picker')?.addEventListener('input', (e) => {
  if ($('#settings-background-color')) $('#settings-background-color').value = e.target.value;
  updateBrandingPreview();
});

document.querySelectorAll('.bg-swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const bg = btn.dataset.bg || '';
    if ($('#settings-background-color')) $('#settings-background-color').value = bg;
    if ($('#settings-background-color-picker') && bg) $('#settings-background-color-picker').value = bg;
    updateBrandingPreview();
  });
});

$('#btn-reset-bg-color')?.addEventListener('click', () => {
  if ($('#settings-background-color')) $('#settings-background-color').value = '';
  updateBrandingPreview();
});

document.querySelectorAll('.font-size-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const size = btn.dataset.size || '14px';
    if ($('#settings-font-size')) $('#settings-font-size').value = size;
    updateBrandingPreview();
  });
});


// ==========================================================================
// RECORDER STUDIO CONTROLLER
// ==========================================================================
let recorderState = {
  isRecording: false,
  currentRawScript: '',
  parsedActions: [],
  availablePages: [],
  draftPom: null,
  draftSpec: null,
  savedSpecPath: null,
};
let recorderStatusInterval = null;

async function openRecorderStudio() {
  if (!settingsCache) {
    try {
      const settings = await request('/api/settings');
      settingsCache = settings;
    } catch (_) {}
  }
  const defaultEnvKey = $('#environment')?.value || settingsCache?.runtime?.defaultEnvironment || 'qc';
  const defaultUrl = settingsCache?.environments?.[defaultEnvKey]?.baseURL;
  const recUrlInput = $('#rec-url');
  if (recUrlInput && defaultUrl && (!recUrlInput.value || recUrlInput.value === 'https://example.com')) {
    recUrlInput.value = defaultUrl;
    recUrlInput.placeholder = defaultUrl;
  }

  await Promise.all([
    checkRecorderStatus(),
    refreshPagesForPlatform(),
  ]);

  if (!recorderStatusInterval) {
    recorderStatusInterval = setInterval(() => {
      const recorderView = $('#recorder-view');
      if (recorderView && !recorderView.hidden && recorderView.style.display !== 'none') {
        checkRecorderStatus();
      }
    }, 2500);
  }
}

window.addEventListener('focus', () => {
  const recorderView = $('#recorder-view');
  if (recorderView && !recorderView.hidden && recorderView.style.display !== 'none') {
    checkRecorderStatus();
  }
});

async function checkRecorderStatus() {
  try {
    const status = await request('/api/recorder/status');
    onRecorderStatusUpdate(status);
    if (status.recentRecordings) {
      renderRecentRecordings(status.recentRecordings);
    }
  } catch (e) {}
}

function onRecorderStatusUpdate(status) {
  recorderState.isRecording = Boolean(status.isRecording);
  const badge = $('#recorder-badge');
  const startBtn = $('#rec-start-btn');
  const stopBtn = $('#rec-stop-btn');

  if (recorderState.isRecording) {
    if (badge) {
      badge.className = 'rec-status-badge recording';
      badge.innerHTML = '<i class="ph-fill ph-circle"></i> Đang ghi thao tác...';
    }
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
  } else {
    if (badge) {
      badge.className = 'rec-status-badge idle';
      badge.innerHTML = '<i class="ph-fill ph-circle"></i> Sẵn sàng';
    }
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  if (status.error) {
    notify(`Thông báo phiên ghi: ${status.error}`);
  }

  if (status.recentRecordings) {
    renderRecentRecordings(status.recentRecordings);
  }
}

function renderRecentRecordings(recordings) {
  const container = $('#recent-recordings-list');
  if (!container) return;

  if (!recordings || recordings.length === 0) {
    container.innerHTML = '<small class="rec-empty-hint">Chưa có bản ghi nào.</small>';
    return;
  }

  container.innerHTML = recordings.map((rec) => `
    <div class="recent-rec-item" data-filename="${escapeHtml(rec.fileName)}">
      <div class="rec-item-info">
        <i class="ph-bold ph-file-js"></i>
        <span class="rec-item-name">${escapeHtml(rec.fileName)}</span>
      </div>
      <div class="rec-item-meta">
        <small class="rec-time">${new Date(rec.modifiedAt).toLocaleTimeString('vi-VN')}</small>
        <button type="button" class="rec-delete-btn" data-filename="${escapeHtml(rec.fileName)}" title="Xóa bản ghi này">
          <i class="ph-bold ph-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.recent-rec-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.rec-delete-btn')) return;
      loadRawRecordingFile(item.dataset.filename);
    });
  });

  container.querySelectorAll('.rec-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileName = btn.dataset.filename;
      if (!confirm(`Bạn có chắc chắn muốn xóa bản ghi "${fileName}" không?`)) return;

      try {
        const result = await request('/api/recorder/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName }),
        });
        notify(result.message || `Đã xóa bản ghi ${fileName}`);
        renderRecentRecordings(result.recentRecordings || []);
      } catch (error) {
        notify(`Xóa bản ghi thất bại: ${error.message}`);
      }
    });
  });
}

$('#rec-clear-all-btn')?.addEventListener('click', async () => {
  if (!confirm('Bạn có chắc chắn muốn xóa TẤT CẢ các bản ghi thô trong lịch sử không?')) return;

  try {
    const result = await request('/api/recorder/clear', { method: 'POST' });
    notify(result.message || 'Đã dọn dẹp toàn bộ lịch sử ghi.');
    renderRecentRecordings([]);
  } catch (error) {
    notify(`Dọn dẹp lịch sử thất bại: ${error.message}`);
  }
});

async function loadRawRecordingFile(fileName) {
  try {
    const result = await request(`/api/recorder/file?name=${encodeURIComponent(fileName)}`);
    setRawScriptContent(result.rawScript, result.actions, result.actionsCount, result.detectedUrl, result.globalWarnings || []);
    notify(`Đã nạp bản ghi ${fileName}`);
  } catch (error) {
    notify(`Không thể đọc bản ghi: ${error.message}`);
  }
}

// ==========================================================================
// SYNTAX HIGHLIGHTING & STEPPER WIZARD ENGINE
// ==========================================================================

function highlightJavaScript(code) {
  if (!code) return '<div class="code-line"><span class="line-num">1</span><span class="tok-comment">// Chưa có mã nguồn Playwright...</span></div>';
  
  let formattedHtml = '';
  if (typeof Prism !== 'undefined' && Prism.languages && Prism.languages.javascript) {
    try {
      formattedHtml = Prism.highlight(code, Prism.languages.javascript, 'javascript');
    } catch (e) {
      formattedHtml = escapeHtml(code);
    }
  } else {
    formattedHtml = escapeHtml(code);
  }

  const lines = formattedHtml.split('\n');
  return lines.map((line, idx) => `
    <div class="code-line">
      <span class="line-num">${idx + 1}</span>
      <span class="code-content">${line || '&nbsp;'}</span>
    </div>
  `).join('');
}

let currentRecorderStep = 1;
let maxUnlockedRecorderStep = 1;

function setRecorderStep(step) {
  currentRecorderStep = step;
  if (step > maxUnlockedRecorderStep) maxUnlockedRecorderStep = step;

  // Update Stepper Bar buttons
  document.querySelectorAll('.recorder-stepper-bar .stepper-step').forEach((btn) => {
    const s = Number(btn.dataset.step);
    btn.classList.toggle('active', s === step);
    btn.classList.toggle('completed', s < step);
    btn.disabled = s > maxUnlockedRecorderStep;
  });

  // Update step subtext
  if (recorderState.currentRawScript && $('#step1-status-text')) {
    $('#step1-status-text').textContent = `Đã ghi ${recorderState.parsedActions?.length || 0} thao tác`;
  }
  if (recorderState.draftPom && $('#step2-status-text')) {
    $('#step2-status-text').textContent = `Đã map: ${recorderState.draftPom.relativePath.split('/').pop()}`;
  }

  // Switch visible Panes
  document.querySelectorAll('.rec-step-pane').forEach((pane) => {
    pane.style.display = 'none';
  });
  const targetPane = $(`#rec-step-pane-${step}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }
}

function renderWarnings(warnings = []) {
  const box = $('#rec-warnings-box');
  const list = $('#rec-warnings-list');
  const countEl = $('#rec-warnings-count');
  if (!box || !list) return;

  if (!warnings || warnings.length === 0) {
    box.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  box.style.display = 'flex';
  if (countEl) countEl.textContent = String(warnings.length);
  list.innerHTML = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
}

function setRawScriptContent(rawScript, actions = [], actionsCount = 0, detectedUrl = '', warnings = []) {
  recorderState.currentRawScript = rawScript || '';
  recorderState.parsedActions = actions || [];
  recorderState.warnings = warnings || [];
  
  const rawCodeEl = $('#rec-raw-code-highlighted');
  if (rawCodeEl) {
    rawCodeEl.innerHTML = highlightJavaScript(rawScript || '// Không có mã thô.');
  }
  const countEl = $('#rec-actions-count');
  if (countEl) {
    countEl.textContent = String(actionsCount || actions.length || 0);
  }

  renderWarnings(warnings);

  if (detectedUrl && !$('#rec-feature-name')?.value) {
    try {
      const parsedPath = new URL(detectedUrl).pathname.replace(/^\/|\/$/g, '');
      if (parsedPath) {
        const featName = parsedPath.replace(/[^a-zA-Z0-9_-]/g, '_');
        if ($('#rec-feature-name')) $('#rec-feature-name').value = featName;
        if ($('#rec-method-name')) $('#rec-method-name').value = `perform${featName.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
      }
    } catch (e) {}
  }

  // Tự động chuyển sang Bước 2 khi có mã thô
  if (rawScript && rawScript.trim().length > 15) {
    setRecorderStep(2);
  }
}

async function refreshPagesForPlatform() {
  const platform = $('#rec-platform')?.value || 'desktop';
  try {
    const result = await request('/api/recorder/scan-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
    recorderState.availablePages = result.pages || [];
    renderPagesDropdown(recorderState.availablePages);
  } catch (error) {
    notify(`Lỗi quét Page Objects: ${error.message}`);
  }
}

function renderPagesDropdown(pages) {
  const select = $('#rec-existing-page-select');
  if (!select) return;

  if (pages.length === 0) {
    select.innerHTML = '<option value="">(Không tìm thấy Page Object nào)</option>';
    renderExistingMethodsHint(null);
    return;
  }

  select.innerHTML = pages.map((p) => `
    <option value="${escapeHtml(p.relativePath)}" data-class="${escapeHtml(p.className)}">
      ${escapeHtml(p.className)} (${escapeHtml(p.fileName)} - ${p.methods.length} methods)
    </option>
  `).join('');

  renderExistingMethodsHint(pages[0]);
}

function renderExistingMethodsHint(page) {
  const hintEl = $('#rec-existing-methods-hint');
  if (!hintEl) return;
  if (!page || !page.methods || page.methods.length === 0) {
    hintEl.innerHTML = '<div class="methods-empty-hint"><i class="ph ph-info"></i> Chưa có method nào trong Page Object này.</div>';
    return;
  }
  hintEl.innerHTML = `
    <div class="methods-hint-header">
      <span><i class="ph-bold ph-function"></i> <strong>${page.methods.length} methods</strong> trong <code>${escapeHtml(page.className)}</code>:</span>
      <small>Click để tự điền tên</small>
    </div>
    <div class="methods-chips-wrap">
      ${page.methods.map((m) => `
        <button type="button" class="method-chip-btn" data-method="${escapeHtml(m.name)}" title="Click để điền tên method">
          <i class="ph ph-lightning"></i> ${escapeHtml(m.name)}()
        </button>
      `).join('')}
    </div>
  `;

  hintEl.querySelectorAll('.method-chip-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const methodName = btn.dataset.method;
      if ($('#rec-method-name')) {
        $('#rec-method-name').value = methodName;
        $('#rec-method-name').focus();
        notify(`Đã gợi ý tên method: ${methodName}`);
      }
    });
  });
}

// RECORDER UI EVENT HANDLERS
document.querySelectorAll('.recorder-stepper-bar .stepper-step').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetStep = Number(btn.dataset.step);
    if (targetStep <= maxUnlockedRecorderStep) {
      setRecorderStep(targetStep);
    }
  });
});

$('#step2-back-btn')?.addEventListener('click', () => setRecorderStep(1));
$('#step3-back-btn')?.addEventListener('click', () => setRecorderStep(2));

$('#rec-platform')?.addEventListener('change', (e) => {
  const isMobile = e.target.value === 'mobile-web';
  const deviceWrapper = $('#rec-device-wrapper');
  if (deviceWrapper) deviceWrapper.style.display = isMobile ? 'block' : 'none';
  refreshPagesForPlatform();
});

document.querySelectorAll('input[name="rec-pom-mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.pom-mode-card').forEach((card) => {
      const cardRadio = card.querySelector('input[type="radio"]');
      card.classList.toggle('active', cardRadio && cardRadio.checked);
    });
    const isExisting = radio.value === 'existing';
    const existingBox = $('#rec-existing-page-box');
    const newBox = $('#rec-new-page-box');
    const guideText = $('#rec-mode-guide-text');

    if (existingBox) existingBox.style.display = isExisting ? 'block' : 'none';
    if (newBox) newBox.style.display = isExisting ? 'none' : 'block';
    if (guideText) {
      guideText.textContent = isExisting
        ? 'Hệ thống sẽ giữ nguyên code hiện tại, tự động thêm các locator mới vào constructor và chèn 1 method mới vào class đã chọn.'
        : 'Hệ thống sẽ sinh file Page Object mới kế thừa BasePage, khai báo constructor chuẩn và các method thao tác.';
    }
  });
});

$('#rec-existing-page-select')?.addEventListener('change', (e) => {
  const selectedPath = e.target.value;
  const page = recorderState.availablePages.find((p) => p.relativePath === selectedPath);
  renderExistingMethodsHint(page);
});

$('#rec-refresh-list-btn')?.addEventListener('click', async () => {
  await checkRecorderStatus();
  notify('Đã làm mới danh sách bản ghi.');
});

$('#rec-copy-raw-btn')?.addEventListener('click', () => {
  if (!recorderState.currentRawScript) {
    notify('Chưa có mã thô để sao chép.');
    return;
  }
  navigator.clipboard.writeText(recorderState.currentRawScript);
  notify('Đã sao chép mã thô vào Clipboard!');
});

$('#rec-url')?.addEventListener('blur', (e) => {
  let val = e.target.value.trim();
  if (val && !/^https?:\/\//i.test(val)) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(val)) {
      val = 'http://' + val;
    } else {
      val = 'https://' + val;
    }
    e.target.value = val;
  }
});

$('#rec-start-btn')?.addEventListener('click', async () => {
  const currentEnvKey = $('#filter-env')?.value || $('#environment')?.value || settingsCache?.runtime?.defaultEnvironment || 'qc';
  const defaultUrl = settingsCache?.environments?.[currentEnvKey]?.baseURL || 'https://example.com';
  let inputUrl = $('#rec-url')?.value.trim() || defaultUrl;

  if (inputUrl && !/^https?:\/\//i.test(inputUrl)) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(inputUrl)) {
      inputUrl = 'http://' + inputUrl;
    } else {
      inputUrl = 'https://' + inputUrl;
    }
    const urlInput = $('#rec-url');
    if (urlInput) urlInput.value = inputUrl;
  }

  const url = inputUrl;
  const platform = $('#rec-platform')?.value || 'desktop';
  const device = platform === 'mobile-web' ? $('#rec-device')?.value : '';
  const startBtn = $('#rec-start-btn');

  startBtn.disabled = true;
  startBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang mở trình duyệt...';

  try {
    const result = await request('/api/recorder/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform, device, force: true }),
    });
    notify(result.message || 'Playwright Codegen đang chạy. Thao tác trên trình duyệt rồi đóng hoặc bấm Dừng.');
    onRecorderStatusUpdate({ isRecording: true });
  } catch (error) {
    notify(`Không thể mở trình duyệt ghi: ${error.message}`);
    await checkRecorderStatus();
  } finally {
    startBtn.innerHTML = '<i class="ph-fill ph-record"></i> Bắt đầu ghi (Codegen)';
  }
});

$('#rec-reset-btn')?.addEventListener('click', async () => {
  const resetBtn = $('#rec-reset-btn');
  if (resetBtn) resetBtn.disabled = true;
  try {
    const res = await request('/api/recorder/reset', { method: 'POST' });
    notify(res.message || 'Đã reset phiên ghi.');
    await checkRecorderStatus();
  } catch (error) {
    notify(`Lỗi khi reset phiên ghi: ${error.message}`);
  } finally {
    if (resetBtn) resetBtn.disabled = false;
  }
});

$('#rec-stop-btn')?.addEventListener('click', async () => {
  const stopBtn = $('#rec-stop-btn');
  stopBtn.disabled = true;
  stopBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang đọc mã...';

  try {
    const result = await request('/api/recorder/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    setRawScriptContent(result.rawScript, result.actions, result.actionsCount, result.detectedUrl);
    notify(`Đã dừng ghi. Đã bắt được ${result.actionsCount || 0} hành động! Tự động chuyển sang Bước 2.`);
    await checkRecorderStatus();
  } catch (error) {
    notify(`Lỗi khi dừng ghi: ${error.message}`);
  } finally {
    stopBtn.innerHTML = '<i class="ph-fill ph-stop"></i> Dừng ghi & Lấy mã';
    stopBtn.disabled = true;
  }
});

$('#rec-convert-btn')?.addEventListener('click', async () => {
  if (!recorderState.currentRawScript) {
    notify('Vui lòng thực hiện ghi thao tác hoặc chọn một bản ghi trước khi chuyển đổi.');
    return;
  }

  const platform = $('#rec-platform')?.value || 'desktop';
  let isNewPage = true;
  document.querySelectorAll('input[name="rec-pom-mode"]').forEach((r) => {
    if (r.checked) isNewPage = r.value === 'new';
  });

  let pageClassName = '';
  let existingPagePath = '';

  if (isNewPage) {
    pageClassName = $('#rec-new-page-name')?.value.trim() || 'CustomPage';
  } else {
    const selectedOpt = $('#rec-existing-page-select')?.selectedOptions?.[0];
    existingPagePath = selectedOpt?.value || '';
    pageClassName = selectedOpt?.dataset.class || 'CustomPage';
  }

  const methodName = $('#rec-method-name')?.value.trim() || 'performRecordedActions';
  const featureName = $('#rec-feature-name')?.value.trim() || 'Recorded Feature';
  const testName = `Người dùng thực hiện ${featureName}`;
  const includeEvidence = $('#rec-include-evidence')?.checked === true;

  const convertBtn = $('#rec-convert-btn');
  convertBtn.disabled = true;
  convertBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang phân tích & chuyển đổi...';

  try {
    const result = await request('/api/recorder/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        isNewPage,
        pageClassName,
        existingPagePath,
        methodName,
        featureName,
        testName,
        rawScript: recorderState.currentRawScript,
        actions: recorderState.parsedActions,
        includeEvidence,
      }),
    });

    recorderState.draftPom = result.pomDraft;
    recorderState.draftSpec = result.specDraft;
    recorderState.warnings = result.warnings || [];

    $('#draft-pom-path').textContent = result.pomDraft.relativePath;
    $('#draft-pom-editor').value = result.pomDraft.content;
    const pomCodeEl = $('#draft-pom-code');
    if (pomCodeEl) pomCodeEl.innerHTML = highlightCode(result.pomDraft.content) + '\n';
    $('#draft-pom-tab-title').textContent = result.pomDraft.relativePath.split('/').pop();

    $('#draft-spec-path').textContent = result.specDraft.relativePath;
    $('#draft-spec-editor').value = result.specDraft.content;
    const specCodeEl = $('#draft-spec-code');
    if (specCodeEl) specCodeEl.innerHTML = highlightCode(result.specDraft.content) + '\n';
    $('#draft-spec-tab-title').textContent = result.specDraft.relativePath.split('/').pop();

    renderWarnings(result.warnings);

    $('#rec-save-btn').disabled = false;
    $('#rec-run-spec-btn').style.display = 'none';

    const guardBox = $('#rec-guard-status');
    if (guardBox) {
      guardBox.style.display = 'flex';
      guardBox.className = 'guard-status-box';
      $('#rec-guard-title').textContent = 'Framework Guard: Sẵn sàng kiểm tra';
      $('#rec-guard-desc').innerHTML = 'Mã draft đã được chuẩn hóa. Nhấn <b>"Lưu vào Framework"</b> để ghi file an toàn (Sandbox + Backup) và chạy kiểm tra tự động.';
    }

    // Tự động chuyển sang Bước 3
    setRecorderStep(3);
    notify('Đã chuyển đổi thành công sang Page Object & Spec BDD! Chuyển sang Bước 3.');
  } catch (error) {
    notify(`Lỗi chuyển đổi: ${error.message}`);
  } finally {
    convertBtn.disabled = false;
    convertBtn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Chuyển đổi & Sang Bước 3 <i class="ph ph-arrow-right"></i>';
  }
});

// Live Syntax Highlighting & Sync for Step 3 Editors
$('#draft-pom-editor')?.addEventListener('input', () => {
  const code = $('#draft-pom-editor').value;
  const pomCodeEl = $('#draft-pom-code');
  if (pomCodeEl) pomCodeEl.innerHTML = highlightCode(code) + '\n';
});
$('#draft-pom-editor')?.addEventListener('scroll', () => {
  const preview = $('#draft-pom-preview');
  const editor = $('#draft-pom-editor');
  if (preview && editor) {
    preview.scrollTop = editor.scrollTop;
    preview.scrollLeft = editor.scrollLeft;
  }
});

$('#draft-spec-editor')?.addEventListener('input', () => {
  const code = $('#draft-spec-editor').value;
  const specCodeEl = $('#draft-spec-code');
  if (specCodeEl) specCodeEl.innerHTML = highlightCode(code) + '\n';
});
$('#draft-spec-editor')?.addEventListener('scroll', () => {
  const preview = $('#draft-spec-preview');
  const editor = $('#draft-spec-editor');
  if (preview && editor) {
    preview.scrollTop = editor.scrollTop;
    preview.scrollLeft = editor.scrollLeft;
  }
});

$('#draft-format-btn')?.addEventListener('click', () => {
  const activeTab = document.querySelector('.code-draft-tab.active')?.dataset.draft;
  if (activeTab === 'pom' && recorderState.draftPom) {
    $('#draft-pom-editor').value = recorderState.draftPom.content;
    const pomCodeEl = $('#draft-pom-code');
    if (pomCodeEl) pomCodeEl.innerHTML = highlightCode(recorderState.draftPom.content) + '\n';
    notify('Đã khôi phục mã Page Object gốc.');
  } else if (activeTab === 'spec' && recorderState.draftSpec) {
    $('#draft-spec-editor').value = recorderState.draftSpec.content;
    const specCodeEl = $('#draft-spec-code');
    if (specCodeEl) specCodeEl.innerHTML = highlightCode(recorderState.draftSpec.content) + '\n';
    notify('Đã khôi phục mã BDD Spec gốc.');
  }
});

$('#draft-copy-btn')?.addEventListener('click', () => {
  let activeCode = '';
  const activeTab = document.querySelector('.code-draft-tab.active')?.dataset.draft;
  if (activeTab === 'pom') {
    activeCode = $('#draft-pom-editor')?.value || '';
  } else {
    activeCode = $('#draft-spec-editor')?.value || '';
  }
  if (!activeCode) {
    notify('Chưa có mã để sao chép.');
    return;
  }
  navigator.clipboard.writeText(activeCode);
  notify('Đã sao chép mã nguồn vào Clipboard!');
});

// Auto Inject Evidence Capture in Step 3 of Recorder
async function triggerRecorderAutoEvidenceCapture() {
  const specEditor = document.getElementById('draft-spec-editor');
  const specPreview = document.getElementById('draft-spec-code');
  const currentCode = specEditor ? specEditor.value : '';

  if (!currentCode || !currentCode.trim()) {
    notify('Chưa có mã BDD Spec trong bản nháp Bước 3.');
    return;
  }

  const autoBtn = document.getElementById('draft-auto-capture-btn');
  if (autoBtn) {
    autoBtn.disabled = true;
    autoBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang phân tích...';
  }

  try {
    const res = await request('/api/builder/auto-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specCode: currentCode,
        filePath: document.getElementById('draft-spec-path')?.textContent || 'draft.spec.js',
      }),
    });

    if (res.alreadyOptimal || (res.addedCount === 0 && res.removedCount === 0)) {
      notify('👌 Bản nháp BDD Spec đã có đầy đủ các mốc capture evidence chuẩn, không phát hiện điểm trùng lặp!');
    } else {
      if (specEditor) specEditor.value = res.modifiedCode;
      if (specPreview) specPreview.innerHTML = highlightCode(res.modifiedCode) + '\n';

      // Tự động kích hoạt tab BDD Spec trong Step 3 để tester nhìn thấy ngay
      const specTab = document.querySelector('.code-draft-tab[data-draft="spec"]');
      if (specTab) specTab.click();

      notify(`📸 Đã tự động chèn ${res.addedCount} mốc capture evidence chuẩn vào bản nháp BDD Spec!`);
    }
  } catch (err) {
    notify(`❌ Lỗi chèn evidence: ${err.message}`);
  } finally {
    if (autoBtn) {
      autoBtn.disabled = false;
      autoBtn.innerHTML = '<i class="ph-bold ph-camera"></i> Tự động chèn Evidence';
    }
  }
}

document.getElementById('draft-auto-capture-btn')?.addEventListener('click', triggerRecorderAutoEvidenceCapture);


document.querySelectorAll('.code-draft-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const draftType = tab.dataset.draft;
    document.querySelectorAll('.code-draft-tab').forEach((t) => t.classList.toggle('active', t === tab));
    const pomPane = $('#draft-pom-pane');
    const specPane = $('#draft-spec-pane');
    if (pomPane) pomPane.style.display = draftType === 'pom' ? 'flex' : 'none';
    if (specPane) specPane.style.display = draftType === 'spec' ? 'flex' : 'none';
  });
});

$('#rec-save-btn')?.addEventListener('click', async () => {
  const pomPath = $('#draft-pom-path')?.textContent;
  const pomContent = $('#draft-pom-editor')?.value;
  const specPath = $('#draft-spec-path')?.textContent;
  const specContent = $('#draft-spec-editor')?.value;

  if (!pomPath || !pomContent || !specPath || !specContent) {
    notify('Thiếu thông tin mã draft để lưu.');
    return;
  }

  const saveBtn = $('#rec-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="ph ph-spinner-gap"></i> Đang sao lưu & ghi file...';

  try {
    const result = await request('/api/recorder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pomFile: { path: pomPath, content: pomContent },
        specFile: { path: specPath, content: specContent },
      }),
    });

    recorderState.savedSpecPath = specPath;

    const guardBox = $('#rec-guard-status');
    const guardTitle = $('#rec-guard-title');
    const guardDesc = $('#rec-guard-desc');
    const runBtn = $('#rec-run-spec-btn');

    if (result.frameworkCheck?.passed) {
      if (guardBox) guardBox.className = 'guard-status-box passed';
      if (guardTitle) guardTitle.textContent = '✅ Framework Guard: Đạt chuẩn 100%';
      if (guardDesc) guardDesc.textContent = result.frameworkCheck.output || 'Tất cả quy tắc kiến trúc POM, BDD và no-direct-locator đều thỏa mãn.';
      if (runBtn) {
        runBtn.style.display = 'inline-flex';
        runBtn.textContent = `🚀 Chạy thử ${specPath.split('/').pop()} ngay`;
      }
      notify(`Đã lưu thành công! (Tự động Backup vào ${result.backups?.length || 0} bản)`);
    } else {
      if (guardBox) guardBox.className = 'guard-status-box failed';
      if (guardTitle) guardTitle.textContent = '⚠️ Framework Guard: Có vi phạm cấu trúc';
      if (guardDesc) guardDesc.textContent = result.frameworkCheck.output;
      notify('File đã được lưu nhưng có vi phạm quy tắc framework. Vui lòng kiểm tra lại!');
    }

    await refreshPagesForPlatform();
  } catch (error) {
    notify(`Lưu thất bại: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Lưu vào Framework (Tự động Backup & Check)';
  }
});

$('#rec-run-spec-btn')?.addEventListener('click', async () => {
  if (!recorderState.savedSpecPath) return;

  const runnerTab = document.querySelector('.view-tab[data-view="runner-view"]');
  if (runnerTab) runnerTab.click();

  setRunnerMode('manual');
  const scopeFileBtn = document.querySelector('.runner-scope-tab-btn[data-manual-scope="file"]');
  if (scopeFileBtn) scopeFileBtn.click();

  const config = await request('/api/config');
  testCatalog = {
    specs: config.specs,
    specTags: config.specTags || {},
    availableTags: config.availableTags || [],
    specProjects: config.specProjects || {},
    projects: config.projects || [],
  };
  refreshSpecOptions();

  if ($('#spec')) {
    $('#spec').value = recorderState.savedSpecPath;
    updateWorkersForSpec();
  }

  notify(`Đã nạp file ${recorderState.savedSpecPath} vào Runner. Nhấn "Chạy test" để bắt đầu!`);
});

initialize();
initPlanThreeControls();

/* ==========================================================================
   NO-CODE TEST DATA STUDIO & RECORDER ASSERTION EXTENSIONS
   ========================================================================== */

let currentDataFile = null;
let currentDataset = null;
let originalDatasetRaw = '';
let isDataDirty = false;
let dataSearchQuery = '';
let dataTypeFilter = 'all';
let dataDirectEditMode = false;
let dataSubnavMode = 'inspect'; // 'inspect' | 'raw' | 'create'
let datasetsCache = [];
let lastFocusedDataInput = null;
let isDataStudioInitialized = false;
let dataRawEditorController = null;

function setDataDirty(dirty) {
  isDataDirty = dirty;
  if (dataSubnavMode === 'create') return;
  const badgeMiddle = document.getElementById('data-status-badge');
  const badgeCode = document.getElementById('data-code-status-badge');
  const revertBtnMiddle = document.getElementById('data-revert-btn');
  const revertBtnCode = document.getElementById('data-code-revert-btn');
  const saveBtnSubnav = document.getElementById('data-save-btn');
  const saveBtnMiddle = document.getElementById('data-middle-save-btn');
  const saveBtnCode = document.getElementById('data-code-save-btn');

  const dirtyHtml = '<i class="ph-bold ph-pencil-simple" style="color:#f59e0b;"></i> Đã chỉnh sửa (chưa lưu)';
  const cleanHtml = '<i class="ph-bold ph-check" style="color:#10b981;"></i> Đang mở từ disk';

  if (badgeMiddle) {
    badgeMiddle.innerHTML = dirty ? dirtyHtml : cleanHtml;
    badgeMiddle.classList.toggle('modified', dirty);
  }
  if (badgeCode) {
    badgeCode.innerHTML = dirty ? dirtyHtml : cleanHtml;
    badgeCode.classList.toggle('modified', dirty);
  }
  if (revertBtnMiddle) revertBtnMiddle.disabled = !dirty;
  if (revertBtnCode) revertBtnCode.disabled = !dirty;

  [saveBtnSubnav, saveBtnMiddle, saveBtnCode].forEach((btn) => {
    if (btn) btn.classList.toggle('is-dirty', dirty);
  });
}

async function openDataManager() {
  initDataStudioControls();
  await loadDataFilesList();
  if (datasetsCache.length > 0) {
    const fileToSelect = currentDataFile || datasetsCache[0].fileName;
    await selectDataset(fileToSelect, true);
  }
}

function renderDataFilesList() {
  const container = document.getElementById('data-files-list');
  if (!container) return;

  const fileDescriptions = {
    'users.json': 'Tài khoản đăng nhập',
    'applyJobData.json': 'Dữ liệu nộp đơn & ứng tuyển',
    'userProfileData.json': 'Hồ sơ người tìm việc',
    'onboardingData.json': 'Thiết lập ban đầu Onboarding',
    'aiProfileData.json': 'Gợi ý hồ sơ AI'
  };

  const q = dataSearchQuery.trim().toLowerCase();
  const filtered = datasetsCache.filter((ds) => {
    if (dataTypeFilter === 'array' && !ds.isArray) return false;
    if (dataTypeFilter === 'object' && ds.isArray) return false;
    if (dataTypeFilter === 'auth') {
      const isAuth = ds.fileName.toLowerCase().includes('user') ||
                     ds.fileName.toLowerCase().includes('auth') ||
                     ds.fileName.toLowerCase().includes('profile');
      if (!isAuth) return false;
    }
    if (!q) return true;
    const desc = (fileDescriptions[ds.fileName] || '').toLowerCase();
    return ds.fileName.toLowerCase().includes(q) || desc.includes(q);
  });

  const sCount = document.getElementById('stat-data-sidebar-count');
  if (sCount) sCount.textContent = filtered.length;
  const railBadge = document.getElementById('data-rail-count');
  if (railBadge) railBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy tệp dữ liệu phù hợp.</div>';
    return;
  }

  container.innerHTML = filtered.map((ds) => {
    const isActive = dataSubnavMode !== 'create' && currentDataFile === ds.fileName;
    const desc = fileDescriptions[ds.fileName] || (ds.isArray ? 'Danh sách dữ liệu' : 'Cấu trúc biểu mẫu');
    const isAuth = ds.fileName.toLowerCase().includes('user') || ds.fileName.toLowerCase().includes('profile');
    
    let iconClass = 'desktop';
    let iconName = 'ph-rows';
    if (!ds.isArray) {
      iconClass = 'api';
      iconName = 'ph-tree-structure';
    }
    if (isAuth) {
      iconClass = 'setup';
      iconName = 'ph-user-circle';
    }

    const linkedCount = (projectScripts || []).filter((s) => {
      return s.primaryDataFile === ds.fileName || (s.specCode && s.specCode.includes(ds.fileName));
    }).length;

    return `
    <div class="dashboard-list-card script-card-item data-file-card-item ${isActive ? 'is-selected active' : ''}" data-file="${escapeHtml(ds.fileName)}">
      <span class="dashboard-list-card__icon script-card-platform-icon ${iconClass}">
        <i class="ph-bold ${iconName}"></i>
      </span>
      <div class="dashboard-list-card__body">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
          <div class="script-card-title">${escapeHtml(ds.fileName)}</div>
          <button type="button" class="btn-icon-subtle item-delete-hover-btn data-file-delete-btn" data-file="${escapeHtml(ds.fileName)}" title="Xóa tệp dữ liệu này" style="padding: 2px; font-size: 14px; flex-shrink: 0;">
            <i class="ph ph-trash"></i>
          </button>
        </div>
        <div class="script-card-file" style="color: var(--muted); font-size: 11.5px; margin-top: 2px;">
          ${escapeHtml(desc)}
        </div>
        <div class="script-card-pills" style="margin-top: 6px; display: flex; flex-wrap: gap; gap: 4px;">
          <span class="script-card-badge-platform ${iconClass}">
            <i class="ph ${iconName}"></i> ${ds.isArray ? 'Danh sách' : 'Biểu mẫu'}
          </span>
          <span class="script-card-badge-pages">
            <i class="ph ph-stack"></i> ${ds.recordCount} ${ds.isArray ? 'dòng' : 'mục'}
          </span>
          <span class="script-card-badge-data">
            ${(ds.size / 1024).toFixed(1)} KB
          </span>
          ${linkedCount > 0 ? `
          <span class="script-card-badge-platform" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.25);">
            <i class="ph ph-tree-structure"></i> ${linkedCount} kịch bản
          </span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.data-file-card-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.data-file-delete-btn')) return;
      const file = item.dataset.file;
      if (file) {
        if (dataSubnavMode === 'create') {
          const nameInput = document.getElementById('create-dataset-filename');
          const hasDraft = nameInput?.value.trim();
          if (hasDraft) {
            const ok = confirm('⚠️ Bạn đang ở chế độ tạo tệp mới. Chuyển sang xem tệp này sẽ hủy bản nháp hiện tại. Bạn có muốn tiếp tục?');
            if (!ok) return;
          }
          switchToDataInspectMode();
        }
        if (file !== currentDataFile) {
          selectDataset(file);
        }
      }
    });
  });

  container.querySelectorAll('.data-file-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const file = btn.dataset.file;
      if (file) {
        currentDataFile = file;
        document.getElementById('data-delete-file-btn')?.click();
      }
    });
  });
}

async function loadDataFilesList() {
  const container = document.getElementById('data-files-list');
  if (!container) return;
  try {
    const res = await request('/api/data/datasets');
    datasetsCache = res.datasets || [];
    wizardAvailableDatasets = datasetsCache;

    const statFiles = document.getElementById('stat-data-files');
    const statRecords = document.getElementById('stat-data-records');
    const statTotalSize = document.getElementById('stat-data-total-size');
    if (statFiles) statFiles.textContent = datasetsCache.length;
    if (statRecords) {
      const totalRecs = datasetsCache.reduce((acc, d) => acc + (d.recordCount || 0), 0);
      statRecords.textContent = totalRecs;
    }
    if (statTotalSize) {
      const totalBytes = datasetsCache.reduce((acc, d) => acc + (d.size || 0), 0);
      statTotalSize.textContent = `${(totalBytes / 1024).toFixed(1)} KB`;
    }

    renderDataFilesList();
  } catch (err) {
    notify('Lỗi tải danh sách dữ liệu: ' + err.message);
  }
}

async function renderLinkedBddScripts(fileName) {
  const container = document.getElementById('data-linked-scripts-container');
  const countBadge = document.getElementById('data-linked-scripts-count');
  const statBadge = document.getElementById('data-stat-linked-badge');
  if (!container) return;

  if (!projectScripts || projectScripts.length === 0) {
    try {
      const res = await request('/api/builder/scripts');
      if (res && Array.isArray(res.scripts)) {
        projectScripts = res.scripts;
      }
    } catch (_) {}
  }

  const linked = (projectScripts || []).filter((s) => {
    return s.primaryDataFile === fileName ||
      (Array.isArray(s.dataFiles) && s.dataFiles.some((df) => (typeof df === 'string' ? df : (df?.name || df?.fileName || '')) === fileName)) ||
      (s.specCode && s.specCode.includes(fileName));
  });

  if (countBadge) countBadge.textContent = `${linked.length} kịch bản`;
  if (statBadge) statBadge.textContent = linked.length;

  if (linked.length === 0) {
    container.innerHTML = `
      <div style="color: var(--muted); font-size: 12.5px; padding: 4px; display: flex; align-items: center; gap: 6px;">
        <i class="ph ph-info"></i> Chưa có kịch bản BDD nào liên kết trực tiếp với tệp này. File spec có thể nạp qua <code>require('../../../data/${escapeHtml(fileName)}')</code>.
      </div>`;
    return;
  }

  container.innerHTML = linked.map((s) => `
    <button type="button" class="data-linked-script-chip" data-script-id="${escapeHtml(s.id)}" title="Bấm để mở kịch bản '${escapeHtml(s.scenarioName || s.fileName)}' trong BDD Studio">
      <i class="ph-bold ph-tree-structure" style="color: var(--accent);"></i>
      <span>${escapeHtml(s.scenarioName || s.fileName)}</span>
      <small style="color: var(--muted); font-size: 11px;">(${escapeHtml(s.fileName)})</small>
    </button>
  `).join('');

  container.querySelectorAll('.data-linked-script-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const sId = chip.dataset.scriptId;
      const s = projectScripts.find((p) => p.id === sId);
      if (s) {
        document.querySelector('.view-tab[data-view="builder-view"]')?.click();
        selectProjectScript(s, true);
        notify(`🚀 Đã chuyển sang kịch bản: ${s.scenarioName || s.fileName}`);
      }
    });
  });
}

async function selectDataset(fileName, force = false) {
  if (isDataDirty && !force) {
    const confirmSwitch = confirm('⚠️ Bạn có thay đổi chưa lưu trong tệp hiện tại. Tiếp tục chuyển tệp sẽ mất các thay đổi chưa lưu. Bạn có chắc chắn muốn chuyển?');
    if (!confirmSwitch) return;
  }

  currentDataFile = fileName;
  document.querySelectorAll('.data-file-card-item').forEach((item) => {
    const isThis = item.dataset.file === fileName;
    item.classList.toggle('active', isThis);
    item.classList.toggle('is-selected', isThis);
  });

  try {
    const res = await request(`/api/data/dataset?file=${encodeURIComponent(fileName)}`);
    currentDataset = res.data;
    originalDatasetRaw = JSON.stringify(res.data, null, 2);
    setDataDirty(false);

    const fileDescriptions = {
      'users.json': 'Tài khoản đăng nhập',
      'applyJobData.json': 'Dữ liệu nộp đơn & ứng tuyển',
      'userProfileData.json': 'Hồ sơ người tìm việc',
      'onboardingData.json': 'Thiết lập ban đầu Onboarding',
      'aiProfileData.json': 'Gợi ý hồ sơ AI'
    };

    const desc = fileDescriptions[res.fileName] || (res.isArray ? 'Danh sách dữ liệu' : 'Cấu trúc biểu mẫu');

    // Cập nhật banner thông số
    const nameEl = document.getElementById('data-current-filename');
    const bannerDesc = document.getElementById('data-banner-desc');
    const bannerFile = document.getElementById('data-banner-file');
    const bannerPath = document.getElementById('data-banner-path');
    const bannerType = document.getElementById('data-banner-type');
    const statRecs = document.getElementById('data-stat-records-badge');
    const statSize = document.getElementById('data-stat-size-badge');
    const fieldsCount = document.getElementById('data-fields-count');
    const codeTitle = document.getElementById('data-code-title');

    if (nameEl) nameEl.textContent = res.fileName;
    if (bannerDesc) bannerDesc.textContent = desc;
    if (bannerFile) bannerFile.textContent = res.relativePath || `data/${res.fileName}`;
    if (bannerPath) bannerPath.innerHTML = `<i class="ph ph-folder"></i> Đường dẫn: <code>${escapeHtml(res.relativePath || `data/${res.fileName}`)}</code>`;
    if (bannerType) bannerType.textContent = res.isArray ? 'Danh sách (Array)' : 'Biểu mẫu (Object)';
    
    const countStr = `${res.isArray ? res.data.length : Object.keys(res.data).length} ${res.isArray ? 'dòng' : 'mục'}`;
    if (statRecs) statRecs.textContent = countStr;
    if (statSize) statSize.textContent = `${((res.size || JSON.stringify(res.data).length) / 1024).toFixed(1)} KB`;
    if (fieldsCount) fieldsCount.textContent = countStr;
    if (codeTitle) codeTitle.textContent = res.fileName;

    // Reset chế độ edit code về preview an toàn
    dataDirectEditMode = false;
    const stage = document.getElementById('data-code-stage');
    const editorEl = document.getElementById('data-raw-editor');
    const saveBtn = document.getElementById('data-code-save-btn');
    const editBtnText = document.getElementById('data-edit-btn-text');
    if (stage) stage.classList.remove('editing');
    if (editorEl) editorEl.setAttribute('readonly', 'true');
    if (saveBtn) saveBtn.style.display = 'none';
    if (editBtnText) editBtnText.textContent = 'Chỉnh sửa';

    renderGroupedFormView();

    if (dataRawEditorController) {
      dataRawEditorController.setValue(originalDatasetRaw, true);
    }

    await renderLinkedBddScripts(res.fileName);
  } catch (err) {
    notify('Lỗi đọc tệp dữ liệu: ' + err.message);
  }
}

function renderDataView() {
  const formPane = document.getElementById('data-form-view');
  const rawPane = document.getElementById('data-raw-view');

  // Cập nhật trạng thái nút chuyển đổi
  document.getElementById('data-toggle-form')?.classList.toggle('active', dataViewMode === 'form');
  document.getElementById('data-toggle-raw')?.classList.toggle('active', dataViewMode === 'raw');

  if (dataViewMode === 'form') {
    if (formPane) formPane.style.display = 'flex';
    if (rawPane) rawPane.style.display = 'none';
    renderGroupedFormView();
  } else {
    if (formPane) formPane.style.display = 'none';
    if (rawPane) rawPane.style.display = 'flex';

    if (dataRawEditorController && currentDataset !== null && currentDataset !== undefined) {
      dataRawEditorController.setValue(JSON.stringify(currentDataset, null, 2));
    }
  }
}

function updateRawJsonPreview() {
  const rawEditor = document.getElementById('data-raw-editor');
  const rawCode = document.getElementById('data-raw-code');
  if (!rawEditor || !rawCode) return;
  rawCode.innerHTML = highlightCode(rawEditor.value, true) + '\n';
}

function renderTableGrid() {
  const container = document.getElementById('data-table-container');
  if (!container) return;

  if (!Array.isArray(currentDataset) || currentDataset.length === 0) {
    if (!Array.isArray(currentDataset)) {
      container.innerHTML = `
        <div class="data-empty-state">
          <i class="ph-bold ph-textbox" style="font-size: 40px; color: var(--accent);"></i>
          <h3 style="margin: 8px 0 4px 0;">Tệp này phù hợp với dạng Biểu mẫu</h3>
          <p style="max-width: 480px;">Tệp dữ liệu này chứa cấu trúc phân nhóm (kinh nghiệm, học vấn, kỹ năng...). Hãy chuyển sang chế độ <strong>Biểu mẫu</strong> để xem và chỉnh sửa trực quan.</p>
          <button type="button" class="btn-primary-sm" style="margin-top: 8px;" onclick="document.getElementById('data-toggle-form')?.click()"><i class="ph-bold ph-tree-structure"></i> Chuyển sang Biểu mẫu</button>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="data-empty-state">
        <i class="ph ph-table" style="font-size: 40px; color: var(--muted);"></i>
        <p>Bảng này chưa có dòng dữ liệu nào.</p>
        <button type="button" class="btn-primary-sm" onclick="document.getElementById('data-add-row-btn')?.click()"><i class="ph-bold ph-plus"></i> Thêm dòng đầu tiên</button>
      </div>`;
    return;
  }

  const columns = Object.keys(currentDataset[0]);

  const headerHtml = columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join('') + '<th style="width: 80px; text-align: center;">Hành động</th>';

  const rowsHtml = currentDataset
    .map((row, rIdx) => {
      const cellsHtml = columns
        .map(
          (col) => `
        <td>
          <input 
            type="text" 
            class="data-cell-input" 
            value="${escapeHtml(String(row[col] !== undefined ? row[col] : ''))}" 
            data-row="${rIdx}" 
            data-col="${escapeHtml(col)}"
          />
        </td>`
        )
        .join('');

      return `
      <tr>
        <td style="width: 40px; text-align: center; color: var(--muted); font-size: 11px;">${rIdx + 1}</td>
        ${cellsHtml}
        <td style="text-align: center; white-space: nowrap;">
          <button type="button" class="btn-icon-subtle" title="Nhân bản dòng này" onclick="window.cloneDataRow(${rIdx})"><i class="ph ph-copy"></i></button>
          <button type="button" class="btn-icon-danger" title="Xóa dòng này" onclick="window.removeDataRow(${rIdx})"><i class="ph ph-trash"></i></button>
        </td>
      </tr>`;
    })
    .join('');

  container.innerHTML = `
    <table class="data-grid-table">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          ${headerHtml}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>`;

  container.querySelectorAll('.data-cell-input').forEach((input) => {
    input.addEventListener('focus', () => {
      lastFocusedDataInput = input;
    });
    input.addEventListener('input', (e) => {
      const r = parseInt(e.target.dataset.row, 10);
      const c = e.target.dataset.col;
      if (currentDataset && currentDataset[r]) {
        currentDataset[r][c] = e.target.value;
      }
    });
  });
}

function renderFormFieldUnit(pathArray, label, value) {
  const pathStr = pathArray.join('.');
  let inputHtml = '';
  let hint = '';

  if (Array.isArray(value)) {
    const textVal = value.join(', ');
    hint = '<small style="color: var(--muted); font-size: 10.5px; text-transform: none; font-weight: 500;">(Phân cách bằng dấu phẩy)</small>';
    inputHtml = `
      <input 
        type="text" 
        class="form-field-input" 
        value="${escapeHtml(textVal)}" 
        data-path="${escapeHtml(pathStr)}" 
        data-type="array" 
      />
    `;
  } else if (typeof value === 'boolean') {
    inputHtml = `
      <select class="form-field-input select-input" data-path="${escapeHtml(pathStr)}" data-type="boolean">
        <option value="true" ${value === true ? 'selected' : ''}>true (Có / Đúng)</option>
        <option value="false" ${value === false ? 'selected' : ''}>false (Không / Sai)</option>
      </select>
    `;
  } else {
    inputHtml = `
      <input 
        type="text" 
        class="form-field-input" 
        value="${escapeHtml(String(value !== undefined && value !== null ? value : ''))}" 
        data-path="${escapeHtml(pathStr)}" 
        data-type="${typeof value === 'number' ? 'number' : 'string'}" 
      />
    `;
  }

  const labelHtml = label ? `
    <label style="display: flex; justify-content: space-between; align-items: baseline;">
      <span>${escapeHtml(label)}</span>
      ${hint}
    </label>` : '';

  return `
    <div class="form-field-unit">
      ${labelHtml}
      ${inputHtml}
    </div>
  `;
}

function renderGroupedFormView() {
  const container = document.getElementById('data-form-container');
  if (!container) return;

  if (Array.isArray(currentDataset)) {
    if (currentDataset.length === 0) {
      container.innerHTML = '<div class="data-empty-state"><i class="ph ph-tree-structure"></i><p>Tệp dữ liệu đang rỗng.</p></div>';
      return;
    }
    container.innerHTML = currentDataset
      .map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const fields = Object.entries(item)
            .map(([fieldKey, fieldValue]) => renderFormFieldUnit([String(idx), fieldKey], fieldKey, fieldValue))
            .join('');
          return `
            <div class="data-form-card">
              <div class="data-form-card-header">
                <div class="data-form-card-title"><i class="ph-bold ph-user"></i> <span>Dòng ${idx + 1} (${Object.keys(item).length} trường)</span></div>
                <small style="color: var(--muted);">Bản ghi #${idx + 1}</small>
              </div>
              <div class="data-form-card-body">
                ${fields}
              </div>
            </div>
          `;
        } else {
          return `
            <div class="data-form-card">
              <div class="data-form-card-header">
                <div class="data-form-card-title"><i class="ph-bold ph-tag"></i> <span>Mục ${idx + 1}</span></div>
              </div>
              <div class="data-form-card-body" style="grid-template-columns: 1fr;">
                ${renderFormFieldUnit([String(idx)], `Giá trị ${idx + 1}:`, item)}
              </div>
            </div>
          `;
        }
      })
      .join('');

    container.querySelectorAll('.form-field-input').forEach((input) => {
      input.addEventListener('focus', () => {
        lastFocusedDataInput = input;
      });
      const updateHandler = (e) => {
        const pathStr = e.target.dataset.path;
        if (!pathStr) return;
        const type = e.target.dataset.type;
        const path = pathStr.split('.');
        let target = currentDataset;
        for (let i = 0; i < path.length - 1; i++) {
          target = target[path[i]];
        }
        const lastKey = path[path.length - 1];
        let valToSet = e.target.value;
        if (type === 'array') {
          valToSet = valToSet.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        } else if (type === 'boolean') {
          valToSet = valToSet === 'true';
        } else if (type === 'number') {
          const num = Number(valToSet);
          if (!isNaN(num) && valToSet.trim() !== '') valToSet = num;
        }
        target[lastKey] = valToSet;
        dataRawEditorController?.setValue(JSON.stringify(currentDataset, null, 2), false);
        setDataDirty(true);
      };
      input.addEventListener('input', updateHandler);
      if (input.tagName === 'SELECT') input.addEventListener('change', updateHandler);
    });
    return;
  }

  if (!currentDataset || typeof currentDataset !== 'object') {
    container.innerHTML = '<div class="data-empty-state"><i class="ph ph-tree-structure"></i><p>Chưa có dữ liệu để hiển thị dạng biểu mẫu.</p></div>';
    return;
  }

  const entries = Object.entries(currentDataset);
  if (entries.length === 0) {
    container.innerHTML = '<div class="data-empty-state"><i class="ph ph-tree-structure"></i><p>Dữ liệu đang rỗng.</p></div>';
    return;
  }

  container.innerHTML = entries
    .map(([key, val]) => {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const hasNestedObjects = Object.values(val).some(
          (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
        );

        if (hasNestedObjects) {
          const subCardsHtml = Object.entries(val)
            .map(([subKey, subVal]) => {
              if (typeof subVal === 'object' && subVal !== null && !Array.isArray(subVal)) {
                const subFields = Object.entries(subVal)
                  .map(([fieldKey, fieldValue]) => renderFormFieldUnit([key, subKey, fieldKey], fieldKey, fieldValue))
                  .join('');

                return `
                  <div class="data-form-subcard">
                    <div class="data-form-subcard-header">
                      <span class="data-form-subcard-title"><i class="ph-bold ph-caret-circle-right"></i> ${escapeHtml(subKey)}</span>
                      <small style="color: var(--muted); font-size: 11px;">${Object.keys(subVal).length} trường</small>
                    </div>
                    <div class="data-form-subcard-body">
                      ${subFields}
                    </div>
                  </div>
                `;
              } else {
                return renderFormFieldUnit([key, subKey], subKey, subVal);
              }
            })
            .join('');

          return `
            <div class="data-form-card compound-card">
              <div class="data-form-card-header">
                <div class="data-form-card-title"><i class="ph-bold ph-folder-notch-open"></i> <span>${escapeHtml(key)}</span></div>
                <small style="color: var(--muted);">${Object.keys(val).length} mục chi tiết</small>
              </div>
              <div class="data-form-compound-body">
                ${subCardsHtml}
              </div>
            </div>
          `;
        } else {
          const fields = Object.entries(val)
            .map(([subKey, subVal]) => renderFormFieldUnit([key, subKey], subKey, subVal))
            .join('');

          return `
            <div class="data-form-card">
              <div class="data-form-card-header">
                <div class="data-form-card-title"><i class="ph-bold ph-folder"></i> <span>${escapeHtml(key)}</span></div>
                <small style="color: var(--muted);">${Object.keys(val).length} trường</small>
              </div>
              <div class="data-form-card-body">
                ${fields}
              </div>
            </div>
          `;
        }
      } else {
        const fieldHtml = renderFormFieldUnit([key], '', val);
        return `
          <div class="data-form-card">
            <div class="data-form-card-header">
              <div class="data-form-card-title"><i class="ph-bold ph-tag"></i> <span>${escapeHtml(key)}</span></div>
            </div>
            <div class="data-form-card-body" style="grid-template-columns: 1fr;">
              ${fieldHtml}
            </div>
          </div>
        `;
      }
    })
    .join('');

  container.querySelectorAll('.form-field-input').forEach((input) => {
    input.addEventListener('focus', () => {
      lastFocusedDataInput = input;
    });

    const updateHandler = (e) => {
      const pathStr = e.target.dataset.path;
      if (!pathStr) return;
      const type = e.target.dataset.type;
      const path = pathStr.split('.');
      let target = currentDataset;
      for (let i = 0; i < path.length - 1; i++) {
        if (!target[path[i]]) target[path[i]] = {};
        target = target[path[i]];
      }
      const lastKey = path[path.length - 1];
      let valToSet = e.target.value;

      if (type === 'array') {
        valToSet = valToSet.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      } else if (type === 'boolean') {
        valToSet = valToSet === 'true';
      } else if (type === 'number') {
        const num = Number(valToSet);
        if (!isNaN(num) && valToSet.trim() !== '') valToSet = num;
      }

      target[lastKey] = valToSet;
      dataRawEditorController?.setValue(JSON.stringify(currentDataset, null, 2), false);
      setDataDirty(true);
    };

    input.addEventListener('input', updateHandler);
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', updateHandler);
    }
  });
}

window.cloneDataRow = function(idx) {
  if (!Array.isArray(currentDataset)) return;
  const clone = JSON.parse(JSON.stringify(currentDataset[idx]));
  currentDataset.splice(idx + 1, 0, clone);
  renderGroupedFormView();
  dataRawEditorController?.setValue(JSON.stringify(currentDataset, null, 2), false);
  setDataDirty(true);
  notify('Đã nhân bản dòng ' + (idx + 1));
};

window.removeDataRow = function(idx) {
  if (!Array.isArray(currentDataset)) return;
  currentDataset.splice(idx, 1);
  renderGroupedFormView();
  dataRawEditorController?.setValue(JSON.stringify(currentDataset, null, 2), false);
  setDataDirty(true);
  notify('Đã xóa dòng ' + (idx + 1));
};

const DATA_ARCHETYPE_TEMPLATES = {
  users: {
    id: 'users',
    title: 'Tài khoản & Xác thực (Auth)',
    badge: 'Mảng (Array)',
    icon: 'ph-user-circle',
    desc: 'Mảng tài khoản test với phone, email, mật khẩu, OTP, họ tên kèm biến ngẫu nhiên Faker.',
    defaultFileName: 'authUsers.json',
    defaultData: [
      {
        fullName: "{{random_name}}",
        phone: "{{random_phone}}",
        email: "{{random_email}}",
        password: "Test@1234",
        otp: "1111",
        role: "candidate",
        status: "active"
      }
    ]
  },
  search: {
    id: 'search',
    title: 'Tìm kiếm & Bộ lọc (Search)',
    badge: 'Đối tượng (Object)',
    icon: 'ph-magnifying-glass',
    desc: 'Các tham số lọc tìm kiếm: từ khóa, danh mục, khu vực, trạng thái.',
    defaultFileName: 'searchCriteria.json',
    defaultData: {
      keyword: "Automation Testing",
      category: "Default",
      status: "active",
      page: 1,
      limit: 20
    }
  },
  profile: {
    id: 'profile',
    title: 'Hồ sơ & Form cá nhân (Profile)',
    badge: 'Phân cấp (Nested)',
    icon: 'ph-identification-card',
    desc: 'Cấu trúc biểu mẫu người dùng: thông tin cá nhân, liên hệ, vai trò, cài đặt.',
    defaultFileName: 'userProfileData.json',
    defaultData: {
      personalInfo: {
        fullName: "{{random_name}}",
        address: "Hà Nội, Việt Nam",
        phone: "{{random_phone}}",
        email: "{{random_email}}"
      },
      role: "Standard User",
      status: "active"
    }
  },
  apply: {
    id: 'apply',
    title: 'Biểu mẫu nghiệp vụ (Form Submission)',
    badge: 'Quy trình (Flow)',
    icon: 'ph-paper-plane-tilt',
    desc: 'Dữ liệu biểu mẫu nghiệp vụ, gửi thông tin và đính kèm tài liệu.',
    defaultFileName: 'formData.json',
    defaultData: {
      submission: {
        title: "Test Submission",
        applicant: {
          name: "{{random_name}}",
          phone: "{{random_phone}}",
          email: "{{random_email}}"
        },
        notes: "Ghi chú kiểm thử tự động"
      }
    }
  },
  table: {
    id: 'table',
    title: 'Bảng tham số nhiều dòng (Table)',
    badge: 'Data-driven (Array)',
    icon: 'ph-table',
    desc: 'Mảng các test cases với input và expected result để chạy lặp kiểm thử giá trị biên & validation.',
    defaultFileName: 'loginValidationCases.json',
    defaultData: [
      { testCase: "TC01_Valid_Phone", phone: "0987654321", otp: "1111", expectedResult: "success" },
      { testCase: "TC02_Invalid_Phone", phone: "012345", otp: "1111", expectedResult: "error_phone_format" },
      { testCase: "TC03_Wrong_OTP", phone: "0987654321", otp: "9999", expectedResult: "error_invalid_otp" }
    ]
  },
  blank: {
    id: 'blank',
    title: 'Dữ liệu tùy chỉnh rỗng (Blank)',
    badge: 'Tùy chỉnh (Custom)',
    icon: 'ph-file-code',
    desc: 'Bắt đầu từ đối tượng {} hoặc mảng [] trống để bạn tự do viết cấu trúc dữ liệu theo ý muốn.',
    defaultFileName: 'customData.json',
    defaultData: {
      title: "Bộ dữ liệu tùy chỉnh",
      createdAt: "{{date}}",
      items: []
    }
  }
};

let currentCreateTemplate = 'users';
let currentCreateDraftData = null;

function switchToDataInspectMode() {
  dataSubnavMode = 'inspect';
  document.getElementById('data-tab-inspect')?.classList.add('active');
  document.getElementById('data-tab-create')?.classList.remove('active');
  document.getElementById('btn-tab-data-inspect')?.classList.add('active');
  document.getElementById('btn-tab-data-create')?.classList.remove('active');

  // Hiện lại cụm nút hành động cho file đang xem
  const subnavActions = document.getElementById('data-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'flex';

  const headInspect = document.getElementById('data-inspect-head');
  const headCreate = document.getElementById('data-create-head');
  if (headInspect) headInspect.style.display = 'flex';
  if (headCreate) headCreate.style.display = 'none';

  const viewInspect = document.getElementById('data-inspect-scroll-content');
  const viewCreate = document.getElementById('data-create-scroll-content');
  if (viewInspect) viewInspect.style.display = 'block';
  if (viewCreate) viewCreate.style.display = 'none';

  // Khôi phục lại trạng thái card file đang chọn trong Sidebar Cột 1
  document.querySelectorAll('.data-file-card-item').forEach((card) => {
    const isThis = card.dataset.file === currentDataFile;
    card.classList.toggle('active', isThis);
    card.classList.toggle('is-selected', isThis);
  });

  const eyebrow = document.getElementById('data-code-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MÃ NGUỒN DỮ LIỆU (.json)';

  // Phục hồi tiêu đề & trạng thái Code Panel cho file hiện tại
  const title = document.getElementById('data-code-title');
  if (title) title.textContent = currentDataFile || 'dataset.json';
  setDataDirty(isDataDirty);
  if (dataRawEditorController && originalDatasetRaw) {
    dataRawEditorController.setValue(originalDatasetRaw, { markClean: !isDataDirty });
  }
}

function switchToDataCreateMode(presetTemplate = 'users') {
  if (isDataDirty) {
    const ok = confirm('⚠️ Bạn có thay đổi chưa lưu trong tệp hiện tại. Chuyển sang tạo tệp mới sẽ bỏ qua các thay đổi chưa lưu. Bạn có muốn tiếp tục?');
    if (!ok) return;
  }

  dataSubnavMode = 'create';
  document.getElementById('data-tab-inspect')?.classList.remove('active');
  document.getElementById('data-tab-create')?.classList.add('active');
  document.getElementById('btn-tab-data-inspect')?.classList.remove('active');
  document.getElementById('btn-tab-data-create')?.classList.add('active');

  // Ẩn cụm nút thao tác file cũ trên subnav để loại bỏ nhầm lẫn
  const subnavActions = document.getElementById('data-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'none';

  // Bỏ chọn toàn bộ card danh sách file bên Sidebar Cột 1
  document.querySelectorAll('.data-file-card-item').forEach((card) => {
    card.classList.remove('active');
    card.classList.remove('is-selected');
  });

  const headInspect = document.getElementById('data-inspect-head');
  const headCreate = document.getElementById('data-create-head');
  if (headInspect) headInspect.style.display = 'none';
  if (headCreate) headCreate.style.display = 'flex';

  const viewInspect = document.getElementById('data-inspect-scroll-content');
  const viewCreate = document.getElementById('data-create-scroll-content');
  if (viewInspect) viewInspect.style.display = 'none';
  if (viewCreate) viewCreate.style.display = 'block';

  const scrollWrap = document.getElementById('data-middle-scroll');
  if (scrollWrap) scrollWrap.scrollTop = 0;

  // Khởi tạo bản nháp với mẫu template
  currentCreateTemplate = presetTemplate;
  const tmpl = DATA_ARCHETYPE_TEMPLATES[presetTemplate] || DATA_ARCHETYPE_TEMPLATES.users;
  currentCreateDraftData = JSON.parse(JSON.stringify(tmpl.defaultData));

  // Tên file và mô tả: Để trống với placeholder trực quan thay vì tự ý autofill
  const filenameInput = document.getElementById('create-dataset-filename');
  if (filenameInput) {
    filenameInput.value = '';
    filenameInput.placeholder = `vd: ${tmpl.defaultFileName} (hoặc chọn gợi ý bên dưới)`;
  }

  const descInput = document.getElementById('create-dataset-desc');
  if (descInput) {
    descInput.value = '';
    descInput.placeholder = `Mục đích: ${tmpl.desc}`;
  }

  renderCreateTemplateCards();
  renderCreateFields();
  populateCreateLinkedScriptSelect();
  updateCreateLivePreview();
}

function renderCreateTemplateCards() {
  const container = document.getElementById('data-template-cards-grid');
  if (!container) return;

  container.innerHTML = Object.values(DATA_ARCHETYPE_TEMPLATES).map((tmpl) => {
    const isActive = tmpl.id === currentCreateTemplate;
    return `
      <div class="data-template-card ${isActive ? 'active' : ''}" data-template-id="${tmpl.id}">
        <div class="data-template-card-head">
          <span class="data-template-card-icon"><i class="ph-bold ${tmpl.icon}"></i></span>
          <span class="data-template-card-badge">${escapeHtml(tmpl.badge)}</span>
        </div>
        <h4 class="data-template-card-title">${escapeHtml(tmpl.title)}</h4>
        <p class="data-template-card-desc">${escapeHtml(tmpl.desc)}</p>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.data-template-card').forEach((card) => {
    card.addEventListener('click', () => {
      const tid = card.dataset.templateId;
      if (!tid || !DATA_ARCHETYPE_TEMPLATES[tid]) return;
      currentCreateTemplate = tid;
      const tmpl = DATA_ARCHETYPE_TEMPLATES[tid];
      currentCreateDraftData = JSON.parse(JSON.stringify(tmpl.defaultData));

      const filenameInput = document.getElementById('create-dataset-filename');
      if (filenameInput) {
        // Nếu ô tên đang trống hoặc đang chứa tên mặc định của 1 template thì cập nhật tên mẫu này
        const isDefaultName = !filenameInput.value.trim() || Object.values(DATA_ARCHETYPE_TEMPLATES).some((t) => t.defaultFileName === filenameInput.value.trim());
        if (isDefaultName) {
          filenameInput.value = tmpl.defaultFileName;
        }
      }

      const descInput = document.getElementById('create-dataset-desc');
      if (descInput) {
        const isDefaultDesc = !descInput.value.trim() || Object.values(DATA_ARCHETYPE_TEMPLATES).some((t) => t.desc === descInput.value.trim());
        if (isDefaultDesc) {
          descInput.value = tmpl.desc;
        }
      }

      container.querySelectorAll('.data-template-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      renderCreateFields();
      updateCreateLivePreview();
    });
  });
}

function renderCreateFields() {
  const container = document.getElementById('data-create-fields-container');
  const headTitle = document.getElementById('data-create-fields-head-title');
  const addRowBtn = document.getElementById('btn-add-create-row');
  if (!container) return;

  if (Array.isArray(currentCreateDraftData)) {
    if (headTitle) headTitle.textContent = `Dữ liệu dạng mảng (${currentCreateDraftData.length} bản ghi / dòng)`;
    if (addRowBtn) addRowBtn.style.display = 'inline-flex';

    container.innerHTML = currentCreateDraftData.map((row, rIdx) => {
      const keys = typeof row === 'object' && row !== null ? Object.keys(row) : [];
      return `
        <div class="data-accordion-card" style="margin-bottom: 8px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface);">
          <div class="data-card-header" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: var(--surface-2);">
            <strong style="font-size: 12px; color: var(--text);">Dòng #${rIdx + 1} (${keys.length} trường)</strong>
            ${currentCreateDraftData.length > 1 ? `
              <button type="button" class="btn-icon-subtle" onclick="window.removeCreateDraftRow(${rIdx})" title="Xóa dòng này" style="color: var(--danger); padding: 2px;">
                <i class="ph ph-trash"></i>
              </button>` : ''}
          </div>
          <div style="padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
            ${keys.map((k) => `
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--muted); font-family: var(--font-mono);">${escapeHtml(k)}</label>
                <input type="text" class="text-input create-field-input" data-row="${rIdx}" data-key="${escapeHtml(k)}" value="${escapeHtml(String(row[k] ?? ''))}" style="font-size: 12px; padding: 6px 8px;" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  } else if (typeof currentCreateDraftData === 'object' && currentCreateDraftData !== null) {
    const keys = Object.keys(currentCreateDraftData);
    if (headTitle) headTitle.textContent = `Dữ liệu dạng đối tượng (${keys.length} trường cấp 1)`;
    if (addRowBtn) addRowBtn.style.display = 'none';

    container.innerHTML = keys.map((k) => {
      const val = currentCreateDraftData[k];
      const isObj = typeof val === 'object' && val !== null;
      const displayVal = isObj ? JSON.stringify(val) : String(val ?? '');
      return `
        <div class="data-create-field-row">
          <input type="text" class="text-input data-create-field-key create-key-input" data-orig-key="${escapeHtml(k)}" value="${escapeHtml(k)}" />
          <input type="text" class="text-input data-create-field-val create-val-input" data-key="${escapeHtml(k)}" value="${escapeHtml(displayVal)}" ${isObj ? 'title="Dữ liệu JSON lồng nhau"' : ''} />
          <button type="button" class="btn-icon-subtle" onclick="window.removeCreateDraftKey('${escapeHtml(k)}')" title="Xóa trường này" style="color: var(--danger); padding: 4px;">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  // Gắn sự kiện sửa trường
  container.querySelectorAll('.create-field-input').forEach((inp) => {
    inp.addEventListener('focus', () => { lastFocusedDataInput = inp; });
    inp.addEventListener('input', () => {
      const r = parseInt(inp.dataset.row, 10);
      const k = inp.dataset.key;
      if (Array.isArray(currentCreateDraftData) && currentCreateDraftData[r]) {
        currentCreateDraftData[r][k] = inp.value;
        updateCreateLivePreview();
      }
    });
  });

  container.querySelectorAll('.create-val-input').forEach((inp) => {
    inp.addEventListener('focus', () => { lastFocusedDataInput = inp; });
    inp.addEventListener('input', () => {
      const k = inp.dataset.key;
      if (typeof currentCreateDraftData === 'object' && currentCreateDraftData !== null) {
        try {
          if (inp.value.startsWith('{') || inp.value.startsWith('[')) {
            currentCreateDraftData[k] = JSON.parse(inp.value);
          } else {
            currentCreateDraftData[k] = inp.value;
          }
        } catch (_) {
          currentCreateDraftData[k] = inp.value;
        }
        updateCreateLivePreview();
      }
    });
  });

  container.querySelectorAll('.create-key-input').forEach((inp) => {
    inp.addEventListener('change', () => {
      const origK = inp.dataset.origKey;
      const newK = inp.value.trim();
      if (newK && newK !== origK && typeof currentCreateDraftData === 'object') {
        const val = currentCreateDraftData[origK];
        delete currentCreateDraftData[origK];
        currentCreateDraftData[newK] = val;
        renderCreateFields();
        updateCreateLivePreview();
      }
    });
  });
}

window.removeCreateDraftRow = function(rIdx) {
  if (Array.isArray(currentCreateDraftData) && currentCreateDraftData.length > 1) {
    currentCreateDraftData.splice(rIdx, 1);
    renderCreateFields();
    updateCreateLivePreview();
  }
};

window.removeCreateDraftKey = function(k) {
  if (typeof currentCreateDraftData === 'object' && currentCreateDraftData !== null) {
    delete currentCreateDraftData[k];
    renderCreateFields();
    updateCreateLivePreview();
  }
};

function updateCreateLivePreview() {
  if (dataSubnavMode !== 'create') return;
  const fileNameInput = document.getElementById('create-dataset-filename');
  const userTyped = fileNameInput?.value.trim();
  let rawName = userTyped || '';
  if (rawName && !rawName.endsWith('.json')) rawName += '.json';

  const codeEyebrow = document.getElementById('data-code-eyebrow');
  if (codeEyebrow) codeEyebrow.textContent = 'LIVE PREVIEW (.json)';

  const codeTitle = document.getElementById('data-code-title');
  if (codeTitle) {
    if (rawName) {
      codeTitle.textContent = `Tạo mới: ${rawName} (Xem trước)`;
    } else {
      codeTitle.textContent = 'Bản xem trước tệp mới';
    }
  }

  const statusBadge = document.getElementById('data-code-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
    statusBadge.classList.remove('modified');
    statusBadge.style.display = 'inline-flex';
  }

  const jsonStr = JSON.stringify(currentCreateDraftData || {}, null, 2);
  if (dataRawEditorController) {
    dataRawEditorController.setValue(jsonStr, { markClean: true });
  }

  const snippetBox = document.getElementById('create-dataset-snippet-box');
  const snippetCode = document.getElementById('create-dataset-snippet-code');
  if (snippetCode) {
    snippetCode.textContent = `const testData = require('../../../data/${rawName || 'dataset.json'}');`;
  }
  const selectScript = document.getElementById('create-dataset-linked-script-select');
  if (snippetBox && selectScript) {
    snippetBox.style.display = selectScript.value ? 'block' : 'none';
  }
}

function populateCreateLinkedScriptSelect() {
  const select = document.getElementById('create-dataset-linked-script-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Không liên kết ngay (Có thể import thủ công sau) --</option>' +
    (projectScripts || []).map((s) => `
      <option value="${escapeHtml(s.id)}" ${s.id === currentVal ? 'selected' : ''}>
        ${escapeHtml(s.scenarioName || s.fileName)} (${escapeHtml(s.fileName)})
      </option>
    `).join('');
}

async function submitCreateDataset() {
  const nameInput = document.getElementById('create-dataset-filename');
  let fileName = nameInput?.value.trim();
  if (!fileName) {
    notify('⚠️ Vui lòng nhập tên tệp dữ liệu.');
    nameInput?.focus();
    return;
  }
  if (!fileName.endsWith('.json')) fileName += '.json';

  let payloadContent = currentCreateDraftData;
  const rawVal = document.getElementById('data-raw-editor')?.value;
  if (rawVal) {
    try {
      payloadContent = JSON.parse(rawVal);
    } catch (_) {}
  }

  try {
    const res = await request('/api/data/create-dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        templateType: currentCreateTemplate,
        content: payloadContent,
      }),
    });

    notify(`🎉 ${res.message || 'Đã tạo tệp dữ liệu ' + fileName} thành công!`);

    const selectScript = document.getElementById('create-dataset-linked-script-select');
    if (selectScript && selectScript.value) {
      notify(`💡 Kịch bản BDD có thể nạp tệp qua: require('../../../data/${fileName}')`);
    }

    await loadDataFilesList();
    wizardAvailableDatasets = datasetsCache;
    editSelectedDataset = res.fileName || fileName;
    await selectDataset(res.fileName || fileName, true);
    switchToDataInspectMode();
  } catch (err) {
    notify('❌ Không thể tạo tệp dữ liệu: ' + err.message);
  }
}

async function saveCurrentDataset() {
  if (dataSubnavMode === 'create') {
    return submitCreateDataset();
  }
  if (!currentDataFile) {
    notify('Vui lòng chọn một tệp dữ liệu trước.');
    return;
  }
  try {
    let payloadData = currentDataset;
    const rawVal = document.getElementById('data-raw-editor')?.value;
    if (dataDirectEditMode && rawVal) {
      try {
        payloadData = JSON.parse(rawVal);
        currentDataset = payloadData;
      } catch (parseErr) {
        notify('⚠️ Mã JSON không hợp lệ: ' + parseErr.message);
        return;
      }
    }
    await request('/api/data/dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: currentDataFile, data: payloadData }),
    });
    originalDatasetRaw = JSON.stringify(currentDataset, null, 2);
    dataRawEditorController?.setValue(originalDatasetRaw, true);
    setDataDirty(false);
    notify(`✅ Đã lưu dữ liệu vào ${currentDataFile} (có tạo backup an toàn)!`);
    await loadDataFilesList();
  } catch (err) {
    notify('Không thể lưu dữ liệu: ' + err.message);
  }
}

function revertCurrentDataset() {
  if (dataSubnavMode === 'create') {
    return switchToDataCreateMode(currentCreateTemplate);
  }
  if (!originalDatasetRaw) return;
  try {
    currentDataset = JSON.parse(originalDatasetRaw);
    dataRawEditorController?.setValue(originalDatasetRaw, true);
    renderGroupedFormView();
    setDataDirty(false);
    notify('↩️ Đã hoàn tác thay đổi về bản gốc từ disk.');
  } catch (e) {
    notify('Lỗi hoàn tác: ' + e.message);
  }
}

function formatCurrentDatasetJson() {
  const rawEditorEl = document.getElementById('data-raw-editor');
  if (!rawEditorEl) return;
  try {
    const parsed = JSON.parse(rawEditorEl.value);
    const formatted = JSON.stringify(parsed, null, 2);
    dataRawEditorController?.setValue(formatted, false);
    if (dataSubnavMode === 'create') {
      currentCreateDraftData = parsed;
      renderCreateFields();
    } else {
      currentDataset = parsed;
      setDataDirty(true);
    }
    notify('✨ Đã format làm đẹp mã JSON.');
  } catch (err) {
    notify('⚠️ Không thể format: Mã JSON có lỗi cú pháp - ' + err.message);
  }
}

function initDataStudioControls() {
  if (isDataStudioInitialized) return;
  isDataStudioInitialized = true;

  // 1. Tìm kiếm và Filter Pills
  const searchInput = document.getElementById('data-search-input');
  searchInput?.addEventListener('input', (e) => {
    dataSearchQuery = e.target.value;
    renderDataFilesList();
  });

  document.querySelectorAll('#data-filter-pills .data-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#data-filter-pills .data-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      dataTypeFilter = btn.dataset.type || 'all';
      renderDataFilesList();
    });
  });

  // 2. Subnav Mode Buttons (Chi tiết, Tạo mới)
  document.getElementById('data-tab-inspect')?.addEventListener('click', switchToDataInspectMode);
  document.getElementById('btn-tab-data-inspect')?.addEventListener('click', switchToDataInspectMode);

  document.getElementById('data-tab-create')?.addEventListener('click', () => switchToDataCreateMode());
  document.getElementById('btn-tab-data-create')?.addEventListener('click', () => switchToDataCreateMode());
  document.getElementById('data-new-file-btn')?.addEventListener('click', () => switchToDataCreateMode());

  // Head toggle button for create mode
  document.getElementById('btn-toggle-data-sidebar-head-create')?.addEventListener('click', () => {
    document.getElementById('btn-toggle-data-sidebar-head')?.click();
  });

  // Creator Actions
  document.getElementById('btn-submit-create-dataset')?.addEventListener('click', submitCreateDataset);
  document.getElementById('btn-submit-create-dataset-bottom')?.addEventListener('click', submitCreateDataset);

  document.getElementById('btn-reset-create-dataset')?.addEventListener('click', () => switchToDataCreateMode(currentCreateTemplate));
  document.getElementById('btn-reset-create-dataset-bottom')?.addEventListener('click', () => switchToDataCreateMode(currentCreateTemplate));

  document.getElementById('btn-cancel-create-dataset')?.addEventListener('click', switchToDataInspectMode);
  document.getElementById('btn-cancel-create-dataset-bottom')?.addEventListener('click', switchToDataInspectMode);

  // Quick name suggestions
  document.querySelectorAll('.data-quick-name-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.name;
      const inp = document.getElementById('create-dataset-filename');
      if (inp && name) {
        inp.value = name;
        updateCreateLivePreview();
      }
    });
  });

  document.getElementById('create-dataset-filename')?.addEventListener('input', updateCreateLivePreview);

  // Add field in Creator
  document.getElementById('btn-add-create-field')?.addEventListener('click', () => {
    if (Array.isArray(currentCreateDraftData)) {
      const firstRow = currentCreateDraftData[0];
      if (firstRow && typeof firstRow === 'object') {
        const key = prompt('Nhập tên trường mới:');
        if (key && key.trim()) {
          currentCreateDraftData.forEach((row) => { row[key.trim()] = ''; });
          renderCreateFields();
          updateCreateLivePreview();
        }
      }
    } else if (typeof currentCreateDraftData === 'object' && currentCreateDraftData !== null) {
      const key = prompt('Nhập tên thuộc tính mới:');
      if (key && key.trim()) {
        currentCreateDraftData[key.trim()] = '';
        renderCreateFields();
        updateCreateLivePreview();
      }
    }
  });

  // Add row in Creator
  document.getElementById('btn-add-create-row')?.addEventListener('click', () => {
    if (Array.isArray(currentCreateDraftData)) {
      const templateRow = currentCreateDraftData[0] ? JSON.parse(JSON.stringify(currentCreateDraftData[0])) : {};
      Object.keys(templateRow).forEach((k) => { templateRow[k] = ''; });
      currentCreateDraftData.push(templateRow);
      renderCreateFields();
      updateCreateLivePreview();
    }
  });

  // Creator Faker Chips
  document.querySelectorAll('.data-create-faker-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.faker;
      if (lastFocusedDataInput) {
        lastFocusedDataInput.value += text;
        lastFocusedDataInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      navigator.clipboard.writeText(text);
      notify('Đã chèn và sao chép: ' + text);
    });
  });

  // Creator linked script select
  document.getElementById('create-dataset-linked-script-select')?.addEventListener('change', updateCreateLivePreview);
  document.getElementById('btn-copy-create-snippet')?.addEventListener('click', () => {
    const codeEl = document.getElementById('create-dataset-snippet-code');
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.textContent);
      notify('📋 Đã sao chép đoạn mã import dữ liệu!');
    }
  });

  // 3. Save buttons (Subnav, Middle Panel Head, Code Panel)
  document.getElementById('data-save-btn')?.addEventListener('click', saveCurrentDataset);
  document.getElementById('data-middle-save-btn')?.addEventListener('click', saveCurrentDataset);
  document.getElementById('data-code-save-btn')?.addEventListener('click', saveCurrentDataset);

  // 4. Revert buttons
  document.getElementById('data-revert-btn')?.addEventListener('click', revertCurrentDataset);
  document.getElementById('data-code-revert-btn')?.addEventListener('click', revertCurrentDataset);

  // 5. Format JSON button
  document.getElementById('data-format-json-btn')?.addEventListener('click', formatCurrentDatasetJson);

  // 6. Copy JSON buttons
  const copyHandler = async () => {
    const val = dataRawEditorController?.getValue() || JSON.stringify(currentDataset, null, 2);
    await navigator.clipboard.writeText(val);
    notify('📋 Đã sao chép mã JSON vào clipboard!');
  };
  document.getElementById('data-copy-json-btn')?.addEventListener('click', copyHandler);
  document.getElementById('data-code-copy-btn')?.addEventListener('click', copyHandler);

  // 7. Toggle Edit Button on Code Panel
  document.getElementById('data-btn-toggle-edit')?.addEventListener('click', () => {
    dataDirectEditMode = !dataDirectEditMode;
    const stage = document.getElementById('data-code-stage');
    const editor = document.getElementById('data-raw-editor');
    const saveBtn = document.getElementById('data-code-save-btn');
    const editBtnText = document.getElementById('data-edit-btn-text');
    const statusPill = document.getElementById('data-code-status-badge');

    if (dataDirectEditMode) {
      if (stage) stage.classList.add('editing');
      if (editor) {
        editor.removeAttribute('readonly');
        editor.focus();
      }
      if (saveBtn) saveBtn.style.display = 'inline-flex';
      if (editBtnText) editBtnText.textContent = 'Xem mã';
      if (statusPill) {
        statusPill.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Đang chỉnh sửa';
        statusPill.classList.add('modified');
      }
    } else {
      if (stage) stage.classList.remove('editing');
      if (editor) editor.setAttribute('readonly', 'true');
      if (saveBtn) saveBtn.style.display = 'none';
      if (editBtnText) editBtnText.textContent = 'Chỉnh sửa';
      setDataDirty(isDataDirty);
    }
  });

  // 8. Shared Code Editor for JSON
  const rawEditorEl = document.getElementById('data-raw-editor');
  const rawPreviewEl = document.getElementById('data-raw-preview');
  const rawEditor = createSharedCodeEditor({
    textarea: rawEditorEl,
    preview: rawPreviewEl,
    language: 'json',
    badge: document.getElementById('data-code-status-badge'),
    revertBtn: document.getElementById('data-code-revert-btn'),
    copyBtn: document.getElementById('data-code-copy-btn'),
    saveBtn: document.getElementById('data-code-save-btn'),
    onInput: () => {
      setDataDirty(true);
      try {
        currentDataset = JSON.parse(rawEditorEl.value);
        renderGroupedFormView();
      } catch (_) {}
    },
    onSave: async () => {
      await saveCurrentDataset();
    },
  });
  dataRawEditorController = rawEditor;

  // 9. Global Ctrl+S in Data Studio
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const dataView = document.getElementById('data-view');
      const isDataActive = dataView && (!dataView.hidden || dataView.classList.contains('active'));
      if (isDataActive) {
        e.preventDefault();
        saveCurrentDataset();
      }
    }
  });

  // 10. Refresh button
  document.getElementById('data-refresh-btn')?.addEventListener('click', async () => {
    await loadDataFilesList();
    if (currentDataFile) await selectDataset(currentDataFile, true);
    notify('Đã làm mới dữ liệu.');
  });

  // 11. Export CSV
  document.getElementById('data-export-csv-btn')?.addEventListener('click', () => {
    if (!currentDataFile) return notify('Vui lòng chọn tệp dữ liệu trước.');
    const link = document.createElement('a');
    link.href = `/api/data/export-csv?file=${encodeURIComponent(currentDataFile)}`;
    link.download = currentDataFile.replace(/\.json$/i, '.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // 12. Import CSV
  const csvInput = document.getElementById('data-csv-file-input');
  document.getElementById('data-import-csv-btn')?.addEventListener('click', () => {
    if (!currentDataFile) return notify('Vui lòng chọn tệp dữ liệu trước.');
    csvInput?.click();
  });

  csvInput?.addEventListener('change', async () => {
    const file = csvInput.files?.[0];
    if (!file || !currentDataFile) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('CSV vượt quá giới hạn 1 MB.');
      const csv = await file.text();
      const result = await request('/api/data/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: currentDataFile, csv }),
      });
      notify(`Đã nhập ${result.importedRows} dòng và tạo backup an toàn.`);
      await loadDataFilesList();
      await selectDataset(currentDataFile, true);
    } catch (error) {
      notify('Không thể nhập CSV: ' + error.message);
    } finally {
      csvInput.value = '';
    }
  });

  // 14. Dynamic preview & tags
  document.getElementById('data-quick-preview-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('modal-dynamic-preview');
    const listEl = document.getElementById('dynamic-preview-list');
    if (modal) modal.showModal();
    if (listEl) {
      try {
        const res = await request('/api/data/dynamic-preview');
        const items = [
          { tag: '{{random_phone}}', label: 'Số điện thoại ngẫu nhiên', val: res.random_phone },
          { tag: '{{random_email}}', label: 'Email test tự sinh', val: res.random_email },
          { tag: '{{random_name}}', label: 'Họ tên ngẫu nhiên', val: res.random_name },
          { tag: '{{timestamp}}', label: 'Timestamp hiện tại', val: res.timestamp },
          { tag: '{{date}}', label: 'Ngày hôm nay (YYYY-MM-DD)', val: res.date },
        ];
        listEl.innerHTML = items.map((it) => `
          <div class="dynamic-preview-item">
            <div class="dynamic-preview-meta">
              <span class="dynamic-preview-tag">${it.tag}</span>
              <small style="color: var(--muted);">${it.label}</small>
              <span class="dynamic-preview-val">${it.val}</span>
            </div>
            <button type="button" class="btn-secondary-sm" onclick="navigator.clipboard.writeText('${it.tag}'); notify('Đã copy ' + '${it.tag}');"><i class="ph ph-copy"></i> Copy</button>
          </div>
        `).join('');
      } catch (err) {
        listEl.innerHTML = '<p style="color:#ef4444;">Lỗi tải giá trị mẫu: ' + err.message + '</p>';
      }
    }
  });

  document.querySelectorAll('.dynamic-tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      const text = tag.dataset.tag;
      if (lastFocusedDataInput) {
        lastFocusedDataInput.value += text;
        lastFocusedDataInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      navigator.clipboard.writeText(text);
      notify('Đã chèn và sao chép: ' + text);
    });
  });

}

/* ==========================================================================
   VISUAL STEP BUILDER (NO-CODE BDD DESIGNER)
   ========================================================================== */

let builderPresetActions = [];
let isVisualBuilderInitialized = false;
let builderSteps = [];

function populateBuilderSpecOptions() {
  const select = $('#builder-template-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `
    <option value="custom" selected>-- Tự tạo kịch bản mới (Mặc định) --</option>
    <optgroup label="✨ Mẫu kịch bản chuẩn hóa">
      <option value="apply_nocv">⚡ Ứng tuyển nhanh không cần CV</option>
      <option value="login_profile">👤 Đăng nhập & Cập nhật hồ sơ</option>
      <option value="job_search">🔍 Tìm kiếm việc làm theo ngành nghề</option>
    </optgroup>
  `;

  if (testCatalog && testCatalog.specs && testCatalog.specs.length > 0) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = '📂 Chỉnh sửa file test có sẵn trong Framework';
    testCatalog.specs.forEach((spec) => {
      const opt = document.createElement('option');
      opt.value = `spec:${spec}`;
      opt.textContent = `📄 ${spec}`;
      optGroup.appendChild(opt);
    });
    select.appendChild(optGroup);
  }

  if (currentVal && Array.from(select.options).some((o) => o.value === currentVal)) {
    select.value = currentVal;
  }
}

let projectScripts = [];
let currentSelectedScript = null;
let scriptPlatformFilter = 'desktop';
let scriptSearchQuery = '';

async function loadProjectScripts() {
  const listEl = document.getElementById('script-files-list');
  if (listEl) {
    listEl.innerHTML = '<div class="data-loading-spinner"><i class="ph ph-spinner ph-spin"></i> Đang tải danh sách kịch bản...</div>';
  }
  try {
    const res = await request('/api/builder/scripts');
    projectScripts = res.scripts || [];
    const totalCountEl = document.getElementById('stat-scripts-total');
    if (totalCountEl) totalCountEl.textContent = projectScripts.length;
    const statDeskEl = document.getElementById('stat-scripts-desktop');
    if (statDeskEl) statDeskEl.textContent = projectScripts.filter((s) => s.platform === 'desktop').length;
    const statMobEl = document.getElementById('stat-scripts-mobile');
    if (statMobEl) statMobEl.textContent = projectScripts.filter((s) => s.platform === 'mobile-web').length;
    renderScriptSidebarList();
    if (projectScripts.length > 0) {
      if (!currentSelectedScript) {
        selectProjectScript(projectScripts[0]);
      } else {
        const found = projectScripts.find((s) => s.id === currentSelectedScript.id);
        selectProjectScript(found || projectScripts[0]);
      }
    }
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div style="padding: 14px; color: #ef4444; font-size: 12.5px;">Lỗi nạp kịch bản: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderScriptSidebarList() {
  const listEl = document.getElementById('script-files-list');
  if (!listEl) return;

  const countAll = projectScripts.length;
  const countDesktop = projectScripts.filter((s) => s.platform === 'desktop').length;
  const countMobile = projectScripts.filter((s) => s.platform === 'mobile-web').length;
  const countApi = projectScripts.filter((s) => s.platform === 'api').length;
  const countSetup = projectScripts.filter((s) => s.platform === 'setup').length;

  const q = scriptSearchQuery.trim().toLowerCase();
  const filtered = projectScripts.filter((s) => {
    if (scriptPlatformFilter && scriptPlatformFilter !== 'all' && s.platform !== scriptPlatformFilter) return false;
    if (!q) return true;
    return (
      (s.scenarioName && s.scenarioName.toLowerCase().includes(q)) ||
      (s.featureName && s.featureName.toLowerCase().includes(q)) ||
      (s.fileName && s.fileName.toLowerCase().includes(q)) ||
      (s.tags && s.tags.toLowerCase().includes(q)) ||
      (s.primaryDataFile && s.primaryDataFile.toLowerCase().includes(q))
    );
  });

  const sCount = document.getElementById('stat-scripts-sidebar-count');
  if (sCount) sCount.textContent = filtered.length;

  const scriptRailBadge = document.getElementById('script-rail-count');
  if (scriptRailBadge) scriptRailBadge.textContent = filtered.length;

  if (filtered.length > 0 && (!currentSelectedScript || !filtered.some((s) => s.id === currentSelectedScript.id))) {
    selectProjectScript(filtered[0], false);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Không tìm thấy kịch bản phù hợp.</div>';
    return;
  }

  listEl.innerHTML = filtered
    .map((s) => {
      const isActive = currentSelectedScript && currentSelectedScript.id === s.id;
      const isMobile = s.platform === 'mobile-web';
      const isApi = s.platform === 'api';
      const isSetup = s.platform === 'setup';
      const rawTags = s.tags ? s.tags.match(/@[\w-]+/g) || [] : [];
      const pagesCount = s.pageCount || (s.pages ? s.pages.length : 0);

      let platformClass = 'desktop';
      let platformIcon = 'ph-desktop';
      let platformLabel = 'Desktop';
      if (isMobile) {
        platformClass = 'mobile';
        platformIcon = 'ph-device-mobile';
        platformLabel = 'Mobile';
      } else if (isApi) {
        platformClass = 'api';
        platformIcon = 'ph-plugs';
        platformLabel = 'API';
      } else if (isSetup) {
        platformClass = 'setup';
        platformIcon = 'ph-gear';
        platformLabel = 'Setup';
      }

      return `
      <div class="dashboard-list-card script-card-item ${isActive ? 'is-selected active' : ''}" data-id="${escapeHtml(s.id)}">
        <span class="dashboard-list-card__icon script-card-platform-icon ${platformClass}"><i class="ph-bold ${platformIcon}"></i></span>
        <div class="dashboard-list-card__body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
            <div class="script-card-title">${escapeHtml(s.scenarioName || s.featureName || s.fileName)}</div>
            <button type="button" class="btn-icon-subtle item-delete-hover-btn script-item-delete-btn" data-id="${escapeHtml(s.id)}" title="Xóa kịch bản này" style="padding: 2px; font-size: 14px; flex-shrink: 0;">
              <i class="ph ph-trash"></i>
            </button>
          </div>
          <div class="script-card-file">
            <i class="ph ph-file-js"></i> ${escapeHtml(s.fileName)}
          </div>
          <div class="script-card-pills">
            <span class="script-card-badge-platform ${platformClass}">
              <i class="ph ${platformIcon}"></i> ${platformLabel}
            </span>
            <span class="script-card-badge-pages">
              <i class="ph ph-stack"></i> ${pagesCount} Pages
            </span>
            ${s.primaryDataFile ? `
            <span class="script-card-badge-data" title="${escapeHtml(s.primaryDataFile)}">
              <i class="ph ph-database"></i> ${escapeHtml(s.primaryDataFile)}
            </span>` : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  listEl.querySelectorAll('.script-card-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.script-item-delete-btn')) return;
      const id = item.dataset.id;
      const s = projectScripts.find((p) => p.id === id);
      if (s) selectProjectScript(s, true);
    });
  });

  listEl.querySelectorAll('.script-item-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const s = projectScripts.find((p) => p.id === id);
      if (s) {
        selectProjectScript(s, false);
        document.getElementById('script-delete-btn')?.click();
      }
    });
  });
}

function selectProjectScript(script, doScroll = false) {
  if (!script) return;
  currentSelectedScript = script;

  // Luôn chuyển về chế độ inspect khi chọn một kịch bản từ danh sách
  if (typeof scriptBuilderMode !== 'undefined') {
    scriptBuilderMode = 'inspect';
    document.getElementById('btn-tab-script-inspect')?.classList.add('active');
    document.getElementById('btn-tab-script-edit')?.classList.remove('active');
    document.getElementById('btn-tab-script-create')?.classList.remove('active');
    const inspectView = document.getElementById('script-inspect-view');
    const editView = document.getElementById('script-edit-view');
    const createView = document.getElementById('script-create-view');
    if (inspectView) {
      inspectView.style.display = 'flex';
      inspectView.scrollTop = 0;
    }
    if (editView) editView.style.display = 'none';
    if (createView) createView.style.display = 'none';
  }

  // Reset chế độ xem code về preview disk an toàn
  scriptDirectEditMode = false;
  const stage = document.getElementById('script-code-stage');
  const editor = document.getElementById('script-spec-editor');
  const saveBtn = document.getElementById('script-spec-save-btn');
  const editBtnText = document.getElementById('script-edit-btn-text');
  const statusPill = document.getElementById('script-spec-status-badge');
  if (stage) stage.classList.remove('editing');
  if (editor) editor.setAttribute('readonly', 'true');
  if (saveBtn) saveBtn.style.display = 'none';
  if (editBtnText) editBtnText.textContent = 'Chỉnh sửa';
  if (statusPill) {
    statusPill.innerHTML = '<i class="ph-bold ph-check"></i> Đang mở từ disk';
    statusPill.classList.remove('modified');
  }

  // Highlight thẻ được chọn trong sidebar (đồng bộ is-selected và active)
  document.querySelectorAll('#script-files-list .script-card-item').forEach((item) => {
    const isThis = item.dataset.id === script.id;
    item.classList.toggle('active', isThis);
    item.classList.toggle('is-selected', isThis);
  });

  if (doScroll) {
    const scriptWorkspace = document.querySelector('.script-workspace-panel');
    scriptWorkspace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Banner
  const pTag = document.getElementById('script-banner-platform');
  if (pTag) pTag.textContent = script.platform === 'mobile-web' ? 'Mobile Web' : 'Desktop Web';

  const fBadge = document.getElementById('script-banner-file');
  if (fBadge) fBadge.textContent = script.fileName;

  const sTitle = document.getElementById('script-banner-title');
  if (sTitle) sTitle.textContent = script.scenarioName || script.id;

  const middleTitle = document.getElementById('script-middle-title');
  if (middleTitle) middleTitle.textContent = script.fileName;

  const codeTitle = document.getElementById('script-code-title');
  if (codeTitle) codeTitle.textContent = script.fileName;

  const scenarioNameText = document.getElementById('script-scenario-name-text');
  if (scenarioNameText) scenarioNameText.textContent = script.scenarioName || script.id;

  const inspectPlatform = document.getElementById('inspect-platform-value');
  if (inspectPlatform) inspectPlatform.textContent = script.platform === 'mobile-web' ? 'Mobile Web' : 'Desktop Web';
  const inspectFile = document.getElementById('inspect-file-value');
  if (inspectFile) inspectFile.textContent = script.relativePath || script.fileName || 'Chưa xác định';
  const inspectFeature = document.getElementById('inspect-feature-value');
  if (inspectFeature) inspectFeature.textContent = script.featureName || 'Chưa xác định';
  const inspectTags = document.getElementById('inspect-tags-value');
  if (inspectTags) inspectTags.textContent = script.tags || 'Không có tag';

  const preconditionMatch = String(script.specCode || '').match(/description:\s*(['"`])([\s\S]*?)\1/);
  const authValue = document.getElementById('inspect-auth-value');
  const specText = String(script.specCode || '');
  const isAuthenticated = (script.fixtures || []).includes('authenticatedUser') || /\bauthenticatedUser\b/.test(specText);
  if (authValue) authValue.textContent = isAuthenticated ? 'Đã đăng nhập (authenticatedUser)' : (preconditionMatch?.[2] || 'Chưa phân tích');
  const landingValue = document.getElementById('inspect-landing-value');
  if (landingValue) landingValue.textContent = (script.specCode || '').includes('expectHomepageVisible') ? 'Trang chủ sẵn sàng' : 'Không khai báo rõ';
  const initialEvidence = String(script.specCode || '').match(/capture\(['"](precondition[^'"]*)['"]/i);
  const evidenceValue = document.getElementById('inspect-precondition-evidence');
  if (evidenceValue) evidenceValue.textContent = initialEvidence ? initialEvidence[1] : 'Không khai báo';

  const bddStat = document.getElementById('pillar-bdd-count-stat');
  if (bddStat) bddStat.textContent = (script.steps || []).length;

  const pagesStat = document.getElementById('pillar-pages-count-stat');
  if (pagesStat) pagesStat.textContent = (script.pages || []).length;

  const dataStat = document.getElementById('pillar-data-count-stat');
  if (dataStat) {
    const dCount = (script.dataFiles || []).length || (script.primaryDataFile && script.primaryDataFile !== 'none' ? 1 : 0);
    dataStat.textContent = dCount;
  }

  const scrollWrap = document.getElementById('script-middle-scroll');
  if (scrollWrap) scrollWrap.scrollTop = 0;

  const sFeature = document.getElementById('script-banner-feature');
  if (sFeature) sFeature.innerHTML = `<i class="ph ph-folder"></i> Feature: ${escapeHtml(script.featureName || 'Kiểm thử')}`;

  const tagsBox = document.getElementById('script-banner-tags');
  if (tagsBox) {
    const rawTags = script.tags ? script.tags.match(/@[\w-]+/g) || [] : [];
    tagsBox.innerHTML = rawTags.map((t) => `<span class="script-tag-chip">${escapeHtml(t)}</span>`).join('');
  }

  // KHỐI 1: BDD Spec
  const bddFilename = document.getElementById('pillar-bdd-filename');
  if (bddFilename) bddFilename.textContent = `${script.relativePath}`;

  const bddCount = document.getElementById('pillar-bdd-count');
  const steps = script.steps || [];
  if (bddCount) bddCount.textContent = `${steps.length} bước BDD`;

  const timelineEl = document.getElementById('pillar-bdd-timeline');
  if (timelineEl) {
    if (steps.length === 0) {
      timelineEl.innerHTML = '<div style="color: var(--muted); font-size: 13px;">Chưa có bước BDD nào được định nghĩa trong file này.</div>';
    } else {
      timelineEl.innerHTML = steps
        .map((st, idx) => {
          const type = (st.stepType || 'When').toUpperCase();
          const typeCls = (st.stepType || 'When').toLowerCase();
          const preset = builderPresetActions.find((action) => action.id === st.actionId);
          const actionLabel = preset?.name || st.actionId || 'Chưa phân tích action';
          const fixtureMatch = String(st.code || '').match(/(?:await\s+)?([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*\(/);
          const evidenceMatches = String(st.code || '').match(/capture\(['"]([^'"]+)['"]/g) || [];
          const evidenceLabel = evidenceMatches.length ? evidenceMatches.map((item) => item.replace(/^capture\(['"]|['"]\)$/g, '')).join(', ') : 'Không khai báo';
          return `
          <div class="bdd-step-unit" data-step-idx="${idx + 1}">
            <span class="bdd-step-type-pill ${typeCls}">${escapeHtml(type)}</span>
            <div class="bdd-step-content">
              <div class="bdd-step-title">${escapeHtml(st.title)}</div>
              <div class="bdd-step-runtime-grid">
                <span><b>Action</b> ${escapeHtml(actionLabel)}</span>
                <span><b>Fixture/Page</b> ${escapeHtml(fixtureMatch?.[1] || 'Chưa phân tích')}</span>
                <span><b>Evidence</b> ${escapeHtml(evidenceLabel)}</span>
              </div>
            </div>
          </div>
        `;
        })
        .join('');
    }
  }

  // KHỐI FIXTURE: Fixture Nền Tảng (baseTest hoặc mobileWebTest)
  const isMobileScript = script.platform === 'mobile-web' || (script.relativePath && script.relativePath.includes('mobile-web'));
  const fixturePath = isMobileScript ? 'core/fixtures/mobileWebTest.js' : 'core/fixtures/baseTest.js';
  const fixtureName = isMobileScript ? 'mobileWebTest.js' : 'baseTest.js';
  const fixtureScopeText = isMobileScript ? 'Mobile Web Scope' : 'Desktop Web Scope';

  const fixtureNameEl = document.getElementById('pillar-fixture-name');
  if (fixtureNameEl) fixtureNameEl.textContent = fixturePath;

  const fixtureScopeEl = document.getElementById('pillar-fixture-scope');
  if (fixtureScopeEl) {
    fixtureScopeEl.textContent = fixtureScopeText;
    if (isMobileScript) {
      fixtureScopeEl.style.background = 'rgba(14, 165, 233, 0.12)';
      fixtureScopeEl.style.color = '#0284c7';
      fixtureScopeEl.style.borderColor = 'rgba(14, 165, 233, 0.25)';
    } else {
      fixtureScopeEl.style.background = 'rgba(168, 85, 247, 0.12)';
      fixtureScopeEl.style.color = '#9333ea';
      fixtureScopeEl.style.borderColor = 'rgba(168, 85, 247, 0.25)';
    }
  }

  const btnViewFixtureCode = document.getElementById('btn-view-fixture-code');
  if (btnViewFixtureCode) {
    btnViewFixtureCode.onclick = () => openPageCodeModal(fixturePath, fixtureName);
  }

  const renderFixtureCaps = (methods = []) => {
    const fixtureCapsWrap = document.getElementById('pillar-fixture-caps');
    if (!fixtureCapsWrap) return;

    if (methods.length > 0) {
      const groups = {};
      methods.forEach((m) => {
        const cat = m.category || 'Tiện ích Fixture';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(m);
      });

      fixtureCapsWrap.innerHTML = Object.entries(groups)
        .map(([category, items]) => {
          let pillCls = 'pom';
          if (category.includes('Xác thực') || category.includes('auth')) pillCls = 'auth';
          else if (category.includes('Factory')) pillCls = 'factory';

          return `
            <div class="fixture-cap-group">
              <span class="fixture-cap-group-title">
                <i class="ph-bold ${category.includes('Xác thực') ? 'ph-user-check' : category.includes('Factory') ? 'ph-tabs' : 'ph-browsers'}"></i>
                ${escapeHtml(category)} (${items.length})
              </span>
              <div class="fixture-cap-pills">
                ${items
                  .map(
                    (it) => `
                  <span class="fixture-cap-pill ${pillCls}" title="${escapeHtml(it.description || it.name)}">
                    <code>${escapeHtml(it.name)}</code>
                  </span>`
                  )
                  .join('')}
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      fixtureCapsWrap.innerHTML = `
        <div style="font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 6px;">
          <i class="ph ph-info"></i>
          <span>Fixture mở rộng Playwright Test với các capabilities tự động inject (Page Objects, Preconditions & Factory).</span>
        </div>
      `;
    }
  };

  const fixtureObj = (repoPages || []).find((p) => p.relativePath === fixturePath);
  if (fixtureObj && fixtureObj.methods && fixtureObj.methods.length > 0) {
    renderFixtureCaps(fixtureObj.methods);
  } else {
    request(`/api/object-repository/page?file=${encodeURIComponent(fixturePath)}`)
      .then((data) => {
        if (data && data.methods) renderFixtureCaps(data.methods);
      })
      .catch(() => renderFixtureCaps([]));
  }

  // KHỐI 2: Page Objects
  const pagesCount = document.getElementById('pillar-pages-count');
  const pages = script.pages || [];
  if (pagesCount) pagesCount.textContent = `${pages.length} Pages`;

  const pagesGrid = document.getElementById('pillar-pages-grid');
  if (pagesGrid) {
    if (pages.length === 0) {
      pagesGrid.innerHTML = '<div style="color: var(--muted); font-size: 13px;">Kịch bản này không sử dụng Page Objects từ fixtures.</div>';
    } else {
      pagesGrid.innerHTML = pages
        .map((p) => {
          const acts = p.actions || [];
          return `
          <div class="page-obj-card">
            <div class="page-obj-head">
              <div class="page-obj-icon-wrap">
                <i class="ph-bold ph-browsers"></i>
              </div>
              <div class="page-obj-title-group">
                <div class="page-obj-title">${escapeHtml(p.name)}</div>
                <div class="page-obj-path">${escapeHtml(p.relativePath)}</div>
              </div>
              <span class="page-obj-counter-badge">${acts.length} hành động</span>
            </div>
            ${acts.length > 0 ? `
            <div class="page-obj-actions-box">
              <span class="page-obj-actions-label">HÀNH ĐỘNG GỌI TRONG KỊCH BẢN:</span>
              <div class="page-obj-actions-chips">
                ${acts.map((a) => `<span class="page-action-chip">${escapeHtml(a)}()</span>`).join('')}
              </div>
            </div>` : '<small class="page-obj-empty-note">Khởi tạo & kiểm tra giao diện cơ sở</small>'}
            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button type="button" class="btn-page-view-code" onclick="openPageCodeModal('${escapeHtml(p.relativePath)}', '${escapeHtml(p.name)}')">
                <i class="ph ph-file-code"></i> Xem mã
              </button>
              <button type="button" class="btn-page-view-code" style="background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent);" onclick="openInsertPomActionModal('${escapeHtml(p.relativePath)}')">
                <i class="ph-bold ph-plus-circle"></i> Thêm Action
              </button>
            </div>
          </div>
        `;
        })
        .join('');
    }
  }

  // KHỐI 3: Data File
  const dataBox = document.getElementById('pillar-data-box');
  if (dataBox) {
    const dataFiles = script.dataFiles || [];
    const primaryFile = script.primaryDataFile || (dataFiles.length > 0 ? dataFiles[0].name : null);

    if (primaryFile && primaryFile !== 'none') {
      dataBox.innerHTML = `
        <div class="data-pillar-card-box">
          <div class="data-pillar-left">
            <div class="data-pillar-icon-tile">
              <i class="ph-bold ph-database"></i>
            </div>
            <div class="data-pillar-info">
              <div class="data-pillar-name-row">
                <strong class="data-pillar-name">${escapeHtml(primaryFile)}</strong>
                <span class="data-file-type-pill">JSON DATASET</span>
              </div>
              <div class="data-pillar-path">data/${escapeHtml(primaryFile)}</div>
              <p class="data-pillar-desc">Tệp dữ liệu kiểm thử được kịch bản nạp vào tự động trong quá trình chạy test.</p>
            </div>
          </div>
          <button type="button" class="btn-data-jump" onclick="jumpToDataFile('${escapeHtml(primaryFile)}')">
            <i class="ph-bold ph-arrow-square-out"></i>
            <span>Mở & Chỉnh sửa trong tab Dữ liệu test</span>
          </button>
        </div>
      `;
    } else {
      dataBox.innerHTML = `
        <div class="data-pillar-empty">
          <i class="ph ph-info"></i>
          <span>Kịch bản này không dùng file dữ liệu ngoài (hoặc dùng fixtures tự sinh).</span>
        </div>
      `;
    }
  }

  // TAB 2: Spec Code
  const specPathLabel = document.getElementById('script-spec-path-label');
  if (specPathLabel) specPathLabel.textContent = script.relativePath;

  if (window.specCodeEditor) {
    window.specCodeEditor.setValue(script.specCode || '', { markClean: true, readOnly: true });
  } else {
    const specEditor = document.getElementById('script-spec-editor');
    const specPreview = document.getElementById('script-spec-code');
    if (specEditor) specEditor.value = script.specCode || '';
    if (specPreview) {
      specPreview.innerHTML = highlightCode(script.specCode || '', false);
    }
  }
  const specBadge = document.getElementById('script-spec-status-badge');
  const specRevert = document.getElementById('script-spec-revert-btn');
  if (specBadge) {
    specBadge.innerHTML = '<i class="ph-bold ph-check"></i> Đang mở từ disk';
    specBadge.classList.remove('modified');
    specBadge.style.display = 'inline-flex';
  }
  if (specRevert) specRevert.style.display = 'none';

  // Đồng bộ sang Visual Step Builder để tester có thể sửa trực tiếp nếu muốn
  if ($('#builder-feature-name')) $('#builder-feature-name').value = script.featureName || '';
  if ($('#builder-scenario-name')) $('#builder-scenario-name').value = script.scenarioName || '';
  if ($('#builder-platform')) $('#builder-platform').value = script.platform || 'desktop';
  if ($('#builder-tags')) $('#builder-tags').value = script.tags || '@e2e';
  if ($('#builder-data-source')) {
    $('#builder-data-source').value = script.primaryDataFile || 'none';
  }
  builderSteps = script.steps ? JSON.parse(JSON.stringify(script.steps)) : [];
  renderBuilderSteps();
  compileBuilderScenario();
}

let currentModalPagePath = '';
let currentModalPageOriginalContent = '';

window.openPageCodeModal = async function (pagePath, pageName) {
  const modal = document.getElementById('modal-view-page-code');
  if (!modal) return;
  const titleEl = document.getElementById('modal-page-title');
  const pathEl = document.getElementById('modal-page-path');
  const editor = document.getElementById('modal-page-editor');
  const previewPre = document.getElementById('modal-page-preview');
  const preview = document.getElementById('modal-page-code');
  const dirtyBadge = document.getElementById('modal-page-dirty-badge');
  const saveBtn = document.getElementById('modal-page-save-btn');

  currentModalPagePath = pagePath;
  const isFixture = pagePath.startsWith('core/fixtures/');
  const isCoreFixture = pagePath === 'core/fixtures/baseTest.js' || pagePath === 'core/fixtures/mobileWebTest.js' || (pagePath.startsWith('core/fixtures/') && !pagePath.includes('/custom/'));

  if (titleEl) {
    if (isCoreFixture) {
      titleEl.innerHTML = `<i class="ph-bold ph-lightning" style="color: #a855f7;"></i> Fixture Nền Tảng: ${escapeHtml(pageName)} <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 600; margin-left: 8px; vertical-align: middle;"><i class="ph-bold ph-lock-key"></i> CHỈ ĐỌC</span>`;
    } else if (isFixture) {
      titleEl.innerHTML = `<i class="ph-bold ph-sparkle" style="color: #10b981;"></i> Custom Fixture: ${escapeHtml(pageName)}`;
    } else {
      titleEl.innerHTML = `<i class="ph-bold ph-browsers" style="color: #10b981;"></i> Page Object: ${escapeHtml(pageName)}`;
    }
  }
  if (pathEl) pathEl.textContent = pagePath;
  if (dirtyBadge) dirtyBadge.style.display = 'none';
  const eyebrowEl = document.getElementById('modal-page-eyebrow');
  if (eyebrowEl) {
    if (isCoreFixture) {
      eyebrowEl.innerHTML = 'MÃ NGUỒN FIXTURE NỀN TẢNG &bull; <span style="color: #ef4444; font-weight: 600;"><i class="ph-bold ph-lock-key"></i> ĐƯỢC BẢO VỆ CHỈ ĐỌC</span>';
    } else if (isFixture) {
      eyebrowEl.textContent = 'Mã nguồn Custom Fixture';
    } else {
      eyebrowEl.textContent = 'Mã nguồn Page Object Class';
    }
  }

  const protectBanner = document.getElementById('modal-fixture-protect-banner');
  if (protectBanner) {
    protectBanner.style.display = isCoreFixture ? 'block' : 'none';
  }
  const btnModalOpenFixturesStudio = document.getElementById('btn-modal-open-fixtures-studio');
  if (btnModalOpenFixturesStudio && !btnModalOpenFixturesStudio.__bound) {
    btnModalOpenFixturesStudio.__bound = true;
    btnModalOpenFixturesStudio.onclick = () => {
      modal.close();
      if (typeof openFixturesStudio === 'function') {
        openFixturesStudio();
      }
    };
  }

  // Ensure scroll listener is bound directly on modal elements as failsafe
  if (editor && previewPre && !editor.__modalScrollBound) {
    editor.__modalScrollBound = true;
    let syncing = false;
    editor.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      previewPre.scrollTop = editor.scrollTop;
      previewPre.scrollLeft = editor.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive: true });
    previewPre.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      editor.scrollTop = previewPre.scrollTop;
      editor.scrollLeft = previewPre.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive: true });
  }

  if (window.pageCodeEditor) {
    window.pageCodeEditor.setValue('Đang tải mã nguồn...', { markClean: true });
  } else {
    if (editor) editor.value = 'Đang tải mã nguồn...';
    if (preview) preview.innerHTML = '<span style="color: var(--muted);">Đang tải mã nguồn...</span>';
    if (previewPre) { previewPre.scrollTop = 0; previewPre.scrollLeft = 0; }
  }

  modal.showModal();

  try {
    const res = await request(`/api/builder/page-content?file=${encodeURIComponent(pagePath)}`);
    currentModalPageOriginalContent = res.content || '';
    if (window.pageCodeEditor) {
      window.pageCodeEditor.setValue(currentModalPageOriginalContent, { markClean: true, readOnly: isCoreFixture });
      window.pageCodeEditor.setReadOnly(isCoreFixture);
    } else {
      if (editor) {
        editor.value = currentModalPageOriginalContent;
        if (isCoreFixture) {
          editor.setAttribute('readonly', 'true');
        } else {
          editor.removeAttribute('readonly');
        }
        editor.scrollTop = 0;
        editor.scrollLeft = 0;
      }
      if (preview) {
        preview.innerHTML = highlightCode(currentModalPageOriginalContent, false) + '\n';
      }
      if (previewPre) {
        previewPre.scrollTop = 0;
        previewPre.scrollLeft = 0;
      }
    }

    const copyBtn = document.getElementById('modal-page-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(editor ? editor.value : currentModalPageOriginalContent);
        notify(isFixture ? 'Đã sao chép mã nguồn Fixture!' : 'Đã sao chép mã nguồn Page Object!');
      };
    }

    if (saveBtn) {
      if (isCoreFixture) {
        saveBtn.style.display = 'none';
      } else {
        saveBtn.style.display = 'inline-flex';
        saveBtn.onclick = async () => {
        if (!currentModalPagePath || !editor) return;
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang lưu...';
        try {
          const newContent = editor.value;
          await request('/api/code', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: currentModalPagePath,
              content: newContent,
            }),
          });
          currentModalPageOriginalContent = newContent;
          if (window.pageCodeEditor) {
            window.pageCodeEditor.markSaved(newContent);
          }
          if (dirtyBadge) dirtyBadge.style.display = 'none';
          notify(`✅ Đã lưu file ${isFixture ? 'Fixture' : 'Page Object'} ${escapeHtml(pageName)} thành công!`);
        } catch (saveErr) {
          notify(`❌ Lỗi khi lưu ${isFixture ? 'Fixture' : 'Page Object'}: ${saveErr.message}`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalText;
        }
      };
    }
  }
  } catch (err) {
    if (editor) editor.value = `Lỗi: ${err.message}`;
    if (preview) preview.innerHTML = `<span style="color: #ef4444;">${escapeHtml(err.message)}</span>`;
  }
};

window.jumpToDataFile = function (dataFileName) {
  const dataTabBtn = document.querySelector('.view-tab[data-view="data-view"]');
  if (dataTabBtn) {
    dataTabBtn.click();
    setTimeout(() => {
      const targetBtn = document.querySelector(`.data-file-item[data-filename="${dataFileName}"]`);
      if (targetBtn) {
        targetBtn.click();
        notify(`Đã chuyển sang xem và chỉnh sửa tệp: ${dataFileName}`);
      } else {
        notify(`Đã mở tab Dữ liệu test (${dataFileName})`);
      }
    }, 150);
  }
};

// =========================================================================
// POM TO BDD LINKER ENGINE
// =========================================================================

let pomModalActiveType = 'method'; // 'method' | 'locator'
let pomModalCurrentPageDetails = null;
let isPomModalControlsInitialized = false;

function initPomModalControls() {
  if (isPomModalControlsInitialized) return;
  const modal = document.getElementById('modal-insert-pom-action');
  if (!modal) return;
  isPomModalControlsInitialized = true;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  document.getElementById('btn-close-pom-modal')?.addEventListener('click', () => modal.close());
  document.getElementById('btn-cancel-pom-modal')?.addEventListener('click', () => modal.close());
  document.getElementById('btn-submit-pom-modal')?.addEventListener('click', () => submitPomActionToBdd());

  document.querySelectorAll('.pom-type-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pom-type-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      pomModalActiveType = tab.dataset.type;
      const methodPanel = document.getElementById('pom-panel-method');
      const locPanel = document.getElementById('pom-panel-locator');
      if (pomModalActiveType === 'locator') {
        if (methodPanel) methodPanel.style.display = 'none';
        if (locPanel) locPanel.style.display = 'block';
      } else {
        if (methodPanel) methodPanel.style.display = 'block';
        if (locPanel) locPanel.style.display = 'none';
      }
      updatePomCodePreview();
    });
  });

  document.getElementById('pom-modal-script-select')?.addEventListener('change', () => updatePomCodePreview());
  document.getElementById('pom-modal-page-select')?.addEventListener('change', () => loadPomModalPageDetails());
  document.getElementById('pom-modal-method-select')?.addEventListener('change', () => {
    updatePomModalParamsHint();
    updatePomCodePreview();
  });
  document.getElementById('pom-modal-method-params')?.addEventListener('input', () => updatePomCodePreview());
  document.getElementById('pom-modal-loc-select')?.addEventListener('change', () => updatePomCodePreview());
  document.getElementById('pom-modal-loc-action')?.addEventListener('change', () => updatePomCodePreview());
  document.getElementById('pom-modal-loc-value')?.addEventListener('input', () => updatePomCodePreview());
  document.getElementById('pom-modal-step-keyword')?.addEventListener('change', () => updatePomCodePreview());
  document.getElementById('pom-modal-step-title')?.addEventListener('input', () => {
    const titleInput = document.getElementById('pom-modal-step-title');
    if (titleInput) titleInput.dataset.autoGenerated = 'false';
    updatePomCodePreview();
  });
  document.getElementById('pom-modal-include-evidence')?.addEventListener('change', () => updatePomCodePreview());
}

window.openInsertPomActionModal = async function (targetPageOrRelPath, preselectedActionName = null) {
  initPomModalControls();

  const modal = document.getElementById('modal-insert-pom-action');
  if (!modal) return;

  // Reset type to method tab on open
  pomModalActiveType = 'method';
  document.querySelectorAll('.pom-type-tab').forEach((t) => t.classList.toggle('active', t.dataset.type === 'method'));
  const methodPanel = document.getElementById('pom-panel-method');
  const locPanel = document.getElementById('pom-panel-locator');
  if (methodPanel) methodPanel.style.display = 'block';
  if (locPanel) locPanel.style.display = 'none';

  const titleInput = document.getElementById('pom-modal-step-title');
  if (titleInput) {
    titleInput.value = '';
    titleInput.dataset.autoGenerated = 'true';
  }

  const scriptSelect = document.getElementById('pom-modal-script-select');
  const pageSelect = document.getElementById('pom-modal-page-select');

  // Đảm bảo nạp danh sách BDD scripts
  if (!projectScripts || projectScripts.length === 0) {
    try {
      const sRes = await request('/api/builder/scripts');
      projectScripts = sRes.scripts || [];
    } catch (e) {
      console.error('Error loading scripts for modal:', e);
    }
  }

  // Đảm bảo nạp danh sách repoPages
  if (!repoPages || repoPages.length === 0) {
    try {
      const pRes = await request('/api/object-repository/pages');
      repoPages = pRes.pages || [];
    } catch (e) {
      console.error('Error loading pages for modal:', e);
    }
  }

  // 1. Render danh sách kịch bản BDD đích
  if (scriptSelect) {
    if (projectScripts.length === 0) {
      scriptSelect.innerHTML = '<option value="">(Chưa có kịch bản BDD nào)</option>';
    } else {
      scriptSelect.innerHTML = projectScripts
        .map((s) => {
          const selected = currentSelectedScript && currentSelectedScript.relativePath === s.relativePath ? 'selected' : '';
          return `<option value="${escapeHtml(s.relativePath)}" ${selected}>${escapeHtml(s.fileName)} — [${s.platform}] ${escapeHtml(s.scenarioName || s.featureName || '')}</option>`;
        })
        .join('');
    }
  }

  // 2. Render danh sách Page Objects
  let selectedRelPath = '';
  if (targetPageOrRelPath) {
    selectedRelPath = typeof targetPageOrRelPath === 'string' ? targetPageOrRelPath : targetPageOrRelPath.relativePath || '';
  } else if (currentSelectedScript && currentSelectedScript.pages && currentSelectedScript.pages.length > 0) {
    selectedRelPath = currentSelectedScript.pages[0].relativePath;
  }

  if (pageSelect) {
    const desktopPages = repoPages.filter((p) => p.platform === 'desktop');
    const mobilePages = repoPages.filter((p) => p.platform === 'mobile-web');
    const basePages = repoPages.filter((p) => p.platform === 'base');

    const formatPageLabel = (p) => {
      const fName = p.fileName || (p.relativePath ? p.relativePath.split('/').pop() : `${p.className}.js`);
      return `${escapeHtml(p.title || p.className)} (${escapeHtml(fName)})`;
    };

    let html = '';
    if (desktopPages.length > 0) {
      html += `<optgroup label="Desktop Web Pages">`;
      html += desktopPages.map((p) => `<option value="${escapeHtml(p.relativePath)}">${formatPageLabel(p)}</option>`).join('');
      html += `</optgroup>`;
    }
    if (mobilePages.length > 0) {
      html += `<optgroup label="Mobile Web Pages">`;
      html += mobilePages.map((p) => `<option value="${escapeHtml(p.relativePath)}">${formatPageLabel(p)}</option>`).join('');
      html += `</optgroup>`;
    }
    if (basePages.length > 0) {
      html += `<optgroup label="Base Classes">`;
      html += basePages.map((p) => `<option value="${escapeHtml(p.relativePath)}">${formatPageLabel(p)}</option>`).join('');
      html += `</optgroup>`;
    }
    pageSelect.innerHTML = html;

    if (selectedRelPath) {
      pageSelect.value = selectedRelPath;
    }
  }

  // 3. Nạp chi tiết methods và locators của page được chọn
  await loadPomModalPageDetails(preselectedActionName);

  modal.showModal();
};

async function loadPomModalPageDetails(preselectedActionName = null) {
  const pageSelect = document.getElementById('pom-modal-page-select');
  const methodSelect = document.getElementById('pom-modal-method-select');
  const locSelect = document.getElementById('pom-modal-loc-select');

  if (!pageSelect || !pageSelect.value) return;
  const relPath = pageSelect.value;

  try {
    const res = await request(`/api/object-repository/page?file=${encodeURIComponent(relPath)}`);
    pomModalCurrentPageDetails = res;

    // Populate methods
    const methods = res.methods || [];
    if (methodSelect) {
      if (methods.length === 0) {
        methodSelect.innerHTML = '<option value="">(Chưa có method hành động riêng)</option>';
      } else {
        methodSelect.innerHTML = methods
          .map((m) => {
            const paramsStr = (m.params || []).join(', ');
            return `<option value="${escapeHtml(m.name)}" data-params="${escapeHtml(paramsStr)}">${escapeHtml(m.name)}(${escapeHtml(paramsStr)})</option>`;
          })
          .join('');

        if (preselectedActionName && methods.some((m) => m.name === preselectedActionName)) {
          methodSelect.value = preselectedActionName;
        }
      }
    }

    // Populate locators
    const locators = res.locators || [];
    if (locSelect) {
      if (locators.length === 0) {
        locSelect.innerHTML = '<option value="">(Chưa có locator)</option>';
      } else {
        locSelect.innerHTML = locators
          .map((loc) => {
            return `<option value="${escapeHtml(loc.name)}">${escapeHtml(loc.name)} [${escapeHtml(loc.categoryLabel)}] - ${escapeHtml(loc.description || loc.expression)}</option>`;
          })
          .join('');
      }
    }

    updatePomModalParamsHint();
    updatePomCodePreview();
  } catch (err) {
    console.error('Error loading page details for linker:', err);
  }
}

function updatePomModalParamsHint() {
  const methodSelect = document.getElementById('pom-modal-method-select');
  const paramsHint = document.getElementById('pom-modal-params-hint');
  const methodParamsInput = document.getElementById('pom-modal-method-params');
  if (!methodSelect || !paramsHint) return;

  const opt = methodSelect.options[methodSelect.selectedIndex];
  if (!opt) return;
  const params = opt.dataset.params || '';
  if (params) {
    paramsHint.textContent = `💡 Gợi ý tham số nhận: ${params}`;
    if (methodParamsInput && !methodParamsInput.value) {
      if (params.includes('data') || params.includes('profile')) {
        methodParamsInput.value = 'applyData';
      } else if (params.includes('otp')) {
        methodParamsInput.value = "{ otpCode: '123456' }";
      }
    }
  } else {
    paramsHint.textContent = 'Hàm này không yêu cầu tham số truyền vào.';
  }
}

function updatePomCodePreview() {
  const pageSelect = document.getElementById('pom-modal-page-select');
  const methodSelect = document.getElementById('pom-modal-method-select');
  const locSelect = document.getElementById('pom-modal-loc-select');
  const locAction = document.getElementById('pom-modal-loc-action');
  const locVal = document.getElementById('pom-modal-loc-value');
  const stepKeyword = document.getElementById('pom-modal-step-keyword')?.value || 'When';
  const stepTitleInput = document.getElementById('pom-modal-step-title');
  const includeEvidence = document.getElementById('pom-modal-include-evidence')?.checked;
  const previewCode = document.getElementById('pom-modal-code-preview');
  const methodParamsInput = document.getElementById('pom-modal-method-params');

  if (!previewCode || !pageSelect || !pageSelect.value) return;

  const pageRelPath = pageSelect.value;
  const className = pomModalCurrentPageDetails?.className || pageRelPath.split('/').pop().replace(/\.js$/, '');
  const fixtureName = className.charAt(0).toLowerCase() + className.slice(1);

  let actionLine = '';
  let autoTitle = '';
  let evidenceName = '';

  if (pomModalActiveType === 'locator') {
    const locName = locSelect?.value || 'element';
    const action = locAction?.value || 'click';
    const val = (locVal?.value || '').trim();
    evidenceName = `${stepKeyword.toLowerCase()}_click_${locName}`;

    if (action === 'fill') {
      actionLine = `      await ${fixtureName}.${locName}.fill(${JSON.stringify(val || 'giá trị nhập')});`;
      autoTitle = `Tôi nhập giá trị vào ${locName}`;
      evidenceName = `${stepKeyword.toLowerCase()}_fill_${locName}`;
    } else if (action === 'check') {
      actionLine = `      await ${fixtureName}.${locName}.check();`;
      autoTitle = `Tôi tích chọn ${locName}`;
      evidenceName = `${stepKeyword.toLowerCase()}_check_${locName}`;
    } else if (action === 'visible') {
      actionLine = `      await expect(${fixtureName}.${locName}).toBeVisible();`;
      autoTitle = `Hệ thống hiển thị phần tử ${locName}`;
    } else {
      actionLine = `      await ${fixtureName}.${locName}.click();`;
      autoTitle = `Tôi nhấn chuột vào ${locName}`;
    }
  } else {
    const methodName = methodSelect?.value || 'actionMethod';
    const params = (methodParamsInput?.value || '').trim();
    actionLine = `      await ${fixtureName}.${methodName}(${params});`;
    autoTitle = `Tôi thực hiện ${methodName}`;
    evidenceName = `after_${methodName}`;
  }

  if (stepTitleInput && (!stepTitleInput.value || stepTitleInput.dataset.autoGenerated === 'true')) {
    stepTitleInput.value = autoTitle;
    stepTitleInput.dataset.autoGenerated = 'true';
  }

  const title = (stepTitleInput?.value || autoTitle).trim();
  const evidenceCode = includeEvidence && locAction?.value !== 'visible' ? `\n      await ${fixtureName}.capture('${evidenceName}');` : '';

  const finalCode = `await test.step('${stepKeyword} ${title}', async () => {
${actionLine}${evidenceCode}
});`;

  previewCode.innerHTML = highlightCode(finalCode, 'javascript');
}

function generatePomStepCodeAndTitle({
  pageRelPath,
  pageFile,
  className,
  pageClassName,
  actionType,
  actionName,
  actionParams,
  locatorInteraction,
  locatorValue,
  stepType,
  stepTitle,
  includeEvidence,
}) {
  const cName = className || pageClassName || (pageRelPath || pageFile || 'SamplePage.js').split('/').pop().replace(/\.js$/, '');
  const fixtureName = cName.charAt(0).toLowerCase() + cName.slice(1);
  let actionLine = '';
  let autoTitle = '';
  let evidenceName = '';

  if (actionType === 'locator') {
    const locName = actionName || 'element';
    const action = locatorInteraction || 'click';
    const val = (locatorValue || '').trim();
    evidenceName = `${(stepType || 'when').toLowerCase()}_click_${locName}`;

    if (action === 'fill') {
      actionLine = `      await ${fixtureName}.${locName}.fill(${JSON.stringify(val || 'giá trị nhập')});`;
      autoTitle = `Tôi nhập giá trị vào ${locName}`;
      evidenceName = `${(stepType || 'when').toLowerCase()}_fill_${locName}`;
    } else if (action === 'check') {
      actionLine = `      await ${fixtureName}.${locName}.check();`;
      autoTitle = `Tôi tích chọn ${locName}`;
      evidenceName = `${(stepType || 'when').toLowerCase()}_check_${locName}`;
    } else if (action === 'visible') {
      actionLine = `      await expect(${fixtureName}.${locName}).toBeVisible();`;
      autoTitle = `Hệ thống hiển thị phần tử ${locName}`;
    } else {
      actionLine = `      await ${fixtureName}.${locName}.click();`;
      autoTitle = `Tôi nhấn chuột vào ${locName}`;
    }
  } else {
    const methodName = actionName || 'actionMethod';
    const params = (actionParams || '').trim();
    actionLine = `      await ${fixtureName}.${methodName}(${params});`;
    autoTitle = `Tôi thực hiện ${methodName}`;
    evidenceName = `after_${methodName}`;
  }

  const title = (stepTitle || autoTitle).trim();
  const evidenceCode = includeEvidence && locatorInteraction !== 'visible' ? `\n      await ${fixtureName}.capture('${evidenceName}');` : '';
  const codeBody = `${actionLine}${evidenceCode}`;

  return { title, codeBody, autoTitle };
}

async function submitPomActionToBdd() {
  const scriptSelect = document.getElementById('pom-modal-script-select');
  const pageSelect = document.getElementById('pom-modal-page-select');
  const methodSelect = document.getElementById('pom-modal-method-select');
  const locSelect = document.getElementById('pom-modal-loc-select');
  const locAction = document.getElementById('pom-modal-loc-action');
  const locVal = document.getElementById('pom-modal-loc-value');
  const stepKeyword = document.getElementById('pom-modal-step-keyword');
  const stepTitleInput = document.getElementById('pom-modal-step-title');
  const includeEvidence = document.getElementById('pom-modal-include-evidence');
  const methodParamsInput = document.getElementById('pom-modal-method-params');

  if (!scriptSelect || !scriptSelect.value) {
    notify('❌ Vui lòng chọn kịch bản BDD đích!');
    return;
  }
  if (!pageSelect || !pageSelect.value) {
    notify('❌ Vui lòng chọn Page Object!');
    return;
  }

  const pageRelPath = pageSelect.value;
  const className = pomModalCurrentPageDetails?.className || pageRelPath.split('/').pop().replace(/\.js$/, '');

  const payload = {
    scriptPath: scriptSelect.value,
    pageFile: pageRelPath,
    pageClassName: className,
    actionType: pomModalActiveType,
    actionName: pomModalActiveType === 'locator' ? (locSelect?.value || '') : (methodSelect?.value || ''),
    actionParams: methodParamsInput ? methodParamsInput.value.trim() : '',
    locatorInteraction: locAction ? locAction.value : 'click',
    locatorValue: locVal ? locVal.value.trim() : '',
    stepType: stepKeyword ? stepKeyword.value : 'When',
    stepTitle: stepTitleInput ? stepTitleInput.value.trim() : '',
    includeEvidence: includeEvidence ? includeEvidence.checked : true,
  };

  if (!payload.actionName) {
    notify('❌ Vui lòng chọn một hành động hoặc phần tử hợp lệ!');
    return;
  }

  const { title, codeBody } = generatePomStepCodeAndTitle(payload);

  // 1. Nếu người dùng đang ở màn hình Chỉnh sửa (Edit Mode) của kịch bản này:
  const isCurrentlyEditingThisScript = scriptBuilderMode === 'edit' && currentSelectedScript && currentSelectedScript.relativePath === payload.scriptPath;

  if (isCurrentlyEditingThisScript) {
    // Thêm bước mới trực tiếp vào bộ nhớ editableSteps (chưa lưu vào đĩa)
    const newStep = {
      id: `s_${Date.now()}`,
      stepType: payload.stepType || 'When',
      title: title,
      code: codeBody,
    };
    editableSteps.push(newStep);

    // Tự động chọn Page Object này trong Khối 04 nếu chưa được chọn
    if (pageRelPath && typeof editSelectedPoms !== 'undefined') {
      editSelectedPoms.add(pageRelPath);
      renderEditPomList();
    }

    renderEditableSteps();
    updateEditAccordionSummaries();
    updateEditScriptPreview();

    document.getElementById('modal-insert-pom-action')?.close();

    // Mở khối 02 nếu đang bị đóng và cuộn nhẹ tới bước mới
    const secSteps = document.getElementById('edit-sec-steps');
    if (secSteps && secSteps.classList.contains('is-collapsed')) {
      secSteps.classList.remove('is-collapsed');
      secSteps.classList.add('is-expanded');
    }

    setTimeout(() => {
      const stepCards = document.querySelectorAll('#edit-steps-list .builder-step-card');
      const lastCard = stepCards[stepCards.length - 1];
      lastCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    notify(`✨ Đã thêm bước "${title}" vào bản nháp kịch bản! Nhấn "Lưu kịch bản" để lưu thay đổi vào file.`);
    return;
  }

  // 2. Nếu đang ở chế độ Xem (Inspect) hoặc mở từ Page Manager:
  // Tự động chuyển sang Chế độ Chỉnh sửa kịch bản (Edit Mode) để người dùng xem trước và duyệt trước khi lưu!
  const targetScript = (projectScripts || []).find((s) => s.relativePath === payload.scriptPath);
  if (targetScript) {
    const currentView = document.querySelector('.view-tab.active')?.dataset.view;
    if (currentView !== 'builder-view') {
      const bddTab = document.querySelector('.view-tab[data-view="builder-view"]');
      if (bddTab) bddTab.click();
    }

    currentSelectedScript = targetScript;
    selectProjectScript(targetScript);
    switchToEditScriptMode('steps');

    const newStep = {
      id: `s_${Date.now()}`,
      stepType: payload.stepType || 'When',
      title: title,
      code: codeBody,
    };
    editableSteps.push(newStep);

    if (pageRelPath && typeof editSelectedPoms !== 'undefined') {
      editSelectedPoms.add(pageRelPath);
      renderEditPomList();
    }

    renderEditableSteps();
    updateEditAccordionSummaries();
    updateEditScriptPreview();

    document.getElementById('modal-insert-pom-action')?.close();

    setTimeout(() => {
      const stepCards = document.querySelectorAll('#edit-steps-list .builder-step-card');
      const lastCard = stepCards[stepCards.length - 1];
      lastCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);

    notify(`✨ Đã chuyển sang màn hình chỉnh sửa và thêm bước "${title}". Nhấn "Lưu kịch bản" để lưu thay đổi!`);
    return;
  }

  // 3. Fallback an toàn nếu không tìm thấy script trong bộ nhớ
  document.getElementById('modal-insert-pom-action')?.close();
  notify('❌ Không tìm thấy thông tin kịch bản test đích.');
}

initPomModalControls();

let scriptBuilderMode = 'inspect'; // 'inspect' | 'edit' | 'create'
let editableSteps = [];
let editSelectedPoms = new Set();
let editSelectedDataset = '';

function updateSpecCodeFromVisualEdit(originalCode, {
  scenarioName,
  featureName,
  tags,
  steps,
  datasetFile,
  selectedPoms,
  precondition,
}) {
  let code = originalCode || '';

  // 1. Update Data require statement
  if (datasetFile !== undefined) {
    const existingDataReqRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*require\(\s*['"][^'"]*\/data\/[^'"]+\.json['"]\s*\);?\n?/i;
    if (datasetFile) {
      const varName = datasetFile.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_]/g, '');
      const dataReqLine = `const ${varName} = require('../../../data/${datasetFile}');\n`;
      if (existingDataReqRegex.test(code)) {
        code = code.replace(existingDataReqRegex, dataReqLine);
      } else {
        const firstRequire = code.indexOf('require(');
        if (firstRequire !== -1) {
          const firstLineEnd = code.indexOf('\n', firstRequire);
          code = code.slice(0, firstLineEnd + 1) + dataReqLine + code.slice(firstLineEnd + 1);
        } else {
          code = dataReqLine + code;
        }
      }
    } else {
      code = code.replace(existingDataReqRegex, '');
    }
  }

  // 2. Update Feature and Tags in test.describe
  if (featureName || tags) {
    code = code.replace(/test\.describe\(\s*(['"`])Feature:\s*([^'"`]+)\1/i, (match, quote) => {
      return `test.describe(${quote}Feature: ${featureName || 'Kiểm thử'} ${tags || '@e2e'}${quote}`;
    });
  }

  // 3. Update Scenario name in test(...)
  if (scenarioName) {
    code = code.replace(/test\(\s*(['"`])([^'"`]+)\1\s*,\s*async/i, (match, quote) => {
      return `test(${quote}${scenarioName}${quote}, async`;
    });
  }

  // 4. Update Fixtures & Page Objects in test({ ... }) arguments
  if (selectedPoms && Array.isArray(selectedPoms)) {
    const pomFixtures = selectedPoms.map((p) => {
      const fn = p.split('/').pop().replace(/\.js$/, '');
      return fn.charAt(0).toLowerCase() + fn.slice(1);
    });
    if (precondition?.auth === 'authenticated' && !pomFixtures.includes('authenticatedUser')) {
      pomFixtures.unshift('authenticatedUser');
    }
    const testArgsMatch = code.match(/test\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*,\s*async\s*\(\s*\{([^}]*)\}\s*\)/);
    if (testArgsMatch) {
      const currentArgs = testArgsMatch[1];
      const standardTokens = currentArgs.split(',').map((t) => t.trim()).filter(Boolean);
      const baseTokens = standardTokens.filter((t) => ['page', 'pages', 'request', 'cleanupQueue'].includes(t));
      if (baseTokens.length === 0) baseTokens.push('page');
      const combined = Array.from(new Set([...baseTokens, ...pomFixtures]));
      const newArgsStr = `\n    ${combined.join(',\n    ')},\n  `;
      code = code.replace(testArgsMatch[0], testArgsMatch[0].replace(currentArgs, newArgsStr));
    }
  }

  // 5. Update Precondition annotation if present
  if (precondition?.desc) {
    const preAnnoRegex = /testInfo\.annotations\.push\(\{\s*type:\s*['"]Precondition['"]\s*,\s*description:\s*['"][^'"]*['"]\s*\}\);/;
    if (preAnnoRegex.test(code)) {
      code = code.replace(preAnnoRegex, `testInfo.annotations.push({ type: 'Precondition', description: ${JSON.stringify(precondition.desc)} });`);
    }
  }

  // 6. Synchronize steps if present
  if (steps && steps.length > 0) {
    const stepBlocksCode = steps
      .map((st) => {
        const type = st.stepType || 'When';
        const title = st.title || 'Bước kiểm thử';
        let body = st.code || `      // Thao tác cho bước: ${title}`;
        if (!body.includes('\n') && !body.startsWith(' ')) {
          body = `      ${body}`;
        }
        return `    await test.step('${type} ${title}', async () => {\n${body}\n    });`;
      })
      .join('\n\n');

    const firstStepIdx = code.indexOf('await test.step(');
    if (firstStepIdx !== -1) {
      const lastStepIdx = code.lastIndexOf('await test.step(');
      const endOfLastStep = code.indexOf('\n    });', lastStepIdx);
      const closeOffset = endOfLastStep !== -1 ? endOfLastStep + '\n    });'.length : -1;

      if (closeOffset !== -1) {
        code = code.slice(0, firstStepIdx) + stepBlocksCode + code.slice(closeOffset);
      }
    }
  }

  return code;
}

function updateEditScriptPreview() {
  if (scriptBuilderMode !== 'edit' || !currentSelectedScript) return;

  const scenarioName = document.getElementById('edit-script-title')?.value.trim();
  const featureName = document.getElementById('edit-script-feature')?.value.trim();
  const tags = document.getElementById('edit-script-tags')?.value.trim();
  const datasetSelect = document.getElementById('edit-script-dataset');
  const datasetFile = datasetSelect ? datasetSelect.value.trim() : editSelectedDataset;
  const authType = document.getElementById('edit-script-auth-type')?.value || 'guest';
  const preDesc = document.getElementById('edit-script-precondition-desc')?.value.trim() || '';

  // Update data info box in UI
  const dataVarEl = document.getElementById('edit-script-data-var');
  const dataHintEl = document.getElementById('edit-script-data-hint');
  const dataInfoBox = document.getElementById('edit-data-info-box');
  if (datasetFile) {
    const varName = datasetFile.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (dataVarEl) dataVarEl.textContent = varName;
    if (dataHintEl) dataHintEl.textContent = `Tự động nạp: const ${varName} = require('../../../data/${datasetFile}')`;
    if (dataInfoBox) dataInfoBox.style.display = 'flex';
  } else {
    if (dataInfoBox) dataInfoBox.style.display = 'none';
  }

  const updatedCode = updateSpecCodeFromVisualEdit(currentSelectedScript.specCode, {
    scenarioName,
    featureName,
    tags,
    steps: editableSteps,
    datasetFile,
    selectedPoms: Array.from(editSelectedPoms),
    precondition: { auth: authType, desc: preDesc },
  });

  if (window.specCodeEditor) {
    window.specCodeEditor.setValue(updatedCode, { markClean: false, readOnly: !scriptDirectEditMode });
  } else {
    const codeEl = document.getElementById('script-spec-code');
    if (codeEl) codeEl.innerHTML = highlightCode(updatedCode, false);

    const editorEl = document.getElementById('script-spec-editor');
    if (editorEl) editorEl.value = updatedCode;
  }

  const isDirty = updatedCode !== (currentSelectedScript.specCode || '');
  const statusBadge = document.getElementById('script-spec-status-badge');
  const editDirtyBadge = document.getElementById('script-edit-dirty-badge');
  const revertBtn = document.getElementById('script-spec-revert-btn');

  if (isDirty) {
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Đã thay đổi (chưa lưu)';
      statusBadge.classList.add('modified');
    }
    if (editDirtyBadge) {
      editDirtyBadge.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Đã thay đổi (chưa lưu)';
      editDirtyBadge.classList.add('modified');
      editDirtyBadge.style.display = 'inline-flex';
    }
    if (revertBtn) revertBtn.style.display = 'inline-flex';
  } else {
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="ph-bold ph-check"></i> Khớp bản gốc disk';
      statusBadge.classList.remove('modified');
    }
    if (editDirtyBadge) {
      editDirtyBadge.style.display = 'none';
    }
    if (revertBtn) revertBtn.style.display = 'none';
  }
}

function renderEditableSteps() {
  const container = document.getElementById('edit-steps-list');
  const countEl = document.getElementById('edit-step-count');
  if (!container) return;

  if (countEl) countEl.textContent = editableSteps.length;

  if (editableSteps.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); font-size: 13px;">
        Chưa có bước BDD nào. Bấm các nút <strong>+ Given</strong>, <strong>+ When</strong>, <strong>+ Then</strong>, <strong>+ And</strong> ở trên để thêm bước mới.
      </div>`;
    return;
  }

  container.innerHTML = editableSteps
    .map((step, idx) => {
      const typeBadgeClass = `badge-${(step.stepType || 'When').toLowerCase()}`;
      return `
      <div class="builder-step-card" data-step-id="${step.id}" data-index="${idx}">
        <div class="builder-step-top">
          <span class="step-num-badge">#${idx + 1}</span>
          <select class="builder-step-type-select step-type-badge ${typeBadgeClass}" style="outline: none; cursor: pointer; width: 90px !important; min-width: 90px !important; max-width: 90px !important; flex: 0 0 90px !important; text-align: center;">
            <option value="Given" ${step.stepType === 'Given' ? 'selected' : ''}>Given</option>
            <option value="When" ${step.stepType === 'When' ? 'selected' : ''}>When</option>
            <option value="Then" ${step.stepType === 'Then' ? 'selected' : ''}>Then</option>
            <option value="And" ${step.stepType === 'And' ? 'selected' : ''}>And</option>
          </select>
          <input type="text" class="builder-step-title-input" value="${escapeHtml(step.title || '')}" placeholder="Mô tả bước kiểm thử..." style="flex: 1 1 auto !important; min-width: 150px !important; width: auto !important;" />
          <div class="builder-step-controls">
            <button type="button" class="btn-step-ctrl move-up-btn" title="Di chuyển lên" ${idx === 0 ? 'disabled' : ''}><i class="ph-bold ph-arrow-up"></i></button>
            <button type="button" class="btn-step-ctrl move-down-btn" title="Di chuyển xuống" ${idx === editableSteps.length - 1 ? 'disabled' : ''}><i class="ph-bold ph-arrow-down"></i></button>
            <button type="button" class="btn-step-ctrl clone-step-btn" title="Nhân bản bước này"><i class="ph-bold ph-copy"></i></button>
            <button type="button" class="btn-step-ctrl delete-btn remove-step-btn" title="Xóa bước này"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>
      </div>`;
    })
    .join('');

  container.querySelectorAll('.builder-step-card').forEach((card) => {
    const idx = parseInt(card.dataset.index, 10);
    const step = editableSteps[idx];
    if (!step) return;

    card.querySelector('.builder-step-type-select')?.addEventListener('change', (e) => {
      step.stepType = e.target.value;
      renderEditableSteps();
      updateEditScriptPreview();
    });

    card.querySelector('.builder-step-title-input')?.addEventListener('input', (e) => {
      step.title = e.target.value;
      updateEditScriptPreview();
    });

    card.querySelector('.move-up-btn')?.addEventListener('click', () => {
      if (idx > 0) {
        const temp = editableSteps[idx];
        editableSteps[idx] = editableSteps[idx - 1];
        editableSteps[idx - 1] = temp;
        renderEditableSteps();
        updateEditScriptPreview();
      }
    });

    card.querySelector('.move-down-btn')?.addEventListener('click', () => {
      if (idx < editableSteps.length - 1) {
        const temp = editableSteps[idx];
        editableSteps[idx] = editableSteps[idx + 1];
        editableSteps[idx + 1] = temp;
        renderEditableSteps();
        updateEditScriptPreview();
      }
    });

    card.querySelector('.clone-step-btn')?.addEventListener('click', () => {
      const clone = { ...step, id: `s_${Date.now()}`, title: `${step.title} (bản sao)` };
      editableSteps.splice(idx + 1, 0, clone);
      renderEditableSteps();
      updateEditScriptPreview();
      notify(`Đã nhân bản bước #${idx + 1}`);
    });

    card.querySelector('.remove-step-btn')?.addEventListener('click', () => {
      editableSteps.splice(idx, 1);
      renderEditableSteps();
      updateEditScriptPreview();
    });
  });
}

function renderEditPomList() {
  const container = document.getElementById('edit-pom-list');
  if (!container) return;

  if (!repoPages || repoPages.length === 0) {
    container.innerHTML = '<div class="data-loading-spinner" style="padding: 12px;"><i class="ph ph-spinner ph-spin"></i> Đang tải danh sách Page Objects...</div>';
    return;
  }

  const countBadge = document.getElementById('edit-pom-count');
  if (countBadge) countBadge.textContent = editSelectedPoms.size;

  container.innerHTML = repoPages.map((page) => {
    const isChecked = editSelectedPoms.has(page.relativePath);
    const title = page.title || page.className;
    const path = page.relativePath || `${page.className}.js`;
    return `
      <div class="dependency-card-item ${isChecked ? 'selected' : ''}" data-path="${escapeHtml(page.relativePath)}" style="padding: 8px 10px; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <input type="checkbox" class="edit-pom-checkbox" value="${escapeHtml(page.relativePath)}" ${isChecked ? 'checked' : ''} style="cursor: pointer;" />
          <i class="ph-bold ph-browsers dependency-card-icon" style="font-size: 16px;"></i>
          <div style="min-width: 0; flex: 1;">
            <strong class="dependency-card-title" title="${escapeHtml(title)}" style="font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(title)}</strong>
            <span class="dependency-card-path" title="${escapeHtml(path)}" style="font-size: 10.5px; color: var(--muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(path)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.dependency-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    const cb = card.querySelector('input[type="checkbox"]');
    cb?.addEventListener('change', () => {
      const pPath = cb.value;
      if (cb.checked) {
        editSelectedPoms.add(pPath);
        card.classList.add('selected');
      } else {
        editSelectedPoms.delete(pPath);
        card.classList.remove('selected');
      }
      if (countBadge) countBadge.textContent = editSelectedPoms.size;
      updateEditScriptPreview();
    });
  });
}

async function loadEditDatasets(forceReload = true) {
  const select = document.getElementById('edit-script-dataset');
  if (!select) return;

  try {
    const res = await fetch('/api/data/datasets');
    if (res.ok) {
      const data = await res.json();
      wizardAvailableDatasets = data.datasets || [];
      datasetsCache = wizardAvailableDatasets;
    }
  } catch (err) {
    console.error('Failed to load edit datasets:', err);
  }

  select.innerHTML = '<option value="">-- Không sử dụng file data ngoài --</option>' +
    (wizardAvailableDatasets || []).map((d) => {
      const count = d.recordCount ?? d.itemCount ?? 0;
      return `<option value="${escapeHtml(d.fileName)}">${escapeHtml(d.fileName)} (${count} mục)</option>`;
    }).join('');

  if (editSelectedDataset) {
    select.value = editSelectedDataset;
  }
  updateEditAccordionSummaries();
}

function updateEditAccordionSummaries() {
  const titleVal = document.getElementById('edit-script-title')?.value.trim();
  const featVal = document.getElementById('edit-script-feature')?.value.trim();
  const infoSummary = document.getElementById('summary-info-text');
  if (infoSummary) {
    infoSummary.textContent = featVal ? `Feature: ${featVal}` : (titleVal || 'Chưa đặt tên');
  }

  const stepsSummary = document.getElementById('summary-steps-count');
  if (stepsSummary) {
    stepsSummary.textContent = Array.isArray(editableSteps) ? editableSteps.length : 0;
  }

  const preSummary = document.getElementById('summary-precondition-text');
  const authSelect = document.getElementById('edit-script-auth-type');
  if (preSummary && authSelect) {
    preSummary.textContent = authSelect.value === 'authenticated' ? 'Đã đăng nhập (authSetup)' : 'Khách vãng lai (Guest)';
  }

  const pomsSummary = document.getElementById('summary-poms-count');
  if (pomsSummary) {
    pomsSummary.textContent = editSelectedPoms ? editSelectedPoms.size : 0;
  }

  const dataSummary = document.getElementById('summary-data-text');
  const datasetSelect = document.getElementById('edit-script-dataset');
  const currentDataset = datasetSelect ? datasetSelect.value : editSelectedDataset;
  if (dataSummary) {
    dataSummary.textContent = currentDataset ? currentDataset : 'Không dùng data';
  }
}

function initScriptEditAccordions() {
  const container = document.getElementById('script-edit-view');
  if (!container || container._accordionsInit) return;
  container._accordionsInit = true;

  container.querySelectorAll('.script-accordion-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      // Don't toggle if user clicked on interactive control
      if (e.target.closest('button, input, select, a, .script-steps-quick-actions')) return;
      const targetId = header.dataset.target;
      const item = targetId ? document.getElementById(targetId) : header.closest('.script-accordion-item');
      if (!item) return;

      const isExpanded = item.classList.contains('is-expanded');
      if (isExpanded) {
        item.classList.remove('is-expanded');
        item.classList.add('is-collapsed');
      } else {
        item.classList.remove('is-collapsed');
        item.classList.add('is-expanded');
        if (item.id === 'edit-sec-data') {
          loadEditDatasets(true);
        }
      }
    });

    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('button, input, select, a')) return;
        e.preventDefault();
        header.click();
      }
    });
  });

  document.getElementById('btn-edit-expand-all')?.addEventListener('click', () => {
    container.querySelectorAll('.script-accordion-item').forEach((item) => {
      item.classList.remove('is-collapsed');
      item.classList.add('is-expanded');
    });
  });

  document.getElementById('btn-edit-collapse-all')?.addEventListener('click', () => {
    container.querySelectorAll('.script-accordion-item').forEach((item) => {
      item.classList.remove('is-expanded');
      item.classList.add('is-collapsed');
    });
  });
}

function switchToEditScriptMode(targetSection) {
  if (!currentSelectedScript) {
    notify('Vui lòng chọn một kịch bản test trước khi chỉnh sửa.');
    return;
  }

  scriptBuilderMode = 'edit';
  scriptDirectEditMode = false;

  // Tabs in toolbar
  document.getElementById('btn-tab-script-inspect')?.classList.remove('active');
  document.getElementById('btn-tab-script-edit')?.classList.add('active');
  document.getElementById('btn-tab-script-create')?.classList.remove('active');

  // Hint
  const hint = document.getElementById('script-toolbar-hint');
  if (hint) {
    hint.innerHTML = `<i class="ph ph-pencil-simple" style="color: var(--accent);"></i> Đang chỉnh sửa: <strong>${escapeHtml(currentSelectedScript.fileName)}</strong> · Mã nguồn ở cột bên phải được cập nhật thời gian thực`;
  }

  // Views
  const inspectView = document.getElementById('script-inspect-view');
  const editView = document.getElementById('script-edit-view');
  const createView = document.getElementById('script-create-view');
  if (inspectView) inspectView.style.display = 'none';
  if (createView) createView.style.display = 'none';
  if (editView) editView.style.display = 'flex';

  const subnavActions = document.getElementById('script-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'flex';

  // Fill form fields
  const titleInput = document.getElementById('edit-script-title');
  const featInput = document.getElementById('edit-script-feature');
  const tagsInput = document.getElementById('edit-script-tags');
  const panelTitle = document.getElementById('script-edit-panel-title');

  if (titleInput) titleInput.value = currentSelectedScript.scenarioName || '';
  if (featInput) featInput.value = currentSelectedScript.featureName || '';
  if (tagsInput) tagsInput.value = currentSelectedScript.tags || '@e2e @custom';
  if (panelTitle) panelTitle.innerHTML = `<i class="ph-bold ph-pencil-simple-line" style="color: var(--accent);"></i> Chỉnh sửa: ${escapeHtml(currentSelectedScript.fileName)}`;

  // 1. Dataset setup
  editSelectedDataset = currentSelectedScript.primaryDataFile || (currentSelectedScript.dataFiles && currentSelectedScript.dataFiles[0]?.name) || '';
  loadEditDatasets();

  // 2. Page Objects setup
  editSelectedPoms = new Set();
  if (currentSelectedScript.pages && Array.isArray(currentSelectedScript.pages)) {
    currentSelectedScript.pages.forEach((p) => {
      if (p.relativePath) editSelectedPoms.add(p.relativePath);
    });
  }
  if (!repoPages || repoPages.length === 0) {
    request('/api/object-repository/pages').then((res) => {
      repoPages = res.pages || [];
      renderEditPomList();
    }).catch(console.error);
  } else {
    renderEditPomList();
  }

  // 3. Precondition setup
  const authSelect = document.getElementById('edit-script-auth-type');
  const preDescInput = document.getElementById('edit-script-precondition-desc');
  const specCode = currentSelectedScript.specCode || '';
  const hasAuth = specCode.includes('authenticatedUser') || specCode.includes('authSetup');
  if (authSelect) authSelect.value = hasAuth ? 'authenticated' : 'guest';
  const annoMatch = specCode.match(/testInfo\.annotations\.push\(\{\s*type:\s*['"]Precondition['"]\s*,\s*description:\s*['"]([^'"]+)['"]/);
  if (preDescInput) preDescInput.value = annoMatch ? annoMatch[1] : '';

  // 4. Steps setup
  editableSteps = currentSelectedScript.steps ? JSON.parse(JSON.stringify(currentSelectedScript.steps)) : [];
  renderEditableSteps();

  // Setup accordion collapsible behavior
  initScriptEditAccordions();

  const secInfo = document.getElementById('edit-sec-info');
  const secSteps = document.getElementById('edit-sec-steps');
  const secPre = document.getElementById('edit-sec-precondition');
  const secPoms = document.getElementById('edit-sec-poms');
  const secData = document.getElementById('edit-sec-data');

  if (targetSection === 'info') {
    secInfo?.classList.add('is-expanded');
    secInfo?.classList.remove('is-collapsed');
    [secPre, secPoms, secData].forEach(el => { el?.classList.add('is-collapsed'); el?.classList.remove('is-expanded'); });
    setTimeout(() => {
      titleInput?.focus();
    }, 60);
  } else if (targetSection === 'steps') {
    secSteps?.classList.add('is-expanded');
    secSteps?.classList.remove('is-collapsed');
    [secPre, secPoms, secData].forEach(el => { el?.classList.add('is-collapsed'); el?.classList.remove('is-expanded'); });
    setTimeout(() => {
      secSteps?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else {
    // Default: Section 01 & 02 open, Section 03, 04, 05 collapsed
    [secInfo, secSteps].forEach(el => { el?.classList.add('is-expanded'); el?.classList.remove('is-collapsed'); });
    [secPre, secPoms, secData].forEach(el => { el?.classList.add('is-collapsed'); el?.classList.remove('is-expanded'); });
  }

  updateEditAccordionSummaries();

  // Column 3 Code Panel
  const eyebrow = document.getElementById('script-code-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MÃ NGUỒN BDD SPEC (CHỈNH SỬA)';

  const specTitle = document.getElementById('script-code-title');
  if (specTitle) specTitle.textContent = currentSelectedScript.fileName;

  const statusBadge = document.getElementById('script-spec-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Sẵn sàng chỉnh sửa';
    statusBadge.classList.remove('modified');
  }

  const editDirtyBadge = document.getElementById('script-edit-dirty-badge');
  if (editDirtyBadge) editDirtyBadge.style.display = 'none';

  const helpText = document.getElementById('script-code-help-text');
  if (helpText) {
    helpText.textContent = 'Chỉnh sửa thông tin bên trái hoặc gõ trực tiếp vào mã nguồn. Bấm "Lưu kịch bản" hoặc Ctrl+S để lưu lại.';
  }

  const stage = document.getElementById('script-code-stage');
  const editor = document.getElementById('script-spec-editor');
  if (stage) stage.classList.remove('editing');
  if (editor) editor.setAttribute('readonly', 'true');

  const editBtnText = document.getElementById('script-edit-btn-text');
  if (editBtnText) editBtnText.textContent = 'Chỉnh sửa';

  const insertPomBtn = document.getElementById('script-spec-insert-pom-btn');
  const toggleEditBtn = document.getElementById('script-btn-toggle-edit');
  const saveBtn = document.getElementById('script-spec-save-btn');
  if (insertPomBtn) insertPomBtn.style.display = 'inline-flex';
  if (toggleEditBtn) toggleEditBtn.style.display = 'inline-flex';
  if (saveBtn) saveBtn.style.display = 'none';

  if (window.specCodeEditor) {
    window.specCodeEditor.setValue(currentSelectedScript.specCode || '', { markClean: true, readOnly: true });
  } else {
    const codeEl = document.getElementById('script-spec-code');
    if (codeEl) codeEl.innerHTML = highlightCode(currentSelectedScript.specCode || '', false);

    const editorEl = document.getElementById('script-spec-editor');
    if (editorEl) editorEl.value = currentSelectedScript.specCode || '';
  }

  // Attach input listeners once
  if (titleInput && !titleInput._editBound) {
    titleInput._editBound = true;
    titleInput.addEventListener('input', () => {
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
    featInput?.addEventListener('input', () => {
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
    tagsInput?.addEventListener('input', () => {
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
  }

  const datasetSelect = document.getElementById('edit-script-dataset');
  if (datasetSelect && !datasetSelect._editBound) {
    datasetSelect._editBound = true;
    datasetSelect.addEventListener('change', () => {
      editSelectedDataset = datasetSelect.value;
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
  }

  if (authSelect && !authSelect._editBound) {
    authSelect._editBound = true;
    authSelect.addEventListener('change', () => {
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
  }
  if (preDescInput && !preDescInput._editBound) {
    preDescInput._editBound = true;
    preDescInput.addEventListener('input', () => {
      updateEditScriptPreview();
      updateEditAccordionSummaries();
    });
  }

  document.getElementById('btn-edit-pom-select-all')?.addEventListener('click', () => {
    (repoPages || []).forEach((p) => editSelectedPoms.add(p.relativePath));
    renderEditPomList();
    updateEditScriptPreview();
    updateEditAccordionSummaries();
  });
  document.getElementById('btn-edit-pom-deselect-all')?.addEventListener('click', () => {
    editSelectedPoms.clear();
    renderEditPomList();
    updateEditScriptPreview();
    updateEditAccordionSummaries();
  });

  document.getElementById('btn-edit-add-step-pom')?.addEventListener('click', () => {
    openInsertPomActionModal();
  });

  document.getElementById('btn-edit-open-create-data')?.addEventListener('click', () => {
    const dataTab = document.querySelector('.view-tab[data-view="data-view"]');
    if (dataTab) {
      dataTab.click();
      setTimeout(() => {
        if (typeof switchToDataCreateMode === 'function') {
          switchToDataCreateMode();
        }
        notify('📁 Đã chuyển sang màn hình Quản lý Dữ liệu test để tạo tệp Dataset mới!');
      }, 150);
    } else {
      notify('❌ Không tìm thấy màn hình Quản lý Dữ liệu test.');
    }
  });
}

async function saveEditedScript() {
  if (!currentSelectedScript) return;
  const saveBtns = [
    document.getElementById('btn-save-edit-script'),
    document.getElementById('btn-save-edit-script-2'),
    document.getElementById('script-spec-save-btn'),
  ];
  saveBtns.forEach((b) => {
    if (b) {
      b.disabled = true;
      b._orig = b.innerHTML;
      b.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang lưu...';
    }
  });

  try {
    const editor = document.getElementById('script-spec-editor');
    const content = editor?.value || currentSelectedScript.specCode;

    await request('/api/code', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: currentSelectedScript.relativePath,
        content,
      }),
    });

    notify(`✅ Đã lưu kịch bản ${currentSelectedScript.fileName} thành công!`);

    await loadProjectScripts();
    const updated = projectScripts.find((s) => s.id === currentSelectedScript.id || s.relativePath === currentSelectedScript.relativePath);
    if (updated) {
      currentSelectedScript = updated;
    }
    switchToInspectScriptMode();
  } catch (err) {
    notify(`❌ Lỗi khi lưu kịch bản: ${err.message}`);
  } finally {
    saveBtns.forEach((b) => {
      if (b) {
        b.disabled = false;
        if (b._orig) b.innerHTML = b._orig;
      }
    });
  }
}

// --- PLAN-05: STEP-BY-STEP SCRIPT STUDIO WIZARD ENGINE ---
let wizardCurrentStep = 1;
let wizardSelectedPoms = new Set(['pages/desktop/HomePage.js']);
let wizardSelectedDataset = '';
let wizardPomLoadError = '';
let wizardBddSteps = [];
let wizardAvailableDatasets = [];

function buildWizardLivePreview(state, validationMessage = '') {
  const fixturePath = state.platform === 'mobile-web'
    ? '../../../core/fixtures/mobileWebTest'
    : '../../../core/fixtures/baseTest';
  const tags = Array.isArray(state.tags) ? state.tags.join(' ') : String(state.tags || '@e2e');
  const fixtures = [
    ...(state.precondition?.auth === 'authenticated' ? ['authenticatedUser'] : []),
    ...state.pageObjects.map((page) => {
      const fileName = page.split('/').pop().replace(/\.js$/, '');
      return fileName.charAt(0).toLowerCase() + fileName.slice(1);
    }),
  ];
  if (fixtures.length === 0) fixtures.push('page');
  const uniqueFixtures = Array.from(new Set(fixtures));
  const dataImports = state.dataSources.map((source) => `const ${source.variable} = require('../../../${source.file}');`);
  const precondition = state.precondition || {};
  const lines = [
    `const { test, expect } = require(${JSON.stringify(fixturePath)});`,
    ...dataImports,
    '',
    `test.describe(${JSON.stringify(`Feature: ${state.featureName} ${tags}`)}, () => {`,
    `  test(${JSON.stringify(state.scenarioName)}, async ({`,
    ...uniqueFixtures.map((fixture) => `    ${fixture},`),
    '  }, testInfo) => {',
    '    test.slow();',
    '    test.setTimeout(600000);',
    '',
    '    testInfo.annotations.push({',
    '      type: "Precondition",',
    `      description: ${JSON.stringify(precondition.description || 'Tiền điều kiện kịch bản kiểm thử')},`,
    '    });',
    '',
    `    await test.step(${JSON.stringify(`Given ${precondition.description || 'Tiền điều kiện ban đầu'}`)}, async () => {`,
    precondition.captureInitial ? "      await page.screenshot({ path: 'evidence/precondition_initial_state.png' });" : '      // Precondition đã sẵn sàng.',
    '    });',
    '',
  ];

  state.steps.forEach((step, index) => {
    const title = `${step.stepType || 'When'} ${step.title || `Bước ${index + 1}`}`;
    lines.push(`    await test.step(${JSON.stringify(title)}, async () => {`);
    if (step.actionId) {
      lines.push(`      // Action runtime: ${step.actionId}`);
      lines.push('      // Đang chờ backend compile action này theo registry.');
    } else {
      lines.push('      // Chưa chọn action runtime cho bước này.');
    }
    lines.push('    });', '');
  });

  lines.push('  });', '});');
  if (validationMessage) {
    lines.unshift(`// BẢN NHÁP LIVE - Chưa thể lưu: ${validationMessage}`);
    lines.unshift('// Preview này phản ánh state hiện tại; hoàn thiện các trường còn thiếu để sinh mã chạy thật.');
  }
  return lines.join('\n');
}

let isResettingWizard = false;
let currentCompileRequestId = 0;

function updateCreateScriptPreview() {
  if (scriptBuilderMode !== 'create') return;
  if (isResettingWizard) return;

  const rawTitle = document.getElementById('create-script-title')?.value.trim() || '';
  const rawFeature = document.getElementById('create-script-feature')?.value.trim() || '';
  const rawFileName = document.getElementById('create-script-filename')?.value.trim() || '';
  const isBlankDraft = !rawTitle && !rawFeature && !rawFileName && (!wizardBddSteps || wizardBddSteps.length === 0);

  const specTitle = document.getElementById('script-code-title');
  let fileName = rawFileName || (rawTitle ? `${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_flow-bdd.spec.js` : '');
  if (fileName && !fileName.endsWith('.spec.js')) fileName += '.spec.js';
  if (specTitle) specTitle.textContent = fileName || '(Bản nháp mới)';

  const eyebrow = document.getElementById('script-code-eyebrow');
  if (eyebrow) eyebrow.textContent = 'LIVE PREVIEW (.spec.js)';

  const applyPreviewControls = () => {
    const statusBadge = document.getElementById('script-spec-status-badge');
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
      statusBadge.classList.remove('modified');
      statusBadge.style.display = 'inline-flex';
    }
    const toggleEditBtn = document.getElementById('script-btn-toggle-edit');
    if (toggleEditBtn) toggleEditBtn.style.display = 'none';
    const saveBtn = document.getElementById('script-spec-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    const revertBtn = document.getElementById('script-spec-revert-btn');
    if (revertBtn) revertBtn.style.display = 'none';
    const insertPomBtn = document.getElementById('script-spec-insert-pom-btn');
    if (insertPomBtn) insertPomBtn.style.display = 'none';
    const copyBtn = document.getElementById('script-spec-copy-btn');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
  };

  if (isBlankDraft) {
    currentCompileRequestId++;
    if (window.specCodeEditor) {
      window.specCodeEditor.setValue('', { markClean: true, readOnly: true });
    }
    const codeEl = document.getElementById('script-spec-code');
    if (codeEl) codeEl.innerHTML = '';
    const editorEl = document.getElementById('script-spec-editor');
    if (editorEl) {
      editorEl.value = '';
      editorEl.setAttribute('readonly', 'true');
    }
    applyPreviewControls();
    return;
  }

  const reqId = ++currentCompileRequestId;
  const payload = buildWizardState({ previewMode: true });
  request('/api/builder/compile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then((result) => {
      if (reqId !== currentCompileRequestId || isResettingWizard) return;
      const curTitle = document.getElementById('create-script-title')?.value.trim() || '';
      const curFeature = document.getElementById('create-script-feature')?.value.trim() || '';
      const curFile = document.getElementById('create-script-filename')?.value.trim() || '';
      if (!curTitle && !curFeature && !curFile && (!wizardBddSteps || wizardBddSteps.length === 0)) {
        if (window.specCodeEditor) window.specCodeEditor.setValue('', { markClean: true, readOnly: true });
        return;
      }

      if (window.specCodeEditor) {
        window.specCodeEditor.setValue(result.specCode || '', { markClean: true, readOnly: true });
      } else {
        const codeEl = document.getElementById('script-spec-code');
        if (codeEl) codeEl.innerHTML = highlightCode(result.specCode || '', false);
        const editorEl = document.getElementById('script-spec-editor');
        if (editorEl) {
          editorEl.value = result.specCode || '';
          editorEl.setAttribute('readonly', 'true');
        }
      }
      applyPreviewControls();
    })
    .catch((error) => {
      if (reqId !== currentCompileRequestId || isResettingWizard) return;
      const draftCode = buildWizardLivePreview(payload, error.message);
      if (window.specCodeEditor) {
        window.specCodeEditor.setValue(draftCode, { markClean: true, readOnly: true });
      } else {
        const codeEl = document.getElementById('script-spec-code');
        if (codeEl) {
          codeEl.innerHTML = highlightCode(draftCode, false);
        }
        const editorEl = document.getElementById('script-spec-editor');
        if (editorEl) {
          editorEl.value = draftCode;
          editorEl.setAttribute('readonly', 'true');
        }
      }
      applyPreviewControls();
    });
}

function buildWizardState(options = {}) {
  const previewMode = options.previewMode !== false;
  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  const pageObjects = Array.from(wizardSelectedPoms).filter((relativePath) => relativePath.startsWith(`pages/${platform}/`));
  const dataPath = document.getElementById('wizard-data-path')?.value.trim() || '';
  const hasValidDataPath = Boolean(wizardSelectedDataset && dataPath);
  const dataSources = wizardSelectedDataset ? [{
    file: `data/${wizardSelectedDataset}`,
    variable: wizardSelectedDataset.replace(/\.json$/, '').replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()),
    dataPath: dataPath || (previewMode ? 'default' : ''),
  }] : [];
  let fileName = document.getElementById('create-script-filename')?.value.trim() || 'new_scenario_flow-bdd.spec.js';
  if (!fileName.endsWith('.spec.js')) fileName += '.spec.js';
  return {
    schemaVersion: 1,
    previewMode,
    fileName,
    platform,
    featureName: document.getElementById('create-script-feature')?.value.trim() || 'Tính năng kiểm thử',
    scenarioName: document.getElementById('create-script-title')?.value.trim() || 'Kịch bản kiểm thử mới',
    tags: (document.getElementById('create-script-tags')?.value || '@e2e').split(/\s+/).filter(Boolean),
    precondition: {
      auth: document.querySelector('input[name="wizard-auth-type"]:checked')?.value || 'authenticated',
      description: document.getElementById('wizard-precondition-desc')?.value.trim(),
      closeOnboarding: document.getElementById('wizard-precond-onboarding')?.checked ?? true,
      verifyLandingPage: document.getElementById('wizard-precond-verify-home')?.checked ?? true,
      captureInitial: document.getElementById('wizard-precond-capture')?.checked ?? true,
    },
    pageObjects: pageObjects.length > 0 ? pageObjects : [`pages/${platform}/HomePage.js`],
    dataSources,
    steps: wizardBddSteps.map((step, idx) => ({
      id: step.id || `ws_${idx + 1}`,
      stepType: step.type || 'When',
      title: step.text || `Bước kiểm thử ${idx + 1}`,
      actionId: step.actionId || '',
      locator: step.locator || '',
      pageObject: pageObjects[0] || `pages/${platform}/HomePage.js`,
      dataRef: step.dataRef || (hasValidDataPath && step.actionId === 'fill_mini_profile' ? {
        variable: wizardSelectedDataset.replace(/\.json$/, '').replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()),
        path: dataPath,
      } : null),
      evidence: step.evidence !== false ? (step.evidence || null) : false,
    })),
  };
}

const BDD_WIZARD_DRAFT_KEY = 'qa_studio_bdd_wizard_draft';
let activeScriptDraftId = 'draft_script_active';

function updateScriptDraftStatusBadge(statusText, state = 'saved') {
  const badge = document.getElementById('script-wizard-draft-badge');
  if (!badge) return;
  if (state === 'none' || !statusText) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.className = 'draft-status-pill ' + state;
  let icon = '<i class="ph-bold ph-floppy-disk"></i>';
  if (state === 'saved') icon = '<i class="ph-bold ph-check"></i>';
  if (state === 'modified') icon = '<i class="ph-bold ph-pencil-simple"></i>';
  badge.innerHTML = `${icon} <span>${escapeHtml(statusText)}</span>`;
}

function hideScriptDraftBanner() {
  const banner = document.getElementById('script-wizard-draft-banner');
  if (banner) banner.style.display = 'none';
}

async function checkServerScriptDrafts() {
  try {
    const res = await fetch('/api/drafts?type=script');
    const data = await res.json();
    const drafts = data.drafts || [];
    if (drafts.length > 0) {
      const latest = drafts[0];
      const draftData = latest.data;
      if (draftData && (draftData.scenarioName || draftData.featureName || (draftData.steps && draftData.steps.length > 0))) {
        activeScriptDraftId = latest.id;
        const banner = document.getElementById('script-wizard-draft-banner');
        const text = document.getElementById('script-wizard-draft-text');
        if (banner && text) {
          const name = draftData.scenarioName || draftData.fileName || 'Kịch bản chưa đặt tên';
          const timeStr = latest.updatedAt ? new Date(latest.updatedAt).toLocaleTimeString('vi-VN') : '';
          text.textContent = `Phát hiện bản nháp "${name}"${timeStr ? ` (lưu lúc ${timeStr} trên máy chủ)` : ''}.`;
          banner.style.display = 'flex';

          const btnRestore = document.getElementById('btn-restore-script-draft');
          if (btnRestore) {
            btnRestore.onclick = () => {
              restoreWizardDraftFromData(draftData);
              hideScriptDraftBanner();
            };
          }
          const btnDismiss = document.getElementById('btn-dismiss-script-draft');
          if (btnDismiss) {
            btnDismiss.onclick = () => {
              hideScriptDraftBanner();
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra server script drafts:', e.message);
  }
}

function restoreWizardDraftFromData(draft) {
  if (!draft) return;
  if (draft.scenarioName && document.getElementById('create-script-title')) {
    document.getElementById('create-script-title').value = draft.scenarioName;
  }
  if (draft.platform && document.getElementById('create-script-platform')) {
    document.getElementById('create-script-platform').value = draft.platform;
  }
  if (draft.featureName && document.getElementById('create-script-feature')) {
    document.getElementById('create-script-feature').value = draft.featureName;
  }
  if (draft.fileName && document.getElementById('create-script-filename')) {
    document.getElementById('create-script-filename').value = draft.fileName;
  }
  if (draft.tags && document.getElementById('create-script-tags')) {
    document.getElementById('create-script-tags').value = draft.tags;
  }
  if (Array.isArray(draft.selectedPoms)) {
    wizardSelectedPoms = new Set(draft.selectedPoms);
  }
  if (draft.selectedDataset !== undefined) {
    wizardSelectedDataset = draft.selectedDataset;
    const select = document.getElementById('wizard-select-dataset');
    if (select) select.value = draft.selectedDataset;
  }
  if (draft.authType) {
    const radio = document.querySelector(`input[name="wizard-auth-type"][value="${draft.authType}"]`);
    if (radio) radio.checked = true;
  }
  if (draft.preconditionDesc && document.getElementById('wizard-precondition-desc')) {
    document.getElementById('wizard-precondition-desc').value = draft.preconditionDesc;
  }
  if (Array.isArray(draft.steps) && draft.steps.length > 0) {
    wizardBddSteps = draft.steps;
  }

  const stepToRestore = draft.currentStep || 1;
  updateWizardStep(stepToRestore);
  if (draft.primaryPage && document.getElementById('create-script-primary-page')) {
    setTimeout(() => {
      const sel = document.getElementById('create-script-primary-page');
      if (sel) sel.value = draft.primaryPage;
    }, 100);
  }
  updateCreateScriptPreview();
  updateScriptDraftStatusBadge('Đã khôi phục', 'saved');
  showToast('Đã khôi phục bản nháp kịch bản thành công!', 'success');
}

function saveWizardDraft(forceServer = false) {
  if (isResettingWizard) return null;
  if (typeof scriptBuilderMode !== 'undefined' && scriptBuilderMode !== 'create') return null;

  const scenarioName = document.getElementById('create-script-title')?.value.trim() || '';
  const featureName = document.getElementById('create-script-feature')?.value.trim() || '';
  const fileName = document.getElementById('create-script-filename')?.value.trim() || '';
  const dataPath = document.getElementById('wizard-data-path')?.value.trim() || '';

  const hasUserProgress = Boolean(
    scenarioName ||
    featureName ||
    (fileName && fileName !== 'new_scenario_flow-bdd.spec.js') ||
    wizardSelectedDataset ||
    dataPath ||
    wizardCurrentStep > 1 ||
    (wizardSelectedPoms && (wizardSelectedPoms.size > 1 || !wizardSelectedPoms.has('pages/desktop/HomePage.js')))
  );

  if (!hasUserProgress && !forceServer) {
    return null;
  }

  try {
    const draft = {
      scenarioName: document.getElementById('create-script-title')?.value || '',
      platform: document.getElementById('create-script-platform')?.value || 'desktop',
      featureName: document.getElementById('create-script-feature')?.value || '',
      fileName: document.getElementById('create-script-filename')?.value || '',
      tags: document.getElementById('create-script-tags')?.value || '',
      selectedPoms: Array.from(wizardSelectedPoms || []),
      primaryPage: document.getElementById('create-script-primary-page')?.value || '',
      selectedDataset: wizardSelectedDataset || '',
      authType: document.querySelector('input[name="wizard-auth-type"]:checked')?.value || 'authenticated',
      preconditionDesc: document.getElementById('wizard-precondition-desc')?.value || '',
      steps: wizardBddSteps || [],
      currentStep: wizardCurrentStep || 1,
      savedAt: Date.now(),
    };
    localStorage.setItem(BDD_WIZARD_DRAFT_KEY, JSON.stringify(draft));

    if (!activeScriptDraftId) {
      activeScriptDraftId = 'draft_script_active';
    }

    updateScriptDraftStatusBadge('Đang lưu máy chủ...', 'modified');

    fetch('/api/drafts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'script',
        id: activeScriptDraftId,
        data: draft,
      }),
    }).then(r => r.json()).then(res => {
      if (res.success) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        updateScriptDraftStatusBadge(`Bản nháp máy chủ (${timeStr})`, 'saved');
        if (forceServer) {
          showToast('Đã lưu bản nháp kịch bản vào máy chủ (.dashboard-drafts/scripts/)', 'success');
        }
      }
    }).catch(err => {
      console.warn('Lỗi sync script draft:', err);
      updateScriptDraftStatusBadge('Đã lưu cục bộ', 'saved');
    });

    return draft;
  } catch (err) {
    console.warn('Could not save wizard draft:', err);
    return null;
  }
}

function restoreWizardDraft() {
  try {
    const raw = localStorage.getItem(BDD_WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft) return null;

    const hasMeaningfulContent = Boolean(
      (draft.scenarioName && draft.scenarioName.trim()) ||
      (draft.featureName && draft.featureName.trim()) ||
      (draft.selectedDataset) ||
      (draft.currentStep && draft.currentStep > 1) ||
      (draft.selectedPoms && draft.selectedPoms.length > 1)
    );
    if (!hasMeaningfulContent) {
      clearWizardDraft();
      return null;
    }

    restoreWizardDraftFromData(draft);
    return draft;
  } catch (err) {
    console.warn('Could not restore wizard draft:', err);
    return null;
  }
}

function clearWizardDraft() {
  try {
    localStorage.removeItem(BDD_WIZARD_DRAFT_KEY);
    const draftIdToDelete = activeScriptDraftId || 'draft_script_active';
    fetch('/api/drafts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'script', id: draftIdToDelete }),
    }).catch(() => {});

    if (draftIdToDelete !== 'draft_script_active') {
      fetch('/api/drafts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'script', id: 'draft_script_active' }),
      }).catch(() => {});
    }

    activeScriptDraftId = null;
    updateScriptDraftStatusBadge('', 'none');
    hideScriptDraftBanner();
  } catch (err) {
    // ignore
  }
}

function resetWizardToDefaults(skipConfirm = false) {
  if (!skipConfirm) {
    const hasAnyInput = Boolean(
      document.getElementById('create-script-title')?.value.trim() ||
      document.getElementById('create-script-feature')?.value.trim() ||
      document.getElementById('create-script-filename')?.value.trim() ||
      wizardSelectedDataset ||
      (wizardBddSteps && wizardBddSteps.length > 0) ||
      (wizardCurrentStep > 1)
    );
    if (hasAnyInput) {
      const shouldReset = window.confirm('Bạn có chắc muốn xóa bản nháp và làm mới toàn bộ kịch bản cùng mã xem trước?');
      if (!shouldReset) return;
    }
  }

  isResettingWizard = true;
  currentCompileRequestId++;
  clearWizardDraft();

  // 1. Reset state variables
  wizardCurrentStep = 1;
  wizardSelectedPoms = new Set(['pages/desktop/HomePage.js']);
  wizardSelectedDataset = '';
  wizardBddSteps = [];
  clearAllWizardErrors();

  // 2. Reset Step 1 form fields
  const defaults = {
    '#create-script-platform': 'desktop',
    '#create-script-title': '',
    '#create-script-feature': '',
    '#create-script-filename': '',
    '#create-script-tags': '@e2e @custom',
    '#wizard-precondition-desc': 'Đã đăng nhập tài khoản ứng viên hợp lệ (authSetup)',
    '#wizard-data-path': '',
    '#wizard-select-dataset': '',
    '#create-script-primary-page': 'pages/desktop/HomePage.js',
  };
  Object.entries(defaults).forEach(([selector, value]) => {
    const element = document.querySelector(selector);
    if (element) element.value = value;
  });

  // 3. Clear Step 3 (Test Data) preview, hints & drawer
  const previewBox = document.getElementById('wizard-data-preview-box');
  if (previewBox) previewBox.style.display = 'none';
  const previewJson = document.getElementById('wizard-data-preview-json');
  if (previewJson) previewJson.innerHTML = '';
  const dataPathHints = document.getElementById('wizard-data-path-hints');
  if (dataPathHints) dataPathHints.innerHTML = '';
  const dataPathHelp = document.getElementById('wizard-data-path-help');
  if (dataPathHelp) {
    dataPathHelp.textContent = 'Tùy chọn: Nhập nhánh dữ liệu cụ thể cần trích xuất (nếu để trống, toàn bộ tệp sẽ được nạp).';
  }
  const dataPathInput = document.getElementById('wizard-data-path');
  if (dataPathInput) {
    dataPathInput.value = '';
    dataPathInput.placeholder = 'Ví dụ: introduction hoặc experience';
  }
  const drawerData = document.getElementById('wizard-drawer-data');
  if (drawerData) drawerData.classList.remove('open');
  const drawerFilename = document.getElementById('drawer-data-filename');
  if (drawerFilename) drawerFilename.value = '';

  // 4. Reset Step 4 (Preconditions)
  document.querySelectorAll('input[name="wizard-auth-type"]').forEach((radio) => {
    radio.checked = radio.value === 'authenticated';
  });
  ['#wizard-precond-onboarding', '#wizard-precond-verify-home', '#wizard-precond-capture'].forEach((selector) => {
    const checkbox = document.querySelector(selector);
    if (checkbox) checkbox.checked = true;
  });

  // 5. Reset Step 6 (Summary Card)
  const sumTitle = document.getElementById('wizard-sum-title');
  if (sumTitle) sumTitle.textContent = '---';
  const sumFile = document.getElementById('wizard-sum-file');
  if (sumFile) sumFile.textContent = '---';
  const sumPoms = document.getElementById('wizard-sum-poms');
  if (sumPoms) sumPoms.textContent = '---';
  const sumData = document.getElementById('wizard-sum-data');
  if (sumData) sumData.textContent = '---';
  const sumPrecond = document.getElementById('wizard-sum-precond');
  if (sumPrecond) sumPrecond.textContent = '---';
  const sumSteps = document.getElementById('wizard-sum-steps-count');
  if (sumSteps) sumSteps.textContent = '0 bước';

  // 6. Re-render dynamic components
  renderWizardPomList();
  renderWizardPrimaryPageOptions();
  renderWizardBddSteps();

  // 7. Reset Stepper to Step 1
  updateWizardStep(1);

  // 8. Scroll wizard body back to top
  const scrollWrap = document.querySelector('.script-middle-scroll-wrap');
  if (scrollWrap) scrollWrap.scrollTop = 0;

  // 9. Reset live preview code completely
  if (window.specCodeEditor) {
    window.specCodeEditor.setValue('', { markClean: true, readOnly: true });
  }
  const codeEl = document.getElementById('script-spec-code');
  if (codeEl) codeEl.innerHTML = '';
  const editorEl = document.getElementById('script-spec-editor');
  if (editorEl) {
    editorEl.value = '';
    editorEl.setAttribute('readonly', 'true');
  }
  const specTitle = document.getElementById('script-code-title');
  if (specTitle) specTitle.textContent = '(Bản nháp mới)';

  const statusBadge = document.getElementById('script-spec-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
    statusBadge.classList.remove('modified');
    statusBadge.style.display = 'inline-flex';
  }

  // 10. Ensure localStorage draft is completely cleared
  clearWizardDraft();
  setTimeout(() => {
    isResettingWizard = false;
  }, 100);

  if (!skipConfirm) {
    showToast('Đã làm mới toàn bộ bản nháp và mã xem trước', 'info');
  }
}

function navigateToCreatePageObjectFromWizard() {
  saveWizardDraft();
  showToast('Đã lưu bản nháp kịch bản BDD. Đang chuyển sang Quản lý Page...', 'success');

  pageManagerMode = 'create';
  const pageTab = document.querySelector('.view-tab[data-view="page-manager-view"]');
  if (pageTab) {
    pageTab.click();
  }
  setTimeout(() => {
    switchToCreatePageMode();
    const platform = document.getElementById('create-script-platform')?.value || 'desktop';
    const pmPlatform = document.getElementById('page-manager-platform');
    if (pmPlatform) pmPlatform.value = platform;
  }, 120);
}

function navigateToCreateTestDataFromWizard() {
  saveWizardDraft();
  showToast('Đã lưu bản nháp kịch bản BDD. Đang chuyển sang tab Dữ liệu test...', 'success');

  const dataTab = document.querySelector('.view-tab[data-view="data-view"]');
  if (dataTab) {
    dataTab.click();
  }
}

function updateWizardStep(step) {
  wizardCurrentStep = Math.max(1, Math.min(6, step));
  if (!isResettingWizard) {
    saveWizardDraft();
  }

  for (let i = 1; i <= 6; i++) {
    const tab = document.getElementById(`wizard-tab-${i}`);
    const div = document.getElementById(`wizard-div-${i}`);
    const panel = document.getElementById(`wizard-panel-${i}`);

    if (tab) {
      tab.classList.toggle('active', i === wizardCurrentStep);
      tab.classList.toggle('completed', i < wizardCurrentStep);
    }
    if (div) {
      div.classList.toggle('completed', i < wizardCurrentStep);
    }
    if (panel) {
      panel.classList.toggle('active', i === wizardCurrentStep);
    }
  }

  const counter = document.getElementById('wizard-step-counter');
  if (counter) counter.textContent = wizardCurrentStep;

  const prevBtn = document.getElementById('btn-wizard-prev');
  if (prevBtn) prevBtn.disabled = wizardCurrentStep === 1;

  const nextBtn = document.getElementById('btn-wizard-next');
  if (nextBtn) {
    if (wizardCurrentStep === 6) {
      nextBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Lưu kịch bản BDD';
    } else {
      nextBtn.innerHTML = 'Tiếp theo <i class="ph-bold ph-caret-right"></i>';
    }
  }

  if (wizardCurrentStep === 2) {
    if (!repoPages || repoPages.length === 0) {
      loadWizardPageObjects();
    } else {
      renderWizardPomList();
    }
  }

  if (wizardCurrentStep === 6) {
    renderWizardSummary();
  }

  updateCreateScriptPreview();
}

function renderWizardSummary() {
  const title = document.getElementById('create-script-title')?.value.trim() || 'Chưa đặt tên kịch bản';
  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  let fileName = document.getElementById('create-script-filename')?.value.trim() || 'scenario.spec.js';
  if (!fileName.endsWith('.spec.js')) fileName += '.spec.js';

  const sumTitle = document.getElementById('wizard-sum-title');
  if (sumTitle) sumTitle.textContent = title;

  const sumFile = document.getElementById('wizard-sum-file');
  if (sumFile) sumFile.textContent = `tests/e2e/${platform}/${fileName}`;

  const poms = Array.from(wizardSelectedPoms).map(p => p.split('/').pop().replace(/\.js$/, ''));
  const sumPoms = document.getElementById('wizard-sum-poms');
  if (sumPoms) sumPoms.textContent = poms.length ? poms.join(', ') : 'HomePage';

  const sumData = document.getElementById('wizard-sum-data');
  if (sumData) sumData.textContent = wizardSelectedDataset ? `data/${wizardSelectedDataset}` : 'Không dùng data ngoài';

  const authType = document.querySelector('input[name="wizard-auth-type"]:checked')?.value;
  const sumPrecond = document.getElementById('wizard-sum-precond');
  if (sumPrecond) sumPrecond.textContent = authType === 'guest' ? 'Khách vãng lai (Chưa đăng nhập)' : 'Đã đăng nhập (authSetup)';

  const sumSteps = document.getElementById('wizard-sum-steps-count');
  if (sumSteps) sumSteps.textContent = `${wizardBddSteps.length} bước BDD`;
}

function getWizardCompatiblePages() {
  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  return (repoPages || []).filter((page) => {
    const matchesPlatform = page.platform === platform || (!page.platform && platform === 'desktop');
    const isReady = page.readiness ? page.readiness.ready !== false : true;
    return matchesPlatform && isReady;
  });
}

function renderWizardPrimaryPageOptions() {
  const select = document.getElementById('create-script-primary-page');
  if (!select) return;

  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  const platformLabel = platform === 'mobile-web' ? 'Mobile Web' : 'Desktop Web';
  const compatiblePages = getWizardCompatiblePages();
  const selectedPath = select.value;
  select.innerHTML = compatiblePages.length
    ? '<option value="">-- Chọn Page Object chính --</option>' + compatiblePages.map((page) => `<option value="${escapeHtml(page.relativePath)}">${escapeHtml(page.title || page.className)} (${escapeHtml(page.relativePath)})</option>`).join('')
    : `<option value="" selected disabled>-- Chưa có Page Object cho ${platformLabel} --</option>`;
  if (compatiblePages.some((page) => page.relativePath === selectedPath)) select.value = selectedPath;
}

function renderWizardPomList() {
  const container = document.getElementById('wizard-pom-list');
  if (!container) return;

  if (wizardPomLoadError) {
    container.innerHTML = `<div class="dependency-empty-state dependency-error-state"><i class="ph ph-warning-circle"></i><strong>Không tải được danh sách Page Object</strong><span>${escapeHtml(wizardPomLoadError)} Vui lòng thử lại.</span><button type="button" class="btn-secondary-sm" id="wizard-retry-load-pom"><i class="ph-bold ph-arrows-clockwise"></i> Thử lại</button></div>`;
    container.querySelector('#wizard-retry-load-pom')?.addEventListener('click', () => loadWizardPageObjects());
    return;
  }

  if (!repoPages) {
    container.innerHTML = '<div class="data-loading-spinner"><i class="ph ph-spinner ph-spin"></i> Đang tải danh sách Page Objects...</div>';
    return;
  }

  const searchInput = document.getElementById('wizard-pom-search');
  const countBadge = document.getElementById('wizard-pom-count');
  const btnSelectAll = document.getElementById('btn-pom-select-all');
  const btnDeselectAll = document.getElementById('btn-pom-deselect-all');

  // Bind controls once
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => renderWizardPomList());
  }
  if (btnSelectAll && !btnSelectAll.dataset.bound) {
    btnSelectAll.dataset.bound = 'true';
    btnSelectAll.addEventListener('click', () => {
      const currentPages = getWizardCompatiblePages();
      currentPages.forEach((p) => wizardSelectedPoms.add(p.relativePath));
      document.getElementById('wizard-pom-box')?.classList.remove('wizard-field-error');
      const pomErr = document.getElementById('wizard-pom-error');
      if (pomErr) pomErr.style.display = 'none';
      renderWizardPomList();
      updateCreateScriptPreview();
    });
  }
  if (btnDeselectAll && !btnDeselectAll.dataset.bound) {
    btnDeselectAll.dataset.bound = 'true';
    btnDeselectAll.addEventListener('click', () => {
      wizardSelectedPoms.clear();
      renderWizardPomList();
      updateCreateScriptPreview();
    });
  }

  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  const platformLabel = platform === 'mobile-web' ? 'Mobile Web' : 'Desktop Web';
  const compatiblePages = getWizardCompatiblePages();
  wizardSelectedPoms = new Set(Array.from(wizardSelectedPoms).filter((relativePath) => compatiblePages.some((page) => page.relativePath === relativePath)));

  if (countBadge) {
    countBadge.textContent = wizardSelectedPoms.size;
  }
  const totalBadge = document.getElementById('wizard-pom-total');
  if (totalBadge) {
    totalBadge.textContent = compatiblePages.length;
  }

  if (!compatiblePages.length) {
    const hasPlatformPages = repoPages.some((page) => page.platform === platform);
    container.innerHTML = `
      <div class="dependency-empty-state">
        <i class="ph ph-browsers"></i>
        <strong>Chưa có Page Object dùng được cho ${platformLabel}</strong>
        <span>${hasPlatformPages ? 'Các Page Object của nền tảng này chưa đạt trạng thái sẵn sàng.' : 'Chưa có Page Object nào được khai báo cho nền tảng này.'} Hãy tạo mới hoặc kiểm tra lại trong Quản lý Page.</span>
        <button type="button" class="btn-secondary-sm" id="wizard-empty-create-pom"><i class="ph-bold ph-plus-circle"></i> Tạo Page Object mới</button>
      </div>`;
    container.querySelector('#wizard-empty-create-pom')?.addEventListener('click', () => navigateToCreatePageObjectFromWizard());
    renderWizardPrimaryPageOptions();
    return;
  }

  renderWizardPrimaryPageOptions();

  const searchQuery = (searchInput?.value || '').trim().toLowerCase();
  const filteredPages = searchQuery
    ? compatiblePages.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const className = (p.className || '').toLowerCase();
        const path = (p.relativePath || '').toLowerCase();
        return title.includes(searchQuery) || className.includes(searchQuery) || path.includes(searchQuery);
      })
    : compatiblePages;

  if (filteredPages.length === 0) {
    container.innerHTML = `
      <div class="dependency-empty-state" style="grid-column: 1 / -1; padding: 24px 16px;">
        <i class="ph-bold ph-magnifying-glass" style="font-size: 22px; color: var(--muted);"></i>
        <strong>Không tìm thấy Page Object phù hợp</strong>
        <span style="font-size: 12px; color: var(--muted);">Không có màn hình nào khớp với từ khóa "<em>${escapeHtml(searchQuery)}</em>"</span>
        <button type="button" class="btn-secondary-sm" id="btn-clear-pom-search" style="margin-top: 6px; font-size: 11.5px; padding: 4px 10px;">
          <i class="ph-bold ph-x"></i> Xóa bộ lọc
        </button>
      </div>`;
    container.querySelector('#btn-clear-pom-search')?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      renderWizardPomList();
    });
    return;
  }

  container.innerHTML = filteredPages.map((page) => {
    const isChecked = wizardSelectedPoms.has(page.relativePath);
    const title = page.title || page.className;
    const path = page.relativePath || `${page.className}.js`;
    return `
      <div class="dependency-card-item ${isChecked ? 'selected' : ''}" data-path="${escapeHtml(page.relativePath)}">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <input type="checkbox" class="wizard-pom-checkbox" value="${escapeHtml(page.relativePath)}" ${isChecked ? 'checked' : ''} />
          <i class="ph-bold ph-browsers dependency-card-icon"></i>
          <div style="min-width: 0; flex: 1;">
            <strong class="dependency-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
            <span class="dependency-card-path" title="${escapeHtml(path)}">${escapeHtml(path)}</span>
          </div>
        </div>
        <span class="dependency-badge-ready"><i class="ph-bold ph-check"></i> Sẵn có</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.dependency-card-item').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    const cb = card.querySelector('input[type="checkbox"]');
    cb?.addEventListener('change', () => {
      const p = card.dataset.path;
      if (cb.checked) {
        wizardSelectedPoms.add(p);
        card.classList.add('selected');
        document.getElementById('wizard-pom-box')?.classList.remove('wizard-field-error');
        const pomErr = document.getElementById('wizard-pom-error');
        if (pomErr) pomErr.style.display = 'none';
      } else {
        wizardSelectedPoms.delete(p);
        card.classList.remove('selected');
      }
      if (countBadge) countBadge.textContent = wizardSelectedPoms.size;
      updateCreateScriptPreview();
    });
  });
}

async function loadWizardPageObjects() {
  wizardPomLoadError = '';
  renderWizardPomList();
  try {
    const result = await request('/api/object-repository/pages');
    repoPages = result.pages || [];
    renderWizardPomList();
    renderWizardPrimaryPageOptions();
  } catch (error) {
    wizardPomLoadError = 'Không thể kết nối tới Kho Page Object.';
    renderWizardPomList();
    console.error('Failed to load Page Objects for wizard:', error);
  }
}

function renderWizardBddSteps() {
  const container = document.getElementById('wizard-bdd-steps-list');
  if (!container) return;

  if (!wizardBddSteps.length) {
    container.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 14px; font-size: 12px;">Chưa có bước kiểm thử nào. Bấm nút + When, + And, + Then phía trên để thêm bước.</div>`;
    return;
  }

  const renderActionOptions = (step) => builderPresetActions.length
    ? `<option value="">-- Chọn hành động runtime --</option>${builderPresetActions.map((action) => `<option value="${escapeHtml(action.id)}" ${action.id === step.actionId ? 'selected' : ''}>[${escapeHtml(action.stepType || 'When')}] ${escapeHtml(action.name)}</option>`).join('')}`
    : '<option value="">Đang tải thư viện hành động...</option>';

  container.innerHTML = wizardBddSteps.map((step, idx) => `
    <div class="bdd-step-card" data-idx="${idx}" style="display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px;">
      <select class="wizard-step-type-select" data-idx="${idx}" style="padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-2); font-weight: 700; font-size: 11.5px; color: var(--accent);">
        <option value="Given" ${step.type === 'Given' ? 'selected' : ''}>Given</option>
        <option value="When" ${step.type === 'When' ? 'selected' : ''}>When</option>
        <option value="And" ${step.type === 'And' ? 'selected' : ''}>And</option>
        <option value="Then" ${step.type === 'Then' ? 'selected' : ''}>Then</option>
      </select>
      <input type="text" class="wizard-step-text-input" data-idx="${idx}" value="${escapeHtml(step.text)}" style="flex: 1; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px;" />
      <select class="wizard-step-action-select" data-idx="${idx}" title="Hành động runtime của bước" style="min-width: 190px; max-width: 240px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-2); color: var(--text); font-size: 11px;">${renderActionOptions(step)}</select>
      <button type="button" class="btn-icon-subtle btn-wizard-del-step" data-idx="${idx}" title="Xóa bước" style="color: #ef4444;"><i class="ph ph-trash"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.wizard-step-type-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      if (wizardBddSteps[i]) {
        wizardBddSteps[i].type = e.target.value;
        updateCreateScriptPreview();
      }
    });
  });

  container.querySelectorAll('.wizard-step-text-input').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      if (wizardBddSteps[i]) {
        wizardBddSteps[i].text = e.target.value;
        updateCreateScriptPreview();
      }
    });
  });

  container.querySelectorAll('.wizard-step-action-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      if (wizardBddSteps[i]) {
        wizardBddSteps[i].actionId = e.target.value;
        const action = builderPresetActions.find((item) => item.id === e.target.value);
        if (action && (!wizardBddSteps[i].text || wizardBddSteps[i].text.startsWith('Bước '))) {
          wizardBddSteps[i].text = action.name;
          wizardBddSteps[i].type = action.stepType || wizardBddSteps[i].type;
          renderWizardBddSteps();
        }
        updateCreateScriptPreview();
      }
    });
  });

  container.querySelectorAll('.btn-wizard-del-step').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(btn.dataset.idx, 10);
      wizardBddSteps.splice(i, 1);
      renderWizardBddSteps();
      updateCreateScriptPreview();
    });
  });
}

function clearAllWizardErrors() {
  document.getElementById('create-script-title')?.classList.remove('wizard-field-error');
  const titleErr = document.getElementById('create-script-title-error');
  if (titleErr) titleErr.style.display = 'none';

  document.getElementById('wizard-pom-box')?.classList.remove('wizard-field-error');
  const pomErr = document.getElementById('wizard-pom-error');
  if (pomErr) pomErr.style.display = 'none';

  document.getElementById('wizard-precondition-desc')?.classList.remove('wizard-field-error');
  const precondErr = document.getElementById('wizard-precond-error');
  if (precondErr) precondErr.style.display = 'none';

  const stepsErr = document.getElementById('wizard-steps-error');
  if (stepsErr) stepsErr.style.display = 'none';
}

function validateWizardStep(step, showFeedback = true) {
  if (step === 1) {
    const titleInput = document.getElementById('create-script-title');
    const val = (titleInput?.value || '').trim();
    if (!val) {
      if (showFeedback) {
        titleInput?.classList.add('wizard-field-error');
        const errEl = document.getElementById('create-script-title-error');
        if (errEl) errEl.style.display = 'flex';
        titleInput?.focus();
        notify('Bước 1: Vui lòng nhập Tên kịch bản (Scenario Name) trước khi chuyển bước.', 'error');
      }
      return false;
    }
    titleInput?.classList.remove('wizard-field-error');
    const errEl = document.getElementById('create-script-title-error');
    if (errEl) errEl.style.display = 'none';
    return true;
  }

  if (step === 2) {
    if (!wizardSelectedPoms || wizardSelectedPoms.size === 0) {
      if (showFeedback) {
        const pomBox = document.getElementById('wizard-pom-box');
        pomBox?.classList.add('wizard-field-error');
        const errEl = document.getElementById('wizard-pom-error');
        if (errEl) errEl.style.display = 'flex';
        notify('Bước 2: Vui lòng chọn ít nhất một Page Object cần dùng cho kịch bản.', 'error');
        document.getElementById('wizard-pom-list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return false;
    }
    const pomBox = document.getElementById('wizard-pom-box');
    pomBox?.classList.remove('wizard-field-error');
    const errEl = document.getElementById('wizard-pom-error');
    if (errEl) errEl.style.display = 'none';
    return true;
  }

  if (step === 3) {
    return true;
  }

  if (step === 4) {
    const precondInput = document.getElementById('wizard-precondition-desc');
    const val = (precondInput?.value || '').trim();
    if (!val) {
      if (showFeedback) {
        precondInput?.classList.add('wizard-field-error');
        const errEl = document.getElementById('wizard-precond-error');
        if (errEl) errEl.style.display = 'flex';
        precondInput?.focus();
        notify('Bước 4: Vui lòng nhập mô tả tiền điều kiện cho kịch bản.', 'error');
      }
      return false;
    }
    precondInput?.classList.remove('wizard-field-error');
    const errEl = document.getElementById('wizard-precond-error');
    if (errEl) errEl.style.display = 'none';
    return true;
  }

  if (step === 5) {
    const errEl = document.getElementById('wizard-steps-error');
    if (!wizardBddSteps || wizardBddSteps.length === 0) {
      if (showFeedback) {
        if (errEl) {
          errEl.innerHTML = '<i class="ph-bold ph-warning-circle"></i> Kịch bản cần ít nhất một bước BDD kiểm thử (When / Then / And).';
          errEl.style.display = 'flex';
        }
        notify('Bước 5: Kịch bản cần ít nhất một bước BDD kiểm thử (When/Then/And).', 'error');
      }
      return false;
    }
    const emptyStepIdx = wizardBddSteps.findIndex((item) => !item.text || !item.text.trim());
    if (emptyStepIdx !== -1) {
      if (showFeedback) {
        if (errEl) {
          errEl.innerHTML = `<i class="ph-bold ph-warning-circle"></i> Bước BDD số ${emptyStepIdx + 1} chưa có nội dung mô tả.`;
          errEl.style.display = 'flex';
        }
        notify(`Bước 5: Bước BDD số ${emptyStepIdx + 1} chưa có nội dung mô tả.`, 'error');
      }
      return false;
    }
    const missingAction = wizardBddSteps.findIndex((item) => !item.actionId);
    if (missingAction !== -1) {
      if (showFeedback) {
        if (errEl) {
          errEl.innerHTML = `<i class="ph-bold ph-warning-circle"></i> Bước BDD số ${missingAction + 1} chưa có hành động runtime. Vui lòng chọn hành động.`;
          errEl.style.display = 'flex';
        }
        notify(`Bước 5: Bước BDD số ${missingAction + 1} chưa có hành động runtime. Vui lòng chọn hành động.`, 'error');
        renderWizardBddSteps();
      }
      return false;
    }
    if (errEl) errEl.style.display = 'none';
    return true;
  }

  return true;
}

function goToWizardStep(targetStep) {
  targetStep = Math.max(1, Math.min(6, targetStep));
  if (targetStep === wizardCurrentStep) return;

  // Cho phép quay lại các bước trước tự do
  if (targetStep < wizardCurrentStep) {
    updateWizardStep(targetStep);
    return;
  }

  // Chuyển sang bước sau: Kiểm tra tuần tự từng bước từ bước 1 đến targetStep - 1
  for (let s = 1; s < targetStep; s++) {
    if (!validateWizardStep(s, true)) {
      if (wizardCurrentStep !== s) {
        updateWizardStep(s);
        validateWizardStep(s, true);
      }
      return;
    }
  }

  updateWizardStep(targetStep);
}

async function loadWizardDatasets() {
  try {
    const res = await fetch('/api/data/datasets');
    if (res.ok) {
      const data = await res.json();
      wizardAvailableDatasets = data.datasets || [];
      const select = document.getElementById('wizard-select-dataset');
      if (select) {
        select.innerHTML = '<option value="">-- Không sử dụng file data ngoài --</option>' +
          wizardAvailableDatasets.map(d => {
            const count = d.recordCount ?? d.itemCount ?? 0;
            return `<option value="${escapeHtml(d.fileName)}">${escapeHtml(d.fileName)} (${count} mục)</option>`;
          }).join('');
      }
    }
  } catch (e) {
    console.error('Failed to load wizard datasets:', e);
  }
}

async function submitCreateScriptFromWizard() {
  // Validate toàn bộ các bước từ 1 đến 5 trước khi lưu
  for (let s = 1; s <= 5; s++) {
    if (!validateWizardStep(s, true)) {
      goToWizardStep(s);
      return;
    }
  }

  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  const scenarioName = document.getElementById('create-script-title')?.value.trim();
  const featureName = document.getElementById('create-script-feature')?.value.trim();
  let fileName = document.getElementById('create-script-filename')?.value.trim() || 'new_scenario_flow-bdd.spec.js';
  if (!fileName.endsWith('.spec.js')) fileName += '.spec.js';
  const tags = document.getElementById('create-script-tags')?.value.trim();
  const primaryPage = document.getElementById('create-script-primary-page')?.value;

  const nextBtn = document.getElementById('btn-wizard-next');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang lưu...';
  }

  try {
    const state = buildWizardState();
    const validation = await fetch('/api/builder/validate-spec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
    });
    const validationData = await validation.json();
    if (!validation.ok || !validationData.valid) throw new Error((validationData.errors || []).map((item) => item.message || item).join(' ') || 'Spec chưa hợp lệ.');
    const res = await fetch('/api/builder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state,
        expectedHash: validationData.compiledHash,
        draftId: activeScriptDraftId,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi tạo kịch bản');

    // Dọn dẹp bản nháp sau khi lưu thành công vào framework
    try {
      localStorage.removeItem(BDD_WIZARD_DRAFT_KEY);
      if (activeScriptDraftId) {
        await fetch('/api/drafts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'script', id: activeScriptDraftId }),
        });
        activeScriptDraftId = null;
      }
    } catch {}
    updateScriptDraftStatusBadge('', 'none');
    hideScriptDraftBanner();

    notify(data.message || `✅ Đã tạo ${fileName} thành công! Kịch bản đã được lưu vào tests/e2e/${platform}/.`);
    await loadProjectScripts();
    const createdScript = projectScripts.find((s) => s.relativePath === data.script?.relativePath || s.fileName === fileName);
    if (createdScript) {
      selectProjectScript(createdScript);
    } else {
      switchToInspectScriptMode();
    }
  } catch (err) {
    notify(`❌ Không thể tạo kịch bản: ${err.message}`);
  } finally {
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Lưu kịch bản BDD';
    }
  }
}

async function switchToCreateScriptMode() {
  scriptBuilderMode = 'create';
  scriptDirectEditMode = false;

  // Tabs
  document.getElementById('btn-tab-script-inspect')?.classList.remove('active');
  document.getElementById('btn-tab-script-edit')?.classList.remove('active');
  document.getElementById('btn-tab-script-create')?.classList.add('active');

  // Hint
  const hint = document.getElementById('script-toolbar-hint');
  if (hint) {
    hint.innerHTML = '<i class="ph-bold ph-magic-wand" style="color: var(--accent);"></i> Script Studio Wizard: Tạo kịch bản theo thứ tự phụ thuộc · Xem trước realtime tại cột bên phải';
  }

  // Views
  const inspectView = document.getElementById('script-inspect-view');
  const editView = document.getElementById('script-edit-view');
  const createView = document.getElementById('script-create-view');
  if (inspectView) inspectView.style.display = 'none';
  if (editView) editView.style.display = 'none';
  if (createView) createView.style.display = 'flex';

  const subnavActions = document.getElementById('script-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'none';

  // Deselect sidebar cards
  document.querySelectorAll('#script-files-list .script-card-item').forEach((card) => card.classList.remove('active', 'is-selected'));

  // Refresh Page Objects so the Wizard does not use a stale repository snapshot.
  await loadWizardPageObjects();

  // Initialize Page Objects & Datasets
  renderWizardPrimaryPageOptions();
  renderWizardPomList();
  loadWizardDatasets();
  renderWizardBddSteps();

  // Khôi phục bản nháp nếu có, ngược lại bắt đầu ở bước 1 với form sạch
  const restoredDraft = restoreWizardDraft();
  if (restoredDraft) {
    showToast('Đã khôi phục bản nháp kịch bản BDD', 'info');
  } else {
    resetWizardToDefaults(true);
    await checkServerScriptDrafts();
  }

  // Column 3 Code Panel -> Live Preview Mode
  const eyebrow = document.getElementById('script-code-eyebrow');
  if (eyebrow) eyebrow.textContent = 'LIVE PREVIEW (.spec.js)';

  const statusBadge = document.getElementById('script-spec-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="ph-bold ph-eye"></i> Bản xem trước realtime';
    statusBadge.classList.remove('modified');
  }

  const helpText = document.getElementById('script-code-help-text');
  if (helpText) {
    helpText.textContent = 'Mã nguồn Playwright BDD Spec được sinh realtime theo từng bước của Wizard. File chỉ được tạo khi bạn bấm "Lưu kịch bản BDD".';
  }

  const insertPomBtn = document.getElementById('script-spec-insert-pom-btn');
  const toggleEditBtn = document.getElementById('script-btn-toggle-edit');
  const saveBtn = document.getElementById('script-spec-save-btn');
  const revertBtn = document.getElementById('script-spec-revert-btn');
  if (insertPomBtn) insertPomBtn.style.display = 'none';
  if (toggleEditBtn) toggleEditBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
  if (revertBtn) revertBtn.style.display = 'none';

  const stage = document.getElementById('script-code-stage');
  const editor = document.getElementById('script-spec-editor');
  if (stage) stage.classList.remove('editing');
  if (editor) editor.setAttribute('readonly', 'true');

  // Deselect sidebar cards
  document.querySelectorAll('#script-files-list .script-card-item').forEach((item) => item.classList.remove('active', 'is-selected'));

  // Title & Filename Bindings
  const titleInput = document.getElementById('create-script-title');
  const filenameInput = document.getElementById('create-script-filename');
  if (titleInput && filenameInput && !titleInput._previewBound) {
    titleInput._previewBound = true;
    titleInput.addEventListener('input', () => {
      const slug = titleInput.value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      filenameInput.value = slug ? `${slug}_flow-bdd.spec.js` : '';
      updateCreateScriptPreview();
    });
    filenameInput.addEventListener('input', () => updateCreateScriptPreview());
    document.getElementById('create-script-feature')?.addEventListener('input', () => updateCreateScriptPreview());
    document.getElementById('create-script-tags')?.addEventListener('input', () => updateCreateScriptPreview());
    document.getElementById('create-script-platform')?.addEventListener('change', () => { renderWizardPomList(); renderWizardPrimaryPageOptions(); updateCreateScriptPreview(); });
    document.getElementById('create-script-primary-page')?.addEventListener('change', () => updateCreateScriptPreview());

    // Precondition bindings
    document.querySelectorAll('input[name="wizard-auth-type"]').forEach((r) => {
      r.addEventListener('change', () => updateCreateScriptPreview());
    });
    document.getElementById('wizard-precondition-desc')?.addEventListener('input', () => updateCreateScriptPreview());
    document.getElementById('wizard-precond-onboarding')?.addEventListener('change', () => updateCreateScriptPreview());
    document.getElementById('wizard-precond-verify-home')?.addEventListener('change', () => updateCreateScriptPreview());
    document.getElementById('wizard-precond-capture')?.addEventListener('change', () => updateCreateScriptPreview());
    document.getElementById('wizard-data-path')?.addEventListener('input', () => updateCreateScriptPreview());

    // Data selector binding
    document.getElementById('wizard-select-dataset')?.addEventListener('change', async (e) => {
      wizardSelectedDataset = e.target.value;
      const previewBox = document.getElementById('wizard-data-preview-box');
      const previewJson = document.getElementById('wizard-data-preview-json');
      const dataPathInput = document.getElementById('wizard-data-path');
      const dataPathHints = document.getElementById('wizard-data-path-hints');
      const dataPathHelp = document.getElementById('wizard-data-path-help');

      if (wizardSelectedDataset && previewBox && previewJson) {
        previewBox.style.display = 'block';
        previewJson.textContent = `// Đang tải cấu trúc data/${wizardSelectedDataset}...`;

        try {
          const res = await request(`/api/data/dataset?file=${encodeURIComponent(wizardSelectedDataset)}`);
          if (res?.data) {
            const keys = Object.keys(res.data);
            previewJson.innerHTML = highlightCode(JSON.stringify(res.data, null, 2), true);
            if (dataPathHints) {
              dataPathHints.innerHTML = keys.map(k => `<option value="${escapeHtml(k)}"></option>`).join('');
            }
            if (dataPathHelp) {
              dataPathHelp.innerHTML = `Gợi ý các nhánh data có sẵn: <strong>${escapeHtml(keys.slice(0, 4).join(', '))}${keys.length > 4 ? '...' : ''}</strong>`;
            }
            if (dataPathInput && !dataPathInput.value) {
              dataPathInput.placeholder = `Ví dụ: ${keys[0] || 'nhánh_data'}`;
            }
          }
        } catch (err) {
          previewJson.textContent = `// Data file: data/${wizardSelectedDataset}\n// Biến tương ứng sẽ được tự động require vào đầu spec`;
        }
      } else if (previewBox) {
        previewBox.style.display = 'none';
        if (dataPathHelp) {
          dataPathHelp.textContent = 'Tùy chọn: Nhập nhánh dữ liệu cụ thể cần trích xuất (nếu để trống, toàn bộ tệp sẽ được nạp).';
        }
      }
      updateCreateScriptPreview();
    });

    // Stepper Tabs Navigation
    for (let i = 1; i <= 6; i++) {
      document.getElementById(`wizard-tab-${i}`)?.addEventListener('click', () => goToWizardStep(i));
    }

    // Prev / Next Navigation
    document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
      if (wizardCurrentStep > 1) goToWizardStep(wizardCurrentStep - 1);
    });

    document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
      if (wizardCurrentStep < 6) {
        goToWizardStep(wizardCurrentStep + 1);
      } else {
        submitCreateScriptFromWizard();
      }
    });

    // Realtime validation clearing
    document.getElementById('create-script-title')?.addEventListener('input', (event) => {
      event.target.setCustomValidity('');
      if (event.target.value.trim()) {
        event.target.classList.remove('wizard-field-error');
        const errEl = document.getElementById('create-script-title-error');
        if (errEl) errEl.style.display = 'none';
      }
    });

    document.getElementById('wizard-precondition-desc')?.addEventListener('input', (event) => {
      if (event.target.value.trim()) {
        event.target.classList.remove('wizard-field-error');
        const errEl = document.getElementById('wizard-precond-error');
        if (errEl) errEl.style.display = 'none';
      }
    });

    // Quick Add Steps in Step 5
    document.getElementById('btn-wizard-add-when')?.addEventListener('click', () => {
      wizardBddSteps.push({ id: `ws_${Date.now()}`, type: 'When', text: 'Người dùng thực hiện hành động kiểm thử mới', actionId: '' });
      const errEl = document.getElementById('wizard-steps-error');
      if (errEl) errEl.style.display = 'none';
      renderWizardBddSteps();
      updateCreateScriptPreview();
    });
    document.getElementById('btn-wizard-add-and')?.addEventListener('click', () => {
      wizardBddSteps.push({ id: `ws_${Date.now()}`, type: 'And', text: 'Người dùng tiếp tục thao tác tiếp theo', actionId: '' });
      const errEl = document.getElementById('wizard-steps-error');
      if (errEl) errEl.style.display = 'none';
      renderWizardBddSteps();
      updateCreateScriptPreview();
    });
    document.getElementById('btn-wizard-add-then')?.addEventListener('click', () => {
      wizardBddSteps.push({ id: `ws_${Date.now()}`, type: 'Then', text: 'Hệ thống hiển thị kết quả mong đợi', actionId: '' });
      const errEl = document.getElementById('wizard-steps-error');
      if (errEl) errEl.style.display = 'none';
      renderWizardBddSteps();
      updateCreateScriptPreview();
    });

    // Tạo Page Object: Lưu nháp và chuyển sang Quản lý Page
    document.getElementById('btn-wizard-open-create-pom')?.addEventListener('click', () => {
      navigateToCreatePageObjectFromWizard();
    });

    // Tạo Test Data: Lưu nháp và chuyển sang tab Dữ liệu test
    document.getElementById('btn-wizard-open-create-data')?.addEventListener('click', () => {
      navigateToCreateTestDataFromWizard();
    });
    document.getElementById('btn-close-drawer-data')?.addEventListener('click', () => dataDrawer?.classList.remove('open'));
    document.getElementById('btn-cancel-drawer-data')?.addEventListener('click', () => dataDrawer?.classList.remove('open'));
    document.getElementById('btn-submit-drawer-data')?.addEventListener('click', async () => {
      let fn = document.getElementById('drawer-data-filename')?.value.trim();
      if (!fn) {
        showToast('Vui lòng nhập Tên file data (.json)', 'error');
        return;
      }
      if (!fn.endsWith('.json')) fn += '.json';
      const content = document.getElementById('drawer-data-content')?.value.trim() || '{}';

      try {
        JSON.parse(content);
      } catch (e) {
        showToast('Cú pháp JSON không hợp lệ: ' + e.message, 'error');
        return;
      }

      try {
        const res = await fetch('/api/data/create-dataset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: fn, content }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Lỗi tạo dataset');

        showToast(`Đã tạo file ${fn} thành công!`, 'success');
        dataDrawer?.classList.remove('open');
        await loadWizardDatasets();
        const select = document.getElementById('wizard-select-dataset');
        if (select) select.value = fn;
        wizardSelectedDataset = fn;
        updateCreateScriptPreview();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  updateCreateScriptPreview();
}

function switchToInspectScriptMode() {
  scriptBuilderMode = 'inspect';
  scriptDirectEditMode = false;

  // Tabs
  document.getElementById('btn-tab-script-inspect')?.classList.add('active');
  document.getElementById('btn-tab-script-edit')?.classList.remove('active');
  document.getElementById('btn-tab-script-create')?.classList.remove('active');

  // Hint
  const hint = document.getElementById('script-toolbar-hint');
  if (hint) {
    hint.innerHTML = '<i class="ph ph-info"></i> Chọn kịch bản từ danh sách hoặc chỉnh sửa/tạo mới kịch bản chuẩn Playwright BDD';
  }

  // Views
  const inspectView = document.getElementById('script-inspect-view');
  const editView = document.getElementById('script-edit-view');
  const createView = document.getElementById('script-create-view');
  if (inspectView) inspectView.style.display = 'flex';
  if (editView) editView.style.display = 'none';
  if (createView) createView.style.display = 'none';

  const subnavActions = document.getElementById('script-subnav-actions');
  if (subnavActions) subnavActions.style.display = 'flex';

  // Restore tools
  const insertPomBtn = document.getElementById('script-spec-insert-pom-btn');
  const toggleEditBtn = document.getElementById('script-btn-toggle-edit');
  const saveBtn = document.getElementById('script-spec-save-btn');
  if (insertPomBtn) insertPomBtn.style.display = 'inline-flex';
  if (toggleEditBtn) toggleEditBtn.style.display = 'inline-flex';
  if (saveBtn) saveBtn.style.display = 'none';

  const eyebrow = document.getElementById('script-code-eyebrow');
  if (eyebrow) eyebrow.textContent = 'MÃ NGUỒN BDD SPEC (.spec.js)';

  const helpText = document.getElementById('script-code-help-text');
  if (helpText) {
    helpText.textContent = 'Nhấn "Chỉnh sửa" để gõ trực tiếp hoặc Ctrl+S để lưu file. Tự động sao lưu backup (.bak) an toàn.';
  }

  if (currentSelectedScript) {
    selectProjectScript(currentSelectedScript);
  }
}

window.openCreateBddScriptModal = function () {
  switchToCreateScriptMode();
};

async function submitCreateBddScript() {
  const submitBtn = document.getElementById('btn-submit-create-script');
  const platform = document.getElementById('create-script-platform')?.value || 'desktop';
  const scenarioName = document.getElementById('create-script-title')?.value.trim();
  const featureName = document.getElementById('create-script-feature')?.value.trim();
  const fileName = document.getElementById('create-script-filename')?.value.trim();
  const tags = document.getElementById('create-script-tags')?.value.trim();
  const primaryPage = document.getElementById('create-script-primary-page')?.value;

  if (!scenarioName) {
    notify('❌ Vui lòng nhập tên kịch bản!');
    document.getElementById('create-script-title')?.focus();
    return;
  }

  const origHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang tạo...';

  try {
    const res = await request('/api/builder/create-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        scenarioName,
        featureName,
        fileName,
        tags,
        primaryPage,
      }),
    });

    clearWizardDraft();
    switchToInspectScriptMode();
    notify(`✅ ${res.message}`);

    await loadProjectScripts();
    const created = projectScripts.find((s) => s.relativePath === res.script.filePath);
    if (created) {
      selectProjectScript(created);
    }
  } catch (err) {
    notify(`❌ Lỗi: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origHtml;
  }
}

async function initVisualBuilder() {
  if (!isVisualBuilderInitialized) {
    isVisualBuilderInitialized = true;
    initVisualBuilderControls();
  }
  populateBuilderSpecOptions();
  await loadProjectScripts();
  await loadWizardDatasets();
  if (typeof scriptBuilderMode !== 'undefined' && scriptBuilderMode === 'edit') {
    await loadEditDatasets(true);
  }
  try {
    const res = await request('/api/builder/actions');
    builderPresetActions = res.presetActions || [];
    renderPresetLibrary();
    renderBuilderSteps();
    await compileBuilderScenario();
  } catch (err) {
    console.error('Lỗi khởi tạo Visual Builder:', err);
  }
}

window.initBlankStarterSteps = function () {
  if ($('#builder-feature-name') && !$('#builder-feature-name').value) {
    $('#builder-feature-name').value = 'Tính năng kiểm thử mới';
  }
  if ($('#builder-scenario-name') && !$('#builder-scenario-name').value) {
    $('#builder-scenario-name').value = 'Kịch bản kiểm thử quy trình cơ bản';
  }
  builderSteps = [
    { id: `s_${Date.now()}_1`, stepType: 'Given', title: 'Người dùng truy cập trang chủ', actionId: 'navigate_url' },
    { id: `s_${Date.now()}_2`, stepType: 'When', title: 'Người dùng thực hiện hành động kiểm thử', actionId: 'click_element' },
    { id: `s_${Date.now()}_3`, stepType: 'Then', title: 'Hệ thống hiển thị kết quả mong đợi', actionId: 'assert_visible' },
  ];
  renderBuilderSteps();
  compileBuilderScenario();
  notify('Đã khởi tạo khung 3 bước cơ bản.');
};

function initVisualBuilderControls() {
  // Subtabs switching
  document.querySelectorAll('.script-subtab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.script-subtab').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');

      const targetSubtab = tabBtn.dataset.subtab;
      document.querySelectorAll('.script-pane').forEach((pane) => {
        pane.classList.remove('active');
        pane.setAttribute('hidden', 'true');
      });

      const activePane = document.getElementById(`script-pane-${targetSubtab}`);
      if (activePane) {
        activePane.classList.add('active');
        activePane.removeAttribute('hidden');
      }
    });
  });

  // Filter buttons (Desktop, Mobile, API, Setup)
  document.querySelectorAll('.script-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.script-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scriptPlatformFilter = btn.dataset.platform || 'desktop';
      renderScriptSidebarList();
    });
  });

  // Search input
  const searchInput = document.getElementById('script-search-input');
  searchInput?.addEventListener('input', (e) => {
    scriptSearchQuery = e.target.value;
    renderScriptSidebarList();
  });

  // Refresh button
  document.getElementById('script-refresh-btn')?.addEventListener('click', () => {
    loadProjectScripts();
    notify('Đã làm mới danh sách kịch bản.');
  });

  // Run this test directly
  document.getElementById('script-run-this-btn')?.addEventListener('click', async () => {
    if (!currentSelectedScript) {
      notify('Vui lòng chọn một kịch bản test trước khi chạy.');
      return;
    }

    if (currentRun && currentRun.status === 'running') {
      notify('⚠️ Đang có kịch bản test đang chạy. Đang chuyển sang tab Chạy test để bạn quan sát.');
      const runnerTab = document.querySelector('.view-tab[data-view="runner-view"]');
      if (runnerTab) runnerTab.click();
      return;
    }

    const targetSpecPath = currentSelectedScript.relativePath;
    const targetSpecName = currentSelectedScript.fileName;

    // 1. Chuyển sang tab "Chạy test" (runner-view)
    const runnerTab = document.querySelector('.view-tab[data-view="runner-view"]');
    if (runnerTab) runnerTab.click();

    // 2. Chuyển sang chế độ Tùy chỉnh (manual)
    setRunnerMode('manual');

    // 3. Chọn phạm vi chạy: 1 File test
    const scopeFileBtn = document.querySelector('.runner-scope-tab-btn[data-manual-scope="file"]');
    if (scopeFileBtn) scopeFileBtn.click();

    // 4. Đồng bộ config specs nếu cần
    if (!testCatalog.specs || testCatalog.specs.length === 0) {
      try {
        const cfg = await request('/api/config');
        testCatalog = {
          specs: cfg.specs || [],
          specTags: cfg.specTags || {},
          availableTags: cfg.availableTags || [],
          specProjects: cfg.specProjects || {},
          projects: cfg.projects || [],
        };
        refreshSpecOptions();
      } catch (e) {}
    }

    // 5. Chọn đúng file test trong dropdown #spec
    const specSelect = document.getElementById('spec');
    if (specSelect) {
      let exists = Array.from(specSelect.options).some((o) => o.value === targetSpecPath);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = targetSpecPath;
        opt.textContent = targetSpecPath;
        specSelect.appendChild(opt);
      }
      specSelect.value = targetSpecPath;
      if (typeof updateWorkersForSpec === 'function') updateWorkersForSpec();
      if (typeof updateManualSpecsPreview === 'function') updateManualSpecsPreview();
    }

    notify(`🚀 Đang chuyển sang tab Chạy test và khởi chạy kịch bản: ${targetSpecName}...`);

    // 6. Tự động kích hoạt chạy test ngay lập tức!
    setTimeout(() => {
      const runForm = document.getElementById('run-form');
      if (runForm) {
        runForm.requestSubmit();
      }
    }, 250);
  });

  // Auto Inject Evidence Capture
  async function triggerAutoEvidenceCapture() {
    if (!currentSelectedScript) {
      notify('Vui lòng chọn một kịch bản test trước khi thực hiện.');
      return;
    }
    const editor = document.getElementById('script-spec-editor');
    const preview = document.getElementById('script-spec-code');
    const badge = document.getElementById('script-spec-status-badge');
    const revertBtn = document.getElementById('script-spec-revert-btn');
    const currentCode = editor && editor.value ? editor.value : (currentSelectedScript.specCode || '');

    const autoBtns = [
      document.getElementById('script-auto-capture-btn'),
      document.getElementById('script-spec-auto-capture-btn'),
    ].filter(Boolean);

    autoBtns.forEach((btn) => {
      btn.disabled = true;
      btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang phân tích...';
    });

    try {
      const res = await request('/api/builder/auto-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specCode: currentCode,
          filePath: currentSelectedScript.relativePath,
        }),
      });

      if (res.alreadyOptimal || (res.addedCount === 0 && res.removedCount === 0)) {
        notify('👌 Kịch bản đã có đầy đủ các mốc capture evidence chuẩn, không phát hiện điểm trùng lặp!');
      } else {
        if (editor) editor.value = res.modifiedCode;
        if (preview) preview.innerHTML = highlightCode(res.modifiedCode, false);
        if (badge) {
          badge.innerHTML = `<i class="ph-bold ph-camera"></i> Đã chèn ${res.addedCount} mốc evidence${res.removedCount > 0 ? ` (xóa ${res.removedCount} điểm trùng)` : ''}`;
          badge.style.display = 'inline-flex';
        }
        if (revertBtn) revertBtn.style.display = 'inline-flex';

        // Tự động chuyển người dùng sang subtab "Mã nguồn .spec.js" để xem diff trực quan
        const specSubtab = document.querySelector('.script-subtab[data-subtab="spec-code"]');
        if (specSubtab) specSubtab.click();

        notify(`📸 Đã tự động chèn ${res.addedCount} mốc capture evidence chuẩn vào script! Hãy bấm "Lưu thay đổi" để hoàn tất.`);
      }
    } catch (err) {
      notify(`❌ Lỗi phân tích evidence: ${err.message}`);
    } finally {
      autoBtns.forEach((btn) => {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph-bold ph-camera"></i> Tự động chèn Evidence';
      });
    }
  }

  document.getElementById('script-auto-capture-btn')?.addEventListener('click', triggerAutoEvidenceCapture);
  document.getElementById('script-spec-auto-capture-btn')?.addEventListener('click', triggerAutoEvidenceCapture);

  // Copy Spec code
  document.getElementById('script-spec-copy-btn')?.addEventListener('click', () => {
    const editor = document.getElementById('script-spec-editor');
    const code = editor ? editor.value : (currentSelectedScript?.specCode || '');
    if (code) {
      navigator.clipboard.writeText(code);
      notify('Đã sao chép mã BDD Spec vào bộ nhớ tạm!');
    }
  });

  // Initialize Shared Code Editors for Spec Code and Page Object Modal
  window.specCodeEditor = createSharedCodeEditor({
    textarea: document.getElementById('script-spec-editor'),
    preview: document.getElementById('script-spec-code'),
    language: 'javascript',
    badge: document.getElementById('script-spec-status-badge'),
    revertBtn: document.getElementById('script-spec-revert-btn'),
    copyBtn: document.getElementById('script-spec-copy-btn'),
    saveBtn: document.getElementById('script-spec-save-btn'),
    formatBtn: document.getElementById('script-spec-format-btn'),
    onFormat: (editor) => {
      try {
        const currentCode = editor.getValue();
        const formatted = formatJavaScriptCode(currentCode);
        editor.setValue(formatted, { markClean: false });
        notify('✨ Đã định dạng mã nguồn BDD Spec (.spec.js) chuẩn Playwright!');
      } catch (err) {
        notify('Không thể định dạng mã nguồn: ' + err.message);
      }
    },
    onSave: async (editor) => {
      if (!currentSelectedScript) {
        notify('Vui lòng chọn một kịch bản test trước khi lưu.');
        return;
      }
      const saveBtn = document.getElementById('script-spec-save-btn');
      const originalText = saveBtn ? saveBtn.innerHTML : '';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang lưu...';
      }

      try {
        const content = editor.getValue();
        await request('/api/code', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: currentSelectedScript.relativePath,
            content,
          }),
        });

        currentSelectedScript.specCode = content;
        editor.markSaved();
        notify(`✅ Đã lưu kịch bản ${currentSelectedScript.fileName} thành công!`);

        try {
          const scriptsRes = await request('/api/builder/scripts');
          if (scriptsRes?.scripts) {
            projectScripts = scriptsRes.scripts;
            const updated = projectScripts.find((s) => s.id === currentSelectedScript.id);
            if (updated) {
              currentSelectedScript = updated;
              const bddCount = document.getElementById('pillar-bdd-count');
              const steps = updated.steps || [];
              if (bddCount) bddCount.textContent = `${steps.length} bước BDD`;
              const timelineEl = document.getElementById('pillar-bdd-timeline');
              if (timelineEl) {
                if (steps.length === 0) {
                  timelineEl.innerHTML = '<div style="color: var(--muted); font-size: 13px;">Chưa có bước BDD nào được định nghĩa trong file này.</div>';
                } else {
                  timelineEl.innerHTML = steps
                    .map((st) => {
                      const type = (st.stepType || 'When').toLowerCase();
                      return `
                      <div class="bdd-step-unit">
                        <span class="bdd-step-type-pill ${type}">${escapeHtml(st.stepType || 'When')}</span>
                        <div class="bdd-step-title">${escapeHtml(st.title)}</div>
                      </div>`;
                    })
                    .join('');
                }
              }
            }
          }
        } catch (_) {}
      } catch (err) {
        notify(`❌ Lỗi khi lưu mã kịch bản: ${err.message}`);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalText;
        }
      }
    },
  });

  window.pageCodeEditor = createSharedCodeEditor({
    textarea: document.getElementById('modal-page-editor'),
    preview: document.getElementById('modal-page-code'),
    language: 'javascript',
    badge: document.getElementById('modal-page-dirty-badge'),
    saveBtn: document.getElementById('modal-page-save-btn'),
    onSave: async (editor) => {
      const modalPath = document.getElementById('modal-page-path')?.textContent || currentModalPagePath;
      if (!modalPath) return;
      try {
        await request('/api/code', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: modalPath, content: editor.getValue() }),
        });
        currentModalPageOriginalContent = editor.getValue();
        editor.markSaved();
        notify('✅ Đã lưu thay đổi Page Object!');
      } catch (err) {
        notify(`❌ Lỗi lưu Page Object: ${err.message}`);
      }
    },
  });

  const pageModalEl = document.getElementById('modal-view-page-code');
  pageModalEl?.addEventListener('click', (e) => {
    if (e.target === pageModalEl) pageModalEl.close();
  });

  // POM to BDD Linker Event Listeners
  document.getElementById('btn-add-step-from-pom')?.addEventListener('click', () => openInsertPomActionModal());
  document.getElementById('btn-link-pom-to-script')?.addEventListener('click', () => openInsertPomActionModal());
  document.getElementById('script-spec-insert-pom-btn')?.addEventListener('click', () => openInsertPomActionModal());
  document.getElementById('btn-tab-script-inspect')?.addEventListener('click', () => switchToInspectScriptMode());
  document.getElementById('btn-tab-script-edit')?.addEventListener('click', () => switchToEditScriptMode());
  document.getElementById('btn-tab-script-create')?.addEventListener('click', () => switchToCreateScriptMode());
  document.getElementById('btn-save-draft-script')?.addEventListener('click', () => saveWizardDraft(true));
  document.getElementById('btn-reset-create-script')?.addEventListener('click', () => resetWizardToDefaults(false));
  document.getElementById('btn-sidebar-create-script')?.addEventListener('click', () => switchToCreateScriptMode());
  document.getElementById('script-edit-this-btn')?.addEventListener('click', () => switchToEditScriptMode());
  document.getElementById('btn-edit-script-info')?.addEventListener('click', () => switchToEditScriptMode('info'));
  document.getElementById('btn-edit-script-steps')?.addEventListener('click', () => switchToEditScriptMode('steps'));
  const handleCancelScriptEdit = () => {
    const editor = document.getElementById('script-spec-editor');
    const isDirty = editor && currentSelectedScript && editor.value !== (currentSelectedScript.specCode || '');
    if (isDirty) {
      notify('↩️ Đã hoàn tác mọi thay đổi chưa lưu, khôi phục kịch bản gốc từ đĩa.');
    }
    switchToInspectScriptMode();
  };
  document.getElementById('btn-cancel-edit-script')?.addEventListener('click', handleCancelScriptEdit);
  document.getElementById('btn-cancel-edit-script-2')?.addEventListener('click', handleCancelScriptEdit);
  document.getElementById('btn-save-edit-script')?.addEventListener('click', () => saveEditedScript());
  document.getElementById('btn-save-edit-script-2')?.addEventListener('click', () => saveEditedScript());
  document.getElementById('btn-cancel-create-script')?.addEventListener('click', () => {
    saveWizardDraft(false);
    switchToInspectScriptMode();
  });
  document.getElementById('btn-cancel-create-script-2')?.addEventListener('click', () => {
    saveWizardDraft(false);
    switchToInspectScriptMode();
  });
  document.getElementById('btn-wizard-open-create-pom')?.addEventListener('click', () => {
    navigateToCreatePageObjectFromWizard();
  });

  // Quick step add in edit mode
  document.querySelectorAll('.btn-quick-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type || 'When';
      editableSteps.push({
        id: `s_${Date.now()}`,
        stepType: type,
        title: `Bước kiểm thử mới (${type})`,
        code: `      // Thao tác kiểm thử cho ${type}`,
      });
      renderEditableSteps();
      updateEditScriptPreview();
    });
  });

  // BDD Script Spec Edit Mode Toggle & Copy
  document.getElementById('script-btn-toggle-edit')?.addEventListener('click', () => {
    scriptDirectEditMode = !scriptDirectEditMode;
    const stage = document.getElementById('script-code-stage');
    const editor = document.getElementById('script-spec-editor');
    const viewWrap = document.getElementById('script-code-view-wrap');
    const saveBtn = document.getElementById('script-spec-save-btn');
    const editBtnText = document.getElementById('script-edit-btn-text');
    const statusPill = document.getElementById('script-spec-status-badge');

    if (scriptDirectEditMode) {
      if (stage) stage.classList.add('editing');
      if (editor) {
        editor.removeAttribute('readonly');
        if (viewWrap) {
          editor.scrollTop = viewWrap.scrollTop;
          editor.scrollLeft = viewWrap.scrollLeft;
        }
        editor.focus();
      }
      if (saveBtn) saveBtn.style.display = 'inline-flex';
      if (editBtnText) editBtnText.textContent = 'Xem mã';
      if (statusPill) {
        statusPill.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Đang chỉnh sửa';
        statusPill.classList.add('modified');
      }
    } else {
      if (stage) stage.classList.remove('editing');
      if (editor) {
        editor.setAttribute('readonly', 'true');
        if (viewWrap) {
          viewWrap.scrollTop = editor.scrollTop;
          viewWrap.scrollLeft = editor.scrollLeft;
        }
      }
      if (saveBtn) saveBtn.style.display = 'none';
      if (editBtnText) editBtnText.textContent = 'Chỉnh sửa';
      if (statusPill) {
        const isDirty = currentSelectedScript && editor && editor.value !== (currentSelectedScript.specCode || '');
        statusPill.innerHTML = isDirty ? '<i class="ph-bold ph-pencil-simple"></i> Đã thay đổi (chưa lưu)' : '<i class="ph-bold ph-check"></i> Đang mở từ disk';
        statusPill.classList.toggle('modified', isDirty);
      }
    }
  });

  document.getElementById('script-spec-copy-btn')?.addEventListener('click', () => {
    const code = document.getElementById('script-spec-editor')?.value || currentSelectedScript?.specCode || '';
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        notify('📋 Đã sao chép mã kịch bản BDD vào clipboard!');
      }).catch(() => {
        notify('Không thể sao chép mã.');
      });
    }
  });

  initPomModalControls();
  document.getElementById('btn-submit-create-script')?.addEventListener('click', () => submitCreateBddScript());

  // Quick add buttons
  document.querySelectorAll('.btn-quick-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type || 'When';
      builderSteps.push({
        id: `s_${Date.now()}`,
        stepType: type,
        title: `Bước ${builderSteps.length + 1}`,
        actionId: type === 'Then' ? 'assert_visible' : 'click_element',
      });
      renderBuilderSteps();
      compileBuilderScenario();
    });
  });

  $('#builder-new-scenario-btn')?.addEventListener('click', () => {
    if (confirm('Bạn có muốn tạo một kịch bản mới hoàn toàn?')) {
      if ($('#builder-feature-name')) $('#builder-feature-name').value = '';
      if ($('#builder-scenario-name')) $('#builder-scenario-name').value = '';
      if ($('#builder-tags')) $('#builder-tags').value = '@smoke @e2e @visualBuilder';
      if ($('#builder-template-select')) $('#builder-template-select').value = 'custom';
      builderSteps = [];
      renderBuilderSteps();
      compileBuilderScenario();
      notify('Đã đưa về trạng thái tạo kịch bản mới (trống).');
    }
  });

  $('#builder-copy-code-btn')?.addEventListener('click', () => {
    const code = rawCompiledBddCode || $('#builder-compiled-code')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code);
      notify('Đã sao chép mã BDD Spec vào clipboard!');
    }
  });

  $('#builder-preview-btn')?.addEventListener('click', compileBuilderScenario);
  $('#builder-save-btn')?.addEventListener('click', saveBuilderScenario);

  $('#builder-feature-name')?.addEventListener('input', compileBuilderScenario);
  $('#builder-scenario-name')?.addEventListener('input', compileBuilderScenario);
  $('#builder-platform')?.addEventListener('change', compileBuilderScenario);
  $('#builder-tags')?.addEventListener('input', compileBuilderScenario);

  $('#builder-template-select')?.addEventListener('change', async (e) => {
    const val = e.target.value;

    // 1. Nạp file spec có sẵn trong Framework
    if (val.startsWith('spec:')) {
      const specPath = val.replace(/^spec:/, '');
      try {
        const parsed = await request(`/api/builder/load-spec?file=${encodeURIComponent(specPath)}`);
        if ($('#builder-feature-name')) $('#builder-feature-name').value = parsed.featureName || '';
        if ($('#builder-scenario-name')) $('#builder-scenario-name').value = parsed.scenarioName || '';
        if ($('#builder-platform')) $('#builder-platform').value = parsed.platform || 'desktop';
        if ($('#builder-tags')) $('#builder-tags').value = parsed.tags || '@visualBuilder';
        if ($('#builder-data-source')) {
          $('#builder-data-source').value = parsed.dataSource || 'none';
        }
        builderLoadedFixtures = parsed.fixtures || [];
        builderSteps = parsed.steps || [];
        renderBuilderSteps();
        compileBuilderScenario();
        renderNonTechOverview();
        notify(`Đã nạp file test: ${parsed.filePath} (${builderSteps.length} bước)`);
      } catch (err) {
        notify(`Lỗi nạp file test: ${err.message}`);
      }
      return;
    }

    // 2. Tự tạo kịch bản mới (Trống)
    if (val === 'custom') {
      if ($('#builder-feature-name')) $('#builder-feature-name').value = '';
      if ($('#builder-scenario-name')) $('#builder-scenario-name').value = '';
      if ($('#builder-tags')) $('#builder-tags').value = '@smoke @e2e @visualBuilder';
      builderSteps = [];
      renderBuilderSteps();
      compileBuilderScenario();
      return;
    }

    // 3. Các mẫu kịch bản có sẵn
    if (val === 'apply_nocv') {
      if ($('#builder-feature-name')) $('#builder-feature-name').value = 'Ứng tuyển nhanh việc làm không cần CV';
      if ($('#builder-scenario-name')) $('#builder-scenario-name').value = 'Người dùng nộp hồ sơ mini profile và kiểm tra danh sách đã ứng tuyển';
      if ($('#builder-tags')) $('#builder-tags').value = '@applyjob @e2e @visualBuilder';
      builderSteps = [
        { id: 's_1', stepType: 'Given', title: 'Người dùng đã truy cập trang chủ và đăng nhập', actionId: 'auth_login_precondition' },
        { id: 's_2', stepType: 'And', title: 'Người dùng thấy popup Onboarding và đóng', actionId: 'close_onboarding_popup' },
        { id: 's_3', stepType: 'When', title: 'Người dùng mở việc làm không cần CV', actionId: 'open_nocv_job_list' },
        { id: 's_4', stepType: 'And', title: 'Người dùng nộp hồ sơ ứng tuyển nhanh với SĐT ngẫu nhiên', actionId: 'apply_fast_profile' },
        { id: 's_5', stepType: 'Then', title: 'Hệ thống thông báo nộp hồ sơ thành công', actionId: 'assert_apply_success' },
      ];
    } else if (val === 'login_profile') {
      if ($('#builder-feature-name')) $('#builder-feature-name').value = 'Đăng nhập & Cập nhật hồ sơ';
      if ($('#builder-scenario-name')) $('#builder-scenario-name').value = 'Người dùng đăng nhập tài khoản và cập nhật thông tin cá nhân';
      if ($('#builder-tags')) $('#builder-tags').value = '@profile @smoke @visualBuilder';
      builderSteps = [
        { id: 's_1', stepType: 'Given', title: 'Người dùng đã truy cập trang chủ và đăng nhập', actionId: 'auth_login_precondition' },
        { id: 's_2', stepType: 'When', title: 'Người dùng mở trang quản lý hồ sơ cá nhân', actionId: 'navigate_to_page' },
        { id: 's_3', stepType: 'Then', title: 'Hệ thống hiển thị đúng thông tin người dùng', actionId: 'assert_element_visible' },
      ];
    } else if (val === 'job_search') {
      if ($('#builder-feature-name')) $('#builder-feature-name').value = 'Kiểm tra luồng đăng nhập và điều hướng';
      if ($('#builder-scenario-name')) $('#builder-scenario-name').value = 'Truy cập trang web và thao tác tương tác';
      if ($('#builder-tags')) $('#builder-tags').value = '@smoke @regression @visualBuilder';
      builderSteps = [
        { id: 's_1', stepType: 'Given', title: 'Người dùng truy cập trang chủ hệ thống', actionId: 'navigate_to_page' },
        { id: 's_2', stepType: 'When', title: 'Người dùng nhập dữ liệu vào ô tìm kiếm', actionId: 'input_text' },
        { id: 's_3', stepType: 'And', title: 'Người dùng nhấn nút Xác nhận', actionId: 'click_element' },
        { id: 's_4', stepType: 'Then', title: 'Kết quả hiển thị chính xác', actionId: 'assert_element_visible' },
      ];
    }
    renderBuilderSteps();
    compileBuilderScenario();
    renderNonTechOverview();
  });

  $('#builder-data-source')?.addEventListener('change', () => {
    renderNonTechOverview();
    compileBuilderScenario();
  });

  document.querySelectorAll('.builder-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.builder-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;

      $('#builder-tab-nontech')?.setAttribute('hidden', 'true');
      $('#builder-tab-code')?.setAttribute('hidden', 'true');
      $('#builder-tab-library')?.setAttribute('hidden', 'true');

      if (tab === 'nontech') {
        $('#builder-tab-nontech')?.removeAttribute('hidden');
        renderNonTechOverview();
      } else if (tab === 'code') {
        $('#builder-tab-code')?.removeAttribute('hidden');
      } else if (tab === 'library') {
        $('#builder-tab-library')?.removeAttribute('hidden');
      }
    });
  });
}

async function initPlanThreeControls() {
  document.getElementById('diagnostics-analyze-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('diagnostics-error-input');
    const results = document.getElementById('diagnostics-results');
    if (!input?.value.trim()) return notify('Vui lòng dán lỗi hoặc stack trace.');
    try {
      const result = await request('/api/diagnostics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: input.value, testTitle: currentRun?.options?.spec || '' }),
      });
      results.innerHTML = result.findings.map((finding) => `
        <article class="diagnostic-finding">
          <strong>${escapeHtml(finding.code)}</strong>
          <p>${escapeHtml(finding.message)}</p>
          <small>Confidence: ${Math.round(finding.confidence * 100)}%</small>
          ${finding.suggestedFix ? `<div class="diagnostic-fix-preview">Preview: ${escapeHtml(finding.suggestedFix.preview)}</div>` : ''}
        </article>`).join('');
    } catch (error) {
      results.textContent = error.message;
    }
  });
}

let builderLoadedFixtures = [];

function renderNonTechOverview() {
  const dataSelect = $('#builder-data-source');
  const selectedData = dataSelect?.value || 'none';
  
  // 1. Data Details
  const dataBadge = $('#nontech-data-badge');
  const dataDetails = $('#nontech-data-details');
  if (dataBadge) dataBadge.textContent = selectedData !== 'none' ? selectedData : 'Không dùng data ngoài';

  const dataMap = {
    'applyJobData.json': {
      title: 'Hồ sơ ứng viên nộp nhanh (applyJobData.json)',
      desc: 'Chứa các trường: <code>fullName</code>, <code>phone</code>, <code>birthYear</code>, <code>location</code>, <code>experience</code>, <code>education</code>. Dùng cho luồng nộp hồ sơ không cần CV.',
    },
    'users.json': {
      title: 'Tài khoản người dùng chuẩn (users.json)',
      desc: 'Chứa các trường: <code>phone</code>, <code>password</code>, <code>otp</code>, <code>fullName</code>. Dùng cho luồng đăng ký/đăng nhập.',
    },
    'userProfileData.json': {
      title: 'Thông tin hồ sơ cá nhân đầy đủ (userProfileData.json)',
      desc: 'Chứa các trường: <code>fullName</code>, <code>jobTitle</code>, <code>bio</code>, <code>skills</code>. Dùng cho luồng cập nhật hồ sơ người tìm việc.',
    },
    'onboardingData.json': {
      title: 'Khảo sát Onboarding sau đăng nhập (onboardingData.json)',
      desc: 'Chứa các trường: <code>preferredJobs</code>, <code>careerLevel</code>, <code>salaryExpectation</code>.',
    },
    'aiProfileData.json': {
      title: 'Dữ liệu AI gợi ý hồ sơ (aiProfileData.json)',
      desc: 'Chứa các trường: <code>keywords</code>, <code>matchScore</code>, <code>extractedSkills</code>.',
    },
    'dynamic': {
      title: 'Dữ liệu ngẫu nhiên (Fakers)',
      desc: 'Tự động tạo số điện thoại ngẫu nhiên <code>generateRandomVNPhone()</code>, email <code>generateRandomEmail()</code> mỗi lần chạy.',
    },
    'none': {
      title: 'Không ràng buộc file data ngoài',
      desc: 'Kịch bản thao tác tĩnh trực tiếp trên giao diện trình duyệt.',
    },
  };

  const currentDataInfo = dataMap[selectedData] || { title: selectedData, desc: `Sử dụng file <code>data/${escapeHtml(selectedData)}</code>.` };
  if (dataDetails) {
    dataDetails.innerHTML = `
      <div style="font-weight: 700; color: var(--text); font-size: 13px; margin-bottom: 4px;">
        <i class="ph-bold ph-check-circle" style="color: var(--accent);"></i> ${escapeHtml(currentDataInfo.title)}
      </div>
      <p class="nontech-text-muted" style="margin: 0; line-height: 1.5;">${currentDataInfo.desc}</p>
    `;
  }

  // 2. Page Objects Identification
  const pagesList = $('#nontech-pages-list');
  const pagesCount = $('#nontech-pages-count');
  const detectedPages = new Map();

  const fixtureMap = {
    samplePage: { icon: 'ph-browsers', label: 'Trang mẫu (SamplePage.js)' },
    sampleMobilePage: { icon: 'ph-device-mobile', label: 'Trang di động mẫu (SampleMobilePage.js)' },
    authenticatedUser: { icon: 'ph-user-check', label: 'Precondition Đăng Nhập Sẵn' },
  };

  // Check loaded fixtures first
  if (builderLoadedFixtures && builderLoadedFixtures.length > 0) {
    builderLoadedFixtures.forEach((fix) => {
      const formatted = fix.charAt(0).toUpperCase() + fix.slice(1);
      const info = fixtureMap[fix] || { icon: 'ph-browsers', label: `${formatted}.js` };
      detectedPages.set(fix, { icon: info.icon, label: info.label, count: 1 });
    });
  }

  // Also check step contents
  builderSteps.forEach((step) => {
    const act = builderPresetActions.find((a) => a.id === step.actionId);
    if (act?.fixture) {
      const fix = act.fixture.trim();
      const formatted = fix.charAt(0).toUpperCase() + fix.slice(1);
      const cur = detectedPages.get(fix) || { icon: 'ph-browsers', label: `${formatted}.js`, count: 0 };
      cur.count += 1;
      detectedPages.set(fix, cur);
    }
  });

  if (detectedPages.size === 0) {
    detectedPages.set('defaultPage', { icon: 'ph-browsers', label: 'Màn hình kiểm thử', count: 1 });
  }

  if (pagesCount) pagesCount.textContent = `${detectedPages.size} màn hình`;
  if (pagesList) {
    pagesList.innerHTML = Array.from(detectedPages.values())
      .map(
        (p) => `
        <div class="nontech-page-chip">
          <i class="ph-bold ${p.icon}"></i>
          <span>${escapeHtml(p.label)}</span>
        </div>`
      )
      .join('');
  }

  // 3. Execution Summary & Quick Run
  const execEl = $('#nontech-execution-details');
  const typeBadge = $('#nontech-scenario-type-badge');
  const platform = $('#builder-platform')?.value || 'desktop';
  const tags = $('#builder-tags')?.value || '@e2e';

  if (typeBadge) {
    typeBadge.textContent = `${builderSteps.length} bước BDD`;
  }

  if (execEl) {
    execEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">
          <span style="color: var(--muted);"><i class="ph-bold ph-browsers"></i> Môi trường thực thi:</span>
          <strong style="color: var(--text);">${platform === 'mobile-web' ? '📱 Mobile Web (Pixel 5)' : '💻 Desktop Web (Chromium)'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">
          <span style="color: var(--muted);"><i class="ph-bold ph-tag"></i> Nhãn phân loại:</span>
          <span style="color: var(--accent); font-weight: 600;">${escapeHtml(tags)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">
          <span style="color: var(--muted);"><i class="ph-bold ph-list-checks"></i> Quy mô kịch bản:</span>
          <strong style="color: var(--text);">${builderSteps.length} bước kiểm thử BDD</strong>
        </div>
        <div style="margin-top: 6px; display: flex; gap: 8px;">
          <button type="button" class="btn-primary-sm" style="flex: 1; padding: 8px 12px;" onclick="window.runBuilderScenarioDirectly()"><i class="ph-bold ph-play"></i> 🚀 Chạy thử kịch bản này ngay</button>
        </div>
      </div>
    `;
  }
}

window.runBuilderScenarioDirectly = async function() {
  const currentBadge = $('#builder-file-path-badge')?.textContent;
  if (!currentBadge || currentBadge.includes('kich-ban-moi')) {
    notify('Vui lòng nhấn "Lưu kịch bản vào Framework" trước khi chạy thử.');
    return;
  }
  // Chuyển sang Tab Runner và cấu hình file test
  const runnerTab = document.querySelector('.nav-item[data-view="runner-view"]');
  if (runnerTab) {
    runnerTab.click();
    if ($('#spec')) {
      $('#spec').value = currentBadge;
    }
    notify(`Đã chuyển sang Test Runner với file: ${currentBadge}. Bạn có thể bấm "Chạy test" ngay!`);
  }
};

function renderPresetLibrary() {
  const container = $('#builder-action-library-list');
  if (!container) return;

  container.innerHTML = builderPresetActions
    .map(
      (act) => `
    <div class="action-lib-item" style="padding: 12px 14px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; background: var(--surface);">
      <div style="font-weight: 700; color: var(--text); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 13px;">${escapeHtml(act.name)}</span>
        <div style="display: flex; gap: 6px; align-items: center;">
          <span class="step-type-badge badge-${act.stepType.toLowerCase()}">${act.stepType}</span>
          <button type="button" class="btn-quick-step btn-quick-${act.stepType.toLowerCase()}" onclick="window.addBuilderStepFromAction('${act.id}')" title="Thêm hành động này vào kịch bản">Thêm</button>
        </div>
      </div>
      <p style="color: var(--muted); font-size: 12px; margin: 0; line-height: 1.4;">${escapeHtml(act.desc || '')}</p>
    </div>`
    )
    .join('');
}

window.addBuilderStepFromAction = function(actionId) {
  const matched = builderPresetActions.find((a) => a.id === actionId);
  if (!matched) return;
  builderSteps.push({
    id: `s_${Date.now()}`,
    stepType: matched.stepType || 'When',
    title: matched.name,
    actionId: matched.id,
  });
  renderBuilderSteps();
  compileBuilderScenario();
  notify(`Đã thêm bước: [${matched.stepType}] ${matched.name}`);
};

function renderBuilderSteps() {
  const container = $('#builder-steps-list');
  const countEl = $('#builder-step-count');
  if (!container) return;

  if (countEl) countEl.textContent = builderSteps.length;

  if (builderSteps.length === 0) {
    container.innerHTML = `
      <div class="builder-empty-state-box">
        <div class="builder-empty-icon"><i class="ph-bold ph-sparkle"></i></div>
        <h4>Kịch bản mới chưa có bước nào</h4>
        <p>Nhấn các nút màu phía trên (<strong>+ Given</strong>, <strong>+ When</strong>, <strong>+ Then</strong>, <strong>+ And</strong>) hoặc chọn tùy chọn khởi tạo nhanh:</p>
        <div class="builder-empty-actions">
          <button type="button" class="btn-primary-sm" onclick="window.initBlankStarterSteps()"><i class="ph-bold ph-magic-wand"></i> Tạo khung 3 bước cơ bản (Given - When - Then)</button>
          <button type="button" class="btn-secondary-sm" onclick="document.getElementById('builder-template-select').value='apply_nocv'; document.getElementById('builder-template-select').dispatchEvent(new Event('change'));"><i class="ph-bold ph-bookmarks"></i> Nạp mẫu: Ứng tuyển không cần CV</button>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = builderSteps
    .map((step, idx) => {
      const typeBadgeClass = `badge-${(step.stepType || 'When').toLowerCase()}`;
      const actionOptions = builderPresetActions
        .map(
          (act) =>
            `<option value="${act.id}" ${act.id === step.actionId ? 'selected' : ''}>[${act.stepType}] ${escapeHtml(act.name)}</option>`
        )
        .join('');

      return `
      <div class="builder-step-card" data-step-id="${step.id}" data-index="${idx}">
        <div class="builder-step-top">
          <span class="step-num-badge">#${idx + 1}</span>
          <select class="builder-step-type-select step-type-badge ${typeBadgeClass}" style="outline: none; cursor: pointer;">
            <option value="Given" ${step.stepType === 'Given' ? 'selected' : ''}>Given</option>
            <option value="When" ${step.stepType === 'When' ? 'selected' : ''}>When</option>
            <option value="Then" ${step.stepType === 'Then' ? 'selected' : ''}>Then</option>
            <option value="And" ${step.stepType === 'And' ? 'selected' : ''}>And</option>
          </select>
          <input type="text" class="builder-step-title-input" value="${escapeHtml(step.title || '')}" placeholder="Mô tả bước kiểm thử (vd: Người dùng nhấn nút Đăng nhập)..." />
          <div class="builder-step-controls">
            <button type="button" class="btn-step-ctrl move-up-btn" title="Di chuyển lên" ${idx === 0 ? 'disabled' : ''}><i class="ph-bold ph-arrow-up"></i></button>
            <button type="button" class="btn-step-ctrl move-down-btn" title="Di chuyển xuống" ${idx === builderSteps.length - 1 ? 'disabled' : ''}><i class="ph-bold ph-arrow-down"></i></button>
            <button type="button" class="btn-step-ctrl clone-step-btn" title="Nhân bản bước này"><i class="ph-bold ph-copy"></i></button>
            <button type="button" class="btn-step-ctrl delete-btn remove-step-btn" title="Xóa bước này"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>
        <div class="builder-step-bottom">
          <select class="builder-step-action-select">
            <option value="">🎯 -- Chọn hành động chuẩn hóa hoặc tự động phân tích --</option>
            ${actionOptions}
          </select>
        </div>
      </div>`;
    })
    .join('');

  container.querySelectorAll('.builder-step-card').forEach((card) => {
    const idx = parseInt(card.dataset.index, 10);
    const step = builderSteps[idx];

    card.querySelector('.builder-step-type-select')?.addEventListener('change', (e) => {
      step.stepType = e.target.value;
      renderBuilderSteps();
      compileBuilderScenario();
    });

    card.querySelector('.builder-step-title-input')?.addEventListener('input', (e) => {
      step.title = e.target.value;
      compileBuilderScenario();
    });

    card.querySelector('.builder-step-action-select')?.addEventListener('change', (e) => {
      step.actionId = e.target.value;
      const matched = builderPresetActions.find((a) => a.id === step.actionId);
      if (matched && (!step.title || step.title.startsWith('Bước '))) {
        step.title = matched.name;
        step.stepType = matched.stepType;
        renderBuilderSteps();
      }
      compileBuilderScenario();
    });

    card.querySelector('.move-up-btn')?.addEventListener('click', () => {
      if (idx > 0) {
        const temp = builderSteps[idx];
        builderSteps[idx] = builderSteps[idx - 1];
        builderSteps[idx - 1] = temp;
        renderBuilderSteps();
        compileBuilderScenario();
      }
    });

    card.querySelector('.move-down-btn')?.addEventListener('click', () => {
      if (idx < builderSteps.length - 1) {
        const temp = builderSteps[idx];
        builderSteps[idx] = builderSteps[idx + 1];
        builderSteps[idx + 1] = temp;
        renderBuilderSteps();
        compileBuilderScenario();
      }
    });

    card.querySelector('.clone-step-btn')?.addEventListener('click', () => {
      const clone = { ...step, id: `s_${Date.now()}`, title: `${step.title} (bản sao)` };
      builderSteps.splice(idx + 1, 0, clone);
      renderBuilderSteps();
      compileBuilderScenario();
      notify(`Đã nhân bản bước #${idx + 1}`);
    });

    card.querySelector('.remove-step-btn')?.addEventListener('click', () => {
      builderSteps.splice(idx, 1);
      renderBuilderSteps();
      compileBuilderScenario();
    });
  });
}

let rawCompiledBddCode = '';

function highlightJsTokens(str) {
  if (!str) return '';

  return str
    .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`|'.*?'|".*?")/g, '<span class="tok-string">$1</span>')
    .replace(/\b(test\.describe|test\.step|test\.slow|test\.setTimeout|test|expect)\b/g, '<span class="tok-api">$1</span>')
    .replace(/\b(const|let|var|async|await|function|return|require|import|from|export|new|class|extends|if|else|try|catch|throw|finally)\b/g, '<span class="tok-keyword">$1</span>')
    .replace(/\b(page|authenticatedUser|samplePage|sampleMobilePage|[a-zA-Z0-9_]+Page|[a-zA-Z0-9_]+Data)\b/g, '<span class="tok-fixture">$1</span>')
    .replace(/\.(toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toHaveURL|toBeEnabled|toBeDisabled|click|fill|waitFor|goto|closeIfVisible|capture|press|selectOption|check|uncheck)\b/g, '.<span class="tok-method">$1</span>')
    .replace(/\b(true|false|null|undefined|\d+)\b/g, '<span class="tok-number">$1</span>');
}

function formatJavaScriptSyntax(code) {
  if (!code) {
    return `<div class="code-line"><span class="line-num">1</span><span class="code-content tok-comment">// Trạng thái kịch bản mới. Thêm các bước ở bên trái để sinh mã BDD tự động.</span></div>`;
  }

  const lines = code.split(/\r?\n/);
  return lines
    .map((rawLine, idx) => {
      let line = escapeHtml(rawLine);

      if (line.includes('//')) {
        const idxComment = line.indexOf('//');
        const beforeComment = highlightJsTokens(line.slice(0, idxComment));
        const commentText = line.slice(idxComment);
        line = `${beforeComment}<span class="tok-comment">${commentText}</span>`;
      } else {
        line = highlightJsTokens(line);
      }

      return `<div class="code-line"><span class="line-num">${idx + 1}</span><span class="code-content">${line || '&nbsp;'}</span></div>`;
    })
    .join('');
}

async function compileBuilderScenario() {
  const featName = $('#builder-feature-name')?.value?.trim() || '';
  const scenName = $('#builder-scenario-name')?.value?.trim() || '';

  if (builderSteps.length === 0 && !featName && !scenName) {
    rawCompiledBddCode = '';
    const codeEl = $('#builder-compiled-code');
    const badgeEl = $('#builder-file-path-badge');
    if (codeEl) {
      codeEl.innerHTML = formatJavaScriptSyntax(
        `// Trạng thái kịch bản mới.\n// Hãy nhập Tên Tính năng, Tên Kịch bản và thêm các bước BDD ở cột bên trái để xem mã Playwright sinh tự động tại đây.`
      );
    }
    if (badgeEl) badgeEl.textContent = 'tests/e2e/desktop/kich-ban-moi.spec.js';
    return;
  }

  const payload = {
    schemaVersion: 1,
    featureName: featName || 'Tính năng kiểm thử mới',
    scenarioName: scenName || 'Kịch bản kiểm thử mới',
    platform: $('#builder-platform')?.value || 'desktop',
    tags: ($('#builder-tags')?.value || '@visualBuilder').split(/\s+/).filter(Boolean),
    steps: builderSteps,
  };

  try {
    const res = await request('/api/builder/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    rawCompiledBddCode = res.specCode || '';
    const codeEl = $('#builder-compiled-code');
    const badgeEl = $('#builder-file-path-badge');
    if (codeEl) codeEl.innerHTML = formatJavaScriptSyntax(res.specCode);
    if (badgeEl) badgeEl.textContent = res.specRelativePath;
  } catch (err) {
    console.error('Lỗi compile BDD:', err);
  } finally {
    renderNonTechOverview();
  }
}

async function saveBuilderScenario() {
  const saveBtn = $('#builder-save-btn');
  if (saveBtn) saveBtn.disabled = true;

  const payload = {
    schemaVersion: 1,
    featureName: $('#builder-feature-name')?.value || 'Visual Feature',
    scenarioName: $('#builder-scenario-name')?.value || 'Scenario',
    platform: $('#builder-platform')?.value || 'desktop',
    tags: ($('#builder-tags')?.value || '@visualBuilder').split(/\s+/).filter(Boolean),
    steps: builderSteps,
    expectedHash: currentSelectedScript?.compiledHash || undefined,
  };

  try {
    const res = await request('/api/builder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    notify(`${res.message} [${res.specPath}]`);
  } catch (err) {
    notify(`Lỗi lưu kịch bản: ${err.message}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// =============================================================================
// THỐNG NHẤT MODAL XÁC NHẬN XÓA (TEST SCRIPT, DATASET, PAGE OBJECT)
// =============================================================================
let pendingDeleteAction = null;

function showConfirmDeleteModal({ title, subtitle, targetName, targetPath, iconClass, message, onConfirm }) {
  const modal = document.getElementById('modal-confirm-delete');
  if (!modal) {
    if (confirm(`Bạn có chắc chắn muốn xóa ${targetName || targetPath}?`)) {
      onConfirm().catch((err) => notify(`Lỗi khi xóa: ${err.message}`));
    }
    return;
  }

  const titleEl = document.getElementById('modal-confirm-delete-title');
  const subEl = document.getElementById('modal-confirm-delete-subtitle');
  const nameEl = document.getElementById('modal-confirm-delete-filename');
  const pathEl = document.getElementById('modal-confirm-delete-filepath');
  const iconEl = document.getElementById('modal-confirm-delete-file-icon');
  const msgEl = document.getElementById('modal-confirm-delete-message');
  const submitBtn = document.getElementById('modal-confirm-delete-submit-btn');

  if (titleEl) titleEl.textContent = title || 'Xác nhận xóa';
  if (subEl) subEl.textContent = subtitle || 'Thao tác này sẽ xóa file khỏi ổ đĩa';
  if (nameEl) nameEl.textContent = targetName || 'Tệp không tên';
  if (pathEl) pathEl.textContent = targetPath || '';
  if (iconEl && iconClass) iconEl.className = iconClass;
  if (msgEl && message) msgEl.innerHTML = message;

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ph-bold ph-trash"></i> Xóa vĩnh viễn';
  }

  pendingDeleteAction = async () => {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang xóa...';
    }
    try {
      await onConfirm();
      modal.close();
    } catch (err) {
      notify(`Lỗi khi xóa: ${err.message}`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-trash"></i> Thử lại';
      }
    }
  };

  modal.showModal();
}

document.getElementById('modal-confirm-delete-submit-btn')?.addEventListener('click', async () => {
  if (typeof pendingDeleteAction === 'function') {
    await pendingDeleteAction();
  }
});

// 1. Xóa Kịch bản Test (BDD Script)
document.getElementById('script-delete-btn')?.addEventListener('click', () => {
  if (!currentSelectedScript) {
    notify('Vui lòng chọn một kịch bản để xóa.');
    return;
  }
  const scriptName = currentSelectedScript.scenarioName || currentSelectedScript.fileName;
  const scriptPath = currentSelectedScript.relativePath || currentSelectedScript.fileName;
  const isMobile = currentSelectedScript.platform === 'mobile-web';

  showConfirmDeleteModal({
    title: 'Xác nhận xóa kịch bản test',
    subtitle: 'Kịch bản Playwright BDD sẽ bị xóa vĩnh viễn khỏi thư mục tests/',
    targetName: scriptName,
    targetPath: scriptPath,
    iconClass: isMobile ? 'ph-bold ph-device-mobile' : 'ph-bold ph-desktop',
    message: `Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa kịch bản <strong>${escapeHtml(currentSelectedScript.fileName)}</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
    onConfirm: async () => {
      const res = await request('/api/builder/delete-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: scriptPath }),
      });
      notify(`🗑️ ${res.message || 'Đã xóa kịch bản thành công!'}`);
      currentSelectedScript = null;
      await loadProjectScripts();
    },
  });
});

// 2. Xóa Tệp Dữ Liệu Test (JSON Dataset)
document.getElementById('data-delete-file-btn')?.addEventListener('click', () => {
  if (!currentDataFile) {
    notify('Vui lòng chọn một tệp dữ liệu để xóa.');
    return;
  }

  showConfirmDeleteModal({
    title: 'Xác nhận xóa tệp dữ liệu',
    subtitle: 'Tệp dữ liệu JSON sẽ bị xóa khỏi thư mục data/',
    targetName: currentDataFile,
    targetPath: `data/${currentDataFile}`,
    iconClass: 'ph-bold ph-database',
    message: `Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa tệp <strong>${escapeHtml(currentDataFile)}</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
    onConfirm: async () => {
      const res = await request('/api/data/delete-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: currentDataFile }),
      });
      notify(`🗑️ ${res.message || 'Đã xóa tệp dữ liệu thành công!'}`);
      currentDataFile = null;
      await loadDataFilesList();
      if (datasetsCache && datasetsCache.length > 0) {
        await selectDataset(datasetsCache[0].fileName);
      }
    },
  });
});

// 3. Xóa Page Object
function handleDeleteCurrentPage() {
  if (!currentInspectedPage) {
    notify('Vui lòng chọn một Page Object để xóa.');
    return;
  }
  if (currentInspectedPage.relativePath === 'pages/BasePage.js') {
    notify('⚠️ Không thể xóa BasePage.js vì đây là lớp nền tảng dùng chung của toàn bộ framework.');
    return;
  }
  if (currentInspectedPage.platform === 'fixture') {
    notify('⚠️ Không thể xóa Fixture nền tảng.');
    return;
  }

  showConfirmDeleteModal({
    title: 'Xác nhận xóa Page Object',
    subtitle: 'Class Page Object sẽ bị xóa khỏi thư mục pages/',
    targetName: `${currentInspectedPage.className}.js`,
    targetPath: currentInspectedPage.relativePath,
    iconClass: 'ph-bold ph-browsers',
    message: `Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa Page Object <strong>${escapeHtml(currentInspectedPage.className)}.js</strong> (${escapeHtml(currentInspectedPage.relativePath)}). Bạn có chắc chắn muốn xóa vĩnh viễn?`,
    onConfirm: async () => {
      const res = await request('/api/object-repository/delete-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: currentInspectedPage.relativePath }),
      });
      notify(`🗑️ ${res.message || 'Đã xóa Page Object thành công!'}`);
      currentInspectedPage = null;
      await openPageManager();
    },
  });
}
document.getElementById('pm-btn-delete-page')?.addEventListener('click', handleDeleteCurrentPage);

// URL query parameter tab router (?tab=settings&subtab=documents)
try {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const subtabParam = urlParams.get('subtab');
  if (tabParam) {
    const tabMap = {
      'ai': 'agent-view',
      'agent': 'agent-view',
      'runner': 'runner-view',
      'recorder': 'recorder-view',
      'data': 'data-view',
      'bdd': 'builder-view',
      'reports': 'resources-view',
      'resources': 'resources-view',
      'suites': 'suites-view',
      'pages': 'page-manager-view',
      'code': 'page-manager-view',
      'framework': 'page-manager-view',
      'compare': 'compare-view',
      'settings': 'settings-view',
      'config': 'settings-view',
      'docs': 'docs-view',
      'guide': 'docs-view',
      'guides': 'docs-view',
      'huongdan': 'docs-view',
      'documents': 'docs-view',
    };
    const targetViewId = tabMap[tabParam.toLowerCase()] || tabParam;
    const tabBtn = document.querySelector(`.view-tab[data-view="${targetViewId}"]`);
    if (tabBtn) {
      tabBtn.click();
      const docParam = urlParams.get('doc');
      if (targetViewId === 'docs-view' && docParam) {
        setTimeout(async () => {
          if (typeof loadDocFile === 'function') {
            await loadDocFile(docParam);
          }
        }, 150);
      } else if (targetViewId === 'settings-view' && subtabParam) {
        setTimeout(() => {
          const subtabBtn = document.querySelector(`.settings-subtab[data-subtab="${subtabParam}"]`);
          if (subtabBtn) subtabBtn.click();
        }, 150);
      }
    }
  }
} catch (e) {
  // Ignored
}

async function openSetupGuide() {
  const docsTab = document.querySelector('.view-tab[data-view="docs-view"]');
  if (docsTab) docsTab.click();
  setTimeout(async () => {
    if (typeof loadDocFile === 'function') {
      await loadDocFile('docs/SETUP_GUIDE.md');
    }
  }, 100);
}

$('#setup-guide-btn')?.addEventListener('click', openSetupGuide);
$('#agent-guide-btn')?.addEventListener('click', openSetupGuide);

async function updateGlobalHeaderTokenQuota() {
  try {
    let clientConfig = null;
    try {
      const rawCfg = localStorage.getItem('qa_studio_ai_personal_config');
      if (rawCfg) {
        const p = JSON.parse(rawCfg);
        if (p && p.enabled && p.apiKey) clientConfig = p;
      }
    } catch {}
    const headers = { 'Content-Type': 'application/json' };
    if (clientConfig) {
      headers['X-AI-Config'] = btoa(unescape(encodeURIComponent(JSON.stringify(clientConfig))));
    }
    const res = await fetch('/api/agent/status', { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data.tokenQuota) {
      const percent = data.tokenQuota.remainingPercent ?? 100;
      const pillPercent = document.getElementById('agent-quota-pill-percent');
      if (pillPercent) pillPercent.textContent = `${percent}%`;
      const pill = document.getElementById('agent-quota-pill');
      if (pill) {
        pill.classList.toggle('is-healthy', percent >= 50);
        pill.classList.toggle('is-warning', percent >= 20 && percent < 50);
        pill.classList.toggle('is-danger', percent < 20);
        pill.title = `Hạn mức Token: ${percent}% còn lại (${data.tokenQuota.modelName || 'AI'}) - Bấm để mở tab AI Agent`;
      }
    }
  } catch (_) {}
}

document.getElementById('agent-quota-pill')?.addEventListener('click', () => {
  document.getElementById('agent-tab')?.click();
});

updateGlobalHeaderTokenQuota();
window.addEventListener('focus', updateGlobalHeaderTokenQuota);

/* ==============================================================================
   SUITES VIEW CONTROLLER (TIỆN ÍCH > KỊCH BẢN TEST SUITE)
============================================================================== */
async function openSuitesManager() {
  initSuitesView();
  if (!settingsCache) {
    try {
      const settings = await request('/api/settings');
      renderSettings(settings);
    } catch (err) {
      console.error('Lỗi tải suites settings:', err);
    }
  } else {
    renderSuitesView(settingsCache.suites || {});
  }
}

document.getElementById('runner-goto-suites-btn')?.addEventListener('click', () => {
  document.querySelector('.nav-dropdown-item[data-view="suites-view"]')?.click();
});

initSuitesView();

/* ==============================================================================
   SYSTEM UPDATER CONTROLLER
============================================================================== */
let systemUpdateInfo = null;

async function checkSystemUpdate(showModalOnComplete = false) {
  const btn = document.getElementById('system-update-btn');
  const dot = document.getElementById('topbar-update-dot');
  const versionLabel = document.getElementById('topbar-version-label');
  const modal = document.getElementById('modal-system-update');

  const curVerEl = document.getElementById('update-current-version-text');
  const latestVerEl = document.getElementById('update-latest-version-text');
  const statusBanner = document.getElementById('update-status-banner');
  const statusMsg = document.getElementById('update-status-message');
  const statusIcon = document.getElementById('update-status-icon');
  const changelogContainer = document.getElementById('update-changelog-container');
  const changelogText = document.getElementById('update-changelog-text');
  const applyBtn = document.getElementById('btn-apply-update');
  const recheckBtn = document.getElementById('btn-recheck-update');

  const latestTag = document.getElementById('update-latest-tag');

  if (recheckBtn) recheckBtn.disabled = true;
  if (statusBanner) {
    statusBanner.removeAttribute('style');
    statusBanner.className = 'update-status-banner is-checking';
  }
  if (statusIcon) statusIcon.className = 'ph-bold ph-spinner animate-spin';
  if (statusMsg) statusMsg.textContent = 'Đang kiểm tra phiên bản từ máy chủ...';

  try {
    const res = await request('/api/system/check-update');
    systemUpdateInfo = res;

    if (versionLabel && res.currentVersion) {
      versionLabel.textContent = `v${res.currentVersion}`;
    }
    if (curVerEl) curVerEl.textContent = `v${res.currentVersion || '1.0.0'}`;
    if (latestVerEl) latestVerEl.textContent = `v${res.latestVersion || res.currentVersion || '1.0.0'}`;

    if (res.hasUpdate) {
      if (dot) dot.style.display = 'block';
      if (btn) {
        btn.classList.add('has-update');
        btn.setAttribute('data-tooltip', `Có bản cập nhật mới: v${res.latestVersion}`);
      }
      if (latestTag) {
        latestTag.textContent = 'Có bản mới!';
        latestTag.className = 'update-ver-pill latest has-update';
      }
      if (statusBanner) {
        statusBanner.className = 'update-status-banner is-update';
      }
      if (statusIcon) statusIcon.className = 'ph-bold ph-sparkle';
      if (statusMsg) statusMsg.textContent = `Đã có bản cập nhật mới v${res.latestVersion}! Bạn có thể tải và cập nhật ngay.`;

      if (changelogContainer) changelogContainer.style.display = 'block';
      if (changelogText) changelogText.textContent = res.releaseNotes || 'Bản phát hành bao gồm các tính năng mới và cải tiến hiệu năng.';
      if (applyBtn) applyBtn.disabled = false;
    } else if (res.isOffline) {
      if (dot) dot.style.display = 'none';
      if (latestTag) {
        latestTag.textContent = 'Offline';
        latestTag.className = 'update-ver-pill latest';
      }
      if (statusBanner) {
        statusBanner.className = 'update-status-banner is-offline';
      }
      if (statusIcon) statusIcon.className = 'ph-bold ph-wifi-slash';
      if (statusMsg) statusMsg.textContent = res.message || 'Không có kết nối Internet. Đang sử dụng phiên bản cục bộ.';
      if (changelogContainer) changelogContainer.style.display = 'none';
      if (applyBtn) applyBtn.disabled = true;
    } else {
      if (dot) dot.style.display = 'none';
      if (latestTag) {
        latestTag.textContent = 'Mới nhất';
        latestTag.className = 'update-ver-pill latest';
      }
      if (statusBanner) {
        statusBanner.className = 'update-status-banner is-latest';
      }
      if (statusIcon) statusIcon.className = 'ph-bold ph-check-circle';
      if (statusMsg) statusMsg.textContent = 'Hệ thống đang ở phiên bản mới nhất. Toàn bộ tính năng đã được đồng bộ.';
      if (changelogContainer) changelogContainer.style.display = 'none';
      if (applyBtn) applyBtn.disabled = true;
    }
  } catch (err) {
    if (statusBanner) statusBanner.className = 'update-status-banner is-offline';
    if (statusIcon) statusIcon.className = 'ph-bold ph-warning-circle';
    if (statusMsg) statusMsg.textContent = 'Lỗi khi kiểm tra phiên bản: ' + err.message;
  } finally {
    if (recheckBtn) recheckBtn.disabled = false;
  }

  if (showModalOnComplete && modal && typeof modal.showModal === 'function') {
    modal.showModal();
  }
}

async function applySystemUpdate() {
  const applyBtn = document.getElementById('btn-apply-update');
  const terminal = document.getElementById('update-log-terminal');
  const terminalBody = document.getElementById('update-terminal-body-text');
  const statusMsg = document.getElementById('update-status-message');
  const statusIcon = document.getElementById('update-status-icon');

  if (applyBtn) applyBtn.disabled = true;
  if (terminal) terminal.style.display = 'block';
  const initMsg = 'Đang tiến hành cập nhật hệ thống...\nVui lòng chờ...';
  if (terminalBody) terminalBody.textContent = initMsg;
  else if (terminal) terminal.textContent = initMsg;

  if (statusMsg) statusMsg.textContent = 'Đang tải và cập nhật phiên bản mới...';
  if (statusIcon) statusIcon.className = 'ph-bold ph-spinner animate-spin';

  try {
    const res = await request('/api/system/apply-update', { method: 'POST' });
    const logOutput = Array.isArray(res.logs) ? res.logs.join('\n') : (res.message || '');
    if (terminalBody) terminalBody.textContent = logOutput;
    else if (terminal) terminal.textContent = logOutput;

    if (res.ok) {
      if (statusMsg) statusMsg.textContent = res.message || 'Cập nhật hoàn tất!';
      if (statusIcon) statusIcon.className = 'ph-bold ph-check-circle';
      showToast('Cập nhật hoàn tất! Vui lòng khởi động lại Dashboard.', 'success');
    } else {
      if (statusMsg) statusMsg.textContent = 'Cập nhật thất bại: ' + (res.message || 'Lỗi không xác định');
      if (statusIcon) statusIcon.className = 'ph-bold ph-warning-circle';
      showToast('Cập nhật thất bại: ' + res.message, 'error');
    }
  } catch (err) {
    const errText = '\nLỗi: ' + err.message;
    if (terminalBody) terminalBody.textContent += errText;
    else if (terminal) terminal.textContent += errText;
    if (statusMsg) statusMsg.textContent = 'Lỗi: ' + err.message;
    showToast('Lỗi khi thực hiện cập nhật: ' + err.message, 'error');
  } finally {
    if (applyBtn) applyBtn.disabled = false;
  }
}

document.getElementById('system-update-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-system-update');
  if (modal && typeof modal.showModal === 'function') {
    modal.showModal();
    checkSystemUpdate(false);
  }
});

document.getElementById('btn-recheck-update')?.addEventListener('click', () => {
  checkSystemUpdate(false);
});

document.getElementById('btn-apply-update')?.addEventListener('click', () => {
  applySystemUpdate();
});

// Tự động kiểm tra phiên bản ngầm khi tải trang sau 2 giây
setTimeout(() => {
  checkSystemUpdate(false);
}, 2000);

/* ==============================================================================
   GIT STUDIO CONTROLLER (Commit, Push, Pull & Whitelist Asset Management)
============================================================================== */
const gitStudioState = {
  status: null,
  selectedFiles: new Set(),
  activeFilter: 'all',
  isQualityGatePassed: true,
  isInitialized: false,
};

function appendGitTerminalLog(text) {
  const terminal = document.getElementById('git-terminal-body');
  if (!terminal) return;
  const timestamp = new Date().toLocaleTimeString('vi-VN');
  terminal.textContent += `\n[${timestamp}] ${text}`;
  terminal.scrollTop = terminal.scrollHeight;
}

function updateGitCommitPreview() {
  const typeEl = document.getElementById('git-commit-type');
  const scopeEl = document.getElementById('git-commit-scope');
  const subjectEl = document.getElementById('git-commit-subject');
  const previewEl = document.getElementById('git-commit-preview-text');
  const featureBranchInput = document.getElementById('git-feature-branch-input');

  if (!previewEl) return;
  const type = typeEl?.value || 'test';
  const scope = (scopeEl?.value || '').trim();
  const subject = (subjectEl?.value || '').trim() || 'cập nhật bài test';
  const prefix = scope ? `${type}(${scope}): ` : `${type}: `;
  previewEl.textContent = `${prefix}${subject}`;

  // Tự động gợi ý tên nhánh Feature khi người dùng nhập scope
  if (gitStudioState.status?.isProtectedBranch && featureBranchInput && scope && (!featureBranchInput.value || featureBranchInput.value.startsWith('feature/'))) {
    const cleanScope = scope.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    featureBranchInput.value = `feature/${cleanScope}`;
  }

  updateGitCommitButtonState();
}

function updateGitCommitButtonState() {
  const btn = document.getElementById('btn-git-commit-push');
  const subjectEl = document.getElementById('git-commit-subject');
  const featureBranchInput = document.getElementById('git-feature-branch-input');
  const btnText = document.getElementById('text-git-commit-push');
  const btnIcon = document.getElementById('icon-git-commit-push');
  if (!btn) return;

  const isProtected = !!gitStudioState.status?.isProtectedBranch;
  const hasFiles = gitStudioState.selectedFiles.size > 0;
  const hasSubject = (subjectEl?.value || '').trim().length > 0;
  const qgOk = gitStudioState.isQualityGatePassed;
  const hasBranchIfProtected = !isProtected || (featureBranchInput?.value || '').trim().length > 0;

  btn.disabled = !(hasFiles && hasSubject && qgOk && hasBranchIfProtected);

  if (btnText && btnIcon) {
    if (isProtected) {
      btnIcon.className = 'ph-bold ph-git-pull-request';
      btnText.textContent = 'Tạo Nhánh & Push Tạo PR';
    } else {
      btnIcon.className = 'ph-bold ph-cloud-arrow-up';
      btnText.textContent = 'Commit & Push Lên Remote';
    }
  }
}

async function loadGitStatus(silent = false) {
  try {
    const res = await request('/api/git/status');
    gitStudioState.status = res;

    // 1. Nhánh & Remote
    const branchNameEl = document.getElementById('git-current-branch-name');
    const topbarBranchLabel = document.getElementById('topbar-git-branch-label');
    const remoteUrlEl = document.getElementById('git-remote-url-text');
    const aheadPill = document.getElementById('git-ahead-pill');
    const behindPill = document.getElementById('git-behind-pill');
    const aheadCount = document.getElementById('git-ahead-count');
    const behindCount = document.getElementById('git-behind-count');
    const syncPill = document.getElementById('git-sync-state-pill');
    const syncText = document.getElementById('git-sync-state-text');
    const syncIcon = document.getElementById('git-sync-state-icon');
    const topbarDot = document.getElementById('topbar-git-sync-dot');
    const protectedCard = document.getElementById('git-protected-card');
    const featureBranchInput = document.getElementById('git-feature-branch-input');

    if (branchNameEl) branchNameEl.textContent = res.currentBranch || 'main';
    if (topbarBranchLabel) topbarBranchLabel.textContent = res.currentBranch || 'main';
    if (remoteUrlEl && res.remoteUrl) {
      const displayUrl = res.remoteUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
      remoteUrlEl.textContent = displayUrl || res.remoteUrl;
    }

    if (aheadCount) aheadCount.textContent = res.ahead || 0;
    if (behindCount) behindCount.textContent = res.behind || 0;
    if (aheadPill) aheadPill.classList.toggle('has-count', (res.ahead || 0) > 0);
    if (behindPill) behindPill.classList.toggle('has-count', (res.behind || 0) > 0);

    // Xử lý cảnh báo Protected Branch
    if (protectedCard) {
      protectedCard.style.display = res.isProtectedBranch ? 'flex' : 'none';
      if (res.isProtectedBranch && featureBranchInput && !featureBranchInput.value) {
        const scopeVal = document.getElementById('git-commit-scope')?.value?.trim();
        featureBranchInput.value = scopeVal ? `feature/${scopeVal.toLowerCase()}` : `feature/test-${new Date().toISOString().slice(5, 10).replace('-', '')}`;
      }
    }

    // Trạng thái đồng bộ (Pill & Dot)
    if (res.behind > 0) {
      if (syncPill) {
        syncPill.className = 'draft-status-pill is-behind';
        syncPill.style.background = 'rgba(245, 158, 11, 0.15)';
        syncPill.style.color = '#d97706';
        syncPill.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }
      if (syncIcon) syncIcon.className = 'ph-bold ph-arrow-down';
      if (syncText) syncText.textContent = `Có ${res.behind} commit mới cần kéo về`;
      if (topbarDot) topbarDot.style.background = '#f59e0b';
    } else if (res.ahead > 0) {
      if (syncPill) {
        syncPill.className = 'draft-status-pill is-ahead';
        syncPill.style.background = 'rgba(10, 101, 204, 0.15)';
        syncPill.style.color = '#0A65CC';
        syncPill.style.borderColor = 'rgba(10, 101, 204, 0.3)';
      }
      if (syncIcon) syncIcon.className = 'ph-bold ph-arrow-up';
      if (syncText) syncText.textContent = `Có ${res.ahead} commit chưa đẩy`;
      if (topbarDot) topbarDot.style.background = '#3b82f6';
    } else if (res.hasChanges) {
      if (syncPill) {
        syncPill.className = 'draft-status-pill is-dirty';
        syncPill.style.background = 'rgba(245, 158, 11, 0.15)';
        syncPill.style.color = '#d97706';
        syncPill.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }
      if (syncIcon) syncIcon.className = 'ph-bold ph-pencil-simple';
      if (syncText) syncText.textContent = res.isProtectedBranch ? 'Có thay đổi (Nhánh main được bảo vệ)' : 'Có thay đổi chưa commit';
      if (topbarDot) topbarDot.style.background = '#f59e0b';
    } else {
      if (syncPill) {
        syncPill.className = 'draft-status-pill is-synced';
        syncPill.style.background = 'rgba(34, 197, 94, 0.15)';
        syncPill.style.color = '#16a34a';
        syncPill.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      }
      if (syncIcon) syncIcon.className = 'ph-bold ph-check-circle';
      if (syncText) syncText.textContent = 'Đã đồng bộ';
      if (topbarDot) topbarDot.style.background = '#22c55e';
    }

    // 2. Cập nhật đếm số lượng tệp theo loại
    const permitted = res.permittedFiles || [];
    const testsCount = permitted.filter((f) => f.category === 'test_script').length;
    const pagesCount = permitted.filter((f) => f.category === 'page_object').length;
    const dataCount = permitted.filter((f) => f.category === 'test_data').length;
    const suitesCount = permitted.filter((f) => f.category === 'test_suite').length;

    const changedCountEl = document.getElementById('git-changed-count');
    if (changedCountEl) changedCountEl.textContent = permitted.length;

    const pAll = document.getElementById('pill-count-all');
    const pTests = document.getElementById('pill-count-tests');
    const pPages = document.getElementById('pill-count-pages');
    const pData = document.getElementById('pill-count-data');
    const pSuites = document.getElementById('pill-count-suites');
    if (pAll) pAll.textContent = permitted.length;
    if (pTests) pTests.textContent = testsCount;
    if (pPages) pPages.textContent = pagesCount;
    if (pData) pData.textContent = dataCount;
    if (pSuites) pSuites.textContent = suitesCount;

    // Mặc định chọn toàn bộ tệp hợp lệ nếu chưa chọn
    if (gitStudioState.selectedFiles.size === 0) {
      permitted.forEach((f) => gitStudioState.selectedFiles.add(f.path));
    } else {
      // Giữ lại các tệp còn tồn tại
      const currentValidPaths = new Set(permitted.map((f) => f.path));
      for (const p of gitStudioState.selectedFiles) {
        if (!currentValidPaths.has(p)) gitStudioState.selectedFiles.delete(p);
      }
    }

    // 3. Render bảng tệp
    renderGitFilesTable();

    // 4. Render danh sách commit gần nhất
    renderGitCommitList(res.recentCommits || []);

    // 5. Render danh sách blocked files (Security Shield)
    renderGitBlockedFiles(res.blockedFiles || []);

    // 6. Cập nhật danh sách branch (dùng res.branches nếu có sẵn để tối ưu tốc độ)
    await loadGitBranches(res.branches);

    // 7. Cập nhật trạng thái nút commit
    updateGitCommitButtonState();

    if (!silent) {
      showToast('Đã làm mới trạng thái kho mã nguồn Git.', 'info');
    }
  } catch (err) {
    console.error('Lỗi khi tải trạng thái Git:', err);
    if (!silent) {
      showToast('Không thể kết nối Git: ' + err.message, 'error');
    }
  }
}

function renderGitFilesTable() {
  const tbody = document.getElementById('git-file-table-body');
  if (!tbody) return;

  const permitted = (gitStudioState.status?.permittedFiles) || [];
  const filter = gitStudioState.activeFilter;

  let filtered = permitted;
  if (filter === 'tests') filtered = permitted.filter((f) => f.category === 'test_script');
  else if (filter === 'pages') filtered = permitted.filter((f) => f.category === 'page_object');
  else if (filter === 'data') filtered = permitted.filter((f) => f.category === 'test_data');
  else if (filter === 'suites') filtered = permitted.filter((f) => f.category === 'test_suite');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="git-empty-row">
          <div class="git-empty-state">
            <i class="ph-bold ph-check-circle" style="color: #22c55e; font-size: 28px;"></i>
            <p>${permitted.length === 0 ? 'Mã nguồn của bạn đang sạch (Clean working tree). Không có thay đổi nào chưa commit.' : 'Không có tệp tin nào thuộc bộ lọc này.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((file) => {
    const isChecked = gitStudioState.selectedFiles.has(file.path) ? 'checked' : '';
    const statusClass = file.status === '??' ? 'status-untracked' : (file.status.includes('M') ? 'status-modified' : (file.status.includes('D') ? 'status-deleted' : 'status-added'));

    return `
      <tr data-filepath="${escapeHtml(file.path)}">
        <td>
          <input type="checkbox" class="git-file-chk" data-path="${escapeHtml(file.path)}" ${isChecked}>
        </td>
        <td>
          <span class="git-cat-badge cat-${escapeHtml(file.color || 'primary')}">
            <i class="ph-bold ${escapeHtml(file.icon || 'ph-file')}"></i>
            ${escapeHtml(file.categoryLabel || file.category)}
          </span>
        </td>
        <td class="git-file-path-cell" title="${escapeHtml(file.path)}">
          ${escapeHtml(file.path)}
        </td>
        <td>
          <span class="git-status-badge ${statusClass}">
            ${escapeHtml(file.statusText || file.status)}
          </span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-icon-subtle btn-view-diff" data-path="${escapeHtml(file.path)}" title="Xem chi tiết Diff">
            <i class="ph-bold ph-file-search"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Gắn sự kiện checkbox
  tbody.querySelectorAll('.git-file-chk').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const filePath = e.target.dataset.path;
      if (e.target.checked) {
        gitStudioState.selectedFiles.add(filePath);
      } else {
        gitStudioState.selectedFiles.delete(filePath);
      }
      updateGitCommitButtonState();
    });
  });

  // Gắn sự kiện nút xem diff
  tbody.querySelectorAll('.btn-view-diff').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filePath = btn.dataset.path;
      if (filePath) viewGitFileDiff(filePath);
    });
  });
}

function renderGitCommitList(commits) {
  const ul = document.getElementById('git-commit-list');
  if (!ul) return;

  if (commits.length === 0) {
    ul.innerHTML = '<li class="git-commit-item-empty">Chưa có commit nào.</li>';
    return;
  }

  ul.innerHTML = commits.map((c) => `
    <li class="git-commit-item">
      <div class="git-commit-meta">
        <span class="git-commit-hash">${escapeHtml(c.hash)}</span>
        <span class="git-commit-time">${escapeHtml(c.timeAgo)} - ${escapeHtml(c.author)}</span>
      </div>
      <div class="git-commit-msg">${escapeHtml(c.subject)}</div>
    </li>
  `).join('');
}

function renderGitBlockedFiles(blockedFiles) {
  const container = document.getElementById('git-blocked-files-list');
  const ul = document.getElementById('git-blocked-items-ul');
  if (!container || !ul) return;

  if (!blockedFiles || blockedFiles.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  ul.innerHTML = blockedFiles.slice(0, 8).map((f) => `
    <li>🛡️ ${escapeHtml(f.path)} (${escapeHtml(f.statusText || 'Bị chặn')})</li>
  `).join('');
}

async function loadGitBranches(providedBranches = null) {
  try {
    let branches = Array.isArray(providedBranches) ? providedBranches : null;
    if (!branches) {
      const res = await request('/api/git/branches');
      if (res.ok && Array.isArray(res.branches)) {
        branches = res.branches;
      }
    }
    const select = document.getElementById('git-branch-select');
    if (!select || !branches) return;

    select.innerHTML = branches
      .filter((b) => !b.isRemote)
      .map((b) => `<option value="${escapeHtml(b.name)}" ${b.isCurrent ? 'selected' : ''}>${escapeHtml(b.name)}${b.isCurrent ? ' (hiện tại)' : ''}</option>`)
      .join('');
  } catch (err) {
    console.warn('Lỗi khi tải danh sách branch:', err);
  }
}

async function viewGitFileDiff(filePath) {
  const diffCard = document.getElementById('git-diff-card');
  const fileNameEl = document.getElementById('git-diff-filename');
  const diffContentEl = document.getElementById('git-diff-content');
  if (!diffCard || !diffContentEl) return;

  if (fileNameEl) fileNameEl.textContent = filePath;
  diffContentEl.textContent = 'Đang tải nội dung diff…';
  diffCard.style.display = 'block';
  diffCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const res = await request('/api/git/diff?file=' + encodeURIComponent(filePath));
    if (res.ok) {
      diffContentEl.textContent = res.diff;
      if (window.Prism && Prism.languages.diff) {
        diffContentEl.innerHTML = Prism.highlight(res.diff, Prism.languages.diff, 'diff');
      }
    } else {
      diffContentEl.textContent = 'Lỗi: ' + (res.error || 'Không thể lấy diff');
    }
  } catch (err) {
    diffContentEl.textContent = 'Lỗi kết nối khi lấy diff: ' + err.message;
  }
}

async function runGitQualityGate() {
  const badge = document.getElementById('git-qg-badge');
  const summary = document.getElementById('git-qg-summary');
  const issuesBox = document.getElementById('git-qg-issues');
  const issuesUl = document.getElementById('git-qg-issues-list');
  const runBtn = document.getElementById('btn-git-run-qg');

  if (badge) {
    badge.className = 'git-qg-badge is-checking';
    badge.textContent = 'Đang kiểm tra…';
  }
  if (runBtn) runBtn.disabled = true;

  try {
    const res = await request('/api/git/quality-check', { method: 'POST' });
    gitStudioState.isQualityGatePassed = !!res.passed;

    if (res.passed) {
      if (badge) {
        badge.className = 'git-qg-badge is-passed';
        badge.textContent = 'Đạt chuẩn';
      }
      if (summary) summary.textContent = res.summary || 'Toàn bộ kịch bản test và Page Objects đều tuân thủ kiến trúc framework.';
      if (issuesBox) issuesBox.style.display = 'none';
      appendGitTerminalLog('✅ Framework Quality Gate: PASSED.');
    } else {
      if (badge) {
        badge.className = 'git-qg-badge is-failed';
        badge.textContent = 'Không đạt';
      }
      if (summary) summary.textContent = 'Phát hiện lỗi vi phạm quy chuẩn framework! Vui lòng khắc phục trước khi commit.';
      if (issuesBox && issuesUl) {
        issuesBox.style.display = 'block';
        issuesUl.innerHTML = (res.issues || []).map((iss) => `<li>${escapeHtml(iss)}</li>`).join('');
      }
      appendGitTerminalLog(`❌ Framework Quality Gate: FAILED (${(res.issues || []).length} lỗi).`);
    }
    updateGitCommitButtonState();
  } catch (err) {
    if (badge) {
      badge.className = 'git-qg-badge is-failed';
      badge.textContent = 'Lỗi';
    }
    if (summary) summary.textContent = 'Lỗi khi kích hoạt bài kiểm tra: ' + err.message;
    gitStudioState.isQualityGatePassed = false;
    updateGitCommitButtonState();
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

async function handleGitPull() {
  const pullBtn = document.getElementById('btn-git-pull');
  const autoStash = !!document.getElementById('git-pull-auto-stash')?.checked;

  if (pullBtn) {
    pullBtn.disabled = true;
    pullBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Đang kéo mã mới…';
  }

  appendGitTerminalLog('Đang thực hiện Git Pull từ remote...');

  try {
    const res = await request('/api/git/pull', {
      method: 'POST',
      body: JSON.stringify({ stashIfDirty: autoStash }),
    });

    if (Array.isArray(res.logs)) {
      res.logs.forEach((l) => appendGitTerminalLog(l));
    }

    if (res.ok) {
      showToast(res.message || 'Kéo mã mới thành công!', 'success');
      appendGitTerminalLog('🎉 Git Pull hoàn tất thành công!');
      await loadGitStatus(true);
    } else {
      showToast(res.message || 'Kéo mã mới thất bại', 'error');
      appendGitTerminalLog('❌ Git Pull thất bại: ' + res.message);
    }
  } catch (err) {
    showToast('Lỗi khi thực hiện Pull: ' + err.message, 'error');
    appendGitTerminalLog('❌ Lỗi ngoại lệ: ' + err.message);
  } finally {
    if (pullBtn) {
      pullBtn.disabled = false;
      pullBtn.innerHTML = '<i class="ph-bold ph-cloud-arrow-down"></i> Kéo mã mới về máy';
    }
  }
}

async function handleGitCommitPush(e) {
  if (e) e.preventDefault();

  const commitBtn = document.getElementById('btn-git-commit-push');
  const subjectEl = document.getElementById('git-commit-subject');
  const typeEl = document.getElementById('git-commit-type');
  const scopeEl = document.getElementById('git-commit-scope');

  const selectedFiles = Array.from(gitStudioState.selectedFiles);
  if (selectedFiles.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 tệp tin hợp lệ để commit.', 'warning');
    return;
  }

  const subject = (subjectEl?.value || '').trim();
  if (!subject) {
    showToast('Vui lòng nhập tóm tắt mô tả nội dung commit.', 'warning');
    subjectEl?.focus();
    return;
  }

  const type = typeEl?.value || 'test';
  const scope = (scopeEl?.value || '').trim();
  const commitMessage = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;

  const isProtected = !!gitStudioState.status?.isProtectedBranch;
  const featureBranchInput = document.getElementById('git-feature-branch-input');
  let newBranch = null;

  if (isProtected) {
    newBranch = (featureBranchInput?.value || '').trim();
    if (!newBranch) {
      showToast('Nhánh main được bảo vệ! Vui lòng nhập tên nhánh Feature để đẩy lên.', 'warning');
      featureBranchInput?.focus();
      return;
    }
  }

  if (commitBtn) {
    commitBtn.disabled = true;
    commitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Đang Commit & Push…';
  }

  appendGitTerminalLog(`Bắt đầu đóng gói Commit & Push (${selectedFiles.length} tệp)...`);
  appendGitTerminalLog(`Commit message: "${commitMessage}"`);
  if (newBranch) {
    appendGitTerminalLog(`🌿 Đẩy lên nhánh Feature: ${newBranch} (để tạo PR duyệt vào main)`);
  }

  try {
    const res = await request('/api/git/commit-push', {
      method: 'POST',
      body: JSON.stringify({
        files: selectedFiles,
        message: commitMessage,
        branch: gitStudioState.status?.currentBranch || 'main',
        newBranch: newBranch,
      }),
    });

    if (Array.isArray(res.logs)) {
      res.logs.forEach((l) => appendGitTerminalLog(l));
    }

    if (res.ok) {
      showToast(res.message || 'Đã Commit & Push thành công lên Remote!', 'success');
      appendGitTerminalLog(`🎉 Thành công! Mã commit: ${res.commitHash || ''}`);

      const prBox = document.getElementById('git-pr-success-box');
      const prBtn = document.getElementById('btn-open-github-pr');
      const prDesc = document.getElementById('git-pr-success-desc');

      if (res.prUrl && prBox && prBtn) {
        prBox.style.display = 'flex';
        prBtn.href = res.prUrl;
        if (prDesc) prDesc.textContent = `Mã nguồn đã được đưa lên nhánh ${res.branch} an toàn. Bấm nút dưới đây để tạo Pull Request trên GitHub gửi Lead phê duyệt vào main:`;
        appendGitTerminalLog(`🔗 Link Pull Request GitHub: ${res.prUrl}`);
        prBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (prBox) {
        prBox.style.display = 'none';
      }

      if (subjectEl) subjectEl.value = '';
      if (scopeEl) scopeEl.value = '';
      if (featureBranchInput && isProtected) featureBranchInput.value = '';
      gitStudioState.selectedFiles.clear();
      updateGitCommitPreview();
      await loadGitStatus(true);
    } else {
      showToast(res.message || 'Commit & Push thất bại.', 'error');
      appendGitTerminalLog('❌ Lỗi: ' + res.message);
    }
  } catch (err) {
    showToast('Lỗi khi commit & push: ' + err.message, 'error');
    appendGitTerminalLog('❌ Ngoại lệ: ' + err.message);
  } finally {
    if (commitBtn) {
      commitBtn.disabled = false;
      updateGitCommitButtonState();
    }
  }
}

let gitStudioLoading = false;
async function openGitStudio() {
  if (gitStudioLoading) return;
  gitStudioLoading = true;
  try {
    await loadGitStatus(false);
    await runGitQualityGate();
  } finally {
    gitStudioLoading = false;
  }
}

function initGitStudio() {
  if (gitStudioState.isInitialized) return;
  gitStudioState.isInitialized = true;

  // Lắng nghe nút Fetch
  document.getElementById('btn-git-fetch')?.addEventListener('click', () => {
    const icon = document.getElementById('icon-git-fetch');
    if (icon) icon.classList.add('animate-spin');
    loadGitStatus(false).finally(() => {
      if (icon) icon.classList.remove('animate-spin');
    });
  });

  // Lắng nghe nút Pull
  document.getElementById('btn-git-pull')?.addEventListener('click', () => {
    handleGitPull();
  });

  // Lắng nghe Chọn tất cả / Bỏ chọn
  document.getElementById('btn-git-select-all')?.addEventListener('click', () => {
    const permitted = gitStudioState.status?.permittedFiles || [];
    permitted.forEach((f) => gitStudioState.selectedFiles.add(f.path));
    renderGitFilesTable();
    updateGitCommitButtonState();
  });

  document.getElementById('btn-git-deselect-all')?.addEventListener('click', () => {
    gitStudioState.selectedFiles.clear();
    renderGitFilesTable();
    updateGitCommitButtonState();
  });

  // Filter pills
  document.querySelectorAll('#git-filter-pills .filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#git-filter-pills .filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      gitStudioState.activeFilter = pill.dataset.gitFilter || 'all';
      renderGitFilesTable();
    });
  });

  // Đóng diff
  document.getElementById('btn-close-diff')?.addEventListener('click', () => {
    const card = document.getElementById('git-diff-card');
    if (card) card.style.display = 'none';
  });

  // Quality gate check
  document.getElementById('btn-git-run-qg')?.addEventListener('click', () => {
    runGitQualityGate();
  });

  // Commit Form & Preview
  document.getElementById('git-commit-type')?.addEventListener('change', updateGitCommitPreview);
  document.getElementById('git-commit-scope')?.addEventListener('input', updateGitCommitPreview);
  document.getElementById('git-commit-subject')?.addEventListener('input', updateGitCommitPreview);
  document.getElementById('git-feature-branch-input')?.addEventListener('input', updateGitCommitButtonState);
  document.getElementById('git-commit-form')?.addEventListener('submit', handleGitCommitPush);

  // Clear log
  document.getElementById('btn-clear-git-log')?.addEventListener('click', () => {
    const terminal = document.getElementById('git-terminal-body');
    if (terminal) terminal.textContent = 'Log đã được xóa. Sẵn sàng nhận lệnh mới.';
  });

  // Toggle new branch form
  document.getElementById('btn-toggle-new-branch')?.addEventListener('click', () => {
    const form = document.getElementById('git-new-branch-form');
    if (form) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      if (form.style.display === 'block') {
        document.getElementById('git-new-branch-name')?.focus();
      }
    }
  });

  // Checkout branch
  document.getElementById('btn-git-checkout')?.addEventListener('click', async () => {
    const branch = document.getElementById('git-branch-select')?.value;
    if (!branch) return;
    try {
      const res = await request('/api/git/branch/checkout', {
        method: 'POST',
        body: JSON.stringify({ branch }),
      });
      if (res.ok) {
        showToast(res.message || `Đã chuyển sang nhánh ${branch}`, 'success');
        await loadGitStatus(true);
      } else {
        showToast(res.message || 'Không thể chuyển nhánh', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi chuyển nhánh: ' + err.message, 'error');
    }
  });

  // Create branch
  document.getElementById('btn-create-branch')?.addEventListener('click', async () => {
    const input = document.getElementById('git-new-branch-name');
    const branch = (input?.value || '').trim();
    if (!branch) {
      showToast('Vui lòng nhập tên nhánh mới.', 'warning');
      input?.focus();
      return;
    }
    try {
      const res = await request('/api/git/branch/checkout', {
        method: 'POST',
        body: JSON.stringify({ branch, createNew: true }),
      });
      if (res.ok) {
        showToast(res.message || `Đã tạo và chuyển sang nhánh ${branch}`, 'success');
        if (input) input.value = '';
        const form = document.getElementById('git-new-branch-form');
        if (form) form.style.display = 'none';
        await loadGitStatus(true);
      } else {
        showToast(res.message || 'Không thể tạo nhánh', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi tạo nhánh: ' + err.message, 'error');
    }
  });

  // Topbar Git button opens git-view (nếu không phải là view-tab tự kích hoạt)
  const topbarGitBtn = document.getElementById('topbar-git-btn');
  if (topbarGitBtn && !topbarGitBtn.classList.contains('view-tab')) {
    topbarGitBtn.addEventListener('click', () => {
      const gitTab = document.querySelector('.nav-dropdown-item[data-view="git-view"]');
      if (gitTab) gitTab.click();
    });
  }

  updateGitCommitPreview();

  // Khởi động ngầm lấy trạng thái Git ban đầu sau 1 giây
  setTimeout(() => {
    loadGitStatus(true);
  }, 1000);
}

initGitStudio();

// =============================================================================
// PHÂN HỆ: QUẢN LÝ FIXTURES, PRECONDITIONS & TEARDOWN STUDIO (PLAN 08)
// =============================================================================
let repoFixtures = [];
let currentFixtureFilter = 'all';
let currentSelectedFixture = null;
let isFixturesStudioInitialized = false;

async function openFixturesStudio() {
  if (!isFixturesStudioInitialized) {
    initFixturesStudioListeners();
    isFixturesStudioInitialized = true;
  }
  // Đảm bảo filter mặc định (Tất cả) luôn được kích hoạt đồng bộ
  if (!currentFixtureFilter) currentFixtureFilter = 'all';
  const fxPills = document.querySelectorAll('#fixtures-filter-pills .pm-filter-pill, #fixtures-filter-pills .fx-filter-pill');
  if (fxPills.length > 0) {
    fxPills.forEach((p) => p.classList.toggle('active', (p.dataset.filter || 'all') === currentFixtureFilter));
  }
  await loadFixturesList();
}

async function loadFixturesList() {
  const container = $('#fixtures-list-container');
  if (container) container.innerHTML = '<p class="empty-resource">Đang tải danh sách fixtures...</p>';

  try {
    const res = await request('/api/fixtures');
    repoFixtures = res.fixtures || [];
    renderFixturesList();
  } catch (err) {
    if (container) {
      container.innerHTML = `<p class="empty-resource" style="color: var(--danger);">Lỗi tải fixtures: ${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderFixturesList() {
  const container = $('#fixtures-list-container');
  if (!container) return;

  const searchQuery = ($('#fixtures-search-input')?.value || '').toLowerCase().trim();

  const filtered = repoFixtures.filter((fx) => {
    if (currentFixtureFilter && currentFixtureFilter !== 'all') {
      if (currentFixtureFilter === 'core' && fx.isCustom) return false;
      if (currentFixtureFilter === 'custom' && !fx.isCustom) return false;
      if (currentFixtureFilter === 'precondition' && !fx.category?.toLowerCase().includes('precondition') && !fx.category?.toLowerCase().includes('xác thực') && !fx.category?.toLowerCase().includes('tiền điều kiện')) return false;
      if (currentFixtureFilter === 'teardown' && !fx.category?.toLowerCase().includes('dọn dẹp') && !fx.category?.toLowerCase().includes('teardown') && !fx.category?.toLowerCase().includes('hook') && !fx.category?.toLowerCase().includes('hậu điều kiện')) return false;
    }
    if (searchQuery) {
      const matchName = (fx.name || '').toLowerCase().includes(searchQuery);
      const matchTitle = (fx.title || '').toLowerCase().includes(searchQuery);
      const matchDesc = (fx.description || '').toLowerCase().includes(searchQuery);
      const matchCat = (fx.category || '').toLowerCase().includes(searchQuery);
      return matchName || matchTitle || matchDesc || matchCat;
    }
    return true;
  });

  if ($('#fixtures-badge-total')) {
    $('#fixtures-badge-total').textContent = `${filtered.length} / ${repoFixtures.length}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-resource">Không tìm thấy Fixture nào phù hợp.</p>';
    return;
  }

  container.innerHTML = filtered.map((fx) => {
    const isSelected = currentSelectedFixture && currentSelectedFixture.name === fx.name;
    const badgeColor = fx.isCustom ? '#10b981' : (fx.category?.includes('Xác thực') || fx.category?.includes('Tiền điều kiện') || fx.category?.includes('Precondition') ? '#8b5cf6' : (fx.category?.includes('Dọn dẹp') || fx.category?.includes('Hậu điều kiện') ? '#ef4444' : '#6366f1'));
    const iconClass = fx.isCustom ? 'ph-sparkle' : (fx.name === 'pages' ? 'ph-browsers' : (fx.category?.includes('Xác thực') ? 'ph-user-circle' : (fx.category?.includes('Dọn dẹp') ? 'ph-trash' : 'ph-gear')));

    return `
      <div class="dashboard-list-card script-card-item fixture-card-item ${isSelected ? 'is-selected active' : ''}" data-name="${escapeHtml(fx.name)}">
        <span class="dashboard-list-card__icon script-card-platform-icon fixture" style="background: ${badgeColor}18; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
          <i class="ph-bold ${iconClass}"></i>
        </span>
        <div class="dashboard-list-card__body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
            <div class="script-card-title">${escapeHtml(fx.name)}</div>
            ${fx.isCustom ? '<span class="script-card-badge-platform setup" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">Tùy biến</span>' : '<span class="script-card-badge-platform desktop" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; border-color: rgba(99, 102, 241, 0.3);">Cốt lõi</span>'}
          </div>
          <div class="script-card-file" title="${escapeHtml(fx.title || fx.description || '')}">
            ${escapeHtml(fx.title || fx.description || 'Fixture tự động nạp.')}
          </div>
          <div class="script-card-pills">
            <span class="script-card-badge-pages">
              <i class="ph ph-tag"></i> ${escapeHtml(fx.category || 'Hạ tầng & Nền tảng')}
            </span>
            <span class="script-card-badge-data">
              <i class="ph ph-clock"></i> ${escapeHtml(fx.scope || 'test')}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.fixture-card-item').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const found = repoFixtures.find((f) => f.name === name);
      if (found) selectFixture(found);
    });
  });

  if (!currentSelectedFixture && filtered.length > 0) {
    selectFixture(filtered[0]);
  } else if (currentSelectedFixture) {
    const stillExists = filtered.find((f) => f.name === currentSelectedFixture.name);
    if (stillExists) selectFixture(stillExists);
    else if (filtered.length > 0) selectFixture(filtered[0]);
  }
}

async function selectFixture(fx) {
  currentSelectedFixture = fx;

  document.querySelectorAll('#fixtures-list-container .fixture-card-item').forEach((card) => {
    const isThis = card.dataset.name === fx.name;
    card.classList.toggle('is-selected', isThis);
    card.classList.toggle('active', isThis);
  });

  // Nếu là custom fixture, nạp chi tiết mới nhất từ server để có revision chính xác
  if (fx.isCustom) {
    try {
      const detail = await request(`/api/fixtures/${encodeURIComponent(fx.name)}`);
      if (detail) {
        fx = { ...fx, ...detail };
        currentSelectedFixture = fx;
      }
    } catch (_) {}
  }

  if ($('#fx-detail-category-eyebrow')) $('#fx-detail-category-eyebrow').textContent = fx.isCustom ? 'FIXTURE NGHIỆP VỤ TÙY BIẾN' : 'FIXTURE CỐT LÕI HỆ THỐNG';
  if ($('#fx-detail-name')) $('#fx-detail-name').textContent = fx.title ? `${fx.name} (${fx.title})` : fx.name;
  if ($('#fx-detail-desc')) $('#fx-detail-desc').textContent = fx.description || fx.title || 'Fixture được nạp tự động vào ngữ cảnh kiểm thử Playwright.';

  const revBadge = $('#fx-detail-revision');
  if (revBadge) {
    if (fx.revision) {
      revBadge.textContent = 'Bản dựng: ' + fx.revision;
      revBadge.style.display = 'inline-block';
    } else {
      revBadge.style.display = 'none';
    }
  }

  if ($('#fx-grid-scope')) $('#fx-grid-scope').textContent = fx.scope || 'test';
  if ($('#fx-grid-cat')) $('#fx-grid-cat').textContent = fx.category || 'Hạ tầng & Nền tảng';
  if ($('#fx-grid-params')) $('#fx-grid-params').textContent = (fx.params && fx.params.length) ? fx.params.join(', ') : 'Không có';
  if ($('#fx-grid-file')) $('#fx-grid-file').textContent = fx.sourceFile || 'core/fixtures/baseTest.js';

  const deleteBtn = $('#btn-delete-fixture');
  if (deleteBtn) {
    deleteBtn.style.display = fx.isCustom ? 'inline-flex' : 'none';
  }

  const saveBtn = $('#btn-save-fixture');
  const valBtn = $('#btn-validate-fixture');
  const sourcePre = $('#fx-source-code-pre');
  const sourceEditor = $('#fx-source-editor');
  const editorHint = $('#fx-editor-hint');
  const modeBadge = $('#fx-mode-badge');

  if (modeBadge) {
    modeBadge.textContent = fx.isCustom ? 'Chỉnh sửa trực tiếp' : 'Chỉ đọc';
    modeBadge.classList.toggle('editable', Boolean(fx.isCustom));
  }

  const sourceCode = fx.rawCode || `// Fixture ${fx.name} được định nghĩa trong ${fx.sourceFile}
// Chữ ký tham số: ${fx.params?.join(', ') || 'Không có'}`;

  if (fx.isCustom) {
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (valBtn) valBtn.style.display = 'inline-flex';
    if (sourcePre) sourcePre.style.display = 'none';
    if (sourceEditor) {
      sourceEditor.style.display = 'block';
      sourceEditor.value = sourceCode;
    }
    if (editorHint) editorHint.textContent = 'Mã nguồn fixture tùy biến có thể chỉnh sửa trực tiếp. Bấm "Lưu thay đổi" để áp dụng.';
  } else {
    if (saveBtn) saveBtn.style.display = 'none';
    if (valBtn) valBtn.style.display = 'none';
    if (sourcePre) sourcePre.style.display = 'block';
    if (sourceEditor) sourceEditor.style.display = 'none';
    const sourceCodeEl = $('#fx-source-code');
    if (sourceCodeEl) {
      sourceCodeEl.textContent = sourceCode;
      sourceCodeEl.className = 'language-javascript';
      if (window.Prism) {
        Prism.highlightElement(sourceCodeEl);
      }
    }
    if (editorHint) editorHint.textContent = 'Mã nguồn fixture nền tảng của hệ thống (chế độ chỉ đọc).';
  }

  const usageCode = `const { test, expect } = require('../../../core/fixtures/baseTest');

test('Kịch bản sử dụng fixture ${fx.name}', async ({ ${fx.name} }) => {
  // Fixture ${fx.name} tự động được Playwright nạp vào ngữ cảnh test
  console.log('Đang thực thi với fixture:', ${fx.name});
});`;
  const usageCodeEl = $('#fx-usage-code');
  if (usageCodeEl) {
    usageCodeEl.textContent = usageCode;
    usageCodeEl.className = 'language-javascript';
    if (window.Prism) {
      Prism.highlightElement(usageCodeEl);
    }
  }
}

  async function safeCopyText(text, successMsg) {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) {}

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }

    if (copied) {
      showToast(successMsg || '📋 Đã sao chép vào bộ nhớ tạm!', 'success');
    } else {
      showToast('Không thể sao chép tự động, vui lòng bôi đen và nhấn Ctrl+C', 'error');
    }
  }

function initFixturesStudioListeners() {
  $('#btn-copy-usage-code')?.addEventListener('click', () => {
    const code = $('#fx-usage-code')?.textContent || '';
    if (code) {
      safeCopyText(code, '📋 Đã sao chép mã mẫu sử dụng vào bộ nhớ tạm!');
    }
  });

  $('#btn-copy-source-code')?.addEventListener('click', () => {
    const isCustom = currentSelectedFixture?.isCustom;
    const code = isCustom ? ($('#fx-source-editor')?.value || '') : ($('#fx-source-code')?.textContent || '');
    if (code) {
      safeCopyText(code, '📋 Đã sao chép mã nguồn fixture vào bộ nhớ tạm!');
    }
  });

  $('#fixtures-search-input')?.addEventListener('input', () => {

    renderFixturesList();
  });

  $('#fixtures-filter-pills')?.querySelectorAll('.fx-filter-pill, .pm-filter-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetFilter = pill.dataset.filter || 'all';
      const isAlreadyActive = pill.classList.contains('active');

      $('#fixtures-filter-pills').querySelectorAll('.fx-filter-pill, .pm-filter-pill').forEach((p) => p.classList.remove('active'));

      if (isAlreadyActive && targetFilter !== 'all') {
        const allPill = $('#fixtures-filter-pills').querySelector('[data-filter="all"]');
        if (allPill) allPill.classList.add('active');
        currentFixtureFilter = 'all';
      } else {
        pill.classList.add('active');
        currentFixtureFilter = targetFilter;
      }
      renderFixturesList();
    });
  });

  $('#btn-open-create-fixture-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-create-fixture');
    if (modal) {
      $('#form-create-fixture')?.reset();
      updateFixtureTemplateFields('cleanup_api');
      modal.showModal();
    }
  });

  $('#btn-close-create-fixture-modal')?.addEventListener('click', () => {
    document.getElementById('modal-create-fixture')?.close();
  });
  $('#btn-cancel-create-fixture')?.addEventListener('click', () => {
    document.getElementById('modal-create-fixture')?.close();
  });

  document.querySelectorAll('.fx-template-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.fx-template-card').forEach((c) => {
        c.classList.remove('is-selected');
        c.style.borderColor = 'var(--line)';
      });
      card.classList.add('is-selected');
      card.style.borderColor = 'var(--primary)';
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        updateFixtureTemplateFields(radio.value);
      }
    });
  });

  $('#form-create-fixture')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = ($('#fx-input-name')?.value || '').trim();
    const title = ($('#fx-input-title')?.value || '').trim();
    const description = ($('#fx-input-desc')?.value || '').trim();
    const template = document.querySelector('input[name="fx-template"]:checked')?.value || 'cleanup_api';

    const submitBtn = $('#btn-submit-create-fixture');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const payload = {
        name,
        title,
        description,
        template,
        config: {},
      };

      if (template === 'cleanup_api') {
        payload.config.method = $('#fx-cleanup-method')?.value || 'DELETE';
        payload.config.url = ($('#fx-cleanup-url')?.value || '/api/resource/:id').trim();
      } else if (template === 'custom_code') {
        payload.rawCode = $('#fx-custom-code')?.value || '';
      }

      const res = await request('/api/fixtures', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast(res.message || `Đã tạo fixture '${name}' thành công!`, 'success');
        document.getElementById('modal-create-fixture')?.close();
        await loadFixturesList();
        const createdFx = repoFixtures.find((f) => f.name === name);
        if (createdFx) selectFixture(createdFx);
      } else {
        showToast(res.error || 'Không thể tạo fixture', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi tạo fixture: ' + err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  $('#btn-validate-fixture')?.addEventListener('click', async () => {
    if (!currentSelectedFixture) return;
    const sourceCode = $('#fx-source-editor')?.value || '';
    try {
      const res = await request('/api/fixtures/validate', {
        method: 'POST',
        body: JSON.stringify({ name: currentSelectedFixture.name, sourceCode }),
      });
      if (res.valid) {
        showToast('✅ Cú pháp mã nguồn hợp lệ!', 'success');
      } else {
        showToast(`❌ ${res.error}`, 'error');
      }
    } catch (err) {
      showToast(`Lỗi kiểm tra: ${err.message}`, 'error');
    }
  });

  $('#btn-save-fixture')?.addEventListener('click', async () => {
    if (!currentSelectedFixture || !currentSelectedFixture.isCustom) return;
    const saveBtn = $('#btn-save-fixture');
    if (saveBtn) saveBtn.disabled = true;
    const sourceCode = $('#fx-source-editor')?.value || '';

    try {
      const res = await request(`/api/fixtures/${encodeURIComponent(currentSelectedFixture.name)}`, {
        method: 'PUT',
        body: JSON.stringify({
          sourceCode,
          expectedRevision: currentSelectedFixture.revision,
        }),
      });

      if (res.success) {
        showToast(res.message || 'Đã lưu thay đổi fixture thành công!', 'success');
        currentSelectedFixture.revision = res.revision;
        if ($('#fx-detail-revision')) $('#fx-detail-revision').textContent = 'rev: ' + res.revision;
        await loadFixturesList();
      } else {
        showToast(res.error || 'Lỗi khi lưu fixture', 'error');
      }
    } catch (err) {
      if (err.message && err.message.includes('Conflict')) {
        showToast(`⚠️ Xung đột sửa đổi: ${err.message}`, 'error');
        if (confirm('Fixture này đã bị thay đổi bởi một phiên khác. Bạn có muốn tải lại nội dung mới nhất?')) {
          await selectFixture(currentSelectedFixture);
        }
      } else {
        showToast(`Lỗi khi lưu: ${err.message}`, 'error');
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  $('#btn-delete-fixture')?.addEventListener('click', async () => {
    if (!currentSelectedFixture || !currentSelectedFixture.isCustom) return;
    const name = currentSelectedFixture.name;
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa Custom Fixture '${name}' khỏi dự án?\n(File mã nguồn sẽ được sao lưu an toàn tại .dashboard-backups/fixtures/)`);
    if (!confirmed) return;

    try {
      const res = await request(`/api/fixtures/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        body: JSON.stringify({ expectedRevision: currentSelectedFixture.revision }),
      });
      if (res.success) {
        showToast(res.message || `Đã xóa fixture '${name}' thành công!`, 'success');
        currentSelectedFixture = null;
        await loadFixturesList();
      } else {
        showToast(res.error || 'Không thể xóa fixture', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi xóa fixture: ' + err.message, 'error');
    }
  });
}

function updateFixtureTemplateFields(template) {
  const cleanupFields = $('#fx-fields-cleanup');
  const customFields = $('#fx-fields-custom');

  if (template === 'cleanup_api') {
    if (cleanupFields) cleanupFields.style.display = 'flex';
    if (customFields) customFields.style.display = 'none';
  } else if (template === 'custom_code') {
    if (cleanupFields) cleanupFields.style.display = 'none';
    if (customFields) {
      customFields.style.display = 'flex';
      const name = $('#fx-input-name')?.value || 'myCustomFixture';
      if (!$('#fx-custom-code')?.value) {
        $('#fx-custom-code').value = `/**
 * Custom Fixture: ${name}
 */
const ${name} = async ({ request, page }, use) => {
  // 1. Setup
  const session = { id: Date.now() };

  try {
    // 2. Chuyển quyền cho test chạy
    await use(session);
  } finally {
    // 3. Teardown / Dọn dẹp
    console.log('[Teardown] Hoàn tất.');
  }
};

module.exports = { ${name} };\n`;
      }
    }
  } else {
    if (cleanupFields) cleanupFields.style.display = 'none';
    if (customFields) customFields.style.display = 'none';
  }
}

