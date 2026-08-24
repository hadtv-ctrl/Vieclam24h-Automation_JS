# Automation Testing Framework - Việc Làm 24h

Framework kiểm thử tự động cho hệ thống Việc Làm 24h, xây dựng bằng Playwright và JavaScript theo Page Object Model (POM). Repository hiện bao gồm E2E UI, API test, dữ liệu kiểm thử, evidence screenshot và HTML report tùy chỉnh.

## Yêu cầu hệ thống

- Node.js 18 trở lên.
- npm.
- Chromium do Playwright quản lý.
- Windows, macOS hoặc Linux.

## Cài đặt

```bash
npm install
npx playwright install chromium
```

Môi trường mặc định là `qc`. Các giá trị hỗ trợ hiện tại: `qc`, `stg`, `prod`.

PowerShell:

```powershell
$env:NODE_ENV = 'qc'
npx playwright test --project='E2E Tests'
```

Bash:

```bash
NODE_ENV=qc npx playwright test --project='E2E Tests'
```

Các URL được quản lý tập trung trong `core/config/env.js` và được đưa vào Playwright qua `baseURL`. Không hard-code domain trong spec hoặc Page Object.

## Cấu trúc repository

```text
.
├── core/
│   ├── config/          # Cấu hình môi trường
│   ├── fixtures/        # Playwright custom fixtures
│   ├── reporters/       # HTML summary reporter và unit test
│   └── utils/           # UI actions, auth/API helpers và unit test
├── data/                # JSON test data, CV và tài nguyên upload
├── pages/               # Page Objects, popup và BasePage
├── scripts/             # Kiểm tra cấu trúc framework
├── tests/
│   ├── api/             # API tests
│   ├── e2e/             # UI E2E specs
│   └── setup/           # Setup scripts
├── evidence/            # Evidence sinh khi chạy test
├── playwright-report/   # HTML reports theo timestamp
├── AI_PROMPTS.md        # Quy tắc chuẩn khi viết/sửa Playwright
├── QA_AI_RULES.md       # Entry point trỏ tới AI_PROMPTS.md
└── playwright.config.js # Playwright projects và runtime config
```

`evidence/`, `playwright-report/` và `test-results/` là thư mục sinh tự động, không phải source test.

## Playwright projects

| Project | Bộ lọc | Mục đích |
|---|---|---|
| `Desktop Chrome` | Tất cả `*.spec.js` | Chạy toàn bộ UI và API specs trên Desktop Chrome |
| `E2E Tests` | `@e2e` | Chạy toàn bộ UI E2E |
| `Apply Job Tests` | `@applyjob` | Chạy các business flow ứng tuyển |

Các project dùng viewport `1920x1080`, `workers: 1`, không chạy song song và retry 2 lần trên CI.

Lưu ý: `npm test` không chỉ định project nên các test có tag có thể được chạy lại ở nhiều project. Khi chạy targeted suite, luôn truyền `--project`.

## Lệnh thường dùng

Chạy toàn bộ E2E:

```bash
npx playwright test --project="E2E Tests"
```

Chạy toàn bộ business Apply Job:

```bash
npx playwright test --project="Apply Job Tests"
```

Chạy một spec trong đúng project:

```bash
npx playwright test tests/e2e/guest_apply_job_noCV_with_otp.spec.js --project="Apply Job Tests"
```

Chạy API test:

```bash
npx playwright test tests/api/register_api.spec.js --project="Desktop Chrome"
```

Chạy suite đăng ký UI:

```bash
npm run suite:register
```

Chạy headed hoặc UI mode:

```bash
npm run test:headed
npm run test:ui
```

Kiểm tra cấu trúc framework:

```bash
npm run check:framework
```

Chạy unit tests hiện có:

```bash
node --test core/utils/commonUtils.test.js core/reporters/htmlSummaryReporter.test.js
```

Liệt kê test mà không thực thi:

```bash
npx playwright test --project="Apply Job Tests" --list
```

Mở HTML report:

```bash
npm run report
```

## Tags hiện tại

| Tag | Phạm vi |
|---|---|
| `@e2e` | UI E2E scenarios |
| `@applyjob` | Scenario thực sự thực hiện ứng tuyển và kiểm tra danh sách đã ứng tuyển |
| `@register` | Đăng ký bằng email/số điện thoại và API đăng ký |
| `@profile` | Thiết lập, viết và upload profile/CV |
| `@onboarding` | Onboarding sau đăng nhập |
| `@ai` | Tính năng AI trong profile |
| `@api` | API-only scenarios |

Chỉ gắn `@applyjob` cho script có business apply. Các script chỉ cập nhật profile không dùng tag này.

## Kiến trúc và quy ước bắt buộc

Nguồn quy tắc chính thức là `AI_PROMPTS.md`. Khi viết hoặc sửa Playwright, phải tuân thủ các nguyên tắc chính sau:

- Mỗi scenario độc lập tương ứng một `test()`.
- Spec dùng `test.step()` theo Given/When/Then và chỉ điều phối hành vi.
- Spec không gọi trực tiếp `page.locator()`, `page.getBy*()`, `page.evaluate()` hoặc thao tác UI.
- Locator và UI action thuộc Page Object trong `pages/`.
- Action phổ biến tái sử dụng `UiActions` và `BasePage`.
- Test data nghiệp vụ đặt trong `data/`, không hard-code bộ dữ liệu lớn trong spec.
- Không dùng `waitForTimeout()` hoặc hard sleep; chờ URL, element, response hoặc trạng thái nghiệp vụ cuối.
- Ưu tiên locator theo role, label/placeholder và test id.
- Sau Apply thành công, flow `@applyjob` phải mở và kiểm tra danh sách “Việc làm đã ứng tuyển”.

## Common helpers

- `BasePage`: navigation, click/fill, ổn định UI, OTP/phone verification, applied-jobs verification và capture wrapper.
- `UiActions`: wait-visible trước click/fill/check, autocomplete nhập bằng keyboard events và timeout action.
- `ScreenshotHelper`: quản lý evidence path, thứ tự ảnh và trạng thái visual.
- `authSetup`: tạo user bằng API cho precondition; nếu API thất bại chỉ fallback sang user đã đăng ký trong `data/users.json`.
- `RegistrationApiHelper`: payload/header, retry network timeout, consent API và runtime user state.
- `PopupConsent`: xử lý consent bắt buộc hoặc optional theo business flow.

Không tạo user ngẫu nhiên rồi giả định user đã đăng ký nếu API precondition thất bại.

## Evidence và reports

Reporter hiện tại gồm JSON, HTML chuẩn của Playwright và dashboard tùy chỉnh.

- HTML report: `playwright-report/report-YYYY-MM-DDTHH-MM-SS/`.
- Failure artifacts: `test-results/`.
- Business evidence: `evidence/YY-MM-DD/[YY-MM-DD HH-MM-SS] <spec-name>/`.
- Trace: `on-first-retry`.
- Screenshot tự động: `only-on-failure`.
- Video: `retain-on-failure`.

Trong source automation, không gọi `page.screenshot()` trực tiếp. Dùng `capture()`/`ScreenshotHelper`. Full-page dành cho page không có modal; viewport dành cho popup/modal. Tránh capture trùng nhau hoặc capture trạng thái loading trung gian.

## Đồng bộ và xử lý lỗi thường gặp

- Navigation do click: đăng ký `waitForURL()` cùng click bằng `Promise.all()`.
- OTP: chờ input OTP hoặc trạng thái đích; không dùng overlay làm điều kiện thành công duy nhất.
- Save/Submit: chờ form đóng, nút Save biến mất hoặc nội dung đã lưu hiển thị.
- Autocomplete: dùng common action nhập tuần tự để kích hoạt keyboard events, scope option trong đúng dropdown.
- Overlay chặn click: action phải có timeout hữu hạn; chỉ retry sau khi overlay hidden.
- API timeout: retry giới hạn và dùng tài khoản fallback đã đăng ký hợp lệ.

## Quy trình kiểm chứng sau khi thay đổi

```bash
npm run check:framework
node --test core/utils/commonUtils.test.js core/reporters/htmlSummaryReporter.test.js
npx playwright test <affected-spec> --project="<affected-project>"
```

Nếu thay đổi Page Object hoặc common helper được nhiều spec sử dụng, chạy thêm tất cả targeted specs liên đới. Không báo pass khi chưa thực thi lệnh kiểm chứng tương ứng.
