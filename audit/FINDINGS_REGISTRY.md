# SỔ THEO DÕI PHÁT HIỆN THẨM ĐỊNH (AUDIT FINDINGS REGISTRY)

> [!WARNING]
> **QUY TẮC BẢO TOÀN TÍNH KHÁCH QUAN (Standard 04 §2.10 & §11.1):**
> 1. Trạng thái `CLAIMED_FIXED` chỉ là tuyên bố của người sửa.
> 2. Người nạp registry **TUYỆT ĐỐI KHÔNG TỰ KIỂM CHỨNG RỒI ĐIỀN SẴN `RE-OPENED` HOẶC `CLOSED`**.
> 3. Trạng thái `RE-OPENED` và `CLOSED` **CHỈ DO AUDITOR ĐẶT** sau khi chạy lại repro và kiểm tra test hồi quy tự động.

---

## 1. Bảng Theo Dõi Vòng Đời Findings

| ID | Ngày | Mức (P0-P3) | Chiều Audit | Vị Trí Script | Tóm Tắt | Owner | Trạng Thái | Test Bảo Vệ |
|:---:|:---:|:---:|---|---|---|:---:|:---:|---|
| AUTO-01 | 2026-09-21 | P1 | Test Stability | `tests/e2e/mobile-web/job-search.spec.js` | Flaky test tại popover chọn ngành nghề mobile khi load mạng chậm | @qa-mobile | OPEN | `tests/e2e/mobile-web/job-search.spec.js` |
| AUTO-02 | 2026-09-21 | P0 | Maintainability | `pages/desktop/JobDetailPage.js` | Selector `//button[contains(.,'Nộp ngay')]` dễ vỡ khi đổi text UI i18n | @qa-lead | OPEN | `tests/e2e/desktop/apply-job.spec.js` |
| AUTO-03 | 2026-09-21 | P1 | Coverage Gap | `tests/e2e/desktop/employer-login.spec.js` | Thiếu kịch bản test cho nhà tuyển dụng đăng nhập bằng OTP | @qa-desktop | OPEN | `tests/e2e/desktop/employer-login.spec.js` |

---

## 2. Quy Định Quản Trị Vòng Đời
- `OPEN`: Mới phát hiện qua quá trình audit hoặc chạy suite kiểm thử.
- `IN_PROGRESS`: Đang tiến hành sửa đổi kịch bản kiểm thử hoặc cập nhật Page Object.
- `CLAIMED_FIXED`: Kỹ sư kiểm thử tuyên bố đã sửa xong và đã bổ sung assertion/test bảo vệ.
- `CLOSED`: Auditor độc lập xác nhận lỗi đã hết và test suite hồi quy chạy xanh 100%.
