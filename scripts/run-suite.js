const { spawn } = require('child_process');
const { getDashboardConfig } = require('../core/config/dashboardConfig');

const rawArgs = process.argv.slice(2);
const suiteName = rawArgs[0] ? rawArgs[0].trim() : '';

if (!suiteName) {
  console.error('Vui lòng cung cấp tên suite. Ví dụ: node scripts/run-suite.js smoke qc');
  process.exit(1);
}

// Tách môi trường (qc/stg/prod/dev) và các cờ CLI mở rộng (--list, --headed, etc.)
let env = 'qc';
const extraCliFlags = [];
for (let i = 1; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith('--')) {
    extraCliFlags.push(arg);
  } else if (!arg.startsWith('-') && i === 1) {
    env = arg.trim();
  } else {
    extraCliFlags.push(arg);
  }
}

const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const config = getDashboardConfig();
const suiteEntries = Object.entries(config.suites || {});
const matchedEntry = suiteEntries.find(([key, val]) => {
  return norm(key) === norm(suiteName) || norm(val.label) === norm(suiteName);
});

const suite = matchedEntry ? matchedEntry[1] : null;
const args = ['test'];

function mapProjectName(p, key) {
  if (!p || p === 'all') {
    return key === 'mobile'
      ? ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests', 'Mobile Safari Smoke Tests', 'Mobile Safari Regression Tests']
      : ['Desktop Smoke Tests', 'Desktop Regression Tests'];
  }
  const lower = p.toLowerCase();
  if (lower === 'chromium' || lower.includes('desktop chrome') || lower === 'desktop') {
    return ['Desktop Smoke Tests', 'Desktop Regression Tests'];
  }
  if (lower === 'mobile-chrome' || lower.includes('pixel') || lower.includes('android')) {
    return ['Mobile Chrome Smoke Tests', 'Mobile Chrome Regression Tests'];
  }
  if (lower === 'mobile-safari' || lower.includes('iphone') || lower.includes('ios')) {
    return ['Mobile Safari Smoke Tests', 'Mobile Safari Regression Tests'];
  }
  return [p];
}

if (suiteName.toLowerCase() === 'check') {
  require('./check-framework-structure');
  process.exit(0);
} else if (suiteName.toLowerCase() === 'e2e') {
  args.push('tests/e2e');
} else if (suiteName.toLowerCase() === 'file') {
  const explicitSpec = rawArgs[2] ? rawArgs[2].trim() : (rawArgs[1] && !rawArgs[1].startsWith('-') ? rawArgs[1].trim() : '');
  if (!explicitSpec) {
    console.error('Vui lòng cung cấp đường dẫn file spec. Ví dụ: node scripts/run-suite.js file tests/e2e/desktop/register_by_phone-bdd.spec.js');
    process.exit(1);
  }
  args.push(explicitSpec);
} else if (suite) {
  console.log(`[Suite Runner] Đang chạy kịch bản: ${suite.label || matchedEntry[0]}`);

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
      if (Array.isArray(childSuite.projects) && childSuite.projects.length > 0) {
        compProjects.push(...childSuite.projects);
      } else if (childSuite.project && childSuite.project !== 'all') {
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

      if (Array.isArray(pVal.projects) && pVal.projects.length > 0) {
        multiProjects.push(...pVal.projects);
      } else if (pVal.project && pVal.project !== 'all') {
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
    if (Array.isArray(suite.projects) && suite.projects.length > 0) {
      for (const p of suite.projects) {
        args.push(`--project=${p}`);
      }
    } else if (suite.project && suite.project !== 'all') {
      args.push(`--project=${suite.project}`);
    } else if (suite.platform === 'mobile') {
      args.push('--project=Mobile Chrome Smoke Tests', '--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Smoke Tests', '--project=Mobile Safari Regression Tests');
    } else if (suite.platform === 'desktop') {
      args.push('--project=Desktop Smoke Tests', '--project=Desktop Regression Tests');
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
  const s = suiteName.toLowerCase().replace(/-/g, ':');
  if (s === 'smoke' || s === 'smoke:all') {
    args.push('--project=Desktop Smoke Tests', '--project=Mobile Chrome Smoke Tests', '--project=Mobile Safari Smoke Tests');
    args.push('--grep', '@smoke');
  } else if (s === 'smoke:desktop') {
    args.push('--project=Desktop Smoke Tests');
    args.push('--grep', '@smoke');
  } else if (s === 'smoke:mobile') {
    args.push('--project=Mobile Chrome Smoke Tests', '--project=Mobile Safari Smoke Tests');
    args.push('--grep', '@smoke');
  } else if (s === 'regression' || s === 'full:regression') {
    args.push('--grep-invert', '@smoke');
  } else if (s === 'applyjob' || s === 'apply:job') {
    args.push('--grep', '@applyjob');
  } else if (s === 'applyjob:desktop' || s === 'apply:job:desktop') {
    args.push('--project=Desktop Regression Tests');
    args.push('--grep', '@applyjob');
  } else if (s === 'applyjob:mobile' || s === 'apply:job:mobile') {
    args.push('--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Regression Tests');
    args.push('--grep', '@applyjob');
  } else if (s === 'profile' || s === 'user:profile') {
    args.push('--grep', '@profile');
  } else if (s === 'profile:desktop' || s === 'user:profile:desktop') {
    args.push('--project=Desktop Regression Tests');
    args.push('--grep', '@profile');
  } else if (s === 'profile:mobile' || s === 'user:profile:mobile') {
    args.push('--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Regression Tests');
    args.push('--grep', '@profile');
  } else if (s === 'auth' || s === 'register') {
    args.push('--grep', '@register');
  } else if (s === 'onboarding') {
    args.push('--grep', '@onboarding');
  } else if (s === 'desktop' || s === 'desktop:all') {
    args.push('--project=Desktop Smoke Tests', '--project=Desktop Regression Tests');
  } else if (s === 'mobile' || s === 'mobile:all') {
    args.push('--project=Mobile Chrome Smoke Tests', '--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Smoke Tests', '--project=Mobile Safari Regression Tests');
  } else if (s === 'mobile:android' || s === 'android') {
    args.push('--project=Mobile Chrome Smoke Tests', '--project=Mobile Chrome Regression Tests');
  } else if (s === 'mobile:ios' || s === 'ios') {
    args.push('--project=Mobile Safari Smoke Tests', '--project=Mobile Safari Regression Tests');
  } else if (s === 'api') {
    args.push('--project=API Tests');
  } else {
    console.error(`Không tìm thấy kịch bản nào phù hợp với: "${suiteName}"`);
    console.error('Các kịch bản hợp lệ:', [
      'smoke', 'smoke:desktop', 'smoke:mobile',
      'regression', 'full:regression',
      'applyjob', 'applyjob:desktop', 'applyjob:mobile',
      'profile', 'profile:desktop', 'profile:mobile',
      'auth', 'onboarding',
      'desktop', 'mobile', 'mobile:android', 'mobile:ios',
      'api', 'check', 'e2e', 'file',
      ...Object.keys(config.suites || {})
    ].join(', '));
    process.exit(1);
  }
}

// Gộp các cờ CLI mở rộng được truyền vào
if (extraCliFlags.length > 0) {
  args.push(...extraCliFlags);
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
