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

### [LEARN-008] Tương Tác Trực Tuyến Với AI Chatbot Popup, Phân Biệt Chat History Với Filter Modals & Tiêu Chuẩn Bằng Chứng Input/Output
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

### [LEARN-009] Dập Tắt Popup Banner Chiến Dịch Đa Tầng, Tránh Strict Mode Khi Kiểm Tra Trang Tải Xong & Tiêu Chuẩn Capture Từng Thao Tác
- **Nguồn trích xuất:** TASK-JOB-SEARCH-FILTER-DETAIL-REGRESSION-BDD
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Popup banner chiến dịch trên trang chủ ("Việc vững vàng, đón xuân SANG" qua ReactModalPortal) xuất hiện trễ và chặn tương tác (pointer intercept). Nếu chỉ bấm Escape mà không click nút `.svicon-close` và dọn lớp che thì body vẫn bị dính `ReactModal__Body--open`. Cần kết hợp cả `page.addLocatorHandler` (phản ứng tự động) lẫn `closeAllPopupsIfVisible()` (chủ động trước từng bước tương tác).
  2. Khi kiểm tra trang chi tiết tải xong, việc dùng `await expect(btnApplyNow.or(jobTitleHeading)).toBeVisible()` gây lỗi Playwright Strict Mode Violation vì cả hai phần tử đều đang hiển thị đồng thời (match 2 elements thay vì 1). Phải tách riêng từng assertion rõ ràng.
  3. Để đáp ứng yêu cầu audit QA mỗi thao tác một ảnh, nên tách việc chụp ảnh (`capture`) ra khỏi hàm tiện ích Page Object nội bộ và đưa trực tiếp vào tầng kịch bản test (`.spec.js`) với tên bước đánh số thứ tự tuần tự để tránh chụp trùng lặp và lãng phí thời gian chờ mạng.
- **Bằng chứng (Evidence):** `pages/BasePage.js`, `pages/desktop/JobDetailPage.js`, `pages/desktop/JobSearchPage.js`, `tests/e2e/desktop/job_search_filter_detail-bdd.spec.js`, `evidence/26-10-02/desktop/job_search_filter_detail-bdd/`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Xử lý popup chặn tương tác bằng cơ chế song hành: `addLocatorHandler` cho các sự kiện bất đồng bộ và kiểm tra chủ động trước các tương tác mở rộng bộ lọc.
  2. Tuyệt đối không dùng `.or()` giữa hai phần tử dự kiến đều hiển thị trong các câu lệnh `expect(...).toBeVisible()`.
  3. Kịch bản audit trực quan yêu cầu mỗi thao tác có 1 ảnh: gọi `capture()` tường minh ở từng bước test, loại bỏ các capture nội bộ trùng lặp trong Page Object.

### [LEARN-010] Cấp Phát Định Danh Test Case Toàn Cục & Chuẩn Hóa Ưu Tiên Cho Candidate Test Case
- **Nguồn trích xuất:** BUGFIX-MA-TC-TRUNG-CANDIDATES
- **Role quan sát:** Senior Automation QA Engineer & Platform Engineer
- **Quan sát (Observation):**
  1. Khi sinh test case tự động (qua Heuristics / AI / Rà soát Open Questions), nếu chỉ quét ID trong phạm vi từng file `REQ-xxx.md`, các mã `TC-xxx` sẽ bị cấp phát trùng lặp giữa các requirement khác nhau, kích hoạt lỗi nghiêm trọng `ma-tc-trung`.
  2. Các test case mới được suy luận khi còn ở trạng thái `Candidate` nếu được gán ưu tiên `P0` hoặc `P1` sẽ kích hoạt cảnh báo chất lượng `p0-p1-con-dang-candidate` (do quy chuẩn QA yêu cầu P0/P1 phải được automation ngay).
- **Bằng chứng (Evidence):** `dashboard/services/qaInferenceService.js`, `test-cases/*.md`, `tools/qa/lib/commands.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn quét toàn bộ thư mục `test-cases/*.md` để lấy `max(existingTcIds)` toàn cục trước khi cấp phát mã `TC-xxx` mới.
  2. Bổ sung cơ chế deduplication trước khi ghi đĩa để tránh nhân đôi dòng khi người dùng bấm thêm nhiều lần.
  3. Mọi test case ở dạng `Candidate` chưa có script automation cần được mặc định ưu tiên `P2` để phân tách rõ ràng với các kịch bản cốt lõi đã có mã kiểm thử tự động.

### [LEARN-011] Chuẩn Hóa Định Danh Spec Traceability và Kiểm Tra Assertion Trực Tiếp Trong Thân Test
- **Nguồn trích xuất:** BUGFIX-SPEC-TRACE-AND-ASSERTION
- **Role quan sát:** Senior Automation QA Engineer & Platform Engineer
- **Quan sát (Observation):**
  1. Nếu tiêu đề test không tuân thủ định dạng chuẩn `TC-xxx - AC-yyy: <Mô tả>` hoặc block describe thiếu tag `@REQ-xxx`, bộ quét tĩnh QA sẽ không thể liên kết script với ma trận truy vết và kích hoạt lỗi `test-khong-co-ma-tc` / `test-thieu-tag-req`.
  2. Khi toàn bộ assertion chỉ nằm ẩn bên trong các phương thức của Page Object Model (POM), bộ quét tĩnh kiểm toán mã nguồn sẽ đo được `assertionCount = 0` và kích hoạt cảnh báo `spec-thieu-assertion` (nguy cơ test rỗng / thiếu kiểm chứng nghiệp vụ).
- **Bằng chứng (Evidence):** `tests/e2e/desktop/job_search_by_cities-bdd.spec.js`, `tests/e2e/desktop/job_search_filter_detail-bdd.spec.js`, `test-cases/traceability.md`, `tools/qa/lib/sources.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Mọi kịch bản E2E spec bắt buộc đặt tiêu đề theo cấu trúc `TC-xxx - AC-yyy: <Mô tả>` và describe phải chứa tag `@REQ-xxx` khớp với requirement.
  2. Đồng bộ mã `TC-xxx` vào cả file `test-cases/REQ-xxx.md` (bảng truy vết + chi tiết) và `test-cases/traceability.md`.
  3. Luôn đặt ít nhất 1-2 lệnh `await expect(...)` trực tiếp trong các bước kiểm chứng nghiệp vụ (`Given`/`When`/`Then`) của file spec để vừa vượt qua QA audit tĩnh, vừa minh bạch kết quả mong đợi của test.

### [LEARN-012] Hợp Nhất Kịch Bản Kiểm Thử Tránh Phân Mảnh & Hỗ Trợ Đa AC
- **Nguồn trích xuất:** QA-CONSOLIDATE-CANDIDATES
- **Role quan sát:** Senior QA Architect & Platform Engineer
- **Quan sát (Observation):**
  1. Việc chia nhỏ mỗi nhánh kiểm thử biên/validation thành một test case candidate riêng lẻ khiến danh sách ứng viên automation phình to (50+ candidate), gây phân mảnh và khó bảo trì; trong khi các AC cốt lõi đều đã có spec tự động phủ 100%.
  2. `qaTrace.js` quét regex `TC-\d{3}` trên mọi dòng text trong file markdown, do đó nhắc lại mã TC cũ trong ghi chú sẽ bị nhận diện nhầm thành test case đang hoạt động.
  3. Khi một kịch bản tích hợp bao quát nhiều AC (ví dụ `AC-001 AC-002`), regex làm sạch tiêu đề cần hỗ trợ match cụm đa AC để lấy đúng mô tả thay vì lấy nhầm chuỗi mã AC.
- **Bằng chứng (Evidence):** `test-cases/REQ-*.md`, `dashboard/services/qaService.js`, `scripts/lib/qaTrace.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Hợp nhất các kiểm thử biên vi mô thành các Composite E2E Scenarios (giảm ~80% phân mảnh, kiểm thử chuỗi liên hoàn).
  2. Tránh ghi mã `TC-xxx` dạng số hiệu trong phần ghi chú văn bản để không làm nhiễu bộ quét tĩnh.
  3. Chuẩn hóa hàm lọc tiêu đề `cleanCandidateTitle` với regex `(?:AC-\d{3}\s*)+`.

### [LEARN-013] Tự Động Hóa Chatbot Trợ Lý AI Trên Môi Trường QC Thực Tế, Infinite Scroll & Vòng Đời Phiên
- **Nguồn trích xuất:** TASK-CHATBOT-LIVE-QC-VERIFICATION (TC-049 & TC-050)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Tuyệt đối không dùng synthetic mock HTML (`page.route` trả về HTML giả) khi viết automation test cho chatbot. Chatbot thực tế trên web QC chạy Next.js SPA tại URL `https://seeker.vl24hv2.qc.sieuviet-team.com/chop-tro-ly-ai.html`, tương tác với API backend `apigw/api/v1/chatbot/chats` và API Job Drawer `employer/fe/job/get-job-list`.
  2. Mô hình phân trang của Job Drawer trên QC là Infinite Scroll container (`.overflow-y-auto.overscroll-contain.no-scrollbar`), tự động query `page=2`, `page=3` khi người dùng cuộn xuống đáy danh sách chứ không dùng nút chuyển trang số truyền thống (`Trang 1 / 10`, `Next`, `Prev`).
  3. Quản lý vòng đời phiên: Chatbot trên web QC lưu session theo tab in-memory. Khi reload trang, session reset về lời chào ban đầu (`Chào [Tên]! Mình là Chớp. Bạn cần hỗ trợ gì?`). Khi xóa hoàn toàn cookie/storage, truy cập yêu cầu đăng nhập ứng viên qua login popup (`Người tìm việc - Đăng nhập hoặc Đăng ký`), cần cơ chế re-authenticate để kiểm thử tính an toàn không crash của phiên mới.
  4. Tuân thủ `npm run check:framework`: không gọi direct locator trong file spec và không dùng `page.waitForTimeout` trong Page Object Model, thay bằng `page.waitForResponse` hoặc `waitForLoadState` / `waitForVisible`.
- **Bằng chứng (Evidence):** `pages/desktop/ChopChatbotPage.js`, `tests/e2e/desktop/kiem-thu-hien-thi-va-dieu-huong-phan-trang-danh-sach-viec-la.spec.js`, `tests/e2e/desktop/kiem-thu-quan-ly-vong-doi-va-tinh-toan-ven-phien-hoi-thoai-c.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Toàn bộ kịch bản kiểm thử Chatbot phải chạy trực tiếp trên môi trường QC live với API thực, không dùng mock route HTML.
  2. Kiểm thử phân trang danh sách việc làm dạng drawer sử dụng hành vi cuộn container (`scrollTop = scrollHeight`) và lắng nghe sự kiện mạng `waitForResponse('get-job-list')`.
  3. Kiểm thử vòng đời phiên và xóa storage phải kết hợp tái xác thực (`loginIfVisible`) để xác nhận hệ thống khởi tạo lại phiên làm việc an toàn, không bị treo hoặc vỡ giao diện.
  4. Đảm bảo toàn bộ tương tác và assertion qua Page Object Model, tuân thủ 100% rào chắn `npm run check:framework`.

### [LEARN-014] Chuẩn Hóa Định Danh JavaScript Không Bắt Đầu Bằng Chữ Số Trong Bộ Sinh Mã UI Recorder
- **Nguồn trích xuất:** BUGFIX-UI-RECORDER-IDENTIFIER-SYNTAX-ERROR
- **Role quan sát:** Senior Automation QA Engineer & Platform Engineer
- **Quan sát (Observation):**
  1. Khi người dùng ghi hình kịch bản (Playwright Codegen) tương tác với các phần tử có văn bản bắt đầu bằng số (ví dụ: `+10 việc làm có lương hấp dẫn`), hàm `sanitizeToIdentifier` loại bỏ dấu `+` và sinh ra tên biến định danh bắt đầu bằng chữ số: `10ViecLamCoLink`.
  2. Trong cú pháp JavaScript (V8 Engine), tên thuộc tính truy cập qua dot notation `this.10ViecLamCoLink` hoặc tên định danh bắt đầu bằng chữ số (0-9) là cú pháp không hợp lệ (`SyntaxError: Invalid or unexpected token` / `Unexpected number`).
  3. Khi nhấn "Lưu vào Framework", cơ chế Sandbox Validation (`recordWriter.js`) chạy `new Function(pomFile.content)` phát hiện lỗi cú pháp và chặn ghi file, khiến người dùng không thể tạo script.
- **Bằng chứng (Evidence):** `core/generator/namingUtils.js`, `core/generator/recordWriter.js`, `core/generator/recordGenerator.test.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Mọi hàm xử lý / chuẩn hóa định danh mã nguồn (`sanitizeToIdentifier`) bắt buộc phải kiểm tra ký tự đầu tiên. Nếu chuỗi bắt đầu bằng chữ số (`/^[0-9]/`), phải tự động gắn tiền tố hợp lệ (`item` cho camelCase hoặc `Item` cho PascalCase).
  2. Bổ sung test tự động kiểm thử toàn diện các trường hợp text/selector bắt đầu bằng số, đảm bảo mã nguồn POM và Spec sinh ra luôn thỏa mãn `new Function(content)` mà không ném lỗi cú pháp.

### [LEARN-015] Xử Lý Màn Hình OTP Động Và Chuẩn Hóa Truy Vết REQ/TC Khi Chuyển Hóa Kịch Bản Ghi Hình
- **Nguồn trích xuất:** FEATURE-PERSONALIZE-JOB-RECOMMENDATION
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Trong Playwright, phương thức `locator.isVisible()` không tự động chờ phần tử xuất hiện mà trả về `false` ngay lập tức. Nếu dùng `if (await locator.isVisible())` cho màn hình OTP mở bất đồng bộ qua mạng, điều kiện sẽ bị bỏ qua và dẫn đến lỗi overlay che khuất (`headlessui-dialog-overlay intercepts pointer events`).
  2. Dùng số điện thoại cố định qua nhiều lần chạy test sẽ gây xung đột trạng thái (tài khoản đã đăng ký sẽ hỏi mật khẩu thay vì gửi OTP). Việc dùng `generateRandomVNPhone()` giúp luồng đăng ký OTP luôn là tài khoản mới tinh.
  3. Mỗi tính năng mới phát triển bắt buộc phải có tài liệu nghiệp vụ `REQ-xxx` trong `requirements/`, test case `TC-yyy` trong `test-cases/` và ánh xạ đầy đủ trong `test-cases/traceability.md` để đảm bảo cổng `node scripts/qa-trace.js` đạt 0 finding.
- **Bằng chứng (Evidence):** `pages/desktop/PersonalizePage.js`, `tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js`, `requirements/REQ-008-viec-lam-danh-rieng-goi-y-ca-nhan-hoa.md`, `test-cases/REQ-008-viec-lam-danh-rieng-goi-y-ca-nhan-hoa.md`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn sử dụng `waitFor({ state: 'visible' })` hoặc `waitForElement()` trước khi tương tác với các popup/modal bất đồng bộ (như OTP, Form tạo tài khoản, Consent).
  2. Với các luồng kiểm thử đăng ký OTP người dùng mới, luôn dùng `generateRandomVNPhone()` để đảm bảo tính độc lập và lặp lại an toàn của kịch bản kiểm thử.
### [LEARN-016] Đồng Bộ Tham Số `stream: false` Và Xử Lý Chuỗi Phản Hồi SSE (Server-Sent Events) Trong AI Gateway
- **Nguồn trích xuất:** BUGFIX-AI-INFER-STREAM-JSON-PARSE-ERROR
- **Role quan sát:** Senior AI Platform Engineer & Automation QA
- **Quan sát (Observation):**
  1. Một số AI Gateway (như 9Router) hoặc mô hình LLM proxy mặc định trả về luồng phản hồi Server-Sent Events (`Content-Type: text/event-stream`, bắt đầu bằng `data: {"id": ...}`) nếu request không chỉ định rõ ràng `stream: false`.
  2. Khi adapter OpenAI-compatible (`sendChatCompletion`) gọi trực tiếp `res.json()` trên phản hồi dạng stream, trình duyệt và Node.js văng lỗi cú pháp: `SyntaxError: Unexpected token 'd', "data: {"id"... is not valid JSON`.
  3. Lỗi này chặn đứng toàn bộ tính năng suy luận AI (Rà soát & Đề xuất Test Case từ Open Questions, Phân tích Requirement BDD).
- **Bằng chứng (Evidence):** `core/ai/gateway/adapters/openaiCompatible.js`, `core/ai/gateway/adapters/openaiCompatible.test.js`, `dashboard/public/js/views/qa/qaSlice.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Technical Lead / Senior AI Engineer
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn khai báo tường minh `stream: false` trong payload gửi đến các endpoint OpenAI-compatible khi ứng dụng mong muốn nhận JSON tĩnh một lần.
  2. Xây dựng cơ chế fallback giải mã chuỗi phản hồi: Nếu body bắt đầu bằng `data:`, tự động phân tích và gộp các chunk delta của stream SSE thành cấu trúc dữ liệu hoàn chỉnh thay vì để `JSON.parse` văng ngoại lệ.
  3. Trên giao diện người dùng (Dashboard modal), khi xảy ra lỗi mạng/AI, luôn reset danh sách thẻ tạm và chuyển đổi icon trạng thái sang cảnh báo lỗi (`ph-warning-circle`, màu đỏ `#ef4444`) để tránh hiển thị icon checkmark xanh gây hiểu nhầm.

### [LEARN-017] Định Vị Phần Tử Trong Onboarding Modal Tránh Strict Mode Violation Và Xung Đột Trang Nền
- **Nguồn trích xuất:** TASK-BDD-AUTOMATION-REQ-008 (TC-100 -> TC-103)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Khi kiểm thử Onboarding Modal (hoặc bất kỳ overlay form nào trên trang web SPA), các nhãn lựa chọn khu vực/ngành nghề (như "TP.HCM", "Hà Nội") thường có text trùng lặp hoàn toàn với các link SEO/menu ở trang nền (`<a href="/viec-lam-tp-hcm-p122.html">`). Nếu dùng `.first()`, Playwright sẽ bắt nhầm link ở trang nền và bị timeout 15s do bị modal che khuất (`intercepts pointer events`). Vì các modal được render ở cuối DOM, sử dụng `.last()` hoặc container định vị riêng của modal đảm bảo luôn click chính xác vào chip/button bên trong modal.
  2. Việc dùng `.or()` giữa hai phần tử mà cả hai đều có khả năng hiển thị đồng thời (ví dụ: `this.tphcmBtn.or(this.chonToiDa5Text)`) trong `waitForElement()` hoặc `expect().toBeVisible()` sẽ gây lỗi nghiêm trọng `Playwright Strict Mode Violation: resolved to 2 elements`. Chỉ dùng `.or()` cho các fallback loại trừ lẫn nhau, hoặc chỉ định rõ `.first()` / `.last()`.
  3. Luôn dọn dẹp các lớp quảng cáo chiến dịch (`closeAdsIfVisible`, `closeBlockingModalIfVisible`) ở bước `Given` trước khi mở modal để đảm bảo các điểm chạm không bị che khuất và chạy ổn định 100%.
- **Bằng chứng (Evidence):** `pages/desktop/PersonalizePage.js`, `tests/e2e/desktop/personalize-*.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Với các modal render ở cuối DOM, luôn ưu tiên dùng `.last()` hoặc selector giới hạn trong vùng chứa của modal để tránh xung đột với các liên kết cùng tên trên trang nền.
  2. Tuyệt đối không dùng `.or()` giữa các phần tử xuất hiện đồng thời trong các hàm chờ hoặc assertion hiển thị duy nhất.
  3. Ở bước `Given`, luôn chủ động dọn dẹp popups và blocking modals trước khi kích hoạt luồng tương tác người dùng.

### [LEARN-018] Tách Biệt Kiểm Thử Entry Points Với Destination Page Và Xử Lý Modal Consent Hai Tầng
- **Nguồn trích xuất:** TASK-PERSONALIZE-PAGE-DIRECT-E2E (TC-104 -> TC-106)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Khi một tính năng có cấu trúc gồm Entry Points (Home/Search) và Destination Page độc lập (Personalized Page `/viec-lam-danh-rieng-cho-ban.html`), nếu toàn bộ test case chỉ xuất phát từ `Home`, hệ thống sẽ bị bỏ trống vùng rủi ro lớn nhất: giao diện, phân trang, sorting và luồng trực tiếp trên chính Destination Page. Cần viết kịch bản truy cập trực tiếp deep link URL.
  2. Sau khi người dùng xác thực OTP và nhập họ tên tạo tài khoản mới, hệ thống xuất hiện modal Consent: "Đồng ý cho phép xử lý dữ liệu cá nhân". Nút "Đồng ý" (`page.getByRole('button', { name: 'Đồng ý', exact: true })`) cần được chờ và bấm dứt khoát. Nếu bấm nhầm nút "Để sau", hệ thống kích hoạt tiếp popup xác nhận lần hai ("Bạn muốn quay lại sau?"), che phủ toàn bộ viewport và gây lỗi `intercepts pointer events`.
  3. Để tuân thủ 100% kiến trúc dự án (`check:framework`), các thao tác trích xuất SEO metadata (`title`, `meta description`, `canonical`, `og:*`) và đếm số lượng `jobCards` phải được đóng gói thành các helper methods trong Page Object (`PersonalizePage.js`), tuyệt đối không gọi `page.locator()` hay `page.waitForTimeout()` trực tiếp trong file spec.
- **Bằng chứng (Evidence):** `pages/desktop/PersonalizePage.js`, `tests/e2e/desktop/personalize-deeplink-bat-buoc-login.spec.js`, `tests/e2e/desktop/personalize-seo-metadata.spec.js`, `tests/e2e/desktop/personalize-onboarding-truc-tiep-tren-trang.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Luôn phủ cả 2 luồng: Luồng qua Entry Point và Luồng truy cập trực tiếp URL Destination Page.
  2. Xử lý triệt để modal Consent dữ liệu cá nhân bằng exact match nút "Đồng ý" và chờ modal biến mất trước khi tương tác form tiếp theo.
  3. Đóng gói 100% assertions SEO/DOM và đếm element vào Page Object để giữ spec thuần BDD logic và tuân thủ rule kiến trúc.

### [LEARN-019] Tiêu Chuẩn Chụp Bằng Chứng Trực Quan (Evidence Tracing) Đảm Bảo Tính Minh Bạch Trong QA
- **Nguồn trích xuất:** TASK-QA-EVIDENCE-TRACING-AUDIT (TC-106 & REQ-008)
- **Role quan sát:** Senior Automation QA Engineer & Test Lead (Gate 4)
- **Quan sát (Observation):**
  1. **Lỗi chụp bằng chứng lệch pha (Off-by-one / Race condition):** Khi tester viết hàm thực hiện thao tác (click option/fill text) rồi bấm nút Tiếp theo (Next / Submit) trước khi gọi `capture()`, hiệu ứng chuyển bước của SPA sẽ kích hoạt khiến ảnh chụp bị nhảy sang màn hình của bước sau (thậm chí chưa kịp render hoặc trống trơn) nhưng lại mang tên của bước trước. Người review nhìn vào không thấy được dữ liệu hoặc option nào đã thực sự được chọn.
  2. **Gom cục blackbox:** Khi gom toàn bộ luồng wizard/stepper (ví dụ cả 3 bước Mini-onboarding: Vị trí -> Khu vực -> Mức lương) vào một hàm lớn trong Page Object mà không chia tách thành các step BDD rõ ràng trong spec, test report và trace không tái hiện được hành vi chi tiết của từng bước.
  3. **Bẫy regex tiền tố tiếng Việt:** Locator dùng regex `^Khác` để bắt nút dropdown "Khác ⌵" đã vô tình khớp vào các đường link `Khách sạn - Nhà hàng - Du lịch` ngoài viewport, dẫn đến lỗi timeout 15000ms. Cần bổ sung rào chắn loại trừ: `filter({ hasText: /^Khác(\s|$)/ }).filter({ hasNotText: /Khách/i })`.
- **Bằng chứng (Evidence):** `pages/desktop/PersonalizePage.js`, `tests/e2e/desktop/personalize-onboarding-truc-tiep-tren-trang.spec.js`, `tests/e2e/desktop/personalize-chon-chinh-xac-5-khu-vuc.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. **Chụp ngay tại thời điểm tương tác:** Điền giá trị / Click chọn option -> Chờ UI hiển thị giá trị hoặc trạng thái active/checked -> **CHỤP ẢNH BẰNG CHỨNG NGAY TẠI TRẠNG THÁI NÀY** -> Sau đó MỚI bấm nút chuyển bước (Tiếp tục / Tiếp theo / Hoàn tất).
  2. **Tách nhỏ step BDD:** Mỗi bước chuyển đổi trạng thái quan trọng phải tương ứng với một `test.step()` rõ ràng trong spec để Playwright Report hiển thị cây thời gian và bằng chứng trực quan 100%.
  3. **Đặt tên ảnh theo trình tự nghiệp vụ:** Sử dụng tiền tố số thứ tự và ngữ cảnh rõ ràng (ví dụ: `auth_01_phone_entered`, `onboarding_03_step2_locations_selected`, `onboarding_04_step3_salary_range_entered`, `onboarding_05_criteria_card_and_recommendations`) để audit trail minh bạch.

### [LEARN-020] Định Tuyến Trực Tiếp Trang Đích (Destination Page) & Tránh Đi Lạc Qua Trang Chủ (Homepage Detour)
- **Nguồn trích xuất:** TASK-PERSONALIZE-DESTINATION-PAGE-FIX (REQ-008)
- **Role quan sát:** Senior Automation QA Engineer & Test Lead (Gate 4)
- **Quan sát (Observation):**
  1. Khi một tính năng có URL trang đích độc lập (ví dụ Personalized Page `/viec-lam-danh-rieng-cho-ban.html`), nếu Page Object gán `navigate()` trỏ về `'/'` (Trang chủ) và các helper điều hướng đều mở banner từ Trang chủ, các kịch bản test sẽ bị "đi lạc" qua Homepage thay vì kiểm thử đúng trên trang đích.
  2. Việc thao tác qua modal của Homepage làm sai lệch phạm vi kiểm thử (testing scope), che giấu các lỗi render, URL routing, và metadata của trang đích thực tế.
  3. Khi Playwright sử dụng fixture `workerUserData`, tài khoản kiểm thử đã được lưu sẵn trong DB, cho phép test phân nhánh xác thực OTP/mật khẩu trực tiếp trên URL đích mà không cần đi qua popup Trang chủ.
- **Bằng chứng (Evidence):** `pages/desktop/PersonalizePage.js`, `tests/e2e/desktop/personalize-*.spec.js` (12 files)
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Method `navigate()` của một Page Object BẮT BUỘC phải điều hướng về URL của chính trang đó (`this.personalizedPath`), không được fallback về trang chủ `'/'`.
  2. Mọi kịch bản kiểm tra chức năng thuộc trang đích (nhập liệu, kiểm tra biên, chọn tiêu chí, xác thực) phải truy cập trực tiếp URL trang đích và assert `expect(page.url()).toContain(pageObject.path)`.
  3. Chỉ những kịch bản kiểm thử điều hướng liên trang (Cross-page navigation / Funnel sync) mới được phép mở Trang chủ làm điểm khởi đầu.
