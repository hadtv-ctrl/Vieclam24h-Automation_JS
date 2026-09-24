# Test case — REQ-007 Tìm kiếm việc làm qua trợ lý Chop AI chatbot

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-025 | AC-022 | Người dùng tìm kiếm, lọc và xem việc làm qua Chop AI chatbot trên desktop | P1 | Có | tests/e2e/desktop/chop_chatbot_job_search-bdd.spec.js |
| TC-026 | AC-022 | Kiểm tra phân trang danh sách việc làm trong Job Drawer khi Chatbot trả về nhiều kết quả | P1 | candidate | - |
| TC-027 | AC-022 | Kiểm tra trạng thái nút điều hướng phân trang ở điểm biên (Trang đầu và Trang cuối) | P2 | candidate | - |
| TC-028 | AC-022 | Khôi phục thành công phiên hội thoại và dữ liệu khi người dùng quay lại trong vòng 24 giờ | P0 | candidate | - |
| TC-029 | AC-022 | Khởi tạo phiên hội thoại mới khi người dùng quay lại sau 24 giờ | P1 | candidate | - |
| TC-030 | AC-022 | Kiểm tra khôi phục phiên hội thoại chatbot ở điểm biên thời gian 23 giờ 59 phút | P1 | candidate | - |
| TC-031 | AC-022 | Kiểm tra xử lý hệ thống khi người dùng xóa cache/storage trình duyệt và quay lại trong vòng 24 giờ | P2 | candidate | - |
| TC-032 | AC-022 | Kiểm tra hiển thị Job Drawer khi kết quả việc làm trả về nhỏ hơn hoặc bằng số lượng phần tử trên 1 trang | P2 | candidate | - |
| TC-033 | AC-022 | Kiểm tra khả năng xử lý và hiệu năng phân trang Job Drawer khi Chatbot trả về số lượng rất lớn (500+ việc làm) | P2 | candidate | - |
| TC-034 | AC-022 | Kiểm tra tính toàn vẹn ngữ cảnh của Active Target và Maturity Score khi khôi phục phiên dưới 24 giờ | P1 | candidate | - |
| TC-035 | AC-022 | Kiểm tra khôi phục phiên hội thoại chatbot ở điểm biên thời gian chính xác 24 giờ | P1 | candidate | - |
| TC-036 | AC-022 | Kiểm tra hiển thị Job Drawer khi Chatbot không trả về kết quả việc làm nào (0 việc làm) | P2 | candidate | - |
| TC-037 | AC-022 | Kiểm tra đồng bộ ngữ cảnh phiên chatbot trên nhiều tab trình duyệt khi quay lại dưới 24 giờ | P2 | candidate | - |
| TC-038 | AC-022 | Kiểm tra duy trì trạng thái phân trang Job Drawer khi chuyển đổi qua lại giữa các tin nhắn chatbot trong cùng phiên khôi phục | P2 | candidate | - |

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

## Ứng viên automation cho REQ-007

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Ứng tuyển nhanh việc làm trực tiếp từ Drawer của chatbot | AC-022 | Nối liền luồng tìm kiếm sang ứng tuyển | P1 |
| Tìm kiếm bằng từ khóa không có việc làm phù hợp (Zero-result) | AC-022 | Kiểm tra xử lý biên khi không có việc | P2 |
| Tự động phục hồi phiên chat khi mất kết nối | AC-022 | Đảm bảo trải nghiệm liền mạch của người dùng | P3 |


### TC-026 — Kiểm tra phân trang danh sách việc làm trong Job Drawer khi Chatbot trả về nhiều kết quả

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI.
- **Dữ liệu kiểm thử:** Từ khóa tìm kiếm: 'Kế toán trưởng' (kết quả trả về 25 việc làm, kích thước trang mặc định là 10 việc làm/trang)
> *Ghi chú nghiệp vụ:* Phân tích từ quyết định Q-1: Chatbot hiển thị toàn bộ số lượng việc làm tìm thấy nhưng có phân trang trong Job Drawer.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập câu lệnh tìm kiếm việc làm 'Tìm việc Kế toán trưởng' vào chatbot và gửi. | Chatbot phản hồi và Job Drawer tự động mở ra, hiển thị 10 việc làm đầu tiên của Trang 1 cùng thông tin tổng số trang (Trang 1/3). |
| 2 | Nhấp vào nút chuyển trang tiếp theo (Next Page) ở đáy Job Drawer. | Job Drawer tải và hiển thị 10 việc làm tiếp theo của Trang 2 (từ việc làm thứ 11 đến 20), chỉ số trang cập nhật thành Trang 2/3. |
| 3 | Nhấp vào nút quay lại trang trước (Previous Page). | Job Drawer quay lại hiển thị danh sách 10 việc làm đầu tiên của Trang 1. |


### TC-027 — Kiểm tra trạng thái nút điều hướng phân trang ở điểm biên (Trang đầu và Trang cuối)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Job Drawer đang hiển thị kết quả tìm kiếm gồm 2 trang (tổng cộng 12 việc làm, 10 việc làm/trang).
- **Dữ liệu kiểm thử:** Danh sách 12 việc làm (Trang 1: 10 việc làm, Trang 2: 2 việc làm)
> *Ghi chú nghiệp vụ:* Kiểm thử giá trị biên (BVA) cho tính năng phân trang Job Drawer theo quyết định Q-1.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Quan sát trạng thái các nút điều hướng phân trang khi đang ở Trang 1. | Nút 'Trang trước' ở trạng thái Disabled (vô hiệu hóa), nút 'Trang tiếp' ở trạng thái Enabled (hoạt động). |
| 2 | Nhấp nút 'Trang tiếp' để chuyển sang Trang 2. | Job Drawer hiển thị 2 việc làm còn lại. Nút 'Trang tiếp' chuyển sang trạng thái Disabled, nút 'Trang trước' ở trạng thái Enabled. |


### TC-028 — Khôi phục thành công phiên hội thoại và dữ liệu khi người dùng quay lại trong vòng 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã thực hiện tương tác với Chatbot, thiết lập Active Target là 'Senior QA Automation' và có điểm Maturity Score là 80%.
- **Dữ liệu kiểm thử:** Thời gian ngắt kết nối/đóng trình duyệt: 2 tiếng (< 24h). Active Target: 'Senior QA Automation', Maturity Score: 80%
> *Ghi chú nghiệp vụ:* Dựa trên quyết định Q-2: Khi user quay lại trong vòng 24h thì resume trực tiếp phiên hội thoại cũ, giữ nguyên Chat History, Active Target và Maturity Score.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đóng trình duyệt/tắt cửa sổ làm việc sau khi đã hoàn thành một đoạn hội thoại với chatbot. | Phiên làm việc được ghi nhận trên hệ thống. |
| 2 | Mở lại trình duyệt và truy cập ứng dụng sau 2 giờ (nhỏ hơn 24h). | Ứng dụng tải thành công. |
| 3 | Mở cửa sổ Chatbot Chop AI. | Phiên hội thoại cũ được tự động khôi phục (Resume): Lịch sử chat (Chat History) hiển thị đầy đủ, mục tiêu hoạt động (Active Target = 'Senior QA Automation') và điểm độ trưởng thành (Maturity Score = 80%) được giữ nguyên chính xác. |


### TC-029 — Khởi tạo phiên hội thoại mới khi người dùng quay lại sau 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng có phiên làm việc cũ với chatbot được ghi nhận cách đây hơn 24 giờ.
- **Dữ liệu kiểm thử:** Thời gian quay lại: 25 tiếng (>= 24h kể từ tương tác cuối)
> *Ghi chú nghiệp vụ:* Dựa trên quyết định Q-2: Kiểm thử luồng hết hạn phiên làm việc (Session Expiration) khi thời gian vượt quá 24h.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Người dùng đăng nhập và mở cửa sổ Chatbot Chop AI sau 25 giờ kể từ lần tương tác gần nhất. | Hệ thống không resume phiên hội thoại cũ. Cửa sổ chatbot mở ra một phiên hội thoại mới sạch hoàn toàn, các thông số Active Target và Maturity Score được đặt lại về trạng thái mặc định/khởi tạo ban đầu. |


### TC-030 — Kiểm tra khôi phục phiên hội thoại chatbot ở điểm biên thời gian 23 giờ 59 phút

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã thực hiện cuộc hội thoại với Chatbot, có lưu lại lịch sử tin nhắn.
- **Dữ liệu kiểm thử:** Thời gian trôi qua kể từ lần tương tác cuối: 23 giờ 59 phút
> *Ghi chú nghiệp vụ:* Theo quyết định Q-2, phiên được duy trì nếu dưới 24 giờ. Cần kiểm tra ca biên cận trên (23h 59m) để đảm bảo logic tính thời gian hết hạn không bị ngắt sớm.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đóng cửa sổ trình duyệt sau khi kết thúc tương tác với Chatbot. | Thông tin phiên làm việc được lưu trên hệ thống. |
| 2 | Giả lập thời gian trôi qua đúng 23 giờ 59 phút và truy cập lại ứng dụng. | Hệ thống xác định phiên vẫn còn hiệu lực (< 24h). |
| 3 | Mở lại cửa sổ Chatbot. | Khôi phục thành công toàn bộ Chat History, Active Target và Maturity Score của phiên làm việc trước đó. |


### TC-031 — Kiểm tra xử lý hệ thống khi người dùng xóa cache/storage trình duyệt và quay lại trong vòng 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng vừa trò chuyện với Chatbot cách đây 1 giờ.
- **Dữ liệu kiểm thử:** Hành động: Xóa sạch Cookies và LocalStorage trên trình duyệt
> *Ghi chú nghiệp vụ:* Theo Q-2, phiên khôi phục tự động trong 24h. Cần kiểm tra Negative test khi thông tin phiên ở client side bị xóa, hệ thống phải xử lý mượt mà và khởi tạo phiên mới không đơ lỗi.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện xóa toàn bộ Cookies, SessionStorage và LocalStorage của trình duyệt. | Dữ liệu tạm của ứng dụng ở máy khách bị loại bỏ hoàn toàn. |
| 2 | Tải lại trang và mở cửa sổ Chatbot. | Hệ thống không phát sinh lỗi giao diện (UI crash), tự động tạo phiên làm việc mới (New Session) sạch sẽ. |


### TC-032 — Kiểm tra hiển thị Job Drawer khi kết quả việc làm trả về nhỏ hơn hoặc bằng số lượng phần tử trên 1 trang

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang mở khung chat với Chatbot. Kích thước mặc định 1 trang (Page Size) = 5 việc làm.
- **Dữ liệu kiểm thử:** Từ khóa tìm kiếm trả về kết quả đúng 1 việc làm
> *Ghi chú nghiệp vụ:* Theo Q-1, Job Drawer chia trang khi hiển thị danh sách việc làm. Cần kiểm tra điểm biên khi số lượng việc làm <= kích thước 1 trang.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Gửi yêu cầu tìm kiếm công việc có tiêu chí rất cụ thể để Chatbot chỉ trả về 1 công việc. | Chatbot phản hồi và mở Job Drawer hiển thị đúng 1 việc làm. |
| 2 | Kiểm tra bộ phân trang phía dưới Job Drawer. | Thanh phân trang ẩn đi hoặc hiển thị 1/1 trang, các nút điều hướng Next/Previous ở trạng thái disabled. |


### TC-033 — Kiểm tra khả năng xử lý và hiệu năng phân trang Job Drawer khi Chatbot trả về số lượng rất lớn (500+ việc làm)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Cửa sổ Chatbot đang mở.
- **Dữ liệu kiểm thử:** Chatbot trả về dữ liệu danh sách 500 việc làm
> *Ghi chú nghiệp vụ:* Q-1 chốt không giới hạn số lượng tin hiển thị trong Job Drawer mà chia page. Cần kiểm tra Stress/Boundary Test với dữ liệu cực lớn để đảm bảo UI không lag/vỡ giao diện.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện câu lệnh tìm kiếm việc làm mở rộng (ví dụ: 'Tất cả việc làm IT'). | Job Drawer mở ra hiển thị danh sách trang đầu tiên (Page 1) mượt mà. |
| 2 | Kiểm tra tổng số trang được tính toán trên thanh phân trang. | Tổng số trang = 100 trang (với page size = 5). Số lượng hiển thị chính xác. |
| 3 | Chuyển nhanh đến trang bất kỳ (ví dụ trang 50) và bấm Next liên tục. | Giao diện cập nhật danh sách việc làm trang tương ứng nhanh chóng, không bị vỡ layout hay đơ trình duyệt. |


### TC-034 — Kiểm tra tính toàn vẹn ngữ cảnh của Active Target và Maturity Score khi khôi phục phiên dưới 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Phiên làm việc trước đó đã ghi nhận Active Target = 'Senior QA Automation' và Maturity Score = 75%.
- **Dữ liệu kiểm thử:** Thời gian rời đi: 2 giờ
> *Ghi chú nghiệp vụ:* Theo Q-2, việc quay lại < 24h phải bảo toàn cả Active Target và Maturity Score. Cần kiểm tra xem Chatbot có tiếp tục tư vấn đúng ngữ cảnh cũ mà không yêu cầu nhập lại thông tin không.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đóng cửa sổ Chatbot và quay lại sau 2 giờ. | Hệ thống tự động khôi phục phiên hội thoại cũ. |
| 2 | Gửi tin nhắn: 'Hãy gợi ý việc làm phù hợp với mục tiêu hiện tại của tôi'. | Chatbot đưa ra gợi ý việc làm chính xác dựa trên Active Target ('Senior QA Automation') và Maturity Score (75%) đã lưu, không hỏi lại mục tiêu nghề nghiệp của người dùng. |


### TC-035 — Kiểm tra khôi phục phiên hội thoại chatbot ở điểm biên thời gian chính xác 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã tạo phiên hội thoại có Chat History, Active Target và Maturity Score.
- **Dữ liệu kiểm thử:** Thời gian rời đi: 24 giờ 00 phút 00 giây
> *Ghi chú nghiệp vụ:* Phân tích giá trị biên (BVA) cho quy định khôi phục phiên hội thoại < 24 giờ theo quyết định [Q-2]. Cần xác định chính xác hành vi tại thời điểm tròn 24:00:00.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Người dùng thực hiện hội thoại trên Chatbot Chop AI để tạo dữ liệu ngữ cảnh (Active Target, Maturity Score). | Phiên hội thoại được ghi nhận và lưu giữ trên hệ thống. |
| 2 | Tắt cửa sổ trình duyệt và điều chỉnh hệ thống/mô phỏng thời gian trôi qua đúng 24 giờ 00 phút 00 giây. | Thời gian rời đi đạt mốc biên chính xác 24 giờ. |
| 3 | Người dùng truy cập lại ứng dụng và mở lại Chop AI chatbot. | Hệ thống xác định phiên đã hết hạn (> 24h hoặc = 24h), tự động xóa lịch sử cũ và khởi tạo phiên hội thoại mới sạch hoàn toàn. |


### TC-036 — Kiểm tra hiển thị Job Drawer khi Chatbot không trả về kết quả việc làm nào (0 việc làm)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đang trong phiên hội thoại với Chop AI chatbot.
- **Dữ liệu kiểm thử:** Từ khóa tìm kiếm: 'xyz123nonexistentjob'
> *Ghi chú nghiệp vụ:* Trường hợp rẽ nhánh/Negative Test cho [Q-1] về hiển thị Job Drawer khi danh sách việc làm trống.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Người dùng nhập câu lệnh tìm kiếm việc làm không tồn tại trên hệ thống. | Chatbot phản hồi thông báo không tìm thấy việc làm phù hợp. |
| 2 | Mở hoặc quan sát trạng thái của Job Drawer. | Job Drawer hiển thị trạng thái trống (Empty state), không hiển thị thanh phân trang (pagination) và hiển thị thông báo gợi ý điều chỉnh tiêu chí tìm kiếm. |


### TC-037 — Kiểm tra đồng bộ ngữ cảnh phiên chatbot trên nhiều tab trình duyệt khi quay lại dưới 24 giờ

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Người dùng đã có phiên hội thoại trước đó chưa quá 24 giờ.
- **Dữ liệu kiểm thử:** Tài khoản đã đăng nhập, 2 tab trình duyệt cùng truy cập hệ thống
> *Ghi chú nghiệp vụ:* Kiểm thử luồng đa cửa sổ/tab kết hợp với quy định lưu phiên hội thoại < 24 giờ của [Q-2].

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Người dùng quay lại hệ thống sau 2 giờ và mở ứng dụng ở Tab A. | Chatbot khôi phục thành công lịch sử hội thoại, Active Target và Maturity Score. |
| 2 | Mở ứng dụng ở Tab B trên cùng trình duyệt. | Tab B đồng bộ chính xác toàn bộ lịch sử hội thoại và trạng thái active giống Tab A. |
| 3 | Gửi câu hỏi mới ở Tab A và chuyển sang Tab B kiểm tra. | Dữ liệu tin nhắn mới và ngữ cảnh hội thoại được đồng bộ nhất quán giữa hai tab. |


### TC-038 — Kiểm tra duy trì trạng thái phân trang Job Drawer khi chuyển đổi qua lại giữa các tin nhắn chatbot trong cùng phiên khôi phục

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Candidate
- **Tiền điều kiện:** Phiên hội thoại được khôi phục (< 24h) có kết quả tìm kiếm gồm 50 việc làm (chia 5 trang).
- **Dữ liệu kiểm thử:** Trang Job Drawer hiện tại: Trang 3
> *Ghi chú nghiệp vụ:* Kết hợp kiểm thử tính năng phân trang Job Drawer không giới hạn [Q-1] và duy trì ngữ cảnh phiên hội thoại [Q-2].

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở Job Drawer và chuyển sang Trang 3 của danh sách việc làm. | Job Drawer hiển thị danh sách việc làm thuộc Trang 3. |
| 2 | Đóng Job Drawer, tiếp tục gửi 1 tin nhắn hỏi đáp với Chatbot. | Chatbot phản hồi bình thường, duy trì Active Target. |
| 3 | Mở lại Job Drawer từ kết quả tìm kiếm trước đó. | Job Drawer giữ nguyên trạng thái ở Trang 3 hoặc đặt lại về Trang 1 một cách nhất quán theo đúng quy chuẩn UX, không bị lỗi hiển thị dữ liệu. |
