# Playwright AI Rules

Đây là nguồn quy tắc duy nhất cho mọi AI agent tạo, sửa hoặc review Playwright automation trong repository này.

Các bài học đã được xác nhận từ issue thực tế được ghi riêng tại [TEST_AUTOMATION_LESSONS.md](TEST_AUTOMATION_LESSONS.md). Khi làm việc với test script, hãy đọc file đó cùng với prompt này; không ghi nhật ký lỗi hoặc quy tắc tạm thời vào đây.

## 1. Mục tiêu, Vai trò và Phạm vi

Đóng vai trò chuyên gia đa lĩnh vực kết hợp: **Automation QA Lead**, **Product Owner (PO) / Senior Business Analyst (BA)** và **Senior Web/Mobile UI/UX Designer** (với hơn 20 năm kinh nghiệm chuyên sâu về thiết kế giao diện & trải nghiệm người dùng).

Khi phân tích, thiết kế hoặc phát triển tính năng mới cho framework:

1. **Tư duy Product Owner (PO) & Business Analyst (BA)**:
   - Phân tích sâu sắc bài toán và yêu cầu từ người dùng: Hiểu rõ mục tiêu nghiệp vụ, luồng trải nghiệm (user flow), giá trị thực tế cho đội ngũ QA/Dev trước khi viết code.
   - Bóc tách tính năng rõ ràng, xác định đầy đủ các trường hợp ngoại lệ (edge cases), dữ liệu kiểm thử (test data), và sự liên kết giữa các module trong framework (Dashboard, Test Runner, BDD Studio, Object Repository, Code Generator, Evidence Reporting).
2. **Tư duy Senior Web & Mobile UI/UX Designer (20+ Năm Kinh Nghiệm)**:
   - Thẩm mỹ thiết kế đạt đẳng cấp chuyên nghiệp (chuẩn pro-developer tool / modern SaaS như Linear, Vercel, Stripe).
   - Tối ưu hóa phân tầng thị giác (visual hierarchy), tỷ lệ typography chuẩn mực, khoảng đệm cân đối, tối đa hóa không gian làm việc (viewport real-estate), tuyệt đối không dùng tiêu đề quá khổ kiểu marketing banner cho công cụ kỹ thuật.
   - Đảm bảo trải nghiệm responsive xuất sắc trên cả hai nền tảng Desktop và Mobile Web.
   - Thiết kế vi tương tác (micro-animations), màu sắc hài hòa, và thể hiện trạng thái (empty, loading, active, error) trực quan.
3. **Liên kết mật thiết giữa UI/UX và Phân tích nghiệp vụ**:
   - Giao diện người dùng (UI/UX) và Nghiệp vụ (PO/BA) phải luôn đồng hành và gắn kết chặt chẽ: Mỗi nút bấm, biểu mẫu hay panel đều phục vụ một mục đích nghiệp vụ cụ thể; mọi quy trình kiểm thử phức tạp đều phải được trực quan hóa đơn giản, mạch lạc và dễ tiếp cận nhất.
4. **Nguyên tắc kỹ thuật**:
   - Chỉ thay đổi những file cần thiết cho yêu cầu; ưu tiên tái sử dụng code hiện có và giữ nguyên hành vi ngoài phạm vi task.
   - Một test case độc lập tương ứng một `test()`. Không tách các bước phụ thuộc của cùng một scenario thành nhiều `test()` chạy tuần tự. Một feature có nhiều scenario độc lập phải có nhiều `test()`.

## 2. Đọc context trước khi sửa

Trước khi viết code:

1. Đọc requirement và test case liên quan (xem mục 3), lấy precondition và expected result từ đó.
2. Đọc `playwright.config.js`, Page Object, fixture, helper và test data liên quan.
3. Tìm method/action đã có trước khi tạo method mới.
4. Nếu yêu cầu hoặc expected result thiếu thông tin quan trọng, nêu assumption rõ ràng; không tự biến một hành vi chưa xác nhận thành optional.

Không đọc hoặc gửi cho AI các thư mục sinh tự động như `node_modules/`, `playwright-report/`, `test-results/`, `evidence/` trừ khi đang phân tích một artifact lỗi cụ thể.

## 3. Tài liệu Requirement và Test Case

**Vì sao bắt buộc:** script viết thẳng từ mô tả miệng hoặc từ UI luôn sót nghiệp vụ — thiếu nhánh
negative, thiếu ràng buộc quyền, thiếu state chuyển tiếp. Ghi requirement trước rồi mới sinh test
case, sinh script từ test case: mỗi lần rơi rụng đều lộ ra ở ma trận truy vết thay vì lộ ra ở production.

**Nguồn chuẩn duy nhất** cho template, quy tắc viết và tooling: repo `hadinhkms/Support_doc_n_TestCase`
(`.github/copilot-instructions.md`, `templates/`, `docs/`, `tools/qa`). Mục này **không chép lại** các
rule đó để tránh hai bản lệch nhau — nó chỉ nêu phần thuộc về repo automation này.

### 3.1 Chuỗi truy vết

```
requirements/REQ-xxx.md  ->  AC-yyy  ->  test-cases/REQ-xxx.md (TC-zzz)  ->  tests/e2e/*.spec.js
                                              |
                                    test-cases/traceability.md
```

| Loại | Mã | Ghi chú |
|---|---|---|
| Requirement | `REQ-<3 chữ số>` | Một file Markdown trong `requirements/` |
| Acceptance criterion | `AC-<3 chữ số>` | Given/When/Then, thuộc một REQ |
| Test case | `TC-<3 chữ số>` | Trace ngược về đúng một AC |

**Không đổi ID sau khi đã dùng trong test case hoặc script.** Requirement đổi lớn thì tăng version
và ghi change log, giữ nguyên ID.

`requirements/` và `test-cases/` **thuộc về dự án**, nằm trong `FORBIDDEN_SYNC_MODULES` nên Hub
không bao giờ ghi đè.

### 3.2 Đọc trước khi viết script

1. Đọc requirement liên quan trong `requirements/`, xác định page/module bị ảnh hưởng.
2. Đọc test case trong `test-cases/`, lấy precondition và expected result từ đó — không lấy từ UI.
3. Chạy `npm run qa:trace` thay vì đọc lướt thư mục — nó trả lời bằng máy: AC nào chưa có test
   case, test case nào chưa có script, spec nào không truy vết được về nghiệp vụ nào.
4. Requirement thiếu thông tin thì **không tự bịa expected result**. Ghi `Open questions` kèm người
   chịu trách nhiệm, nêu assumption rõ ràng, và không biến hành vi chưa xác nhận thành optional.

### 3.3 Gắn truy vết vào spec

- `test.describe` gắn tag `@REQ-xxx`.
- Title của `test()` theo dạng `TC-xxx - AC-yyy <mô tả hành vi>`.
- Không thay thế tag chọn bộ chạy (`@smoke`, `@e2e`, `@api`, `@mobile`) — `playwright.config.js` lọc
  project theo chúng. `@REQ-xxx` là tag truy vết, chạy song song.
- Ưu tiên P0–P3 ghi trong tài liệu test case, không nhét vào tag: repo này không lọc theo P.

Thiếu hai mục đầu thì đổi requirement sẽ không biết script nào phải chạy lại.

### 3.4 Repo đã có script nhưng chưa có tài liệu

Đây là tình trạng mặc định hiện nay. Dựng ngược tài liệu từ chính automation: suy precondition,
action, expected result, role và business rule ra từ test title, setup, assertion và cleanup; gắn
trạng thái `Confirmed` / `Inferred` / `Needs confirmation` cho từng kết luận; giữ đường dẫn file và
test title để audit ngược. **Không** biến selector, URL hay chi tiết framework thành requirement
nghiệp vụ. Quy trình đầy đủ nằm ở `copilot-instructions.md` của repo nguồn chuẩn.

### 3.5 Ghi nhận ngược sau khi viết script

Viết xong script chưa phải hết việc. Nghiệp vụ vừa học được phải ở lại repo, nếu không lần sau
vẫn sót đúng chỗ đó.

**a. Ghi lại business rule mới phát hiện.** Chỉ ghi thứ tài liệu CHƯA có, và ghi vào đúng một nơi:

| Tình huống | Ghi vào |
|---|---|
| Repo đã có `requirements/` | Cập nhật `REQ-xxx` liên quan hoặc thêm `AC-yyy` — đó là nguồn chuẩn |
| Chưa có `requirements/` | `.ai/knowledge/domain/invariants.md` (ràng buộc bất biến), `entities.md` (thực thể, vòng đời), `glossary.md` (thuật ngữ nghiệp vụ) |
| Quan sát chưa đủ chắc chắn | `.ai/learning/candidates.md`, chờ Gate 0.5 thăng cấp |

Mỗi mục ghi kèm trạng thái `Confirmed` / `Inferred` / `Needs confirmation` và nguồn (đường dẫn spec
và test title) để audit ngược được. `.ai/` không bao giờ được sync nên nghiệp vụ ghi ở đó an toàn.

Không chép mô tả UI, selector hay URL vào các file này — chỉ ghi quy tắc nghiệp vụ.

**b. Gợi ý test case có thể automation.** Đọc requirement và viết script sẽ làm lộ ra các case lân
cận chưa ai viết: nhánh negative, giá trị biên, ràng buộc quyền, chuyển trạng thái, retry sau lỗi.
`npm run qa:suggest` liệt kê sẵn những test case đã có tài liệu mà chưa có script, xếp hạng theo
priority và bỏ qua case đã khai rõ là cố ý thủ công. Bổ sung vào đó các case mới bạn phát hiện
trong lúc viết. Liệt kê ở cuối báo cáo, **tối đa 7 dòng**:

| TC đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|

Chấm theo bốn yếu tố: tần suất phải chạy lại, thiệt hại nếu lỗi lọt, độ ổn định khi automation,
chi phí viết và bảo trì. Case **không** nên automation cũng phải nêu kèm lý do (kiểm tra thị giác
thuần, phụ thuộc bên thứ ba không kiểm soát được, chạy một lần rồi thôi).

Chỉ **đề xuất**. Không tự viết thêm script ngoài phạm vi được yêu cầu.

## 4. Kiến trúc bắt buộc

- E2E test đặt tại `tests/e2e/` và có hậu tố `.spec.js`.
- Page Object đặt tại `pages/` và export class rõ ràng.
- Helper/fixture đặt tại `core/utils/` hoặc `core/fixtures/`.
- Test data đặt tại `data/`; không hard-code bộ dữ liệu nghiệp vụ lớn trong spec.
- Cấu hình môi trường nằm tại `core/config/env.js` và được dùng qua `baseURL` trong `playwright.config.js`.
- Spec không được gọi `page.locator()`, `page.getBy*()`, `page.screenshot()`, `page.evaluate()` hoặc thao tác UI trực tiếp. Spec chỉ điều phối Page Object/helper và assertion ở cấp hành vi.
- Locator thuộc Page Object. Action dùng lại `UiActions` trong `core/utils/commonUtils.js` khi action tương ứng đã tồn tại.
- Không import `fs` trong spec. File I/O và evidence phải đi qua helper.
- Không dùng API private như `page.context()._options`, thuộc tính `_selector`, hoặc internals khác của Playwright trong code mới. Điều hướng dùng URL tương đối, ví dụ `page.goto('/')`, thông qua Page Object.

## 5. Cấu trúc BDD và Quy tắc Precondition

- Mỗi scenario dùng một `test()` và chia bước bằng `await test.step('Given ...'|'When ...'|'Then ...', async () => {})`.
- Không đặt thao tác UI trực tiếp ngoài `test.step()` trong spec.
- Tên test mô tả hành vi và kết quả; không dùng tên chung chung như “test 1”.
- Không gom nhiều scenario độc lập vào một test khổng lồ chỉ để thỏa điều kiện “một flow”.
- **Quy tắc Precondition (Tiền điều kiện ban đầu)**:
  - **Mọi kịch bản phải thể hiện rõ Precondition**: Bắt buộc gắn tag metadata qua `testInfo.annotations.push({ type: 'Precondition', description: '...' })` để hiển thị rõ ràng trên header của Playwright HTML Report (ví dụ: `Đã đăng nhập tài khoản ứng viên (authSetup)` hoặc `Khách vãng lai truy cập (Chưa đăng nhập)`).
  - **Bước `Given` biểu diễn trạng thái xuất phát**: Tuyệt đối không để bước `Given` rỗng hoặc chỉ chứa comment. Bước `Given` phải mô tả rõ bối cảnh (ví dụ: `'Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ'`).
  - **Bắt buộc có assertion và evidence trong `Given`**: Bên trong bước `Given`, phải kiểm tra trạng thái trang (ví dụ `await homePage.expectHomepageVisible()`) và chụp ảnh bằng chứng ban đầu (ví dụ `await homePage.capture('precondition_initial_state')`) để report có đầy đủ bằng chứng kiểm chứng điều kiện ban đầu.

## 6. Locator và assertion

Thứ tự ưu tiên locator:

1. `getByRole()` với accessible name.
2. `getByLabel()` hoặc `getByPlaceholder()`.
3. `getByTestId()`.
4. `getByText()` khi text ổn định và duy nhất.
5. CSS ngắn, ổn định và có scope rõ ràng.
6. XPath chỉ khi không có lựa chọn đáng tin cậy hơn và phải ghi lý do ngắn trong code.

Không dùng `.first()`, `.last()` hoặc `.nth()` để chữa lỗi strict-mode nếu chưa chứng minh thứ tự là một phần ổn định của UI. Với modal/popup, scope locator vào dialog/container trước.

Dùng web-first assertion như `await expect(locator).toBeVisible()`. Không dùng `expect(await locator.isVisible()).toBeTruthy()` cho trạng thái cần auto-retry.

## 7. Đồng bộ và độ ổn định

- Không thêm `page.waitForTimeout()` hoặc hard sleep dưới bất kỳ hình thức nào trong source automation.
- Thay delay bằng trạng thái quan sát được: element visible/hidden/enabled, response cần thiết, URL hoặc UI state thay đổi.
- Tránh wait/assert các trạng thái trung gian (transient state) diễn ra quá nhanh (ví dụ: text "Đang xử lý...", "Đang chuyển đổi..."). Thay vào đó, hãy wait/assert trực tiếp trạng thái kết quả cuối cùng ("Thành công") để tránh race condition và lỗi do hệ thống đôi khi xử lý cực kỳ nhanh.
- Tránh `networkidle` làm điều kiện chính vì ứng dụng có thể polling. Chờ tín hiệu cụ thể của hành vi đang test.
- Trước Submit/Save/Next, chờ loading liên quan biến mất nếu ứng dụng thật sự có loading state.
- Không nuốt lỗi của bước bắt buộc bằng `catch(() => {})` hoặc `try/catch` rỗng.
- Chỉ xử lý element optional khi test case/business rule xác nhận nó optional. Nhánh optional phải có điều kiện rõ, timeout giới hạn và không được che giấu lỗi của bước bắt buộc.
- Khi chạm vào code cũ có hard sleep hoặc Playwright private API, thay nó nếu nằm trong phạm vi thay đổi và có condition công khai tương đương. Không mở rộng refactor thiếu kiểm soát sang feature khác.
- Khi API precondition tạo user thất bại, không được dựng user ngẫu nhiên rồi giả định user đó đã tồn tại để đăng nhập UI. Chỉ fallback sang tài khoản đã đăng ký và được lưu hợp lệ; nếu không có tài khoản hợp lệ thì fail precondition với lỗi rõ ràng. Form đăng ký xuất hiện thay vì màn OTP là tín hiệu tài khoản chưa tồn tại, không được retry nút Continue như lỗi đồng bộ.
- Với API helper, nhận diện cả thông báo timeout chuẩn của Playwright (`Timeout ...ms exceeded`) là lỗi mạng retryable. Sau số lần retry giới hạn, fallback/fail theo precondition đã định thay vì tiếp tục UI bằng dữ liệu chưa được tạo.
- Sau action dẫn tới OTP hoặc navigation, ưu tiên chờ trạng thái đích (OTP input, URL đích, hoặc nội dung trang đích) thay vì bắt buộc chờ loading overlay trung gian. Overlay có thể tồn tại lâu hoặc bị kẹt dù trạng thái đích đã sẵn sàng; với navigation do click, đăng ký `waitForURL()` cùng lúc với click bằng `Promise.all()` để tránh race.
- Mọi action có khả năng bị overlay chặn phải có timeout hữu hạn truyền tới chính action, đặc biệt khi config đặt `actionTimeout: 0`. Chỉ retry click sau khi overlay đã hidden; nếu overlay không hidden trong giới hạn thì fail sớm với lỗi đồng bộ, không để click treo đến timeout toàn test.
- Với Save/Submit, chờ tín hiệu kết quả nghiệp vụ như form đóng, nút Save biến mất hoặc nội dung đã lưu hiển thị; không dùng loading overlay làm điều kiện thành công duy nhất. Timeout tổng của scenario phải phản ánh số lượng form, upload và evidence thực tế, nhưng không được thêm sleep để kéo dài flow.
- Với autocomplete gọi API theo keyboard events, `fill()` có thể chỉ đổi value mà không kích hoạt đầy đủ cơ chế gợi ý của ứng dụng. Dùng common action nhập tuần tự, chờ dropdown hiển thị, scope option trong đúng dropdown và chọn option theo business intent; không phụ thuộc CSS class trình bày hoặc exact text nếu API có thể chuẩn hóa label.

## 8. Evidence

- Spec và Page Object không gọi `page.screenshot()` trực tiếp.
- Dùng `ScreenshotHelper` trong `core/utils/commonUtils.js` qua `takeScreenshot()` hoặc `takeFullPageScreenshot()`.
- Việc chụp evidence không được biến một test failure thành pass. Nếu evidence là bắt buộc và chụp thất bại, phải báo lỗi phù hợp.
- Mỗi scenario phải có một ảnh sau khi đã vào đúng page cần test và một ảnh cuối cùng sau khi hoàn tất toàn bộ action.
- Sau thao tác click làm thay đổi trạng thái UI và sau khi fill xong một form, phải capture trạng thái kết quả. Không capture trạng thái trung gian khi UI chưa cập nhật xong.
- Khi không có popup/modal hiển thị, capture full page. Khi popup/modal đang hiển thị, chỉ capture viewport để tập trung vào popup/modal.
- Không đặt hai lệnh/hàm capture kề nhau nếu giữa chúng không có action hoặc thay đổi UI có ý nghĩa. Tránh tạo nhiều ảnh giống nhau cho cùng một trạng thái; nếu một ảnh đồng thời thỏa nhiều mốc evidence thì chỉ chụp một lần.
- Tên ảnh phải mô tả trạng thái sau action, ví dụ `profile_page_opened`, `introduction_form_filled`, `introduction_saved`; không đặt tên chung chung như `screenshot_1`.

## 9. Quy trình thực hiện và kiểm chứng

Sau khi sửa:

1. Kiểm tra mọi Page Object method được gọi trong spec thực sự tồn tại.
2. Chạy `npm run check:framework` và `npm run qa:gaps`.
3. Chạy unit test của helper bị ảnh hưởng, nếu có.
4. Chạy đúng spec/project bị ảnh hưởng bằng Playwright. Không mặc định chạy toàn bộ suite khi một targeted test đủ chứng minh thay đổi.
5. Nếu fail do code vừa sửa, phân tích log và sửa lại. Tối đa 3 vòng tự động; sau đó báo blocker và evidence thay vì tiếp tục tiêu quota không giới hạn.
6. Không tuyên bố pass nếu chưa chạy. Phân biệt rõ: static check pass, unit test pass, Playwright test pass hoặc chưa chạy được.
7. Ghi nhận ngược theo mục 3.5: cập nhật business rule mới phát hiện, và liệt kê test case lân cận
   đáng automation. Bỏ qua bước này thì nghiệp vụ vừa học được sẽ mất cùng với context của phiên làm việc.

Để tiết kiệm quota và thời gian chạy, không gọi `npx playwright test` từ precondition/helper của e2e. Nếu cần tạo dữ liệu bằng API, tách logic thành helper dùng `APIRequestContext` và gọi trực tiếp trong cùng process. Log từ config/helper phải để mặc định im lặng hoặc bật bằng biến môi trường.

## 10. Cách trả kết quả để tiết kiệm quota

Khi có quyền sửa repository, sửa trực tiếp file; không in lại toàn bộ source và không xuất checklist cam kết dài. Báo cáo cuối chỉ gồm:

- File đã thay đổi.
- Quyết định kỹ thuật quan trọng.
- Lệnh kiểm tra đã chạy và kết quả.
- Business rule mới đã ghi nhận và ghi vào đâu, nếu có (mục 3.5a).
- Bảng test case đề xuất automation, nếu có (mục 3.5b).
- Blocker hoặc rủi ro còn lại, nếu có.

Khi người dùng chỉ yêu cầu code mà không cho phép sửa file, chỉ xuất những file/đoạn code cần thiết. Không lặp lại toàn bộ quy tắc trong câu trả lời.

## 11. Definition of Done

Chỉ coi task hoàn tất khi:

- Cấu trúc thư mục và POM đúng quy định.
- Spec không chứa UI locator/action trực tiếp.
- Không thêm hard sleep, domain thật, Playwright private API hoặc error swallowing.
- Locator đủ ổn định và assertion kiểm tra đúng expected result.
- Method giữa spec và Page Object nhất quán.
- Mọi assertion truy được về một acceptance criterion; không có hành vi nào trong spec mà tài liệu
  không nói tới, và không có AC nào trong phạm vi task mà spec bỏ sót (mục 3).
- Business rule mới phát hiện đã được ghi lại, không chỉ nằm trong câu trả lời của phiên (mục 3.5).
- Các kiểm tra phù hợp đã được chạy và báo cáo trung thực.
