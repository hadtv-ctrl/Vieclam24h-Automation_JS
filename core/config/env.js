require('dotenv').config();

// Bỏ dấu // khi cần ép số Playwright worker chạy local.
// process.env.PW_WORKERS = '2';

const ENV = process.env.NODE_ENV || 'qc';

const environments = {
  qc: {
    baseURL: 'https://seeker.vl24hv2.qc.sieuviet-team.com',
    apiBaseURL: 'https://api.vl24hv2.qc.sieuviet-team.com'
  },
  stg: {
    baseURL: 'https://seeker.vl24hv2.staging.sieuviet-team.com',
    apiBaseURL: 'https://api.vl24hv2.staging.sieuviet-team.com'
  },
  prod: {
    // Lưu ý: URL PROD hiện đang được set giống STG theo như yêu cầu
    baseURL: 'https://seeker.vl24hv2.staging.sieuviet-team.com',
    apiBaseURL: 'https://api.vl24hv2.staging.sieuviet-team.com'
  }
};

if (!environments[ENV]) {
  throw new Error(`Unknown NODE_ENV "${ENV}". Supported values: ${Object.keys(environments).join(', ')}`);
}

if (process.env.SHOW_ENV_BANNER === '1') {
  console.log(`Running tests on ${ENV.toUpperCase()} environment`);
}

module.exports = environments[ENV];
