/**
 * core/ai/tasks/generateTestCases.js
 * Generates BDD test cases from Acceptance Criteria (QA-1).
 * Deterministic rule engine (0 token, no AI call): one positive case per AC built from the AC's own
 * Given/When/Then, plus boundary and negative cases from the shared heuristic test design.
 * Strict ceiling <= 150 lines.
 */
const { buildHeuristicTestCases } = require('./heuristicTestCases');

const AC_LINE = /^\s*(?:#{1,6}\s*|[-*+]\s+)?\**\s*(AC)[-_ ]?(\d{1,3})\s*\**\s*[:.\-–—)]\s*(.*)$/i;
const GWT_KEYWORD = /(?<![\p{L}])(given|when|then|and)(?![\p{L}])\**\s*:?\s*/giu;
const FORMAT_RULE = /định\s*dạng|format/i;
const TYPE_TAGS = { positive: ['@e2e'], negative: ['@e2e', '@negative'], boundary: ['@e2e', '@bva'] };

const clean = (s = '') => String(s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');

function parseAcBlocks(text = '') {
  const blocks = [];
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.match(AC_LINE);
    if (m) {
      current = { id: `AC-${m[2].padStart(3, '0')}`, title: clean(m[3]), lines: [m[3]] };
      blocks.push(current);
    } else if (/^\s*#/.test(raw)) {
      current = null;
    } else if (current && raw.trim()) {
      current.lines.push(raw.trim());
    }
  }
  if (blocks.length) return blocks;
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = clean((lines[0] || '').replace(/^#+\s*/, ''));
  return [{ id: 'AC-001', title: first || 'Yêu cầu chính', lines }];
}

// Splits "Given a, When b, Then c" (inline or one keyword per line) into its parts.
function parseGwt(text = '') {
  const parts = { given: [], when: [], then: [] };
  const matches = [...String(text).matchAll(GWT_KEYWORD)];
  let last = null;
  matches.forEach((m, i) => {
    const key = m[1].toLowerCase();
    const segment = clean(text.slice(m.index + m[0].length, i + 1 < matches.length ? matches[i + 1].index : undefined));
    const target = key === 'and' ? last : key;
    if (target && segment) parts[target].push(segment);
    if (key !== 'and') last = key;
  });
  return { given: parts.given.join('; '), when: parts.when.join('; '), then: parts.then.join('; ') };
}

function fromHeuristic(tc, acId) {
  const steps = tc.steps || [];
  return {
    acId,
    title: tc.title,
    type: String(tc.type || 'Positive').toLowerCase(),
    priority: tc.priority || 'P1',
    given: tc.precondition || '',
    when: steps.map((s) => s.action).join('; '),
    then: steps.length ? steps[steps.length - 1].expected : '',
    steps,
    testData: tc.testData || ''
  };
}

function casesForAc(block) {
  const text = block.lines.join('\n');
  const gwt = parseGwt(text);
  const positive = {
    acId: block.id,
    title: `Xác nhận hành vi đúng: ${block.title || block.id}`,
    type: 'positive',
    priority: 'P1',
    given: gwt.given || 'Người dùng có quyền thao tác và đang ở màn hình liên quan',
    when: gwt.when || `Thực hiện thao tác được mô tả trong ${block.id}`,
    then: gwt.then || block.title,
    testData: ''
  };
  positive.steps = [{ step: 1, action: positive.when, expected: positive.then }];
  const extra = buildHeuristicTestCases(text, { includeGenericFlows: false }).testCases.map((tc) => fromHeuristic(tc, block.id));
  if (FORMAT_RULE.test(text)) {
    extra.push({
      acId: block.id,
      title: `Chặn dữ liệu sai định dạng (${block.id})`,
      type: 'negative',
      priority: 'P1',
      given: positive.given,
      when: 'Nhập giá trị sai định dạng quy định rồi gửi',
      then: 'Hệ thống chặn gửi và báo lỗi định dạng',
      steps: [{ step: 1, action: 'Nhập giá trị sai định dạng quy định rồi gửi', expected: 'Hệ thống chặn gửi và báo lỗi định dạng' }],
      testData: 'Giá trị sai định dạng'
    });
  }
  return [positive, ...extra];
}

function buildRuleTestCases({ criteriaText = '', startTcNumber = 1 } = {}) {
  const blocks = parseAcBlocks(criteriaText);
  let next = Math.max(1, Number(startTcNumber) || 1);
  const testCases = blocks.flatMap(casesForAc).map((tc) => ({
    tcId: `TC-${String(next++).padStart(3, '0')}`,
    ...tc,
    tags: TYPE_TAGS[tc.type] || ['@e2e']
  }));

  const count = (type) => testCases.filter((tc) => tc.type === type).length;
  const unrecognized = blocks
    .filter((b) => /\d/.test(b.lines.join(' ')) && !testCases.some((tc) => tc.acId === b.id && tc.type === 'boundary'))
    .map((b) => b.id);
  const coverageNotes = [
    `${blocks.length} AC → ${testCases.length} test case (${count('positive')} positive, ${count('negative')} negative, ${count('boundary')} boundary).`,
    unrecognized.length ? `Có số liệu nhưng chưa nhận diện được ràng buộc biên ở ${unrecognized.join(', ')} — cần bổ sung ca biên thủ công.` : ''
  ].filter(Boolean).join(' ');

  return { ok: true, source: 'rule', testCases, coverageNotes };
}

async function runGenerateTestCases(params = {}) {
  return buildRuleTestCases(params);
}

module.exports = { parseAcBlocks, parseGwt, buildRuleTestCases, runGenerateTestCases };
