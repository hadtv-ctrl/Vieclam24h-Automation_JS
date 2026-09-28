'use strict';

/**
 * dashboard/services/qaFindingFixerService.js
 * Tra cứu chỉ đọc cho static finding (PLAN-18): phân giải vị trí `where` an toàn trong dự án
 * và trích đoạn mã quanh vị trí lỗi cho modal "Chi tiết & hướng dẫn". Việc sửa file nằm ở
 * engine batch (qaBatch*); luồng AI sửa lỗi cũ đã bỏ vì kết quả không xác định và ghi đè rủi ro.
 */

const fs = require('node:fs');
const path = require('node:path');

// Nạp trễ: qaService -> qaConflictService -> file này -> qaService là một vòng require.
const qaService = () => require('./qaService');

/**
 * Phân giải đường dẫn an toàn trong phạm vi thư mục dự án (Chống Path Traversal).
 */
function resolveSafePath(root, rawWhere) {
  if (!rawWhere || typeof rawWhere !== 'string') return null;
  let trimmed = rawWhere.trim();

  // Nếu chuỗi chứa nhiều file/vị trí cách nhau bởi dấu phẩy, lấy vị trí đầu tiên
  if (trimmed.includes(',')) {
    trimmed = trimmed.split(',')[0].trim();
  }
  // Bỏ phần chú thích trong ngoặc đơn nếu có: ví dụ "test-cases/REQ-002...md (REQ-002/AC-005)" -> "test-cases/REQ-002...md"
  trimmed = trimmed.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Nhận diện số dòng ở cuối chuỗi dạng :<number>
  const match = trimmed.match(/^(.*?)(?::(\d+))?$/);
  const rawPath = match ? match[1].trim() : trimmed;
  const lineStr = match ? match[2] : null;
  const cleanPath = rawPath.replace(/\\/g, '/');

  // Chặn đường dẫn tuyệt đối, ổ đĩa Windows (C:), và Path Traversal (..)
  if (path.isAbsolute(cleanPath) || cleanPath.includes('..') || /^[a-zA-Z]:/i.test(cleanPath)) {
    return null;
  }

  const absPath = path.resolve(root, cleanPath);
  const normalizedRoot = path.resolve(root);

  if (!absPath.startsWith(normalizedRoot + path.sep) && absPath !== normalizedRoot) {
    return null;
  }

  const lineNumber = lineStr ? parseInt(lineStr, 10) : null;
  return {
    relPath: cleanPath,
    absPath,
    lineNumber: Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null,
  };
}

const CONTEXT_RADIUS = 15;
const MAX_CONTEXT_FILE_BYTES = 512 * 1024;

/**
 * GET /api/qa/finding/context (PLAN-18): đoạn mã quanh vị trí finding, chỉ đọc, cho modal
 * "Chi tiết & hướng dẫn". Finding tra từ lần quét gần nhất của server theo findingKey.
 * `options.findingsIndex` chỉ dùng trong test.
 */
function getFindingContext(root, findingKey, options = {}) {
  if (typeof findingKey !== 'string' || !findingKey) {
    throw Object.assign(new Error('Thiếu findingKey.'), { status: 400, code: 'INVALID_BODY' });
  }
  let index = options.findingsIndex || qaService().getFindingsIndex(root);
  if (!index) {
    qaService().getQaSummary(root);
    index = qaService().getFindingsIndex(root);
  }
  const finding = index && index.byKey.get(findingKey);
  if (!finding) {
    throw Object.assign(new Error('Không tìm thấy finding trong lần quét gần nhất.'), { status: 404, code: 'FINDING_NOT_FOUND' });
  }
  const first = String(finding.where || finding.id || '').split(',')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!first) return { ok: true, finding, file: null };
  const resolved = resolveSafePath(root, first);
  if (!resolved) {
    throw Object.assign(new Error('Vị trí của finding nằm ngoài dự án.'), { status: 403, code: 'PATH_REJECTED' });
  }
  let stat = null;
  try {
    stat = fs.statSync(resolved.absPath);
  } catch (_) { /* file không tồn tại: chỉ trả thông tin finding */ }
  if (!stat || !stat.isFile() || stat.size > MAX_CONTEXT_FILE_BYTES) return { ok: true, finding, file: null };
  const lines = fs.readFileSync(resolved.absPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const center = resolved.lineNumber || 1;
  const startLine = Math.max(1, center - CONTEXT_RADIUS);
  const endLine = Math.min(lines.length, center + CONTEXT_RADIUS);
  return {
    ok: true,
    finding,
    file: { relPath: resolved.relPath, line: resolved.lineNumber, startLine, lines: lines.slice(startLine - 1, endLine) },
  };
}

module.exports = {
  getFindingContext,
  resolveSafePath,
};
