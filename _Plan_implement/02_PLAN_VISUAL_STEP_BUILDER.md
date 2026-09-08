# 🧩 PLAN-02: VISUAL STEP BUILDER (NO-CODE FLOW DESIGNER)

Kế hoạch thiết kế và triển khai **Trình Soạn Thảo Kịch Bản Dạng Khối Trực Quan (Visual Step Builder)** cho dự án **Vieclam24h Automation Framework**.

> **Trạng thái cập nhật 2026-09-04:** Visual Builder đã có compiler, API và UI cơ bản. Plan này chuyển từ “tạo mới” sang “chuẩn hóa compiler và contract nền tảng” cho PLAN-03 và PLAN-05.

---

## 1. Mục Tiêu & Trải Nghiệm Người Dùng (UX Goal)
* Cho phép Manual Tester / BA tạo mới hoặc chỉnh sửa kịch bản kiểm thử trực tiếp trên Web Dashboard mà không cần mở file code `.js` hay cài đặt môi trường lập trình.
* Người dùng chỉ cần:
  1. Đặt tên Feature & Scenario.
  2. Thêm các bước (Given / When / Then / And).
  3. Chọn hành động từ **Thư viện Action tiếng Việt** (Mở trang, Bấm nút, Nhập liệu, Chọn dropdown, Điền form mini, Ứng tuyển không CV, Kiểm tra kết quả).
  4. Bấm **"Biên Dịch & Lưu Kịch Bản"** -> Hệ thống tự động sinh file `.spec.js` chuẩn BDD `test.step()` tuân thủ 100% `ai/shared/AI_PROMPTS.md`.

---

## 2. Thiết Kế Giao Diện Tab Mới: `🧩 Soạn Thảo Kịch Bản (Visual Builder)`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🧩 Trình Soạn Thảo Kịch Bản BDD • Vieclam24h                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tên Kịch Bản: [Ứng tuyển nhanh việc làm không cần CV                     ]  Platform: [Desktop ▼]│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔹 Given (Bối cảnh ban đầu):                                                                     │
│   [Action: Đăng nhập tài khoản test ▼] -> [Tài khoản: users[0] ▼]                                │
│   [Action: Đóng popup Onboarding nếu có ▼]                                                       │
│                                                                                                  │
│ 🔸 When (Thao tác người dùng):                                                                   │
│   [Action: Bấm nút/link ▼] -> [Phần tử: homePage.clickNoCVJobLink ▼]                             │
│   [Action: Chọn việc làm đầu tiên trong danh sách ▼]                                             │
│   [Action: Điền thông tin Profile Mini ▼] -> [Bộ dữ liệu: applyData.noCVApply.job1 ▼]            │
│   [Action: Bấm nộp hồ sơ ứng tuyển ▼]                                                            │
│                                                                                                  │
│ 🔹 Then (Kiểm tra kết quả):                                                                      │
│   [Assert: Kiểm tra danh sách đã ứng tuyển hiển thị ▼]                                           │
│   [Assert: Kiểm tra công việc vừa nộp xuất hiện trong danh sách ▼]                               │
│                                                                                                  │
│ [+ Thêm bước mới]                                                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [▶️ Chạy Thử Kịch Bản Này Ngay]          [💾 Lưu Kịch Bản Vào Framework (tests/e2e/desktop/...)] │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kiến Trúc Bộ Biên Dịch (Block-to-Spec Compiler)

* **Module:** `core/generator/visualBuilderCompiler.js`
* **Nhiệm vụ:**
  - Map từng Block Action thành lời gọi method tương ứng trong Page Object (`homePage.clickNoCVJobLink()`, `jobApplyNoCVPage.fillMiniProfile(...)`).
  - Tự động bao bọc trong `await test.step('Given/When/Then...', async () => { ... })`.
  - Tự động chèn các câu lệnh capture evidence theo chuẩn (`await pageObj.capture(...)`).
  - Tự động sinh file `tests/e2e/<platform>/<feature_name>-bdd.spec.js`.

---

## 4. Trạng Thái Hiện Tại Và Gap Cần Triển Khai
1. **Đã có:** `core/generator/visualBuilderCompiler.js` và unit test cơ bản.
2. **Đã có:** `/api/builder/compile`, `/api/builder/save`, `/api/builder/scripts` và UI BDD Studio.
3. **Cần sửa:** compiler phải nhận schema/version chung với PLAN-05, validate platform, fixture, method/locator, `dataPath` và action unknown.
4. **Cần sửa:** dùng `actionRegistry.js` làm nguồn action/assertion duy nhất; loại bỏ preset/metadata trùng hoặc tạo adapter rõ ràng.
5. **Cần sửa:** compiler phải serialize an toàn feature, scenario, tags, title, locator và custom values; output deterministic.
6. **Cần bổ sung:** backend validate syntax, safe path, backup, atomic save và `expectedHash`; không tin `specCode` do frontend gửi.
7. **Cần sửa:** starter steps phải dùng đúng action IDs hiện có (`navigate_url`, `assert_visible`) hoặc cập nhật registry, không sinh comment im lặng khi ID không tồn tại.

### 4.1. Compiler contract
- Input là structured state có `schemaVersion`, `platform`, `precondition`, `dataSources`, `pageObjects` và `steps`, được định nghĩa một lần tại `core/generator/wizardSchema.js` hoặc module contract tương đương.
- Output gồm `valid`, `specCode`, `specRelativePath`, `requiredFixtures`, `warnings[]`, `errors[]`, `compiledHash`.
- `custom_code` chỉ được cho phép khi người dùng bật explicit override và được đánh dấu trong output; không coi là action chuẩn.
- `node --check` chỉ kiểm tra syntax, không thay thế validation fixture/import/method/data path.

### 4.2. Dependency
PLAN-01 phải hoàn thiện data/action registry trước; PLAN-04A phải cung cấp fixture/page metadata; sau đó PLAN-02 mới là nền tảng cho PLAN-05.

### 4.3. Migration và backward compatibility
- Spec hiện có được phân loại thành `compiler-managed`, `custom/manual` hoặc `parse-error` bằng metadata và kết quả parser.
- Chỉ `compiler-managed` được round-trip qua visual steps; `custom/manual` giữ nguyên code và chỉ cho sửa bằng shared code editor; `parse-error` phải báo lỗi, không tự động ghi đè.
- Có migration version từ state/spec cũ sang schema mới, kèm backup và test không làm mất hook, helper, custom code hoặc nhiều scenario.
