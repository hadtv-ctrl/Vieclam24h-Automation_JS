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
| TC-038 | AC-008 | Ứng tuyển công việc với tài khoản chưa xác thực số điện thoại (Yêu cầu xác thực OTP) | P0 | candidate | - |
| TC-039 | AC-008 | Ứng tuyển thất bại khi nhập sai mã OTP xác thực số điện thoại | P1 | candidate | - |
| TC-040 | AC-008 | Ứng tuyển trực tiếp thành công không cần OTP với tài khoản đã xác thực số điện thoại | P1 | candidate | - |
| TC-041 | AC-011 | Chặn ứng tuyển lại cùng một việc làm trong cùng một ngày | P0 | candidate | - |
| TC-042 | AC-011 | Cho phép ứng tuyển lại cùng một việc làm sang ngày khác (Khác ngày nộp trước) | P1 | candidate | - |
| TC-043 | AC-010 | Nộp hồ sơ hàng loạt (Bulk apply) cho tất cả danh sách việc làm tương tự | P1 | candidate | - |
| TC-044 | AC-009 | Ứng tuyển bằng Hồ sơ của tôi khi chưa có CV file nhưng đã hoàn tất thông tin hồ sơ và ghi chú | P1 | candidate | - |
| TC-045 | AC-009 | Chặn ứng tuyển bằng Hồ sơ trực tuyến khi chưa hoàn thành các thông tin ghi chú bắt buộc | P1 | candidate | - |
| TC-046 | AC-008 | Kiểm thử hành vi theo quyết định: Trong bảy mục của hồ sơ trực tuyến, mục nào bắt buộc để nộp được? — | P2 | candidate | - |
| TC-047 | AC-010 | Nộp hàng loạt (Bulk apply) các việc làm tương tự khi tài khoản chưa xác thực số điện thoại | P1 | candidate | - |
| TC-048 | AC-010 | Kiểm tra xử lý danh sách Bulk Apply khi chứa việc làm đã ứng tuyển trong ngày | P1 | candidate | - |
| TC-049 | AC-008 | Hủy bỏ modal xác thực OTP trong quá trình ứng tuyển công việc | P2 | candidate | - |
| TC-050 | AC-011 | Ứng tuyển lại cùng 1 công việc qua ranh giới nửa đêm (Midnight boundary: 23:59 ngày N sang 00:01 ngày N+1) | P2 | candidate | - |
| TC-051 | AC-008 | Ứng tuyển thành công bằng file CV tải lên khi tất cả 7 mục trong Hồ sơ trực tuyến để trống | P1 | candidate | - |
| TC-052 | AC-010 | Thực hiện Bulk Apply khi bỏ chọn tất cả các việc làm trong danh sách gợi ý việc làm tương tự | P2 | candidate | - |

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


### TC-038 — Ứng tuyển công việc với tài khoản chưa xác thực số điện thoại (Yêu cầu xác thực OTP)

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản ứng viên đã đăng nhập nhưng SĐT chưa được xác thực trong hệ thống.
- **Dữ liệu kiểm thử:** Job ID: JOB_100, SĐT: 0901234567, Mã OTP đúng: 123456
> *Ghi chú nghiệp vụ:* Theo Q-3: User chưa xác thực SĐT phải thực hiện xác thực OTP khi ứng tuyển để chống spam.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Vào trang chi tiết việc làm JOB_100 và nhấn 'Ứng tuyển ngay'. | Hệ thống hiển thị popup yêu cầu xác thực OTP số điện thoại. |
| 2 | Nhập mã OTP hợp lệ '123456' và nhấn 'Xác nhận'. | Hệ thống xác thực SĐT thành công, hoàn tất quá trình ứng tuyển và hiển thị thông báo ứng tuyển thành công. |


### TC-039 — Ứng tuyển thất bại khi nhập sai mã OTP xác thực số điện thoại

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản ứng viên chưa xác thực số điện thoại.
- **Dữ liệu kiểm thử:** Job ID: JOB_100, Mã OTP sai: 000000
> *Ghi chú nghiệp vụ:* Theo Q-3: Đảm bảo cơ chế chống spam/tài khoản ảo thông qua kiểm tra OTP sai.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn ứng tuyển việc làm JOB_100. | Hiển thị popup yêu cầu nhập mã OTP. |
| 2 | Nhập mã OTP sai '000000' và nhấn 'Xác nhận'. | Hệ thống hiển thị thông báo mã OTP không hợp lệ, ứng tuyển không thành công. |


### TC-040 — Ứng tuyển trực tiếp thành công không cần OTP với tài khoản đã xác thực số điện thoại

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản đã đăng nhập và SĐT đã ở trạng thái 'Đã xác thực'.
- **Dữ liệu kiểm thử:** Job ID: JOB_101
> *Ghi chú nghiệp vụ:* Theo Q-3: Người dùng đã xác thực SĐT từ trước thì không cần bước OTP khi ứng tuyển.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Vào chi tiết JOB_101, tải CV/chọn CV và nhấn 'Ứng tuyển ngay'. | Hệ thống không hiển thị popup OTP, nộp hồ sơ thành công ngay lập tức. |


### TC-041 — Chặn ứng tuyển lại cùng một việc làm trong cùng một ngày

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Ứng viên đã ứng tuyển thành công công việc JOB_102 vào ngày hiện tại.
- **Dữ liệu kiểm thử:** Job ID: JOB_102, Ngày ứng tuyển: Ngày hiện tại (Current Date)
> *Ghi chú nghiệp vụ:* Theo Q-4: Trong 1 ngày chỉ được ứng tuyển 1 việc làm đó tối đa 1 lần.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập lại trang chi tiết việc làm JOB_102 trong cùng ngày. | Nút 'Ứng tuyển' hiển thị trạng thái đã nộp / vô hiệu hóa hoặc nhấn vào hiển thị cảnh báo bạn đã ứng tuyển công việc này hôm nay. |
| 2 | Cố tình bấm nút ứng tuyển lại (nếu có). | Hệ thống chặn thao tác và thông báo: Mỗi ngày chỉ được ứng tuyển 1 lần cho công việc này. |


### TC-042 — Cho phép ứng tuyển lại cùng một việc làm sang ngày khác (Khác ngày nộp trước)

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Ứng viên đã ứng tuyển JOB_102 vào ngày hôm qua (T-1).
- **Dữ liệu kiểm thử:** Job ID: JOB_102, Ngày nộp trước: YYYY-MM-DD (Hôm qua)
> *Ghi chú nghiệp vụ:* Theo Q-4: Người dùng có thể ứng tuyển cùng 1 việc nhiều lần nhưng phải khác ngày.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trang chi tiết JOB_102 vào ngày hôm nay. | Hệ thống cho phép thực hiện ứng tuyển (Nút 'Ứng tuyển lại' / 'Nộp hồ sơ' hoạt động). |
| 2 | Thực hiện nộp hồ sơ ứng tuyển. | Ứng tuyển thành công và ghi nhận lượt ứng tuyển mới cho ngày hôm nay. |


### TC-043 — Nộp hồ sơ hàng loạt (Bulk apply) cho tất cả danh sách việc làm tương tự

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Vừa ứng tuyển thành công JOB_100, danh sách việc làm tương tự hiển thị N công việc (ví dụ 5 jobs).
- **Dữ liệu kiểm thử:** Danh sách Job tương tự: [JOB_201, JOB_202, JOB_203, JOB_204, JOB_205]
> *Ghi chú nghiệp vụ:* Theo Q-2: Có thể nộp tất cả các job xuất hiện trong danh sách việc làm tương tự của job vừa nộp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại popup/màn hình gợi ý sau khi nộp, chọn tất cả 5 việc làm tương tự. | Tất cả các việc làm tương tự đều được tích chọn. |
| 2 | Nhấn nút 'Nộp ứng tuyển hàng loạt'. | Hệ thống xử lý nộp thành công hồ sơ đến tất cả 5 công việc đã chọn và cập nhật danh sách đã ứng tuyển. |


### TC-044 — Ứng tuyển bằng Hồ sơ của tôi khi chưa có CV file nhưng đã hoàn tất thông tin hồ sơ và ghi chú

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản ứng viên chưa tải file CV up lên, nhưng phần 'Hồ sơ của tôi' đã điền đủ thông tin bắt buộc và phần ghi chú bổ sung đã hoàn tất.
- **Dữ liệu kiểm thử:** Profile ID: PROF_888, Không đính kèm file CV
> *Ghi chú nghiệp vụ:* Theo Q-1: Chỉ cần có thông tin trong Hồ sơ của tôi cùng các ghi chú hoàn thành là đủ điều kiện nộp mà không bắt buộc tải file CV.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn phương thức 'Sử dụng Hồ sơ trực tuyến (Hồ sơ của tôi)'. | Hệ thống xác nhận hồ sơ đủ điều kiện nộp. |
| 2 | Nhấn 'Ứng tuyển'. | Hệ thống ghi nhận đơn ứng tuyển thành công mà không yêu cầu bắt buộc đính kèm file CV. |


### TC-045 — Chặn ứng tuyển bằng Hồ sơ trực tuyến khi chưa hoàn thành các thông tin ghi chú bắt buộc

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản ứng viên chưa tải CV và chưa điền đầy đủ các thông tin/ghi chú bắt buộc trong Hồ sơ trực tuyến.
- **Dữ liệu kiểm thử:** Profile chưa hoàn thành mục thông tin ghi chú bên ngoài bắt buộc
> *Ghi chú nghiệp vụ:* Theo Q-1: Nếu dùng Hồ sơ trực tuyến thì các thông tin ghi chú bên ngoài bắt buộc phải hoàn thành mới được apply.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn nộp bằng Hồ sơ trực tuyến và nhấn 'Ứng tuyển'. | Hệ thống báo lỗi/cảnh báo yêu cầu hoàn thiện đầy đủ các thông tin ghi chú bắt buộc trước khi nộp. |


### TC-046 — Kiểm thử hành vi theo quyết định: Trong bảy mục của hồ sơ trực tuyến, mục nào bắt buộc để nộp được? —

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt
> *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: chỉ cần có CV - tức hồ sơ trực tuyến, hoặc có thể ứng tuyển bằng các thông tin trong Hồ sơ của tôi với các thông tin ghi chú bên ngoài hoàn thành là User có thể apply

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: chỉ cần có CV - tức hồ sơ trực tuyến, hoặc có thể ứng tuyển bằng các thông tin trong Hồ sơ của tôi v | Hệ thống phản hồi đúng theo quyết định đã chốt |


### TC-047 — Nộp hàng loạt (Bulk apply) các việc làm tương tự khi tài khoản chưa xác thực số điện thoại

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã đăng nhập, tài khoản CHƯA xác thực số điện thoại, vừa nộp thành công 1 việc làm và màn hình hiển thị danh sách việc làm tương tự.
- **Dữ liệu kiểm thử:** SĐT: 0901234567, Danh sách việc làm tương tự: 3 việc làm
> *Ghi chú nghiệp vụ:* Kết hợp quyết định Q-2 (Bulk apply) và Q-3 (Bắt buộc xác thực OTP với tài khoản chưa xác thực SĐT để chống spam).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn tất cả công việc trong danh sách việc làm tương tự. | Các checkbox công việc tương tự được chọn. |
| 2 | Nhấn nút 'Nộp hồ sơ hàng loạt' (Bulk apply). | Hệ thống hiển thị pop-up yêu cầu xác thực OTP số điện thoại trước khi thực hiện nộp hàng loạt. |
| 3 | Nhập mã OTP hợp lệ được gửi về SĐT và nhấn 'Xác nhận'. | Số điện thoại được xác thực thành công, hệ thống tiến hành nộp hồ sơ hàng loạt cho các việc làm đã chọn và báo kết quả ứng tuyển thành công. |


### TC-048 — Kiểm tra xử lý danh sách Bulk Apply khi chứa việc làm đã ứng tuyển trong ngày

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã nộp Job A vào lúc 09:00 sáng cùng ngày. Hiện tại người dùng thực hiện nộp Job B và màn hình gợi ý việc làm tương tự hiển thị Job A.
- **Dữ liệu kiểm thử:** Job A (đã nộp hôm nay), Job C (chưa nộp)
> *Ghi chú nghiệp vụ:* Kết hợp Q-2 (Bulk apply) và Q-4 (Chặn nộp cùng 1 việc nhiều lần trong 1 ngày). Cần đảm bảo hệ thống loại bỏ hoặc cảnh báo việc làm đã nộp trong ngày khỏi danh sách nộp lại.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tích chọn Job A và Job C trong danh sách việc làm tương tự. | Checkbox của Job A và Job C được tích chọn (hoặc Job A hiển thị trạng thái Đã ứng tuyển/Disabled checkbox). |
| 2 | Nhấn nút 'Nộp hồ sơ hàng loạt'. | Hệ thống chỉ nộp thành công cho Job C, hiển thị thông báo chi tiết: Job C ứng tuyển thành công, Job A bị bỏ qua do đã nộp trong ngày. |


### TC-049 — Hủy bỏ modal xác thực OTP trong quá trình ứng tuyển công việc

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản chưa xác thực SĐT. Người dùng chọn 1 công việc và bấm 'Ứng tuyển ngay'. Pop-up OTP đang hiển thị.
- **Dữ liệu kiểm thử:** Job ID: JOB-TEST-01
> *Ghi chú nghiệp vụ:* Luồng rẽ nhánh (Negative/Cancel flow) của quyết định Q-3: Khi người dùng đóng pop-up OTP thì hồ sơ không được nộp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn biểu tượng nút 'X' (Đóng) hoặc nút 'Hủy' trên pop-up xác thực OTP. | Pop-up OTP đóng lại. Trạng thái công việc vẫn giữ nguyên chưa nộp. |
| 2 | Truy cập trang 'Danh sách việc làm đã ứng tuyển'. | Công việc JOB-TEST-01 KHÔNG xuất hiện trong danh sách đã ứng tuyển. |


### TC-050 — Ứng tuyển lại cùng 1 công việc qua ranh giới nửa đêm (Midnight boundary: 23:59 ngày N sang 00:01 ngày N+1)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng ứng tuyển công việc JOB-BOUNDARY vào lúc 23:59:00 ngày 15/10/2023.
- **Dữ liệu kiểm thử:** Job ID: JOB-BOUNDARY, Thời điểm nộp 1: 23:59:00 15/10/2023, Thời điểm nộp 2: 00:01:00 16/10/2023
> *Ghi chú nghiệp vụ:* Kiểm thử giá trị biên (BVA) cho quyết định Q-4 (Không cho nộp cùng việc trong 1 ngày, nhưng cho nộp sang ngày khác).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại thời điểm 23:59 ngày 15/10, nộp hồ sơ công việc JOB-BOUNDARY. | Ứng tuyển thành công lần 1. |
| 2 | Thử nhấn ứng tuyển lại ngay tại 23:59:45 ngày 15/10. | Hệ thống chặn và hiển thị thông báo đã nộp công việc này trong ngày. |
| 3 | Chờ đến 00:01 ngày 16/10 và nhấn ứng tuyển lại công việc JOB-BOUNDARY. | Hệ thống cho phép nộp hồ sơ thành công lần 2 vì đã chuyển sang ngày mới. |


### TC-051 — Ứng tuyển thành công bằng file CV tải lên khi tất cả 7 mục trong Hồ sơ trực tuyến để trống

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản đã đăng nhập, có file CV đã upload thành công. Cả 7 mục thông tin trong Hồ sơ trực tuyến (Kinh nghiệm, Học vấn, Kỹ năng,...) đều trống.
- **Dữ liệu kiểm thử:** File CV: Developer_Resume.pdf
> *Ghi chú nghiệp vụ:* Kiểm thử ca biên theo Q-1: Chỉ cần có CV tải lên là đủ điều kiện nộp, không bắt buộc phải nhập 7 mục thông tin trong hồ sơ trực tuyến.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chi tiết một công việc bất kỳ và nhấn nút 'Ứng tuyển'. | Màn hình ứng tuyển hiển thị tùy chọn nộp bằng CV tải lên. |
| 2 | Chọn phương thức ứng tuyển bằng file CV 'Developer_Resume.pdf' và nhấn 'Gửi hồ sơ'. | Hệ thống xử lý ứng tuyển thành công mà không yêu cầu bổ sung 7 mục hồ sơ trực tuyến. |


### TC-052 — Thực hiện Bulk Apply khi bỏ chọn tất cả các việc làm trong danh sách gợi ý việc làm tương tự

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Màn hình gợi ý công việc tương tự đang hiển thị danh sách 5 việc làm.
- **Dữ liệu kiểm thử:** Bỏ tích 5/5 checkbox công việc tương tự
> *Ghi chú nghiệp vụ:* Negative test cho Q-2 (Bulk apply): Người dùng xóa tích chọn toàn bộ việc làm tương tự trước khi bấm nộp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bỏ tích chọn (uncheck) tất cả checkbox của các công việc trong danh sách việc làm tương tự. | Nút 'Nộp hồ sơ hàng loạt' bị vô hiệu hóa (disabled) hoặc số lượng việc chọn hiển thị là 0. |
| 2 | Cố gắng nhấn nút 'Nộp hồ sơ hàng loạt' (nếu nút không disabled). | Hệ thống hiển thị cảnh báo 'Vui lòng chọn ít nhất 1 việc làm để ứng tuyển'. |
