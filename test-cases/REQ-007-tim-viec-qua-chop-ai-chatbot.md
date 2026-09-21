# Test case — REQ-007 Tìm kiếm việc làm qua trợ lý Chop AI chatbot

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-025 | AC-022 | Người dùng tìm kiếm, lọc và xem việc làm qua Chop AI chatbot trên desktop | P1 | Có | tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js |

## Chi tiết

### TC-025 — Tìm kiếm và lọc việc làm qua Chop AI chatbot

- **Precondition**: người dùng mở trang tìm kiếm việc làm, đã đóng các modal popup/guest prompt.
- **Dữ liệu**: `data/chopChatbotData.json` gồm từ khóa tìm kiếm (`searchKeyword`), ngành nghề lọc, khu vực lọc (`locationFilter`), mức lương lọc (`salaryHighOption`), và từ khóa kinh nghiệm (`experienceKeyword`).
- **Các bước**:
  1. Mở cửa sổ Chop AI chatbot và đăng nhập tài khoản.
  2. Nhập từ khóa tìm kiếm việc làm vào ô chat và gửi tin nhắn.
  3. Chọn địa điểm (TP.HCM) và mức lương khởi điểm từ gợi ý của bot.
  4. Xác nhận số lượng việc làm phù hợp và mở drawer kết quả việc làm.
  5. Lọc theo ngành nghề, kiểm tra áp dụng rồi xóa bộ lọc.
  6. Lọc theo khu vực (Quận 1, Quận 4, Quận 3 tại TP.HCM), kiểm tra hiển thị rồi xóa bộ lọc.
  7. Lọc theo mức lương từ 15 triệu trở lên, kiểm tra hiển thị rồi xóa bộ lọc.
  8. Tìm kiếm theo kinh nghiệm qua chat và chỉnh sửa bộ lọc kinh nghiệm (từ 3 năm về 2 năm).
  9. Xóa toàn bộ bộ lọc và mở xem chi tiết một tin tuyển dụng gợi ý.
  10. Đóng modal chi tiết việc làm và điều hướng quay về trang chủ.
- **Expected result thực tế kiểm chứng**:
  - Số lượng công việc phù hợp hiển thị trong bot — Có assertion kiểm chứng.
  - Các chip/nhãn bộ lọc (khu vực, lương, kinh nghiệm) phản ánh chính xác lựa chọn — Có assertion kiểm chứng.
  - Điều hướng quay về trang chủ thành công — Có assertion kiểm chứng.
- **Đánh giá**: Kịch bản kiểm thử bao phủ toàn diện luồng tương tác với trợ lý ảo Chop AI từ nhập liệu, trắc nghiệm đến quản lý bộ lọc đa chiều.

## Ứng viên automation cho REQ-007

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Ứng tuyển nhanh việc làm trực tiếp từ Drawer của chatbot | AC-022 | Nối liền luồng tìm kiếm sang ứng tuyển | P1 |
| Tìm kiếm bằng từ khóa không có việc làm phù hợp (Zero-result) | AC-022 | Kiểm tra xử lý biên khi không có việc | P2 |
| Tự động phục hồi phiên chat khi mất kết nối | AC-022 | Đảm bảo trải nghiệm liền mạch của người dùng | P3 |
