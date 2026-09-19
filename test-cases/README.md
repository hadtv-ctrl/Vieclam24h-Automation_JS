# test-cases/

Test case của dự án. Mỗi file gom các test case của đúng một requirement, mang mã TC-zzz và trace
ngược về acceptance criterion trong `../requirements/`.

Thư mục này **thuộc về dự án**, không bao giờ bị Hub ghi đè.

## Cách đọc

Toàn bộ test case ở đây được **dựng ngược từ spec Playwright đang chạy**, không phải thiết kế trước
rồi mới viết script. Cột "Expected result" vì vậy phản ánh những gì spec thực sự kiểm, chứ không phải
những gì đáng lẽ phải kiểm — chỗ lệch giữa hai thứ đó được ghi rõ trong từng mục.

Ký hiệu trong phần chi tiết:

| Ký hiệu | Nghĩa |
|---|---|
| Có assertion | Spec kiểm chứng bằng assertion ở tầng spec, audit được |
| Ẩn trong Page Object | Việc kiểm chứng nằm trong Page Object, không nhìn thấy từ spec |
| Không kiểm chứng | Spec chạy qua bước này mà không kiểm gì cả |

## Quy ước

- Mã TC là duy nhất trên toàn bộ thư mục.
- Mỗi dòng trong bảng truy vết phải có đủ: mã TC, AC liên quan, ưu tiên P0 đến P3, cột Automation, đường dẫn spec.
- Cột Automation ghi "Có" khi đã có spec, "manual" khi cố ý giữ thủ công. Công cụ đọc đúng hai giá trị này.
- Desktop và mobile web là hai test case riêng vì chạy trên hai nền tảng khác nhau, dù cùng phủ một acceptance criterion.

## Kiểm tra

    node scripts/qa-trace.js
