# 🏛️ PLAN-04: CENTRALIZED OBJECT REPOSITORY & CI/CD DISCORD QA BOT

Kế hoạch triển khai **Quản Lý Danh Mục Phần Tử Tập Trung (Object Repository)** và **Mở Rộng Tự Động Hóa CI/CD & Discord QA Bot** cho dự án **Vieclam24h Automation Framework**.

> **Trạng thái cập nhật 2026-09-04:** Dashboard đã có catalog/editor Page Object, selector update có backup, create-page API và Discord webhook/config. Plan này cần tách rõ phần đã có với phần runtime repository và CI automation còn thiếu.

## 0. Phạm Vi Đã Chốt
- **PLAN-04A - Object Repository:** catalog, parse metadata, locator/method inspection, selector update, scaffold và fixture readiness.
- **PLAN-04B - Discord/GitHub Automation:** remote run, GitHub Actions dispatch, notification và report/artifact delivery.
- Dashboard hiện mới quản lý/điều chỉnh source Page Object; chưa phải runtime locator abstraction tập trung. Không mô tả là “tất cả spec tự động đồng bộ” nếu chưa có runtime contract.

---

## 1. Tính Năng 1: Centralized Object Repository (Quản Lý Locator Tập Trung)
* **Mục tiêu MVP:** Quản lý, kiểm tra và cập nhật locator tập trung từ Dashboard nhưng vẫn lưu vào source Page Object hiện tại. Runtime locator abstraction là phạm vi Phase 2, không mặc định coi đã hoàn thành trong MVP.
* **Giao diện Quản Lý Phần Tử:**
  - Hiển thị danh mục các phần tử theo từng trang (`HomePage`, `JobDetailPage`, `UserProfilePage`).
  - Cho phép người dùng chỉnh sửa selector (Text, Role, Placeholder, CSS, TestID) trực tiếp trên giao diện Dashboard.
  - Khi một selector được cập nhật, Dashboard cập nhật Page Object nguồn có liên quan, tạo backup và hiển thị phạm vi ảnh hưởng. Chỉ tuyên bố tự động đồng bộ mọi spec sau khi runtime abstraction có test chứng minh.

### 1.1. Gap và contract Object Repository
- Dùng các API hiện có `/api/object-repository/pages`, `/api/object-repository/page`, `/api/object-repository/update-locator` và `/api/object-repository/create-page`.
- Selector update phải tạo backup, validate expression và báo rõ các file bị ảnh hưởng; MVP chỉ sửa source Page Object, không sửa trực tiếp spec.
- Bổ sung `fixtureName`, `platform`, `className`, `methods`, `locators` và `readiness` vào metadata để PLAN-02/PLAN-05 không chọn Page Object chưa dùng được.
- Page Object mới chỉ được dùng sau khi import/fixture readiness pass. Tự động đăng ký vào `baseTest.js`/`mobileWebTest.js` là Phase 2, có backup, syntax check và rollback.
- Backend là authority cuối cùng cho `readiness`; UI chỉ hiển thị trạng thái. Nếu fixture, class export hoặc import không pass thì compiler phải từ chối, dù UI đã tick chọn.
- Mọi path phải whitelist trong `pages/`; tên class, locator và method phải qua validation.

---

## 2. Tính Năng 2: Tự Động Hóa CI/CD & Mở Rộng Discord QA Bot
* **Điều khiển từ xa qua Discord Chat:**
  - Gõ lệnh trực tiếp trong nhóm chat Discord:
    - `@Vieclam24h QA Bot run smoke qc` $\rightarrow$ Chạy suite Smoke Test trên môi trường QC.
    - `@Vieclam24h QA Bot run @applyjob prod` $\rightarrow$ Chạy toàn bộ kịch bản Ứng tuyển trên Prod.
  - Bot tự động kích hoạt GitHub Actions workflow và phản hồi link live run.
* **Báo Cáo Tự Động & Cảnh Báo:**
  - Ngay khi test hoàn thành, Bot tự động gửi báo cáo tóm tắt (Tổng số test, Tỉ lệ Pass/Fail, Thời gian chạy, Link xem HTML Report, Ảnh chụp failure nếu có) về kênh chat Discord.

### 2.1. Gap và contract Discord/GitHub
- Route `POST /api/discord/test` chỉ được tồn tại một lần; chuẩn hóa response/error và không expose webhook secret.
- Remote command phải whitelist environment, project, tag, spec và worker; chặn chạy Prod nếu chưa có policy/confirmation.
- GitHub Actions dispatch cần xác định repository/ref/workflow, quyền token, timeout, retry, correlation id và link run.
- Notification phải dùng runner/report contract chung: status, pass/fail/skip, duration, report URL và artifact URL; không gửi raw secret hoặc toàn bộ console log.
- Chống chạy trùng, có stop/cancel và audit log cho mọi remote run.

### 2.2. Runner/report contract
- Chuẩn hóa payload dùng chung cho Dashboard, Diagnostics và Discord: `runId`, `status`, `environment`, `project`, `spec/tag`, `startedAt`, `duration`, `passed`, `failed`, `skipped`, `reportUrl`, `artifactUrls` và `errorSummary`.
- Runner hiện có là nguồn thực thi duy nhất; Discord/GitHub không tự spawn một cơ chế chạy khác.
- Remote run phải có lifecycle `queued -> running -> completed/failed/cancelled`, idempotency key và quyền theo environment.

## 3. Thứ Tự Phụ Thuộc Và Acceptance
1. PLAN-01 hoàn thiện data/action contract.
2. PLAN-04A hoàn thiện Page Object metadata và fixture readiness.
3. PLAN-02 dùng các contract trên để compile/save.
4. PLAN-04B dùng runner/report contract ổn định để dispatch và notify.
5. PLAN-05 chỉ cho chọn Page Object đã pass readiness.

- Test route duplicate, webhook masking, invalid environment/tag/spec, concurrent run và cancellation.
- Test selector backup/rollback/path traversal và fixture readiness desktop/mobile.
- Không gọi Object Repository là runtime centralized locator system cho tới khi tests chứng minh spec chạy qua abstraction đó.
