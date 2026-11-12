'use strict';

/**
 * Bóc khối chi tiết của từng test case: tiền điều kiện, tag, dữ liệu, và BẢNG BƯỚC.
 *
 * parseTestCases() ở trên cố tình đọc theo TỪNG DÒNG, vì nó chỉ cần đếm và truy vết — một
 * TC xuất hiện ở bảng traceability, ở automation plan và ở phần mô tả, cả ba đều phải gộp
 * lại. Cách đọc đó không bao giờ thấy được bảng `| Step | Action | Expected result |`.
 *
 * Hàm này giải quyết đúng phần còn thiếu đó, và giữ nguyên tắc: KHÔNG bịa. Tài liệu không
 * có bảng bước thì trả về mảng rỗng, để chỗ gọi nói thẳng là chưa đủ dữ liệu — thay vì sinh
 * ra một kịch bản trông có vẻ đầy đủ nhưng không dựa trên gì cả.
 */
const RE_TC_HEADING = /^(#{2,6})\s*(TC-\d{3})\s*[:：.\-—]?\s*(.*)$/;
const RE_META_BULLET = /^\s*[-*+]\s*\*{0,2}([A-Za-zÀ-ỹ][^:*]{0,40}?)\*{0,2}\s*:\s*(.+)$/;
const RE_TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const RE_TABLE_SEP = /^\s*\|[\s:|-]+\|\s*$/;

/** Bỏ dấu nhấn Markdown quanh một ô để văn bản đọc được như câu thường. */
function plain(value) {
  return String(value == null ? '' : value)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .trim();
}

const splitCells = (line) => line
  .replace(/^\s*\|/, '')
  .replace(/\|\s*$/, '')
  .split('|')
  .map((c) => c.trim());

/**
 * Nhận diện bảng bước bằng TÊN CỘT, không theo vị trí — tài liệu có thể thêm cột Note hay
 * Data mà thứ tự vẫn hợp lệ.
 * @returns {{action: number, expected: number, step: number}|null}
 */
function stepColumns(headerCells) {
  const norm = headerCells.map((c) => plain(c).toLowerCase());
  const find = (...names) => norm.findIndex((c) => names.some((n) => c.includes(n)));
  const action = find('action', 'hành động', 'thao tác');
  const expected = find('expected', 'kết quả', 'ket qua');
  if (action === -1 || expected === -1) return null;
  return { step: find('step', 'bước', 'buoc'), action, expected };
}

/**
 * @param {string} markdown Nội dung thô của một file test-case.
 * @returns {Map<string, {id: string, title: string, meta: Record<string,string>, steps: Array<{no: string, action: string, expected: string}>}>}
 */
function extractTestCaseDetails(markdown) {
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  const out = new Map();

  let current = null;
  let currentLevel = 0;
  let pendingCols = null;

  const close = () => { current = null; pendingCols = null; };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const heading = line.match(RE_TC_HEADING);
    if (heading) {
      current = { id: heading[2], title: plain(heading[3]), meta: {}, steps: [] };
      currentLevel = heading[1].length;
      pendingCols = null;
      // Test case xuất hiện hai lần trong cùng file (vd. cả ở bảng traceability) thì bản
      // có tiêu đề riêng thắng, vì đó mới là phần mô tả chi tiết.
      out.set(current.id, current);
      continue;
    }

    if (!current) continue;

    // Tiêu đề khác cùng cấp hoặc cao hơn => hết phần của test case này.
    const otherHeading = line.match(/^(#{1,6})\s+/);
    if (otherHeading && otherHeading[1].length <= currentLevel) { close(); continue; }

    const meta = line.match(RE_META_BULLET);
    if (meta) {
      current.meta[plain(meta[1]).toLowerCase()] = plain(meta[2]);
      continue;
    }

    if (RE_TABLE_SEP.test(line)) continue;

    const row = line.match(RE_TABLE_ROW);
    if (!row) continue;

    const cells = splitCells(line);
    if (!pendingCols) {
      pendingCols = stepColumns(cells);
      continue; // dòng này là header, không phải bước
    }
    const action = plain(cells[pendingCols.action]);
    const expected = plain(cells[pendingCols.expected]);
    if (!action && !expected) continue;
    current.steps.push({
      no: pendingCols.step >= 0 ? plain(cells[pendingCols.step]) : String(current.steps.length + 1),
      action,
      expected,
    });
  }

  return out;
}

module.exports = { extractTestCaseDetails };
