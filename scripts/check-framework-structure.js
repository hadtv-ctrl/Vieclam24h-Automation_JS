const fs = require('fs');
const path = require('path');

const root = process.cwd();
const specDir = path.join(root, 'tests', 'e2e');
const pagesDir = path.join(root, 'pages');
const utilsDir = path.join(root, 'core', 'utils');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const specFiles = walk(specDir).filter((file) => file.endsWith('.spec.js'));
const issues = [];

for (const file of specFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('page.waitForTimeout(')) {
    issues.push(`${path.relative(root, file)}: uses page.waitForTimeout()`);
  }

  if (content.match(/page\.locator\(/)) {
    issues.push(`${path.relative(root, file)}: uses page.locator() directly`);
  }

  if (!content.includes('test.describe') && !content.includes('test(')) {
    issues.push(`${path.relative(root, file)}: missing Playwright test structure`);
  }
}

const pageFiles = walk(pagesDir).filter((file) => file.endsWith('.js'));
if (pageFiles.length === 0) {
  issues.push('No page object files found under pages/');
}

const utilFiles = walk(utilsDir).filter((file) => file.endsWith('.js'));
if (utilFiles.length === 0) {
  issues.push('No utility files found under core/utils/');
}

if (issues.length > 0) {
  console.log('Framework structure issues found:');
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Framework structure looks good.');
