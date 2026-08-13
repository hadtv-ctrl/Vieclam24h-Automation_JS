# Dự Án Automation Testing - Việc Làm 24h

Dự án này là framework kiểm thử tự động bằng [Playwright](https://playwright.dev/) theo mô hình Page Object Model (POM) và các kịch bản End-to-End có cấu trúc rõ ràng. Mục tiêu là giúp nhóm QA viết test dễ đọc, dễ bảo trì và dễ mở rộng.

## Yêu cầu hệ thống
- Node.js >= 18
- npm
- Hệ điều hành: Windows, macOS hoặc Linux

## Cài đặt nhanh
1. Cài dependencies:
   ```bash
   npm install
   ```
2. Cài trình duyệt hỗ trợ bởi Playwright:
   ```bash
   npx playwright install
   ```
3. Nếu cần chạy trên môi trường khác, thiết lập biến môi trường trước khi chạy:
   ```bash
   set NODE_ENV=qc
   ```
   hoặc
   ```bash
   set NODE_ENV=stg
   ```
   Mặc định nếu không khai báo thì dự án sẽ dùng môi trường `qc`.

## Cấu trúc thư mục thực tế
- `tests/e2e/`: chứa các file test End-to-End theo chuẩn Playwright.
- `tests/setup/`: chứa script setup chạy trước khi suite bắt đầu.
- `pages/`: các class Page Object đại diện cho từng màn hình hoặc popup.
- `core/config/`: cấu hình môi trường, bao gồm `env.js` để lấy `baseURL` theo `NODE_ENV`.
- `core/utils/`: các helper dùng chung cho test.
- `core/fixtures/`: custom fixtures của Playwright.
- `core/reporters/`: reporter tùy chỉnh cho báo cáo kết quả.
- `data/`: dữ liệu test dạng JSON như `users.json`, `applyJobData.json`.
- `evidence/`: thư mục lưu ảnh bằng chứng chụp trong quá trình chạy test.
- `playwright-report/`: thư mục báo cáo HTML và trace được sinh ra sau mỗi lần chạy.
- `scripts/`: các script kiểm tra cấu trúc framework.

## Cách chạy test
Các lệnh chính đã được định nghĩa trong `package.json`:

### 1. Chạy toàn bộ test
```bash
npm run test
```

### 2. Chạy test ở chế độ có giao diện trình duyệt
```bash
npm run test:headed
```

### 3. Chạy test ở chế độ UI mode của Playwright
```bash
npm run test:ui
```

### 4. Xem báo cáo HTML sau khi chạy
```bash
npm run report
```

### 5. Chạy theo suite đã định nghĩa
```bash
npm run suite:register
npm run suite:smoke
npm run suite:regression
```

### 6. Chạy một file test cụ thể
```bash
npx playwright test tests/e2e/register_by_phone-bdd.spec.js
```

### 7. Kiểm tra cấu trúc framework
```bash
npm run check:framework
```

## Quy ước khi viết test mới
1. Bắt buộc dùng Page Object Model: locator và hành động UI nên được đặt trong `pages/`.
2. File test phải nằm trong `tests/e2e/` và có hậu tố `.spec.js`.
3. Dữ liệu test nên được lưu trong `data/` thay vì hardcode trong spec.
4. Các helper chung nên đặt trong `core/utils/` để tái sử dụng.
5. Nên dùng assertion của Playwright (`expect`) và chia luồng test rõ ràng bằng các bước `Given`, `When`, `Then`.

## Mẹo sử dụng hiệu quả
- Khi debug, ưu tiên dùng `npm run test:ui` để quan sát từng bước thực thi.
- Khi cần xem kết quả sau khi chạy, mở thư mục `playwright-report/` hoặc chạy `npm run report`.
- Nếu cần lưu bằng chứng hình ảnh, hãy dùng helper trong `core/utils/` thay vì chụp trực tiếp trong spec.
