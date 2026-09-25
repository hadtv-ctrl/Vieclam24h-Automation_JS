# Test case — REQ-006 Trợ lý AI hoàn thiện nội dung hồ sơ

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-023 | AC-020 AC-021 | Viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI trên desktop | P2 | Có | tests/e2e/desktop/profile_ai_writing-bdd.spec.js |
| TC-024 | AC-020 AC-021 | Viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI trên mobile web | P2 | Có | tests/e2e/mobile-web/profile_ai_writing-bdd.mobile.spec.js |
| TC-025 | AC-020 | Hiển thị popup thông báo lỗi khi dịch vụ AI gặp sự cố hoặc phản hồi thất bại | P1 | candidate | - |
| TC-026 | AC-020 | Chuyển đổi lần lượt qua cả 3 giọng văn hỗ trợ để viết lại giới thiệu bản thân | P1 | candidate | - |
| TC-027 | AC-020 | Từ chối/Hủy bỏ nội dung AI vừa sinh ra để giữ nguyên đoạn giới thiệu gốc | P2 | candidate | - |
| TC-028 | AC-021 | Tạo mô tả kinh nghiệm bằng AI khi để trống và áp dụng trực tiếp vào hồ sơ mà không qua kiểm duyệt | P1 | candidate | - |

## Chi tiết

### TC-023 và TC-024 — Dùng trợ lý AI hoàn thiện hồ sơ

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding, đang ở trang Hồ sơ của tôi.
- **Dữ liệu**: `data/aiProfileData.json` gồm đoạn giới thiệu gốc và hai giọng văn Chuyên nghiệp và Thuyết phục; thông tin kinh nghiệm gồm công ty, chức danh, thời gian bắt đầu, cờ đang làm việc tại đây, và hai giọng văn Thuyết phục và Ngắn gọn dễ đọc.
- **Các bước**: mở form Giới thiệu bản thân, nhập đoạn gốc, yêu cầu AI viết lại theo hai giọng nối tiếp, lưu; mở form Kinh nghiệm làm việc, điền các trường và **để trống phần mô tả**, yêu cầu AI tạo mô tả rồi viết lại theo hai giọng, lưu.
- **Expected result thực tế đang kiểm**:
  - Không có assertion nào ở tầng spec.
  - Nội dung sau khi AI viết lại khác nội dung trước đó — **Không kiểm chứng**. Nếu AI trả về rỗng hoặc trả nguyên văn đầu vào, test vẫn xanh.
  - Mô tả kinh nghiệm được AI điền — **Không kiểm chứng**.
  - Nội dung AI sinh ra được lưu vào hồ sơ — **Không kiểm chứng**.
- **Đánh giá**: test case này hiện chỉ chứng minh "luồng bấm được từ đầu tới cuối mà không văng lỗi". Xếp P2 và giữ nguyên đánh giá đó cho tới khi bổ sung được bước so sánh nội dung.
- **Ghi chú rủi ro**: AI là dịch vụ bên thứ ba có độ trễ và kết quả không xác định. Assertion nên kiểm **tính chất** của kết quả (khác rỗng, khác đoạn gốc, độ dài trong khoảng hợp lý) chứ không kiểm nội dung cụ thể.

## Ứng viên automation cho REQ-006

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| So sánh nội dung trước và sau khi AI viết lại | AC-020 | Biến test case hiện tại từ vô nghĩa thành có giá trị, chi phí rất thấp | P1 |
| AI trả lỗi hoặc quá thời gian chờ | AC-020 AC-021 | Nhánh lỗi dịch vụ bên thứ ba đang trống, cần giả lập phản hồi | P1 |
| Yêu cầu AI viết lại khi nội dung gốc rỗng | AC-020 | Giá trị biên rõ ràng, dễ kiểm | P2 |
| Hoàn tác bản AI viết lại | AC-020 | Cần xác nhận sản phẩm có tính năng này không | P3 |
| Chất lượng và độ phù hợp của nội dung AI sinh ra | AC-021 | **Không nên automation**: kết quả không xác định, thuộc kiểm thử thủ công có người đọc | manual |


### TC-025 — Hiển thị popup thông báo lỗi khi dịch vụ AI gặp sự cố hoặc phản hồi thất bại

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã đăng nhập, ở trang chỉnh sửa hồ sơ và có đoạn giới thiệu bản thân.
- **Dữ liệu kiểm thử:** Mô phỏng API AI trả về mã lỗi HTTP 500 / 503 hoặc Timeout.
> *Ghi chú nghiệp vụ:* Dựa trên quyết định Q-3: Khi dịch vụ AI lỗi, hệ thống phải hiển thị popup báo lỗi cho người dùng thay vì treo giao diện hoặc không phản hồi.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấp chọn tính năng viết lại giới thiệu bằng AI. | Hệ thống hiển thị trạng thái đang xử lý (loading). |
| 2 | Mô phỏng phản hồi lỗi từ server dịch vụ AI. | Hệ thống đóng trạng thái loading và hiển thị popup thông báo lỗi dịch vụ AI tới người dùng. |
| 3 | Đóng popup báo lỗi. | Popup đóng lại, nội dung giới thiệu ban đầu của người dùng được giữ nguyên vẹn. |


### TC-026 — Chuyển đổi lần lượt qua cả 3 giọng văn hỗ trợ để viết lại giới thiệu bản thân

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã đăng nhập và nhập sẵn một đoạn giới thiệu bản thân ngắn.
- **Dữ liệu kiểm thử:** 3 giọng văn hỗ trợ trong hệ thống (Giọng 1, Giọng 2, Giọng 3).
> *Ghi chú nghiệp vụ:* Dựa trên quyết định Q-1 và AC-020: Hệ thống hiện chỉ hỗ trợ đúng 3 giọng văn chuẩn, cần đảm bảo việc chuyển đổi qua lại giữa cả 3 giọng văn hoạt động chính xác.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở tính năng AI viết lại và chọn lần lượt Giọng văn 1, phát sinh nội dung. | AI tạo ra đoạn văn mới tương ứng với Giọng văn 1. |
| 2 | Tiếp tục chọn Giọng văn 2 và yêu cầu viết lại. | AI cập nhật nội dung gợi ý theo phong cách của Giọng văn 2. |
| 3 | Chọn Giọng văn 3 và yêu cầu viết lại. | AI cập nhật nội dung gợi ý theo phong cách của Giọng văn 3. |


### TC-027 — Từ chối/Hủy bỏ nội dung AI vừa sinh ra để giữ nguyên đoạn giới thiệu gốc

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã có đoạn văn giới thiệu bản thân gốc trước khi kích hoạt AI.
- **Dữ liệu kiểm thử:** Nội dung gốc: 'Tôi là chuyên viên kiểm thử có 5 năm kinh nghiệm.'
> *Ghi chú nghiệp vụ:* Dựa trên quyết định Q-4: Người dùng tự chịu trách nhiệm và có toàn quyền quyết định sử dụng hay không sử dụng nội dung do AI gợi ý.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Kích hoạt AI viết lại giới thiệu bản thân. | AI hiển thị bản xem trước (preview) của văn bản mới được sinh ra. |
| 2 | Nhấn nút 'Hủy' / 'Không sử dụng'. | Giao diện AI xem trước đóng lại. Đoạn văn giới thiệu gốc giữ nguyên, không bị ghi đè. |


### TC-028 — Tạo mô tả kinh nghiệm bằng AI khi để trống và áp dụng trực tiếp vào hồ sơ mà không qua kiểm duyệt

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Thêm một mục kinh nghiệm làm việc mới với Tên chức danh và Công ty đầy đủ, nhưng trường Mô tả để trống hoàn toàn.
- **Dữ liệu kiểm thử:** Chức danh: 'Automation Test Lead', Công ty: 'Công ty Công nghệ X', Mô tả: ''
> *Ghi chú nghiệp vụ:* Dựa trên AC-021 và quyết định Q-4: Nội dung AI sinh ra khi mô tả trống sẽ được áp dụng ngay vào hồ sơ mà không cần qua khâu kiểm duyệt trung gian.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấp vào nút 'Tạo mô tả bằng AI' tại trường mô tả kinh nghiệm đang để trống. | AI tự động sinh ra đoạn mô tả công việc phù hợp với chức danh và công ty. |
| 2 | Nhấn 'Áp dụng' và thực hiện 'Lưu hồ sơ'. | Hệ thống lưu thành công nội dung mô tả vào hồ sơ ngay lập tức, không có trạng thái 'Chờ kiểm duyệt'. |
