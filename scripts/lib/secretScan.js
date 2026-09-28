/**
 * scripts/lib/secretScan.js
 * Finds API keys and tokens written into source files. Used by check:framework so a key
 * pasted into code fails the check before it is committed and synced to every satellite.
 */
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  { label: 'OpenAI-compatible API key (sk-…)', regex: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g },
  { label: 'Google API key (AIza…)', regex: /\bAIza[0-9A-Za-z_-]{35}/g },
  { label: 'GitHub token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,})/g },
];

const SCAN_DIRS = ['core', 'dashboard', 'tools', 'scripts', 'pages', 'tests', 'bin', 'ai', 'config'];
const SCAN_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.json', '.html', '.md', '.yml', '.yaml']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'playwright-report', 'test-results', '.dashboard-backups', '.dashboard-drafts']);

function listFiles(root, relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listFiles(root, relativePath);
    return SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [relativePath] : [];
  });
}

/** Shows only the first characters, so the report itself never repeats the secret. */
function redact(value) {
  return `${value.slice(0, 6)}…(${value.length} ký tự)`;
}

function scanContent(file, content) {
  const findings = [];
  for (const { label, regex } of SECRET_PATTERNS) {
    for (const match of content.matchAll(regex)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${line} contains a hard-coded ${label} ${redact(match[0])}; read it from .env or Settings instead`);
    }
  }
  return findings;
}

function findHardcodedSecrets({ root = process.cwd(), files = null } = {}) {
  const targets = files || SCAN_DIRS.flatMap((dir) => listFiles(root, dir));
  return targets.flatMap((file) => scanContent(file, fs.readFileSync(path.join(root, file), 'utf8')));
}

module.exports = { findHardcodedSecrets, scanContent };
