/**
 * dashboard/public/js/views/qa/specStudio/bvaPanel.js
 * Hiển thị ma trận phân vùng tương đương và điểm biên (BVA) 0 token AI.
 * Toàn bộ DOM render an toàn qua textContent (INV-6), tối ưu DocumentFragment, ngân sách dòng <= 150.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

let currentBvaSeq = 0;
let activeBvaCtrl = null;

export async function runBva({ root, hooks, setAbort }) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const text = textarea ? textarea.value.trim() : '';
  if (!text) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi phân tích biên.');
    textarea?.focus();
    return;
  }

  hooks.showResults();
  hooks.switchTab('bva');
  const container = root.querySelector('#qa-req-bva-result');
  if (!container) return;
  container.replaceChildren();

  const loading = document.createElement('div');
  loading.style.cssText = 'padding: 32px 16px; text-align: center; color: var(--muted); font-size: 13px;';
  loading.textContent = 'Đang bóc tách ràng buộc và dựng ma trận biên (0 token AI)...';
  container.append(loading);

  if (activeBvaCtrl) {
    try { activeBvaCtrl.abort(); } catch (_) {}
  }
  const ctrl = new AbortController();
  activeBvaCtrl = ctrl;
  setAbort(ctrl);
  const seq = ++currentBvaSeq;

  try {
    const res = await apiClient.post('/api/qa/boundary-matrix', { requirementText: text }, { signal: ctrl.signal });
    if (seq !== currentBvaSeq) return;
    setAbort(null);
    if (!res.ok) throw new Error(res.error || 'Lỗi phân tích biên');

    const countBadge = root.querySelector('#qa-req-tab-bva-count');
    if (countBadge) countBadge.textContent = String(res.constraints.length);

    renderBvaResult(container, res);
    toast.success(`Đã phân tích ${res.constraints.length} ràng buộc biên thành công!`);
  } catch (err) {
    if (seq !== currentBvaSeq) return;
    setAbort(null);
    if (err.name === 'AbortError' || err.message === 'Đã hủy.') return;
    container.replaceChildren();
    const errBox = document.createElement('div');
    errBox.className = 'qa-bdd-stale-banner';
    errBox.textContent = `Lỗi phân tích biên: ${err.message}`;
    container.append(errBox);
    toast.error(`Lỗi phân tích biên: ${err.message}`);
  }
}

function renderBvaResult(container, res) {
  container.replaceChildren();
  const frag = document.createDocumentFragment();

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
  const title = document.createElement('h4');
  title.style.cssText = 'margin: 0; font-size: 13.5px; font-weight: 600; color: var(--text);';
  title.textContent = `Báo cáo Phân Vùng Tương Đương & Điểm Biên (${res.constraints.length} ràng buộc)`;
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.id = 'qa-req-bva-copy';
  copyBtn.className = 'btn-secondary-sm';
  copyBtn.textContent = 'Sao chép JSON';
  copyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(JSON.stringify(res, null, 2));
      toast.success('Đã sao chép dữ liệu ma trận biên JSON!');
    } catch (_) {
      toast.warn('Không thể sao chép vào clipboard.');
    }
  });
  toolbar.append(title, copyBtn);
  frag.append(toolbar);

  if (!res.constraints.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'padding: 24px; text-align: center; color: var(--muted); font-size: 13px;';
    empty.textContent = 'Không tìm thấy ràng buộc số hoặc độ dài nào trong văn bản.';
    frag.append(empty);
  }

  res.constraints.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'qa-spec-card';
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;';
    const fieldName = document.createElement('strong');
    fieldName.style.fontSize = '13.5px';
    fieldName.textContent = `#${idx + 1}. Trường "${c.field}" (${c.kind}${c.unit ? ` · ${c.unit}` : ''})`;
    header.append(fieldName);

    const badges = document.createElement('div');
    badges.style.cssText = 'display: flex; gap: 6px;';
    if (c.needsReview) {
      const b = document.createElement('span');
      b.className = 'qa-spec-badge qa-spec-badge-review';
      b.textContent = 'Cần kiểm tra chiều biên';
      badges.append(b);
    }
    if (c.implicitMin) {
      const b = document.createElement('span');
      b.className = 'qa-spec-badge qa-spec-badge-implicit';
      b.textContent = 'Biên ngầm định';
      badges.append(b);
    }
    header.append(badges);
    card.append(header);

    const src = document.createElement('small');
    src.style.color = 'var(--muted)';
    src.textContent = `Nguồn (dòng ${c.source.line}): "${c.source.text || c.source.sentence || ''}"`;
    card.append(src);

    const table = document.createElement('table');
    table.className = 'qa-spec-table';
    table.innerHTML = '<thead><tr><th style="width:25%;">Giá trị</th><th style="width:35%;">Ý nghĩa / Nhãn</th><th style="width:20%;">Hợp lệ</th><th style="width:20%;">Mẫu</th></tr></thead>';
    const tbody = document.createElement('tbody');
    (c.matrix?.values || []).forEach((v) => {
      const tr = document.createElement('tr');
      const tdVal = document.createElement('td');
      tdVal.style.fontWeight = '600';
      tdVal.textContent = String(v.value);
      const tdLbl = document.createElement('td');
      tdLbl.textContent = v.label;
      const tdOk = document.createElement('td');
      tdOk.className = v.valid ? 'qa-spec-val-valid' : 'qa-spec-val-invalid';
      tdOk.textContent = v.valid ? '✔ Hợp lệ' : '✗ Không hợp lệ';
      const tdSample = document.createElement('td');
      if (v.sample !== undefined) {
        const code = document.createElement('code');
        code.textContent = v.sample === '' ? '"" (rỗng)' : (v.sample.length > 20 ? `${v.sample.slice(0, 20)}...` : v.sample);
        tdSample.append(code);
      } else { tdSample.textContent = '—'; }
      tr.append(tdVal, tdLbl, tdOk, tdSample);
      tbody.append(tr);
    });
    table.append(tbody);
    card.append(table);
    frag.append(card);
  });

  if (res.unrecognized?.length > 0) {
    const unrecBox = document.createElement('div');
    unrecBox.className = 'qa-spec-card';
    unrecBox.style.borderColor = 'var(--warning, #f59e0b)';
    const unrecTitle = document.createElement('strong');
    unrecTitle.style.color = 'var(--warning, #f59e0b)';
    unrecTitle.textContent = `Câu có chứa số nhưng chưa nhận diện (${res.unrecognized.length} câu):`;
    unrecBox.append(unrecTitle);
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin: 6px 0 0 16px; padding: 0; font-size: 12px; color: var(--muted);';
    res.unrecognized.forEach((u) => {
      const li = document.createElement('li');
      li.textContent = `Dòng ${u.line}: "${u.text}"`;
      ul.append(li);
    });
    unrecBox.append(ul);
    frag.append(unrecBox);
  }

  container.append(frag);
}
