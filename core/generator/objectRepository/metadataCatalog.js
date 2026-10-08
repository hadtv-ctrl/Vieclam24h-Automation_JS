'use strict';

const PAGE_ROOTS = ['pages/', 'pages/desktop/', 'pages/mobile/', 'pages/mobile-web/'];

const FIXTURE_ALLOWLIST = new Set([
  'core/fixtures/baseTest.js',
  'core/fixtures/mobileWebTest.js',
]);

const PAGE_METADATA = {
  'BasePage.js': {
    title: 'Lớp Nền Tảng (BasePage)',
    desc: 'Lớp cơ sở hệ thống chứa cơ chế Anti-Flaky Wait, Smart Evidence Capture và điều hướng an toàn cho toàn bộ Page Objects.',
    icon: 'ph-shield-check',
    platform: 'base',
    category: 'Lớp Nền Tảng (Core Foundation)',
    isBase: true,
  },
  'desktop/SamplePage.js': {
    title: 'Trang Kiểm Thử Mẫu (SamplePage)',
    desc: 'Trang mẫu demo cách xây dựng Page Object kế thừa BasePage.',
    icon: 'ph-browsers',
    platform: 'desktop',
    category: 'Trang chính',
  },
  'mobile/SampleMobilePage.js': {
    title: 'Trang Mẫu Mobile Web (SampleMobilePage)',
    desc: 'Trang mẫu demo cách xây dựng Page Object cho thiết bị di động kế thừa BasePage.',
    icon: 'ph-device-mobile',
    platform: 'mobile-web',
    category: 'Mobile Web',
  },
};

const FIXTURE_METADATA_VI = {
  workerUserData: {
    title: 'Dữ liệu người dùng theo worker',
    description: 'Cung cấp tài khoản test cô lập cho từng luồng worker song song.',
    category: 'Xác thực & Tiền điều kiện',
  },
  featureName: {
    title: 'Tên tính năng kiểm thử',
    description: 'Tự động trích xuất tên tính năng từ đường dẫn file test.',
    category: 'Hạ tầng & Nền tảng',
  },
  basePage: {
    title: 'Trang cơ sở (BasePage)',
    description: 'Lớp nền tảng chứa các tiện ích điều hướng và tương tác trình duyệt chung.',
    category: 'Hạ tầng & Nền tảng',
  },
  pageObjectsRoot: {
    title: 'Đường dẫn gốc Page Objects',
    description: 'Cấu hình thư mục chứa các đối tượng trang dùng trong kịch bản.',
    category: 'Cấu hình & Tùy chọn',
  },
  pageObjectsPlatform: {
    title: 'Nền tảng thực thi (Platform)',
    description: 'Chỉ định nền tảng (Desktop / Mobile Web) để nạp Page Object tương ứng.',
    category: 'Cấu hình & Tùy chọn',
  },
  pages: {
    title: 'Bộ điều phối Page Objects (pages)',
    description: 'Container truy cập nhanh tất cả Page Objects: pages.loginPage, pages.dashboardPage...',
    category: 'Hạ tầng & Nền tảng',
  },
  authenticatedUser: {
    title: 'Phiên đăng nhập tự động',
    description: 'Tự động xác thực tài khoản và duy trì trạng thái đăng nhập trước khi chạy test.',
    category: 'Xác thực & Tiền điều kiện',
  },
  cleanupQueue: {
    title: 'Hàng đợi dọn dẹp sau test',
    description: 'Tự động thu hồi và dọn dẹp tài nguyên (xóa tài khoản, reset dữ liệu) sau khi test hoàn tất.',
    category: 'Dọn dẹp & Hậu điều kiện',
  },
  failureTrackerHook: {
    title: 'Hook giám sát lỗi kiểm thử',
    description: 'Tự động chụp ảnh màn hình, thu thập console log khi kịch bản test thất bại.',
    category: 'Vòng đời & Hook',
  },
  ephemeralUser: {
    title: 'Tài khoản người dùng tạm thời',
    description: 'Tự động tạo user mới trước test và dọn dẹp ngay sau khi test kết thúc.',
    category: 'Dọn dẹp & Tùy biến',
  },
};

function getCoreCapabilities(_rootDir = process.cwd()) {
  return [
    {
      id: 'core_data_manager',
      title: 'Trợ Thủ Dữ Liệu Test (No-Code Data Studio)',
      desc: 'Quản lý tập trung các bộ dữ liệu người dùng, hồ sơ, ứng tuyển dạng bảng tính. Hỗ trợ import/export CSV và cơ chế tự sinh biến động chống trùng lặp dữ liệu.',
      icon: 'ph-database',
      color: '#3b82f6',
      tags: ['dataManager.js', '{{random_phone}}', 'CSV Import/Export'],
      status: 'Đang hoạt động (5 datasets)',
      linkTab: 'data-view',
      linkLabel: 'Mở tab Dữ liệu test',
    },
    {
      id: 'core_smart_evidence',
      title: 'Bằng Chứng Thông Minh (Smart DOM Evidence Capture)',
      desc: 'Tự động soi DOM thời gian thực: Tự động chụp Full Page toàn cảnh khi không có popup; Tự động chụp Viewport khi có Modal/Dialog để chống vỡ giao diện và lệch backdrop.',
      icon: 'ph-camera',
      color: '#8b5cf6',
      tags: ['ScreenshotHelper', 'AI_PROMPTS.md Sec 7', 'Smart Detection'],
      status: 'Đã tích hợp DOM Detection',
      linkTab: 'resources-view',
      linkLabel: 'Xem báo cáo & evidence',
    },
    {
      id: 'core_anti_flaky',
      title: 'Bộ Chống Flaky & Ổn Định Giao Diện (Anti-Flaky Wait)',
      desc: 'Loại bỏ hoàn toàn hardcoded sleep. Tự động chờ networkidle, chờ Skeleton loader và animation biến mất trước khi thao tác. 100% Page Objects kế thừa.',
      icon: 'ph-shield-check',
      color: '#10b981',
      tags: ['BasePage.js', 'UiActions', 'Skeleton Wait', 'NetworkIdle'],
      status: '15/15 Page Objects áp dụng',
      linkTab: 'code-view',
      linkLabel: 'Xem BasePage.js',
    },
    {
      id: 'core_auth_precondition',
      title: 'Fixture Đăng Nhập Nền Nhanh (Auth Precondition)',
      desc: 'Tự động tạo tài khoản hoặc nạp token xác thực ngầm qua API trong 1 giây, các kịch bản kiểm thử không cần gõ lại mật khẩu từ đầu, tiết kiệm 15-20s mỗi lần chạy.',
      icon: 'ph-key',
      color: '#f59e0b',
      tags: ['baseTest.js', 'authSetup.js', 'registrationApiHelper.js'],
      status: 'Tích hợp trong tất cả E2E Specs',
      linkTab: 'builder-view',
      linkLabel: 'Xem kịch bản BDD',
    },
    {
      id: 'core_spec_compiler',
      title: 'Trình Biên Dịch Kịch Bản BDD (Spec Generator & Guard)',
      desc: 'Chuyển đổi trực tiếp các khối hành động kéo thả dạng khối tiếng Việt sang mã Playwright Test chuẩn BDD Given/When/Then, tự động kiểm tra cú pháp và backup trước khi ghi.',
      icon: 'ph-tree-structure',
      color: '#ec4899',
      tags: ['visualBuilderCompiler.js', 'recordParser.js', 'actionRegistry.js'],
      status: 'Điều phối 12 kịch bản BDD',
      linkTab: 'builder-view',
      linkLabel: 'Mở BDD Studio',
    },
  ];
}

module.exports = {
  PAGE_ROOTS,
  FIXTURE_ALLOWLIST,
  PAGE_METADATA,
  FIXTURE_METADATA_VI,
  getCoreCapabilities,
};
