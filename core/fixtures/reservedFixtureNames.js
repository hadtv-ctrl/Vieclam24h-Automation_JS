/**
 * Tên fixture do framework sở hữu; custom fixture trùng tên sẽ bị bỏ qua.
 * Đứng riêng một module để baseTest.js và custom/index.js cùng dùng mà không require vòng:
 * custom/index.js nạp fixture ngay lúc được require, khi baseTest.js còn chưa chạy xong,
 * nên lấy tập này từ baseTest.js sẽ nhận `undefined` và mọi custom fixture đều nạp hỏng.
 */
const RESERVED_FIXTURE_NAMES = new Set([
  'test', 'expect', 'page', 'request', 'browser', 'context',
  'basePage', 'pages', 'workerUserData', 'authenticatedUser',
  'cleanupQueue', 'featureName', 'pageObjectsRoot', 'pageObjectsPlatform',
  'isMobile', 'viewport', 'browserName', 'storageState', 'circuitBreakerGuard'
]);

module.exports = { RESERVED_FIXTURE_NAMES };
