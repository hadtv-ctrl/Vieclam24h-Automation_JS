/**
 * core/ai/context/contextBuilder.js
 * Assembles token-budget-constrained project context for AI tasks (F4).
 * Masks secrets and excludes sensitive files. Strict ceiling <= 150 lines.
 */
const fs = require('fs');
const path = require('path');

const EXCLUDED_PATTERNS = [/\.env/i, /cccd/i, /credentials/i, /token/i, /secret/i, /password/i];
const SECRET_REGEX = /(?:api[_-]?key|secret|password|bearer|auth[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?/gi;

function maskSecrets(content = '') {
  if (typeof content !== 'string') return '';
  return content.replace(SECRET_REGEX, '[MASKED_SECRET]');
}

function isExcludedPath(filePath = '') {
  const norm = filePath.replace(/\\/g, '/');
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(norm));
}

function scanPageObjects(projectRoot, maxChars = 3000) {
  const pagesDir = path.join(projectRoot, 'pages');
  if (!fs.existsSync(pagesDir)) return [];
  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.js') && !isExcludedPath(f));
  const results = [];
  let charCount = 0;

  for (const file of files) {
    if (charCount >= maxChars) break;
    try {
      const fullPath = path.join(pagesDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const methodMatches = Array.from(content.matchAll(/(?:async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g))
        .map((m) => m[1])
        .filter((m) => !['constructor', 'if', 'for', 'while', 'catch'].includes(m));
      const summary = { file, methods: methodMatches.slice(0, 15) };
      results.push(summary);
      charCount += JSON.stringify(summary).length;
    } catch {
      // Ignore read errors gracefully
    }
  }
  return results;
}

function loadManifestKnowledge(projectRoot, maxChars = 2000) {
  const manifestPath = path.join(projectRoot, '.ai', 'knowledge', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    const compact = {
      project: parsed.project || 'Automation Framework',
      topics: (parsed.entries || parsed.topics || []).slice(0, 10).map((e) => ({
        id: e.id || e.topic,
        file: e.file || e.path
      }))
    };
    const jsonStr = JSON.stringify(compact);
    return jsonStr.length > maxChars ? jsonStr.slice(0, maxChars) + '...' : jsonStr;
  } catch {
    return null;
  }
}

function buildAiContext({
  task = 'general',
  budgetTokens = 4000,
  projectRoot = process.cwd(),
  includePageObjects = true,
  customSnippet = ''
} = {}) {
  const maxTotalChars = Math.max(1000, budgetTokens * 4);
  let accumulatedChars = 0;
  const context = { task, generatedAt: new Date().toISOString() };

  const manifest = loadManifestKnowledge(projectRoot, 2000);
  if (manifest) {
    context.knowledgeManifest = manifest;
    accumulatedChars += manifest.length;
  }

  if (includePageObjects) {
    const remaining = Math.max(500, maxTotalChars - accumulatedChars - 500);
    context.pageObjects = scanPageObjects(projectRoot, remaining);
    accumulatedChars += JSON.stringify(context.pageObjects).length;
  }

  if (customSnippet) {
    const remaining = Math.max(200, maxTotalChars - accumulatedChars);
    const masked = maskSecrets(customSnippet);
    context.customSnippet = masked.length > remaining ? masked.slice(0, remaining) + '\n[Truncated]' : masked;
  }

  return context;
}

module.exports = {
  buildAiContext,
  maskSecrets,
  isExcludedPath
};
