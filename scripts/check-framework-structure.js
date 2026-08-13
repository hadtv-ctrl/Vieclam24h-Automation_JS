const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sourceDirs = ['tests/e2e', 'pages', 'core/utils', 'core/fixtures'];
const issues = [];

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    issues.push(`${relativeDir}: required directory is missing`);
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    return entry.isDirectory() ? walk(relativePath) : [relativePath];
  });
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function reportMatches(file, content, pattern, message) {
  for (const match of content.matchAll(pattern)) {
    issues.push(`${file}:${lineNumber(content, match.index)} ${message}`);
  }
}

const files = sourceDirs.flatMap(walk).filter((file) => file.endsWith('.js'));
const specFiles = files.filter((file) => file.startsWith(`tests${path.sep}e2e${path.sep}`));
const pageFiles = files.filter((file) => file.startsWith(`pages${path.sep}`));

if (specFiles.length === 0) issues.push('tests/e2e: no .spec.js files found');
if (pageFiles.length === 0) issues.push('pages: no Page Object files found');

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');

  reportMatches(file, content, /\bpage\.waitForTimeout\s*\(/g, 'uses forbidden page.waitForTimeout()');
  reportMatches(file, content, /\.context\(\)\._options\b/g, 'uses private Playwright context._options');
  reportMatches(file, content, /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g, 'silently swallows an error with catch(() => {})');

  if (!file.startsWith(`core${path.sep}utils${path.sep}`)) {
    reportMatches(file, content, /\bpage\.screenshot\s*\(/g, 'calls page.screenshot() outside a utility');
  }

  if (file.endsWith('.spec.js')) {
    reportMatches(file, content, /\bpage\.(?:locator|getByRole|getByLabel|getByPlaceholder|getByTestId|getByText|screenshot|evaluate)\s*\(/g, 'uses a direct page locator/action in a spec');
    reportMatches(file, content, /require\(\s*['"]fs['"]\s*\)|from\s+['"]fs['"]/g, 'imports fs in a spec');

    if (!/\btest\s*\(|\btest\.describe\s*\(/.test(content)) {
      issues.push(`${file}: missing Playwright test structure`);
    }
  }
}

if (issues.length > 0) {
  console.error('Framework rule violations found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Framework checks passed (${specFiles.length} specs, ${pageFiles.length} page objects).`);
