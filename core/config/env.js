require('dotenv').config();

const ENV = process.env.NODE_ENV || 'qc';

console.log('=======================================');
console.log(`🚀 ĐANG CHẠY TEST TRÊN MÔI TRƯỜNG: ${ENV.toUpperCase()}`);
console.log('=======================================');

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

module.exports = environments[ENV];
