require('dotenv').config();
const { getDashboardConfig } = require('./dashboardConfig');

const dashboardConfig = getDashboardConfig();
const environments = dashboardConfig.environments;
const ENV = process.env.NODE_ENV || dashboardConfig.runtime.defaultEnvironment || 'qc';

if (!environments[ENV]) {
  throw new Error(`Unknown NODE_ENV "${ENV}". Supported values: ${Object.keys(environments).join(', ')}`);
}

if (process.env.SHOW_ENV_BANNER === '1' || dashboardConfig.runtime.showEnvBanner) {
  console.log(`Running tests on ${ENV.toUpperCase()} environment`);
}

module.exports = {
  name: ENV,
  ...environments[ENV],
};
