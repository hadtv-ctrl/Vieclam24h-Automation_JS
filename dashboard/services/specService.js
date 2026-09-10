/**
 * dashboard/services/specService.js
 * Scans, resolves and categorizes Playwright test specifications and project configurations.
 */
const fs = require('fs');
const path = require('path');

const CODE_ROOTS = ['tests', 'pages', 'core'];

function loadPlaywrightConfig(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  try {
    const configPath = path.join(root, 'playwright.config.js');
    if (!fs.existsSync(configPath)) return null;
    delete require.cache[require.resolve(configPath)];
    return require(configPath);
  } catch (err) {
    console.error('Lỗi khi đọc cấu hình playwright.config.js:', err.message);
    return null;
  }
}

function getPlaywrightProjects(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const config = loadPlaywrightConfig(root);
  if (!config || !Array.isArray(config.projects)) {
    return ['all'];
  }
  const projectNames = config.projects
    .map((p) => p.name)
    .filter((name) => name && name !== 'setup');
  return ['all', ...projectNames];
}

function matchGlobOrRegex(pattern, str) {
  if (!pattern) return true;
  if (pattern instanceof RegExp) return pattern.test(str);
  if (typeof pattern === 'string') {
    const segments = pattern.split('/').filter(Boolean).filter((p) => p !== '**' && p !== '*');
    return segments.every((segment) => {
      if (segment.endsWith('.spec.js')) return str.endsWith('.spec.js');
      return str.includes(segment);
    });
  }
  return true;
}

function projectsForSpec(spec, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const fullPath = path.join(root, spec);
  if (!fs.existsSync(fullPath)) return [];

  const config = loadPlaywrightConfig(root);
  if (!config || !Array.isArray(config.projects)) return [];

  const content = fs.readFileSync(fullPath, 'utf8');
  const specRel = spec.split(path.sep).join('/');
  const specUnderTests = specRel.replace(/^tests\//, '');
  const matchedProjects = [];

  for (const proj of config.projects) {
    if (!proj.name || proj.name === 'setup') continue;

    if (proj.testMatch && !matchGlobOrRegex(proj.testMatch, specRel) && !matchGlobOrRegex(proj.testMatch, specUnderTests)) {
      continue;
    }
    if (proj.testIgnore && (matchGlobOrRegex(proj.testIgnore, specRel) || matchGlobOrRegex(proj.testIgnore, specUnderTests))) {
      continue;
    }
    if (proj.grep) {
      const grepRegex = proj.grep instanceof RegExp ? proj.grep : new RegExp(proj.grep);
      if (!grepRegex.test(content)) continue;
    }
    if (proj.grepInvert) {
      const invertRegex = proj.grepInvert instanceof RegExp ? proj.grepInvert : new RegExp(proj.grepInvert);
      if (invertRegex.test(content)) continue;
    }

    matchedProjects.push(proj.name);
  }

  return matchedProjects;
}

function listSpecs(directory, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const dir = directory || path.join(root, 'tests');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSpecs(absolutePath, root);
    if (!entry.name.endsWith('.spec.js')) return [];
    return [path.relative(root, absolutePath).split(path.sep).join('/')];
  }).sort();
}

function listSpecDetails(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const specs = listSpecs(null, root);
  const specTags = {};
  const allTags = new Set();

  for (const specPath of specs) {
    const fullPath = path.join(root, specPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const tags = [];
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (/\b(?:test|describe)\b/i.test(line)) {
          const matches = line.match(/(?:^|[\s'",`])@([a-zA-Z][a-zA-Z0-9_-]*)/g) || [];
          for (const m of matches) {
            const tag = m.trim().replace(/^['",`]/, '').trim();
            if (tag.startsWith('@') && !tag.startsWith('@playwright') && !tag.includes('email') && !tag.includes('mail')) {
              tags.push(tag);
            }
          }
        }
      }
      const uniqueTags = Array.from(new Set(tags)).sort();
      specTags[specPath] = uniqueTags;
      uniqueTags.forEach((t) => allTags.add(t));
    } catch (_) {
      specTags[specPath] = [];
    }
  }

  return {
    specs,
    specTags,
    availableTags: Array.from(allTags).sort(),
  };
}

function specProjects(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  return Object.fromEntries(listSpecs(null, root).map((spec) => [spec, projectsForSpec(spec, root)]));
}

function listCodeFiles(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      if (entry.isFile() && /\.(js|cjs|mjs|json)$/i.test(entry.name)) {
        files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
      }
    }
  };
  CODE_ROOTS.forEach((r) => visit(path.join(root, r)));
  return files.sort();
}

function resolveCodeFile(filePath, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  if (!listCodeFiles(root).includes(filePath)) return null;
  const absolutePath = path.resolve(root, filePath);
  const validRoot = CODE_ROOTS.some((r) => absolutePath.startsWith(`${path.join(root, r)}${path.sep}`));
  return validRoot ? absolutePath : null;
}

module.exports = {
  loadPlaywrightConfig,
  getPlaywrightProjects,
  matchGlobOrRegex,
  projectsForSpec,
  listSpecs,
  listSpecDetails,
  specProjects,
  listCodeFiles,
  resolveCodeFile
};
