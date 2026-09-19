# REQ-004 — Ứng tuyển việc làm không cần CV

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-004 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập, và khách vãng lai chưa có tài khoản |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Vieclam24h có một nhóm việc làm riêng cho phép ứng tuyển mà không cần CV: người dùng chỉ điền một hồ
sơ rút gọn (profile mini) ngay trên form ứng tuyển. Đây là luồng dành cho lao động phổ thông, nơi yêu
cầu phải có CV là rào cản.

Điểm nghiệp vụ quan trọng nhất: **khách vãng lai ứng tuyển được mà không cần đăng ký trước**. Tài
khoản được tạo ngầm ngay trong luồng ứng tuyển, xác minh bằng OTP gửi tới số điện thoại người dùng
vừa nhập. Đây là lý do luồng này tách khỏi REQ-003 thay vì là một nhánh của nó.

## Acceptance criteria

### AC-012 — Thành viên đã đăng nhập ứng tuyển bằng hồ sơ rút gọn

**Given** tôi đã đăng nhập và đang ở trang chủ
**When** tôi mở danh sách việc không cần CV và mở chi tiết một việc làm
**And** tôi bắt đầu ứng tuyển, điền hồ sơ rút gọn rồi nộp
**Then** hồ sơ phải được nộp cho việc làm đó

- Trạng thái: Inferred — spec không có assertion nào ở thời điểm nộp; bằng chứng duy nhất là danh sách đã ứng tuyển ở bước cuối.
- Ràng buộc quan sát được: hệ thống có thể hỏi OTP khi bắt đầu ứng tuyển dù người dùng đã đăng nhập.
- Nguồn: tests/e2e/desktop/apply_job_noCV_flow.spec.js, tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js

### AC-013 — Khách vãng lai ứng tuyển và được tạo tài khoản bằng OTP ngay trong luồng

**Given** tôi chưa đăng nhập và đang ở trang chủ
**When** tôi mở một việc không cần CV và bắt đầu ứng tuyển
**And** tôi điền thông tin liên hệ gồm số điện thoại, điền hồ sơ rút gọn và nộp
**Then** hệ thống phải gửi OTP tới số điện thoại đó
**And** khi tôi nhập đúng OTP thì tài khoản được tạo và tôi được đăng nhập
**And** popup chấp thuận dữ liệu cá nhân xuất hiện, sau khi tôi đồng ý thì hồ sơ được nộp

- Trạng thái: Inferred cho phần tạo tài khoản; Confirmed cho phần OTP và consent (spec bắt buộc hai bước này xảy ra, không có nhánh bỏ qua).
- Khác biệt quan trọng so với AC-012: khách vãng lai phải điền thêm thông tin liên hệ, và bước consent là bắt buộc chứ không tùy chọn.
- Nguồn: tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js, tests/e2e/mobile-web/guest_apply_job_noCV_with_otp.mobile.spec.js

### AC-014 — Nộp hàng loạt bằng hồ sơ rút gọn đã điền

**Given** tôi vừa nộp hồ sơ rút gọn cho một việc không cần CV
**When** hệ thống gợi ý các việc tương tự và tôi chọn nộp hàng loạt
**Then** hồ sơ rút gọn vừa điền phải được dùng lại mà không phải nhập lại

- Trạng thái: Needs confirmation — spec cho phép bước này **không xảy ra** mà test vẫn xanh. Nếu gợi ý bulk apply biến mất khỏi sản phẩm thì automation sẽ không báo gì cả.
- Nguồn: tests/e2e/desktop/apply_job_noCV_flow.spec.js, tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js và hai bản mobile tương ứng

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Khách vãng lai nhập số điện thoại đã có tài khoản | Hệ thống gộp vào tài khoản cũ hay báo lỗi? Đây là nhánh rủi ro cao nhất và đang trống |
| Nhập sai OTP hoặc OTP hết hạn ở luồng khách vãng lai | Hồ sơ đang điền dở có mất không? |
| Khách vãng lai từ chối consent sau khi đã nộp | Hồ sơ đã nộp có bị thu hồi không? |
| Bỏ dở giữa chừng rồi quay lại | Dữ liệu hồ sơ rút gọn có được giữ không? |
| Trường bắt buộc của hồ sơ rút gọn | Chưa có kịch bản validation nào |

## Open questions

1. Khi khách vãng lai nhập số điện thoại đã tồn tại, hệ thống xử lý thế nào? — cần PO xác nhận, ưu tiên cao
2. Hồ sơ rút gọn gồm những trường bắt buộc nào? — cần PO xác nhận
3. Tài khoản tạo ngầm qua luồng này khác gì tài khoản đăng ký bình thường ở REQ-001? — cần PO/BA xác nhận
4. Vì sao thành viên đã đăng nhập vẫn có thể bị hỏi OTP khi ứng tuyển? — cần PO xác nhận
