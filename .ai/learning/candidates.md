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

### [LEARN-004] Đồng Bộ Hóa Bất Đồng Bộ Giữa Tải Modular HTML Template Và View Controller Trong Dashboard
- **Nguồn trích xuất:** BUG-DASHBOARD-EMPTY-VIEWS-ON-MODULAR-TEMPLATES
- **Role quan sát:** Senior Automation QA Engineer & Fullstack Dashboard Maintainer
- **Quan sát (Observation):**
  1. Khi tách mã nguồn HTML của monolithic dashboard (4,112 dòng) thành các file template con trong `templates/*.html`, việc tải template diễn ra bất đồng bộ qua `fetch()`.
  2. Các hàm controller trong `app.js` (`openPageManager`, `initVisualBuilder`, `openSuitesManager`, `openDataManager`) chạy đồng bộ ngay khi người dùng click vào tab chuyển view. Tại thời điểm controller chạy, template chưa kịp chèn vào DOM, các truy vấn `document.getElementById` trả về `null` dẫn đến việc các danh sách (kịch bản BDD, Page Objects, Test Suites, Data) hoàn toàn trắng trơn hoặc bị kẹt vô tận ở spinner `Đang đọc các kịch bản...`.
  3. Cờ khởi tạo (`suitesViewInitialized`, `isVisualBuilderInitialized`) bị gán `true` khi phần tử chưa tồn tại trong DOM, khóa vĩnh viễn việc lắng nghe sự kiện của các nút filter, search và refresh.
- **Bằng chứng (Evidence):** `dashboard/public/app.js`, `dashboard/public/templates/*.html`, `dashboard/public/js/core/templateLoader.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Technical Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Xây dựng cầu nối `ensureViewTemplate(viewId)` và `preloadAllViewTemplates()` ngay tại bootstrap của script client chính để tải trước toàn bộ template.
  2. Luôn đặt `await ensureViewTemplate(viewId)` tại cả sự kiện click tab chuyển view và dòng đầu tiên của từng view controller.
  3. Chỉ cho phép các cờ khởi tạo (`isInitialized = true`) được bật khi phần tử DOM cốt lõi (`search-input`, `list-container`) thực sự tồn tại trong DOM.

### [LEARN-005] Chuẩn Hóa Destructuring Fixtures Playwright & Xử Lý Dynamic Marketing Popups Trên QC
- **Nguồn trích xuất:** TASK-DESKTOP-SUITE-VERIFICATION
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Playwright runner kiểm tra tính hợp lệ của fixture parameters theo danh sách đăng ký trong `test.extend()`. Các spec desktop cũ truyền trực tiếp `homePage`, `userProfilePage`, `onboardingPopup`, `jobSearchPage`, `createJobApplyPage` vào hàm test callback khiến Playwright báo lỗi `unknown parameter` trước khi chạy.
  2. Page Proxy Container (`pagesFactory`) tự động ánh xạ thuộc tính theo quy ước `<Name>Page.js`. Do đó các file không có suffix `Page` như `OnboardingPopup.js`, `LoginPopup.js`, `PopupConsent.js` không tự resolve được qua proxy mà phải import trực tiếp.
  3. Môi trường QC kích hoạt popup marketing ngẫu nhiên cho luồng khách vãng lai (Guest) như `.mbep-popup` và popup "Khoan đã, Hình như bạn chưa đăng nhập?" (`.ReactModalPortal`), che khuất và chặn tương tác (pointer interception) đối với các nút hành động cốt lõi.
- **Bằng chứng (Evidence):** `tests/e2e/desktop/*.spec.js`, `pages/desktop/HomePage.js`, `pages/desktop/JobApplyNoCVPage.js`, `core/fixtures/baseTest.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Toàn bộ kịch bản test BDD bắt buộc sử dụng chữ ký fixture chuẩn: `{ page, authenticatedUser, pages }` đối với user đã đăng nhập, hoặc `{ page, pages }` đối với guest test.
  2. Các Page Object có đuôi `Page.js` được gọi qua `pages.<name>Page`, các popup tiện ích độc lập (`OnboardingPopup`, `LoginPopup`, `PopupConsent`) phải import trực tiếp `require(...)` và khởi tạo với `new <PopupClass>(page)`.
  3. Xử lý popup chặn màn hình bằng cơ chế nhiều tầng: thử đóng qua nút close icon, gửi phím Escape, và kiểm tra bọc trong khối `try/catch` an toàn để không làm gãy luồng kiểm thử chính.

### [LEARN-006] Tương Tác Trực Tuyến Với AI Chatbot Popup, Phân Biệt Chat History Với Filter Modals & Tiêu Chuẩn Bằng Chứng Input/Output
- **Nguồn trích xuất:** FEATURE-AI-CHATBOT-JOB-SEARCH-BDD
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Trong giao diện AI Chatbot, các câu hỏi trắc nghiệm đã trả lời (tỉnh thành, mức lương, kinh nghiệm) vẫn lưu trong lịch sử chat nhưng ở trạng thái `<button disabled>`. Khi mở modal bộ lọc (ví dụ: Mức lương 15 triệu, Kinh nghiệm 2 năm), nếu dùng selector toàn trang (`getByRole('button', ...)` hoặc `getByText(...)`), Playwright sẽ match nhầm vào button disabled trong lịch sử chat và bị timeout click.
  2. Nút cuộn thanh lọc (`getByLabel('Scroll right')`) khi đã cuộn tới cuối thanh filter bar sẽ chuyển sang trạng thái `disabled` (`cursor-not-allowed`) nhưng vẫn `isVisible() = true`. Nếu kiểm tra bằng `isVisible()` rồi click sẽ khiến kịch bản bị treo vô tận chờ `element to be enabled` đến khi chạm test timeout 240s.
  3. Sử dụng `.or()` giữa trigger container (`div[data-test-id="...-trigger"]`) và thẻ text con (`span:has-text(...)`) gây vi phạm Playwright Strict Mode Violation vì cả hai phần tử cha và con đều match đồng thời.
  4. Để đáp ứng yêu cầu QA kiểm tra đầy đủ tính đúng đắn của dữ liệu Input và Output mà không trùng hình, cần phân rã rõ ràng: chụp lúc nhập liệu vào textbox/tick chọn modal (Input), và chụp sau khi bot phản hồi/áp dụng chip/cập nhật danh sách việc làm (Output).
- **Bằng chứng (Evidence):** `pages/desktop/ChopChatbotPage.js`, `tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js`, `evidence/26-09-18/desktop/chop_chatbot_job_search-bdd/`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Khi click các option mức lương, kinh nghiệm trong modal, luôn lọc phần tử khả dụng qua `button:not([disabled])` hoặc class màu active (`.text-secondary-100, span`) để không match nhầm vào pill disabled trong chat log.
  2. Với các nút điều hướng cuộn (Scroll left/right), luôn kiểm tra `isEnabled()` thay vì `isVisible()` trước khi thực hiện click.
  3. Tránh ghép `.or()` giữa container trigger và span con bên trong; chỉ cần định danh container trigger bằng `[data-test-id="..."]`.
  4. Chuẩn hóa bộ ảnh chụp bằng chứng (Evidence) gồm 25 bước rõ ràng đánh số thứ tự tự động qua `ScreenshotHelper`, minh chứng trực quan cho từng hành vi người dùng và phản hồi của hệ thống.
