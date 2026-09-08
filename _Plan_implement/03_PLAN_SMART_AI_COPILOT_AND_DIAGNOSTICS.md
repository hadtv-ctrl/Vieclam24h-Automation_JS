# 🤖 PLAN-03: SMART AI COPILOT & TEST ERROR DIAGNOSTICS

Kế hoạch triển khai **Trợ Lý AI Sinh Kịch Bản Bằng Tiếng Việt (Prompt-to-Script)** và **Bộ Phân Tích & Giải Thích Lỗi Tự Động (Smart Diagnostics)** cho dự án **Vieclam24h Automation Framework**.

> **Trạng thái cập nhật 2026-09-04:** Chưa có implementation contract hoàn chỉnh cho AI Copilot/Diagnostics. Diagnostics deterministic phải đi trước; AI chỉ là lớp diễn giải và gợi ý có kiểm soát.

---

## 1. Tính Năng 1: AI Prompt-to-Script Generator
* **Ý tưởng:** Non-tech user chỉ cần nhập mô tả luồng kiểm thử bằng tiếng Việt tự nhiên vào ô tìm kiếm/nhập prompt.
* **Quy trình xử lý AI:**
  1. AI Engine phân tích prompt người dùng nhập.
  2. Đối chiếu với cấu trúc cây Page Objects sẵn có trong `pages/` (ví dụ: `HomePage`, `JobSearchPage`, `JobApplyNoCVPage`, `UserProfilePage`).
  3. Tự động sinh ra file Spec Playwright BDD chuẩn chỉnh với đầy đủ `test.step()`, fixture `authenticatedUser`, `onboardingPopup` và data mapping từ `data/`.

### 1.1. Ràng buộc Prompt-to-Script
- AI chỉ được trả về structured state theo schema dùng chung tại `core/generator/wizardSchema.js`; không được trả raw JavaScript làm đầu vào save.
- Server validate lại Page Object, fixture, action, `dataPath`, platform và tags trước khi compile.
- Có provider interface, timeout, retry giới hạn, quota, audit id và fallback khi AI unavailable.
- Prompt, context và response phải được giới hạn kích thước; mask password, OTP, token, webhook và dữ liệu runtime trước khi gửi ra provider.
- Chống prompt injection bằng cách tách system constraints khỏi user prompt và reject output ngoài schema.
- Provider MVP, giới hạn request và chi phí phải được cấu hình ở server; không gửi dữ liệu production nếu chưa có policy phê duyệt.

---

## 2. Tính Năng 2: Smart Error Explainer & Root-Cause Assistant
* **Vấn đề cũ:** Khi test fail, báo cáo chỉ hiển thị stack trace kỹ thuật của Playwright (`Timeout 30000ms exceeded at HomePage.clickNoCVJobLink`). Manual tester không hiểu nguyên nhân tại sao.
* **Giải pháp thông minh:**
  - Khi test fail, hệ thống tự động trích xuất:
    - 📍 **Bước nghiệp vụ bị lỗi:** (ví dụ: *Bước: Người dùng nộp hồ sơ ứng tuyển*).
    - 🔍 **Nguyên nhân chính (Root Cause) bằng tiếng Việt:** (*Nút "Nộp hồ sơ" bị che bởi Popup quảng cáo / Không tìm thấy ô nhập OTP trong 15 giây*).
    - 📸 **Bằng chứng trực quan:** Hiển thị ảnh chụp ngay khoảnh khắc bị fail + khoanh đỏ vị trí element bị lỗi.
    - 💡 **Gợi ý 1-Click Fix:** Nút bấm cho phép tăng timeout bước hoặc cập nhật lại selector mà không cần mở code.

  ### 2.1. Diagnostics không phụ thuộc AI
  - Trích xuất deterministic `test.step`, fixture, Page Object, method, locator, error name, timeout, URL, screenshot, trace và console log trước.
  - Sinh nhóm nguyên nhân có mã ổn định như `locator-not-found`, `covered-by-overlay`, `navigation-timeout`, `assertion-mismatch`, `fixture-error`.
  - AI chỉ diễn giải dữ liệu đã mask và đưa ra confidence/evidence; không được tự kết luận khi thiếu bằng chứng.
  - 1-click fix phải tạo diff/preview, backup và yêu cầu xác nhận; không sửa source trực tiếp.

  ## 3. API Và Acceptance Bổ Sung
  - `POST /api/ai/generate-state`: nhận prompt, trả structured state hoặc lỗi schema; không ghi file.
  - `POST /api/diagnostics/analyze`: nhận run/test artifact đã được phép, trả findings có `code`, `message`, `evidence`, `confidence`, `suggestedFix`.
  - Test provider timeout, malformed output, prompt injection, secret masking, quota, fallback và deterministic diagnostics.
  - PLAN-03 chỉ bắt đầu sau khi PLAN-02 ổn định compiler/schema và runner/report đã có artifact contract.
