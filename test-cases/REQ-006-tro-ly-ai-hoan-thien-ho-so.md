# Test case — REQ-006 Trợ lý AI hoàn thiện nội dung hồ sơ

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-023 | AC-020 AC-021 | Viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI trên desktop | P2 | Có | tests/e2e/desktop/profile_ai_writing-bdd.spec.js |
| TC-024 | AC-020 AC-021 | Viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI trên mobile web | P2 | Có | tests/e2e/mobile-web/profile_ai_writing-bdd.mobile.spec.js |

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
