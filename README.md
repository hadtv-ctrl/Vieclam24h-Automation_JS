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
| `Smoke Tests` | `e2e/desktop/**/*.spec.js` + `@smoke` | Chạy nhanh các luồng desktop cốt lõi |
| `Regression Tests` | `e2e/desktop/**/*.spec.js` + `@e2e`, loại `@smoke` | Chạy các UI desktop E2E còn lại |
| `Mobile Chrome Smoke Tests` | `e2e/mobile-web/**/*.spec.js` + `@smoke` | Smoke mobile web với profile Pixel 7/Chromium |
| `Mobile Chrome Regression Tests` | `e2e/mobile-web/**/*.spec.js` + `@e2e`, loại `@smoke` | Regression mobile web với profile Pixel 7/Chromium |
| `Mobile Safari Smoke Tests` | `e2e/mobile-web/**/*.spec.js` + `@smoke` | Smoke mobile web với profile iPhone 13/WebKit |
| `Mobile Safari Regression Tests` | `e2e/mobile-web/**/*.spec.js` + `@e2e`, loại `@smoke` | Regression mobile web với profile iPhone 13/WebKit |
| `API Tests` | `api/**/*.spec.js` + `@api` | Chạy các scenario API độc lập |

Các project desktop dùng Desktop Chrome với viewport `1920x1080`. Project mobile dùng device profile chuẩn của Playwright để mô phỏng viewport, user agent, touch và browser engine tương ứng. Số worker lấy từ `PW_WORKERS` và retry tối đa 2 lần trên CI.

Page Object desktop nằm trực tiếp trong `pages/desktop/`; Page Object mobile nằm trong `pages/mobile-web/` và chỉ override behavior khác biệt. Spec desktop nằm trong `tests/e2e/desktop/`, còn spec mobile nằm trong `tests/e2e/mobile-web/`. Hai nhóm được lọc riêng ở cấp Playwright project để dễ chạy và debug độc lập.

Ba project có phạm vi không chồng lặp. `npm test` chạy Smoke, Regression và API; `npm run suite:regression` chạy toàn bộ UI gồm Smoke + Regression.

## Lệnh thường dùng

Khởi động giao diện điều khiển local:

Dashboard là ứng dụng local nhẹ, được xây dựng bằng Node.js (`http`), HTML, CSS và JavaScript thuần, không dùng frontend framework hoặc bước build riêng. Backend gọi Playwright CLI để chạy test và dùng Server-Sent Events (SSE) để cập nhật log, trạng thái theo thời gian thực.

```bash
npm run dashboard
```

Lệnh trên chạy foreground và tắt bằng `Ctrl+C`. Để chạy ngầm và tắt lại bằng lệnh:

```bash
npm run dashboard:start
npm run dashboard:stop
```

Đóng tab trình duyệt không tắt dashboard server.

Sau đó mở `http://127.0.0.1:4173`. Dashboard cho phép chọn environment, project, spec, tag, workers, theo dõi log trực tiếp và mở report mới nhất. Server chỉ lắng nghe trên máy local và chỉ nhận các lựa chọn đã được kiểm soát.

Tab **Artifacts & Files** cho phép duyệt toàn bộ Playwright reports, evidence screenshots, `AI_PROMPTS.md`, hướng dẫn framework và các file JSON trong `data/`. Chọn một mục trong danh sách để mở report, ảnh hoặc nội dung file ngay ở vùng chi tiết bên phải. Các trường dữ liệu nhạy cảm được che mặc định và chỉ hiển thị khi người dùng chủ động chọn xem dữ liệu gốc. Nút **Open Playwright UI** khởi chạy UI Mode chính thức trong cửa sổ riêng để debug test.

`AI_PROMPTS.md` và các file `data/*.json` có thể được chỉnh sửa trong tab này; JSON được validate trước khi lưu và bản cũ được sao lưu vào `.dashboard-backups/`. Evidence và report có thể xóa sau bước xác nhận; khi xóa report, toàn bộ thư mục artifact của đúng lần chạy đó sẽ bị xóa.

Evidence được hiển thị theo cây `ngày → lần chạy → spec → worker → ảnh`; trạng thái folder được giữ khi chọn hoặc chuyển ảnh bằng nút Previous/Next. Có thể xóa từng ảnh hoặc cả folder sau bước xác nhận. Tab **Compare Evidence** nhúng visual comparison tool từ `tools/visual_compare.html` để so sánh screenshot.

Tab **Framework Code** cung cấp cây source cho `tests/`, `pages/` và `core/`, bộ lọc theo lớp, tìm kiếm, xem và chỉnh sửa trực tiếp. JavaScript/JSON được kiểm tra cú pháp và file cũ được backup trước khi lưu.

Chạy toàn bộ E2E:

```bash
npm run suite:regression
```

Chạy mobile web trên cả Android/Chromium và iOS/WebKit:

```bash
npx playwright install chromium webkit
npm run suite:mobile
```

Chạy riêng từng nền tảng:

```bash
npm run suite:mobile:android
npm run suite:mobile:ios
```

Chạy một spec mobile cụ thể:

```bash
npx playwright test tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js --project="Mobile Chrome Regression Tests"
```

Chạy toàn bộ business Apply Job:

```bash
npx playwright test --grep "@applyjob" --project="Regression Tests"
```

Chạy một spec trong đúng project:

```bash
npx playwright test tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js --project="Regression Tests"
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

- HTML report: `playwright-report/YY-MM-DD/<platform>/[run-id] report/`.
- Failure artifacts: `test-results/`.
- Business evidence: `evidence/YY-MM-DD/<platform>/[run-id] <spec-name>/worker-<index>/`.
- Worker report: `playwright-report/YY-MM-DD/<platform>/[run-id] report/workers/worker-<index>/`.
- Platform hiện hỗ trợ: `desktop`, `mobile-web`, `mobile-app`; run chứa nhiều platform được đặt trong `multi-platform`.
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
