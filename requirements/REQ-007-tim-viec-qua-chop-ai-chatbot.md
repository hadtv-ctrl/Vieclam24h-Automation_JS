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

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| Chatbot không tìm thấy việc làm phù hợp | Cần kiểm tra giao diện bot khi từ khóa không có kết quả |
| Ngắt kết nối mạng hoặc lỗi server bot | Nhánh lỗi kết nối chưa có test case |
| Ứng tuyển trực tiếp từ trong danh sách bot | Hiện mới kiểm tra mở chi tiết, chưa kiểm tra nộp đơn từ bot |

## Open questions

1. Có giới hạn số lượng tin hiển thị trong Job Drawer của chatbot không? — **Đã chốt (Hà Đinh, 2026-09-21):** không, hiển thị hết số lượng như chatbot trả về nhưng có chia page
2. Chatbot có lưu lại phiên hội thoại sau khi đóng cửa sổ hay không? — **Đã chốt (Hà Đinh, 2026-09-21):** Return (< 24h): User returns within 24 hours -> Resume the previous conversation flow directly (preserve Chat History, Active Target, and Maturity Score).

Return (> 24h): User returns after 24 hours -> The previous session is considered expired and discarded. Show the Onboarding Starting Screen with fresh suggestions. The expired session history is NOT shown or resumable.
