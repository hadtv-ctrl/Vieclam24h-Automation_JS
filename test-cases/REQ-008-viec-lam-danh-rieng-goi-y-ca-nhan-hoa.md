# Test case — REQ-008 Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-095 | AC-023 AC-024 AC-025 AC-026 | Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý | P1 | Có | tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js |
| TC-096 | AC-023 | Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu | P2 | Có | tests/e2e/desktop/personalize-sdt-da-ton-tai.spec.js |
| TC-097 | AC-023 | Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5 | P2 | Có | tests/e2e/desktop/personalize-kiem-tra-bien-toi-da.spec.js |
| TC-098 | AC-024 | Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc | P2 | Có | tests/e2e/desktop/personalize-bypass-onboarding-mini.spec.js |
| TC-099 | AC-024 | Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home | P2 | Có | tests/e2e/desktop/personalize-autofill-onboarding-home.spec.js |


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


### TC-096 — Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-sdt-da-ton-tai.spec.js`
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản (Khách vãng lai nhập số điện thoại đã tồn tại ở luồng việc làm dành riêng)
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt (SĐT đã có tài khoản, ví dụ: 0987654321)
> *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: đúng (Hiển thị màn hình nhập mật khẩu thay vì OTP tạo mới).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: đúng | Hệ thống phản hồi đúng theo quyết định đã chốt |


### TC-097 — Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-kiem-tra-bien-toi-da.spec.js`
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** trường dữ liệu: chuỗi 6 ký tự (hoặc vượt quá giới hạn 5)
> *Ghi chú nghiệp vụ:* Phân tích biên trên từ quyết định Q-2: giới hạn tối đa 5 ký tự / 5 mục lựa chọn.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập các trường thông tin hợp lệ | Không có cảnh báo lỗi |
| 2 | Nhập trường dữ liệu có 6 ký tự | Hệ thống báo lỗi hoặc giới hạn không cho nhập quá 5 ký tự |


### TC-098 — Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân nhánh nghiệp vụ / Kiểm thử trạng thái
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-bypass-onboarding-mini.spec.js`
- **Tiền điều kiện:** Người dùng đã có sẵn ít nhất 1 trong 3 thông tin tiêu chí (nơi làm việc, vị trí, hoặc mức lương).
- **Dữ liệu kiểm thử:** Tài khoản kiểm thử đã lưu tiêu chí trước đó.
> *Ghi chú nghiệp vụ:* Nếu tài khoản đã có tiêu chí, hệ thống không mở Onboarding mini mà chuyển thẳng đến trang "Tiêu chí tìm việc của tôi".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trang chủ và bấm điểm chạm việc làm dành riêng | Mở modal đăng ký/đăng nhập hoặc chuyển hướng luồng cá nhân hóa |
| 2 | Đăng nhập tài khoản đã có sẵn thông tin tiêu chí | Hệ thống nhận diện tiêu chí đã có và không hiển thị modal Onboarding mini 3 bước |
| 3 | Kiểm tra màn hình đích | Trang "Tiêu chí tìm việc của tôi" và danh sách việc làm gợi ý hiển thị thành công |


### TC-099 — Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home

- **Loại:** Chức năng / Tích hợp chéo REQ-008 & REQ-002 | **Ưu tiên:** P2 | **Kỹ thuật:** Luồng tích hợp dữ liệu chéo (Cross-feature Data Sync)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-autofill-onboarding-home.spec.js`
- **Tiền điều kiện:** Người dùng thiết lập tiêu chí qua Onboarding mini (Vị trí, Khu vực, Mức lương).
- **Dữ liệu kiểm thử:** Vị trí `nhân viên bán hàng`, Khu vực `TP.HCM`, Mức lương `10 - 15 triệu`.
> *Ghi chú nghiệp vụ:* Dữ liệu lưu từ Onboarding mini tự động điền sẵn (autofill) vào các bước tương ứng tại Onboarding màn hình Home (REQ-002).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Hoàn tất thiết lập tiêu chí qua Onboarding mini | Tiêu chí được lưu thành công vào hồ sơ |
| 2 | Điều hướng về màn hình Trang chủ (Home) | Trang chủ hiển thị hoặc mở Onboarding Home |
| 3 | Kiểm tra các trường thông tin tại Onboarding Home | Các giá trị Khu vực, Vị trí, Mức lương được autofill chính xác theo dữ liệu đã chọn từ Onboarding mini |
