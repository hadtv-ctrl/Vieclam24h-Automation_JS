# Test case — REQ-014 Tìm kiếm việc làm với link dài, xử lý lỗi HTTP 431 (JS-8865)

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-182 | AC-078 | Bỏ cookie form tìm kiếm và giới hạn cookie lịch sử trang trước tối đa 200 ký tự | P1 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-183 | AC-078 | Link quay lại sau đăng nhập không lưu trong cookie và giữ nguyên bộ lọc quận/huyện | P1 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-184 | AC-079 | Link tìm kiếm dài bị máy chủ trả 431 được tự khôi phục qua trang khôi phục | P0 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-185 | AC-080 | Link vượt giới hạn API tìm kiếm bị chặn và hiện cảnh báo | P0 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-186 | AC-081 | Trang khôi phục không gửi tracking event | P2 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-187 | AC-082 | Trang khôi phục có robots noindex, nofollow | P2 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-188 | AC-082 | Trang tìm kiếm thường có kết quả giữ robots index, follow | P2 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |
| TC-189 | AC-083 | Cookie độc lập quá lớn hiện màn hình lỗi có Tìm lại / Về trang chủ | P1 | Có | tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js |

## Chi tiết

Chung cho mọi TC:
- **Loại:** Chức năng / Phi chức năng | **Kỹ thuật:** Boundary value theo độ dài link và cookie; fault injection (cookie đệm)
- **Tiền điều kiện:** Khách vãng lai, Desktop, môi trường QC.
- **Dữ liệu:** dãy ID quận/huyện dạng số sinh trong spec (số lượng và độ dài ID quyết định kích thước link).
- **Mã cũ trong spec:** TC-182…TC-189 tương ứng `TC-JS8865-01`…`TC-JS8865-08`.

### TC-182 — Bỏ cookie form tìm kiếm và giới hạn cookie lịch sử trang trước

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chủ, đóng popup | Trang chủ hiển thị |
| 2 | Mở trang tìm việc với 120 quận/huyện | Không có cookie form tìm kiếm việc làm / hồ sơ; cookie lịch sử trang trước (nếu có) ≤ 200 ký tự |

### TC-183 — Link quay lại sau đăng nhập không lưu trong cookie

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang tìm việc với 80 quận/huyện | Trang hiển thị |
| 2 | Bấm Đăng nhập trên thanh điều hướng | Không có cookie link quay lại; giá trị lưu ở bộ nhớ trình duyệt (nếu có) chứa trang tìm việc và bộ lọc quận/huyện |

### TC-184 — Link tìm kiếm dài được tự khôi phục

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thêm cookie đệm 1,5 KB, mở link tìm việc ~6,3 KB (900 quận/huyện) | Máy chủ trả 431, trình duyệt đi qua trang khôi phục |
| 2 | Chờ trang ổn định | Link cuối giữ đủ bộ lọc quận/huyện, không còn dấu hiệu trang khôi phục; API tìm kiếm được gọi với đủ quận/huyện; không hiện cảnh báo |

### TC-185 — Link vượt giới hạn API tìm kiếm bị chặn

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở link tìm việc ~7,7 KB (700 quận/huyện, ID 10 chữ số) | Máy chủ trả 431, trình duyệt đi qua trang khôi phục |
| 2 | Chờ trang ổn định | Hiện cảnh báo; link về tìm kiếm mặc định không còn bộ lọc quận/huyện; API tìm kiếm không được gọi với bộ lọc đó |

### TC-186 — Trang khôi phục không gửi tracking event

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở thẳng trang khôi phục | Không có request tracking mang `Page View`, `Job Search Performed`, `JS_SearchPage`, `AB test exposure` |

### TC-187 — Trang khôi phục có robots noindex, nofollow

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở thẳng trang khôi phục | Thẻ robots chứa `noindex` và `nofollow` |

### TC-188 — Trang tìm kiếm thường giữ robots index, follow

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang tìm việc mặc định, đóng popup | Danh sách việc làm hiển thị; thẻ robots chứa `index`, `follow`, không chứa `noindex` |

### TC-189 — Cookie độc lập quá lớn hiện màn hình lỗi

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Gài 3 cookie 2,5 KB (tổng 7,5 KB) không liên quan tới tìm kiếm trên host của môi trường | Cookie được gửi kèm request |
| 2 | Mở trang tìm việc | Hiện màn hình "Không thể mở liên kết này" có lựa chọn Tìm lại / Về trang chủ |

## Case không automation

| Hành vi | Lý do | Bù đắp |
|---|---|---|
| Mobile Web 414/360 | Chưa có spec mobile cho luồng link dài (Q-014-04) | Verify thủ công khi regression JS-8865 |
| Cookie độc lập trên ~8,2 KB | Gateway trả trang lỗi thô HTTP 400 trước khi tới ứng dụng; kỳ vọng chưa chốt (Q-014-01) | Verify thủ công, đã quan sát trên QC 12/11/2026 |
| Link ≥ 750 quận/huyện với ID 10 chữ số (~8,3 KB) | Bị nginx trả 414 trước khi tới ứng dụng, ticket ghi rõ không tái hiện được | Không kiểm; ghi nhận giới hạn hạ tầng |
