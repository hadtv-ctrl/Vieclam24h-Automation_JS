/**
 * dashboard/public/js/views/qa/smartLinkerHelper.js
 * Điều phối Smart Trace Linker (Plan 21 Phase 2):
 * - Gọi POST /api/qa/smart-link và POST /api/qa/smart-link/apply
 * - Đồng bộ editor state an toàn (cursor, scroll, dirty guard)
 * - Xử lý 409 BATCH_LOCKED (giữ modal, retry được), 409 SPEC_CHANGED, 500 APPLY_FAILED
 * Ngân sách dòng: <= 250 dòng.
 */

import { SmartLinkerModal } from './smartLinkerModal.js';

let modalInstance = null;
let currentSeq = 0;
let lastScanResult = null;

function getModal() {
  if (!modalInstance) {
    modalInstance = new SmartLinkerModal();
  }
  return modalInstance;
}

function showToast(msg, type = 'info') {
  if (typeof window.notify === 'function') {
    window.notify(msg);
  } else if (typeof window.showNotification === 'function') {
    window.showNotification(msg, type);
  }
}

/** Cập nhật nội dung editor đang mở mà vẫn bảo toàn vị trí con trỏ và scroll */
function syncEditorContent(specPath, patchedSpec) {
  const editor = document.getElementById('script-spec-editor');
  if (!editor || !patchedSpec) return;

  const oldVal = editor.value || '';
  const oldStart = editor.selectionStart || 0;
  const oldEnd = editor.selectionEnd || 0;
  const oldScroll = editor.scrollTop || 0;
  const diffLen = patchedSpec.length - oldVal.length;

  if (window.specCodeEditor && typeof window.specCodeEditor.setValue === 'function') {
    window.specCodeEditor.setValue(patchedSpec, { markClean: true });
  } else {
    editor.value = patchedSpec;
    const preview = document.getElementById('script-spec-code');
    if (preview && typeof window.highlightCode === 'function') {
      preview.innerHTML = window.highlightCode(patchedSpec, false);
    }
  }

  editor.scrollTop = oldScroll;
  const newStart = oldStart > 0 ? Math.max(0, oldStart + diffLen) : 0;
  const newEnd = oldEnd > 0 ? Math.max(0, oldEnd + diffLen) : 0;
  if (typeof editor.setSelectionRange === 'function') {
    editor.setSelectionRange(newStart, newEnd);
  }
}

/** Cập nhật nhãn và trạng thái hiển thị của nút Smart Linker trên toolbar */
export function updateSmartLinkButton(specPath, specContent = '') {
  if (typeof window !== 'undefined') window.__currentSpecPath = specPath;
  const btn = document.getElementById('qa-btn-smart-link-spec');
  const textEl = document.getElementById('qa-btn-smart-link-text');
  if (!btn) return;

  const path = String(specPath || '').toLowerCase();
  const isSpec = path.endsWith('.spec.js') || path.endsWith('.spec.ts');
  if (!isSpec) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';
  const hasReq = /@REQ-\d{3}/i.test(specContent);
  if (textEl) {
    textEl.textContent = hasReq ? '✦ Đồng bộ kịch bản vào REQ' : '✦ Liên kết Requirement';
  }
}

/** Mở modal Smart Trace Linker và kích hoạt phân tích intent */
export async function openSmartLinkerForSpec(specPath, specContent) {
  if (!specPath) {
    showToast('Vui lòng chọn một file kịch bản Playwright để liên kết.', 'warning');
    return;
  }

  const seq = ++currentSeq;
  const modal = getModal();
  modal.ensureMounted();
  modal.setBusy(true, 'Đang phân tích kịch bản...');
  modal.setNotice(null);

  let editorContent = specContent;
  if (editorContent === undefined && typeof window !== 'undefined' && window.__currentSpecPath === specPath) {
    const editor = document.getElementById('script-spec-editor');
    if (editor && editor.value) editorContent = editor.value;
  }

  try {
    const res = await fetch('/api/qa/smart-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath, specContent: editorContent }),
    });

    if (seq !== currentSeq) return; // Tránh response chậm đến sau

    if (res.status === 403) {
      showToast('Đường dẫn file spec không hợp lệ hoặc nằm ngoài thư mục tests/', 'error');
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Không thể phân tích kịch bản spec.', 'error');
      return;
    }

    const data = await res.json();
    lastScanResult = data;

    modal.open(data, async (applyData) => {
      await handleApply(specPath, applyData);
    });

    if (data.mode === 'conflict') {
      modal.setNotice('Spec này đang chứa nhiều tag REQ xung đột. Vui lòng kiểm tra lại.', 'warning');
    } else if (data.mode === 'reverse_sync') {
      const newTestsCount = data.delta?.newTests?.length || 0;
      modal.setNotice(`Phát hiện ${newTestsCount} kịch bản test mới chưa có trong Requirement.`, 'info');
    }
  } catch (err) {
    if (seq === currentSeq) {
      showToast(`Lỗi mạng khi kết nối máy chủ: ${err.message || 'Không thể kết nối'}`, 'error');
    }
  }
}

/** Xử lý Apply liên kết (ghi đĩa an toàn, xử lý 409 BATCH_LOCKED và 409 SPEC_CHANGED) */
async function handleApply(specPath, applyData) {
  if (!lastScanResult) return;
  const modal = getModal();
  modal.setBusy(true, 'Đang cập nhật nguyên tử...');
  modal.setNotice(null);

  let editorContent = undefined;
  if (typeof window !== 'undefined' && window.__currentSpecPath === specPath) {
    const editor = document.getElementById('script-spec-editor');
    if (editor && editor.value) editorContent = editor.value;
  }

  try {
    const res = await fetch('/api/qa/smart-link/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath,
        specHash: lastScanResult.specHash,
        diskHash: lastScanResult.diskHash,
        mode: applyData.mode,
        targetReqId: applyData.targetReqId,
        newReqData: applyData.newReqData,
        currentEditorContent: editorContent,
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (res.status === 409) {
      modal.setBusy(false);
      if (result.code === 'BATCH_LOCKED') {
        modal.setNotice('Đang có thao tác ghi khác trên máy chủ. Thử lại sau vài giây.', 'warning');
      } else if (result.code === 'SPEC_CHANGED') {
        modal.setNotice('Nội dung file spec đã thay đổi ngoài đĩa. Vui lòng phân tích lại.', 'error');
      } else {
        modal.setNotice(result.error || 'Xung đột khi áp dụng liên kết.', 'error');
      }
      return;
    }

    if (!res.ok) {
      modal.setBusy(false);
      modal.setNotice(result.error || 'Lỗi khi áp dụng liên kết Requirement. Đã hoàn tác an toàn.', 'error');
      return;
    }

    // 200 OK: Thành công
    modal.close();
    const patched = result.patchedSpecContent || result.patchedSpec;
    if (patched) {
      syncEditorContent(specPath, patched);
      updateSmartLinkButton(specPath, patched);
    }

    const assignedId = result.assignedReqId || applyData.targetReqId || 'REQ';
    showToast(`✦ Đã liên kết và đồng bộ thành công với ${assignedId}!`, 'success');

    // Kích hoạt cập nhật QA findings và traceability
    window.dispatchEvent(new CustomEvent('qa:smart-link:applied', { detail: { specPath, assignedId } }));
  } catch (err) {
    modal.setBusy(false);
    modal.setNotice(`Lỗi mạng: ${err.message || 'Không thể gửi yêu cầu'}`, 'error');
  }
}

// Đăng ký toàn cục
if (typeof window !== 'undefined') {
  window.openSmartLinkerForSpec = openSmartLinkerForSpec;
  window.updateSmartLinkButton = updateSmartLinkButton;
}
