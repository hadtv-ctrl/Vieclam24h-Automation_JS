# Test case — REQ-005 Quản lý hồ sơ cá nhân

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-017 | AC-015 AC-016 AC-017 AC-019 | Hoàn thiện hồ sơ gồm thông tin cá nhân, tiêu chí tìm việc và CV trên desktop | P1 | Có | tests/e2e/desktop/complete_profile_setup-bdd.spec.js |
| TC-018 | AC-015 AC-016 AC-017 AC-019 | Hoàn thiện hồ sơ gồm thông tin cá nhân, tiêu chí tìm việc và CV trên mobile web | P1 | Có | tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js |
| TC-019 | AC-018 | Thêm đủ bảy mục nội dung hồ sơ trên desktop | P2 | Có | tests/e2e/desktop/setting_user_profile-bdd.spec.js |
| TC-020 | AC-018 | Thêm đủ bảy mục nội dung hồ sơ trên mobile web | P2 | Có | tests/e2e/mobile-web/setting_user_profile-bdd.mobile.spec.js |
| TC-021 | AC-019 | Tải lên và chuyển đổi CV tại trang Hồ sơ trên desktop | P1 | Có | tests/e2e/desktop/upload_cv_profile-bdd.spec.js |
| TC-022 | AC-019 | Tải lên và chuyển đổi CV tại trang Hồ sơ trên mobile web | P1 | Có | tests/e2e/mobile-web/upload_cv_profile-bdd.mobile.spec.js |

## Chi tiết

### TC-017 và TC-018 — Hoàn thiện hồ sơ và bật cho phép tìm kiếm

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding.
- **Dữ liệu**: `data/userProfileData.json` phần thông tin cá nhân và tiêu chí tìm việc; file CV tại `data/TemplateCV.pdf`; mã xác minh bốn chữ số cố định của môi trường test.
- **Các bước**: vào trang Hồ sơ của tôi, mở Tiêu chí tìm việc, sửa thông tin cá nhân và lưu, thêm vị trí công việc mới, điền tiêu chí tìm việc và lưu, bật cho phép tìm kiếm hồ sơ, bấm Tiếp tục, nhập mã xác minh, tải lên CV, bấm Cho phép tìm kiếm.
- **Expected result thực tế đang kiểm**:
  - Trang chủ hiển thị ở bước điều kiện đầu — Ẩn trong Page Object.
  - Trạng thái đang tải toàn cục biến mất sau bước cuối — Có chờ tường minh.
  - Thông tin cá nhân, tiêu chí tìm việc, trạng thái công khai hồ sơ có đúng như đã nhập — **Không kiểm chứng**. Không có bước nào đọc lại.
- **Điểm yếu**: test case này chạm tới bốn acceptance criterion cùng lúc nhưng không có assertion nào ở tầng spec. Khi nó đỏ, việc xác định hỏng ở đâu phải làm thủ công qua ảnh chụp.
- **Ghi chú**: đây là test case duy nhất phủ ràng buộc quyền riêng tư tại AC-017.

### TC-019 và TC-020 — Thêm bảy mục nội dung hồ sơ

- **Precondition**: đã đăng nhập, đã đóng modal chặn màn hình.
- **Dữ liệu**: `data/userProfileData.json` cung cấp nội dung cho từng mục.
- **Các bước**: vào trang Hồ sơ của tôi, lần lượt thêm và lưu Kinh nghiệm làm việc, Giới thiệu bản thân, Học vấn, Thành tựu, Kỹ năng, Chứng chỉ, Ngoại ngữ.
- **Expected result thực tế đang kiểm**:
  - Không có assertion nào ở tầng spec. Toàn bộ kịch bản là chuỗi thao tác điền và lưu, kết thúc bằng một ảnh chụp màn hình.
  - Mỗi mục lưu thành công — **Không kiểm chứng**.
- **Đánh giá**: ở trạng thái hiện tại, test case này chỉ chứng minh "các form mở ra và bấm lưu được", không chứng minh dữ liệu vào hồ sơ. Xếp P2 vì giá trị phát hiện lỗi thấp cho tới khi bổ sung bước đọc lại.
- **Trùng lặp cần biết**: bảy mục này cũng được điền trong TC-011 và TC-012 như một phần của luồng ứng tuyển bằng hồ sơ trực tuyến.

### TC-021 và TC-022 — Tải lên và chuyển đổi CV

- **Precondition**: đã đăng nhập, đang ở trang Hồ sơ của tôi.
- **Dữ liệu**: file CV tại `data/TemplateCV.pdf`.
- **Các bước**: bấm tải lên CV và chọn file, xác nhận đính kèm, chờ hệ thống báo chuyển đổi thành công rồi áp dữ liệu vào hồ sơ, chuyển sang Tiêu chí tìm việc.
- **Expected result thực tế đang kiểm**:
  - Việc kiểm tra kết quả chuyển đổi và áp dữ liệu — Ẩn trong Page Object. Đây là bước nghiệp vụ quan trọng nhất của test case nhưng không audit được từ spec.
  - Chuyển sang Tiêu chí tìm việc được — Ẩn trong Page Object.
- **Ghi chú độ ổn định**: thời gian chờ đặt bốn phút vì bước nhận dạng nội dung CV tốn thời gian.

## Ứng viên automation cho REQ-005

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Đọc lại hồ sơ và đối chiếu từng giá trị vừa lưu | AC-015 AC-016 AC-018 | Hiện không test case nào chứng minh dữ liệu được lưu | P0 |
| Nhập sai mã xác minh khi bật cho phép tìm kiếm | AC-017 | Ràng buộc quyền riêng tư, nhánh negative đang trống | P0 |
| Sửa và xóa một mục hồ sơ đã lưu | AC-018 | Toàn bộ chiều sửa và xóa chưa được phủ | P1 |
| Tải lên CV sai định dạng hoặc file hỏng | AC-019 | Validation ổn định, rẻ để automation | P1 |
| Tắt lại cho phép tìm kiếm hồ sơ | AC-017 | Chiều ngược của một ràng buộc quyền riêng tư | P1 |
| Chuyển đổi CV khi hồ sơ đã có dữ liệu | AC-019 | Làm rõ ghi đè hay gộp, rủi ro mất dữ liệu người dùng | P1 |
| Bỏ trống trường bắt buộc trong từng mục hồ sơ | AC-018 | Cần chốt trường bắt buộc trước khi automation | P2 |
