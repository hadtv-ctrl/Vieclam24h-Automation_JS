# Playwright AI Rules

Đây là nguồn quy tắc duy nhất cho mọi AI agent tạo, sửa hoặc review Playwright automation trong repository này.

## 1. Mục tiêu và phạm vi

Đóng vai Automation QA Engineer có kinh nghiệm với Playwright, JavaScript và Page Object Model (POM). Chỉ thay đổi những file cần thiết cho yêu cầu; ưu tiên tái sử dụng code hiện có và giữ nguyên hành vi ngoài phạm vi task.

Một test case độc lập tương ứng một `test()`. Không tách các bước phụ thuộc của cùng một scenario thành nhiều `test()` chạy tuần tự. Một feature có nhiều scenario độc lập phải có nhiều `test()`.

## 2. Đọc context trước khi sửa

Trước khi viết code:

1. Đọc test case, precondition và expected result.
2. Đọc `playwright.config.js`, Page Object, fixture, helper và test data liên quan.
3. Tìm method/action đã có trước khi tạo method mới.
4. Nếu yêu cầu hoặc expected result thiếu thông tin quan trọng, nêu assumption rõ ràng; không tự biến một hành vi chưa xác nhận thành optional.

Không đọc hoặc gửi cho AI các thư mục sinh tự động như `node_modules/`, `playwright-report/`, `test-results/`, `evidence/` trừ khi đang phân tích một artifact lỗi cụ thể.

## 3. Kiến trúc bắt buộc

- E2E test đặt tại `tests/e2e/` và có hậu tố `.spec.js`.
- Page Object đặt tại `pages/` và export class rõ ràng.
- Helper/fixture đặt tại `core/utils/` hoặc `core/fixtures/`.
- Test data đặt tại `data/`; không hard-code bộ dữ liệu nghiệp vụ lớn trong spec.
- Cấu hình môi trường nằm tại `core/config/env.js` và được dùng qua `baseURL` trong `playwright.config.js`.
- Spec không được gọi `page.locator()`, `page.getBy*()`, `page.screenshot()`, `page.evaluate()` hoặc thao tác UI trực tiếp. Spec chỉ điều phối Page Object/helper và assertion ở cấp hành vi.
- Locator thuộc Page Object. Action dùng lại `UiActions` trong `core/utils/commonUtils.js` khi action tương ứng đã tồn tại.
- Không import `fs` trong spec. File I/O và evidence phải đi qua helper.
- Không dùng API private như `page.context()._options`, thuộc tính `_selector`, hoặc internals khác của Playwright trong code mới. Điều hướng dùng URL tương đối, ví dụ `page.goto('/')`, thông qua Page Object.

## 4. Cấu trúc BDD

- Mỗi scenario dùng một `test()` và chia bước bằng `await test.step('Given ...'|'When ...'|'Then ...', async () => {})`.
- Không đặt thao tác UI trực tiếp ngoài `test.step()` trong spec.
- Tên test mô tả hành vi và kết quả; không dùng tên chung chung như “test 1”.
- Không gom nhiều scenario độc lập vào một test khổng lồ chỉ để thỏa điều kiện “một flow”.

## 5. Locator và assertion

Thứ tự ưu tiên locator:

1. `getByRole()` với accessible name.
2. `getByLabel()` hoặc `getByPlaceholder()`.
3. `getByTestId()`.
4. `getByText()` khi text ổn định và duy nhất.
5. CSS ngắn, ổn định và có scope rõ ràng.
6. XPath chỉ khi không có lựa chọn đáng tin cậy hơn và phải ghi lý do ngắn trong code.

Không dùng `.first()`, `.last()` hoặc `.nth()` để chữa lỗi strict-mode nếu chưa chứng minh thứ tự là một phần ổn định của UI. Với modal/popup, scope locator vào dialog/container trước.

Dùng web-first assertion như `await expect(locator).toBeVisible()`. Không dùng `expect(await locator.isVisible()).toBeTruthy()` cho trạng thái cần auto-retry.

## 6. Đồng bộ và độ ổn định

- Không thêm `page.waitForTimeout()` hoặc hard sleep dưới bất kỳ hình thức nào trong source automation.
- Thay delay bằng trạng thái quan sát được: element visible/hidden/enabled, response cần thiết, URL hoặc UI state thay đổi.
- Tránh wait/assert các trạng thái trung gian (transient state) diễn ra quá nhanh (ví dụ: text "Đang xử lý...", "Đang chuyển đổi..."). Thay vào đó, hãy wait/assert trực tiếp trạng thái kết quả cuối cùng ("Thành công") để tránh race condition và lỗi do hệ thống đôi khi xử lý cực kỳ nhanh.
- Tránh `networkidle` làm điều kiện chính vì ứng dụng có thể polling. Chờ tín hiệu cụ thể của hành vi đang test.
- Trước Submit/Save/Next, chờ loading liên quan biến mất nếu ứng dụng thật sự có loading state.
- Không nuốt lỗi của bước bắt buộc bằng `catch(() => {})` hoặc `try/catch` rỗng.
- Chỉ xử lý element optional khi test case/business rule xác nhận nó optional. Nhánh optional phải có điều kiện rõ, timeout giới hạn và không được che giấu lỗi của bước bắt buộc.
- Khi chạm vào code cũ có hard sleep hoặc Playwright private API, thay nó nếu nằm trong phạm vi thay đổi và có condition công khai tương đương. Không mở rộng refactor thiếu kiểm soát sang feature khác.

## 7. Evidence

- Spec và Page Object không gọi `page.screenshot()` trực tiếp.
- Dùng `ScreenshotHelper` trong `core/utils/commonUtils.js` qua `takeScreenshot()` hoặc `takeFullPageScreenshot()`.
- Việc chụp evidence không được biến một test failure thành pass. Nếu evidence là bắt buộc và chụp thất bại, phải báo lỗi phù hợp.

## 8. Quy trình thực hiện và kiểm chứng

Sau khi sửa:

1. Kiểm tra mọi Page Object method được gọi trong spec thực sự tồn tại.
2. Chạy `npm run check:framework`.
3. Chạy unit test của helper bị ảnh hưởng, nếu có.
4. Chạy đúng spec/project bị ảnh hưởng bằng Playwright. Không mặc định chạy toàn bộ suite khi một targeted test đủ chứng minh thay đổi.
5. Nếu fail do code vừa sửa, phân tích log và sửa lại. Tối đa 3 vòng tự động; sau đó báo blocker và evidence thay vì tiếp tục tiêu quota không giới hạn.
6. Không tuyên bố pass nếu chưa chạy. Phân biệt rõ: static check pass, unit test pass, Playwright test pass hoặc chưa chạy được.

Để tiết kiệm quota và thời gian chạy, không gọi `npx playwright test` từ precondition/helper của e2e. Nếu cần tạo dữ liệu bằng API, tách logic thành helper dùng `APIRequestContext` và gọi trực tiếp trong cùng process. Log từ config/helper phải để mặc định im lặng hoặc bật bằng biến môi trường.

## 9. Cách trả kết quả để tiết kiệm quota

Khi có quyền sửa repository, sửa trực tiếp file; không in lại toàn bộ source và không xuất checklist cam kết dài. Báo cáo cuối chỉ gồm:

- File đã thay đổi.
- Quyết định kỹ thuật quan trọng.
- Lệnh kiểm tra đã chạy và kết quả.
- Blocker hoặc rủi ro còn lại, nếu có.

Khi người dùng chỉ yêu cầu code mà không cho phép sửa file, chỉ xuất những file/đoạn code cần thiết. Không lặp lại toàn bộ quy tắc trong câu trả lời.

## 10. Definition of Done

Chỉ coi task hoàn tất khi:

- Cấu trúc thư mục và POM đúng quy định.
- Spec không chứa UI locator/action trực tiếp.
- Không thêm hard sleep, domain thật, Playwright private API hoặc error swallowing.
- Locator đủ ổn định và assertion kiểm tra đúng expected result.
- Method giữa spec và Page Object nhất quán.
- Các kiểm tra phù hợp đã được chạy và báo cáo trung thực.
