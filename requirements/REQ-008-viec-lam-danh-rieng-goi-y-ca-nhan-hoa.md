---
id: REQ-008
title: Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa
status: Confirmed
version: 1.0
risk: medium
owner: QA
test_cases: test-cases/REQ-008-viec-lam-danh-rieng-goi-y-ca-nhan-hoa.md
---

# REQ-008 — Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-008 |
| Phiên bản | 1.0 |
| Vai trò | Khách vãng lai và Người tìm việc mới đăng ký |
| Nguồn dựng | Automation ghi hình thực tế, dựng theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Confirmed |

## Bối cảnh nghiệp vụ

Hệ thống cung cấp điểm chạm thu hút người tìm việc ngay tại trang chủ qua khối "Việc làm dành riêng cho bạn" và link khám phá "+10 việc làm có lương hấp dẫn":
- Cho phép khách vãng lai tiếp cận tính năng cá nhân hóa gợi ý việc làm.
- Người dùng thực hiện đăng ký / xác thực tài khoản nhanh chóng qua số điện thoại và mã OTP (4 chữ số).
- Sau khi nhập họ tên và đồng ý điều khoản xử lý dữ liệu cá nhân (Consent), hệ thống dẫn người dùng vào quy trình 3 bước thiết lập tiêu chí tìm việc ban đầu:
  1. **Bước 1 — Vị trí công việc mong muốn:** Nhập và chọn gợi ý công việc phù hợp (ví dụ: nhân viên bán hàng).
  2. **Bước 2 — Khu vực làm việc:** Lựa chọn tối đa 5 tỉnh/thành phố làm việc mong muốn (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang,...).
  3. **Bước 3 — Mức lương mong muốn:** Nhập khoảng lương tối thiểu và tối đa mong muốn.
- Sau khi hoàn tất 3 bước, hệ thống chuyển hướng đến trang danh sách "Tiêu chí tìm việc của tôi", hiển thị các việc làm phù hợp nhất kèm các tab sắp xếp (Lương cao nhất / Mới nhất).
- Người dùng có thể tiếp tục tùy chỉnh nâng cao (Chỉnh sửa và thêm mới): bổ sung số năm kinh nghiệm và ngành nghề mong muốn để thuật toán gợi ý tối ưu độ chính xác.
- Danh sách việc làm phù hợp cũng được liên kết từ menu chính ("Việc làm" -> "Tìm việc làm" -> khối "Việc làm dành cho bạn với mức lương hấp dẫn"), cho phép người dùng mở xem chi tiết việc làm.

## Acceptance criteria

### AC-023 — Tiếp cận khối việc làm dành riêng và xác thực tài khoản OTP

**Given** tôi là khách vãng lai đang ở trang chủ Việc Làm 24h
**When** tôi bấm vào nút "Xem việc làm dành riêng cho bạn" hoặc link "+10 việc làm có lương hấp dẫn"
**Then** hệ thống mở popup đăng ký/xác thực tài khoản
**And** khi tôi nhập số điện thoại và tiếp tục, hệ thống gửi mã xác thực OTP
**And** sau khi nhập đúng mã OTP, tôi điền họ tên, bấm "Hoàn tất" và xác nhận đồng ý điều khoản xử lý dữ liệu cá nhân

- Trạng thái: Confirmed — spec kiểm chứng luồng đăng ký OTP và mở form tiêu chí.
- Nguồn: tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js

### AC-024 — Thiết lập 3 bước tiêu chí tìm việc ban đầu

**Given** tôi vừa hoàn tất xác thực tài khoản và chấp thuận điều khoản
**When** tôi lần lượt:
  1. Chọn công việc mong muốn từ ô tìm kiếm gợi ý
  2. Chọn tối đa 5 khu vực làm việc (kể cả tỉnh thành trong nhóm "Khác")
  3. Nhập mức lương tối thiểu và tối đa mong muốn rồi bấm "Hoàn tất"
**Then** hệ thống ghi nhận thành công và chuyển hướng đến trang kết quả việc làm được cá nhân hóa

- Trạng thái: Confirmed — spec kiểm chứng luồng 3 bước wizard.
- Nguồn: tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js

### AC-025 — Khám phá việc làm cá nhân hóa và chuyển đổi tab sắp xếp

**Given** tôi đã hoàn tất thiết lập tiêu chí ban đầu và đang ở trang kết quả
**When** tôi xem danh sách việc làm và bấm chuyển qua lại giữa các tab "Lương cao nhất" và "Mới nhất"
**Then** danh sách việc làm tương ứng được cập nhật sắp xếp phù hợp theo tiêu chí đã chọn

- Trạng thái: Confirmed — spec kiểm chứng chuyển tab hiển thị.
- Nguồn: tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js

### AC-026 — Bổ sung kinh nghiệm làm việc và ngành nghề mong muốn

**Given** tôi đang ở trang tiêu chí tìm việc của tôi
**When** tôi bấm "Chỉnh sửa và thêm mới", chọn "Đã có kinh nghiệm", chọn số năm kinh nghiệm (VD: 3 năm) và chọn ngành nghề (VD: Hành chính - Thư ký), sau đó bấm "Lưu thông tin"
**Then** thông tin tiêu chí bổ sung được cập nhật thành công vào hồ sơ cá nhân hóa
**And** người dùng có thể điều hướng từ menu Việc làm để xem tất cả việc làm gợi ý và xem chi tiết công việc

- Trạng thái: Confirmed — spec kiểm chứng lưu kinh nghiệm, ngành nghề và điều hướng tin tuyển dụng.
- Nguồn: tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js

## Nghiệp vụ và độ phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Khách vãng lai tiếp cận, xác thực OTP, thiết lập 3 bước tiêu chí và khám phá việc làm gợi ý | **Đã phủ** | TC-095 (tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js) |
| Cập nhật thêm số năm kinh nghiệm, ngành nghề và điều hướng từ menu Việc làm | **Đã phủ** | TC-095 (tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js) |
| Chọn vượt quá giới hạn 5 khu vực | Chưa phủ | Kiểm tra disable hoặc cảnh báo khi người dùng chọn khu vực thứ 6 |
| Bỏ qua hoặc hủy thiết lập tiêu chí giữa chừng | Chưa phủ | Kiểm tra trạng thái lưu nháp khi đóng modal tiêu chí |

## Open questions

1. Số điện thoại nhập ở luồng này nếu đã có tài khoản thì hiển thị màn hình mật khẩu hay OTP? — **Quan sát QC:** Hệ thống phân nhánh: nếu tài khoản chưa tồn tại sẽ qua luồng OTP tạo mới; nếu đã tồn tại yêu cầu đăng nhập mật khẩu. — **Đã chốt (Hà Đinh, 2026-10-03):** đúng
2. Giới hạn khu vực tối đa? — **Xác nhận UI:** Tối đa 5 khu vực làm việc được phép chọn đồng thời. — **Đã chốt (Hà Đinh, 2026-10-03):** 5
