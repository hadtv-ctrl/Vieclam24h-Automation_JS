/**
 * core/ai/tasks/draftDecisionRecord.js
 * Deterministic task (0 token, no AI call): Decision log assistant & ADR generator (PO-3).
 * Checks conflicts with existing decisions. Strict ceiling <= 150 lines.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    decisionId: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', enum: ['proposed', 'accepted', 'superseded'] },
    context: { type: 'string' },
    decision: { type: 'string' },
    consequences: {
      type: 'object',
      properties: {
        positive: { type: 'array', items: { type: 'string' } },
        negative: { type: 'array', items: { type: 'string' } }
      }
    },
    conflictWarning: { type: 'string' }
  },
  required: ['decisionId', 'title', 'decision']
};

function heuristicDecisionRecord({
  topic = 'Kiến trúc',
  contextText = '',
  proposedDecision = '',
  existingDecisions = []
} = {}) {
  const nextId = `ADR-${String(existingDecisions.length + 1).padStart(3, '0')}`;
  let conflictWarning = null;

  const lowerProp = proposedDecision.toLowerCase();
  for (const d of existingDecisions) {
    const dLower = (d.decision || d.title || '').toLowerCase();
    if (lowerProp.includes('chặn') && dLower.includes('cho phép')) {
      conflictWarning = `Quyết định này có thể xung đột với [${d.id || d.decisionId}]: "${d.title}".`;
      break;
    }
  }

  return {
    source: 'rule',
    decisionId: nextId,
    title: `Quyết định về: ${topic}`,
    status: 'proposed',
    context: contextText || 'Cần chuẩn hóa hướng đi kỹ thuật hoặc nghiệp vụ.',
    decision: proposedDecision || 'Thống nhất áp dụng giải pháp theo đề xuất.',
    consequences: {
      positive: ['Tăng tính nhất quán trong toàn dự án', 'Dễ bảo trì và đối soát'],
      negative: ['Cần thời gian chuyển đổi các thành phần cũ']
    },
    conflictWarning
  };
}

async function runDraftDecisionRecord({
  topic = 'Kiến trúc',
  contextText = '',
  proposedDecision = '',
  existingDecisions = [],
  signal = null,
  clientConfig = null
} = {}) {
  // Pure deterministic ADR templating & keyword contradiction detection (0 tokens, instantaneous)
  return heuristicDecisionRecord({ topic, contextText, proposedDecision, existingDecisions });
}

module.exports = {
  runDraftDecisionRecord,
  heuristicDecisionRecord,
  SCHEMA
};
