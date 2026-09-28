/**
 * core/ai/tasks/checkRequirementClarity.js
 * Analyzes requirement clarity, flags ambiguous phrases, and proposes a BDD draft with placeholders (BA-1).
 * Deterministic rule engine (0 token, no AI call). Strict ceiling <= 150 lines.
 */
const { CLARITY_LEXICON, CLARITY_EXCLUSIONS } = require('./clarityLexicon');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// JS `\b` only knows ASCII letters, so "không hợp lệ" or "thì" never matched. Use Unicode letter boundaries.
const wordRegExp = (words, flags) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}_])`, flags);

const ENTRIES = CLARITY_LEXICON.flatMap((g) => g.phrases.map((phrase) => ({
  phrase,
  group: g.group,
  reason: g.reason,
  suggestion: (g.hints && g.hints[phrase]) || g.suggestion,
  pattern: wordRegExp([phrase.normalize('NFC').toLowerCase()], 'gu')
})));

const BDD_WORDS = wordRegExp(['given', 'when', 'then', 'khi', 'thì'], 'iu');
const ERROR_WORDS = wordRegExp(['lỗi', 'thất bại', 'fail', 'failed', 'error', 'invalid', 'chặn', 'cảnh báo', 'không hợp lệ', 'trống', 'bắt buộc', 'từ chối', 'reject'], 'iu');
const BDD_LINE = /^\s*(?:\*\*)?(given|when|then|and)\b|(?<![\p{L}])khi(?![\p{L}])[^\n]*(?<![\p{L}])thì(?![\p{L}])/imu;

const normalize = (text) => String(text || '').normalize('NFC');

function spansOf(lower, phrases) {
  const spans = [];
  for (const phrase of phrases) {
    let from = lower.indexOf(phrase);
    while (from !== -1) {
      spans.push({ start: from, end: from + phrase.length });
      from = lower.indexOf(phrase, from + 1);
    }
  }
  return spans;
}

// Returns non-overlapping hits (longest phrase wins) in text order, with offsets into the NFC text.
function findAmbiguityHits(text = '') {
  const lower = normalize(text).toLowerCase();
  const excluded = spansOf(lower, CLARITY_EXCLUSIONS);
  const hits = [];
  for (const entry of ENTRIES) {
    entry.pattern.lastIndex = 0;
    let m;
    while ((m = entry.pattern.exec(lower))) hits.push({ entry, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.start < lastEnd) continue;
    if (excluded.some((s) => hit.start >= s.start && hit.end <= s.end)) continue;
    kept.push(hit);
    lastEnd = hit.end;
  }
  return kept;
}

function detectHeuristicAmbiguities(text = '') {
  if (!text || typeof text !== 'string') return [];
  return [...new Set(findAmbiguityHits(text).map((h) => h.entry.phrase))];
}

function withPlaceholders(text) {
  const source = normalize(text);
  let out = source;
  for (const hit of findAmbiguityHits(source).reverse()) {
    out = `${out.slice(0, hit.start)}<${source.slice(hit.start, hit.end)} → ${hit.entry.suggestion}>${out.slice(hit.end)}`;
  }
  return out;
}

function buildClarifiedDraft(text, missingError) {
  if (BDD_LINE.test(text)) return withPlaceholders(text.trim());
  const firstSentence = normalize(text).split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).find(Boolean) || '';
  const lines = [
    'Given <tiền điều kiện: vai trò, dữ liệu, màn hình đang mở>',
    'When <hành động cụ thể của người dùng>',
    `Then ${firstSentence ? withPlaceholders(firstSentence.slice(0, 240)) : '<kết quả quan sát được, kèm số liệu đo được>'}`
  ];
  if (missingError) lines.push('And <thông báo lỗi hiển thị khi dữ liệu không hợp lệ>');
  return lines.join('\n');
}

function heuristicCheckClarity({ requirementText = '' } = {}) {
  const text = normalize(requirementText);
  const seen = new Set();
  const ambiguities = [];
  for (const { entry } of findAmbiguityHits(text)) {
    if (seen.has(entry.phrase)) continue;
    seen.add(entry.phrase);
    ambiguities.push({ phrase: entry.phrase, group: entry.group, reason: entry.reason, suggestion: entry.suggestion });
  }

  const missingAspects = [];
  if (!/\p{N}/u.test(text)) missingAspects.push('Tiêu chí đo lường định lượng / Thời gian SLA');
  if (!BDD_WORDS.test(text)) missingAspects.push('Cấu trúc BDD (Given-When-Then)');
  const missingError = !ERROR_WORDS.test(text);
  if (missingError) missingAspects.push('Kịch bản xử lý ngoại lệ và thông báo lỗi');

  let score = 100;
  score -= Math.min(45, ambiguities.length * 15);
  score -= missingAspects.length * 10;
  if (text.trim().length < 40) score -= 15;
  score = Math.max(20, Math.min(100, score));

  const status = score >= 85 ? 'clear' : score >= 60 ? 'needs_clarification' : 'ambiguous';
  const summary = ambiguities.length
    ? `Phát hiện ${ambiguities.length} cụm từ định tính cần thay bằng tiêu chí đo được.`
    : missingAspects.length
      ? `Không có cụm từ mơ hồ, nhưng còn thiếu ${missingAspects.length} khía cạnh cần bổ sung.`
      : 'Requirement rõ ràng, có tiêu chí nghiệm thu cụ thể và đo lường được.';

  return {
    ok: true, source: 'rule', score, status, summary, ambiguities, missingAspects,
    clarifiedDraft: buildClarifiedDraft(text, missingError),
    detectedHeuristics: ambiguities.map((a) => a.phrase)
  };
}

async function runCheckRequirementClarity(params = {}) {
  return heuristicCheckClarity(params);
}

module.exports = { detectHeuristicAmbiguities, findAmbiguityHits, heuristicCheckClarity, runCheckRequirementClarity };
