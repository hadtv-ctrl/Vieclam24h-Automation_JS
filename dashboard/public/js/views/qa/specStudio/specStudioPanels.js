/**
 * dashboard/public/js/views/qa/specStudio/specStudioPanels.js
 * Quản lý vòng đời hiển thị 2 tab Ma trận biên (BVA) và Chuẩn hoá BDD (Spec Studio).
 * Tuân thủ OWN-01..05 (quản lý disposer sạch), ASYNC-01..05 và dirty guard.
 * Ngân sách dòng <= 150.
 */

import { confirmDialog } from '../batch/batchConfirm.js';
import { runBva } from './bvaPanel.js';
import { runBdd } from './bddPanel.js';

export const SPEC_TABS = ['bva', 'bdd'];

export function mountSpecPanels(root, hooks = {}) {
  const disposers = [];
  let textRev = 0;
  let dirty = false;
  let bvaAbort = null;
  let bddAbort = null;

  const textarea = root.querySelector('#qa-req-analyzer-text');
  const bvaBtn = root.querySelector('#qa-req-btn-bva');
  const bddBtn = root.querySelector('#qa-req-btn-bdd');

  const addEvt = (el, type, fn) => {
    if (!el) return;
    el.addEventListener(type, fn);
    disposers.push(() => el.removeEventListener(type, fn));
  };

  // Theo dõi sửa đổi textarea để cập nhật textRev (ASYNC-01)
  if (textarea) {
    addEvt(textarea, 'input', () => {
      textRev++;
    });
  }

  // Nút kích hoạt BVA
  if (bvaBtn) {
    addEvt(bvaBtn, 'click', () => {
      runBva({
        root,
        hooks,
        getRev: () => textRev,
        setAbort: (ctrl) => { bvaAbort = ctrl; }
      });
    });
  }

  // Nút kích hoạt BDD
  if (bddBtn) {
    addEvt(bddBtn, 'click', () => {
      runBdd({
        root,
        hooks,
        getRev: () => textRev,
        setDirty: (val) => { dirty = val; },
        setAbort: (ctrl) => { bddAbort = ctrl; }
      });
    });
  }

  async function confirmClose() {
    if (!dirty) return true;
    const confirmEl = root.querySelector('#qa-batch-confirm');
    if (!confirmEl) return true;

    const ok = await confirmDialog(confirmEl, {
      title: 'Chưa sao chép kết quả BDD',
      message: 'Kịch bản BDD vừa chuẩn hoá chưa được sao chép. Nếu đóng, kết quả sẽ bị mất.',
      confirmText: 'Bỏ và đóng',
      cancelText: 'Ở lại'
    });

    if (ok) {
      dirty = false;
      return true;
    }
    return false;
  }

  function destroy() {
    // Huỷ cả 2 kết nối đang chờ nếu modal bị đóng (ASYNC-02, OWN-05)
    if (bvaAbort) {
      try { bvaAbort.abort(); } catch (_) {}
      bvaAbort = null;
    }
    if (bddAbort) {
      try { bddAbort.abort(); } catch (_) {}
      bddAbort = null;
    }

    while (disposers.length) {
      const dispose = disposers.pop();
      try { dispose(); } catch (_) {}
    }
  }

  return {
    destroy,
    confirmClose,
    isDirty: () => dirty,
    getTextRev: () => textRev
  };
}
