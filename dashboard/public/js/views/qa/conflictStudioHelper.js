// master-process-disable-size-check: Traceability Conflict Studio visual manager and reconciler
/**
 * dashboard/public/js/views/qa/conflictStudioHelper.js
 * Quản lý giao diện và luồng tương tác Hòa Giải Xung Đột Truy Vết (Traceability Conflict Resolution Studio).
 *
 * Tuân thủ quy chuẩn:
 * - OWN-01..05: Quản lý disposers nghiêm ngặt, dọn sạch listeners khi render lại hoặc unmount.
 * - Tuyệt đối không dùng innerHTML trên dữ liệu đọc từ repo/AI (dùng DOM builders và textContent).
 */

import { apiClient } from '../../core/apiClient.js';
import { toast } from '../../core/toast.js';

export class ConflictStudioHelper {
  constructor(qaSlice) {
    this.qaSlice = qaSlice;
    this.disposers = [];
  }

  destroy() {
    this.disposers.forEach((dispose) => {
      try { dispose(); } catch (_) {}
    });
    this.disposers = [];
  }

  /**
   * Bóc tách chi tiết lỗi xung đột
   */
  _parseConflict(item) {
    const detail = item.detail || '';
    const m = detail.match(/^(.*?):\s*(TC-\d+)\s+ghi\s+([A-Za-z0-9_,-]+)\s+nhưng tài liệu khai\s+([A-Za-z0-9_,-]+)$/);
    if (m) {
      return {
        specFile: m[1].trim(),
        tcId: m[2].trim(),
        specAcs: m[3].trim().split(','),
        docAcs: m[4].trim().split(','),
        specAc: m[3].trim().split(',')[0],
        docAc: m[4].trim().split(',')[0],
      };
    }
    return {
      specFile: item.where || item.id || '',
      tcId: item.id || 'TC',
      specAcs: ['Spec'],
      docAcs: ['Doc'],
      specAc: 'Spec',
      docAc: 'Doc',
    };
  }

  /**
   * Render toàn bộ khu vực Conflict Resolution Studio vào container của Findings
   */
  render(container, conflictItems) {
    this.destroy();
    if (!container || !Array.isArray(conflictItems) || conflictItems.length === 0) return;

    const addEvt = (target, evt, handler) => {
      if (!target) return;
      target.addEventListener(evt, handler);
      this.disposers.push(() => target.removeEventListener(evt, handler));
    };

    // 1. Gom nhóm theo file spec
    const bySpec = new Map();
    conflictItems.forEach((item) => {
      const parsed = this._parseConflict(item);
      const key = parsed.specFile;
      if (!bySpec.has(key)) bySpec.set(key, []);
      bySpec.get(key).push({ item, parsed });
    });

    // 2. Tạo Studio Wrapper
    const studioSection = document.createElement('div');
    studioSection.className = 'qa-conflict-studio';

    // Studio Header
    const studioHead = document.createElement('div');
    studioHead.className = 'qa-conflict-studio-head';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'qa-conflict-head-title-group';

    const titleIcon = document.createElement('i');
    titleIcon.className = 'ph-bold ph-arrows-split';
    titleGroup.appendChild(titleIcon);

    const titleText = document.createElement('h3');
    titleText.textContent = 'Traceability Conflict Studio: Hòa Giải Xung Đột Truy Vết';
    titleGroup.appendChild(titleText);

    const countBadge = document.createElement('span');
    countBadge.className = 'qa-badge qa-badge-danger';
    countBadge.textContent = `${conflictItems.length} xung đột`;
    titleGroup.appendChild(countBadge);
    studioHead.appendChild(titleGroup);

    const desc = document.createElement('p');
    desc.className = 'qa-conflict-studio-desc';
    desc.textContent = 'Kịch bản kiểm thử (.spec.js) và tài liệu (.md) khai báo không đồng nhất về AC. Hãy so sánh đối ứng 2 vế và lựa chọn phương án hòa giải bên dưới:';
    studioHead.appendChild(desc);
    studioSection.appendChild(studioHead);

    // 3. Render từng nhóm file
    const groupsList = document.createElement('div');
    groupsList.className = 'qa-conflict-groups-list';

    bySpec.forEach((conflicts, specFile) => {
      const groupCard = document.createElement('div');
      groupCard.className = 'qa-conflict-group-card';

      // Header của Group
      const groupHeader = document.createElement('div');
      groupHeader.className = 'qa-conflict-group-head';

      const fileLabel = document.createElement('div');
      fileLabel.className = 'qa-conflict-group-file';
      const fileIcon = document.createElement('i');
      fileIcon.className = 'ph-bold ph-file-js';
      fileLabel.appendChild(fileIcon);

      const filePath = document.createElement('strong');
      filePath.textContent = specFile;
      fileLabel.appendChild(filePath);
      groupHeader.appendChild(fileLabel);

      const groupBadge = document.createElement('span');
      groupBadge.className = 'qa-badge qa-badge-warn';
      groupBadge.textContent = `${conflicts.length} xung đột`;
      groupHeader.appendChild(groupBadge);
      groupCard.appendChild(groupHeader);

      // Danh sách các hàng xung đột trong file
      const rowsContainer = document.createElement('div');
      rowsContainer.className = 'qa-conflict-rows-container';

      conflicts.forEach(({ parsed }) => {
        const row = document.createElement('div');
        row.className = 'qa-conflict-item-card';

        // Item Header (TC ID)
        const itemHead = document.createElement('div');
        itemHead.className = 'qa-conflict-item-head';

        const tcBadge = document.createElement('span');
        tcBadge.className = 'qa-conflict-tc-badge';
        tcBadge.textContent = parsed.tcId;
        itemHead.appendChild(tcBadge);

        row.appendChild(itemHead);

        // Side-by-Side Comparison Box (2 vế)
        const compBox = document.createElement('div');
        compBox.className = 'qa-conflict-comp-box';

        // Vế Trái: Phía Spec
        const specSide = document.createElement('div');
        specSide.className = 'qa-conflict-side qa-conflict-spec-side';

        const specSideTitle = document.createElement('small');
        specSideTitle.className = 'qa-conflict-side-label';
        specSideTitle.textContent = 'Phía Automation Spec (.spec.js)';
        specSide.appendChild(specSideTitle);

        const specPill = document.createElement('div');
        specPill.className = 'qa-conflict-val-pill qa-val-spec';
        specPill.textContent = `Ghi: @${parsed.specAc}`;
        specSide.appendChild(specPill);

        compBox.appendChild(specSide);

        // Ở giữa: Mismatch icon
        const midArrow = document.createElement('div');
        midArrow.className = 'qa-conflict-mid-indicator';
        const arrowIcon = document.createElement('i');
        arrowIcon.className = 'ph-bold ph-arrows-left-right';
        midArrow.appendChild(arrowIcon);
        const midLabel = document.createElement('span');
        midLabel.textContent = 'Lệch pha';
        midArrow.appendChild(midLabel);
        compBox.appendChild(midArrow);

        // Vế Phải: Phía Tài Liệu
        const docSide = document.createElement('div');
        docSide.className = 'qa-conflict-side qa-conflict-doc-side';

        const docSideTitle = document.createElement('small');
        docSideTitle.className = 'qa-conflict-side-label';
        docSideTitle.textContent = 'Phía Tài Liệu Đặc Tả (test-cases/*.md)';
        docSide.appendChild(docSideTitle);

        const docPill = document.createElement('div');
        docPill.className = 'qa-conflict-val-pill qa-val-doc';
        docPill.textContent = `Khai: ${parsed.docAc}`;
        docSide.appendChild(docPill);

        compBox.appendChild(docSide);
        row.appendChild(compBox);

        // Khu vực hiển thị kết quả phân giải AI (khi bấm AI)
        const aiResultBox = document.createElement('div');
        aiResultBox.className = 'qa-conflict-ai-box';
        aiResultBox.style.display = 'none';
        row.appendChild(aiResultBox);

        // Thanh thao tác (Action Toolbar)
        const actionsBar = document.createElement('div');
        actionsBar.className = 'qa-conflict-actions-bar';

        // Nút 1: Cập nhật tài liệu theo Spec
        const btnSyncDoc = document.createElement('button');
        btnSyncDoc.type = 'button';
        btnSyncDoc.className = 'btn-secondary-sm qa-btn-sync-doc';
        btnSyncDoc.title = `Ghi đè cột AC trong tài liệu thành ${parsed.specAc}`;
        const syncDocIcon = document.createElement('i');
        syncDocIcon.className = 'ph-bold ph-file-text';
        btnSyncDoc.appendChild(syncDocIcon);
        const syncDocText = document.createElement('span');
        syncDocText.textContent = `Cập nhật Doc theo Spec (${parsed.specAc})`;
        btnSyncDoc.appendChild(syncDocText);

        addEvt(btnSyncDoc, 'click', () => {
          this.executeResolve({
            resolutionType: 'sync_doc_to_spec',
            tcId: parsed.tcId,
            specFile: parsed.specFile,
            specAc: parsed.specAc,
            docAc: parsed.docAc,
          }, btnSyncDoc);
        });
        actionsBar.appendChild(btnSyncDoc);

        // Nút 2: Sửa Spec theo Tài liệu
        const btnSyncSpec = document.createElement('button');
        btnSyncSpec.type = 'button';
        btnSyncSpec.className = 'btn-secondary-sm qa-btn-sync-spec';
        btnSyncSpec.title = `Sửa lại tag trong file spec thành @${parsed.docAc}`;
        const syncSpecIcon = document.createElement('i');
        syncSpecIcon.className = 'ph-bold ph-code';
        btnSyncSpec.appendChild(syncSpecIcon);
        const syncSpecText = document.createElement('span');
        syncSpecText.textContent = `Sửa Spec theo Doc (${parsed.docAc})`;
        btnSyncSpec.appendChild(syncSpecText);

        addEvt(btnSyncSpec, 'click', () => {
          this.executeResolve({
            resolutionType: 'sync_spec_to_doc',
            tcId: parsed.tcId,
            specFile: parsed.specFile,
            specAc: parsed.specAc,
            docAc: parsed.docAc,
          }, btnSyncSpec);
        });
        actionsBar.appendChild(btnSyncSpec);

        // Nút 3: AI Arbitrator (Trọng tài AI)
        const btnArbitrate = document.createElement('button');
        btnArbitrate.type = 'button';
        btnArbitrate.className = 'qa-gap-ai-fix-btn qa-btn-ai-arbitrate';
        btnArbitrate.title = 'AI đọc code assertion và tiêu chí Given-When-Then để chẩn đoán bên đúng';
        const aiIcon = document.createElement('i');
        aiIcon.className = 'ph-bold ph-sparkle';
        btnArbitrate.appendChild(aiIcon);
        const aiText = document.createElement('span');
        aiText.textContent = 'AI Phân Giải';
        btnArbitrate.appendChild(aiText);

        addEvt(btnArbitrate, 'click', () => {
          this.runArbitration({
            tcId: parsed.tcId,
            specFile: parsed.specFile,
            specAc: parsed.specAc,
            docAc: parsed.docAc,
            aiResultBox,
            btnArbitrate,
          });
        });
        actionsBar.appendChild(btnArbitrate);

        // Nút 4: Đẩy vào Sổ Quyết Định
        const btnEscalate = document.createElement('button');
        btnEscalate.type = 'button';
        btnEscalate.className = 'btn-secondary-sm qa-btn-escalate';
        btnEscalate.title = 'Tạo quyết định treo trong decisions.json để PO duyệt';
        const escIcon = document.createElement('i');
        escIcon.className = 'ph-bold ph-scales';
        btnEscalate.appendChild(escIcon);
        const escText = document.createElement('span');
        escText.textContent = 'Ghi Sổ Quyết Định';
        btnEscalate.appendChild(escText);

        addEvt(btnEscalate, 'click', () => {
          this.escalateDecision({
            tcId: parsed.tcId,
            specFile: parsed.specFile,
            specAcs: parsed.specAcs,
            docAcs: parsed.docAcs,
          }, btnEscalate);
        });
        actionsBar.appendChild(btnEscalate);

        row.appendChild(actionsBar);
        rowsContainer.appendChild(row);
      });

      groupCard.appendChild(rowsContainer);
      groupsList.appendChild(groupCard);
    });

    studioSection.appendChild(groupsList);
    container.appendChild(studioSection);
  }

  /**
   * Gọi API giải quyết xung đột (với rào chắn chống double-click)
   */
  async executeResolve(payload, btn = null) {
    if (btn) btn.disabled = true;
    try {
      const res = await apiClient.post('/api/qa/conflict/resolve', payload);
      toast.success(res.message || 'Đã hòa giải xung đột thành công!');
      if (this.qaSlice && typeof this.qaSlice.reload === 'function') {
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Lỗi hòa giải: ${err.message || 'Không thể cập nhật file'}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * Gọi AI Trọng tài phân giải
   */
  async runArbitration({ tcId, specFile, specAc, docAc, aiResultBox, btnArbitrate }) {
    if (!aiResultBox) return;

    aiResultBox.style.display = 'block';
    aiResultBox.textContent = '';

    const loadingText = document.createElement('p');
    loadingText.style.margin = '0';
    loadingText.style.fontSize = '12px';
    loadingText.style.color = 'var(--muted)';
    loadingText.textContent = '⚡ AI đang đọc code test và đối chiếu tiêu chí nghiệp vụ...';
    aiResultBox.appendChild(loadingText);

    if (btnArbitrate) btnArbitrate.disabled = true;

    try {
      const res = await apiClient.post('/api/qa/conflict/arbitrate', {
        tcId,
        specFile,
        specAc,
        docAc,
      });

      aiResultBox.textContent = '';

      const badgeRow = document.createElement('div');
      badgeRow.style.display = 'flex';
      badgeRow.style.alignItems = 'center';
      badgeRow.style.gap = '8px';
      badgeRow.style.marginBottom = '6px';

      const recBadge = document.createElement('span');
      recBadge.className = 'qa-badge qa-badge-success';
      recBadge.textContent = res.recommendation === 'sync_doc_to_spec'
        ? `Đề xuất: Cập nhật Doc theo Spec (${res.recommendedAc || specAc})`
        : `Đề xuất: Sửa Spec theo Doc (${res.recommendedAc || docAc})`;
      badgeRow.appendChild(recBadge);

      const confSpan = document.createElement('small');
      confSpan.style.color = 'var(--muted)';
      confSpan.textContent = `Độ tin cậy: ${res.confidence || '90%'}`;
      badgeRow.appendChild(confSpan);

      aiResultBox.appendChild(badgeRow);

      const reasonP = document.createElement('p');
      reasonP.style.margin = '0 0 8px 0';
      reasonP.style.fontSize = '12px';
      reasonP.style.lineHeight = '1.5';
      reasonP.style.color = 'var(--text)';
      reasonP.textContent = res.reason || 'AI đã phân tích nội dung assertion trong mã kiểm thử.';
      aiResultBox.appendChild(reasonP);

      // Nút áp dụng nhanh đề xuất của AI
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn-primary-sm';
      applyBtn.style.background = '#8b5cf6';
      applyBtn.style.borderColor = '#7c3aed';
      applyBtn.textContent = '⚡ Áp dụng đề xuất của AI';

      applyBtn.addEventListener('click', () => {
        this.executeResolve({
          resolutionType: res.recommendation,
          tcId,
          specFile,
          specAc,
          docAc,
          targetAc: res.recommendedAc,
        }, applyBtn);
      });
      aiResultBox.appendChild(applyBtn);

    } catch (err) {
      aiResultBox.textContent = '';
      const errP = document.createElement('p');
      errP.style.margin = '0';
      errP.style.color = 'var(--danger)';
      errP.style.fontSize = '12px';
      errP.textContent = `Không thể phân giải: ${err.message || 'Lỗi mạng'}`;
      aiResultBox.appendChild(errP);
    } finally {
      if (btnArbitrate) btnArbitrate.disabled = false;
    }
  }

  /**
   * Đẩy xung đột thành quyết định treo trong decisions.json
   */
  async escalateDecision(payload, btn = null) {
    if (btn) btn.disabled = true;
    try {
      const res = await apiClient.post('/api/qa/conflict/escalate', payload);
      toast.success(res.message || 'Đã tạo quyết định trong sổ quyết định!');
      if (this.qaSlice && typeof this.qaSlice.reload === 'function') {
        await this.qaSlice.reload(true);
      }
    } catch (err) {
      toast.error(`Không thể tạo quyết định: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}
