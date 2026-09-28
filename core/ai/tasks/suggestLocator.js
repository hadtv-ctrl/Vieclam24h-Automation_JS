/**
 * core/ai/tasks/suggestLocator.js
 * Deterministic task (0 token, no AI call): Analyzes failed locator and DOM snippet to suggest resilient Playwright locators (QA-5).
 * Strict ceiling <= 150 lines.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success', 'fallback'] },
    primarySuggestion: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        type: { type: 'string' },
        confidence: { type: 'number' },
        rationale: { type: 'string' }
      },
      required: ['code', 'type', 'confidence', 'rationale']
    },
    alternatives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          type: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    },
    rootCause: { type: 'string' }
  },
  required: ['primarySuggestion']
};

function heuristicLocatorRepair(brokenLocator = '', domSnippet = '') {
  const suggestions = [];
  const testIdMatch = domSnippet.match(/data-testid=["']([^"']+)["']/i);
  if (testIdMatch) {
    suggestions.push({
      code: `page.getByTestId('${testIdMatch[1]}')`,
      type: 'getByTestId',
      confidence: 0.95,
      rationale: 'Phát hiện thuộc tính data-testid duy nhất trong DOM'
    });
  }

  const roleMatch = domSnippet.match(/<(button|a|input|select|textarea)\b([^>]*)>(?:([^<]+)<\/\1>)?/i);
  if (roleMatch) {
    const tag = roleMatch[1].toLowerCase();
    const role = tag === 'a' ? 'link' : tag === 'button' ? 'button' : 'textbox';
    const text = (roleMatch[3] || '').trim();
    if (text) {
      suggestions.push({
        code: `page.getByRole('${role}', { name: '${text}' })`,
        type: 'getByRole',
        confidence: 0.9,
        rationale: `Phát hiện thẻ <${tag}> với văn bản nhãn trực quan "${text}"`
      });
    }
  }

  const ariaMatch = domSnippet.match(/aria-label=["']([^"']+)["']/i);
  if (ariaMatch) {
    suggestions.push({
      code: `page.getByLabel('${ariaMatch[1]}')`,
      type: 'getByLabel',
      confidence: 0.85,
      rationale: `Phát hiện thuộc tính aria-label="${ariaMatch[1]}"`
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      code: `page.locator('${brokenLocator.replace(/['"]/g, '') || '.fallback-target'}')`,
      type: 'locator',
      confidence: 0.5,
      rationale: 'Không tìm thấy thuộc tính ngữ nghĩa rõ ràng, giữ lại selector cơ bản'
    });
  }

  return {
    status: 'fallback',
    source: 'rule',
    primarySuggestion: suggestions[0],
    alternatives: suggestions.slice(1),
    rootCause: 'DOM thay đổi hoặc phần tử chưa sẵn sàng khi truy vấn.'
  };
}

async function runSuggestLocator({
  brokenLocator = '',
  errorMessage = '',
  domSnippet = '',
  pageUrl = '',
  signal = null,
  clientConfig = null
} = {}) {
  // Pure deterministic DOM attribute parser (getByTestId -> getByRole -> getByLabel, 0 tokens)
  return heuristicLocatorRepair(brokenLocator, domSnippet);
}

module.exports = {
  runSuggestLocator,
  heuristicLocatorRepair,
  SCHEMA
};
