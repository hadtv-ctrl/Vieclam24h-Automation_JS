/**
 * core/ai/tasks/analyzeRequirementChange.js
 * Deterministic task (0 token, no AI call): Analyzes diff between old and new requirement markdown (BA-3).
 * Strict ceiling <= 150 lines.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    impactSeverity: { type: 'string', enum: ['major', 'minor', 'patch'] },
    summary: { type: 'string' },
    changedAcs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          acId: { type: 'string' },
          changeType: { type: 'string', enum: ['added', 'modified', 'removed'] },
          description: { type: 'string' }
        },
        required: ['acId', 'changeType']
      }
    },
    affectedTcIds: { type: 'array', items: { type: 'string' } },
    suggestedActions: { type: 'array', items: { type: 'string' } }
  },
  required: ['impactSeverity', 'summary', 'changedAcs']
};

function extractAcIds(text = '') {
  const matches = text.match(/AC-[A-Za-z0-9_-]+/g) || [];
  return Array.from(new Set(matches));
}

function heuristicReqDiff(oldText = '', newText = '', reqId = 'REQ-001') {
  const oldAcs = extractAcIds(oldText);
  const newAcs = extractAcIds(newText);

  const changedAcs = [];
  for (const ac of newAcs) {
    if (!oldAcs.includes(ac)) {
      changedAcs.push({ acId: ac, changeType: 'added', description: 'Tiêu chí nghiệm thu mới được bổ sung' });
    }
  }
  for (const ac of oldAcs) {
    if (!newAcs.includes(ac)) {
      changedAcs.push({ acId: ac, changeType: 'removed', description: 'Tiêu chí nghiệm thu đã bị lược bỏ' });
    }
  }

  if (changedAcs.length === 0 && oldText !== newText) {
    changedAcs.push({ acId: oldAcs[0] || 'AC-GEN', changeType: 'modified', description: 'Nội dung mô tả hoặc quy tắc nghiệp vụ đã thay đổi' });
  }

  const impactSeverity = changedAcs.some((a) => a.changeType === 'removed')
    ? 'major'
    : changedAcs.length > 2
    ? 'major'
    : changedAcs.length > 0
    ? 'minor'
    : 'patch';

  return {
    source: 'rule',
    impactSeverity,
    summary: `Phát hiện ${changedAcs.length} tiêu chí AC thay đổi đối với ${reqId}.`,
    changedAcs,
    affectedTcIds: changedAcs.map((a) => a.acId.replace('AC-', 'TC-')),
    suggestedActions: [
      'Cập nhật lại các test case liên kết với AC bị thay đổi',
      'Chạy lại kiểm thử hồi quy cho module liên quan'
    ]
  };
}

async function runAnalyzeRequirementChange({
  reqId = 'REQ-001',
  oldContent = '',
  newContent = '',
  signal = null,
  clientConfig = null
} = {}) {
  // Pure deterministic text diffing & AC ID change detection (0 tokens, instantaneous)
  return heuristicReqDiff(oldContent, newContent, reqId);
}

module.exports = {
  runAnalyzeRequirementChange,
  heuristicReqDiff,
  SCHEMA
};
