# Test case — REQ-007 Tìm kiếm việc làm qua trợ lý Chop AI chatbot

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-025 | AC-022 | Người dùng tìm kiếm, lọc và xem việc làm qua Chop AI chatbot trên desktop | P1 | Có | tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js |
| TC-093 | AC-022 | Tìm kiếm việc làm lần lượt theo tỉnh thành và quận huyện trọng điểm | P2 | Có | tests/e2e/desktop/job_search_by_cities-bdd.spec.js |
| TC-094 | AC-022 | Tìm kiếm việc làm từ trang chủ, áp dụng bộ lọc và xem chi tiết tin tuyển dụng | P2 | Có | tests/e2e/desktop/job_search_filter_detail-bdd.spec.js |
| TC-049 | AC-022 | Kiểm thử hiển thị và điều hướng phân trang danh sách việc làm trong Job Drawer của Chatbot (các trường hợp 0 kết quả, 1 trang, nhiều trang, nút biên trang đầu/cuối và tải danh sách lớn) | P2 | Có | tests/e2e/desktop/kiem-thu-hien-thi-va-dieu-huong-phan-trang-danh-sach-viec-la.spec.js |
| TC-050 | AC-022 | Kiểm thử quản lý vòng đời và tính toàn vẹn phiên hội thoại Chatbot (khôi phục ngữ cảnh < 24 giờ, hết hạn sau 24 giờ, các mốc thời gian biên, xóa cache/storage và đồng bộ đa tab) | P2 | Có | tests/e2e/desktop/kiem-thu-quan-ly-vong-doi-va-tinh-toan-ven-phien-hoi-thoai-c.spec.js |


## Chi tiết

### TC-025 — Tìm kiếm và lọc việc làm qua Chop AI chatbot

- **Precondition**: người dùng mở trang tìm kiếm việc làm, đã đóng các modal popup/guest prompt.
- **Dữ liệu**: `data/chopChatbotData.json` gồm từ khóa tìm kiếm (`searchKeyword`), ngành nghề lọc, khu vực lọc (`locationFilter`), mức lương lọc (`salaryHighOption`), và từ khóa kinh nghiệm (`experienceKeyword`).
- **Các bước**:
  1. Mở cửa sổ Chop AI chatbot và đăng nhập tài khoản.
  2. Nhập từ khóa tìm kiếm việc làm vào ô chat và gửi tin nhắn.
  3. Chọn địa điểm (TP.HCM) và mức lương khởi điểm từ gợi ý của bot.
  4. Xác nhận số lượng việc làm phù hợp và mở drawer kết quả việc làm.
  5. Lọc theo ngành nghề, kiểm tra áp dụng rồi xóa bộ lọc.
  6. Lọc theo khu vực (Quận 1, Quận 4, Quận 3 tại TP.HCM), kiểm tra hiển thị rồi xóa bộ lọc.
  7. Lọc theo mức lương từ 15 triệu trở lên, kiểm tra hiển thị rồi xóa bộ lọc.
  8. Tìm kiếm theo kinh nghiệm qua chat và chỉnh sửa bộ lọc kinh nghiệm (từ 3 năm về 2 năm).
  9. Xóa toàn bộ bộ lọc và mở xem chi tiết một tin tuyển dụng gợi ý.
  10. Đóng modal chi tiết việc làm và điều hướng quay về trang chủ.
- **Expected result thực tế kiểm chứng**:
  - Số lượng công việc phù hợp hiển thị trong bot — Có assertion kiểm chứng.
  - Các chip/nhãn bộ lọc (khu vực, lương, kinh nghiệm) phản ánh chính xác lựa chọn — Có assertion kiểm chứng.
  - Điều hướng quay về trang chủ thành công — Có assertion kiểm chứng.
- **Đánh giá**: Kịch bản kiểm thử bao phủ toàn diện luồng tương tác với trợ lý ảo Chop AI từ nhập liệu, trắc nghiệm đến quản lý bộ lọc đa chiều.

### TC-093 — Tìm kiếm việc làm lần lượt theo tỉnh thành và quận huyện trọng điểm

- **Precondition**: người dùng mở trang tìm kiếm việc làm, đã đóng các modal popup/guest prompt.
- **Các bước**:
  1. Truy cập trang chủ và điều hướng đến trang tìm kiếm việc làm.
  2. Lần lượt chọn tỉnh thành và quận huyện đại diện (Hà Nội - Cầu Giấy, TP.HCM - Quận 1, Đà Nẵng - Hải Châu, Bình Dương - Thủ Dầu Một, Hải Phòng - Ngô Quyền, Cần Thơ - Ninh Kiều).
  3. Bấm Tìm kiếm và xác nhận kết quả lọc được áp dụng.
  4. Mở xem chi tiết một tin tuyển dụng.
- **Expected result thực tế kiểm chứng**:
  - URL trang tìm kiếm tải đúng và bộ lọc địa điểm được áp dụng.
  - Trang chi tiết việc làm mở thành công và hiển thị tiêu đề tin tuyển dụng.

### TC-094 — Tìm kiếm việc làm từ trang chủ, áp dụng bộ lọc và xem chi tiết tin tuyển dụng

- **Precondition**: người dùng truy cập trang chủ và đóng các popup cản trở.
- **Các bước**:
  1. Chọn ngành nghề 'Bán sỉ - Bán lẻ' để điều hướng sang trang tìm kiếm việc làm.
  2. Lọc theo tỉnh thành 'TP.HCM' và bấm Tìm kiếm.
  3. Tuần tự áp dụng 8 bộ lọc ngang (Tuyển nhanh, Việc không cần CV, Kinh nghiệm, Mức lương, Cấp bậc, Trình độ, Loại công việc, Giới tính) và xóa lọc sau mỗi lần.
  4. Mở xem chi tiết một tin tuyển dụng.
- **Expected result thực tế kiểm chứng**:
  - Trang chủ và logo hiển thị đầy đủ trước khi chọn ngành nghề.
  - URL trang tìm kiếm việc làm tải chính xác và các bộ lọc cập nhật danh sách việc làm.
  - Trang chi tiết việc làm mở thành công và hiển thị tiêu đề tin tuyển dụng.

## Ứng viên automation cho REQ-007

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Ứng tuyển nhanh việc làm trực tiếp từ Drawer của chatbot | AC-022 | Nối liền luồng tìm kiếm sang ứng tuyển | P1 |
| Tìm kiếm bằng từ khóa không có việc làm phù hợp (Zero-result) | AC-022 | Kiểm tra xử lý biên khi không có việc | P2 |
| Tự động phục hồi phiên chat khi mất kết nối | AC-022 | Đảm bảo trải nghiệm liền mạch của người dùng | P3 |


### TC-049 — Kiểm thử hiển thị và điều hướng phân trang danh sách việc làm trong Job Drawer của Chatbot

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Luồng kiểm thử liên hoàn
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI.
- **Dữ liệu kiểm thử:**
  - Tìm kiếm không có việc: từ khóa `xyz123nonexistentjob` (0 kết quả)
  - Tìm kiếm số lượng ít: kết quả 1 việc làm (<= 1 trang)
  - Tìm kiếm thông thường: kết quả 25 việc làm (nhiều trang, page size = 10)
  - Tải danh sách lớn: kết quả 500+ việc làm (stress UI)
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử phân trang Job Drawer trước đây theo quyết định Q-1. Kiểm chứng đầy đủ trạng thái rỗng (empty state), ẩn hiện bộ phân trang khi <= 1 trang, trạng thái disabled của nút điều hướng trang đầu/trang cuối, duy trì trang khi chuyển đổi tin nhắn và hiệu năng hiển thị danh sách lớn.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập từ khóa không tồn tại `xyz123nonexistentjob` vào chatbot | Chatbot phản hồi thông báo không tìm thấy việc; Job Drawer hiển thị trạng thái rỗng và không hiện phân trang |
| 2 | Nhập câu lệnh trả về đúng 1 việc làm | Job Drawer hiển thị 1 việc làm; thanh phân trang ẩn đi hoặc các nút Next/Prev ở trạng thái disabled |
| 3 | Nhập tìm kiếm việc làm trả về 25 kết quả | Job Drawer hiển thị 10 việc/trang; nút 'Trang trước' disabled ở Trang 1; bấm 'Next' tải trang tiếp theo mượt mà |
| 4 | Chuyển đến trang cuối cùng của kết quả | Nút 'Trang tiếp' chuyển sang trạng thái disabled, nút 'Trang trước' enabled |
| 5 | Đóng Drawer, chat thêm 1 tin và mở lại Drawer | Job Drawer duy trì trạng thái phân trang nhất quán, không lỗi hiển thị |
| 6 | Thử nghiệm với kết quả lớn (500+ việc làm) | Tính toán chính xác tổng số trang, chuyển trang mượt mà không vỡ layout |


### TC-050 — Kiểm thử quản lý vòng đời và tính toàn vẹn phiên hội thoại Chatbot

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Quản lý vòng đời / Temporal boundary / Multi-tab
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã có tương tác với Chatbot, thiết lập Active Target và Maturity Score.
- **Dữ liệu kiểm thử:**
  - Ngữ cảnh phiên: Active Target = 'Senior QA Automation', Maturity Score = 80%
  - Các mốc thời gian: < 24 giờ (2 giờ, cận trên 23h59), tròn 24h00, quá hạn 25 giờ
  - Thao tác xóa cache/storage client-side; Mở đồng thời 2 tab trình duyệt
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử vòng đời phiên chatbot trước đây theo quyết định Q-2. Đảm bảo: tự động khôi phục ngữ cảnh hội thoại khi quay lại dưới 24h (kể cả mốc biên 23:59), tự động tạo phiên mới khi quá hạn >= 24h hoặc khi người dùng xóa cache, duy trì tính toàn vẹn của Active Target/Maturity Score và đồng bộ phiên hai chiều giữa nhiều tab trình duyệt.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tạo phiên chat với mục tiêu 'Senior QA Automation' và Maturity Score 80%, sau đó đóng trình duyệt | Dữ liệu phiên hội thoại được ghi nhận lưu trữ |
| 2 | Truy cập lại sau 2 giờ (mốc < 24h) và mở lại Chop AI | Phiên cũ được khôi phục nguyên vẹn: Lịch sử chat, Active Target và Maturity Score giữ nguyên |
| 3 | Kiểm tra tại điểm biên cận trên 23 giờ 59 phút | Hệ thống vẫn xác định phiên còn hiệu lực (< 24h) và khôi phục ngữ cảnh thành công |
| 4 | Mở ứng dụng trên Tab B của cùng trình duyệt | Tab B đồng bộ chính xác toàn bộ lịch sử hội thoại và ngữ cảnh phiên giống Tab A |
| 5 | Kiểm tra khi vượt quá 24 giờ (24:00:00 hoặc 25 giờ) | Phiên cũ hết hạn; hệ thống tự động khởi tạo phiên mới sạch hoàn toàn |
| 6 | Xóa Cookies & LocalStorage của trình duyệt và mở Chatbot | Hệ thống khởi tạo phiên mới sạch sẽ, an toàn, không gây crash giao diện |

