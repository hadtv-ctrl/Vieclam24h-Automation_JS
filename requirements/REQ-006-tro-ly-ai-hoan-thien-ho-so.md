---
id: REQ-006
title: Trợ lý AI hoàn thiện nội dung hồ sơ
status: Inferred
version: 1.0
risk: medium
owner: QA
test_cases: test-cases/REQ-006-tro-ly-ai-hoan-thien-ho-so.md
---

# REQ-006 — Trợ lý AI hoàn thiện nội dung hồ sơ

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-006 |
| Phiên bản | 1.0 |
| Vai trò | Người tìm việc đã đăng nhập |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Người tìm việc thường viết giới thiệu bản thân và mô tả kinh nghiệm rất sơ sài, làm hồ sơ kém sức
cạnh tranh. Hệ thống cung cấp trợ lý AI làm hai việc khác nhau:

- **Viết lại** một đoạn người dùng đã có, theo một giọng văn được chọn.
- **Tạo mới** mô tả kinh nghiệm từ các trường đã điền (công ty, chức danh, thời gian), khi người dùng để trống phần mô tả.

Giọng văn quan sát được trong dữ liệu test: Chuyên nghiệp, Thuyết phục, Ngắn gọn dễ đọc. Người dùng
áp được nhiều giọng nối tiếp nhau lên cùng một nội dung.

## Acceptance criteria

### AC-020 — Viết lại giới thiệu bản thân bằng AI theo nhiều giọng văn nối tiếp

**Given** tôi đang mở form Giới thiệu bản thân tại trang Hồ sơ của tôi
**When** tôi nhập một đoạn giới thiệu và yêu cầu AI viết lại theo giọng Chuyên nghiệp, rồi tiếp tục viết lại theo giọng Thuyết phục
**Then** nội dung giới thiệu phải được thay bằng bản AI viết lại sau mỗi lần
**And** tôi lưu lại được nội dung đó

- Trạng thái: Inferred — spec không có assertion nào so sánh nội dung trước và sau khi AI viết lại, nên "AI có thực sự đổi nội dung" chưa từng được chứng minh ở tầng spec.
- Ràng buộc quan sát được: giọng văn áp nối tiếp lên kết quả của lần trước, không phải áp lại từ đoạn gốc.
- Nguồn: tests/e2e/desktop/profile_ai_writing-bdd.spec.js, tests/e2e/mobile-web/profile_ai_writing-bdd.mobile.spec.js

### AC-021 — Tạo mô tả kinh nghiệm bằng AI khi phần mô tả để trống

**Given** tôi đang mở form Kinh nghiệm làm việc và đã điền công ty, chức danh, thời gian bắt đầu, còn phần mô tả để trống
**When** tôi yêu cầu AI tạo mô tả rồi viết lại theo giọng Thuyết phục và Ngắn gọn dễ đọc
**Then** phần mô tả kinh nghiệm phải được AI điền nội dung
**And** tôi lưu lại được mục kinh nghiệm đó

- Trạng thái: Inferred — không có assertion nào kiểm chứng nội dung sinh ra.
- Ràng buộc quan sát được: AI tạo mô tả dựa trên các trường đã điền, nên các trường đó phải có trước.
- Nguồn: tests/e2e/desktop/profile_ai_writing-bdd.spec.js, tests/e2e/mobile-web/profile_ai_writing-bdd.mobile.spec.js

## Nghiệp vụ CHƯA được automation phủ

| Nhánh | Vì sao đáng ngờ |
|---|---|
| AI trả lỗi hoặc quá thời gian chờ | Nhánh lỗi của dịch vụ bên thứ ba đang hoàn toàn trống |
| Giới hạn số lần dùng AI | Nếu sản phẩm có quota thì chưa ai kiểm |
| Yêu cầu AI viết lại khi nội dung gốc rỗng | Chưa biết hệ thống chặn hay vẫn sinh nội dung |
| Hoàn tác bản AI viết lại để về nội dung gốc | Không có spec nào |
| Chất lượng nội dung AI sinh ra | Không automation được bằng assertion; thuộc kiểm thử thủ công |

## Open questions

1. Danh sách giọng văn đầy đủ gồm những gì? Dữ liệu test chỉ dùng ba giọng. — **Đã chốt (Hà Đinh, 2026-09-24):** mới chỉ có 3 giọng văn đó thôi, chưa có những thông tin mới nếu thay đổi
2. Có giới hạn số lần dùng AI trên mỗi người dùng hoặc mỗi ngày không? — **Đã chốt (Hà Đinh, 2026-09-24):** có, nhưng tôi không muốn test case đó.
3. Khi dịch vụ AI lỗi, hệ thống hiển thị gì cho người dùng? — **Đã chốt (Hà Đinh, 2026-09-24):** hiển thị popup báo lỗi
4. Nội dung AI sinh ra được kiểm duyệt trước khi lưu vào hồ sơ không? — **Đã chốt (Hà Đinh, 2026-09-24):** không cần kiểm duyệt, user sẽ tự chịu trách nhiệm là dùng hay không dùng thông tin do AI sinh ra
