---
id: REQ-003
title: Ứng tuyển việc làm bằng CV hoặc hồ sơ trực tuyến
status: Inferred
version: 1.0
risk: high
owner: QA
test_cases: test-cases/REQ-003-ung-tuyen-viec-lam.md
---

# REQ-003 — Ứng tuyển việc làm bằng CV hoặc hồ sơ trực tuyến

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-003 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Từ trang chi tiết một việc làm, người dùng bấm Ứng tuyển ngay và chọn một trong hai phương thức nộp
hồ sơ: tải lên file CV, hoặc dùng hồ sơ trực tuyến điền trực tiếp trên hệ thống.

Sau khi nộp xong, hệ thống gợi ý nộp hàng loạt (bulk apply) sang các việc làm tương tự bằng chính hồ
sơ vừa dùng. Mọi việc đã nộp phải xuất hiện trong danh sách việc làm đã ứng tuyển.

Luồng ứng tuyển không cần CV tách riêng tại REQ-004 vì nó có quy tắc nghiệp vụ khác hẳn.

## Acceptance criteria

### AC-008 — Ứng tuyển bằng file CV tải lên

**Given** tôi đã đăng nhập và đang mở trang chi tiết một việc làm
**When** tôi bấm Ứng tuyển ngay, chọn phương thức ứng tuyển bằng CV, tải lên file CV và bấm Tiếp tục
**Then** hồ sơ phải được nộp cho việc làm đó

- Trạng thái: Inferred — không có assertion nào xác nhận thời điểm nộp thành công; kết luận dựa vào việc bước bulk apply và danh sách đã ứng tuyển sau đó chạy được.
- Ràng buộc quan sát được: hệ thống có thể hỏi OTP ngay khi bắt đầu ứng tuyển; spec luôn chuẩn bị sẵn mã OTP.
- Nguồn: tests/e2e/desktop/apply_job_with_CV_flow-bdd.spec.js, tests/e2e/mobile-web/apply_job_with_CV_flow-bdd.mobile.spec.js

### AC-009 — Ứng tuyển bằng hồ sơ trực tuyến điền trực tiếp

**Given** tôi đã đăng nhập và đang mở trang chi tiết một việc làm
**When** tôi bấm Ứng tuyển ngay, chọn phương thức ứng tuyển bằng hồ sơ trực tuyến
**And** tôi điền lần lượt Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Thành tựu, Chứng chỉ, Ngoại ngữ
**And** tôi bấm nộp hồ sơ rồi xác nhận
**Then** thông báo nộp hồ sơ thành công phải hiển thị

- Trạng thái: Confirmed — có assertion trên thông báo thành công.
- Ràng buộc quan sát được: mỗi mục được thêm và lưu riêng lẻ; trình tự bảy mục trong spec là cố định nhưng chưa rõ có bắt buộc theo thứ tự đó không.
- Nguồn: tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js, tests/e2e/mobile-web/apply_job_with_profile_flow-bdd.mobile.spec.js

### AC-010 — Nộp hàng loạt sang các việc làm tương tự sau khi nộp xong

**Given** tôi vừa nộp hồ sơ cho một việc làm
**When** hệ thống gợi ý các việc làm tương tự và tôi chọn nộp hàng loạt
**Then** hồ sơ vừa dùng phải được nộp cho các việc làm đó mà không phải điền lại

- Trạng thái: Needs confirmation — spec gọi bulk apply nhưng **không assert** kết quả, và ở luồng không cần CV còn cho phép bước này không xảy ra mà test vẫn xanh. Nghĩa là hiện tại nếu bulk apply hỏng thì automation không phát hiện được.
- Nguồn: toàn bộ spec nhóm ứng tuyển

### AC-011 — Việc làm đã nộp hiển thị trong danh sách đã ứng tuyển

**Given** tôi vừa nộp hồ sơ cho một hoặc nhiều việc làm
**When** tôi mở danh sách việc làm đã ứng tuyển
**Then** danh sách phải hiển thị các việc làm đó

- Trạng thái: Inferred — có bước kiểm tra danh sách hiển thị, nhưng việc so khớp đúng việc làm vừa nộp nằm trong Page Object và không lộ ra ở spec.
- Đây là điểm neo quan trọng nhất của cả REQ-003 và REQ-004: nó là bằng chứng duy nhất cho thấy hồ sơ thực sự tới nơi.
- Nguồn: toàn bộ spec nhóm ứng tuyển

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Ứng tuyển lại một việc đã nộp | Hệ thống chặn hay cho nộp trùng? Chưa ai kiểm |
| Tải lên file CV sai định dạng hoặc quá dung lượng | Không có kịch bản negative |
| Ứng tuyển việc làm đã hết hạn / đã đóng | Chưa có kịch bản |
| Hủy ứng tuyển | Không có spec nào |
| Nộp hồ sơ trực tuyến khi còn thiếu mục bắt buộc | Chưa biết mục nào bắt buộc |
| Bỏ qua bulk apply | Chưa kiểm được trạng thái sau khi từ chối gợi ý |

## Open questions

1. Trong bảy mục của hồ sơ trực tuyến, mục nào bắt buộc để nộp được? — **Đã chốt (Hà Đinh, 2026-09-24):** chỉ cần có CV - tức hồ sơ trực tuyến, hoặc có thể ứng tuyển bằng các thông tin trong Hồ sơ của tôi với các thông tin ghi chú bên ngoài hoàn thành là User có thể apply
2. Bulk apply nộp tối đa bao nhiêu việc một lần, và tiêu chí "việc làm tương tự" là gì? — **Đã chốt (Hà Đinh, 2026-09-24):** có thể nộp với tất cả các job xuất hiện trong danh sách job hiển thị, tiêu chí đó là việc làm tương tự của job vừa nộp trước đó, list danh cách là việc làm tương tự job vừa nộp trước đó
3. Vì sao ứng tuyển lại cần OTP dù người dùng đã đăng nhập? — **Đã chốt (Hà Đinh, 2026-09-24):** nếu User chưa xác thực số điện thoại thì cần xác thực số điện thoại để ứng tuyển nhằm mục đích chống spam đối với những user ảo
4. Người dùng có được ứng tuyển cùng một việc nhiều lần không? — **Đã chốt (Hà Đinh, 2026-09-24):** người dùng có thể ứng tuyển cùng 1 việc nhiều lần, nhưng phải không cùng 1 ngày. Tức là trong 1 ngày chỉ được ứng tuyển việc đó 1 lần thôi.
