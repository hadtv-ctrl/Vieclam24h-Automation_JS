# Test case — REQ-003 Ứng tuyển việc làm bằng CV hoặc hồ sơ trực tuyến

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-009 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên desktop | P0 | Có | tests/e2e/desktop/apply_job_with_CV_flow-bdd.spec.js |
| TC-010 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên mobile web | P0 | Có | tests/e2e/mobile-web/apply_job_with_CV_flow-bdd.mobile.spec.js |
| TC-011 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên desktop | P1 | Có | tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js |
| TC-012 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_with_profile_flow-bdd.mobile.spec.js |

## Chi tiết

### TC-009 và TC-010 — Ứng tuyển bằng file CV

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding và các modal chặn màn hình.
- **Dữ liệu**: đường dẫn file CV lấy từ `data/applyJobData.json`; mã OTP lấy từ `data/users.json`.
- **Các bước**: mở trang tìm việc, mở chi tiết việc làm đầu tiên (mở ở tab mới), bấm Ứng tuyển ngay, chọn ứng tuyển bằng CV, tải file CV lên, bấm Tiếp tục, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ và logo hiển thị ở bước điều kiện đầu — Có assertion.
  - Danh sách việc làm đã ứng tuyển hiển thị ở bước cuối — Ẩn trong Page Object.
  - Hồ sơ nộp thành công — **Không kiểm chứng** ở tầng spec.
  - Nộp hàng loạt có kết quả — **Không kiểm chứng**.
- **Ghi chú kiến trúc**: việc làm mở ở tab mới, và tab đó được đóng lại sau mỗi test. Nếu bước mở tab hỏng, lỗi sẽ xuất hiện ở chỗ khác chứ không tại nguyên nhân.
- **Ghi chú độ ổn định**: thời gian chờ mười phút cho cả kịch bản, đánh dấu chạy chậm.

### TC-011 và TC-012 — Ứng tuyển bằng hồ sơ trực tuyến

- **Precondition**: như trên.
- **Dữ liệu**: `data/applyJobData.json` cung cấp nội dung cho cả bảy mục hồ sơ.
- **Các bước**: mở chi tiết việc làm, bấm Ứng tuyển ngay, chọn ứng tuyển bằng hồ sơ, điền và lưu lần lượt Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Thành tựu, Chứng chỉ, Ngoại ngữ, nộp hồ sơ, xác nhận hoàn tất, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ và logo hiển thị — Có assertion.
  - **Thông báo nộp hồ sơ thành công hiển thị — Có assertion.** Đây là test case duy nhất trong nhóm ứng tuyển có bằng chứng trực tiếp về việc nộp thành công.
  - Danh sách đã ứng tuyển hiển thị — Ẩn trong Page Object.
  - Từng mục hồ sơ lưu đúng nội dung — **Không kiểm chứng**.
- **Giá trị hồi quy**: đây là kịch bản dài nhất trong repo, chạm tới cả bảy mục hồ sơ lẫn luồng nộp. Nó đáng giữ ở mức ưu tiên cao dù chậm.

## Ứng viên automation cho REQ-003

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Ứng tuyển lại việc làm đã nộp | AC-011 | Quy tắc chống trùng, ảnh hưởng trực tiếp nhà tuyển dụng | P0 |
| Xác nhận đúng việc làm vừa nộp có trong danh sách | AC-011 | Hiện chỉ kiểm danh sách hiển thị, không kiểm đúng bản ghi | P0 |
| Tải lên CV sai định dạng hoặc quá dung lượng | AC-008 | Validation ổn định, rẻ để automation | P1 |
| Nộp hồ sơ trực tuyến khi thiếu mục bắt buộc | AC-009 | Cần chốt mục bắt buộc trước, sau đó rất đáng phủ | P1 |
| Bỏ qua gợi ý nộp hàng loạt | AC-010 | Nhánh từ chối hiện hoàn toàn trống | P2 |
| Ứng tuyển việc làm đã hết hạn | AC-008 | Khó dựng dữ liệu ổn định, cân nhắc kiểm thủ công | P2 |
