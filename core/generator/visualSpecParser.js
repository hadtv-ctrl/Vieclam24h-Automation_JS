/**
 * core/generator/visualSpecParser.js
 * Extracts BDD steps, page objects, and metadata from existing Playwright specs.
 * Budget <= 200 lines.
 */
const fs = require('fs');
const path = require('path');
const { PRESET_ACTIONS } = require('./visualBuilderPresets');
const { FIXTURE_PAGE_MAP, getFixturePageMap } = require('./visualFixtureMap');

function parseExistingSpecFile(filePath, rootDir = process.cwd(), precomputedFixtureMap = null) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file kịch bản: ${filePath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isMobile = normalizedPath.includes('mobile-web');

  let featureName = path.basename(filePath, '.spec.js');
  let tags = '';
  const descMatch = content.match(/test\.describe\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/i);
  if (descMatch) {
    const rawDescribeString = descMatch[1] || descMatch[2] || descMatch[3] || '';
    const describeTagMatches = rawDescribeString.match(/@[\w-]+/g) || [];
    tags = Array.from(new Set(describeTagMatches)).join(' ');
    const rawDesc = rawDescribeString.replace(/^Feature:\s*/i, '');
    featureName = rawDesc.replace(/@[\w-]+/g, '').trim();
  }

  let scenarioName = 'Kịch bản kiểm thử';
  const testMatch = content.match(/test\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
  if (testMatch) {
    scenarioName = (testMatch[1] || testMatch[2] || testMatch[3] || '').trim();
  }

  let dataSource = 'none';
  const dataFiles = [];
  const dataRegex = /require\(\s*['"`](?:.*\/)?data\/([^'"`]+)['"`]\s*\)/gi;
  let dMatch;
  while ((dMatch = dataRegex.exec(content)) !== null) {
    const dName = dMatch[1];
    if (!dataFiles.some((d) => d.name === dName)) {
      dataFiles.push({ name: dName, relativePath: `data/${dName}` });
    }
  }
  if (dataFiles.length > 0) dataSource = dataFiles[0].name;

  const fixtures = [];
  const argsMatch = content.match(/test\([^,]+,\s*async\s*\(\s*\{([^}]*)\}\s*\)/);
  if (argsMatch) {
    argsMatch[1].split(',').forEach((arg) => {
      const trimmed = arg.trim();
      if (trimmed && trimmed !== 'page' && trimmed !== 'test' && trimmed !== 'expect') {
        fixtures.push(trimmed);
      }
    });
  }

  const pageMap = new Map();
  const fixturePageMap = precomputedFixtureMap || getFixturePageMap(rootDir);

  const pagesCallRegex = /\bpages\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(/g;
  let pcMatch;
  while ((pcMatch = pagesCallRegex.exec(content)) !== null) {
    const alias = pcMatch[1];
    const act = pcMatch[2];
    const pageInfo = fixturePageMap[alias] || fixturePageMap[alias.toLowerCase()];
    if (pageInfo) {
      const existing = pageMap.get(pageInfo.relativePath);
      if (existing) {
        if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !existing.actions.includes(act)) {
          existing.actions.push(act);
          existing.actionCount = existing.actions.length;
        }
      } else {
        const actions = ['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) ? [] : [act];
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name, className: pageInfo.className, relativePath: pageInfo.relativePath,
          actions, actionCount: actions.length,
        });
      }
    }
  }

  for (const [fixName, pageInfo] of Object.entries(fixturePageMap)) {
    const fixRegex = new RegExp(`\\b${fixName}\\b`);
    if (fixRegex.test(content) || fixtures.includes(fixName)) {
      const actRegex = new RegExp(`\\b${fixName}\\.([a-zA-Z0-9_]+)\\s*\\(`, 'g');
      const actions = [];
      let aMatch;
      while ((aMatch = actRegex.exec(content)) !== null) {
        const act = aMatch[1];
        if (!['capture', 'waitForLoadState', 'waitForTimeout'].includes(act) && !actions.includes(act)) {
          actions.push(act);
        }
      }
      const existing = pageMap.get(pageInfo.relativePath);
      if (existing) {
        actions.forEach((a) => { if (!existing.actions.includes(a)) existing.actions.push(a); });
        existing.actionCount = existing.actions.length;
      } else if (actions.length > 0 || fixtures.includes(fixName)) {
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name, className: pageInfo.className, relativePath: pageInfo.relativePath,
          actions, actionCount: actions.length,
        });
      }
    }
  }

  const destructureRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*pages\b/g;
  let dStructMatch;
  while ((dStructMatch = destructureRegex.exec(content)) !== null) {
    const vars = dStructMatch[1].split(',').map((v) => v.trim().split(':')[0].trim()).filter(Boolean);
    for (const v of vars) {
      const pageInfo = fixturePageMap[v] || fixturePageMap[v.toLowerCase()];
      if (pageInfo && !pageMap.has(pageInfo.relativePath)) {
        pageMap.set(pageInfo.relativePath, {
          name: pageInfo.name, className: pageInfo.className, relativePath: pageInfo.relativePath,
          actions: [], actionCount: 0,
        });
      }
    }
  }

  const stepRegex = /await\s+test\.step\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\);/g;
  const steps = [];
  let match;
  while ((match = stepRegex.exec(content)) !== null) {
    const rawTitle = (match[1] || match[2] || match[3] || '').trim();
    const body = (match[4] || '').trim();
    let stepType = 'When';
    let cleanTitle = rawTitle;

    const typeMatch = rawTitle.match(/^(Given|When|Then|And)\s+(.+)$/i);
    if (typeMatch) {
      stepType = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
      cleanTitle = typeMatch[2].trim();
    }

    let matchedActionId = '';
    if (body.includes('.goto(')) matchedActionId = 'navigate_url';
    else if (body.includes('.waitFor({') || body.includes('.waitFor(')) matchedActionId = 'wait_visible';
    else if (body.includes('.screenshot(') || body.includes('.capture(')) matchedActionId = 'take_screenshot';
    else if (body.includes('.click(')) matchedActionId = 'click_element';
    else if (body.includes('.fill(')) matchedActionId = 'fill_text';

    if (!matchedActionId) {
      const assertionMatch = body.match(/\.((?:toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toHaveURL|toBeEnabled|toBeDisabled))\s*\(/);
      if (assertionMatch) matchedActionId = `assertion_${assertionMatch[1]}`;
    }

    if (!matchedActionId) {
      const exactPreset = PRESET_ACTIONS.find((p) => p.name.toLowerCase() === cleanTitle.toLowerCase());
      if (exactPreset) matchedActionId = exactPreset.id;
    }

    steps.push({
      id: `s_${Date.now()}_${steps.length + 1}`,
      stepType,
      title: cleanTitle,
      actionId: matchedActionId,
      code: body,
    });
  }

  return {
    filePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
    featureName,
    scenarioName,
    platform: isMobile ? 'mobile-web' : 'desktop',
    tags: tags || '@e2e @visualBuilder',
    dataSource,
    dataFiles,
    primaryDataFile: dataFiles[0]?.name || (dataSource !== 'none' ? dataSource : null),
    pages: Array.from(pageMap.values()),
    pageCount: pageMap.size,
    fixtures,
    steps,
    stepCount: steps.length,
    specCode: content,
  };
}

module.exports = {
  FIXTURE_PAGE_MAP,
  getFixturePageMap,
  parseExistingSpecFile,
};
