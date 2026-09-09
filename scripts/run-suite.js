const { spawn } = require('child_process');
const { getDashboardConfig } = require('../core/config/dashboardConfig');

const suiteName = process.argv[2] ? process.argv[2].trim() : '';
const env = process.argv[3] ? process.argv[3].trim() : 'dev';
const explicitSpec = process.argv[4] ? process.argv[4].trim() : '';

if (!suiteName) {
  console.error('Vui lòng cung cấp tên suite. Ví dụ: node scripts/run-suite.js admin-flows dev');
  process.exit(1);
}

const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const config = getDashboardConfig();
const suiteEntries = Object.entries(config.suites || {});
const matchedEntry = suiteEntries.find(([key, val]) => {
  return norm(key) === norm(suiteName) || norm(val.label) === norm(suiteName);
});

const suite = matchedEntry ? matchedEntry[1] : null;

const args = ['test'];

if (suiteName.toLowerCase() === 'check') {
  require('./check-framework-structure');
  process.exit(0);
} else if (suiteName.toLowerCase() === 'e2e') {
  args.push('tests/e2e');
} else if (suiteName.toLowerCase() === 'file') {
  if (!explicitSpec) {
    console.error('Vui lòng cung cấp đường dẫn file spec.');
    process.exit(1);
  }
  args.push(explicitSpec);
} else if (suite) {
  console.log(`[Suite Runner] Đang chạy kịch bản: ${suite.label || matchedEntry[0]}`);

  function mapProjectName(p, key) {
    if (!p || p === 'all') {
      return key === 'mobile'
        ? ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests']
        : ['Desktop Smoke Tests', 'Desktop Regression Tests'];
    }
    const lower = p.toLowerCase();
    if (lower === 'chromium' || lower.includes('desktop chrome')) {
      return ['Desktop Smoke Tests', 'Desktop Regression Tests'];
    }
    if (lower === 'mobile-chrome' || lower.includes('pixel')) {
      return ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests'];
    }
    if (lower === 'mobile-safari' || lower.includes('iphone')) {
      return ['Mobile Safari Smoke Tests', 'Mobile Safari Regression Tests'];
    }
    return [p];
  }

  // Composite suite: Cha chứa nhiều con
  if (suite.type === 'composite' || (Array.isArray(suite.suites) && suite.suites.length > 0)) {
    const childKeys = Array.isArray(suite.suites) ? suite.suites : [];
    console.log(`[Composite Suite] Kịch bản cha kích hoạt ${childKeys.length} kịch bản con: ${childKeys.join(', ')}`);
    const compSpecs = [];
    const compProjects = [];
    let compWorkers = suite.workers || 2;
    const compGreps = [];

    for (const childKey of childKeys) {
      const childSuite = config.suites?.[childKey];
      if (!childSuite) {
        console.warn(`[Composite Suite] Cảnh báo: Kịch bản con "${childKey}" không tồn tại trong cấu hình.`);
        continue;
      }
      if (Array.isArray(childSuite.specs) && childSuite.specs.length > 0 && childSuite.specs !== 'all') {
        compSpecs.push(...childSuite.specs);
      } else if (childSuite.spec && childSuite.spec !== 'all') {
        compSpecs.push(childSuite.spec);
      }
      if (childSuite.project && childSuite.project !== 'all') {
        compProjects.push(...mapProjectName(childSuite.project, childSuite.platform));
      } else if (childSuite.platform === 'mobile') {
        compProjects.push('Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests');
      } else if (childSuite.platform === 'desktop') {
        compProjects.push('Desktop Smoke Tests', 'Desktop Regression Tests');
      }
      if (childSuite.grep) compGreps.push(childSuite.grep);
      if (childSuite.workers) compWorkers = Math.max(compWorkers, childSuite.workers);
    }

    if (compSpecs.length > 0) {
      args.push(...[...new Set(compSpecs)]);
    }
    for (const proj of [...new Set(compProjects)]) {
      args.push(`--project=${proj}`);
    }
    if (compGreps.length > 0) {
      args.push('--grep', compGreps.join('|'));
    }
    if (compWorkers) {
      args.push(`--workers=${compWorkers}`);
    }
  } else if (suite.platforms && typeof suite.platforms === 'object') {
    const activePlatforms = Object.entries(suite.platforms).filter(([, p]) => p.enabled !== false);
    const multiSpecs = [];
    const multiProjects = [];
    let customWorkers = suite.workers || 2;

    for (const [pKey, pVal] of activePlatforms) {
      if (Array.isArray(pVal.specs) && pVal.specs.length > 0 && pVal.specs !== 'all') {
        multiSpecs.push(...pVal.specs);
      }

      if (pVal.project && pVal.project !== 'all') {
        multiProjects.push(...mapProjectName(pVal.project, pKey));
      } else if (pKey === 'mobile') {
        multiProjects.push('Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests');
      } else if (pKey === 'desktop') {
        multiProjects.push('Desktop Smoke Tests', 'Desktop Regression Tests');
      }
      if (pVal.workers) customWorkers = Math.max(customWorkers, pVal.workers);
    }

    if (multiSpecs.length > 0) {
      args.push(...[...new Set(multiSpecs)]);
    }
    for (const proj of [...new Set(multiProjects)]) {
      args.push(`--project=${proj}`);
    }
    if (suite.grep) {
      args.push('--grep', suite.grep);
    }
    if (customWorkers) {
      args.push(`--workers=${customWorkers}`);
    }
  } else {
    if (Array.isArray(suite.specs) && suite.specs.length > 0 && suite.specs !== 'all') {
      args.push(...suite.specs);
    } else if (suite.spec && suite.spec !== 'all') {
      args.push(suite.spec);
    }
    if (suite.project && suite.project !== 'all') {
      args.push(`--project=${suite.project}`);
    }
    if (suite.grep) {
      args.push('--grep', suite.grep);
    }
    if (suite.workers) {
      args.push(`--workers=${suite.workers}`);
    }
  }
} else {
  // Built-in presets
  const s = suiteName.toLowerCase();
  if (s === 'smoke') {
    args.push('--grep', '@smoke');
  } else if (s === 'regression') {
    args.push('--grep-invert', '@smoke');
  } else if (s === 'applyjob' || s === 'apply-job') {
    args.push('--grep', '@applyjob');
  } else if (s === 'profile') {
    args.push('--grep', '@profile');
  } else if (s === 'desktop') {
    args.push('--project=Desktop Smoke Tests', '--project=Desktop Regression Tests');
  } else if (s === 'mobile') {
    args.push('--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Regression Tests');
  } else if (s === 'api') {
    args.push('--project=API Tests');
  } else {
    console.error(`Không tìm thấy kịch bản nào phù hợp với: "${suiteName}"`);
    console.error('Các kịch bản hợp lệ:', ['check', 'e2e', 'smoke', 'regression', 'applyjob', 'profile', 'desktop', 'mobile', 'api', 'file', ...Object.keys(config.suites || {})].join(', '));
    process.exit(1);
  }
}

const envVars = {
  ...process.env,
  NODE_ENV: env,
};

if (suite?.viewport) {
  envVars.PW_VIEWPORT_WIDTH = String(suite.viewport.width || 1920);
  envVars.PW_VIEWPORT_HEIGHT = String(suite.viewport.height || 1080);
}

const playwrightCli = require.resolve('@playwright/test/cli');
const child = spawn(process.execPath, [playwrightCli, ...args], {
  stdio: 'inherit',
  env: envVars,
});

child.on('close', (code) => {
  process.exit(code || 0);
});
