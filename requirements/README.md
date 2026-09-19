# requirements/

Tài liệu nghiệp vụ của dự án. Mỗi file là một requirement mang mã REQ-xxx, bên trong chứa các
acceptance criterion mang mã AC-yyy viết theo Given/When/Then.

Thư mục này **thuộc về dự án**, không bao giờ bị Hub ghi đè.

## Cách đọc

Toàn bộ nội dung ở đây được **dựng ngược từ automation đang chạy** (quy trình tại
`ai/shared/AI_PROMPTS.md` mục 3.4), không phải do Product Owner viết ra trước. Vì vậy mỗi kết luận
đều mang một trong ba trạng thái:

| Trạng thái | Nghĩa |
|---|---|
| Confirmed | Có assertion trong spec chứng minh trực tiếp |
| Inferred | Suy ra từ bước BDD, dữ liệu test hoặc tên Page Object, chưa có assertion chứng minh |
| Needs confirmation | Cần người hiểu nghiệp vụ xác nhận; có thể sai |

Không dùng tài liệu này làm nguồn chuẩn nghiệp vụ cho tới khi các mục Needs confirmation được PO/BA
duyệt. Nó tồn tại để **lộ ra chỗ automation đang kiểm cái gì và bỏ sót cái gì**.

## Quy ước

- Không đổi ID sau khi đã dùng trong test case hoặc script. Đổi lớn thì tăng version, giữ nguyên ID.
- Mã AC là duy nhất trên toàn bộ thư mục, không đánh lại số theo từng requirement.
- Không chép selector, URL hay chi tiết framework vào đây — chỉ ghi quy tắc nghiệp vụ.

## Kiểm tra

    node scripts/qa-trace.js

hoặc mở view **Tiện ích -> QA Docs & Automation** trên dashboard.
