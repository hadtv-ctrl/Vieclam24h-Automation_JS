# Test case — REQ-001 Đăng ký tài khoản người tìm việc

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-001 | AC-001 | Đăng ký bằng email chưa tồn tại trên desktop | P0 | Có | tests/e2e/desktop/register_by_email-bdd.spec.js |
| TC-002 | AC-001 | Đăng ký bằng email chưa tồn tại trên mobile web | P0 | Có | tests/e2e/mobile-web/register_by_email-bdd.mobile.spec.js |
| TC-003 | AC-002 | Đăng ký bằng số điện thoại kèm OTP trên desktop | P0 | Có | tests/e2e/desktop/register_by_phone-bdd.spec.js |
| TC-004 | AC-002 | Đăng ký bằng số điện thoại kèm OTP trên mobile web | P0 | Có | tests/e2e/mobile-web/register_by_phone-bdd.mobile.spec.js |
| TC-005 | AC-003 | API đăng ký trả về thành công và cấp token | P1 | Có | tests/api/register_api.spec.js |
| TC-006 | AC-004 | API chấp thuận dữ liệu cá nhân bằng token vừa cấp | P2 | Có | tests/api/register_api.spec.js |
| TC-026 | AC-001 | Xác nhận thành công khi bỏ trống số điện thoại (trường tùy chọn theo quyết định) | P2 | candidate | - |
| TC-027 | AC-001 | Kiểm tra thất bại khi mật khẩu có 7 ký tự (dưới biên tối thiểu 8) | P2 | candidate | - |
| TC-028 | AC-001 | Kiểm tra thất bại khi mật khẩu chỉ chứa chữ cái (thiếu chữ số) | P2 | candidate | - |
| TC-029 | AC-001 | Kiểm tra thất bại khi mật khẩu chỉ chứa chữ số (thiếu chữ cái) | P2 | candidate | - |
| TC-030 | AC-001 | Kiểm thử hành vi theo quyết định: Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec | P2 | candidate | - |

## Chi tiết

### TC-001 và TC-002 — Đăng ký bằng email

- **Precondition**: chưa đăng nhập, đang ở trang chủ.
- **Dữ liệu**: email sinh ngẫu nhiên mỗi lần chạy; họ tên và mật khẩu lấy từ `data/users.json`, có giá trị mặc định dự phòng.
- **Các bước**: đóng popup quảng cáo, mở popup Đăng ký/Đăng nhập từ header, chọn phương thức email, nhập email, bấm Tiếp tục, điền họ tên và số điện thoại và mật khẩu, bấm Đăng ký.
- **Expected result thực tế đang kiểm**:
  - Trang chủ hiển thị — Có assertion.
  - Form "Tạo tài khoản mới" xuất hiện sau khi nhập email — Có assertion.
  - Nút Đăng ký hiển thị trước khi bấm — Có assertion.
  - Tài khoản được tạo thành công — **Không kiểm chứng**. Spec kết thúc ngay sau khi bấm Đăng ký.
- **Khoảng trống**: đây là test case P0 nhưng không có điều kiện thoát nào chứng minh kết quả. Test vẫn xanh kể cả khi đăng ký thất bại.
- **Ghi chú độ ổn định**: bản desktop có vòng thử lại tối đa ba lần khi popup đăng nhập không mở được, và ném lỗi tường minh nếu vẫn hỏng. Đây là chỗ đã từng không ổn định.

### TC-003 và TC-004 — Đăng ký bằng số điện thoại

- **Precondition**: chưa đăng nhập, đang ở trang chủ.
- **Dữ liệu**: số điện thoại di động Việt Nam sinh ngẫu nhiên; email sinh ngẫu nhiên; mã OTP cố định của môi trường test là bốn chữ số 1111.
- **Các bước**: đóng popup, mở popup đăng nhập, nhập số điện thoại, bấm Tiếp tục cho tới khi ô OTP hiện, nhập OTP, điền họ tên và email và mật khẩu, bấm Đăng ký, đồng ý popup chấp thuận dữ liệu.
- **Expected result thực tế đang kiểm**:
  - Ô nhập OTP xuất hiện — Có assertion.
  - Form "Tạo tài khoản mới" xuất hiện sau khi nhập OTP — Có assertion.
  - Nội dung trang chủ được tải sau khi đồng ý consent — Có assertion. Đây là bằng chứng gián tiếp cho thấy đăng ký đã thành công.
- **Khác biệt đáng chú ý so với TC-001**: luồng này có bước consent và kết thúc bằng một điều kiện kiểm được, nên chắc chắn hơn luồng email.
- **Ghi chú độ ổn định**: bước bấm Tiếp tục được lặp tối đa ba lần cho tới khi OTP hiện.

### TC-005 — API đăng ký

- **Precondition**: không cần trạng thái trước đó.
- **Dữ liệu**: payload dựng động với email và số di động ngẫu nhiên, mật khẩu cố định, họ tên cố định.
- **Expected result thực tế đang kiểm**:
  - Payload mang đúng email, số di động, mật khẩu đã truyền vào — Có assertion.
  - Phản hồi trả HTTP 200 — Có assertion.
  - Body phản hồi khác rỗng — Có assertion.
  - Token xác thực khác rỗng nếu tồn tại — Có assertion **có điều kiện**: nếu API không trả token thì assertion này bị bỏ qua hoàn toàn.
- **Khoảng trống**: nếu API ngừng trả token, test vẫn xanh còn TC-006 sẽ đỏ ở một chỗ khác — lỗi sẽ hiện ra sai chỗ.
- **Tác dụng phụ**: test này ghi trạng thái người dùng vừa đăng ký ra ngoài phạm vi test để TC-006 dùng lại.

### TC-006 — API chấp thuận dữ liệu cá nhân

- **Precondition**: **bắt buộc chạy sau TC-005 trong cùng một lượt**, vì nó đọc token do TC-005 lưu lại.
- **Expected result thực tế đang kiểm**:
  - Có token từ bước trước — Có assertion, kèm thông báo lỗi giải thích rõ nguyên nhân.
  - Phản hồi trả HTTP 200 và body khác rỗng — Có assertion.
- **Khoảng trống**: hai test dùng chung trạng thái toàn cục nên không chạy song song hay chạy riêng lẻ được. Đây là ràng buộc cần biết trước khi chia lại bộ chạy.

## Ứng viên automation cho REQ-001

Các test case dưới đây **chưa được viết thành tài liệu chính thức**, liệt kê để cân nhắc bổ sung.

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Đăng ký bằng email đã tồn tại | AC-001 | Nhánh negative phổ biến nhất, chạy lại mỗi lần đổi luồng đăng ký | P0 |
| Nhập sai OTP ba lần liên tiếp | AC-002 | Ràng buộc bảo mật, thiệt hại lớn nếu lọt | P0 |
| Mật khẩu không đạt điều kiện | AC-001 | Validation ổn định, rẻ để automation | P1 |
| Email hoặc số điện thoại sai định dạng | AC-001 | Biên rõ ràng, dễ kiểm | P1 |
| Bấm gửi lại OTP | AC-002 | Có đếm thời gian, cần kiểm hồi quy | P2 |
| API đăng ký với email trùng | AC-003 | Rẻ và nhanh hơn kiểm qua giao diện | P1 |
| Từ chối consent sau khi đăng ký | AC-002 | Chưa rõ nghiệp vụ, cần chốt trước khi automation | P2 |


### TC-026 — Xác nhận thành công khi bỏ trống số điện thoại (trường tùy chọn theo quyết định)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang ở màn hình đăng ký / nhập liệu
- **Dữ liệu kiểm thử:** Bỏ trống trường số điện thoại
- > *Ghi chú nghiệp vụ:* Kiểm thử luồng rẽ nhánh từ quyết định Q-1: số điện thoại không bắt buộc.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập đầy đủ các trường thông tin bắt buộc khác | Các trường bắt buộc hợp lệ |
| 2 | Để trống trường số điện thoại và bấm gửi form | Hệ thống xử lý thành công, không báo lỗi thiếu số điện thoại |


### TC-027 — Kiểm tra thất bại khi mật khẩu có 7 ký tự (dưới biên tối thiểu 8)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** mật khẩu: chuỗi 7 ký tự
- > *Ghi chú nghiệp vụ:* Phân tích biên dưới từ quyết định Q-2: yêu cầu tối thiểu 8 ký tự.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập các trường thông tin hợp lệ khác | Không có lỗi trên các trường hợp lệ |
| 2 | Nhập mật khẩu có đúng 7 ký tự | Hệ thống hiển thị thông báo lỗi yêu cầu tối thiểu 8 ký tự |
| 3 | Thử bấm xác nhận / submit | Hệ thống chặn gửi form thành công |


### TC-028 — Kiểm tra thất bại khi mật khẩu chỉ chứa chữ cái (thiếu chữ số)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** mật khẩu: 'Abcdefgh'
- > *Ghi chú nghiệp vụ:* Quy tắc độ phức tạp từ Q-2: bắt buộc chứa cả chữ và số.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mật khẩu chỉ gồm chữ cái hợp lệ nhưng không có số | Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ số |


### TC-029 — Kiểm tra thất bại khi mật khẩu chỉ chứa chữ số (thiếu chữ cái)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** mật khẩu: '12345678'
- > *Ghi chú nghiệp vụ:* Quy tắc độ phức tạp từ Q-2: bắt buộc chứa cả chữ và số.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mật khẩu chỉ gồm chữ số nhưng không có chữ cái | Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ cái |


### TC-030 — Kiểm thử hành vi theo quyết định: Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt
- > *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắt buộc

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắ | Hệ thống phản hồi đúng theo quyết định đã chốt |
