/**
 * qaBoundaryExtract.js - Trích xuất ràng buộc giá trị biên từ văn bản đặc tả yêu cầu.
 * Thuần thuật toán xác định (0 token AI), tối ưu hiệu năng pre-compiled regex, ngân sách dòng <= 200.
 */

const BLOCKED_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d+,\d+\b/,
  /\b\d+\.\d{1,2}\b(?!\d)/,
  /(?:^|[^\p{L}\p{N}])(?:triệu|nghìn|ngàn|tỷ|đồng|vnđ|vnd|usd|\$)(?:[^\p{L}\p{N}]|$)/iu,
  /(?:^|[^\p{L}\p{N}])(?:ngày|tháng|năm|quý|tuần|phiên\s+bản|version|v)\s*\d+/iu
];

const REVIEW_KEYWORDS = /(?:^|[^\p{L}\p{N}])(?:báo\s+lỗi|bị\s+chặn|không\s+hợp\s+lệ|không\s+cho\s+phép|từ\s+chối|error|reject|invalid)(?:[^\p{L}\p{N}]|$)/iu;
const RE_TAIL_WORDS = /\s+(?:phải|có|là|có\s+độ\s+dài|độ\s+dài|dài|được|chỉ|cho\s+phép\s+chọn|cho\s+phép|chọn|(?<!đăng\s)(?<!lần\s)nhập|gồm|không\s+được|must\s+be|must|should\s+be|should|be|is)\b/gi;
const RE_DIGITS = /(?:^|[^\p{L}\p{N}])(?:chữ\s+số|digits?)(?:[^\p{L}\p{N}]|$)/iu;
const RE_CHARS = /(?:^|[^\p{L}\p{N}])(?:ký\s+tự|characters?)(?:[^\p{L}\p{N}]|$)/iu;
const RE_CHAR_MATCH = /(characters?|ký\s+tự)/iu;
const RE_NUM_UNITS = /(?:^|[^\p{L}\p{N}])(tuổi|mục|ảnh|file|tệp|lần|người|giây|phút|giờ|ngày|sản\s+phẩm|items?)(?:[^\p{L}\p{N}]|$)/iu;
const RE_SENTENCE_SPLIT = /(?<=[;!?]|(?<!\d)\.(?!\d))(?:\s+|$)/;
const RE_CLAUSE_SPLIT = /,\s*(?=[A-ZÀ-Ỹa-zà-ỹ].*?\d)/;
const RE_THOUSAND_SEP = /\b(\d{1,3})[.,](\d{3})\b/g;

// Clause extraction patterns
const RE_RANGE_1 = /(.*?)(?:^|[^\p{L}\p{N}])(?:từ|trong\s+khoảng|between)\s+(\d+)\s*(?:đến|tới|and|-)\s*(\d+)(.*)/iu;
const RE_RANGE_2 = /(.*?)(?:^|[^\p{L}\p{N}])(\d+)\s*-\s*(\d+)(.*)/;
const RE_RANGE_3 = /(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+thiểu|ít\s+nhất|>=\s*)\s*(\d+).*?và\s*(?:tối\s+đa|<=\s*)\s*(\d+)(.*)/iu;
const RE_EXACT = /(.*?)(?:^|[^\p{L}\p{N}])(?:gồm\s+đúng|đúng|gồm)\s+(\d+)(.*)/iu;
const RE_GT = /(.*?)(?:^|[^\p{L}\p{N}])(?:lớn\s+hơn|phải\s+lớn\s+hơn|greater\s+than|trên)\s+(\d+)(.*)/iu;
const RE_LT = /(.*?)(?:^|[^\p{L}\p{N}])(?:nhỏ\s+hơn|phải\s+nhỏ\s+hơn|less\s+than|dưới)\s+(\d+)(.*)/iu;
const RE_GTE_1 = /(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+thiểu|ít\s+nhất|at\s+least|>=\s*)\s*:?\s*(\d+)(.*)/iu;
const RE_GTE_2 = /(.*?)(?:^|[^\p{L}\p{N}])từ\s+(\d+)\s*(.*?)\s*trở\s+lên(.*)/iu;
const RE_LTE_1 = /(.*?)(?:^|[^\p{L}\p{N}])(?:tối\s+đa|không\s+vượt\s+quá|không\s+quá|không\s+nhiều\s+hơn|không\s+được\s+dài\s+hơn|at\s+most|<=\s*)\s*:?\s*(\d+)(.*)/iu;
const RE_LTE_2 = /(.*?)(?:^|[^\p{L}\p{N}])từ\s+(\d+)\s*(.*?)\s*trở\s+xuống(.*)/iu;

function cleanField(raw) {
  let f = (raw || '').trim().replace(/^[-*•\d.)\s]+/, '').replace(/^[,;:\s]+/, '').replace(/[,;:\s]+$/, '');
  let prev;
  do {
    prev = f;
    f = f.replace(RE_TAIL_WORDS, '').replace(/[,;:\s]+$/, '');
  } while (f !== prev);
  f = f.trim();
  return f.length > 0 ? (f.charAt(0).toUpperCase() + f.slice(1)) : f;
}

function detectKindAndUnit(afterText, fullText) {
  const combined = afterText || fullText || '';
  if (RE_DIGITS.test(combined)) return { kind: 'length', unit: 'chữ số' };
  if (RE_CHARS.test(combined)) {
    const m = combined.match(RE_CHAR_MATCH);
    return { kind: 'length', unit: m ? m[0].toLowerCase() : 'ký tự' };
  }
  const numMatch = (afterText || '').match(RE_NUM_UNITS);
  return numMatch ? { kind: 'number', unit: numMatch[1].toLowerCase() } : { kind: 'number', unit: null };
}

function createConstraint(field, ku, min, max, lineNo, originalSentence, needsReview) {
  let actualMin = min;
  let actualMax = max;
  if (actualMin !== null && actualMax !== null && actualMin > actualMax) {
    actualMin = max;
    actualMax = min;
  }
  return {
    constraint: {
      field, kind: ku.kind, unit: ku.unit, min: actualMin, max: actualMax,
      implicitMin: ku.kind === 'length' && actualMin === null,
      needsReview, source: { line: lineNo, text: originalSentence }
    }
  };
}

function extractSingleClause(text, lineNo, needsReview, originalSentence) {
  let m = text.match(RE_RANGE_1) || text.match(RE_RANGE_2) || text.match(RE_RANGE_3);
  if (m && m[2] !== undefined && m[3] !== undefined) {
    return createConstraint(cleanField(m[1]), detectKindAndUnit(m[4] || '', text), parseInt(m[2], 10), parseInt(m[3], 10), lineNo, originalSentence, needsReview);
  }

  const mExact = text.match(RE_EXACT);
  if (mExact) {
    const val = parseInt(mExact[2], 10);
    return createConstraint(cleanField(mExact[1]), detectKindAndUnit(mExact[3] || '', text), val, val, lineNo, originalSentence, needsReview);
  }

  m = text.match(RE_GT);
  if (m) {
    return createConstraint(cleanField(m[1]), detectKindAndUnit(m[3] || '', text), parseInt(m[2], 10) + 1, null, lineNo, originalSentence, needsReview);
  }

  m = text.match(RE_LT);
  if (m) {
    return createConstraint(cleanField(m[1]), detectKindAndUnit(m[3] || '', text), null, parseInt(m[2], 10) - 1, lineNo, originalSentence, needsReview);
  }

  m = text.match(RE_GTE_1) || text.match(RE_GTE_2);
  if (m) {
    const after = m[4] !== undefined ? (m[3] + ' ' + m[4]) : (m[3] || '');
    return createConstraint(cleanField(m[1]), detectKindAndUnit(after, text), parseInt(m[2], 10), null, lineNo, originalSentence, needsReview);
  }

  m = text.match(RE_LTE_1) || text.match(RE_LTE_2);
  if (m) {
    const after = m[4] !== undefined ? (m[3] + ' ' + m[4]) : (m[3] || '');
    return createConstraint(cleanField(m[1]), detectKindAndUnit(after, text), null, parseInt(m[2], 10), lineNo, originalSentence, needsReview);
  }

  return { unrecognized: /\d/.test(text) };
}

function extractConstraints(text) {
  if (!text || typeof text !== 'string') return { constraints: [], unrecognized: [] };
  const rawLines = text.normalize('NFC').replace(/\u00A0/g, ' ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[–—]/g, '-').split(/\r?\n/);
  const constraints = [];
  const unrecognized = [];

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const lineNo = lineIdx + 1;
    const trimmedLine = rawLines[lineIdx].trim();
    if (!trimmedLine) continue;

    const sentences = trimmedLine.split(RE_SENTENCE_SPLIT).filter(Boolean);
    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      const sentence = sentences[sIdx].trim();
      if (!sentence) continue;

      if (BLOCKED_PATTERNS.some((pat) => pat.test(sentence))) {
        if (/\d/.test(sentence)) unrecognized.push({ line: lineNo, text: sentence });
        continue;
      }

      const normalizedS = sentence.replace(RE_THOUSAND_SEP, (m, a, b) => a + b);
      const needsReview = REVIEW_KEYWORDS.test(normalizedS);
      const clauses = normalizedS.split(RE_CLAUSE_SPLIT);
      let matchedAny = false;

      for (let cIdx = 0; cIdx < clauses.length; cIdx++) {
        const res = extractSingleClause(clauses[cIdx], lineNo, needsReview, sentence);
        if (res.constraint) {
          constraints.push(res.constraint);
          matchedAny = true;
        }
      }

      if (!matchedAny && /\d/.test(sentence)) {
        unrecognized.push({ line: lineNo, text: sentence });
      }
    }
  }

  for (let idx = 0; idx < constraints.length; idx++) {
    constraints[idx].id = 'B-' + String(idx + 1).padStart(2, '0');
  }

  return { constraints, unrecognized };
}

module.exports = {
  extractConstraints,
  cleanField,
  detectKindAndUnit
};
