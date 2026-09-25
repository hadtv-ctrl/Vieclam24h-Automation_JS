# Test case — REQ-002 Onboarding tiêu chí tìm việc

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-007 | AC-005 AC-006 AC-007 | Hoàn tất năm bước onboarding trên desktop | P1 | Có | tests/e2e/desktop/onboarding-bdd.spec.js |
| TC-008 | AC-005 AC-006 AC-007 | Hoàn tất năm bước onboarding trên mobile web | P1 | Có | tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js |
| TC-031 | AC-005 | Xác nhận thành công khi bỏ trống trường tùy chọn (trường tùy chọn theo quyết định) | P2 | Có | tests/e2e/desktop/xac-nhan-thanh-cong-khi-bo-trong-truong-tuy-chon-truong-tuy-.spec.js |
| TC-035 | AC-005 | Kiểm tra đóng modal onboarding giữa chừng và kiểm tra trạng thái trang chủ | P1 | Có | tests/e2e/desktop/dong-modal-onboarding-giua-chung.spec.js |
| TC-036 | AC-005 | Kiểm tra tính năng Bỏ qua (Skip) onboarding ngay từ Bước 1 | P1 | candidate | - |
| TC-037 | AC-005 | Kiểm tra không hiển thị lại modal onboarding khi đăng nhập lại sau khi đã chọn Bỏ qua | P2 | candidate | - |
| TC-038 | AC-007 | Kiểm tra sự đồng bộ dữ liệu tiêu chí khai báo từ Onboarding sang trang Tiêu chí tìm việc (REQ-005) | P0 | candidate | - |
| TC-039 | AC-006 | Kiểm tra đồng bộ dữ liệu dở dang sang Tiêu chí tìm việc (REQ-005) khi thoát/bỏ qua giữa chừng | P2 | candidate | - |

## Chi tiết

### TC-007 và TC-008 — Hoàn tất onboarding

- **Precondition**: người dùng đã đăng nhập qua fixture xác thực và modal onboarding đang mở ở bước 1.
- **Dữ liệu**: `data/onboardingData.json` gồm khu vực (nút và tùy chọn), ngành nghề, công việc mong muốn, mức lương, số năm kinh nghiệm.
- **Các bước**: chọn khu vực, chọn ngành nghề, nhập công việc mong muốn rồi chọn từ danh sách gợi ý, chọn mức lương, chọn số năm kinh nghiệm, bấm hoàn tất.
- **Expected result thực tế đang kiểm**:
  - Ô chọn khu vực hiển thị ở bước 1 — Có assertion.
  - Dropdown ngành nghề hiển thị ở bước 2 — Có assertion.
  - Ô nhập công việc mong muốn hiển thị ở bước 3 — Có assertion.
  - Danh sách gợi ý công việc hiện ra rồi ẩn đi sau khi chọn — Có assertion cả hai chiều.
  - Tiêu đề bước 5 hiển thị — Có assertion.
  - Nút hoàn tất hiển thị trước khi bấm — Có assertion.
  - Modal đóng lại sau khi hoàn tất — Có assertion.
  - Tiêu chí vừa khai được lưu lại — **Không kiểm chứng**. Không có bước nào mở lại hồ sơ để đối chiếu.
- **Điểm yếu nghiêm trọng của test case này**: bước 4 và bước 5 đều có nhánh "nếu tiêu đề bước không hiển thị thì kết thúc bước và đi tiếp". Nghĩa là nếu modal tự đóng sau bước 3, test **vẫn xanh** dù hai bước cuối chưa bao giờ chạy. Cần làm rõ nghiệp vụ ở REQ-002 rồi siết lại nhánh này.
- **Ghi chú độ ổn định**: thời gian chờ đặt tới bốn phút cho cả kịch bản, dài hơn mọi luồng khác cùng độ phức tạp.

## Ứng viên automation cho REQ-002

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Đối chiếu tiêu chí đã khai tại trang Hồ sơ sau khi hoàn tất | AC-007 | Biến onboarding từ "bấm được" thành "lưu đúng" | P0 |
| Đóng modal giữa chừng rồi đăng nhập lại | AC-005 | Quyết định dữ liệu dở dang có mất không, rủi ro dữ liệu | P1 |
| Bỏ trống một bước rồi bấm Tiếp tục | AC-006 | Xác định bước nào bắt buộc, hiện chưa ai biết | P1 |
| Quay lại bước trước và sửa lựa chọn | AC-006 | Luồng điều hướng ngược hoàn toàn chưa được phủ | P2 |
| Chọn nhiều ngành nghề cùng lúc | AC-006 | Giá trị biên của dữ liệu đầu vào | P2 |


### TC-031 — Xác nhận thành công khi bỏ trống trường tùy chọn (trường tùy chọn theo quyết định)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đang ở màn hình đăng ký / nhập liệu
- **Dữ liệu kiểm thử:** Bỏ trống trường trường tùy chọn
> *Ghi chú nghiệp vụ:* Kiểm thử luồng rẽ nhánh từ quyết định Q-1: trường tùy chọn không bắt buộc.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập đầy đủ các trường thông tin bắt buộc khác | Các trường bắt buộc hợp lệ |
| 2 | Để trống trường trường tùy chọn và bấm gửi form | Hệ thống xử lý thành công, không báo lỗi thiếu trường tùy chọn |


### TC-035 — Kiểm tra đóng modal onboarding giữa chừng và kiểm tra trạng thái trang chủ

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Kiểm thử luồng bỏ qua / State transition
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập và thấy modal Onboarding (Bước 1)
- **Dữ liệu kiểm thử:** Bấm nút đóng modal
- > *Ghi chú nghiệp vụ:* Kiểm thử khả năng bỏ qua onboarding mà không gây treo màn hình hoặc mất quyền truy cập trang chủ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm nút đóng modal onboarding giữa chừng | Modal onboarding đóng lại thành công |
| 2 | Kiểm tra giao diện trang chủ | Nội dung trang chủ hiển thị đầy đủ, không còn overlay chặn tương tác |


### TC-036 — Kiểm tra tính năng Bỏ qua (Skip) onboarding ngay từ Bước 1

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản người dùng mới tạo chưa từng thực hiện onboarding, đăng nhập thành công vào hệ thống.
- **Dữ liệu kiểm thử:** N/A
> *Ghi chú nghiệp vụ:* Quyết định Q-1 và Q-2 xác nhận onboarding là không bắt buộc và người dùng có quyền bỏ qua ngay từ đầu.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập vào hệ thống lần đầu tiên. | Modal onboarding hiển thị ngay lập tức tại Bước 1 cùng với nút 'Bỏ qua'. |
| 2 | Nhấn nút 'Bỏ qua' (Skip) trên modal onboarding. | Modal onboarding đóng lại ngay lập tức, người dùng được điều hướng tới màn hình trang chủ bình thường mà không bắt buộc nhập thêm thông tin. |


### TC-037 — Kiểm tra không hiển thị lại modal onboarding khi đăng nhập lại sau khi đã chọn Bỏ qua

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản vừa thực hiện Bỏ qua onboarding thành công ở lần đăng nhập trước.
- **Dữ liệu kiểm thử:** Tài khoản test: user_skipped_onboarding@example.com
> *Ghi chú nghiệp vụ:* Đảm bảo sau khi người dùng thực hiện bỏ qua onboarding (theo Q-1, Q-2), hệ thống ghi nhận trạng thái và không làm phiền ở các lần đăng nhập tiếp theo.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện Đăng xuất khỏi tài khoản. | Đăng xuất thành công, giao diện chuyển về trang Đăng nhập. |
| 2 | Nhập thông tin tài khoản và thực hiện Đăng nhập lại. | Đăng nhập thành công vào trang chủ, modal onboarding KHÔNG tự động hiển thị lại. |


### TC-038 — Kiểm tra sự đồng bộ dữ liệu tiêu chí khai báo từ Onboarding sang trang Tiêu chí tìm việc (REQ-005)

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản người dùng mới chưa có dữ liệu tiêu chí tìm việc.
- **Dữ liệu kiểm thử:** Ngành nghề: IT/Phần mềm, Địa điểm: Hà Nội, Mức lương mong muốn: 2,000 USD, Vị trí: Senior QA Automation
> *Ghi chú nghiệp vụ:* Q-3 chốt dữ liệu khai báo ở onboarding và tiêu chí tìm việc là cùng 1 tập dữ liệu, hoàn tất onboarding phải cập nhật đúng sang REQ-005.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập và thực hiện hoàn tất cả 5 bước Onboarding với dữ liệu trong testData. | Hoàn tất bước 5, modal onboarding đóng lại thành công. |
| 2 | Điều hướng tới màn hình 'Tiêu chí tìm việc' (REQ-005). | Tất cả các trường thông tin (Ngành nghề, Địa điểm, Mức lương, Vị trí) hiển thị chính xác 100% dữ liệu đã khai báo trong quá trình Onboarding. |


### TC-039 — Kiểm tra đồng bộ dữ liệu dở dang sang Tiêu chí tìm việc (REQ-005) khi thoát/bỏ qua giữa chừng

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Tài khoản mới bắt đầu quy trình Onboarding.
- **Dữ liệu kiểm thử:** Bước 1: Ngành nghề = 'Ngân hàng', Bước 2: Địa điểm = 'TP. Hồ Chí Minh'. Bỏ qua ở Bước 3.
> *Ghi chú nghiệp vụ:* Kết hợp Q-1 (có thể đóng modal giữa chừng) và Q-3 (đồng bộ dữ liệu). Cần xác định các bước đã khai báo dở dang có được lưu sang REQ-005 hay không.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập dữ liệu cho Bước 1 và Bước 2 của Onboarding, sau đó bấm 'Tiếp tục' để sang Bước 3. | Chuyển sang Bước 3 thành công. |
| 2 | Tại Bước 3, nhấn nút 'Bỏ qua' hoặc đóng modal onboarding. | Modal onboarding đóng lại. |
| 3 | Mở màn hình 'Tiêu chí tìm việc' (REQ-005). | Dữ liệu ngành nghề và địa điểm (đã nhập ở Bước 1 và 2) được đồng bộ lưu trữ đầy đủ, các trường từ Bước 3 trở đi giữ trạng thái trống/mặc định. |
