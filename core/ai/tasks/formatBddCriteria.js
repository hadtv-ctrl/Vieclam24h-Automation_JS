/**
 * core/ai/tasks/formatBddCriteria.js
 * AI task chuẩn hoá tiêu chí nghiệm thu sang kịch bản BDD Given-When-Then tiếng Việt.
 * Kết nối qua AI Gateway với tier fast, temperature 0.1. Ngân sách dòng <= 150.
 */

const { callAi } = require('../gateway');
const { extractAcBlocks, validateScenarios, renderBddMarkdown } = require('./bddCriteriaRules');

const BDD_SCHEMA = {
  type: 'object',
  required: ['scenarios'],
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'given', 'when', 'then'],
        properties: {
          acId: { type: ['string', 'null'] },
          title: { type: 'string' },
          given: { type: 'array', items: { type: 'string' } },
          when: { type: 'array', items: { type: 'string' } },
          then: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    openQuestions: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

function buildBddPrompts({ requirementText, acs = [] }) {
  const acListStr = acs.length > 0
    ? acs.map((a) => `- ${a.id}: ${a.title || '(chưa có tiêu đề)'}`).join('\n')
    : '(Không tìm thấy mã AC rõ ràng, hãy phát hiện các tiêu chí và gán acId: null cho các đề xuất)';

  const systemContent = [
    'Bạn là chuyên gia QA Automation và BDD.',
    'Nhiệm vụ: Chuyển đổi các tiêu chí nghiệm thu (Acceptance Criteria) thành kịch bản BDD Given-When-Then chuẩn mực bằng tiếng Việt.',
    'QUY TẮC BẮT BUỘC:',
    '1. Bắt buộc giữ nguyên mã AC đầu vào, mỗi AC tương ứng đúng 1 scenario trong danh sách.',
    '2. Tuyệt đối không tự ý đổi mã, không bịa mã AC mới. Nếu đề xuất thêm kịch bản mới ngoài tài liệu, BẮT BUỘC đặt acId: null.',
    '3. Viết các bước given, when, then bằng tiếng Việt ngắn gọn, rõ ràng (1-300 ký tự). KHÔNG lặp lại từ khoá Given/When/Then/Và trong nội dung bước.',
    '4. Giữ nguyên các số liệu cụ thể, giá trị biên, thông báo lỗi nếu có trong văn bản.',
    '5. Điều gì văn bản không nói rõ thì đưa vào openQuestions, tuyệt đối không tự bịa thêm hành vi vào bước.',
    '6. Trả về đúng JSON theo schema.'
  ].join('\n');

  const userContent = [
    `Danh sách mã AC cần xử lý:\n${acListStr}`,
    `Văn bản yêu cầu:\n${requirementText}`
  ].join('\n\n');

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent }
  ];
}

async function runFormatBddCriteria({
  requirementText = '',
  title = '',
  clientConfig = null,
  root = process.cwd(),
  signal = null
} = {}) {
  const trimmed = typeof requirementText === 'string' ? requirementText.trim() : '';
  if (!trimmed) {
    return { ok: false, code: 'EMPTY_TEXT', error: 'Nội dung yêu cầu không được để trống' };
  }
  if (trimmed.length > 8000) {
    return { ok: false, code: 'TEXT_TOO_LONG', error: 'Nội dung vượt quá giới hạn 8.000 ký tự' };
  }

  const { acs, warnings } = extractAcBlocks(trimmed);
  const messages = buildBddPrompts({ requirementText: trimmed, acs });

  const aiRes = await callAi({
    task: 'formatBddCriteria',
    messages,
    schema: BDD_SCHEMA,
    clientConfig,
    root,
    signal,
    tier: 'fast',
    timeoutMs: 45000,
    temperature: 0.1
  });

  if (!aiRes || !aiRes.ok) {
    return {
      ok: false,
      code: aiRes?.code || 'GATEWAY_ERROR',
      error: aiRes?.message || 'Lỗi gọi AI Gateway',
      details: aiRes?.details || null
    };
  }

  const validation = validateScenarios(aiRes.data, acs);
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      error: validation.error,
      details: validation.details || null
    };
  }

  const markdown = renderBddMarkdown({
    scenarios: validation.scenarios,
    proposals: validation.proposals
  });

  return {
    ok: true,
    acIds: validation.scenarios.map((s) => s.acId).filter(Boolean),
    scenarios: validation.scenarios,
    proposals: validation.proposals,
    openQuestions: validation.openQuestions,
    markdown,
    warnings,
    model: aiRes.model,
    tier: aiRes.tier,
    usage: aiRes.usage,
    requestId: aiRes.requestId
  };
}

module.exports = {
  BDD_SCHEMA,
  buildBddPrompts,
  runFormatBddCriteria
};
