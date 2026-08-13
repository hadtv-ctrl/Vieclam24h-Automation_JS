const { defineConfig, devices } = require('@playwright/test');
const envConfig = require('./core/config/env');

const reportDir = `playwright-report/report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

module.exports = defineConfig({
  // Tăng timeout mặc định cho từng test để tránh lỗi "Test timeout of 30000ms exceeded"
  timeout: 60000,
  testDir: './tests',
  fullyParallel: false, // Tắt chế độ chạy song song toàn diện
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Đặt workers = 1 để buộc tất cả các test chạy tuần tự từng cái một
  // Tạo timestamp (VD: 2026-07-06_17-15-30) để mỗi lần chạy sinh ra 1 thư mục report riêng biệt
  reporter: [
    ['json'],
    ['html', {
      outputFolder: reportDir,
      open: 'always' // Tự động bật report HTML lên trình duyệt sau mỗi lần chạy xong
    }],
    ['./core/reporters/summaryReporter.js', {
      outputFolder: reportDir
    }]
  ],
  use: {
    baseURL: envConfig.baseURL, // Lấy baseURL động theo môi trường
    // Tăng thời gian chờ điều hướng chung (ms)
    navigationTimeout: 60000,
    // actionTimeout: 0 để không giới hạn thời gian cho các hành động nếu cần
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    // --- KHAI BÁO CÁC TEST SUITE (GOM NHÓM SCRIPT) Ở ĐÂY ---
    {
      name: 'Register Suite', // Tên của cụm test
      // Chỉ định đích danh các file sẽ thuộc cụm này
      testMatch: [
        'tests/e2e/register_by_email-bdd.spec.js',
        'tests/e2e/register_by_phone-bdd.spec.js'
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'Homepage Suite',
    //   testMatch: ['tests/e2e/homepage-bdd.spec.js'],
    //   use: { ...devices['Desktop Chrome'] },
    // },
    {
      name: 'Sequential Flow Suite',
      testMatch: [
        'tests/e2e/onboarding-bdd.spec.js',
        'tests/e2e/apply_job_flow.spec.js',
        'tests/e2e/setting_user_profile-bdd.spec.js',
        'tests/e2e/apply_job_noCV_flow.spec.js'
      ],
      use: {
        browserName: 'chromium', // Hoặc 'webkit', 'firefox'
        viewport: { width: 1920, height: 1080 }, // Kích thước màn hình muốn test
        isMobile: false, // Báo cho browser biết đây là môi trường mobile
        hasTouch: false  // (Tùy chọn) Bật hỗ trợ thao tác cảm ứng
      },
    },
    // Chạy toàn bộ (mặc định)
    {
      name: 'All Tests',
      testMatch: /.*\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});
