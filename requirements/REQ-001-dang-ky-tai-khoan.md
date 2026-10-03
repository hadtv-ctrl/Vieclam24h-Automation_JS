---
id: REQ-001
title: Đăng ký tài khoản người tìm việc
status: Inferred
version: 1.0
risk: high
owner: QA
test_cases: test-cases/REQ-001-dang-ky-tai-khoan.md
---

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
**And** khi tôi điền họ tên, số điện thoại (tùy chọn), mật khẩu và bấm Hoàn tất thì tài khoản được tạo

- Trạng thái: Confirmed — nút xác nhận mang nhãn "Hoàn tất" (type="submit").
- Ràng buộc quan sát được: email phải là email chưa tồn tại (spec sinh email ngẫu nhiên mỗi lần chạy).
- Trường bắt buộc quan sát được: họ tên (*), mật khẩu (*). Số điện thoại là trường tùy chọn.
- Nguồn: tests/e2e/desktop/register_by_email-bdd.spec.js, tests/e2e/mobile-web/register_by_email-bdd.mobile.spec.js

### AC-002 — Đăng ký bằng số điện thoại chưa tồn tại, xác minh bằng OTP

**Given** tôi là khách vãng lai đang ở trang chủ
**When** tôi mở popup Đăng ký/Đăng nhập, nhập một số điện thoại chưa tồn tại và bấm Tiếp tục
**Then** màn hình nhập mã OTP phải xuất hiện
**And** khi tôi nhập đúng OTP thì form "Tạo tài khoản mới" xuất hiện
**And** khi tôi điền họ tên (*), email (tùy chọn) và bấm Hoàn tất thì tài khoản được tạo
**And** popup chấp thuận dữ liệu cá nhân (Consent) xuất hiện; sau khi tôi bấm Đồng ý thì nội dung trang chủ được tải

- Trạng thái: Confirmed — form SĐT không yêu cầu mật khẩu (xác thực danh tính qua OTP); nút xác nhận mang nhãn "Hoàn tất".
- Ràng buộc quan sát được: số điện thoại theo định dạng di động Việt Nam. SĐT được pre-fill và khóa (readonly).
- Khác biệt so với AC-001: luồng số điện thoại xác minh OTP trước khi vào form, không cần mật khẩu, và có bước Consent bắt buộc.
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

## Nghiệp vụ và độ phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Đăng ký bằng email đã tồn tại | **Đã phủ** | TC-032 (tests/e2e/desktop/dang-ky-bang-email-da-ton-tai.spec.js) |
| Đăng ký bằng số điện thoại đã tồn tại | **Đã phủ** | TC-040, TC-042 (Kiểm thử chuỗi giá trị biên & Khách vãng lai) |
| Nhập sai OTP khi đăng ký | **Đã phủ** | TC-033 (tests/e2e/desktop/kiem-tra-that-bai-khi-nhap-sai-ma-otp-xac-thuc.spec.js) |
| Bấm gửi lại mã OTP | **Đã phủ** | TC-039 (tests/e2e/desktop/gui-lai-ma-otp-dang-ky.spec.js) |
| Mật khẩu dưới 8 ký tự | **Đã phủ** | TC-027 (tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-co-7-ky-tu-duoi-bien-toi-thie.spec.js) |
| Mật khẩu thiếu chữ số | **Đã phủ** | TC-028 (tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-chi-chua-chu-cai-thieu-chu-so.spec.js) |
| Mật khẩu thiếu chữ cái | **Đã phủ** | TC-029 (tests/e2e/desktop/kiem-tra-that-bai-khi-mat-khau-chi-chua-chu-so-thieu-chu-cai.spec.js) |
| Email sai định dạng | **Đã phủ** | TC-034 (tests/e2e/desktop/kiem-tra-bao-loi-khi-nhap-email-sai-dinh-dang.spec.js) |
| Bỏ trống trường SĐT tùy chọn | **Đã phủ** | TC-026, TC-030 (tests/e2e/desktop/xac-nhan-thanh-cong-khi-bo-trong-so-dien-thoai-truong-tuy-ch.spec.js) |
| Từ chối consent (Bấm Để sau) | Chưa phủ | Cần bổ sung spec kiểm tra điều hướng khi bấm "Để sau" ở popup Consent |

## Open questions

1. Số điện thoại ở form đăng ký bằng email là bắt buộc hay tùy chọn? Spec chỉ điền khi ô hiển thị. — **Đã chốt (Hà Đinh, 2026-09-21):** khi đăng kí bằng email thì số điện thoại không bắt buộc và khi đăng kí bằng phone thì email không bắt buộc
2. Quy tắc mật khẩu hợp lệ (độ dài, ký tự đặc biệt)? — **Đã chốt (Hà Đinh, 2026-09-21):** Mật khẩu tối thiểu 8 ký tự, trong đó có ít nhất 1 ký tự chữ và 1 ký tự số.
3. Vì sao luồng email không có bước OTP còn luồng số điện thoại thì có? Đây là thiết kế hay là spec đang thiếu bước? — **Đã chốt (Hà Đinh, 2026-09-21):** spec nó vậy
4. Mã OTP dùng trong automation là mã cố định của môi trường test. Ở production luồng này kiểm bằng cách nào? — **Đã chốt (Hà Đinh, 2026-09-21):** đúng vậy , mã 1111 là cố định cho xác thực OTP số điện thoại, và email lúc đăng nhập. Mã này dùng ở mt test
5. Tên nhãn nút hoàn tất tạo tài khoản và trường mật khẩu ở form SĐT? — **Đã chốt (Khảo sát QC 2026-10-03):** Nút submit mang nhãn "Hoàn tất". Luồng SĐT qua OTP không yêu cầu mật khẩu.
