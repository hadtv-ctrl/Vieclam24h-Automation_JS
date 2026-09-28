/**
 * core/ai/prompts/promptLoader.js
 * Versioned prompt template loader (F2).
 * Priority: ai/prompts.local/<task>.<version>.md > ai/prompts/<task>.<version>.md > default fallback.
 * Strict ceiling <= 120 lines.
 */
const fs = require('fs');
const path = require('path');

function interpolate(template = '', vars = {}) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  });
}

function parsePromptSections(content = '') {
  const systemMatch = content.match(/#+\s*System\s*\n([\s\S]*?)(?=\n#+\s*User|\n#+\s*Schema|$)/i);
  const userMatch = content.match(/#+\s*User\s*\n([\s\S]*?)$/i);
  return {
    system: systemMatch ? systemMatch[1].trim() : '',
    user: userMatch ? userMatch[1].trim() : content.trim()
  };
}

function loadVersionedPrompt({
  task,
  version = 'v1',
  vars = {},
  projectRoot = process.cwd(),
  defaultSystem = '',
  defaultUser = ''
} = {}) {
  const fileName = `${task}.${version}.md`;
  const localPath = path.join(projectRoot, 'ai', 'prompts.local', fileName);
  const standardPath = path.join(projectRoot, 'ai', 'prompts', fileName);

  let rawContent = null;
  let source = 'default';

  if (fs.existsSync(localPath)) {
    try {
      rawContent = fs.readFileSync(localPath, 'utf8');
      source = 'local_override';
    } catch {
      // Fallback
    }
  }

  if (!rawContent && fs.existsSync(standardPath)) {
    try {
      rawContent = fs.readFileSync(standardPath, 'utf8');
      source = 'standard';
    } catch {
      // Fallback
    }
  }

  if (rawContent) {
    const { system, user } = parsePromptSections(rawContent);
    return {
      system: interpolate(system || defaultSystem, vars),
      user: interpolate(user || defaultUser, vars),
      version,
      source
    };
  }

  return {
    system: interpolate(defaultSystem, vars),
    user: interpolate(defaultUser, vars),
    version,
    source: 'fallback'
  };
}

module.exports = {
  loadVersionedPrompt,
  interpolate,
  parsePromptSections
};
