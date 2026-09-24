# Test case — REQ-004 Ứng tuyển việc làm không cần CV

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-013 | AC-012 AC-014 | Thành viên ứng tuyển việc không cần CV trên desktop | P1 | Có | tests/e2e/desktop/apply_job_noCV_flow.spec.js |
| TC-014 | AC-012 AC-014 | Thành viên ứng tuyển việc không cần CV trên mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js |
| TC-015 | AC-013 AC-014 | Khách vãng lai ứng tuyển và tạo tài khoản bằng OTP trên desktop | P0 | Có | tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js |
| TC-016 | AC-013 AC-014 | Khách vãng lai ứng tuyển và tạo tài khoản bằng OTP trên mobile web | P0 | Có | tests/e2e/mobile-web/guest_apply_job_noCV_with_otp.mobile.spec.js |
| TC-038 | AC-013 | Khách vãng lai ứng tuyển với số điện thoại đã có tài khoản | P0 | Có | tests/e2e/desktop/khach-vang-lai-ung-tuyen-sdt-da-ton-tai.spec.js |
| TC-039 | AC-012 | Thành viên đã đăng nhập nhưng số điện thoại chưa xác thực phải thực hiện xác thực OTP khi ứng tuyển | P0 | candidate | - |
| TC-040 | AC-013 | Khách vãng lai từ chối Consent Form sau khi xác thực OTP thành công khi tạo tài khoản ngầm | P1 | candidate | - |
| TC-041 | AC-012 | Kiểm tra lỗi validation khi bỏ trống trường bắt buộc trên popup hồ sơ rút gọn do nhà tuyển dụng cấu hình động | P1 | candidate | - |
| TC-042 | AC-013 | Khách vãng lai nhập số điện thoại đã tồn tại nhưng nhập sai mã OTP đăng nhập | P2 | candidate | - |

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


### TC-039 — Thành viên đã đăng nhập nhưng số điện thoại chưa xác thực phải thực hiện xác thực OTP khi ứng tuyển

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản người dùng đã đăng nhập thành công, số điện thoại trong tài khoản ở trạng thái 'Chưa xác thực'.
- **Dữ liệu kiểm thử:** SĐT: 0987654321 (chưa xác thực), Mã OTP đúng: 123456
> *Ghi chú nghiệp vụ:* Theo quyết định [Q-4]: Thành viên đã đăng nhập nhưng SĐT chưa được xác thực thì vẫn bắt buộc trải qua luồng xác thực OTP khi ứng tuyển hồ sơ rút gọn.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn nút 'Ứng tuyển' tại bài tin tuyển dụng hỗ trợ hồ sơ rút gọn | Mở popup nộp hồ sơ rút gọn điền sẵn thông tin cá nhân của người dùng. |
| 2 | Nhấn nút 'Gửi đơn ứng tuyển' / 'Tiếp tục' | Hệ thống phát hiện SĐT chưa xác thực và hiển thị màn hình yêu cầu nhập mã OTP gửi về SĐT 0987654321. |
| 3 | Nhập mã OTP chính xác (123456) và xác nhận | Hệ thống xác thực thành công SĐT, cập nhật trạng thái SĐT đã xác thực cho tài khoản và gửi đơn ứng tuyển thành công. |


### TC-040 — Khách vãng lai từ chối Consent Form sau khi xác thực OTP thành công khi tạo tài khoản ngầm

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Khách vãng lai chưa đăng nhập hệ thống.
- **Dữ liệu kiểm thử:** SĐT mới: 0912345678, Mã OTP đúng: 123456
> *Ghi chú nghiệp vụ:* Theo quyết định [Q-3]: Tài khoản tạo ngầm qua luồng ứng tuyển bắt buộc user phải đồng ý Consent Form mới hoàn tất ứng tuyển. Cần kiểm thử trường hợp người dùng từ chối consent.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Khách vãng lai nhập đầy đủ thông tin rút gọn với SĐT mới và yêu cầu OTP | Hệ thống gửi OTP thành công và hiển thị ô nhập OTP. |
| 2 | Nhập mã OTP chính xác | Tạo tài khoản ngầm thành công và hiển thị popup Điều khoản đồng ý (Consent Form). |
| 3 | Nhấn nút 'Từ chối' hoặc tắt màn hình Consent Form | Hệ thống không hoàn tất nộp đơn ứng tuyển, hiển thị thông báo yêu cầu đồng ý điều khoản để tiếp tục ứng tuyển. |


### TC-041 — Kiểm tra lỗi validation khi bỏ trống trường bắt buộc trên popup hồ sơ rút gọn do nhà tuyển dụng cấu hình động

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tin tuyển dụng được nhà tuyển dụng cấu hình hiển thị các trường động: Họ tên, Số điện thoại, Email, Kinh nghiệm làm việc.
- **Dữ liệu kiểm thử:** Họ tên: Nguyễn Văn A, SĐT: 0901234567, Email: (để trống), Kinh nghiệm: (để trống)
> *Ghi chú nghiệp vụ:* Theo quyết định [Q-2]: Tất cả các trường hiển thị trong popup apply đều là trường bắt buộc (do cấu hình từ phía người đăng tin).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở popup ứng tuyển hồ sơ rút gọn của tin tuyển dụng có cấu hình các trường động | Popup hiển thị đầy đủ các trường: Họ tên, SĐT, Email, Kinh nghiệm làm việc. |
| 2 | Nhập Họ tên, SĐT và để trống trường Email, Kinh nghiệm, sau đó nhấn 'Nộp ứng tuyển' | Hệ thống chặn không cho gửi đơn, hiển thị thông báo lỗi bắt buộc nhập tại ô Email và Kinh nghiệm. |


### TC-042 — Khách vãng lai nhập số điện thoại đã tồn tại nhưng nhập sai mã OTP đăng nhập

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** SĐT 0909888777 đã có tài khoản tồn tại trên hệ thống. Khách vãng lai chưa đăng nhập.
- **Dữ liệu kiểm thử:** SĐT đã tồn tại: 0909888777, OTP sai: 000000
> *Ghi chú nghiệp vụ:* Theo quyết định [Q-1]: Nếu SĐT đã tồn tại, hệ thống thực hiện đăng nhập cho user sau khi OTP thành công. Kiểm thử ca biên nhập sai OTP.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập SĐT 0909888777 vào form ứng tuyển rút gọn và bấm gửi OTP | Hệ thống nhận diện và gửi mã OTP về số điện thoại đã đăng ký. |
| 2 | Nhập mã OTP sai (000000) và nhấn 'Xác nhận' | Hệ thống hiển thị lỗi mã OTP không hợp lệ, KHÔNG tự động đăng nhập người dùng và KHÔNG gửi đơn ứng tuyển. |
