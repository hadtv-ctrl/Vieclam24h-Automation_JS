# 🧩 PLAN-07: MODULAR DECOMPOSITION OF CORE & DASHBOARD GOD OBJECTS

> **Mục tiêu**: Tái cấu trúc phân rã các file nguyên khối (God Objects) lớn hơn 1.000 dòng trong thư mục `core/` và `dashboard/` thành các module nhỏ có tính kết dính cao (High Cohesion, Single Responsibility), triệt tiêu nợ kỹ thuật, đáp ứng chuẩn kiểm duyệt Modularity Gate của Master Process mà không gây vỡ tương thích ngược.

---

## 1. Nguyên Tắc Kiến Trúc (Architectural Guidelines)

1. **Chống hội chứng phân rã vụn vặt (Anti Micro-Files Syndrome):**
   - Chỉ phân rã những file thực sự vi phạm nguyên lý đơn nhiệm (God Objects > 1.000 dòng).
   - **Giữ nguyên trạng** các file có tính kết dính cao (Cohesion) ở mức 300–500 dòng như:
     * `core/ai/agentService.js` (490 dòng - AI Agent runtime loop)
     * `dashboard/routes/qaRoutes.js` (388 dòng - Express routing endpoints)
     * `core/system/updater.js` (370 dòng - Linear updater flow)
     * `core/utils/dataManager.js` (316 dòng - Data storage layer)
     * `dashboard/public/js/views/data/dataSlice.js` (312 dòng - View slice)
2. **Kế thừa mẫu Facade (Backward Compatibility First):**
   - File gốc ban đầu được giữ lại làm Facade, re-export toàn bộ API cũ để các service/controller/test đang `require()` không bị ảnh hưởng hay phải sửa import hàng loạt.
3. **Kiểm thử hồi quy nghiêm ngặt (Zero Regression Gate):**
   - Sau mỗi phase bóc tách, chạy lại toàn bộ Unit test và Playwright E2E suite để đảm bảo không sai lệch chức năng.

---

## 2. Danh Mục Các File Cần Tách & Thiết Kế Kiến Trúc Mới

### Phase 1: Tách `core/generator/objectRepository.js` (1.270 dòng $\rightarrow$ 3 Sub-modules)
* **Vấn đề**: File vừa validate locator, vừa quản lý metadata danh mục trang, vừa sinh template fixture, vừa ghi file source.
* **Cấu trúc sau phân tách**:
  ```
  core/generator/objectRepository/
  ├── metadataCatalog.js       (~130 dòng: PAGE_ROOTS, PAGE_METADATA, helper tra cứu danh mục)
  ├── locatorValidator.js      (~150 dòng: LOCATOR_EXPRESSION, validate locator & readiness checks)
  └── fixtureGenerator.js      (~220 dòng: Logic scaffold code fixture, backup & safe file writes)
  core/generator/objectRepository.js  (~80 dòng: Facade kết nối và re-export các hàm)
  ```

---

### Phase 2: Tách `dashboard/services/qaInferenceService.js` (1.245 dòng $\rightarrow$ 3 Sub-modules)
* **Vấn đề**: Đang gom cả Heuristic Engine (offline regex/rule) và LLM Semantic Engine (online AI API call) trong cùng một service.
* **Cấu trúc sau phân tách**:
  ```
  dashboard/services/qa/
  ├── markdownRequirementParser.js  (~140 dòng: Trích xuất AC-xxx, REQ-xxx, Open Questions)
  ├── heuristicInferenceEngine.js   (~190 dòng: Thuật toán Rule-based phân tích biên BVA, missing cases)
  └── semanticAiInferenceEngine.js  (~190 dòng: Giao tiếp AI Gateway, prompt engineering, parse LLM JSON)
  dashboard/services/qaInferenceService.js  (~100 dòng: Orchestrator điều phối chế độ Heuristic vs AI)
  ```

---

### Phase 3: Tách `dashboard/public/js/views/qa/reqAnalyzerHelper.js` (996 dòng $\rightarrow$ 2 Sub-modules)
* **Vấn đề**: Trộn lẫn giữa logic parse AST văn bản đặc tả yêu cầu và code thao tác DOM modal giao diện.
* **Cấu trúc sau phân tách**:
  ```
  dashboard/public/js/views/qa/analyzer/
  ├── markdownSpecParser.js    (~180 dòng: Lexer/Parser trích xuất rule trees, dependencies)
  └── reqAnalyzerRenderer.js   (~220 dòng: DOM builder, badge counters, event listeners)
  dashboard/public/js/views/qa/reqAnalyzerHelper.js (~60 dòng: Facade chuyển tiếp)
  ```

---

### Phase 4: Tách `dashboard/public/js/views/qa/qaSlice.js` (2.557 dòng $\rightarrow$ Modular Tab Slices)
* **Vấn đề**: Một file slice quản lý state cho toàn bộ 5 tab của phân hệ QA Studio.
* **Cấu trúc sau phân tách**:
  ```
  dashboard/public/js/views/qa/slices/
  ├── qaOverviewSlice.js       (~200 dòng: Metrics summary, chart cards, audit stats)
  ├── qaBatchSlice.js          (~220 dòng: Batch testing flow, finding tables, multi-run review)
  ├── qaConflictSlice.js       (~190 dòng: Conflict resolver, duplicate detection view)
  └── qaInferenceSlice.js      (~210 dòng: Giao diện suy luận test case từ requirement)
  dashboard/public/js/views/qa/qaSlice.js  (~150 dòng: Root slice liên kết các tab slices)
  ```

---

### Phase 5: Lộ Trình Strangler Pattern cho `dashboard/public/app.js` (17.625 dòng)
* Đây là file monolith tích lũy từ trước. Không bóc tách ồ ạt trong một lần để tránh rủi ro sập giao diện.
* **Chiến lược Strangler Fig**:
  1. Giữ nguyên lõi điều hướng (App Shell & Navigation).
  2. Mỗi khi nâng cấp một tính năng mới, bóc tách triệt để các template HTML sang `dashboard/public/templates/` và view logic sang `dashboard/public/js/views/`.
  3. Đăng ký ngoại lệ có kiểm soát trong `.size-exemptions.json` với mốc giảm dần số dòng (line-cap countdown).

---

## 3. Kế Hoạch Triển Khai Chi Tiết (Implementation Roadmap)

| Bước | Nhiệm vụ | Đầu ra bàn giao | Tiêu chí nghiệm thu (AC) |
|---|---|---|---|
| **B1** | Phân tách `core/generator/objectRepository.js` | 3 module con trong `core/generator/objectRepository/` | Unit test generator pass 100%, code < 250 dòng |
| **B2** | Phân tách `dashboard/services/qaInferenceService.js` | 3 module con trong `dashboard/services/qa/` | Test inference heuristic & AI pass, code < 200 dòng |
| **B3** | Phân tách `reqAnalyzerHelper.js` | 2 module trong `dashboard/public/js/views/qa/analyzer/` | Màn hình QA Requirement Analyzer hoạt động trơn tru |
| **B4** | Module hóa `qaSlice.js` theo tabs | 4 tab-slices trong `dashboard/public/js/views/qa/slices/` | Không phát sinh lỗi console, state chuyển tab mượt |
| **B5** | Chạy toàn diện Audit & E2E Regression | Báo cáo kiểm định Playwright | `master.py audit` PASS, 0 violation cho các file mới |

---

## 4. Kế Hoạch Ứng Phó Rủi Ro & Rollback (Contingency & Rollback)
- **Tạo Snapshot Git Tag** trước mỗi phase: `git tag backup/pre-refactor-phase-X`.
- **Nguyên tắc Facade**: Giữ nguyên tên hàm, số lượng tham số, kiểu dữ liệu trả về của tất cả exported functions.
- **Rollback tức thì**: Nếu bất kỳ kịch bản E2E Playwright nào bị gãy sau khi tách, hoàn nguyên ngay lập tức file Facade về bản backup mà không làm gián đoạn nhánh chính.
