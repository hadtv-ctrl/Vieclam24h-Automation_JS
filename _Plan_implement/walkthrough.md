# Kế Hoạch Triển Khai: UI Recorder Studio Cho Playwright Dashboard

Tài liệu này ghi lại toàn bộ lộ trình, kiến trúc kỹ thuật và tiêu chuẩn chất lượng (Definition of Done) cho tính năng **UI Recorder Studio** tích hợp vào Dashboard của dự án, tuân thủ nghiêm ngặt mô hình **Page Object Model (POM)** và **BDD** theo quy định tại [ai/shared/AI_PROMPTS.md](../ai/shared/AI_PROMPTS.md).

---

## 1. Mục Tiêu & Triết Lý Cốt Lõi

Xây dựng một **UI Recorder Studio** trực tiếp trên giao diện Dashboard với chu trình khép kín:
```
Record thao tác bằng Playwright Codegen
       │
       ▼
Lưu Raw Script tạm vào .tmp/recordings/
       │
       ▼
Preview & Cấu hình Mapping
       │
       ▼
Convert sang POM & Spec BDD chuẩn repo (Draft)
       │
       ▼
User duyệt Diff & nhận Cảnh báo (Warning Panel)
       │
       ▼
Lưu an toàn (Sandbox + JS Syntax Validate + Auto-Backup)
       │
       ▼
Chạy Framework Guard (check:framework) & Chạy thử Targeted Spec ngay
```

> [!IMPORTANT]
> **Triết lý thiết kế:** Không cố làm "auto 100%" từ đầu. Định hướng xây dựng **AI-assisted / Rule-assisted Generator** (hỗ trợ sinh draft, QA kiểm duyệt diff trước khi lưu) để đảm bảo chất lượng mã nguồn bền vững và không làm vỡ kiến trúc framework.

## Backlog

### PLAN-03 — Smart AI Copilot & Test Error Diagnostics

- **Trạng thái:** Backlog, chưa triển khai.
- **Phạm vi:** Prompt tiếng Việt ➔ structured state theo schema dùng chung; diagnostics deterministic trước, AI chỉ diễn giải dữ liệu đã mask.
- **Điều kiện bắt đầu:** `wizardSchema`/compiler ổn định và runner/report hoàn tất artifact contract.
- **Acceptance chính:** API không ghi file trực tiếp; validate schema, Page Object, fixture, action, data path và platform; có timeout/retry/quota, audit id, secret masking, prompt-injection protection và fallback.
- **Tài liệu chi tiết:** [03_PLAN_SMART_AI_COPILOT_AND_DIAGNOSTICS.md](03_PLAN_SMART_AI_COPILOT_AND_DIAGNOSTICS.md).

---

## 2. Chi Tiết Các Giai Đoạn Triển Khai (Phased Roadmap)

### 🟢 Phase 1: Recorder MVP (Thu thập tương tác thô an toàn)

#### Backend (`dashboard/server.js`):
- Thêm trạng thái riêng `activeRecorder`, tách biệt hoàn toàn khỏi tiến trình chạy test `activeRun`.
- Danh sách API:
  - `POST /api/recorder/start`
  - `POST /api/recorder/stop`
  - `GET /api/recorder/state` (hoặc `/api/recorder/status`)
  - `GET /api/recorder/output` (hoặc `/api/recorder/file`)
- Khi kích hoạt `start`, server spawn tiến trình:
  ```bash
  npx playwright codegen --target=playwright-test --output .tmp/recordings/<id>.spec.js <url>
  ```
- Hỗ trợ các tùy chọn linh hoạt:
  - `url`: Địa chỉ trang web khởi đầu.
  - `browser`: chromium / chrome / firefox / webkit.
  - `device`: Desktop / Mobile preset (iPhone 14, Pixel 7,...).
  - `viewportSize`: Kích thước màn hình (1920x1080 hoặc 390x844).
  - `loadStorage`: Nạp trạng thái phiên / cookies đã lưu (nếu có).
  - `testIdAttribute`: Cấu hình thuộc tính test ID (ví dụ: `data-test-id`).
- **Nguyên tắc an toàn:** Không ghi trực tiếp vào `tests/e2e/` ở phase này; file raw chỉ nằm trong `.tmp/recordings/`.

#### Frontend (`dashboard/public/`):
- Thêm tab hoặc modal **"🔴 Ghi kịch bản UI (Recorder)"** trên topbar.
- Form cấu hình bắt đầu ghi (URL, phân hệ, thiết bị).
- Nút **"Bắt đầu ghi (Codegen)"** và **"Dừng ghi & Lấy mã"**.
- Panel hiển thị mã raw Playwright vừa ghi kèm số lượng hành động.
- Nút **"Convert Draft"** để chuyển sang bước chuẩn hóa.

**Deliverable Phase 1:** QA có thể bấm record trực tiếp từ Dashboard và lấy mã thô Playwright script một cách an toàn.

---

### 🟢 Phase 2: Raw Parser (Trích xuất hành động có cấu trúc)

Tổ chức cấu trúc module chuyên biệt tại `core/generator/`:
```text
core/generator/
  ├── recordParser.js        # Đọc raw script -> Intermediate JSON actions
  ├── recordTransformer.js   # Chuyển đổi actions -> Draft POM & BDD Spec
  ├── recordWriter.js        # Quản lý sandbox, backup & framework guard
  └── namingUtils.js         # Chuẩn hóa tên biến/hàm & phân tích cảnh báo locator
```

#### Trách nhiệm của `recordParser.js`:
- Đọc raw Playwright script do Codegen sinh ra.
- Trích xuất các action:
  - `page.goto(url)`
  - `page.getByRole(...).click()`
  - `page.getByLabel(...).fill(...)`
  - `page.locator(...).click()`
  - `expect(...)`
- Phân tích cú pháp có kiểm soát (regex patterns được chuẩn hóa hoặc AST parser như `acorn` khi cần mở rộng).
- Output trả về là cấu trúc **Intermediate JSON Actions**:
  ```json
  {
    "scenarioName": "recorded scenario",
    "detectedUrl": "https://seeker.vl24hv2.qc.sieuviet-team.com/...",
    "actions": [
      { "id": "act_1", "type": "goto", "url": "/tim-kiem-viec-lam" },
      { "id": "act_2", "type": "fill", "locator": "page.getByPlaceholder('...')", "value": "Kế toán", "raw": "..." },
      { "id": "act_3", "type": "click", "locator": "page.getByRole('button', { name: 'Tìm kiếm' })", "raw": "..." }
    ]
  }
  ```

**Deliverable Phase 2:** Raw script được chuyển đổi thành danh sách Action có cấu trúc, độc lập với cú pháp thô.

---

### 🟢 Phase 3: Draft Transformer POM & BDD (Chuẩn hóa kiến trúc)

Module `recordTransformer.js` chịu trách nhiệm sinh bản nháp (Draft), **chưa ghi file thật**.

#### Input:
- Parsed actions từ Phase 2.
- Target platform: `desktop` hoặc `mobile-web`.
- Target Page Object: Chọn Page Object đã có hoặc nhập tên Page Object mới.
- Target spec name: Tên file kịch bản BDD.
- Feature name & evidence options.

#### Output:
```json
{
  "pageObjectPath": "pages/desktop/JobSearchPage.js",
  "specPath": "tests/e2e/desktop/job_search-bdd.spec.js",
  "pageObjectCode": "...",
  "specCode": "...",
  "warnings": [
    "Dòng 3: Thao tác click sử dụng .first() - khuyến nghị scope cụ thể hơn.",
    "Dòng 5: Sử dụng XPath phức tạp - khuyến nghị thay bằng getByRole hoặc getByTestId."
  ]
}
```

#### Quy tắc sinh Page Object:
- Class kế thừa từ `BasePage`.
- Toàn bộ locator nằm trong Page Object (khai báo trong constructor).
- Thao tác UI bọc qua `this.actions` (`UiActions`) hoặc các method của `BasePage` (`this.navigate()`, `this.capture()`).
- **Tuyệt đối không sinh:** `page.getBy*()` trong spec, `page.screenshot()`, `page.waitForTimeout()`, `catch(() => {})`.
- **Warning System:** Phát hiện và cảnh báo nếu raw locator dùng `.nth()`, `.first()`, XPath phức tạp hoặc CSS thiếu scope.

#### Quy tắc sinh Spec BDD:
- Import đúng fixture phù hợp:
  - Desktop: `core/fixtures/baseTest`
  - Mobile: `core/fixtures/mobileWebTest`
- Mỗi scenario tương ứng một `test()`.
- Chia các bước rõ ràng theo chuẩn BDD:
  - `await test.step('Given ...', async () => {})`
  - `await test.step('When ...', async () => {})`
  - `await test.step('Then ...', async () => {})`
- Spec chỉ điều phối Page Object/helper và assertion cấp hành vi (`expect(pageObject.xxx).toBeVisible()`).
- Tự động gắn evidence tại các mốc có ý nghĩa (đầu scenario khi mở page và kết thúc khi hoàn tất action).

**Deliverable Phase 3:** Có bản draft POM + draft Spec chuẩn quy tắc, xem và chỉnh sửa được trên giao diện web.

---

### 🟢 Phase 4: Preview, Diff & Lưu File An Toàn (Sandbox Protection)

#### Backend API:
- `POST /api/recorder/convert`: Nhận cấu hình mapping ➔ trả về draft code kèm cảnh báo.
- `POST /api/recorder/save-draft`: Thực hiện ghi file có kiểm soát an toàn.

#### Quy tắc lưu file (Save Rules):
1. **Sandbox Whitelist:** Chỉ cho phép ghi vào các thư mục:
   - `pages/desktop/`, `pages/mobile-web/`
   - `tests/e2e/desktop/`, `tests/e2e/mobile-web/`
   - Chặn tuyệt đối mọi đường dẫn tùy ý hoặc Path Traversal (`..`).
2. **JavaScript Syntax Validation:** Trước khi ghi, validate mã nguồn bằng `new Function(content)` để đảm bảo file không có lỗi cú pháp.
3. **Auto-Backup:** Nếu file đích đã tồn tại (chế độ append/update), tự động sao lưu bản cũ vào `.dashboard-backups/<timestamp>/`.
4. **Framework Guard Check:** Ngay sau khi ghi file thành công, server tự động thực thi:
   ```bash
   npm run check:framework
   ```
   và trả kết quả đánh giá tĩnh về Dashboard.

#### Frontend UI:
- **Diff & Code Studio:**
  - Tab 1: Page Object Draft Editor.
  - Tab 2: Spec BDD Draft Editor.
  - Panel cảnh báo (Warning Panel) nếu có locator yếu.
- **Action Buttons:**
  - `💾 Lưu vào Framework (Tự động Backup)`
  - `📋 Sao chép mã`
  - `🛡️ Kiểm tra Framework Guard`
  - `🚀 Chạy thử Spec vừa lưu`

**Deliverable Phase 4:** QA kiểm duyệt code hoàn toàn trước khi lưu, framework được bảo vệ tuyệt đối khỏi lỗi cú pháp và vi phạm kiến trúc.

---

### 🟢 Phase 5: Test Execution Integration (Chạy thử tức thì)

Sau khi lưu file thành công:
- Dashboard cung cấp nút **"🚀 Chạy thử Spec này ngay"**.
- Tự động nhận diện Project Playwright phù hợp dựa trên đường dẫn file:
  - `tests/e2e/desktop/...` ➔ Chạy với project **Desktop Smoke / Regression**.
  - `tests/e2e/mobile-web/...` ➔ Chạy với project **Mobile Chrome / Safari**.
- **Không chạy full suite mặc định**, chỉ chạy đúng targeted spec vừa sinh.
- Stream log trực tiếp trên Console của Dashboard qua SSE (`/api/events`).
- Hiển thị liên kết xem Playwright HTML Report và Evidence ảnh chụp ngay sau khi test hoàn tất.

**Deliverable Phase 5:** Chu trình hoàn chỉnh: Record ➔ Convert ➔ Save ➔ Run ngay trong Dashboard chỉ với vài cú click.

---

### 🟢 Phase 6: Smart Reuse Nâng Cao (Tối ưu hóa thông minh)

Sau khi MVP ổn định, nâng cấp các tính năng thông minh:
- **Tái sử dụng Method cũ:** Quét các Page Object hiện có để gợi ý tái sử dụng method thay vì sinh method trùng lặp (ví dụ: chuỗi click nút login ➔ gợi ý `login()` đã có).
- **Gợi ý Mapping nghiệp vụ:**
  - Chuỗi submit ➔ method `submitForm()`.
  - Chuỗi điền form hồ sơ ➔ method `fillProfileForm(data)`.
- **Tách Test Data:** Tự động trích xuất các bộ dữ liệu lớn sang `data/*.json` thay vì hard-code trong method.
- **Tự động phân loại Page theo URL:**
  - `/dang-nhap` ➔ `LoginPopup`
  - `/tim-kiem-viec-lam` ➔ `JobSearchPage`
  - `/ung-tuyen` ➔ `JobApplyPage`
- **Khuyến nghị nâng cấp Locator:** Gợi ý thay đổi các CSS/XPath sang `getByRole` với accessible name hoặc `getByTestId`.

---

## 3. Danh Sách "Không Làm Ở MVP" (Out of Scope)

Để tránh phình to phạm vi (scope creep) và giữ mã nguồn luôn ở chất lượng cao nhất, các mục sau **chưa làm ở giai đoạn đầu**:
- ❌ **Không làm Chrome Extension riêng.**
- ❌ **Không làm bộ nạp import Chrome DevTools Recorder JSON.**
- ❌ **Không tự động merge ngầm vào Page Object phức tạp mà không có sự xác nhận của QA.**
- ❌ **Không tự động sửa đổi code của các tính năng cũ ngoài phạm vi.**
- ❌ **Không tự động công bố test pass nếu chưa thực sự chạy qua runner.**

---

## 4. Tiêu Chuẩn Hoàn Thành (Definition of Done - DoD)

Một bản release được coi là đạt tiêu chuẩn khi thỏa mãn toàn bộ các điều kiện:

- [x] **Recorder hoạt động ổn định:** Khởi chạy và dừng `playwright codegen` mượt mà từ Dashboard.
- [x] **Quản lý file thô an toàn:** Raw script chỉ lưu trong `.tmp/recordings/`, không xáo trộn workspace.
- [x] **Chuyển đổi đúng chuẩn:** Sinh bản nháp Page Object (extends `BasePage`, `UiActions`) và Spec BDD (`test.step`).
- [x] **Spec sạch sẽ:** Tuyệt đối không chứa locator UI trực tiếp (`page.getBy*()`, `page.locator()`).
- [x] **Không vi phạm cấm:** Không có `page.screenshot()` ngoài helper, không có `waitForTimeout()`, không có Playwright private API.
- [x] **Lưu file có bảo vệ:** Kiểm tra Sandbox, kiểm tra cú pháp JS (`new Function`), tự động backup vào `.dashboard-backups/`.
- [x] **Framework Guard vượt qua:** `npm run check:framework` chạy thành công với 0 lỗi vi phạm.
- [x] **Chạy thử targeted spec:** Cho phép kích hoạt chạy đúng file test vừa sinh ngay trên Dashboard.
- [x] **Warning rõ ràng:** Giao diện có thông báo cảnh báo rõ ràng khi locator hoặc action chưa tối ưu.

---

> **Tài liệu tham chiếu:**
> - [ai/shared/AI_PROMPTS.md](../ai/shared/AI_PROMPTS.md): Quy chuẩn duy nhất cho AI Agent và QA Automation.
> - [server.js](file:///d:/_Automation-Project/dashboard/server.js): Backend điều phối Dashboard & Runner.
> - [scripts/check-framework-structure.js](file:///d:/_Automation-Project/scripts/check-framework-structure.js): Bộ kiểm tra tĩnh quy tắc framework.
