/**
 * core/ai/tasks/bddCriteriaRules.js
 * Quy tắc bóc tách khối AC, kiểm tra scenario BDD và xuất Markdown Gherkin.
 * 0 token AI, thuần logic xác định. Ngân sách dòng <= 150.
 */

const RE_CANONICAL_AC = /^AC-\d{3}$/;
const RE_NEAR_MISS = /\b(AC[-_]?\d{1,4})\b/gi;
const RE_KEYWORD_PREFIX = /^(?:Given|When|Then|And|But|Cho|Biết|Khi|Thì|Và|Nhưng)\s*[:\-–—]?\s*/iu;

function extractAcBlocks(text) {
  if (typeof text !== 'string') return { acs: [], warnings: [] };
  const lines = text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  const acs = [];
  const warnings = [];
  const seenIds = new Set();
  const seenWarnings = new Set();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    let nearMatch;
    RE_NEAR_MISS.lastIndex = 0;
    while ((nearMatch = RE_NEAR_MISS.exec(line)) !== null) {
      if (!RE_CANONICAL_AC.test(nearMatch[1])) {
        const warnMsg = `Mã AC gần đúng nhưng không chuẩn quy cách: ${nearMatch[1]}`;
        if (!seenWarnings.has(warnMsg)) {
          seenWarnings.add(warnMsg);
          warnings.push(warnMsg);
        }
      }
    }

    const headMatch = rawLine.match(/^\s{0,3}#{2,6}\s*(AC-\d{3})\b\s*[:\-–—]?\s*(.*?)$/);
    const boldMatch = line.match(/^\*\*(AC-\d{3})\*\*\s*[:\-–—]?\s*(.*?)$/);
    const lineMatch = line.match(/^(AC-\d{3})\s*[:\-–—]\s*(.*?)$/);
    const match = headMatch || boldMatch || lineMatch;
    if (match) {
      const id = match[1].toUpperCase();
      if (!seenIds.has(id)) {
        seenIds.add(id);
        acs.push({ id, title: (match[2] || '').trim(), body: '' });
      }
    }
  }

  return { acs, warnings };
}

function cleanStep(step) {
  if (typeof step !== 'string') return '';
  return step.trim().replace(RE_KEYWORD_PREFIX, '').trim();
}

function validateScenarios(data, inputAcs = []) {
  if (!data || typeof data !== 'object') {
    return { ok: false, code: 'BDD_INVALID', error: 'Dữ liệu BDD không hợp lệ' };
  }
  const rawScenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
  if (rawScenarios.length < 1 || rawScenarios.length > 30) {
    return { ok: false, code: 'BDD_INVALID', error: 'Số lượng scenario phải từ 1 đến 30' };
  }
  const inputMap = new Map(inputAcs.map((a) => [a.id, a]));
  const scenarios = [];
  const proposals = [];
  const seenAcCounts = new Map();

  for (const s of rawScenarios) {
    if (!s || typeof s !== 'object') {
      return { ok: false, code: 'BDD_INVALID', error: 'Scenario không phải object hợp lệ' };
    }

    const { given, when, then } = s;
    for (const [partName, arr] of [['given', given], ['when', when], ['then', then]]) {
      if (!Array.isArray(arr) || arr.length < 1 || arr.length > 6) {
        return { ok: false, code: 'BDD_INVALID', error: `Phần ${partName} phải có từ 1 đến 6 bước` };
      }
      for (const step of arr) {
        const cleaned = cleanStep(step);
        if (cleaned.length < 1 || cleaned.length > 300) {
          return { ok: false, code: 'BDD_INVALID', error: 'Mỗi bước phải dài từ 1 đến 300 ký tự' };
        }
      }
    }

    const cleanedGiven = given.map(cleanStep);
    const cleanedWhen = when.map(cleanStep);
    const cleanedThen = then.map(cleanStep);
    const acId = (typeof s.acId === 'string' && s.acId.trim()) ? s.acId.trim().toUpperCase() : null;

    let title = (typeof s.title === 'string' ? s.title.trim() : '');
    if (!title && acId && inputMap.has(acId)) {
      title = inputMap.get(acId).title || acId;
    }

    const item = { acId, title, given: cleanedGiven, when: cleanedWhen, then: cleanedThen };

    if (!acId) {
      proposals.push(item);
    } else {
      if (inputAcs.length > 0 && !inputMap.has(acId)) {
        return { ok: false, code: 'BDD_UNKNOWN_AC', error: `Mã AC không có trong đầu vào: ${acId}`, details: [acId] };
      }
      seenAcCounts.set(acId, (seenAcCounts.get(acId) || 0) + 1);
      scenarios.push(item);
    }
  }

  // Check missing or duplicated input ACs
  if (inputAcs.length > 0) {
    const missing = inputAcs.filter((a) => !seenAcCounts.has(a.id)).map((a) => a.id);
    const duplicated = Array.from(seenAcCounts.entries()).filter(([, cnt]) => cnt > 1).map(([id]) => id);
    if (missing.length > 0 || duplicated.length > 0) {
      const details = [...missing, ...duplicated];
      return { ok: false, code: 'BDD_MISSING_AC', error: 'Mã AC đầu vào bị thiếu hoặc lặp lại', details };
    }
  }

  const rawQuestions = Array.isArray(data.openQuestions) ? data.openQuestions : [];
  const openQuestions = Array.from(new Set(rawQuestions.filter((q) => typeof q === 'string' && q.trim()))).slice(0, 10);

  return { ok: true, scenarios, proposals, openQuestions };
}

function renderSteps(prefix, steps) {
  return steps.map((step, idx) => `**${idx === 0 ? prefix : 'And'}** ${step}`).join('\n');
}

function renderBddMarkdown({ scenarios = [], proposals = [] }) {
  const parts = [];
  for (const s of scenarios) {
    const titlePart = s.title ? `: ${s.title}` : '';
    parts.push(`### ${s.acId || 'AC'}${titlePart}\n\n${renderSteps('Given', s.given)}\n${renderSteps('When', s.when)}\n${renderSteps('Then', s.then)}`);
  }
  if (proposals.length > 0) {
    const propLines = ['#### Đề xuất AC mới (gán mã AC-xxx trước khi dán vào tài liệu)', ''];
    for (const p of proposals) {
      propLines.push(`- ${p.title || 'Kịch bản đề xuất'}`);
      p.given.forEach((g) => propLines.push(`  - **Given** ${g}`));
      p.when.forEach((w) => propLines.push(`  - **When** ${w}`));
      p.then.forEach((t) => propLines.push(`  - **Then** ${t}`));
    }
    parts.push(propLines.join('\n'));
  }
  return parts.join('\n\n').normalize('NFC');
}

module.exports = {
  extractAcBlocks,
  validateScenarios,
  renderBddMarkdown
};
