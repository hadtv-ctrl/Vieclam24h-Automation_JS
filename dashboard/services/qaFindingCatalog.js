'use strict';

/**
 * dashboard/services/qaFindingCatalog.js
 * Nguồn sự thật duy nhất (PLAN-18) cho tuyến xử lý của từng loại static finding và định danh
 * ổn định của finding. Server gắn sẵn `findingKey`, `matchKey`, `fixRoute` vào mỗi finding;
 * UI chỉ đọc, không tự suy luận route và không tự băm (trình duyệt truy cập qua HTTP trong LAN
 * không có `crypto.subtle`).
 */

const crypto = require('node:crypto');

/**
 * quick: sửa tự động bằng quy tắc xác định; guided: cần người dùng chọn (Phase 4);
 * scaffold / autofix: mở công cụ sẵn có; manual: chỉ hướng dẫn. Kind không có ở đây là manual.
 */
const FIX_ROUTES = Object.freeze({
  'assertion-thieu-await': 'quick',
  'test-bi-skip-am-tham': 'quick',
  'test-thieu-tag-req': 'quick',
  'test-khong-co-ma-tc': 'guided',
  'spec-thieu-assertion': 'manual',
  'khong-doc-duoc-requirement': 'scaffold',
  'script-khong-co-trong-test-case': 'autofix',
  'ma-tc-trung': 'manual',
});

function routeFor(kind) {
  return FIX_ROUTES[kind] || 'manual';
}

/** Lý do một finding không được sửa tự động, hiển thị nguyên văn trên UI. */
const REASON_TEXT = Object.freeze({
  NOT_IN_LATEST_SCAN: 'Không còn trong lần quét mới nhất (có thể đã được sửa).',
  MANUAL_ROUTE: 'Loại lỗi này không sửa tự động; xem hướng dẫn.',
  PATH_REJECTED: 'Đường dẫn nằm ngoài dự án hoặc không hợp lệ.',
  LINE_UNKNOWN: 'Không xác định được dòng lỗi.',
  FILE_NOT_FOUND: 'Không đọc được file (không tồn tại, là thư mục hoặc quá lớn).',
  ALREADY_FIXED: 'Đã được sửa.',
  IN_EXPRESSION: 'expect nằm trong mảng hoặc đối số (vd. Promise.all); thêm await sẽ đổi ngữ nghĩa, cần sửa tay.',
  SYNTAX_INVALID: 'Bản vá làm file không parse được (vd. await trong callback không async), cần sửa tay.',
  SCANNER_UNAVAILABLE: 'Chưa có tools/qa bản mới để định vị chính xác; cần đồng bộ từ Hub.',
  NOT_RESOLVED: 'Bản vá không làm lỗi biến mất, cần sửa tay.',
  TITLE_NOT_ON_LINE: 'Title không nằm cùng dòng với lời gọi test, cần sửa tay.',
  TEMPLATE_TITLE: 'Title là template literal có biến, cần sửa tay.',
  CONDITIONAL_SKIP: 'test.skip có điều kiện, không kích hoạt lại tự động.',
  REQ_UNKNOWN: 'Không suy ra được REQ từ bảng traceability hay tên file.',
  REQ_AMBIGUOUS: 'Có nhiều REQ khả dĩ, cần chọn tay.',
  REQ_NOT_FOUND: 'REQ suy ra được không có trong thư mục requirements.',
  DESCRIBE_MIXED_REQ: 'test.describe đang chứa test thuộc REQ khác, cần tách hoặc sửa tay.',
  DESCRIBE_NOT_RESOLVED: 'Không xác định được test.describe bao quanh, cần sửa tay.',
  UNSUPPORTED_FILE: 'Không kiểm tra cú pháp được loại file này nên không sửa tự động.',
  AC_REQUIRED: 'Chưa chọn AC cho test này.',
  REQ_NO_AC: 'Requirement của test chưa có AC nào để gán.',
  NO_TRACEABILITY_TABLE: 'Chưa có file test-cases chứa bảng Traceability cho REQ này.',
  TC_OVERFLOW: 'Đã dùng hết mã TC-001..TC-999; cần tách REQ hoặc đánh số lại.',
  TC_TAKEN: 'Mã TC đã giữ chỗ vừa bị dùng ở nơi khác; hãy lập lại kế hoạch.',
});

function reasonText(code) {
  return REASON_TEXT[code] || code;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function shortHash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function whereOf(finding) {
  return normalizePath(finding.where || finding.id || '');
}

function messageOf(finding) {
  return String(finding.message || finding.detail || '');
}

/** Định danh một vị trí cụ thể: cùng kind, cùng `path:line`, cùng message là một finding. */
function createFindingKey(finding) {
  return shortHash(`${finding.kind || ''}|${whereOf(finding)}|${messageOf(finding)}`);
}

/**
 * Bỏ số dòng khỏi vị trí: dùng để so trước/sau khi quét lại mà không bị lệch khi một bản vá
 * làm dịch dòng của các finding khác trong cùng file.
 */
function createMatchKey(finding) {
  return shortHash(`${finding.kind || ''}|${whereOf(finding).replace(/:\d+$/, '')}|${messageOf(finding)}`);
}

/**
 * Gắn định danh + route và gộp finding trùng. Cùng một spec nằm trong nhiều Playwright project
 * nên scanner báo lặp lại y hệt; `occurrences` giữ số lần lặp để UI hiện badge.
 */
function enrichFindings(findings) {
  const byKey = new Map();
  for (const finding of Array.isArray(findings) ? findings : []) {
    if (!finding || typeof finding !== 'object') continue;
    const findingKey = createFindingKey(finding);
    const existing = byKey.get(findingKey);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    byKey.set(findingKey, {
      ...finding,
      findingKey,
      matchKey: createMatchKey(finding),
      fixRoute: routeFor(finding.kind),
      occurrences: 1,
    });
  }
  return [...byKey.values()];
}

module.exports = {
  FIX_ROUTES,
  REASON_TEXT,
  routeFor,
  reasonText,
  createFindingKey,
  createMatchKey,
  enrichFindings,
};
