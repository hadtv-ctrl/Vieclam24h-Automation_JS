/**
 * core/ai/tasks/analyzeTestImpact.js
 * Test impact analysis mapping git diff to affected test specs (DEV-1).
 * Strict ceiling <= 150 lines.
 */
const path = require('path');

const SCHEMA = {
  type: 'object',
  properties: {
    riskLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
    summary: { type: 'string' },
    affectedSpecs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          specPath: { type: 'string' },
          reason: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] }
        },
        required: ['specPath', 'reason']
      }
    },
    recommendedNewTests: { type: 'array', items: { type: 'string' } }
  },
  required: ['riskLevel', 'summary', 'affectedSpecs']
};

function heuristicDiffAnalysis(changedFiles = [], diffText = '') {
  const affected = [];
  for (const file of changedFiles) {
    const base = path.basename(file, path.extname(file));
    if (file.includes('pages/')) {
      const candidateSpec = `tests/${base}.spec.js`;
      affected.push({
        specPath: candidateSpec,
        reason: `Page object ${file} bị thay đổi giao diện/phương thức.`,
        priority: 'P0'
      });
    } else if (file.includes('tests/') && file.endsWith('.spec.js')) {
      affected.push({
        specPath: file,
        reason: 'Chính file test spec này được sửa đổi trực tiếp.',
        priority: 'P0'
      });
    } else if (file.includes('routes/') || file.includes('core/')) {
      affected.push({
        specPath: 'tests/dashboard-api/',
        reason: `Mã nguồn backend core (${file}) bị tác động.`,
        priority: 'P1'
      });
    }
  }

  const riskLevel = changedFiles.some((f) => f.includes('core/') || f.includes('gateway'))
    ? 'high'
    : changedFiles.length > 3
    ? 'medium'
    : 'low';

  return {
    source: 'rule',
    riskLevel,
    summary: `Heuristic: Tìm thấy ${affected.length} test spec liên quan trực tiếp tới ${changedFiles.length} file thay đổi.`,
    affectedSpecs: affected,
    recommendedNewTests: ['Kiểm thử hồi quy happy path cho các trang bị sửa']
  };
}

async function runAnalyzeTestImpact({
  changedFiles = [],
  diffText = '',
  signal = null,
  clientConfig = null
} = {}) {
  // Pure deterministic git diff & page-object dependency mapping (0 tokens, instantaneous)
  return heuristicDiffAnalysis(changedFiles, diffText);
}

module.exports = {
  runAnalyzeTestImpact,
  heuristicDiffAnalysis,
  SCHEMA
};
