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
npm run suite:regression
```

Bash:

```bash
NODE_ENV=qc npm run suite:regression
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
├── playwright-report/   # HTML reports được nhóm theo ngày và lần chạy
├── AI_PROMPTS.md        # Quy tắc chuẩn khi viết/sửa Playwright
├── QA_AI_RULES.md       # Entry point trỏ tới AI_PROMPTS.md
└── playwright.config.js # Playwright projects và runtime config
```

`evidence/`, `playwright-report/` và `test-results/` là thư mục sinh tự động, không phải source test.

### Vai trò của từng lớp

| Lớp | Vị trí | Trách nhiệm |
|---|---|---|
| Test specification | `tests/e2e/`, `tests/api/` | Mô tả scenario, chia Given/When/Then, gọi fixture/Page Object và kiểm tra kết quả nghiệp vụ |
| Fixture | `core/fixtures/baseTest.js` | Khởi tạo Page Object, cung cấp precondition đăng nhập và factory cho popup/tab mới |
| Page Object | `pages/` | Chứa locator và hành vi UI của từng trang hoặc popup |
| Common utilities | `core/utils/` | Cung cấp UI actions, screenshot/evidence, API registration và authentication setup dùng chung |
| Test data | `data/` | Lưu dữ liệu đầu vào JSON và tài nguyên upload như CV |
| Environment config | `core/config/env.js` | Ánh xạ `NODE_ENV` sang web/API base URL |
| Runtime config | `playwright.config.js` | Khai báo timeout, browser projects, reporters, retry và artifacts |
| Reporter | `core/reporters/` | Bổ sung dashboard tổng hợp vào HTML report của Playwright |
| CI workflow | `.github/workflows/playwright.yml` | Cài dependency, kiểm tra framework, chạy unit test/E2E và upload artifacts |

### Luồng thực thi một E2E test

```text
Spec trong tests/e2e
    -> lấy Page Object/precondition từ baseTest fixture
    -> Page Object sử dụng BasePage hoặc UiActions
    -> đọc dữ liệu nghiệp vụ từ data/
    -> thao tác với website theo baseURL của môi trường
    -> assertion kiểm tra kết quả nghiệp vụ
    -> ScreenshotHelper lưu evidence
    -> Playwright và custom reporter tạo report/artifacts
```

Ví dụ, một spec ứng tuyển chỉ điều phối các bước. `JobSearchPage` phụ trách tìm việc, `JobApplyPage` phụ trách form ứng tuyển, `PopupConsent` xử lý consent, còn `BasePage` cung cấp thao tác và kiểm tra dùng chung. Cách phân lớp này giúp thay đổi locator trong Page Object mà không làm spec chứa chi tiết giao diện.

### Quan hệ giữa các thành phần chính

- `core/fixtures/baseTest.js` là điểm vào chung của UI specs và export `test`, `expect` đã mở rộng.
- Fixture tạo sẵn `HomePage`, `LoginPopup`, `OnboardingPopup`, `JobSearchPage`, `JobApplyPage`, `JobApplyNoCVPage`, `UserProfilePage` và các object dùng chung khác.
- `authenticatedUser` gọi `authSetup` để chuẩn bị user và đăng nhập trước scenario cần authentication.
- Các Page Object kế thừa hoặc kết hợp `BasePage`; thao tác phổ biến được chuyển xuống `UiActions` để thống nhất cơ chế wait/click/fill.
- `ScreenshotHelper` tạo evidence theo ngày, lần chạy và tên spec; reporter tổng hợp kết quả vào thư mục report tương ứng.

## Playwright projects

| Project | Bộ lọc | Mục đích |
|---|---|---|
| `Smoke Tests` | `e2e/**/*.spec.js` + `@smoke` | Chạy nhanh các luồng đăng ký cốt lõi |
| `Regression Tests` | `e2e/**/*.spec.js` + `@e2e`, loại `@smoke` | Chạy các UI E2E còn lại mà không lặp smoke |
| `API Tests` | `api/**/*.spec.js` + `@api` | Chạy các scenario API độc lập |

Các project dùng Desktop Chrome với viewport `1920x1080`, số worker lấy từ `PW_WORKERS` và retry tối đa 2 lần trên CI.

Ba project có phạm vi không chồng lặp. `npm test` chạy Smoke, Regression và API; `npm run suite:regression` chạy toàn bộ UI gồm Smoke + Regression.

## Lệnh thường dùng

Chạy toàn bộ E2E:

```bash
npm run suite:regression
```

Chạy toàn bộ business Apply Job:

```bash
npx playwright test --grep "@applyjob" --project="Regression Tests"
```

Chạy một spec trong đúng project:

```bash
npx playwright test tests/e2e/guest_apply_job_noCV_with_otp.spec.js --project="Regression Tests"
```

Chạy API test:

```bash
npx playwright test tests/api/register_api.spec.js --project="API Tests"
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

Chạy unit tests giống CI:

```bash
node --test
```

Liệt kê test mà không thực thi:

```bash
npx playwright test --project="Regression Tests" --list
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

- HTML report: `playwright-report/YY-MM-DD/[YY-MM-DD HH-MM-SS] report/`.
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
