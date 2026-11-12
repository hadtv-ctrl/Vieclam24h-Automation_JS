---
id: REQ-014
title: Tìm kiếm việc làm với link dài – xử lý lỗi HTTP 431 và khôi phục link (JS-8865)
status: Inferred
version: 1.0
risk: high
owner: QA
test_cases: test-cases/REQ-014-tim-kiem-url-dai-http-431.md
---

# REQ-014 — Tìm kiếm việc làm với link dài, xử lý lỗi HTTP 431 (JS-8865)

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-014 |
| Phiên bản | 1.0 (dựng ngược từ spec ngày 12/11/2026, chưa đối chiếu lại mô tả Jira) |
| Vai trò | Người tìm việc (khách vãng lai) |
| Nền tảng | Desktop web (Mobile Web chưa automation) |
| Nguồn tài liệu | Jira JS-8865 (mục 2.1–2.5, trích qua annotation trong spec); `tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js` |
| Trạng thái tổng thể | Inferred — xem trạng thái từng AC |

## 1. Tổng quan

Khi người tìm việc lọc theo rất nhiều quận/huyện, link tìm kiếm và cookie đi kèm vượt giới hạn
header của máy chủ, trang trả lỗi HTTP 431/400 thay vì kết quả. JS-8865 xử lý theo ba hướng:
giảm dữ liệu lưu trong cookie, tự khôi phục link dài ở phía trình duyệt qua một trang khôi phục
trung gian, và chặn hẳn những link vượt giới hạn của API tìm kiếm kèm cảnh báo cho người dùng.

## 2. Acceptance criteria

### AC-078 — Dữ liệu tìm kiếm không làm phình cookie
- **Given** khách vãng lai mở trang tìm việc với bộ lọc nhiều quận/huyện
- **When** trang tải xong, hoặc khách bấm Đăng nhập từ trang đó
- **Then** không còn cookie lưu toàn bộ form tìm kiếm việc làm / hồ sơ
- **And** cookie lưu lịch sử trang trước (nếu có) dài tối đa 200 ký tự
- **And** link quay lại sau đăng nhập không lưu trong cookie mà lưu ở bộ nhớ trình duyệt, giữ nguyên bộ lọc quận/huyện.
- **Trạng thái:** Confirmed cho việc bỏ cookie form và cookie link quay lại (có assertion trực tiếp);
  Inferred cho giới hạn 200 ký tự và nội dung link quay lại (assertion chỉ chạy khi giá trị tồn tại).

### AC-079 — Link tìm kiếm dài được tự khôi phục
- **Given** khách vãng lai mở link tìm kiếm dài tới mức máy chủ từ chối (HTTP 431) nhưng vẫn trong giới hạn của API tìm kiếm
- **When** trình duyệt được chuyển qua trang khôi phục
- **Then** trang tìm kiếm hiển thị lại với đầy đủ bộ lọc quận/huyện ban đầu, link cuối cùng không còn dấu hiệu trang khôi phục
- **And** API tìm kiếm được gọi lại với đầy đủ quận/huyện
- **And** không hiện cảnh báo.
- **Trạng thái:** Confirmed.

### AC-080 — Link vượt giới hạn API tìm kiếm bị chặn kèm cảnh báo
- **Given** khách vãng lai mở link tìm kiếm vượt giới hạn của API tìm kiếm (khoảng 8 KB)
- **When** trang khôi phục xử lý xong
- **Then** hiện cảnh báo yêu cầu chọn ít quận/huyện hơn
- **And** trang quay về tìm kiếm mặc định, không giữ bộ lọc quận/huyện
- **And** API tìm kiếm không được gọi với bộ lọc vượt giới hạn.
- **Trạng thái:** Confirmed.

### AC-081 — Trang khôi phục không ghi nhận tracking
- **Given** trình duyệt đang ở trang khôi phục
- **When** trang tải
- **Then** không gửi các event `Page View`, `Job Search Performed`, `JS_SearchPage`, `AB test exposure`.
- **Trạng thái:** Inferred — spec chỉ lọc request theo từ khoá trong URL (`tracking`, `analytics`, `collect`, `telemetry`),
  chưa bắt endpoint Mixpanel như REQ-013; xem Q-014-02.

### AC-082 — Chỉ thị robots đúng cho trang khôi phục và trang tìm kiếm thường
- **Given** một công cụ tìm kiếm đọc trang
- **When** đó là trang khôi phục
- **Then** thẻ robots là `noindex, nofollow`
- **And** trang tìm kiếm bình thường có kết quả vẫn được index và follow.
- **Trạng thái:** Confirmed.

### AC-083 — Cookie quá lớn không do link tìm kiếm gây ra
- **Given** trình duyệt mang một cookie rất lớn không liên quan tới tìm kiếm
- **When** khách mở trang tìm việc
- **Then** hiện màn hình báo lỗi "Không thể mở liên kết này" kèm lựa chọn Tìm lại / Về trang chủ, không lặp vô hạn qua trang khôi phục.
- **Trạng thái:** Confirmed trên QC 12/11/2026 với tổng cookie khoảng 7–7,8 KB. Trên khoảng 8,2 KB gateway trả trang lỗi
  thô "Request header or cookie too large" (HTTP 400) trước khi request tới ứng dụng — xem Q-014-01.

## 3. Quy tắc và giá trị

| Trường hợp | Kỳ vọng | Test case |
|---|---|---|
| Cookie form tìm kiếm việc làm / hồ sơ | Không tồn tại | TC-182 |
| Cookie lịch sử trang trước | ≤ 200 ký tự | TC-182 |
| Link quay lại sau đăng nhập | Không nằm trong cookie | TC-183 |
| Link dài, máy chủ trả 431, trong giới hạn API | Tự khôi phục, giữ đủ bộ lọc | TC-184 |
| Link vượt giới hạn API (~8 KB) | Chặn gọi API, hiện cảnh báo | TC-185 |
| Trang khôi phục | Không tracking; `noindex, nofollow` | TC-186, TC-187 |
| Trang tìm kiếm thường có kết quả | `index, follow` | TC-188 |
| Cookie độc lập ~7–7,8 KB | Màn hình lỗi có Tìm lại / Về trang chủ | TC-189 |
| Cookie độc lập > ~8,2 KB | Trang lỗi thô của gateway (Q-014-01) | Thủ công |

## 4. Open questions

- [ ] Q-014-01 (PO/Dev): cookie tổng trên khoảng 8,2 KB thì người dùng thấy trang lỗi thô tiếng Anh của gateway (HTTP 400),
  không có Tìm lại / Về trang chủ. Chấp nhận là giới hạn hạ tầng hay cần trang lỗi thân thiện? Quan sát trên QC 12/11/2026, chưa automation.
- [ ] Q-014-02 (QA): TC-186 có nên chuyển sang bắt Mixpanel bằng `core/deep-testing/mixpanel-capture.js` để assertion không xanh giả?
- [ ] Q-014-03 (QA): TC-182/TC-183 có nhánh assertion chỉ chạy khi cookie/giá trị tồn tại. Giá trị đó có bắt buộc phải tồn tại không?
- [ ] Q-014-04 (PO): Mobile Web có cần automation cho luồng này không?
- [ ] Q-014-05 (QA): Đối chiếu lại toàn bộ AC với mô tả gốc của Jira JS-8865 để nâng trạng thái lên Confirmed.
