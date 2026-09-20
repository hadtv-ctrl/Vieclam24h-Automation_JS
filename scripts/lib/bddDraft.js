'use strict';

/**
 * scripts/lib/bddDraft.js
 * Sinh BẢN THẢO VĂN BẢN của kịch bản BDD từ một test case đã có tài liệu.
 *
 * Cố ý dừng ở VĂN BẢN, không sinh mã. Lý do nằm ở bản chất dữ liệu: bảng bước trong tài
 * liệu mô tả HÀNH VI ("Mở landing của Instructor Portal"), không nói locator hay Page Object
 * nào. Sinh thẳng ra .spec.js thì phần thân mỗi bước buộc phải bịa — và một script trông
 * chạy được nhưng bịa locator còn tệ hơn không có script.
 *
 * Bản thảo văn bản thì ngược lại: mọi dòng đều truy về được một ô trong tài liệu, nên người
 * đọc kiểm được ngay. Khi nghiệp vụ đổi, chỉ cần sinh lại — KHÔNG lưu trữ bản thảo ở đâu cả,
 * để nó không bao giờ lệch khỏi tài liệu nguồn.
 *
 * Khuôn bám hai chuẩn đã có:
 *  - ai/shared/AI_PROMPTS.md §5: mỗi scenario một test(), chia bước Given/When/Then,
 *    Given phải có assertion + evidence, Precondition phải ghi thành annotation.
 *  - _Script_automation/templates/automation-plan-template.md: mục "Script contract"
 *    (spec file, test title, setup, steps, assertions, cleanup, evidence).
 */

const NL = '\n';

/** Bỏ dấu tiếng Việt và ký tự lạ để đề xuất tên file spec. */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Lấy giá trị meta theo nhiều cách viết mà tài liệu thực tế đang dùng. */
function metaOf(detail, ...keys) {
  const meta = (detail && detail.meta) || {};
  for (const key of keys) {
    const hit = Object.keys(meta).find((k) => k === key || k.startsWith(key));
    if (hit && meta[hit]) return meta[hit];
  }
  return null;
}

const LABEL = {
  yes: 'Yes — tài liệu khai đã automation',
  no: 'No — tài liệu khai cố ý thủ công',
  candidate: 'Candidate — ứng viên automation',
};

/**
 * @param {object} input
 * @param {{id: string, req: string|null, acs: string[], priority: string|null, automation: string|null, file: string}} input.candidate
 * @param {{title: string, meta: object, steps: Array<{no,action,expected}>}|null} input.detail
 * @param {{specs: string}} input.dirs Thư mục spec của repo, để đề xuất đường dẫn đúng chỗ.
 * @returns {{id: string, text: string, stepCount: number, warnings: string[]}}
 */
function buildBddDraft({ candidate, detail, dirs = {} } = {}) {
  const id = (candidate && candidate.id) || (detail && detail.id) || 'TC-???';
  // candidate.title được parseTestCases lấy theo DÒNG, nên khi test case chỉ xuất hiện trong
  // bảng traceability thì nó là nguyên một hàng `| REQ-001 | AC-002 | TC-002 | ... |`.
  // Dùng thẳng làm tiêu đề thì bản thảo trông như hỏng.
  const rawTitle = (detail && detail.title) || (candidate && candidate.title) || '';
  const title = (!rawTitle || rawTitle.includes('|'))
    ? '(tài liệu chưa có mục riêng cho test case này)'
    : rawTitle;
  const steps = (detail && detail.steps) || [];
  const warnings = [];

  const precondition = metaOf(detail, 'precondition', 'tiền điều kiện', 'tien dieu kien');
  const tags = metaOf(detail, 'tags', 'tag');
  const testData = metaOf(detail, 'test data', 'dữ liệu', 'du lieu');
  const technique = metaOf(detail, 'technique', 'kỹ thuật');
  const priority = (candidate && candidate.priority) || metaOf(detail, 'priority', 'ưu tiên');
  const automation = (candidate && candidate.automation) || null;

  if (!steps.length) {
    warnings.push(`${id}: tài liệu chưa có bảng "Step | Action | Expected result" — không dựng được bước nào.`);
  }
  if (!precondition) {
    warnings.push(`${id}: thiếu mục "Preconditions" — bước Given sẽ phải tự xác định.`);
  }

  const specsDir = dirs.specs || 'tests';
  const specPath = `${specsDir}/e2e/<nhóm>/${slugify(title) || slugify(id)}.spec.js`;

  const out = [];
  out.push(`# ${id} - ${title}`);
  out.push('');

  out.push('## Truy vết');
  out.push(`- Requirement: ${(candidate && candidate.req) || '(chưa gắn)'}`);
  out.push(`- Acceptance criteria: ${(candidate && candidate.acs && candidate.acs.length) ? candidate.acs.join(', ') : '(chưa gắn)'}`);
  out.push(`- Nguồn: ${(candidate && candidate.file) || '(không rõ)'}`);
  if (priority) out.push(`- Ưu tiên: ${priority}`);
  if (automation) out.push(`- Khai báo automation: ${LABEL[String(automation).toLowerCase()] || automation}`);
  if (technique) out.push(`- Kỹ thuật thiết kế: ${technique}`);
  out.push('');

  // Khuôn bắt buộc, lấy từ automation-plan-template.md của _Script_automation.
  out.push('## Script contract');
  out.push(`- Spec file: \`${specPath}\``);
  out.push(`- Test title: \`${id} - ${title}\``);
  out.push(`- Tags: ${tags || '(chưa khai trong tài liệu)'}`);
  out.push(`- Precondition: ${precondition || '(chưa khai trong tài liệu)'}`);
  out.push(`- Test data: ${testData || '(chưa khai trong tài liệu)'}`);
  out.push('- Evidence khi fail: trace, screenshot, video');
  out.push('');

  out.push('## Kịch bản BDD');
  out.push('');
  out.push(`Given Tiền điều kiện: ${precondition || '<xác định trạng thái xuất phát>'}`);
  out.push('      · Khẳng định trạng thái xuất phát đúng trước khi thao tác.');
  out.push('');

  steps.forEach((step, index) => {
    const no = step.no || String(index + 1);
    if (step.action) out.push(`When  [${no}] ${step.action}`);
    if (step.expected) out.push(`Then  [${no}] ${step.expected}`);
    out.push('');
  });

  if (!steps.length) {
    out.push('When  <chưa có bước nào trong tài liệu>');
    out.push('Then  <chưa có kết quả mong đợi nào trong tài liệu>');
    out.push('');
  }

  // Nói thẳng phần tài liệu KHÔNG trả lời được, thay vì để người đọc tự phát hiện khi code.
  out.push('## Tài liệu chưa trả lời được');
  out.push('- Locator / Page Object cho từng bước: bảng bước chỉ mô tả hành vi người dùng.');
  out.push('- Dữ liệu khởi tạo cụ thể và cách dọn sau khi chạy.');
  out.push('- Fixture nào cung cấp trạng thái đăng nhập cho Precondition.');
  out.push('');

  out.push('## Checklist sẵn sàng automation');
  for (const item of [
    'Locator ổn định (`data-testid` hoặc role/name truy cập được).',
    'Dữ liệu test seed và dọn được.',
    'Không phụ thuộc secret/OTP/thanh toán thật.',
    'Kết quả mong đợi là tất định.',
    'Test độc lập, chạy lại được.',
    `Tiêu đề/tag có mang mã ${id}${(candidate && candidate.req) ? ` và ${candidate.req}` : ''}.`,
  ]) out.push(`- [ ] ${item}`);

  return { id, text: out.join(NL), stepCount: steps.length, warnings };
}

/**
 * Gộp nhiều bản thảo thành một văn bản BDD sạch sẽ, sẵn sàng sử dụng.
 * Lưu ý về việc bản thảo không lưu vào đĩa được hiển thị trực tiếp trên Dashboard UI.
 */
function buildBddDraftDocument(drafts, context = {}) {
  const out = [];

  const allWarnings = drafts.flatMap((d) => d.warnings);
  if (allWarnings.length) {
    out.push('## Cảnh báo');
    for (const w of allWarnings) out.push(`- ${w}`);
    out.push('');
  }

  if (drafts.length > 1) {
    out.push(`# Danh sách kịch bản BDD (${drafts.length} test cases)`);
    out.push('');
  }

  drafts.forEach((draft, idx) => {
    if (idx > 0) {
      out.push('');
      out.push('---');
      out.push('');
    }
    out.push(draft.text);
  });

  return out.join(NL) + NL;
}

module.exports = { buildBddDraft, buildBddDraftDocument, slugify };
