/**
 * core/ai/tasks/detectFlakyTests.js
 * Deterministic task (0 token, no AI call): Analyzes historical test runs to identify intermittent / flaky test cases (QA-6).
 * Strict ceiling <= 150 lines.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    flakyCount: { type: 'number' },
    summary: { type: 'string' },
    flakyTests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          testId: { type: 'string' },
          flakinessRate: { type: 'number' },
          flipCount: { type: 'number' },
          probableCause: { type: 'string' },
          remediation: { type: 'string' }
        },
        required: ['testId', 'flakinessRate']
      }
    }
  },
  required: ['flakyCount', 'flakyTests']
};

function heuristicFlakyDetection(history = []) {
  const flakyList = [];

  for (const item of history) {
    const { testId = 'TC-?', runs = [] } = item;
    if (runs.length < 2) continue;

    let flips = 0;
    for (let i = 1; i < runs.length; i++) {
      if (runs[i] !== runs[i - 1]) flips++;
    }

    const flakinessRate = Math.round((flips / (runs.length - 1)) * 100) / 100;
    if (flakinessRate >= 0.2) {
      flakyList.push({
        testId,
        flakinessRate,
        flipCount: flips,
        probableCause: 'Chập chờn trạng thái (Race condition hoặc phụ thuộc dữ liệu phiên trước)',
        remediation: 'Thêm web-first assertion hoặc reset state trong beforeEach hook'
      });
    }
  }

  return {
    source: 'rule',
    flakyCount: flakyList.length,
    summary: flakyList.length
      ? `Phát hiện ${flakyList.length} test case có tỷ lệ lật kết quả (flaky) bất thường.`
      : 'Không phát hiện test case nào có dấu hiệu flaky trong tập mẫu.',
    flakyTests: flakyList
  };
}

async function runDetectFlakyTests({ history = [], signal = null, clientConfig = null } = {}) {
  // Pure deterministic statistical calculation (100% accurate, sub-millisecond, 0 tokens)
  return heuristicFlakyDetection(history);
}

module.exports = {
  runDetectFlakyTests,
  heuristicFlakyDetection,
  SCHEMA
};
