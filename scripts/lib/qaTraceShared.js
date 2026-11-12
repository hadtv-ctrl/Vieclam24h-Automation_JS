'use strict';

/** Hằng số, regex định danh và tiện ích đọc file dùng chung cho các module qaTrace*. */

const fs = require('fs');
const path = require('path');

const RE_REQ = /\bREQ-(\d{3})\b/g;
const RE_AC = /\bAC-(\d{3})\b/g;
const RE_TC = /\bTC-(\d{3})\b/g;
const RE_PRIORITY = /\bP([0-3])\b/;

// Cột "Automation" trong bảng traceability. Một TC khai KHÔNG automation là quyết định có chủ ý
// (kiểm tra thị giác, phụ thuộc bên thứ ba, chạy một lần rồi thôi) — cổng không được báo động mãi
// về nó, nếu không người ta sẽ quen với màu đỏ rồi bỏ qua cả cảnh báo thật.
const AUTOMATION_NO = new Set(['no', 'khong', 'không', 'manual', 'thu cong', 'thủ công', 'n/a']);
const AUTOMATION_CANDIDATE = new Set(['candidate', 'ung vien', 'ứng viên', 'planned', 'todo']);

// Bắt các chuỗi TRÔNG GIỐNG định danh nhưng sai quy ước: REQ-1, AC_012, tc-003, TC-0001.
// Một parser im lặng bỏ qua chúng còn tệ hơn không có parser: cổng sẽ báo "sạch" trong khi
// tài liệu thật ra không được đọc. Thà báo động nhầm còn hơn bỏ sót không ai biết.
const RE_NEAR_MISS = /\b(REQ|AC|TC)([-_ ]?)(\d{1,4})\b/gi;
const RE_EXACT = /^(REQ|AC|TC)-\d{3}$/;

function findMalformedIds(text) {
  const bad = new Set();
  for (const m of text.matchAll(RE_NEAR_MISS)) {
    if (!RE_EXACT.test(m[0])) bad.add(m[0]);
  }
  return [...bad];
}

function readAutomationColumn(line) {
  for (const cell of line.split('|').map((c) => c.trim().toLowerCase())) {
    if (AUTOMATION_NO.has(cell)) return 'no';
    if (AUTOMATION_CANDIDATE.has(cell)) return 'candidate';
    if (cell === 'yes' || cell === 'co' || cell === 'có') return 'yes';
  }
  return null;
}

const DEFAULT_DIRS = {
  requirements: 'requirements',
  testCases: 'test-cases',
  specs: 'tests',
};

/**
 * Nhãn tiếng Việt cho từng loại finding. Đặt ở lõi để CLI và dashboard dùng CHUNG một bản —
 * hai nơi tự đặt nhãn riêng thì sớm muộn cũng nói khác nhau về cùng một finding.
 */
const KIND_LABEL = {
  'ac-khong-co-tc': 'Nghiệp vụ chưa có test case',
  'tc-chua-automation': 'Test case chưa có script',
  'spec-khong-truy-vet': 'Spec không truy vết được về nghiệp vụ',
  'spec-vua-sua-khong-truy-vet': 'Spec vừa sửa nhưng không truy vết được',
  'sua-script-ma-khong-dong-tai-lieu': 'Sửa script mà tài liệu không đổi theo',
  'tai-lieu-khong-doc-duoc': 'Tài liệu công cụ KHÔNG đọc được (nguy cơ báo sạch giả)',
  'dinh-danh-sai-quy-uoc': 'Định danh sai quy ước',
  'req-thieu-ac': 'Requirement chưa có acceptance criterion',
  'test-khong-co-assertion': 'Test khai phủ AC nhưng không có assertion',
  'ac-lech-giua-tai-lieu-va-spec': 'Tài liệu và spec nói khác nhau',
  'tc-co-y-thu-cong': 'Test case cố ý giữ thủ công (không phải nợ)',
  'dinh-danh-khong-ton-tai': 'Tham chiếu tới định danh không tồn tại',
};

function isHubRepo(root) {
  try {
    const pkg = path.join(root, 'package.json');
    return fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf8')).name === '@hadinhkms/qa-automation-engine';
  } catch { return false; }
}

function listFiles(root, relativeDir, filter) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  const hub = isHubRepo(root);
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const relToRoot = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (!hub || (!relToRoot.startsWith('tests/dashboard') && relToRoot !== 'tests/dashboard')) walk(full);
      } else if (entry.isFile() && filter(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(absolute);
  return out.map((p) => path.relative(root, p).split(path.sep).join('/'));
}

function uniqueMatches(text, regex) {
  const found = new Set();
  for (const m of text.matchAll(regex)) found.add(m[0]);
  return [...found];
}

/** Bỏ khối code để không nhặt nhầm định danh nằm trong ví dụ code của tài liệu. */
function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

module.exports = {
  RE_REQ,
  RE_AC,
  RE_TC,
  RE_PRIORITY,
  DEFAULT_DIRS,
  KIND_LABEL,
  findMalformedIds,
  readAutomationColumn,
  isHubRepo,
  listFiles,
  uniqueMatches,
  stripCodeBlocks,
};
