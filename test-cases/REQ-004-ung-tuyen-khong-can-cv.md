# Test case — REQ-004 Ứng tuyển việc làm không cần CV

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-013 | AC-012 AC-014 | Thành viên ứng tuyển việc không cần CV trên desktop | P1 | Có | tests/e2e/desktop/apply_job_noCV_flow.spec.js |
| TC-014 | AC-012 AC-014 | Thành viên ứng tuyển việc không cần CV trên mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js |
| TC-015 | AC-013 AC-014 | Khách vãng lai ứng tuyển và tạo tài khoản bằng OTP trên desktop | P0 | Có | tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js |
| TC-016 | AC-013 AC-014 | Khách vãng lai ứng tuyển và tạo tài khoản bằng OTP trên mobile web | P0 | Có | tests/e2e/mobile-web/guest_apply_job_noCV_with_otp.mobile.spec.js |
| TC-038 | AC-013 | Khách vãng lai ứng tuyển với số điện thoại đã có tài khoản | P0 | Có | tests/e2e/desktop/khach-vang-lai-ung-tuyen-sdt-da-ton-tai.spec.js |

## Chi tiết

### TC-013 và TC-014 — Thành viên ứng tuyển việc không cần CV

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding và modal chặn màn hình.
- **Dữ liệu**: `data/applyJobData.json` phần hồ sơ rút gọn cho việc thứ nhất và việc thứ hai; mã OTP từ `data/users.json`.
- **Các bước**: mở danh sách việc không cần CV từ trang chủ, chờ danh sách hiện, mở chi tiết việc đầu tiên ở tab mới, bắt đầu ứng tuyển kèm OTP nếu được hỏi, điền hồ sơ rút gọn, nộp, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ hiển thị ở bước điều kiện đầu — Ẩn trong Page Object.
  - Danh sách việc làm hiện trước khi bấm — Có chờ tường minh.
  - Danh sách đã ứng tuyển hiển thị ở bước cuối — Ẩn trong Page Object.
  - Hồ sơ nộp thành công — **Không kiểm chứng**.
- **Điểm yếu**: bước nộp hàng loạt bọc trong điều kiện "nếu có xảy ra thì chụp ảnh". Nếu gợi ý nộp hàng loạt biến mất, test vẫn xanh.

### TC-015 và TC-016 — Khách vãng lai ứng tuyển bằng OTP

- **Precondition**: **chưa đăng nhập**. Đây là điểm khác biệt cốt lõi so với TC-013.
- **Dữ liệu**: hồ sơ rút gọn dành cho khách vãng lai từ `data/applyJobData.json`, cộng thêm một số điện thoại di động Việt Nam sinh ngẫu nhiên mỗi lần chạy; mã OTP từ `data/users.json`.
- **Các bước**: vào trang chủ, đóng onboarding và quảng cáo, mở việc không cần CV, mở chi tiết việc đầu tiên, bắt đầu ứng tuyển với vai khách, điền thông tin liên hệ, điền hồ sơ rút gọn, nộp, nhập OTP xác minh số điện thoại, đồng ý chấp thuận dữ liệu cá nhân, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ hiển thị — Ẩn trong Page Object.
  - Danh sách việc không cần CV hiện — Có chờ tường minh.
  - Bước nhập OTP và bước đồng ý consent **bắt buộc xảy ra**, không có nhánh bỏ qua — đây là điểm chặt chẽ hơn hẳn TC-013.
  - Danh sách đã ứng tuyển hiển thị — Ẩn trong Page Object.
  - Tài khoản mới thực sự được tạo — **Không kiểm chứng**. Không có bước nào xác nhận người dùng đã ở trạng thái đăng nhập bằng số điện thoại vừa nhập.
- **Giá trị nghiệp vụ**: đây là luồng chuyển đổi khách vãng lai thành người dùng có tài khoản, nên xếp P0 dù kỹ thuật phức tạp.

### TC-038 — Khách vãng lai ứng tuyển với số điện thoại đã có tài khoản

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân vùng tương đương / Rủi ro tài khoản
- **Automation:** Có
- **Tiền điều kiện:** Người dùng chưa đăng nhập, đang ở màn hình ứng tuyển việc làm không cần CV
- **Dữ liệu kiểm thử:** Số điện thoại đã được đăng ký tài khoản trước đó trong hệ thống
- > *Ghi chú nghiệp vụ:* Tránh việc vô tình tạo tài khoản trùng hoặc ghi đè thông tin tài khoản người dùng cũ khi khách ứng tuyển.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở form ứng tuyển việc làm không cần CV | Form ứng tuyển hiển thị trường nhập họ tên và số điện thoại |
| 2 | Nhập số điện thoại đã có tài khoản và nộp thông tin | Hệ thống nhận diện số điện thoại đã có tài khoản, yêu cầu đăng nhập hoặc hiển thị cảnh báo tài khoản tồn tại |

## Ứng viên automation cho REQ-004

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Khách vãng lai nhập số điện thoại đã có tài khoản | AC-013 | Nhánh rủi ro cao nhất đang hoàn toàn trống, chạm tới dữ liệu người dùng thật | P0 |
| Nhập sai OTP ở luồng khách vãng lai | AC-013 | Quyết định hồ sơ đang điền dở có mất không | P0 |
| Xác nhận tài khoản mới được tạo sau khi ứng tuyển | AC-013 | Biến "OTP qua được" thành "tài khoản có thật" | P0 |
| Bỏ trống trường bắt buộc của hồ sơ rút gọn | AC-012 | Validation ổn định, rẻ để automation | P1 |
| Khách vãng lai từ chối consent | AC-013 | Ràng buộc pháp lý, cần chốt nghiệp vụ trước | P1 |
| Bỏ dở luồng rồi quay lại | AC-012 | Khó ổn định khi automation, cân nhắc kiểm thủ công | P3 |
