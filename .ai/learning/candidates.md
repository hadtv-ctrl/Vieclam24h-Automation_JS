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

### [LEARN-006] Spec Mobile Web Tái Phạm Lỗi Destructuring Fixtures Đã Được Chuẩn Hóa Ở LEARN-005
- **Nguồn trích xuất:** TASK-QA-DOCS-REVERSE-ENGINEERING (dựng tài liệu REQ/TC ngược từ 23 spec)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. LEARN-005 đã chốt chữ ký fixture chuẩn `{ page, authenticatedUser, pages }` sau khi sửa toàn bộ spec desktop. Nhưng 11 spec trong `tests/e2e/mobile-web/` vẫn destructuring trực tiếp `homePage`, `onboardingPopup`, `jobSearchPage`, `userProfilePage`, `loginPopup`, `popupConsent`, `createJobApplyPage`, `createJobApplyNoCVPage` — đúng lỗi mà LEARN-005 đã mô tả.
  2. `core/fixtures/mobileWebTest.js` chỉ đăng ký `pages`, `authenticatedUser` và vài fixture cấu hình; không khai báo từng page object thành fixture riêng.
  3. Hệ quả nặng hơn mức "một vài test đỏ": `npx playwright test --list` không chỉ định project trả về `Total: 0 tests in 0 files`. Một lỗi nạp file làm hỏng toàn bộ lượt liệt kê, nên cả 11 test desktop và 2 test API cũng không chạy nếu không chỉ định project.
  4. Bài học đã được ghi ở LEARN-005 nhưng chỉ áp dụng cho thư mục desktop, không có rào chắn tự động nào chặn thư mục mobile tái phạm. `npm run check:framework` hiện không kiểm chữ ký fixture.
- **Bằng chứng (Evidence):** `tests/e2e/mobile-web/*.mobile.spec.js`, `core/fixtures/mobileWebTest.js`, output của `npx playwright test --list`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Một bài học chỉ sửa ở nơi phát hiện thì sẽ tái phát ở nơi khác. Khi sửa chữ ký fixture cho một nền tảng, phải quét cả các nền tảng còn lại trong cùng lượt.
  2. Bổ sung rào chắn vào `scripts/check-framework-structure.js`: chặn mọi tham số fixture không nằm trong danh sách đăng ký của `baseTest` và `mobileWebTest`. Rào chắn tự động rẻ hơn nhiều so với một bài học viết ra rồi quên.
  3. Trước khi tin vào bất kỳ con số độ phủ nào, chạy `npx playwright test --list` và đối chiếu tổng số test với số spec. Đếm file spec không chứng minh được test chạy được.

### [LEARN-007] Assertion Giấu Trong Page Object Làm Tài Liệu Truy Vết Mất Khả Năng Audit
- **Nguồn trích xuất:** TASK-QA-DOCS-REVERSE-ENGINEERING
- **Role quan sát:** Senior Automation QA Engineer / Business Analyst
- **Quan sát (Observation):**
  1. Khi dựng ngược requirement từ 23 spec, 12 test không có lời gọi assertion nào ở tầng spec; phần kiểm chứng nằm trong các method của Page Object như `expectAppliedJobsVisible()`, `verifyAndApplyCVData()`.
  2. Công cụ `scripts/qa-trace.js` báo đúng 12 finding "khai phủ AC nhưng không có assertion". Công cụ không sai — nó chỉ không nhìn được vào Page Object. Nhưng hệ quả là **người đọc tài liệu không xác định được test case đó chứng minh điều gì** nếu không mở thêm hai ba file nữa.
  3. Nguy hiểm hơn: 6 test thực sự không có kiểm chứng kết quả ở bất kỳ tầng nào (`setting_user_profile`, `complete_profile_setup`, `profile_ai_writing` và bản mobile tương ứng). Chúng chạy hàng chục phút mỗi lượt nhưng chỉ phát hiện được lỗi làm sập luồng, không phát hiện được lỗi nghiệp vụ.
- **Bằng chứng (Evidence):** `tests/e2e/**/*.spec.js`, `test-cases/traceability.md` mục "Chất lượng bằng chứng của từng test case"
- **Đề xuất phân loại:** CANDIDATE
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Mỗi test phải có ít nhất một assertion **ở tầng spec** chứng minh kết quả nghiệp vụ, đặt ở bước Then. Page Object lo thao tác và locator; spec lo tuyên bố kết quả mong đợi.
  2. Assertion ở bước Given chỉ chứng minh tiền điều kiện, không tính là bằng chứng kết quả. Khi đánh giá độ phủ phải tách hai loại này.
  3. Bước "nếu thành phần không hiển thị thì bỏ qua và đi tiếp" biến một kiểm chứng thành một lời chúc. Nhánh tùy chọn chỉ được phép ở dọn dẹp môi trường, không được phép ở bước Then.
