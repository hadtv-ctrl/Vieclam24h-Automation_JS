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
| TC-047 | AC-001 | Xác nhận thành công khi bỏ trống số điện thoại (trường tùy chọn theo quyết định) | P2 | candidate | - |
| TC-027 | AC-001 | Kiểm tra thất bại khi mật khẩu có 7 ký tự (dưới biên tối thiểu 8) | P2 | Có | tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-co-7-ky-tu-duoi-bien-toi-thie.spec.js |
| TC-028 | AC-001 | Kiểm tra thất bại khi mật khẩu chỉ chứa chữ cái (thiếu chữ số) | P2 | Có | tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-chi-chua-chu-cai-thieu-chu-so.spec.js |
| TC-029 | AC-001 | Kiểm tra thất bại khi mật khẩu chỉ chứa chữ số (thiếu chữ cái) | P2 | Có | tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-chi-chua-chu-so-thieu-chu-cai.spec.js |
| TC-030 | AC-001 | Kiểm thử hành vi theo quyết định: Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec | P2 | Có | tests/e2e/desktop/kiem-thu-hanh-vi-theo-quyet-dinh-so-dien-thoai-o-form-dang-k.spec.js |
| TC-032 | AC-001 | Kiểm tra xử lý khi đăng ký bằng email đã tồn tại | P0 | Có | tests/e2e/desktop/dang-ky-bang-email-da-ton-tai.spec.js |
| TC-033 | AC-002 | Kiểm tra thất bại khi nhập sai mã OTP xác thực | P0 | Có | tests/e2e/desktop/kiem-tra-that-bai-khi-nhap-sai-ma-otp-xac-thuc.spec.js |
| TC-034 | AC-001 | Kiểm tra báo lỗi khi nhập email sai định dạng | P1 | Có | tests/e2e/desktop/kiem-tra-bao-loi-khi-nhap-email-sai-dinh-dang.spec.js |
| TC-039 | AC-002 | Bấm gửi lại mã OTP khi đăng ký bằng số điện thoại | P2 | Có | tests/e2e/desktop/gui-lai-ma-otp-dang-ky.spec.js |
| TC-040 | AC-002 | Đăng ký thành công bằng số điện thoại khi bỏ trống trường Email (trường tùy chọn) | P1 | candidate | - |
| TC-041 | AC-001 | Đăng ký thành công với mật khẩu đạt giá trị biên tối thiểu (Đúng 8 ký tự gồm ít nhất 1 chữ và 1 số) | P1 | candidate | - |
| TC-042 | AC-002 | Kiểm tra xử lý báo lỗi khi đăng ký bằng số điện thoại đã tồn tại | P0 | candidate | - |
| TC-043 | AC-002 | Xác thực OTP thành công bằng mã cố định '1111' trên môi trường Test | P0 | candidate | - |
| TC-044 | AC-002 | Kiểm tra báo lỗi khi nhập số điện thoại sai định dạng | P1 | candidate | - |
| TC-045 | AC-003 | API Đăng ký trả về lỗi 400 Bad Request khi mật khẩu không tuân thủ quy định Q-2 | P1 | candidate | - |

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
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình đăng ký / nhập liệu
- **Dữ liệu kiểm thử:** Bỏ trống trường số điện thoại
- > *Ghi chú nghiệp vụ:* Kiểm thử luồng rẽ nhánh từ quyết định Q-1: số điện thoại không bắt buộc.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập đầy đủ các trường thông tin bắt buộc khác | Các trường bắt buộc hợp lệ |
| 2 | Để trống trường số điện thoại và bấm gửi form | Hệ thống xử lý thành công, không báo lỗi thiếu số điện thoại |


### TC-027 — Kiểm tra thất bại khi mật khẩu có 7 ký tự (dưới biên tối thiểu 8)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
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
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** mật khẩu: 'Abcdefgh'
- > *Ghi chú nghiệp vụ:* Quy tắc độ phức tạp từ Q-2: bắt buộc chứa cả chữ và số.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mật khẩu chỉ gồm chữ cái hợp lệ nhưng không có số | Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ số |


### TC-029 — Kiểm tra thất bại khi mật khẩu chỉ chứa chữ số (thiếu chữ cái)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** mật khẩu: '12345678'
- > *Ghi chú nghiệp vụ:* Quy tắc độ phức tạp từ Q-2: bắt buộc chứa cả chữ và số.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mật khẩu chỉ gồm chữ số nhưng không có chữ cái | Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ cái |


### TC-030 — Kiểm thử hành vi theo quyết định: Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt
- > *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắt buộc

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắ | Hệ thống phản hồi đúng theo quyết định đã chốt |


### TC-032 — Kiểm tra xử lý khi đăng ký bằng email đã tồn tại

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân vùng tương đương / Negative
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập email đăng ký
- **Dữ liệu kiểm thử:** Email đã tồn tại trong hệ thống
- > *Ghi chú nghiệp vụ:* Kiểm thử nhánh negative phổ biến khi người dùng nhập email đã đăng ký.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập email đã tồn tại trong hệ thống và bấm Tiếp tục | Hệ thống nhận diện email đã tồn tại |
| 2 | Kiểm tra màn hình tiếp theo | Hệ thống không mở form tạo tài khoản mới mà chuyển sang đăng nhập hoặc báo email đã tồn tại |


### TC-033 — Kiểm tra thất bại khi nhập sai mã OTP xác thực

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Nhánh lỗi / Ràng buộc bảo mật
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập mã xác thực OTP
- **Dữ liệu kiểm thử:** Mã OTP không chính xác ('9999')
- > *Ghi chú nghiệp vụ:* Ràng buộc bảo mật xác thực OTP khi đăng ký bằng số điện thoại.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mã OTP sai khác mã xác thực chuẩn | Hệ thống hiển thị thông báo lỗi mã xác thực không chính xác |
| 2 | Kiểm tra trạng thái form | Hệ thống chặn người dùng tiến vào form tạo tài khoản |


### TC-034 — Kiểm tra báo lỗi khi nhập email sai định dạng

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Kiểm thử giá trị biên / Validation
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập email đăng ký
- **Dữ liệu kiểm thử:** Chuỗi email không hợp lệ
- > *Ghi chú nghiệp vụ:* Kiểm tra validation format email ở bước đầu luồng đăng ký.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập chuỗi email không đúng định dạng và bấm Tiếp tục | Hệ thống hiển thị thông báo lỗi định dạng email |
| 2 | Kiểm tra trạng thái điều hướng | Hệ thống chặn tiếp tục sang bước tạo tài khoản |


### TC-039 — Bấm gửi lại mã OTP khi đăng ký bằng số điện thoại

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Luồng xử lý sự cố / Countdown
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập mã xác thực OTP sau khi nhập số điện thoại đăng ký
- **Dữ liệu kiểm thử:** Số điện thoại hợp lệ chưa từng đăng ký
- > *Ghi chú nghiệp vụ:* Đảm bảo tính khả dụng khi người dùng không nhận được SMS lần đầu, có thể yêu cầu gửi lại OTP.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số điện thoại đăng ký và bấm Tiếp tục đến màn hình OTP | Màn hình xác thực OTP hiển thị trường nhập mã và nút gửi lại mã / đếm ngược thời gian |
| 2 | Kiểm tra nút hoặc bộ đếm gửi lại OTP và bấm gửi lại (nếu sẵn sàng) | Hệ thống tiếp tục giữ trạng thái chờ OTP và kích hoạt chu kỳ gửi lại mã xác thực mới |



### TC-040 — Đăng ký thành công bằng số điện thoại khi bỏ trống trường Email (trường tùy chọn)

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Số điện thoại chưa tồn tại trong hệ thống. Đang ở giao diện Đăng ký bằng số điện thoại.
- **Dữ liệu kiểm thử:** Phone: 0912345678, Email: [Bỏ trống], Password: Password123, OTP: 1111
> *Ghi chú nghiệp vụ:* Theo Q-1 vừa chốt: Khi đăng ký bằng số điện thoại thì Email là trường không bắt buộc. Cần kiểm tra luồng hoàn tất thành công mà không nhập email.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số điện thoại hợp lệ và mật khẩu hợp lệ (đủ 8 ký tự, có chữ và số), để trống ô Email. | Hệ thống chấp nhận thông tin và chuyển sang màn hình nhập mã OTP. |
| 2 | Nhập mã OTP '1111' và xác nhận. | Đăng ký tài khoản thành công, người dùng được đăng nhập vào hệ thống. |


### TC-041 — Đăng ký thành công với mật khẩu đạt giá trị biên tối thiểu (Đúng 8 ký tự gồm ít nhất 1 chữ và 1 số)

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Email chưa tồn tại trong hệ thống.
- **Dữ liệu kiểm thử:** Email: user_bva8@example.com, Password: 'a1234567' (đúng 8 ký tự, 1 chữ 'a', 7 số)
> *Ghi chú nghiệp vụ:* Phân tích giá trị biên (BVA) cho Q-2: Mật khẩu tối thiểu 8 ký tự (chứa 1 chữ + 1 số). TC-027 đã test 7 ký tự (fail), cần test biên 8 ký tự (pass).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập email chưa tồn tại và mật khẩu 'a1234567'. | Hệ thống không báo lỗi validate mật khẩu. |
| 2 | Nhấn nút 'Đăng ký'. | Đăng ký tài khoản thành công và nhận token xác thực. |


### TC-042 — Kiểm tra xử lý báo lỗi khi đăng ký bằng số điện thoại đã tồn tại

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Số điện thoại '0988888888' đã được tạo tài khoản trước đó.
- **Dữ liệu kiểm thử:** Phone: 0988888888, Password: Password123
> *Ghi chú nghiệp vụ:* Đảm bảo tính duy nhất của số điện thoại trên hệ thống (Negative test cho AC-002, tương tự TC-032 cho email).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số điện thoại '0988888888' và mật khẩu hợp lệ. | Hệ thống hiển thị thông báo lỗi 'Số điện thoại đã được đăng ký' (hoặc tương đương) và không chuyển sang bước OTP. |


### TC-043 — Xác thực OTP thành công bằng mã cố định '1111' trên môi trường Test

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Đã nhập số điện thoại chưa tồn tại và đang ở màn hình nhập mã OTP.
- **Dữ liệu kiểm thử:** OTP: 1111
> *Ghi chú nghiệp vụ:* Theo Q-4 vừa chốt: Mã '1111' là mã OTP cố định dùng cho xác thực đăng ký/đăng nhập bằng số điện thoại trên môi trường test.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập mã OTP '1111' vào các ô nhập liệu OTP. | Hệ thống chấp nhận mã OTP, hoàn tất đăng ký và cấp token. |


### TC-044 — Kiểm tra báo lỗi khi nhập số điện thoại sai định dạng

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Đang ở giao diện Đăng ký bằng số điện thoại.
- **Dữ liệu kiểm thử:** Phone: '0912abcXYZ' hoặc '123'
> *Ghi chú nghiệp vụ:* Negative test validate định dạng số điện thoại (chứa ký tự chữ, quá ngắn hoặc chứa ký tự đặc biệt).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số điện thoại sai định dạng '0912abcXYZ'. | Hiển thị thông báo lỗi 'Số điện thoại không hợp lệ' dưới ô nhập liệu và vô hiệu hóa nút Đăng ký. |


### TC-045 — API Đăng ký trả về lỗi 400 Bad Request khi mật khẩu không tuân thủ quy định Q-2

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** API Đăng ký sẵn sàng nhận request.
- **Dữ liệu kiểm thử:** Payload: { email: 'api_test@example.com', password: 'onlyletters' }
> *Ghi chú nghiệp vụ:* Validate phía Backend/API cho quy tắc mật khẩu theo Q-2 (tối thiểu 8 ký tự, có chữ và số).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Gửi request POST tới endpoint đăng ký với mật khẩu chỉ có chữ 'onlyletters'. | API trả về HTTP Status Code 400 Bad Request kèm thông điệp lỗi quy định mật khẩu không hợp lệ. |
