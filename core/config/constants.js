const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'dashboardConfig.json');

const DEFAULT_CONFIG = Object.freeze({
  environments: {
    qc: {
      label: 'QC',
      baseURL: 'https://example.com',
      apiBaseURL: 'https://httpbin.org',
    },
    stg: {
      label: 'Staging',
      baseURL: 'https://staging.example.com',
      apiBaseURL: 'https://httpbin.org',
    },
    prod: {
      label: 'Production',
      baseURL: 'https://example.com',
      apiBaseURL: 'https://httpbin.org',
    },
  },
  runtime: {
    defaultEnvironment: 'qc',
    workers: 2,
    testTimeout: 60000,
    navigationTimeout: 60000,
    actionTimeout: 0,
    retriesLocal: 0,
    retriesCI: 2,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
    showEnvBanner: false,
    debugOptionalPopups: false,
  },
  api: {
    registrationBearerToken: '',
    branch: 'main',
    lang: 'vi',
    registerRetries: 2,
    registerTimeout: 30000,
    consentRetries: 2,
    consentTimeout: 30000,
  },
  artifacts: {
    retentionDays: 14,
    maxReportsPerDay: 20,
    autoCleanupEvidence: false,
    autoCleanupReports: false,
  },
  server: {
    port: 4180,
  },
  // Vị trí tài liệu QA của TỪNG dự án. Thư mục spec khác nhau giữa các repo
  // (tests/ ở đây, playwright/tests ở repo khác) nên phải khai được, không hard-code.
  // dashboardConfig.json nằm trong excludes của sync nên mỗi repo tự giữ giá trị của mình.
  qa: {
    requirements: 'requirements',
    testCases: 'test-cases',
    specs: 'tests',
    decisionsFile: 'decisions.json',
  },
  // Thư mục tài liệu RIÊNG của dự án, được mục Hướng dẫn tự quét.
  // Nhờ vậy thêm một tài liệu không còn phải sửa code trong dashboard/ — vùng mà sync
  // ghi đè toàn bộ, nên mọi chỉnh sửa ở đó sẽ biến mất ở lần đồng bộ kế tiếp.
  docs: {
    dir: 'docs',
  },
  branding: {
    projectName: "QA Automation Studio",
    projectSubtitle: "Playwright Automation Platform",
    pageTitle: "QA Automation Dashboard",
    logoUrl: "",
    primaryColor: "#0A65CC",
    backgroundColor: "",
    fontSize: "14px"
  },
  suites: {
    "smoke": {
      label: "Smoke Tests",
      project: "all",
      viewport: { preset: "default", width: 1920, height: 1080 },
      spec: "all",
      specs: "all",
      grep: "@smoke",
      workers: 2
    }
  },
  discord: {
    webhookUrl: '',
    channelName: '#qa-automation-reports',
    notifyOnFinish: true,
    notifyOnlyOnFailure: false,
  },
});

// Các key của môi trường do Hub chuẩn hoá riêng ở trên. Mọi key chuỗi khác được coi là
// mở rộng của dự án và giữ nguyên. KHÔNG thêm tên field riêng của dự án vào đây.
const ENV_RESERVED_KEYS = new Set(['label', 'baseURL', 'apiBaseURL']);

const TRACE_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];
const SCREENSHOT_OPTIONS = ['off', 'on', 'only-on-failure'];
const VIDEO_OPTIONS = ['off', 'on', 'retain-on-failure', 'on-first-retry'];

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  ENV_RESERVED_KEYS,
  TRACE_OPTIONS,
  SCREENSHOT_OPTIONS,
  VIDEO_OPTIONS,
};
