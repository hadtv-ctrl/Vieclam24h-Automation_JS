# REQ-002 — Onboarding tiêu chí tìm việc sau khi đăng nhập

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-002 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập, chưa khai báo tiêu chí |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Ngay sau khi đăng nhập lần đầu, hệ thống mở một modal onboarding gồm 5 bước để thu thập tiêu chí tìm
việc. Dữ liệu này là đầu vào cho việc gợi ý việc làm, nên bỏ qua onboarding đồng nghĩa với việc gợi ý
kém chất lượng.

Modal này xuất hiện chen ngang mọi luồng khác: các spec về ứng tuyển và hồ sơ đều phải chủ động đóng
nó trước khi làm việc gì khác. Đó là một tín hiệu nghiệp vụ, không phải chi tiết kỹ thuật — onboarding
đang chặn màn hình cho tới khi người dùng xử lý nó.

## Acceptance criteria

### AC-005 — Modal onboarding hiển thị ngay sau khi đăng nhập

**Given** tôi vừa đăng nhập thành công
**When** trang chủ tải xong
**Then** modal onboarding phải hiển thị ở bước 1 với ô chọn khu vực tìm việc

- Trạng thái: Confirmed — có assertion chờ ô chọn khu vực hiển thị.
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

### AC-006 — Năm bước onboarding đi tuần tự, mỗi bước mở đúng bước kế tiếp

**Given** modal onboarding đang mở
**When** tôi lần lượt chọn khu vực, ngành nghề quan tâm, công việc mong muốn, mức lương mong muốn và số năm kinh nghiệm
**Then** sau mỗi lần bấm Tiếp tục, tiêu đề của bước kế tiếp phải hiển thị

- Trạng thái: Confirmed cho bước 1 đến bước 3; Inferred cho bước 4 và bước 5.
- Ràng buộc quan sát được: ở bước công việc mong muốn, người dùng phải chọn một gợi ý từ danh sách chứ không nhập tự do — danh sách gợi ý phải hiện rồi mới chọn được.
- Hành vi bất thường cần chú ý: spec cho bước 4 và bước 5 có nhánh "nếu bước này không còn hiển thị thì bỏ qua". Nghĩa là modal **có thể tự đóng sớm** trước khi đi hết 5 bước. Đây là hành vi chưa được giải thích.
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

### AC-007 — Hoàn tất onboarding thì modal đóng lại

**Given** tôi đang ở bước cuối và đã chọn số năm kinh nghiệm
**When** tôi bấm nút hoàn tất
**Then** modal onboarding phải đóng lại và không còn chặn màn hình

- Trạng thái: Confirmed — có assertion modal bị ẩn.
- Chưa kiểm: tiêu chí vừa khai có thực sự được lưu và phản ánh ở nơi khác hay không.
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Đóng onboarding giữa chừng rồi đăng nhập lại | Modal có hiện lại không? Dữ liệu dở dang có giữ không? |
| Bỏ trống một bước rồi bấm Tiếp tục | Chưa biết bước nào bắt buộc, bước nào bỏ qua được |
| Tiêu chí đã khai có hiển thị đúng ở trang Hồ sơ không | Không spec nào kiểm chứng dữ liệu được lưu |
| Chọn nhiều ngành nghề / nhiều khu vực | Spec chỉ chọn đúng một giá trị mỗi loại |
| Quay lại bước trước | Không có kịch bản nào bấm Quay lại |

## Open questions

1. Vì sao modal có thể tự đóng trước bước 4 hoặc bước 5? Đây là tính năng (đã đủ dữ liệu thì dừng) hay là lỗi giao diện? — **Đã chốt (Hà Đinh, 2026-09-21):** modal onboarding là không bắt buộc
2. Onboarding là bắt buộc hay bỏ qua được? — **Đã chốt (Hà Đinh, 2026-09-21):** đúng
3. Tiêu chí khai ở onboarding và tiêu chí tìm việc trong REQ-005 là cùng một tập dữ liệu hay hai tập khác nhau? — **Đã chốt (Hà Đinh, 2026-09-21):** là 1, khi khai báo onboarding thì dữ liệu khai báo đó hiển thị ở Tiêu chí tìm việc
