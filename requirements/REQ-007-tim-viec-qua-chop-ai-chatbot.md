---
id: REQ-007
title: Tìm kiếm việc làm qua trợ lý Chop AI chatbot
status: Confirmed
version: 1.0
risk: medium
owner: QA
test_cases: test-cases/REQ-007-tim-viec-qua-chop-ai-chatbot.md
---

# REQ-007 — Tìm kiếm việc làm qua trợ lý Chop AI chatbot

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-007 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập hoặc khách vãng lai |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Confirmed |

## Bối cảnh nghiệp vụ

Hệ thống cung cấp trợ lý ảo thông minh Chop AI Chatbot cho phép người tìm việc tìm kiếm cơ hội nghề nghiệp thông qua giao diện tương tác hội thoại tự nhiên:
- Khởi chạy chatbot từ trang tìm kiếm việc làm.
- Nhập từ khóa ngành nghề, vị trí mong muốn trực tiếp vào ô chat.
- Lựa chọn tỉnh thành và mức lương khởi điểm từ các phản hồi gợi ý của bot.
- Xem số lượng việc làm phù hợp và mở danh sách chi tiết (Job Drawer).
- Tinh chỉnh bộ lọc linh hoạt: ngành nghề, khu vực quận huyện, mức lương và số năm kinh nghiệm.
- Xem chi tiết việc làm được gợi ý trực tiếp trong chatbot.

## Acceptance criteria

### AC-022 — Tìm kiếm, lọc và xem việc làm qua trợ lý Chop AI chatbot

**Given** tôi đang ở trang tìm kiếm việc làm và mở giao diện Chop AI chatbot
**When** tôi nhập từ khóa tìm việc, chọn tỉnh thành và mức lương khởi điểm
**Then** chatbot hiển thị số lượng công việc phù hợp và cho phép mở danh sách việc làm gợi ý
**And** tôi có thể áp dụng, thay đổi hoặc xóa các bộ lọc về ngành nghề, khu vực, mức lương và kinh nghiệm
**And** tôi có thể xem chi tiết việc làm trong modal và quay trở về trang chủ

- Trạng thái: Confirmed — spec kiểm chứng hiển thị kết quả và các bộ lọc.
- Ràng buộc quan sát được: các câu hỏi trắc nghiệm đã trả lời trong lịch sử chat sẽ bị vô hiệu hóa, tương tác bộ lọc được thực hiện qua thanh công cụ hoặc modal riêng biệt.
- Nguồn: tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js

## Nghiệp vụ và độ phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Tìm kiếm, lọc và xem việc làm qua Chop AI chatbot | **Đã phủ** | AC-022 (tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js) |
| Hiển thị & cuộn phân trang danh sách việc làm (Infinite Scroll) | **Đã phủ** | TC-049 (tests/e2e/desktop/kiem-thu-hien-thi-va-dieu-huong-phan-trang-danh-sach-viec-la.spec.js) |
| Quản lý vòng đời & tính toàn vẹn phiên hội thoại Chatbot | **Đã phủ** | TC-050 (tests/e2e/desktop/kiem-thu-quan-ly-vong-doi-va-tinh-toan-ven-phien-hoi-thoai-c.spec.js) |
| Tìm kiếm việc làm theo tỉnh thành | **Đã phủ** | tests/e2e/desktop/job_search_by_cities-bdd.spec.js |
| Lọc nâng cao chi tiết việc làm (Lương, kinh nghiệm, cấp bậc) | **Đã phủ** | tests/e2e/desktop/job_search_filter_detail-bdd.spec.js |
| Chatbot không tìm thấy việc làm phù hợp | Chưa phủ | Kiểm tra hiển thị empty state khi từ khóa không có kết quả |
| Ứng tuyển trực tiếp từ trong danh sách bot | Chưa phủ | Luồng bấm nút apply ngay trong Job Drawer của bot |

## Open questions

1. Có giới hạn số lượng tin hiển thị trong Job Drawer của chatbot không? — **Đã chốt (Hà Đinh, 2026-09-21):** không, hiển thị hết số lượng như chatbot trả về nhưng có chia page (hiện thực trên web QC là cơ chế Infinite Scroll khi cuộn danh sách).
2. Chatbot có lưu lại phiên hội thoại sau khi đóng cửa sổ hay không? — **Đã chốt (Hà Đinh, 2026-09-21):** Return (< 24h): User returns within 24 hours -> Resume the previous conversation flow directly (preserve Chat History, Active Target, and Maturity Score).

Return (> 24h): User returns after 24 hours -> The previous session is considered expired and discarded. Show the Onboarding Starting Screen with fresh suggestions. The expired session history is NOT shown or resumable.
