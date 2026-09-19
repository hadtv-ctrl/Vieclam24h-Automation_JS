const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  normalizeDashboardConfig,
  publicDashboardConfig,
} = require('./dashboardConfig');

test('public dashboard config hides registration bearer token', () => {
  const config = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    api: {
      ...DEFAULT_CONFIG.api,
      registrationBearerToken: 'sample-bearer-token',
    },
  });
  const publicConfig = publicDashboardConfig(config);

  assert.equal(publicConfig.api.registrationBearerToken, '');
  assert.equal(publicConfig.api.hasRegistrationBearerToken, true);
});

test('settings payload without a token keeps the existing bearer token', () => {
  const config = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    api: {
      ...DEFAULT_CONFIG.api,
      registrationBearerToken: 'original-token',
    },
  });
  const saved = normalizeDashboardConfig({
    ...config,
    api: {
      branch: 'main.north',
      lang: 'vi',
      registerRetries: 2,
      registerTimeout: 30000,
      consentRetries: 2,
      consentTimeout: 30000,
    },
  }, config);

  assert.equal(saved.api.registrationBearerToken, 'original-token');
});

test('dashboard config rejects invalid environment URLs', () => {
  assert.throws(
    () => normalizeDashboardConfig({
      ...DEFAULT_CONFIG,
      environments: {
        qc: {
          label: 'QC',
          baseURL: 'not-a-url',
          apiBaseURL: DEFAULT_CONFIG.environments.qc.apiBaseURL,
        },
      },
    }),
    /valid http\(s\) URL/
  );
});

// Hợp đồng MỚI: file Hub này không được hard-code tên field của bất kỳ dự án nào.
// Trước đây các key lạ bị strip, buộc mỗi vệ tinh phải fork dashboardConfig.js —
// và bản fork đó bị sync xoá (commit 7ad6984 @ Automation_Carthings).
test('normalizeDashboardConfig giữ lại mọi key chuỗi do dự án tự định nghĩa', () => {
  const result = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    environments: {
      qc: {
        label: 'QC',
        baseURL: 'https://qc.example.com',
        apiBaseURL: 'https://api.example.com',
        projectPortalURL: 'https://qc.other-domain.com  ',
        partnerURL: 'https://company.other-domain.com',
        retries: 7,
        nested: { ignored: true },
      },
    },
  });

  assert.equal(result.environments.qc.projectPortalURL, 'https://qc.other-domain.com');
  assert.equal(result.environments.qc.partnerURL, 'https://company.other-domain.com');
  assert.equal(result.environments.qc.baseURL, 'https://qc.example.com');
  // Chỉ nhận giá trị chuỗi; số/object không lọt vào entry môi trường.
  assert.equal(result.environments.qc.retries, undefined);
  assert.equal(result.environments.qc.nested, undefined);
});

test('key riêng của dự án không bị xoá khi lưu thiếu field', () => {
  const existing = normalizeDashboardConfig({
    ...DEFAULT_CONFIG,
    environments: {
      qc: { label: 'QC', baseURL: 'https://qc.example.com', projectPortalURL: 'https://portal.example.com' },
    },
  });

  const saved = normalizeDashboardConfig(
    { environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com' } }, runtime: { defaultEnvironment: 'qc' } },
    existing,
  );

  assert.equal(saved.environments.qc.projectPortalURL, 'https://portal.example.com');
});

test('normalizePort handles static port, random, auto, and fallbacks', () => {
  const { normalizePort, getProjectHashPort } = require('./dashboardConfig');
  assert.equal(normalizePort(4180), 4180);
  assert.equal(normalizePort('4185'), 4185);
  assert.equal(normalizePort('random'), 'random');
  assert.equal(normalizePort(0), 'random');
  assert.equal(normalizePort('0'), 'random');
  assert.equal(normalizePort('auto'), 'auto');
  assert.equal(normalizePort('invalid', 4180), 4180);
  assert.equal(normalizePort(999999, 4180), 4180);

  const hashPort = getProjectHashPort('d:\\_Automation-Project');
  assert.equal(typeof hashPort, 'number');
  assert.ok(hashPort >= 4180 && hashPort <= 4280);
});


