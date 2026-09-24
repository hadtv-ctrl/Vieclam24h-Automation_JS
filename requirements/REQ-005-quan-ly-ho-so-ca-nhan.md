---
id: REQ-005
title: Quản lý hồ sơ cá nhân của người tìm việc
status: Inferred
version: 1.0
risk: high
owner: QA
test_cases: test-cases/REQ-005-quan-ly-ho-so-ca-nhan.md
---

# REQ-005 — Quản lý hồ sơ cá nhân của người tìm việc

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-005 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Trang "Hồ sơ của tôi" là nơi người tìm việc hoàn thiện hồ sơ để nhà tuyển dụng tìm thấy mình. Hồ sơ
gồm ba nhóm dữ liệu tách biệt:

1. **Thông tin cá nhân** — tỉnh thành, quận huyện, ngày sinh, giới tính.
2. **Tiêu chí tìm việc** — vị trí mong muốn, ngành nghề, địa điểm, mức lương, cấp bậc, hình thức làm việc, số năm kinh nghiệm.
3. **Nội dung hồ sơ** — bảy mục: Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Thành tựu, Chứng chỉ, Ngoại ngữ.

Ngoài ra người dùng có thể tải lên một file CV và để hệ thống chuyển đổi nội dung file đó thành dữ
liệu hồ sơ, thay vì gõ tay từng mục.

Việc cho phép nhà tuyển dụng tìm thấy hồ sơ là một hành động có kiểm soát: nó cần xác minh bằng mã.

## Acceptance criteria

### AC-015 — Cập nhật thông tin cá nhân

**Given** tôi đã đăng nhập và đang ở trang Hồ sơ của tôi
**When** tôi mở phần chỉnh sửa thông tin cá nhân, điền tỉnh thành, quận huyện, ngày sinh, giới tính và lưu
**Then** thông tin cá nhân phải được lưu vào hồ sơ

- Trạng thái: Inferred — spec lưu xong là kết thúc bước, không đọc lại để đối chiếu giá trị đã lưu.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-016 — Khai báo tiêu chí tìm việc

**Given** tôi đang ở phần Tiêu chí tìm việc
**When** tôi thêm một vị trí công việc mong muốn và điền kinh nghiệm, số năm, vị trí, ngành nghề, địa điểm, mức lương, cấp bậc, hình thức làm việc rồi lưu
**Then** tiêu chí tìm việc phải được lưu vào hồ sơ

- Trạng thái: Inferred — không đọc lại để đối chiếu.
- Quan hệ cần làm rõ: tập dữ liệu này trùng một phần với onboarding ở REQ-002.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-017 — Bật cho phép tìm kiếm hồ sơ phải qua bước xác minh

**Given** tôi đã điền tiêu chí tìm việc
**When** tôi bật tính năng cho phép nhà tuyển dụng tìm kiếm hồ sơ và bấm Tiếp tục
**Then** hệ thống phải yêu cầu nhập mã xác minh gồm bốn chữ số
**And** sau khi nhập mã và tải lên CV, tôi bấm Cho phép tìm kiếm thì hồ sơ được công khai cho nhà tuyển dụng

- Trạng thái: Inferred — có bước chờ trạng thái tải xong nhưng không có assertion nào xác nhận hồ sơ đã ở trạng thái công khai.
- Đây là ràng buộc quyền riêng tư: hồ sơ **không** tự động công khai, người dùng phải chủ động bật và xác minh.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-018 — Thêm và lưu từng mục nội dung hồ sơ

**Given** tôi đang ở trang Hồ sơ của tôi
**When** tôi lần lượt thêm Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Thành tựu, Kỹ năng, Chứng chỉ, Ngoại ngữ và lưu từng mục
**Then** mỗi mục phải được lưu độc lập vào hồ sơ

- Trạng thái: Inferred — toàn bộ bảy mục đều lưu xong là kết thúc bước, không có assertion nào đọc lại nội dung đã lưu.
- Ràng buộc quan sát được: mỗi mục là một form riêng, mở ra, điền, lưu, đóng lại; không có nút lưu chung cho cả hồ sơ.
- Nguồn: tests/e2e/desktop/setting_user_profile-bdd.spec.js, tests/e2e/mobile-web/setting_user_profile-bdd.mobile.spec.js

### AC-019 — Tải lên CV và chuyển đổi thành dữ liệu hồ sơ

**Given** tôi đang ở trang Hồ sơ của tôi
**When** tôi tải lên một file CV và xác nhận đính kèm
**Then** hệ thống phải báo chuyển đổi thành công
**And** dữ liệu đọc được từ CV phải được áp vào hồ sơ sau khi tôi xác nhận
**And** sau đó tôi chuyển sang phần Tiêu chí tìm việc được

- Trạng thái: Inferred — việc kiểm tra kết quả chuyển đổi nằm trong Page Object, không lộ ra ở spec nên không audit được từ tài liệu.
- Ràng buộc quan sát được: chuyển đổi là bước tốn thời gian, cần chờ lâu hơn thao tác thông thường.
- Nguồn: tests/e2e/desktop/upload_cv_profile-bdd.spec.js, tests/e2e/mobile-web/upload_cv_profile-bdd.mobile.spec.js

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Sửa và xóa một mục hồ sơ đã lưu | Toàn bộ spec chỉ có thêm mới, không có sửa hay xóa |
| Đọc lại hồ sơ để đối chiếu giá trị đã lưu | Không spec nào làm việc này, nên "lưu thành công" chưa từng được chứng minh |
| Nhập mã xác minh sai | Không có kịch bản negative |
| Tải lên CV sai định dạng hoặc file hỏng | Không có kịch bản negative |
| Tắt lại cho phép tìm kiếm hồ sơ | Chỉ có chiều bật, không có chiều tắt |
| Trường bắt buộc trong từng mục hồ sơ | Chưa có validation test nào |
| Độ hoàn thiện hồ sơ (nếu sản phẩm có chỉ số này) | Không spec nào kiểm |

## Open questions

1. Mã xác minh bốn chữ số khi bật tìm kiếm hồ sơ được gửi qua đâu — SMS hay email? — **Đã chốt (Hà Đinh, 2026-09-24):** gửi qua email và Số điện thoại, nhưng đối với những tài khoản nào chưa xác nhận cả 2 thông tin là email và số điện thoại thì sẽ phải OTP. nếu thiếu xác thực email thì OTP sẽ gửi qua email, OTP này không phải là 1111 ở môi trường  QC/STG, còn nếu số điện thoại chưa xác thực thì otp nó sẽ là 1111 ờ môi trường QC/STG
2. Tiêu chí tìm việc ở đây và tiêu chí khai ở onboarding (REQ-002) có đồng bộ với nhau không? — **Đã chốt (Hà Đinh, 2026-09-24):** có
3. Khi chuyển đổi CV, dữ liệu mới ghi đè hay gộp với dữ liệu hồ sơ đang có? — **Đã chốt (Hà Đinh, 2026-09-24):** gộp với dữ liệu đang có, nhưng ở dạng là trường chứ không phải cộng thông tin vào trường đang có data, ví dụ nếu kỹ năng hay kinh nghiệm làm việc đã có thì sẽ ghi đè, còn nếu chưa có thì ghi thêm
4. Trong bảy mục nội dung hồ sơ, mục nào bắt buộc để hồ sơ được coi là hoàn thiện? — **Đã chốt (Hà Đinh, 2026-09-24):** Thông tin cá nhân

Kinh nghiệm

Giới thiệu bản thân

Học vấn
