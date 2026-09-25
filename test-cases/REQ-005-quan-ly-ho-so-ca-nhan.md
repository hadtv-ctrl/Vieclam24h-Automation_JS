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
| TC-023 | AC-017 | Xác minh OTP qua Email khi bật tìm kiếm hồ sơ đối với tài khoản chưa xác thực Email | P0 | candidate | - |
| TC-024 | AC-017 | Xác minh OTP qua SĐT với mã mặc định 1111 trên môi trường QC/STG khi bật tìm kiếm hồ sơ | P0 | candidate | - |
| TC-025 | AC-016 | Kiểm tra tính đồng bộ hai chiều của tiêu chí tìm việc giữa trang Hồ sơ và Onboarding (REQ-002) | P1 | candidate | - |
| TC-026 | AC-019 | Chuyển đổi CV khi hồ sơ đã có sẵn dữ liệu: Ghi đè trường đã có và thêm mới trường chưa có | P1 | candidate | - |
| TC-027 | AC-015 | Xác nhận hồ sơ hoàn thiện khi CHỈ điền duy nhất mục bắt buộc 'Thông tin cá nhân' | P0 | candidate | - |
| TC-028 | AC-015 | Kiểm tra hồ sơ CHƯA hoàn thiện khi điền 6 mục khác nhưng bỏ trống mục 'Thông tin cá nhân' | P1 | candidate | - |

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


### TC-023 — Xác minh OTP qua Email khi bật tìm kiếm hồ sơ đối với tài khoản chưa xác thực Email

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản người dùng ở môi trường QC/STG đã xác thực SĐT nhưng chưa xác thực Email. Hồ sơ đã hoàn thiện.
- **Dữ liệu kiểm thử:** Email chưa xác thực, OTP động gửi về Email
> *Ghi chú nghiệp vụ:* Theo quyết định Q-1, tài khoản chưa xác thực Email sẽ nhận OTP qua Email và mã này không được mặc định là 1111 trên môi trường QC/STG.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thao tác bật công tắc 'Cho phép tìm kiếm hồ sơ' tại trang Hồ sơ. | Hệ thống hiển thị popup yêu cầu nhập mã xác minh OTP, thông báo OTP đã được gửi đến Email của người dùng. |
| 2 | Nhập mã OTP thử nghiệm là '1111' và bấm Xác nhận. | Hệ thống thông báo mã OTP không chính xác. |
| 3 | Kiểm tra hòm thư Email, lấy mã OTP thực tế vừa nhận và nhập vào ô xác minh. | Xác minh thành công, công tắc 'Cho phép tìm kiếm hồ sơ' được chuyển sang trạng thái Bật. |


### TC-024 — Xác minh OTP qua SĐT với mã mặc định 1111 trên môi trường QC/STG khi bật tìm kiếm hồ sơ

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản người dùng ở môi trường QC/STG đã xác thực Email nhưng chưa xác thực SĐT. Hồ sơ đã hoàn thiện.
- **Dữ liệu kiểm thử:** SĐT chưa xác thực, OTP mặc định = '1111'
> *Ghi chú nghiệp vụ:* Theo quyết định Q-1, tài khoản chưa xác thực SĐT thì OTP gửi về SĐT sẽ có giá trị mặc định là 1111 trên môi trường QC/STG.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thao tác bật công tắc 'Cho phép tìm kiếm hồ sơ'. | Popup nhập OTP hiển thị, thông báo OTP đã được gửi tới Số điện thoại. |
| 2 | Nhập mã OTP là '1111' và nhấn Xác nhận. | Hệ thống chấp nhận mã OTP '1111', xác minh thành công và kích hoạt trạng thái tìm kiếm hồ sơ. |


### TC-025 — Kiểm tra tính đồng bộ hai chiều của tiêu chí tìm việc giữa trang Hồ sơ và Onboarding (REQ-002)

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã hoàn thành Onboarding với Tiêu chí tìm việc A (Địa điểm: Hà Nội, Ngành nghề: IT).
- **Dữ liệu kiểm thử:** Tiêu chí tìm việc mới B (Địa điểm: TP.HCM, Ngành nghề: Marketing, Mức lương: 20 triệu)
> *Ghi chú nghiệp vụ:* Theo quyết định Q-2, tiêu chí tìm việc tại Hồ sơ và tiêu chí khai báo ở luồng Onboarding phải đồng bộ dữ liệu với nhau.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập mục 'Tiêu chí tìm việc' tại trang Hồ sơ và thay đổi thông tin thành Tiêu chí B, sau đó nhấn Lưu. | Hệ thống lưu thành công Tiêu chí B trên trang Hồ sơ. |
| 2 | Kiểm tra lại dữ liệu tiêu chí tìm việc trên các màn hình liên quan đến luồng Onboarding/Gợi ý việc làm. | Dữ liệu tiêu chí tìm việc tại Onboarding được cập nhật đồng nhất thành Tiêu chí B. |


### TC-026 — Chuyển đổi CV khi hồ sơ đã có sẵn dữ liệu: Ghi đè trường đã có và thêm mới trường chưa có

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Hồ sơ hiện tại đã có mục Kỹ năng ('Java') và chưa có mục Kinh nghiệm làm việc.
- **Dữ liệu kiểm thử:** File CV chứa thông tin: Kỹ năng ('Python, React') và Kinh nghiệm ('Công ty X - 2 năm')
> *Ghi chú nghiệp vụ:* Theo quyết định Q-3, khi chuyển đổi CV dữ liệu sẽ gộp ở cấp độ trường (nếu trường đã có data thì ghi đè, nếu chưa có thì thêm mới).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tải lên file CV mới tại trang Hồ sơ và chọn thực hiện 'Chuyển đổi CV thành dữ liệu hồ sơ'. | Hệ thống xử lý chuyển đổi và hiển thị thông báo thành công. |
| 2 | Kiểm tra mục Kỹ năng trong hồ sơ. | Mục Kỹ năng bị ghi đè hoàn toàn thành 'Python, React' (không còn 'Java'). |
| 3 | Kiểm tra mục Kinh nghiệm làm việc trong hồ sơ. | Mục Kinh nghiệm làm việc được thêm mới với thông tin 'Công ty X - 2 năm'. |


### TC-027 — Xác nhận hồ sơ hoàn thiện khi CHỈ điền duy nhất mục bắt buộc 'Thông tin cá nhân'

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản mới tạo, cả 7 mục nội dung hồ sơ đều đang trống.
- **Dữ liệu kiểm thử:** Thông tin cá nhân đầy đủ: Họ tên, Ngày sinh, Giới tính, Địa chỉ, Email, SĐT
> *Ghi chú nghiệp vụ:* Theo quyết định Q-4, trong 7 mục nội dung hồ sơ thì chỉ có 'Thông tin cá nhân' là mục duy nhất bắt buộc để hồ sơ được xem là hoàn thiện.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập và lưu đầy đủ thông tin tại mục 'Thông tin cá nhân', để trống 6 mục còn lại. | Hệ thống lưu thành công mục Thông tin cá nhân. |
| 2 | Kiểm tra trạng thái hoàn thiện của hồ sơ và khả năng bật tìm kiếm hồ sơ. | Trạng thái hồ sơ được công nhận là 'Hoàn thiện', người dùng có thể thực hiện bật tính năng tìm kiếm hồ sơ. |


### TC-028 — Kiểm tra hồ sơ CHƯA hoàn thiện khi điền 6 mục khác nhưng bỏ trống mục 'Thông tin cá nhân'

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản mới, hồ sơ trống.
- **Dữ liệu kiểm thử:** Dữ liệu cho 6 mục: Học vấn, Kinh nghiệm, Kỹ năng, Ngoại ngữ, Dự án, Chứng chỉ. Bỏ trống Thông tin cá nhân.
> *Ghi chú nghiệp vụ:* Negative test case dựa trên Q-4 nhằm đảm bảo nếu thiếu mục bắt buộc 'Thông tin cá nhân' thì hồ sơ không thể đạt trạng thái hoàn thiện dù đã điền các mục khác.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Điền đầy đủ thông tin cho 6 mục (Học vấn, Kinh nghiệm, Kỹ năng, Ngoại ngữ, Dự án, Chứng chỉ) và bỏ trống mục Thông tin cá nhân. | Hệ thống lưu dữ liệu các mục đã nhập. |
| 2 | Kiểm tra trạng thái hồ sơ và thử bật công tắc 'Cho phép tìm kiếm hồ sơ'. | Hồ sơ hiển thị trạng thái 'Chưa hoàn thiện'. Công tắc tìm kiếm hồ sơ bị khóa hoặc cảnh báo yêu cầu bổ sung 'Thông tin cá nhân'. |
