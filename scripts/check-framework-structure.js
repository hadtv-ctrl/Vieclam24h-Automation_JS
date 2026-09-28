const fs = require('fs');
const path = require('path');
const { findHardcodedSecrets } = require('./lib/secretScan');

function runFrameworkCheck({ root = process.cwd(), targetArgs = [] } = {}) {
  const sourceDirs = ['tests/e2e', 'tests/api', 'pages', 'core/utils', 'core/fixtures'];
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

  const files = targetArgs.length > 0
    ? targetArgs.map((f) => path.normalize(f.replace(/^[/\\]+/, ''))).filter((file) => file.endsWith('.js') && fs.existsSync(path.join(root, file)))
    : sourceDirs.flatMap(walk).filter((file) => file.endsWith('.js'));
  const specFiles = files.filter((file) => file.startsWith(`tests${path.sep}`) && file.endsWith('.spec.js'));
  const pageFiles = files.filter((file) => file.startsWith(`pages${path.sep}`));

  if (targetArgs.length === 0) {
    if (specFiles.length === 0) issues.push('tests/e2e: no .spec.js files found');
    if (pageFiles.length === 0) issues.push('pages: no Page Object files found');
  }

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

  const aiHostPattern = /\b(?:generativelanguage\.googleapis\.com|api\.openai\.com|api\.deepseek\.com)\b/g;
  const aiDirs = ['core', 'dashboard'];
  const aiFiles = aiDirs.flatMap(walk).filter((f) => f.endsWith('.js'));
  for (const file of aiFiles) {
    const norm = file.split(path.sep).join('/');
    if (norm.endsWith('.test.js') || norm.endsWith('.spec.js') || norm.startsWith('core/ai/gateway/adapters/') || norm === 'core/ai/gateway/endpointPolicy.js' || norm.startsWith('dashboard/public/')) {
      continue;
    }
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    reportMatches(file, content, aiHostPattern, 'calls direct AI host outside gateway adapters (AI17-01)');
  }

  issues.push(...findHardcodedSecrets({ root, files: targetArgs.length > 0 ? files : null }));

  const passed = issues.length === 0;
  const summary = passed
    ? `Framework checks passed (${specFiles.length} specs, ${pageFiles.length} page objects).`
    : `Framework rule violations found (${issues.length} issues).`;

  return {
    ok: true,
    passed,
    summary,
    issues,
    specCount: specFiles.length,
    pageCount: pageFiles.length,
  };
}

if (require.main === module) {
  const targetArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const result = runFrameworkCheck({ root: process.cwd(), targetArgs });
  if (!result.passed) {
    console.error('Framework rule violations found:');
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log(result.summary);
}

module.exports = {
  runFrameworkCheck,
};
