# Test case — REQ-002 Onboarding tiêu chí tìm việc

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-007 | AC-005 AC-006 AC-007 | Hoàn tất năm bước onboarding trên desktop | P1 | Có | tests/e2e/desktop/onboarding-bdd.spec.js |
| TC-008 | AC-005 AC-006 AC-007 | Hoàn tất năm bước onboarding trên mobile web | P1 | Có | tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js |

## Chi tiết

### TC-007 và TC-008 — Hoàn tất onboarding

- **Precondition**: người dùng đã đăng nhập qua fixture xác thực và modal onboarding đang mở ở bước 1.
- **Dữ liệu**: `data/onboardingData.json` gồm khu vực (nút và tùy chọn), ngành nghề, công việc mong muốn, mức lương, số năm kinh nghiệm.
- **Các bước**: chọn khu vực, chọn ngành nghề, nhập công việc mong muốn rồi chọn từ danh sách gợi ý, chọn mức lương, chọn số năm kinh nghiệm, bấm hoàn tất.
- **Expected result thực tế đang kiểm**:
  - Ô chọn khu vực hiển thị ở bước 1 — Có assertion.
  - Dropdown ngành nghề hiển thị ở bước 2 — Có assertion.
  - Ô nhập công việc mong muốn hiển thị ở bước 3 — Có assertion.
  - Danh sách gợi ý công việc hiện ra rồi ẩn đi sau khi chọn — Có assertion cả hai chiều.
  - Tiêu đề bước 5 hiển thị — Có assertion.
  - Nút hoàn tất hiển thị trước khi bấm — Có assertion.
  - Modal đóng lại sau khi hoàn tất — Có assertion.
  - Tiêu chí vừa khai được lưu lại — **Không kiểm chứng**. Không có bước nào mở lại hồ sơ để đối chiếu.
- **Điểm yếu nghiêm trọng của test case này**: bước 4 và bước 5 đều có nhánh "nếu tiêu đề bước không hiển thị thì kết thúc bước và đi tiếp". Nghĩa là nếu modal tự đóng sau bước 3, test **vẫn xanh** dù hai bước cuối chưa bao giờ chạy. Cần làm rõ nghiệp vụ ở REQ-002 rồi siết lại nhánh này.
- **Ghi chú độ ổn định**: thời gian chờ đặt tới bốn phút cho cả kịch bản, dài hơn mọi luồng khác cùng độ phức tạp.

## Ứng viên automation cho REQ-002

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Đối chiếu tiêu chí đã khai tại trang Hồ sơ sau khi hoàn tất | AC-007 | Biến onboarding từ "bấm được" thành "lưu đúng" | P0 |
| Đóng modal giữa chừng rồi đăng nhập lại | AC-005 | Quyết định dữ liệu dở dang có mất không, rủi ro dữ liệu | P1 |
| Bỏ trống một bước rồi bấm Tiếp tục | AC-006 | Xác định bước nào bắt buộc, hiện chưa ai biết | P1 |
| Quay lại bước trước và sửa lựa chọn | AC-006 | Luồng điều hướng ngược hoàn toàn chưa được phủ | P2 |
| Chọn nhiều ngành nghề cùng lúc | AC-006 | Giá trị biên của dữ liệu đầu vào | P2 |
