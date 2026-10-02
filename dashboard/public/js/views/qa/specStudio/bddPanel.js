/**
 * dashboard/public/js/views/qa/specStudio/bddPanel.js
 * Quản lý giao diện Chuẩn hoá BDD qua AI Gateway.
 * TextContent 100% an toàn chống XSS (INV-6), tối ưu DocumentFragment, ngân sách dòng <= 150.
 */

import { apiClient } from '../../../core/apiClient.js';
import { toast } from '../../../core/toast.js';

let currentBddSeq = 0;
let activeBddCtrl = null;

export async function runBdd({ root, hooks, getRev, setDirty, setAbort }) {
  const textarea = root.querySelector('#qa-req-analyzer-text');
  const text = textarea ? textarea.value.trim() : '';
  if (!text) {
    toast.warn('Vui lòng nhập hoặc dán nội dung requirement trước khi chuẩn hoá BDD.');
    textarea?.focus();
    return;
  }
  const reqRev = getRev();
  hooks.showResults();
  hooks.switchTab('bdd');

  const container = root.querySelector('#qa-req-bdd-result');
  if (!container) return;
  container.replaceChildren();

  const loadingBox = document.createElement('div');
  loadingBox.style.cssText = 'padding: 32px 16px; text-align: center; color: var(--muted); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px;';
  const loadingTxt = document.createElement('span');
  loadingTxt.textContent = 'Đang kết nối AI Gateway chuẩn hoá Given-When-Then tiếng Việt...';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary-sm';
  cancelBtn.textContent = 'Huỷ yêu cầu';

  if (activeBddCtrl) {
    try { activeBddCtrl.abort(); } catch (_) {}
  }
  const ctrl = new AbortController();
  activeBddCtrl = ctrl;
  setAbort(ctrl);
  const seq = ++currentBddSeq;

  cancelBtn.addEventListener('click', () => {
    ctrl.abort();
    setAbort(null);
    loadingBox.remove();
    hooks.showInput();
    toast.info('Đã huỷ chuẩn hoá BDD.');
  });
  loadingBox.append(loadingTxt, cancelBtn);
  container.append(loadingBox);

  try {
    const res = await apiClient.post('/api/ai/format-bdd', { requirementText: text }, { signal: ctrl.signal });
    if (seq !== currentBddSeq) return;
    setAbort(null);
    if (!res.ok) throw new Error(res.error || 'Lỗi từ AI Gateway');

    setDirty(true);
    const badge = root.querySelector('#qa-req-tab-bdd-status');
    if (badge) badge.textContent = `${res.acIds?.length || 0} AC`;

    renderBddResult({ container, res, reqRev, getRev, setDirty });
    toast.success('Chuẩn hoá kịch bản BDD thành công!');
  } catch (err) {
    if (seq !== currentBddSeq) return;
    setAbort(null);
    if (err.name === 'AbortError' || err.message === 'Đã hủy.') return;
    const badge = root.querySelector('#qa-req-tab-bdd-status');
    if (badge) badge.textContent = 'Lỗi';

    container.replaceChildren();
    const errBox = document.createElement('div');
    errBox.className = 'qa-bdd-stale-banner';
    errBox.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    const msg = document.createElement('span');
    msg.textContent = `Lỗi chuẩn hoá BDD: ${err.message}`;
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-secondary-sm';
    retryBtn.textContent = 'Thử lại';
    retryBtn.addEventListener('click', () => runBdd({ root, hooks, getRev, setDirty, setAbort }));
    errBox.append(msg, retryBtn);
    container.append(errBox);
    toast.error(`Lỗi chuẩn hoá BDD: ${err.message}`);
  }
}

function renderBddResult({ container, res, reqRev, getRev, setDirty }) {
  container.replaceChildren();
  const frag = document.createDocumentFragment();

  if (getRev() !== reqRev) {
    const stale = document.createElement('div');
    stale.id = 'qa-req-bdd-stale';
    stale.className = 'qa-bdd-stale-banner';
    stale.textContent = '⚠️ Văn bản đã thay đổi — kịch bản bên dưới có thể đã cũ, hãy chạy lại khi cần.';
    frag.append(stale);
  }

  const bar = document.createElement('div');
  bar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;';
  const title = document.createElement('h4');
  title.style.cssText = 'margin: 0; font-size: 13.5px; font-weight: 600; color: var(--text);';
  title.textContent = `Kịch Bản BDD (${res.scenarios?.length || 0} AC hợp lệ, ${res.proposals?.length || 0} đề xuất)`;
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.id = 'qa-req-bdd-copy';
  copyBtn.className = 'btn-secondary-sm';
  copyBtn.textContent = 'Sao chép Markdown';
  copyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(res.markdown || '');
      toast.success('Đã sao chép kịch bản BDD Markdown!');
    } catch (_) {
      toast.warn('Không thể ghi vào clipboard.');
    } finally {
      setDirty(false);
    }
  });
  bar.append(title, copyBtn);
  frag.append(bar);

  const guide = document.createElement('p');
  guide.style.cssText = 'font-size: 12px; color: var(--muted); margin: 0 0 8px;';
  guide.textContent = '💡 Hướng dẫn: Bấm "Sao chép Markdown", dán vào tài liệu REQ qua Document Reader rồi bấm Lưu.';
  frag.append(guide);

  const pre = document.createElement('pre');
  pre.id = 'qa-req-bdd-markdown';
  pre.className = 'qa-bdd-pre';
  const code = document.createElement('code');
  code.textContent = res.markdown || '';
  pre.append(code);
  frag.append(pre);

  const appendList = (titleText, items, isWarn = false) => {
    if (!items || !items.length) return;
    const box = document.createElement('div');
    box.className = 'qa-spec-card';
    if (isWarn) box.style.borderColor = 'var(--warning, #f59e0b)';
    const head = document.createElement('strong');
    if (isWarn) head.style.color = 'var(--warning, #f59e0b)';
    head.textContent = titleText;
    box.append(head);
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin: 6px 0 0 16px; padding: 0; font-size: 12px; color: var(--muted);';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    });
    box.append(ul);
    frag.append(box);
  };

  appendList('Cảnh báo mã AC chưa chuẩn quy cách:', res.warnings, true);
  appendList(`Câu hỏi làm rõ logic (${res.openQuestions?.length || 0}):`, res.openQuestions);
  container.append(frag);
}
