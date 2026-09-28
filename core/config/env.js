require('dotenv').config();
const { getDashboardConfig } = require('./dashboardConfig');

const dashboardConfig = getDashboardConfig();
const environments = dashboardConfig.environments;
const rawEnv = process.env.NODE_ENV || dashboardConfig.runtime.defaultEnvironment || 'qc';
const ENV = typeof rawEnv === 'string' ? rawEnv.trim() : 'qc';

if (!environments[ENV]) {
  throw new Error(`Unknown NODE_ENV "${ENV}". Supported values: ${Object.keys(environments).join(', ')}`);
}

if (process.env.SHOW_ENV_BANNER === '1' || dashboardConfig.runtime.showEnvBanner) {
  console.log(`Running tests on ${ENV.toUpperCase()} environment`);
}

// Guard: Cảnh báo khi baseURL vẫn là placeholder mặc định của Hub template
const resolvedBaseURL = environments[ENV].baseURL || '';
const PLACEHOLDER_URLS = ['https://example.com', 'https://staging.example.com', 'http://example.com'];
if (PLACEHOLDER_URLS.includes(resolvedBaseURL)) {
  const isFrameworkCheck = process.argv.some((a) => a.includes('check-framework') || a.includes('check:framework'));
  if (!isFrameworkCheck) {
    console.warn(
      `[env] ⚠️  baseURL cho môi trường '${ENV}' vẫn là placeholder '${resolvedBaseURL}'.\\n`
      + `  → Cập nhật URL thật trong dashboardConfig.json hoặc core/config/dashboardConfig.json.`
    );
  }
}

module.exports = {
  name: ENV,
  ...environments[ENV],
};
