/**
 * dashboard/public/js/views/qa/batch/findingRows.js
 * Dựng dòng static finding (PLAN-18 mục 6.1): checkbox chỉ ở mục sửa được (quick/guided),
 * nút hành động theo route do server gắn (`fixRoute`). Không gắn listener ở đây — controller
 * bắt sự kiện bằng delegation trên danh sách.
 */

const GROUP_OF_ROUTE = { quick: 'quick', guided: 'guided', scaffold: 'manual', autofix: 'manual', manual: 'manual' };

export function groupOf(finding) {
  return GROUP_OF_ROUTE[finding.fixRoute] || 'manual';
}

export function isSelectable(finding) {
  return finding.fixRoute === 'quick' || finding.fixRoute === 'guided';
}

export function countByGroup(findings) {
  const counts = { all: findings.length, quick: 0, guided: 0, manual: 0 };
  findings.forEach((f) => { counts[groupOf(f)] += 1; });
  return counts;
}

export function filterFindings(findings, filter, newKeys = new Set()) {
  if (filter === 'new') return findings.filter((f) => newKeys.has(f.findingKey));
  if (filter === 'all') return findings;
  return findings.filter((f) => groupOf(f) === filter);
}

function actionsFor(finding) {
  const detail = { action: 'detail', label: 'Chi tiết', icon: 'ph-info' };
  if (isSelectable(finding)) return [{ action: 'fix', label: 'Sửa lỗi', icon: 'ph-wrench', primary: true }, detail];
  if (finding.fixRoute === 'scaffold') return [{ action: 'scaffold', label: 'Tạo requirement', icon: 'ph-file-plus', primary: true }, detail];
  if (finding.fixRoute === 'autofix') return [{ action: 'autofix', label: 'Chuẩn hoá traceability', icon: 'ph-lightning', primary: true }, detail];
  if (finding.kind === 'ma-tc-trung') {
    return [{ action: 'openDoc', label: 'Mở tài liệu', icon: 'ph-book-open', primary: true }, { ...detail, label: 'Xem hướng dẫn' }];
  }
  return [{ action: 'detail', label: 'Xem hướng dẫn', icon: 'ph-info', primary: true }];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconFor(finding) {
  const icon = el('i');
  if (finding.severity === 'blocker' || finding.kind === 'assertion-thieu-await') {
    icon.className = 'ph-bold ph-warning-circle qa-gap-icon is-danger';
  } else if (finding.kind === 'rule-thieu-boundary-test' || finding.kind === 'thieu-kiem-tra-bien') {
    icon.className = 'ph-bold ph-compass qa-gap-icon is-warning';
  } else {
    icon.className = 'ph-bold ph-git-diff qa-gap-icon is-accent';
  }
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function renderRow(finding, { selected, locked }) {
  const label = finding.label || finding.kind;
  const where = finding.where || finding.id || '';
  const row = el('div', 'qa-static-gap-row');
  row.dataset.findingKey = finding.findingKey;

  const selectCol = el('div', 'qa-gap-select-col');
  if (isSelectable(finding)) {
    const box = el('label', 'qa-gap-check');
    const input = el('input', 'qa-finding-checkbox');
    input.type = 'checkbox';
    input.dataset.findingKey = finding.findingKey;
    input.checked = selected;
    input.disabled = locked;
    input.setAttribute('aria-label', `Chọn: ${label} tại ${where}`);
    box.append(input);
    selectCol.append(box);
  }

  const iconCol = el('div', 'qa-gap-icon-col');
  iconCol.append(iconFor(finding));

  const content = el('div', 'qa-gap-content-col');
  const title = el('div', 'qa-gap-title');
  title.append(el('span', null, label));
  if (finding.severity) {
    title.append(el('span', `qa-badge qa-badge-${finding.severity === 'blocker' ? 'danger' : 'warn'}`, finding.severity.toUpperCase()));
  }
  if (where) title.append(el('span', 'qa-gap-location', where));
  if (finding.occurrences > 1) {
    const dup = el('span', 'qa-gap-dup', `×${finding.occurrences} project`);
    dup.title = `Cùng lỗi xuất hiện ở ${finding.occurrences} Playwright project`;
    title.append(dup);
  }
  content.append(title);
  const detail = el('div', 'qa-gap-detail', finding.detail || finding.message || '');
  if (finding.action) detail.textContent += ` ➔ Hướng dẫn: ${finding.action}`;
  content.append(detail);

  const actions = el('div', 'qa-gap-actions-col');
  actionsFor(finding).forEach(({ action, label: text, icon, primary }) => {
    const btn = el('button', `qa-gap-action${primary ? ' is-primary' : ''}`);
    btn.type = 'button';
    btn.dataset.findingAction = action;
    btn.dataset.findingKey = finding.findingKey;
    btn.disabled = locked && action === 'fix';
    const i = el('i', `ph-bold ${icon}`);
    i.setAttribute('aria-hidden', 'true');
    btn.append(i, el('span', null, text));
    actions.append(btn);
  });

  row.append(selectCol, iconCol, content, actions);
  return row;
}

/** Vẽ lại danh sách; `locked` khi đang quét lại hoặc đang có thao tác batch. */
export function renderFindingRows(listEl, findings, { selection, locked }) {
  listEl.textContent = '';
  findings.forEach((finding) => {
    listEl.append(renderRow(finding, { selected: selection.has(finding.findingKey), locked }));
  });
}
