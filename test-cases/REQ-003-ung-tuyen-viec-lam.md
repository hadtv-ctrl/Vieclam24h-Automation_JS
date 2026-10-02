# Test case — REQ-003 Ứng tuyển việc làm bằng CV hoặc hồ sơ trực tuyến

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-009 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên desktop | P0 | Có | tests/e2e/desktop/apply_job_with_CV_flow-bdd.spec.js |
| TC-010 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên mobile web | P0 | Có | tests/e2e/mobile-web/apply_job_with_CV_flow-bdd.mobile.spec.js |
| TC-011 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên desktop | P1 | Có | tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js |
| TC-012 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_with_profile_flow-bdd.mobile.spec.js |
| TC-036 | AC-008 | Tải lên file CV sai định dạng hoặc quá dung lượng | P1 | Có | tests/e2e/desktop/tai-len-cv-sai-dinh-dang.spec.js |
| TC-037 | AC-011 | Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển) | P0 | Có | tests/e2e/desktop/kiem-tra-trang-thai-viec-lam-da-ung-tuyen.spec.js |
| TC-042 | AC-008 AC-009 | Kiểm thử chu trình xác thực OTP và điều kiện hoàn thiện hồ sơ khi nộp ứng tuyển (tài khoản chưa/đã xác thực OTP, hủy bỏ OTP, nộp bằng CV file vs Hồ sơ trực tuyến) | P2 | Có | tests/e2e/desktop/kiem-thu-chu-trinh-xac-thuc-otp-va-dieu-kien-hoan-thien-ho-so.spec.js |
| TC-043 | AC-011 | Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc (chặn nộp lại trong ngày, cho phép sang ngày mới và kiểm thử điểm biên thời gian) | P2 | Có | tests/e2e/desktop/kiem-thu-quy-tac-kiem-soat-tan-suat-nop-lai-ho-so-cho-cung-mot-cong-viec.spec.js |
| TC-044 | AC-010 | Nộp hồ sơ hàng loạt (Bulk Apply) kèm các điều kiện biên | P2 | Có | tests/e2e/desktop/nop-ho-so-hang-loat-bulk-apply.spec.js |


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


### TC-036 — Tải lên file CV sai định dạng hoặc quá dung lượng

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Negative Validation
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập và đang ở popup chọn phương thức ứng tuyển bằng CV
- **Dữ liệu kiểm thử:** File không hợp lệ hoặc sai định dạng cho phép
- > *Ghi chú nghiệp vụ:* Đảm bảo hệ thống chặn file sai extension và hiển thị hướng dẫn định dạng hợp lệ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tải lên file sai định dạng hoặc không hợp lệ | Hệ thống hiển thị thông báo lỗi định dạng file không được hỗ trợ |
| 2 | Kiểm tra nút tiếp tục | Hệ thống không cho phép tiếp tục luồng nộp hồ sơ |


### TC-037 — Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển)

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Ràng buộc chống trùng lặp / Trạng thái việc làm
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập và mở lại chi tiết việc làm đã ứng tuyển thành công trước đó
- **Dữ liệu kiểm thử:** Việc làm đã nộp trong tài khoản
- > *Ghi chú nghiệp vụ:* Tránh ứng viên vô tình nộp trùng lặp và xác thực trạng thái ghi nhận hồ sơ của nhà tuyển dụng.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chi tiết việc làm đã từng ứng tuyển thành công | Trang chi tiết việc làm hiển thị |
| 2 | Kiểm tra nút ứng tuyển | Nút hiển thị trạng thái "Đã ứng tuyển" hoặc cho phép "Nộp lại hồ sơ" thay vì nút ứng tuyển lần đầu thông thường |


### TC-042 — Kiểm thử chu trình xác thực OTP và điều kiện hoàn thiện hồ sơ khi nộp ứng tuyển

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Luồng kiểm thử liên hoàn / Rẽ nhánh ngoại lệ
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/kiem-thu-chu-trinh-xac-thuc-otp-va-dieu-kien-hoan-thien-ho-so.spec.js`
- **Tiền điều kiện:** Người dùng đã đăng nhập tài khoản ứng viên, mở trang chi tiết việc làm cần ứng tuyển.
- **Dữ liệu kiểm thử:**
  - File CV tải lên: `TemplateCV.pdf`
  - Hồ sơ trực tuyến: Đầy đủ thông tin cá nhân và ghi chú bổ sung
  - Mã OTP môi trường test: `1111` (mã sai: `0000`)
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử điều kiện hồ sơ và OTP trước đây. Kiểm chứng quy định Q-1 (chỉ cần CV tải lên hoặc Hồ sơ của tôi đủ ghi chú là đủ điều kiện nộp) và Q-3 (bắt buộc xác thực OTP với tài khoản chưa xác minh SĐT, xử lý OTP sai và hủy bỏ modal).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Dùng tài khoản chưa xác thực SĐT, chọn nộp bằng Hồ sơ trực tuyến khi chưa điền ghi chú bắt buộc | Hệ thống cảnh báo yêu cầu hoàn tất thông tin ghi chú bắt buộc trước khi nộp |
| 2 | Hoàn tất ghi chú và bấm Ứng tuyển ngay | Hệ thống kích hoạt popup xác thực mã OTP số điện thoại để chống spam |
| 3 | Bấm đóng (X) hoặc Hủy popup OTP | Popup đóng lại, hồ sơ chưa được nộp, trạng thái việc làm giữ nguyên |
| 4 | Bấm Ứng tuyển lại, nhập mã OTP sai `0000` | Hệ thống báo lỗi mã OTP không hợp lệ, không cho phép nộp |
| 5 | Nhập mã OTP đúng `1111` và xác nhận | Xác thực thành công, ghi nhận hồ sơ ứng tuyển vào hệ thống |
| 6 | Kiểm thử ca biên nộp bằng file CV khi cả 7 mục hồ sơ trực tuyến để trống | Hệ thống chấp nhận nộp bằng file CV hợp lệ mà không đòi hỏi 7 mục thông tin |


### TC-043 — Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Temporal boundary
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/kiem-thu-quy-tac-kiem-soat-tan-suat-nop-lai-ho-so-cho-cung-mot-cong-viec.spec.js`
- **Tiền điều kiện:** Tài khoản ứng viên đã nộp thành công công việc `JOB_BOUNDARY_102`.
- **Dữ liệu kiểm thử:** Job ID: `JOB_BOUNDARY_102`, mốc thời gian cùng ngày vs khác ngày.
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử quy tắc ứng tuyển lại trước đây. Kiểm chứng quy định Q-4: Trong 1 ngày chỉ được ứng tuyển 1 việc làm đó tối đa 1 lần; cho phép nộp lại khi bước sang ngày mới (kể cả thời điểm biên qua nửa đêm 23:59 sang 00:01).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở lại trang chi tiết `JOB_BOUNDARY_102` trong cùng một ngày nộp | Nút ứng tuyển hiển thị trạng thái 'Đã ứng tuyển' / 'Nộp lại hồ sơ' kèm ghi chú đã nộp hôm nay |
| 2 | Cố tình bấm nộp lại hồ sơ trong cùng ngày | Hệ thống chặn thao tác và thông báo: 'Mỗi ngày chỉ được ứng tuyển 1 lần cho công việc này' |
| 3 | Chuyển mốc thời gian sang ngày tiếp theo (khác ngày nộp trước) và mở lại tin tuyển dụng | Hệ thống mở khóa cho phép thực hiện nộp hồ sơ lại |
| 4 | Tiến hành nộp lại hồ sơ sang ngày mới | Ứng tuyển thành công và cập nhật lượt ứng tuyển mới cho ngày hôm đó |


### TC-044 — Kiểm thử luồng nộp hồ sơ hàng loạt (Bulk Apply) kèm các điều kiện biên

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Xử lý danh sách
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/nop-ho-so-hang-loat-bulk-apply.spec.js`
- **Tiền điều kiện:** Vừa ứng tuyển thành công 1 việc làm, popup gợi ý danh sách việc làm tương tự (5 công việc) hiển thị.
- **Dữ liệu kiểm thử:** Danh sách 5 việc làm tương tự, trong đó có 1 việc làm đã được nộp trong ngày.
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử nộp hàng loạt trước đây theo quyết định Q-2, Q-3, Q-4. Kiểm tra việc chọn tất cả, bỏ chọn tất cả, lọc trừ các việc làm đã nộp trong ngày và kích hoạt OTP nếu tài khoản chưa xác thực.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bỏ chọn tất cả checkbox việc làm trong danh sách gợi ý | Nút 'Nộp hồ sơ hàng loạt' bị vô hiệu hóa hoặc báo lỗi yêu cầu chọn ít nhất 1 việc |
| 2 | Chọn lại tất cả 5 việc làm (bao gồm việc đã từng nộp trong ngày) | Hệ thống tự động nhận diện hoặc đánh dấu việc đã nộp trong ngày |
| 3 | Nhấn 'Nộp hồ sơ hàng loạt' | Hệ thống xử lý nộp cho các việc hợp lệ, bỏ qua việc đã nộp và hiển thị báo cáo chi tiết |

