# Test case — REQ-008 Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-095 | AC-023 AC-024 AC-025 AC-026 | Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý | P1 | Có | tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js |
| TC-096 | AC-023 | Kiểm thử hành vi theo quyết định: Số điện thoại nhập ở luồng này nếu đã có tài khoản thì hiển thị màn hì | P2 | candidate | - |
| TC-097 | AC-023 | Kiểm tra thất bại khi trường dữ liệu có 6 ký tự (vượt biên tối đa 5) | P2 | candidate | - |


## Chi tiết

### TC-095 — Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý

- **Loại:** Chức năng / Tích hợp E2E | **Ưu tiên:** P1 | **Kỹ thuật:** Kịch bản luồng thao tác người dùng (User Journey Flow)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js`
- **Tiền điều kiện:** Khách vãng lai truy cập màn hình trang chủ Việc Làm 24h (Chưa đăng nhập).
- **Dữ liệu kiểm thử:** `data/personalizeJobData.json` (Số điện thoại mới ngẫu nhiên hoặc tài khoản kiểm thử, OTP `1111`, Họ tên `Hà Đinh`, Ngành nghề: `nhân viên bán hàng`, Khu vực: `TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang`, Mức lương: `10 - 15 triệu`, Kinh nghiệm: `3 năm`, Ngành: `Hành chính - Thư ký`).
> *Ghi chú nghiệp vụ:* Kịch bản kiểm thử luồng người dùng tiếp cận khối gợi ý việc làm riêng ("+10 việc làm có lương hấp dẫn"), tiến hành đăng ký/xác thực tài khoản qua OTP, hoàn tất 3 bước khảo sát tiêu chí tìm việc, tinh chỉnh thêm kinh nghiệm/ngành nghề và truy cập danh sách việc làm phù hợp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trang chủ, đóng popup/banner quảng cáo nếu có | Trang chủ sẵn sàng hiển thị khối "Việc làm dành riêng cho bạn" |
| 2 | Nhấn link "+10 việc làm có lương hấp dẫn" và nhập SĐT + OTP + Họ tên | Xác thực tài khoản thành công, chấp thuận điều khoản và mở màn hình thiết lập tiêu chí |
| 3 | Chọn công việc mong muốn (nhân viên bán hàng), tối đa 5 khu vực (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang), mức lương mong muốn (10 - 15 triệu) | Hoàn tất thiết lập tiêu chí ban đầu, hệ thống hiển thị trang "Tiêu chí tìm việc của tôi" |
| 4 | Chuyển tab Lương cao nhất/Mới nhất, nhấn Chỉnh sửa để cập nhật kinh nghiệm 3 năm và ngành nghề Hành chính - Thư ký | Tiêu chí bổ sung được lưu thành công |
| 5 | Điều hướng đến menu Việc làm -> Tìm việc làm và nhấn "Xem tất cả" tại phần việc làm dành riêng | Danh sách việc làm phù hợp hiển thị đầy đủ, cho phép mở xem chi tiết việc làm |


### TC-096 — Kiểm thử hành vi theo quyết định: Số điện thoại nhập ở luồng này nếu đã có tài khoản thì hiển thị màn hì

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt
> *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: đúng

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: đúng | Hệ thống phản hồi đúng theo quyết định đã chốt |


### TC-097 — Kiểm tra thất bại khi trường dữ liệu có 6 ký tự (vượt biên tối đa 5)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** trường dữ liệu: chuỗi 6 ký tự
> *Ghi chú nghiệp vụ:* Phân tích biên trên từ quyết định Q-2: giới hạn tối đa 5 ký tự.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập các trường thông tin hợp lệ | Không có cảnh báo lỗi |
| 2 | Nhập trường dữ liệu có 6 ký tự | Hệ thống báo lỗi hoặc giới hạn không cho nhập quá 5 ký tự |
