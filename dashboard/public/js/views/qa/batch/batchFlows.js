/**
 * dashboard/public/js/views/qa/batch/batchFlows.js
 * Các luồng gọi API của batch fixer (PLAN-18): đổi lựa chọn trong modal, áp dụng, thống kê sau
 * khi quét lại, hoàn tác. Nhận controller làm tham số; mọi phản hồi đến sau khi view đã unmount
 * hoặc kế hoạch đã đổi thì bị bỏ qua.
 */

import { apiClient } from '../../../core/apiClient.js';
import { confirmDialog } from './batchConfirm.js';

export const fileOf = (where) => String(where || '').replace(/:\d+$/, '');
const countMatch = (list) => list.reduce((m, f) => m.set(f.matchKey, (m.get(f.matchKey) || 0) + 1), new Map());

/** Lỗi API -> nội dung banner trong modal, kèm nút phù hợp để người dùng đi tiếp. */
export function applyErrorOf(err) {
  const payload = (err && err.payload) || {};
  const files = (payload.details && payload.details.files) || [];
  if (['STALE_FILES', 'REVISION_STALE', 'SESSION_NOT_FOUND', 'INVALID_STATE'].includes(payload.code)) {
    return { message: err.message, files, retry: 'replan' };
  }
  if (payload.code === 'BATCH_LOCKED') return { message: err.message, retry: 'apply' };
  if (payload.code === 'WRITE_FAILED') return { message: `${err.message} Không file nào bị thay đổi.`, retry: 'replan' };
  return { message: `Không áp dụng được: ${err.message}`, retry: 'apply' };
}

export async function changeInput(ctrl, key, input) {
  const { modal } = ctrl;
  const { plan } = modal;
  if (!plan) return;
  modal.setBusy(true, 'Đang cập nhật bản xem trước…');
  try {
    const res = await apiClient.post('/api/qa/finding/batch-input', {
      sessionId: plan.session.sessionId, revision: plan.session.revision, findingKey: key, input,
    });
    if (!ctrl.alive || modal.plan !== plan) return;
    modal.setBusy(false);
    if (res.cards || res.card) modal.updateCards(res.cards || [res.card], res.revision, input.acId ? key : null);
    else {
      modal.render();
      if (res.skipped) modal.showError({ message: res.skipped.reason });
    }
  } catch (err) {
    if (!ctrl.alive || modal.plan !== plan) return;
    modal.setBusy(false);
    modal.render();
    modal.showError(applyErrorOf(err));
  }
}

export async function applyPlan(ctrl, keys) {
  const { modal, result } = ctrl;
  const { plan } = modal;
  if (!plan || !keys.length) return;
  ctrl.busy = 'Đang áp dụng bản vá…';
  modal.showError(null);
  modal.setBusy(true, 'Đang áp dụng…');
  const files = new Set(plan.cards.map((c) => c.relPath));
  const inFiles = (f) => files.has(fileOf(f.where));
  const before = ctrl.findings.filter(inFiles);
  try {
    const res = await apiClient.post('/api/qa/finding/batch-apply', {
      sessionId: plan.session.sessionId, revision: plan.session.revision, acceptedFindingKeys: keys,
    });
    if (!ctrl.alive) return;
    ctrl.selection.removeKeys(res.appliedFindingKeys);
    ctrl.lastApplied = { sessionId: res.sessionId, keys: res.appliedFindingKeys };
    ctrl.pending = { scanId: ctrl.scanId, inFiles, before, applied: res.appliedFindingKeys };
    modal.setBusy(false);
    modal.close();
    ctrl.busy = '';
    result.showApplied({
      appliedCount: res.appliedFindingKeys.length,
      fileCount: res.files.length,
      notAppliedCount: res.notApplied.length,
    });
    ctrl.slice.reload(true);
    ctrl.loadLatest();
  } catch (err) {
    if (!ctrl.alive) return;
    ctrl.busy = 'Đang xem trước bản vá…';
    modal.setBusy(false);
    modal.showError(applyErrorOf(err));
  }
  ctrl.refresh();
}

/** So finding trước/sau theo matchKey (không phụ thuộc số dòng) trên các file vừa sửa. */
export function rescanStats({ inFiles, before, applied }, findings) {
  const beforeCount = countMatch(before);
  const after = findings.filter(inFiles);
  const afterCount = countMatch(after);
  const left = new Map(beforeCount);
  let processed = 0;
  before.filter((f) => applied.includes(f.findingKey)).forEach((f) => {
    if ((afterCount.get(f.matchKey) || 0) < (left.get(f.matchKey) || 0)) {
      processed += 1;
      left.set(f.matchKey, left.get(f.matchKey) - 1);
    }
  });
  const newKeys = new Set(after
    .filter((f) => (afterCount.get(f.matchKey) || 0) > (beforeCount.get(f.matchKey) || 0))
    .map((f) => f.findingKey));
  return { processed, remaining: applied.length - processed, created: newKeys.size, newKeys };
}

export async function undoBatch(ctrl, sessionId, forceFiles = []) {
  const { result } = ctrl;
  if (!sessionId || ctrl.busy) return;
  ctrl.busy = 'Đang hoàn tác…';
  result.setUndoState({ visible: true, busy: true });
  ctrl.refresh();
  try {
    await apiClient.post('/api/qa/finding/batch-rollback', { sessionId, forceFiles });
    if (!ctrl.alive) return;
    ctrl.pending = null;
    ctrl.newKeys = new Set();
    if (ctrl.filter === 'new') ctrl.filter = 'all';
    // Chọn lại các lỗi vừa được hoàn tác; lần quét sau sẽ bỏ những key không còn.
    if (ctrl.lastApplied && ctrl.lastApplied.sessionId === sessionId) ctrl.selection.addKeys(ctrl.lastApplied.keys);
    result.showRolledBack();
    ctrl.slice.reload(true);
    ctrl.loadLatest();
  } catch (err) {
    if (!ctrl.alive) return;
    const payload = err.payload || {};
    ctrl.busy = '';
    result.setUndoState({ visible: result.visible, busy: false });
    if (payload.code === 'ROLLBACK_CONFLICT') {
      const files = (payload.details && payload.details.files) || [];
      const ok = await confirmDialog(ctrl.root.querySelector('#qa-batch-confirm'), {
        title: 'File đã bị sửa sau batch',
        message: 'Hoàn tác sẽ ghi đè các thay đổi này (bản hiện tại được sao lưu vào .dashboard-backups).',
        items: files,
        confirmText: 'Vẫn hoàn tác',
      });
      if (ok && ctrl.alive) {
        await undoBatch(ctrl, sessionId, files);
        return;
      }
    } else {
      ctrl.slice.notify(`Không hoàn tác được: ${err.message}`);
    }
  }
  ctrl.busy = '';
  ctrl.refresh();
}
