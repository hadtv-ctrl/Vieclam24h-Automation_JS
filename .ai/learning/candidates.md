# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.

<!-- Mẫu ứng viên học hỏi:
### [LEARN-001] Tiêu đề quan sát / bài học
- **Nguồn trích xuất:** [FEATURE-X / BUG-Y / CODE-REVIEW]
- **Role quan sát:** [Developer / QA / Tech Lead / BA]
- **Quan sát (Observation):** Mô tả cụ thể hiện tượng hoặc vấn đề
- **Bằng chứng (Evidence):** Link file hoặc mã lỗi thực tế
- **Đề xuất phân loại:** [CURRENT PRACTICE / APPROVED STANDARD / KNOWN PITFALL]
- **Phạm vi đề xuất:** [FEATURE-LOCAL / MODULE / PROJECT]
- **Đề xuất Owner duyệt:** [Technical Lead / Principal QA / BA]
- **Trạng thái:** [PENDING / APPROVED / REJECTED]
### [LEARN-001] Cơ chế Whitelist Asset & Rào Chắn Bảo Mật Khi Đồng Bộ Git Trong QA Automation
- **Nguồn trích xuất:** FEATURE-GIT-SYNC-STUDIO
- **Role quan sát:** Senior QA / Technical Lead
- **Quan sát (Observation):** Khi cung cấp tính năng Commit/Push trực tiếp cho tester trên UI Dashboard, nguy cơ vô tình commit file `.env`, media nặng (`playwright-report`, `test-results`, `evidence`), hoặc code dở dang vi phạm framework (`waitForTimeout`) là rất cao nếu chỉ dùng `git add .`.
- **Bằng chứng (Evidence):** `core/system/gitSyncService.js`, `scripts/git-sync.js`, `dashboard/public/app.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Technical Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn dùng Whitelist cụ thể cho các tệp test (`tests/**`, `pages/**`, `data/**`, `suites`, `docs/**`) và Blacklist bảo mật cho secrets/artifacts.
  2. Bắt buộc kích hoạt Framework Quality Gate (`npm run check:framework`) trước khi cho phép commit/push.
  3. Khi thực hiện Git Pull từ UI, cung cấp cơ chế auto-stash an toàn để tránh làm mất code dở dang của tester khi có xung đột.

### [LEARN-002] Chuẩn Hóa Tags Test Suite Đối Xứng Và Bảo Vệ Fixtures Khi Đồng Bộ Framework
- **Nguồn trích xuất:** TASK-TEST-SUITE-STANDARDIZATION
- **Role quan sát:** Automation QA Lead / Senior QA
- **Quan sát (Observation):**
  1. Khi đồng bộ framework tự động từ hub (satellite sync), các tệp fixture Page Objects (`baseTest.js`, `mobileWebTest.js`) dễ bị ghi đè về template trắng nếu không đưa vào danh sách ngoại lệ hoặc không kiểm tra lại. Hậu quả là Playwright báo lỗi `Test has unknown parameter "<PageObject>"`.
  2. Việc thiếu tính đối xứng trong hệ thống tag (ví dụ: mobile có `@mobile` nhưng desktop không có `@desktop`) khiến việc filter theo nền tảng qua CLI hoặc Dashboard gặp khó khăn và dễ chạy sót kịch bản.
- **Bằng chứng (Evidence):** `tests/e2e/desktop/*.spec.js`, `core/fixtures/mobileWebTest.js`, `scripts/run-suite.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn bảo vệ và kiểm tra lại `core/fixtures/*.js` sau mỗi lần đồng bộ mã nguồn core từ hub.
  2. Bắt buộc gắn tag nền tảng đối xứng (`@desktop` và `@mobile`) và tag nghiệp vụ chuẩn (`@smoke`, `@e2e`, `@applyjob`, `@profile`, `@register`, `@onboarding`) ngay tại dòng `test.describe`.
  3. Xây dựng runner script linh hoạt hỗ trợ cả Project mapping lẫn CLI Grep tag và cho phép chuyển tiếp các flag chuẩn như `--list`, `--headed`.

### [LEARN-003] Xử Lý Popover / Dropdown Multi-Select & Điều Hướng Mobile Web Không Gây Treo Kịch Bản
- **Nguồn trích xuất:** TASK-VERIFY-FIX-ALL-TEST-SCRIPTS
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Trên Mobile Web (Chromium Mobile Emulation / Next.js SPA), khi click vào thẻ `<a>` có `target="_blank"`, trình duyệt thường điều hướng ngay trong tab hiện tại thay vì bắn sự kiện `popup`. Việc dùng cứng `page.waitForEvent('popup')` làm kịch bản bị timeout 600s.
  2. Các dropdown multi-select (chọn nhiều quận huyện) không tự động đóng khi click checkbox và không phản hồi với `keyboard.press('Escape')` trên môi trường mobile. Menu trôi nổi sẽ che khuất và chặn tương tác (pointer interception) đối với các trường bên dưới (năm sinh, học vấn).
  3. Precondition `authenticatedUser` tự động tắt popup Onboarding cho các test khác, nhưng lại vô tình làm mất tiền điều kiện của chính kịch bản kiểm thử Onboarding nếu không có cờ `skipCloseOnboarding`.
- **Bằng chứng (Evidence):** `pages/mobile-web/MobileJobSearchPage.js`, `pages/desktop/JobApplyNoCVPage.js`, `core/utils/authSetup.js`, `tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js`, `tests/e2e/desktop/onboarding-bdd.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Khi click mở job detail trên Mobile Web, luôn bọc `waitForEvent('popup', { timeout: 3000 })` với cơ chế fallback kiểm tra URL trang hiện tại để tương thích cả 2 trường hợp mở popup hoặc in-tab navigation.
  2. Sau khi chọn xong multi-select dropdown, luôn kích hoạt cơ chế `closeActiveDropdownIfAny()` thực hiện click ra ngoài (`force: true` vào nhãn form) để kích hoạt sự kiện `onClickOutside` đóng popover an toàn.
  3. Precondition đăng nhập phải kiểm tra ngữ cảnh test (`featureName.includes('onboarding')`) để giữ nguyên popup Onboarding khi đang kiểm thử luồng Onboarding.


