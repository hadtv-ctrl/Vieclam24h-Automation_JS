---
id: REQ-002
title: Onboarding tiêu chí tìm việc sau khi đăng nhập
status: Inferred
version: 1.0
risk: medium
owner: QA
test_cases: test-cases/REQ-002-onboarding-tieu-chi-tim-viec.md
---

# REQ-002 — Onboarding tiêu chí tìm việc sau khi đăng nhập

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-002 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập, chưa khai báo tiêu chí |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Ngay sau khi đăng nhập lần đầu, hệ thống hiển thị một khối khảo sát onboarding (dạng header banner card nhúng đầu trang) gồm 5 câu hỏi để thu thập tiêu chí tìm việc. Dữ liệu này là đầu vào cho việc gợi ý việc làm phù hợp cho người tìm việc.

Khối khảo sát này hiển thị đầu trang chủ, người dùng có thể thực hiện tuần tự qua các bước bằng nút "Tiếp theo >" hoặc có thể chủ động bấm nút [X] ở góc phải để đóng/bỏ qua khảo sát bất cứ lúc nào mà không làm gián đoạn việc sử dụng trang web.

## Acceptance criteria

### AC-005 — Khảo sát onboarding hiển thị ngay sau khi đăng nhập

**Given** tôi vừa đăng nhập thành công vào tài khoản chưa khai báo tiêu chí
**When** trang chủ tải xong
**Then** khối khảo sát onboarding phải hiển thị ở câu hỏi 1/5 ("Bạn đang tìm việc ở khu vực nào?") với danh sách khu vực phổ biến và ô tìm kiếm khu vực khác

- Trạng thái: Confirmed — có assertion chờ khối khảo sát và ô chọn khu vực hiển thị.
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

### AC-006 — Năm câu hỏi onboarding đi tuần tự, mỗi bước mở đúng câu hỏi kế tiếp

**Given** khối khảo sát onboarding đang hiển thị
**When** tôi lần lượt chọn khu vực, ngành nghề quan tâm, công việc mong muốn, mức lương mong muốn và số năm kinh nghiệm
**Then** sau mỗi lần bấm "Tiếp theo >", tiêu đề của câu hỏi kế tiếp phải hiển thị tương ứng

- Trạng thái: Confirmed cho bước 1 đến bước 3; Inferred cho bước 4 và bước 5.
- Ràng buộc quan sát được: ở bước công việc mong muốn, người dùng chọn gợi ý từ danh sách hiển thị; nút điều hướng mang nhãn "Tiếp theo >".
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

### AC-007 — Hoàn tất onboarding thì khối khảo sát đóng lại

**Given** tôi đang ở bước cuối và đã chọn số năm kinh nghiệm
**When** tôi bấm nút hoàn tất (Tiếp theo)
**Then** khối onboarding phải đóng lại và trang chủ hiển thị việc làm gợi ý phù hợp

- Trạng thái: Confirmed — có assertion khối onboarding bị ẩn.
- Nguồn: tests/e2e/desktop/onboarding-bdd.spec.js, tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js

## Nghiệp vụ và độ phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Đóng onboarding giữa chừng rồi kiểm tra trang chủ | **Đã phủ** | TC-035 (tests/e2e/desktop/dong-modal-onboarding-giua-chung.spec.js) |
| Bỏ qua Onboarding (Skip flow) và duy trì phiên | **Đã phủ** | TC-041 (tests/e2e/desktop/kiem-thu-luong-bo-qua-onboarding-skip-flow-va-duy-tri-trang.spec.js) |
| Bỏ trống trường tùy chọn | **Đã phủ** | TC-031 (tests/e2e/desktop/xac-nhan-thanh-cong-khi-bo-trong-truong-tuy-chon-truong-tuy-.spec.js) |
| Chọn nhiều ngành nghề / nhiều khu vực | Chưa phủ | Thử nghiệm chọn đa giá trị ở các bước khảo sát |
| Quay lại bước trước | Chưa phủ | Khảo sát nút Back/Quay lại trên luồng onboarding |

## Open questions

1. Vì sao modal có thể tự đóng trước bước 4 hoặc bước 5? Đây là tính năng (đã đủ dữ liệu thì dừng) hay là lỗi giao diện? — **Đã chốt (Hà Đinh, 2026-09-21):** modal onboarding là không bắt buộc
2. Onboarding là bắt buộc hay bỏ qua được? — **Đã chốt (Hà Đinh, 2026-09-21):** đúng
3. Tiêu chí khai ở onboarding và tiêu chí tìm việc trong REQ-005 là cùng một tập dữ liệu hay hai tập khác nhau? — **Đã chốt (Hà Đinh, 2026-09-21):** là 1, khi khai báo onboarding thì dữ liệu khai báo đó hiển thị ở Tiêu chí tìm việc
4. Hình thức hiển thị và nút điều hướng? — **Đã chốt (Khảo sát QC 2026-10-03):** Giao diện dạng card banner đầu trang, tiến trình "1/5 câu hỏi", nút đóng [X] góc phải, nút chuyển bước "Tiếp theo >".
