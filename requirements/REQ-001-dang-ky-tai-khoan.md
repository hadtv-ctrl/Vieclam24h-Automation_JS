# REQ-001 — Đăng ký tài khoản người tìm việc

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-001 |
| Phiên bản | 1.0 |
| Vai trò | Khách vãng lai (chưa đăng nhập) |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Người tìm việc tạo tài khoản mới trên Vieclam24h bằng một trong hai định danh: email hoặc số điện
thoại. Cùng một luồng đăng ký được kiểm trên cả desktop và mobile web, và có một đường API riêng
phục vụ việc dựng sẵn tài khoản cho các kịch bản khác.

Sau khi tạo tài khoản, hệ thống yêu cầu người dùng chấp thuận điều khoản xử lý dữ liệu cá nhân
(consent) trước khi vào được nội dung trang chủ.

## Acceptance criteria

### AC-001 — Đăng ký bằng email chưa tồn tại

**Given** tôi là khách vãng lai đang ở trang chủ và đã đóng các popup quảng cáo
**When** tôi mở popup Đăng ký/Đăng nhập, chọn phương thức email, nhập một email chưa tồn tại và bấm Tiếp tục
**Then** form "Tạo tài khoản mới" phải xuất hiện
**And** khi tôi điền họ tên, số điện thoại, mật khẩu và bấm Đăng ký thì tài khoản được tạo

- Trạng thái: Inferred — spec dừng ở bước bấm Đăng ký, không có assertion nào xác nhận tài khoản đã tạo thành công.
- Ràng buộc quan sát được: email phải là email chưa tồn tại (spec sinh email ngẫu nhiên mỗi lần chạy).
- Trường bắt buộc quan sát được: họ tên, mật khẩu. Số điện thoại chỉ điền khi ô đó hiển thị — nghĩa là **có thể** là tùy chọn.
- Nguồn: tests/e2e/desktop/register_by_email-bdd.spec.js, tests/e2e/mobile-web/register_by_email-bdd.mobile.spec.js

### AC-002 — Đăng ký bằng số điện thoại chưa tồn tại, xác minh bằng OTP

**Given** tôi là khách vãng lai đang ở trang chủ
**When** tôi mở popup Đăng ký/Đăng nhập, nhập một số điện thoại chưa tồn tại và bấm Tiếp tục
**Then** màn hình nhập mã OTP phải xuất hiện
**And** khi tôi nhập đúng OTP thì form "Tạo tài khoản mới" xuất hiện
**And** khi tôi điền họ tên, email, mật khẩu và bấm Đăng ký thì tài khoản được tạo
**And** popup chấp thuận dữ liệu cá nhân xuất hiện; sau khi tôi đồng ý thì nội dung trang chủ được tải

- Trạng thái: Inferred cho phần tạo tài khoản; Confirmed cho phần OTP và consent (có chờ hiển thị tường minh).
- Ràng buộc quan sát được: số điện thoại theo định dạng di động Việt Nam.
- Khác biệt so với AC-001: luồng số điện thoại có thêm bước OTP và bước consent; luồng email trong spec hiện tại không có hai bước này.
- Nguồn: tests/e2e/desktop/register_by_phone-bdd.spec.js, tests/e2e/mobile-web/register_by_phone-bdd.mobile.spec.js

### AC-003 — API đăng ký trả về thành công và cấp token

**Given** tôi gửi payload đăng ký hợp lệ gồm email, số di động, mật khẩu và họ tên
**When** tôi gọi POST tới endpoint đăng ký của người tìm việc
**Then** hệ thống phải trả HTTP 200 kèm body khác rỗng
**And** token xác thực trong phản hồi (nếu có) phải khác rỗng và được lưu lại cho các bước sau

- Trạng thái: Confirmed — có assertion trên status code và body.
- Nguồn: tests/api/register_api.spec.js

### AC-004 — API chấp thuận dữ liệu cá nhân bằng token vừa cấp

**Given** tôi đã đăng ký thành công qua API và có token xác thực
**When** tôi gọi POST tới endpoint chấp thuận dữ liệu cá nhân kèm token đó
**Then** hệ thống phải trả HTTP 200 kèm body khác rỗng

- Trạng thái: Confirmed — có assertion trên status code và body.
- Phụ thuộc: bước này không chạy độc lập được, bắt buộc chạy sau AC-003 trong cùng một lượt.
- Nguồn: tests/api/register_api.spec.js

## Nghiệp vụ CHƯA được automation phủ

Những nhánh dưới đây không có spec nào chạm tới. Ghi lại để không nhầm "automation xanh" là "nghiệp
vụ đã an toàn".

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Đăng ký bằng email đã tồn tại | Không có kịch bản negative nào; thông báo lỗi chưa ai kiểm |
| Đăng ký bằng số điện thoại đã tồn tại | Tương tự |
| Nhập sai OTP, OTP hết hạn, bấm gửi lại OTP | Toàn bộ nhánh lỗi của OTP đang trống |
| Mật khẩu không đạt điều kiện | Chưa biết quy tắc mật khẩu là gì |
| Email/số điện thoại sai định dạng | Chưa có validation test |
| Từ chối consent | Chưa biết hệ thống xử lý ra sao khi người dùng không đồng ý |

## Open questions

1. Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec chỉ điền khi ô hiển thị. — cần PO xác nhận
2. Quy tắc mật khẩu hợp lệ (độ dài, ký tự đặc biệt)? — cần PO xác nhận
3. Vì sao luồng email không có bước OTP còn luồng số điện thoại thì có? Đây là thiết kế hay là spec đang thiếu bước? — cần PO xác nhận
4. Mã OTP dùng trong automation là mã cố định của môi trường test. Ở production luồng này kiểm bằng cách nào? — cần QA Lead xác nhận
