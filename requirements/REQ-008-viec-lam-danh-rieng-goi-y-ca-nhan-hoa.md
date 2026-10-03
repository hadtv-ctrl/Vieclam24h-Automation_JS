---
id: REQ-008
title: Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa (Personalized Page)
status: Confirmed
version: 2.0
risk: medium
owner: BA / Product / QA
test_cases: test-cases/REQ-008-viec-lam-danh-rieng-goi-y-ca-nhan-hoa.md
---

# REQ-008 — Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa (Personalized Page)

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-008 |
| Phiên bản | 2.0 (Đồng bộ toàn diện theo BA SRS & Product Flow) |
| Vai trò | Người tìm việc (Chưa login, Đã login chưa đủ data, Đã login đủ 3 data) |
| Nền tảng | Mobile web / Desktop |
| Nguồn tài liệu | BA Product Requirement, Whimsical Flows & Figma Handoff JS Web 2026 |
| Trạng thái tổng thể | Confirmed |

---

## 1. Tổng quan & Phạm vi tính năng (Feature Scope)

### 1.1 Khái niệm & Mục đích nghiệp vụ
- **Personalized page là gì:** Trang dành riêng cho việc cá nhân hoá theo nhu cầu của user — không chỉ dựa trên Job Goal (tiêu chí tìm việc), mà còn phụ thuộc vào các hành vi người dùng (user behavior: tìm kiếm từ khóa, click xem chi tiết công việc). Trang này cung cấp cho người dùng một không gian riêng để xem ngay các việc làm phù hợp mà không cần phải search thủ công trước đó, và danh sách việc làm luôn được cập nhật liên tục.
- **Mục đích:** Tăng tỷ lệ ứng tuyển (apply rate) của người dùng do có thể tiếp cận dễ dàng, nhanh chóng với những việc làm tương đồng với nhu cầu và hành vi thực tế của bản thân.
- **Phạm vi tác động (3 trang):** Feature này ảnh hưởng đến 3 trang: **Trang chủ (Home)**, **Tìm kiếm (Search)**, và **Trang cá nhân hóa (Personalized page)**. Trong đó Home và Search đóng vai trò điểm chạm (entry points) điều hướng người dùng về Personalized page — nơi tập trung thu thập, hiển thị và chỉnh sửa dữ liệu Job Goal.
- **Tài liệu tham chiếu:**
  - Whimsical Flow:
    * [Home Flow](https://whimsical.com/hi-n-m-y-po/personalized-page-4Ha4MaiwyGTfg3kobcTWHx@2bsEvpTYSt1Hj7utuzQvzEJiwc6CcgFTuY9)
    * [Search Flow](https://whimsical.com/hi-n-m-y-po/personalized-page-4Ha4MaiwyGTfg3kobcTWHx@2bsEvpTYSt1HjB9T8Z7HYPDkvKKM7E3qsSN)
    * [Personalized Flow](https://whimsical.com/hi-n-m-y-po/personalized-page-4Ha4MaiwyGTfg3kobcTWHx@2bsEvpTYSt1HjEPP1WHjGgYXhg9ZVix4cYs)
  - Figma Design Handoff:
    * [Desktop & Mobile Web Handoff JS Web 2026](https://www.figma.com/design/76BkywsGo7UnAJkOzUQEPu/%E2%9C%85-%3C-%3E-Handoff-%E2%80%A2-JS-%F0%9F%96%A5-Web-2026?node-id=11822-30096&t=5fdz6uTWQ335uSnl-1)

### 1.2 Ma trận phân nhánh hiển thị theo 3 Trang và 3 Trạng thái Người dùng

Hệ thống phân tách hành vi hiển thị của 3 trang theo 3 trạng thái (State) của người dùng:
1. **State 1 — Chưa đăng nhập (Guest):** Chưa có tài khoản hoặc chưa đăng nhập vào hệ thống.
2. **State 2 — Đã đăng nhập, chưa đủ 3 data (0/3 hoặc 1/3, 2/3):** Tài khoản đã đăng nhập nhưng Job Goal thiếu ít nhất một trong 3 dữ liệu cốt lõi (Vị trí công việc - Job title, Nơi làm việc - Province, Mức lương - Salary).
3. **State 3 — Đã đăng nhập, đủ cả 3 data (3/3):** Tài khoản đã có đầy đủ Vị trí công việc + Nơi làm việc + Mức lương.

| Trang | State 1: Chưa login (Guest) | State 2: Đã login, chưa đủ data | State 3: Đã login, đủ 3 data |
|---|---|---|---|
| **Trang chủ (Home)** | Có ít nhất 1 behavior data (search/click) VÀ Recommendation Engine trả về ≥3 job → hiện danh sách job gợi ý (tối đa 9 job cards, không carousel/phân trang). Nếu không có data HOẶC <3 job → hiện bộ 4 banner tĩnh + CTA dẫn về Personalized page.<br>*(Nhấp card/banner/CTA đều áp dụng bắt buộc đăng nhập US-06)*. | Có ít nhất 1 data (behavior HOẶC Job Goal) VÀ Recommendation Engine trả về ≥3 job → hiện danh sách job (tối đa 9 cards). Nếu không có data HOẶC <3 job → hiện bộ 4 banner tĩnh + CTA.<br>*(Home không phân biệt đủ hay thiếu 3 data — chỉ xét có ≥1 data và ≥3 job gợi ý; nhấp chuyển sang Personalized page để phân luồng)*. | Giống State 2 (Đã login, chưa đủ data). |
| **Tìm kiếm (Search)** | Khối "Việc làm dành riêng cho bạn" đã có sẵn, bổ sung thêm CTA dẫn về Personalized page tại khối đó. Bấm CTA yêu cầu đăng nhập trước (US-06). Job list search hiển thị bình thường. | Khối "Việc làm dành riêng cho bạn" hiển thị CTA dẫn về Personalized page. Bấm CTA vào thẳng Personalized page (áp dụng US-07 hoặc US-08). Job list search hiển thị bình thường. | Khối "Việc làm dành riêng cho bạn" hiển thị CTA dẫn về Personalized page. Bấm CTA vào thẳng Personalized page (áp dụng US-08). Job list search hiển thị bình thường. |
| **Trang cá nhân hóa (Personalized Page)** | Bắt buộc đăng nhập trước khi thấy bất kỳ nội dung nào của trang (US-06). Sau đăng nhập thành công, tự động kiểm tra Job Goal để phân luồng US-07 (0/3 data) hoặc US-08 (≥1/3 data). | Nếu thiếu cả 3 data (0/3): Bắt buộc hoàn thành Mini-onboarding 3 bước (US-12), không thể bỏ qua (skip).<br>Nếu đã có 1/3 hoặc 2/3 data: Hiển thị ngay danh sách việc làm gợi ý (30 cards/page) + 1 section hỏi các data còn thiếu (cho phép skip). | Hiển thị ngay danh sách việc làm gợi ý (30 cards/page, sorting: Liên quan nhất / Lương cao nhất / Mới nhất) + Section snapshot hiển thị đủ 3 data kèm CTA chỉnh sửa / thêm mới Job Goal. |

---

## 2. Chi tiết Yêu cầu Nghiệp vụ (User Stories & Tiêu chuẩn Nghiệm thu từ BA)

### 2.1 Trang Chủ (Home)

#### US-01: Trang Home — Khách vãng lai (Chưa đăng nhập)
- **Mô tả:** Khách vãng lai chưa đăng nhập vào Home: Hệ thống kiểm tra guest có ít nhất 1 behavior data (tìm kiếm từ khóa, click xem job trong phiên hiện tại) hay không, và nếu có thì recommendation engine trả về bao nhiêu việc làm. Chỉ khi có data và kết quả từ 3 việc làm trở lên mới hiển thị danh sách việc làm gợi ý; các trường hợp còn lại hiển thị bộ banner mời cá nhân hoá — cả 2 trường hợp đều dẫn về Personalized page.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 1.1:** Hệ thống kiểm tra guest có ít nhất 1 behavior data (search / click job /...) hay không; nếu có, kiểm tra recommendation engine dựa trên data đó trả về bao nhiêu việc làm.
  * **Tiêu chí 1.2:** Chỉ khi có behavior data và kết quả trả về từ 3 việc làm trở lên (≥3 jobs), Home mới hiển thị danh sách việc làm gợi ý (tối đa 9 job card, không chia carousel, không phân trang — muốn xem thêm phải bấm CTA dẫn về Personalized page) tại vị trí ngay dưới section "Việc đi làm ngay", kèm CTA dẫn về Personalized page.
  * **Tiêu chí 1.3:** Nếu không có behavior data, hoặc có data nhưng kết quả trả về dưới 3 việc làm (<3 jobs), hiển thị bộ banner (bộ 4 banner tĩnh) kèm CTA tại cùng vị trí.
  * **Tiêu chí 1.4:** Bấm vào bất kỳ banner, CTA hoặc job card nào đều điều hướng người dùng sang Personalized page — tại đó áp dụng logic bắt buộc đăng nhập (US-06).
  * **Tiêu chí 1.5:** Danh sách banner hiển thị dạng tĩnh, không tự động di chuyển (tuyệt đối không phải dạng carousel).

#### US-02: Trang Home — Người dùng đã đăng nhập
- **Mô tả:** Người dùng đã đăng nhập vào Home: Hệ thống chỉ kiểm tra user có ít nhất 1 dữ liệu hay không — bao gồm cả dữ liệu hành vi (behavior: search/click) và dữ liệu từ Job Goal — và recommendation engine gợi ý được bao nhiêu việc làm; Có data và ≥3 việc làm thì hiện danh sách việc làm, ngược lại hiện bộ banner.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 2.1:** Hệ thống kiểm tra người dùng có ít nhất 1 data hay không — bao gồm data behavior (search/click) và data từ Job Goal; nếu có, kiểm tra recommendation engine gợi ý được bao nhiêu việc làm từ data đó.
  * **Tiêu chí 2.2:** Chỉ khi có data và kết quả trả về từ 3 việc làm trở lên (≥3 jobs), Home mới hiển thị danh sách việc làm gợi ý (tối đa 9 job card, không carousel/phân trang — muốn xem thêm bấm CTA dẫn về Personalized page) tại vị trí dưới "Việc đi làm ngay", kèm CTA dẫn về Personalized page.
  * **Tiêu chí 2.3:** Nếu không có data, hoặc có data nhưng kết quả trả về dưới 3 việc làm (<3 jobs), hiển thị cùng bộ banner (4 banner tĩnh) như US-01, kèm CTA, tại cùng vị trí.
  * **Tiêu chí 2.4:** Bấm vào banner, CTA hoặc job card điều hướng sang Personalized page; tại đó hệ thống tự kiểm tra lại Job Goal và áp dụng đúng luồng US-07 (0/3 data) hoặc US-08 (đã có ≥1/3 data) tương ứng.
  * **Tiêu chí 2.5 (Tiêu đề Section theo nền tảng):** Trên Desktop sử dụng tiêu đề `Việc làm dành riêng cho {Tên user}`; trên Mobile web luôn dùng dạng cố định chung `Việc làm dành riêng cho bạn` (không chèn tên user để tránh tên dài làm vỡ bố cục giao diện).

#### US-03: Trang Home — Toast gợi ý khám phá
- **Mô tả:** Toast nhỏ nhắc người dùng tiếp tục lướt xuống xem section "Việc làm dành riêng cho bạn", dựa trên tín hiệu người dùng đang khám phá thay vì chủ động tìm kiếm.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 3.1:** Toast hiển thị tối đa 1 lần duy nhất tại Homepage trong mỗi phiên (session) truy cập của người dùng — không tính theo ngày lịch.
  * **Tiêu chí 3.2 (Điều kiện hiển thị):** Khi thao tác cuộn (scroll) khiến toàn bộ cụm header chính (thanh tìm kiếm + nút "Việc đi làm ngay" + nút "Việc không cần CV") bị cuộn khuất khỏi viewport màn hình — đây là tín hiệu người dùng đang có nhu cầu khám phá (browse), thay vì chủ động search.
  * **Tiêu chí 3.3 (Điều kiện tắt & chống lặp):** Ngay khi card đầu tiên của section "Việc làm dành riêng cho bạn" xuất hiện trong viewport, toast tự động ẩn — vì lúc này toast đang che phủ job card đó, cần ẩn để người dùng quan sát. Khi toast đã bị tắt vì người dùng lướt xuống đúng section này, nó sẽ không hiển thị lại trong cùng một session. Chỉ khi người dùng bắt đầu session mới, toast mới được phép xuất hiện lại theo điều kiện Tiêu chí 3.2.

---

### 2.2 Trang Tìm Kiếm (Search)

#### US-04: Trang Search — Bổ sung Entry Point về Personalized Page
- **Mô tả:** Section "Việc làm dành riêng cho bạn" hiện tại tại trang Search giữ nguyên logic gợi ý sẵn có, chỉ bổ sung thêm 1 nút CTA dẫn về Personalized page tại section đó.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 4.1:** Thêm CTA dẫn về Personalized page tại section "Việc làm dành riêng cho bạn" ở trang Search, áp dụng giao diện đồng nhất cho mọi trạng thái người dùng.
  * **Tiêu chí 4.2:** Người dùng chưa đăng nhập bấm CTA thì yêu cầu đăng nhập trước (theo US-06), sau đó theo đúng luồng US-07/US-08; người dùng đã đăng nhập thì vào thẳng Personalized page, áp dụng đúng US-07/US-08 tương ứng.
  * **Tiêu chí 4.3:** Ngoài việc bổ sung CTA ở Tiêu chí 4.1, danh sách việc làm trên trang Search hiển thị hoàn toàn bình thường theo kết quả tìm kiếm/bộ lọc — không thay đổi logic nào khác.

---

### 2.3 Trang Cá Nhân Hóa (Personalized Page)

#### US-06: Trang Personalized — Người dùng chưa đăng nhập
- **Mô tả:** Người dùng chưa đăng nhập truy cập Personalized page bắt buộc phải đăng nhập, sau đó vào thẳng luồng Mini-onboarding (nếu cần) — tuyệt đối không qua bước onboarding chính toàn diện.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 6.1:** Người dùng chưa đăng nhập truy cập Personalized page (từ bất kỳ entry point nào ở US-10) đều bị bắt buộc đăng nhập trước khi thấy bất kỳ nội dung nào của trang.
  * **Tiêu chí 6.2:** Sau khi đăng nhập thành công, hệ thống kiểm tra ngay dữ liệu Job Goal và tự động chuyển sang US-07 (nếu 0/3 data) hoặc US-08 (nếu đã có ≥1/3 data) tương ứng.

#### US-07: Trang Personalized — Người dùng đã login, chưa có dữ liệu Job Goal (0/3 Data)
- **Mô tả:** Người dùng đã đăng nhập nhưng Job Goal chưa có bất kỳ dữ liệu nào trong 3 dữ liệu ưu tiên (0/3: Job title, Province, Salary), bắt buộc phải hoàn thành Mini-onboarding trước khi thấy nội dung trang.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 7.1:** Nếu Job Goal không có bất kỳ dữ liệu nào trong 3 dữ liệu ưu tiên (0/3: Vị trí mong muốn, Khu vực làm việc, Mức lương mong muốn), người dùng bắt buộc phải hoàn thành Mini-onboarding (xem US-12) trước khi thấy nội dung Personalized page.
  * **Tiêu chí 7.2 (Cơ chế lưu nháp tức thời):** Mỗi câu trả lời trong Mini-onboarding được lưu ngay vào Job Goal tại thời điểm trả lời. Nếu người dùng thoát trang hoặc đóng tab giữa chừng, dữ liệu đã trả lời vẫn được giữ lại trọn vẹn; ở lần truy cập tiếp theo, vì Job Goal đã có ≥1/3 data, hệ thống áp dụng logic US-08 thay vì bắt buộc hoàn thành lại Mini-onboarding từ đầu.

#### US-08: Trang Personalized — Người dùng đã login, đã có dữ liệu (≥1/3 Data)
- **Mô tả:** Người dùng có ít nhất 1/3 dữ liệu ưu tiên sẽ thấy ngay danh sách việc làm gợi ý; phần dữ liệu còn thiếu (nếu có) được hỏi qua 1 section riêng biệt, không bắt buộc.
- **Quy cách phân trang khi hiển thị danh sách công việc:**
  - Số lượng hiển thị: **30 job cards/trang**.
  - UI phân trang: Giữ nguyên giao diện và cơ chế phân trang hiện tại của hệ thống.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 8.1:** Nếu Job Goal có ≥1/3 dữ liệu ưu tiên, Personalized page hiển thị ngay danh sách việc làm theo Recommendation Engine (xem US-09) với 30 cards/trang và phân trang chuẩn.
  * **Tiêu chí 8.2 (Section khảo sát bổ sung tùy chọn):** Nếu vẫn còn thiếu dữ liệu trong 3 dữ liệu ưu tiên (trạng thái 1/3 hoặc 2/3), hiển thị 1 section hỏi (các) dữ liệu còn thiếu; người dùng có thể bỏ qua (skip) từng câu — section này không bắt buộc.
  * **Tiêu chí 8.3 (Section Snapshot tóm tắt 3 dữ liệu):** Ngay khi người dùng trả lời đủ cả 3 dữ liệu (3/3), section câu hỏi bổ sung được thay thế bằng 1 section snapshot hiển thị tóm tắt 3 dữ liệu đó, kèm CTA bên dưới để người dùng chỉnh sửa/thêm mới dữ liệu trong Job Goal (xem US-09).
  * **Tiêu chí 8.4:** Nếu người dùng bỏ qua (skip) một hoặc nhiều dữ liệu, section hỏi bổ sung vẫn tiếp tục hiển thị ở các lần tải trang/truy cập sau, cho đến khi người dùng trả lời đủ cả 3 dữ liệu — lúc đó section hỏi mới tắt và được thay bằng section Job Goal Snapshot (Tiêu chí 8.3).
  * **Tiêu chí 8.5 (Điểm chỉnh sửa duy nhất):** Chỉ có duy nhất 1 entry point chỉnh sửa Job Goal trong Personalized page: nút CTA tại section snapshot Job Goal (Tiêu chí 8.3 và US-09 Tiêu chí 9.3).

#### US-09: Trang Personalized — Recommendation Engine, Sorting & Chỉnh sửa Job Goal
- **Mô tả:** Danh sách việc làm sử dụng Recommendation Engine hiện tại với 3 tùy chọn sắp xếp; người dùng có thể chỉnh sửa/thêm mới dữ liệu trong Job Goal ngay tại section hiển thị 3 dữ liệu.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 9.1:** Danh sách việc làm lấy theo Recommendation Engine hiện tại của hệ thống, cung cấp 3 tùy chọn sắp xếp: `Liên quan nhất` (mặc định) / `Lương cao nhất` / `Mới nhất`.
  * **Tiêu chí 9.2 (Logic chi tiết từng kiểu sắp xếp):**
    - `Liên quan nhất`: Sử dụng đúng thuật toán tính điểm phù hợp của Recommendation Engine hiện tại đang áp dụng.
    - `Lương cao nhất`: Sắp xếp giảm dần theo mức lương tối đa (max salary) của mỗi tin tuyển dụng.
    - `Mới nhất`: Sắp xếp giảm dần theo thời gian tạo tin đăng tuyển dụng (created date/time) — khớp với đúng logic sorting "Mới nhất" hiện có ở trang Search.
  * **Tiêu chí 9.3:** Section snapshot hiển thị 3 dữ liệu (khi đã đủ 3/3, theo US-08 Tiêu chí 8.3) có CTA bên dưới cho phép người dùng chỉnh sửa hoặc bổ sung thêm thông tin trong Job Goal (như số năm kinh nghiệm, ngành nghề).

#### US-10: Trang Personalized — Tập hợp Entry Points
- **Mô tả:** Người dùng có thể truy cập vào Personalized page từ nhiều điểm chạm khác nhau trên toàn hệ thống.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 10.1:** Danh sách các entry point dẫn vào Personalized page:
    1. Banner hoặc nút CTA tại Trang chủ (US-01 / US-02);
    2. Nút CTA tại section "Việc làm dành riêng cho bạn" ở trang Search (US-04);
    3. Mục menu entry point mới ở Header & Menu dưới Avatar (xem US-11);
    4. Đường dẫn URL trực tiếp (Deep link).
  * **Tiêu chí 10.2:** Bất kể truy cập từ entry point nào, Personalized page luôn tự kiểm tra lại trạng thái đăng nhập và dữ liệu Job Goal hiện tại trước khi hiển thị nội dung (áp dụng đúng logic US-06 / US-07 / US-08 tương ứng).

#### US-11: Trang Personalized — Entry Point mới: Menu Header & Menu Avatar
- **Mô tả:** Bổ sung entry point mới dẫn vào Personalized page tại 2 vị trí trong thanh menu điều hướng.
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 11.1:** Thêm mục menu dẫn tới Personalized page ở header tại 2 vị trí:
    1. Vị trí 1: Từ menu dropdown "Việc làm" — nằm ngay dưới mục "Quản lý việc làm".
    2. Vị trí 2: Từ menu dropdown dưới avatar người dùng — nằm ngay dưới mục "Quản lý việc làm".

#### US-12: Mini-Onboarding — Logic quy trình chi tiết
- **Mô tả:** Luồng thu thập dữ liệu bắt buộc, tinh gọn, dùng chung cho trường hợp Personalized page thiếu toàn bộ 3 dữ liệu (US-07).
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 12.1 (3 câu hỏi cố định):** Mini-onboarding hỏi đúng 3 câu hỏi theo thứ tự cố định không thay đổi: `Job title (Vị trí công việc)` → `Province (Khu vực làm việc)` → `Salary (Mức lương)`.
  * **Tiêu chí 12.2:** Người dùng bắt buộc phải trả lời lần lượt từng câu, không thể bỏ qua (skip) hay đổi thứ tự — phải hoàn thành cả 3 câu mới được vào xem nội dung Personalized page.
  * **Tiêu chí 12.3:** Nếu người dùng đã hoàn thành Onboarding chính (luồng onboarding 5 câu hiện có, REQ-002) trước đó, Job Goal đã có ít nhất 1 dữ liệu nên hệ thống tuyệt đối không kích hoạt Mini-onboarding.
  * **Tiêu chí 12.4 (Đồng bộ Autofill hai chiều):** Ngược lại, nếu người dùng hoàn thành Mini-onboarding trước khi thực hiện Onboarding chính, khi vào Onboarding chính màn hình đầu tiên vẫn hiển thị bình thường; riêng những câu hỏi trong Onboarding chính trùng với dữ liệu đã có từ Mini-onboarding (Khu vực, Vị trí, Mức lương) sẽ tự động điền sẵn (autofill) các giá trị đã trả lời.
  * **Tiêu chí 12.5:** Thứ tự hoàn thành giữa 2 luồng (Mini-onboarding trước hay Onboarding chính trước) không tạo ra bất kỳ sự khác biệt nào về kết quả cuối cùng — dữ liệu được ghi nhận vào Job Goal là hoàn toàn như nhau.
  * **Tiêu chí 12.6 (Tiêu đề Dynamic Loop text):** Tiêu đề đầu trang Personalized page (áp dụng cho cả lúc đang hiển thị Mini-onboarding và lúc hiển thị danh sách việc làm bình thường) có 1 đoạn văn bản màu xanh loop tuần tự, luân chuyển 3 cụm từ với tổng chu kỳ 5 giây (ví dụ: "lương tốt", "gần nhà",...). Danh sách cụm từ hiển thị chuẩn xác theo thiết kế Figma UI.
  * **Tiêu chí 12.7 (Trải nghiệm chuyển bước không reload):** Khi người dùng bấm "Tiếp theo" ở câu hỏi 1 và câu hỏi 2, trang không loading/reload toàn trang — chỉ thực hiện chuyển mượt mà sang hiển thị câu hỏi kế tiếp. Chỉ khi người dùng bấm hoàn tất ở câu hỏi cuối cùng (câu 3), Personalized page mới thực hiện reload/fetch lại và hiển thị danh sách việc làm gợi ý theo dữ liệu vừa nhập.

#### US-13: Trang Personalized — Cấu hình Metadata & SEO
- **Mô tả:** Định nghĩa metadata chuẩn SEO (title, description, keywords, canonical, Open Graph tags) cho Personalized page với tên hiển thị là "Việc làm dành riêng cho bạn".
- **Tiêu chuẩn chi tiết:**
  * **Tiêu chí 13.1 (Page Title):** `Việc làm dành riêng cho bạn - Gợi ý việc làm phù hợp nhất tại Vieclam24h`
  * **Tiêu chí 13.2 (Meta Description):** `Khám phá việc làm dành riêng cho bạn, được gợi ý dựa trên nhu cầu tìm việc cá nhân hoá tại Vieclam24h`
  * **Tiêu chí 13.3 (Meta Keywords):** `việc làm dành riêng cho bạn, việc làm gợi ý, việc làm phù hợp, việc làm cá nhân hoá, gợi ý việc làm`
  * **Tiêu chí 13.4 (Canonical URL):** `https://vieclam24h.vn/viec-lam-danh-rieng-cho-ban.html`
  * **Tiêu chí 13.5 (Open Graph Tags):**
    - `og:type`: `website`
    - `og:url`: `https://vieclam24h.vn/viec-lam-danh-rieng-cho-ban.html` (đồng nhất với Canonical Tiêu chí 13.4)
    - `og:title`: `Việc làm dành riêng cho bạn – Gợi ý phù hợp nhất tại Vieclam24h`
    - `og:description`: `Khám phá việc làm dành riêng cho bạn, được gợi ý dựa trên nhu cầu tìm việc cá nhân hoá tại Vieclam24h`
    - `og:image`: Sử dụng hình ảnh có logo Việc Làm 24h kết hợp hình ảnh Chớp Trợ lý AI (đồng bộ với ảnh OG đang sử dụng cho trang Search).

---

## 3. Khung Acceptance Criteria Hợp Nhất & Ma Trận Truy Vết (Traceability Contract)

Để đảm bảo tương thích tuyệt đối với bộ kiểm thử tự động (Automation Suite) hiện có (TC-095 đến TC-103) mà **không làm phát sinh định nghĩa trùng lặp ("không define double")**, hệ thống hợp nhất các yêu cầu của US-01 đến US-13 vào 4 nhóm Acceptance Criteria chuẩn:

### AC-023 — Tiếp cận điểm chạm khối việc làm riêng, điều hướng đa kênh và kiểm soát xác thực tài khoản
*(Ánh xạ trực tiếp: US-01, US-02, US-04, US-06, US-10, US-11)*
- **Given** người dùng là khách vãng lai hoặc đã đăng nhập tiếp cận tính năng tại bất kỳ entry point nào (Banner/CTA Home, CTA Search, Menu Header "Việc làm", Menu dưới Avatar, Deep link)
- **When** người dùng nhấp vào job card, banner hoặc nút CTA điều hướng
- **Then** nếu người dùng chưa đăng nhập, hệ thống hiển thị màn hình bắt buộc đăng nhập (US-06)
- **And** hệ thống phân nhánh: số điện thoại chưa tồn tại chuyển sang luồng OTP xác thực tạo mới, số điện thoại đã tồn tại yêu cầu nhập mật khẩu
- **And** sau khi xác thực thành công, hệ thống chuyển hướng tiếp tục vào Personalized page theo phân luồng Job Goal tương ứng (US-07 hoặc US-08).
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `personalize_job_recommendation-bdd.spec.js`, `personalize-sdt-da-ton-tai.spec.js`, `personalize-so-dien-thoai-chua-ton-tai-otp.spec.js`.

### AC-024 — Thiết lập Mini-Onboarding 3 bước, lưu nháp tức thì và đồng bộ hai chiều với Onboarding Home
*(Ánh xạ trực tiếp: US-07, US-12)*
- **Given** người dùng đã đăng nhập và chưa có thông tin nào trong 3 tiêu chí cốt lõi (0/3 data: Job title, Province, Salary)
- **When** người dùng thực hiện lần lượt 3 câu hỏi tuần tự trong Mini-onboarding:
  1. Chọn vị trí công việc mong muốn từ gợi ý
  2. Chọn khu vực làm việc mong muốn (tối đa 5 khu vực)
  3. Chọn/nhập khoảng lương mong muốn rồi bấm hoàn tất
- **Then** hệ thống lưu nháp ngay giá trị vào Job Goal tại từng câu hỏi, không reload trang ở câu 1 và câu 2, và chỉ reload/fetch danh sách việc làm khi bấm hoàn tất câu 3
- **And** nếu người dùng đã có sẵn ít nhất 1 tiêu chí (≥1/3), hệ thống tự động bypass Mini-onboarding để hiển thị ngay danh sách việc làm gợi ý (US-08)
- **And** dữ liệu đã nhập tự động autofill vào các câu hỏi tương ứng trong luồng Onboarding 5 bước tại Trang chủ (REQ-002) mà không tạo khác biệt về kết quả lưu.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `personalize_job_recommendation-bdd.spec.js`, `personalize-bypass-onboarding-mini.spec.js`, `personalize-autofill-onboarding-home.spec.js`, `personalize-kiem-tra-bien-toi-da.spec.js`, `personalize-chon-chinh-xac-5-khu-vuc.spec.js`, `personalize-khong-chon-khu-vuc-negative.spec.js`, `personalize-bo-chon-va-chon-lai-khu-vuc.spec.js`.

### AC-025 — Khám phá việc làm cá nhân hóa, phân trang 30 tin và các chế độ sắp xếp linh hoạt
*(Ánh xạ trực tiếp: US-08 Tiêu chí 8.1, US-09 Tiêu chí 9.1, Tiêu chí 9.2)*
- **Given** người dùng đang ở Personalized page với trạng thái dữ liệu Job Goal đã có (≥1/3 data)
- **When** người dùng duyệt danh sách việc làm và chuyển đổi qua lại giữa 3 tùy chọn sắp xếp ("Liên quan nhất", "Lương cao nhất", "Mới nhất")
- **Then** hệ thống hiển thị danh sách 30 việc làm/trang từ Recommendation Engine kèm bộ UI phân trang chuẩn
- **And** danh sách việc làm được sắp xếp tương ứng chính xác theo thuật toán gợi ý, theo lương tối đa giảm dần, hoặc theo thời gian tạo tin tuyển dụng mới nhất.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `personalize_job_recommendation-bdd.spec.js`.

### AC-026 — Snapshot tiêu chí tìm việc, khảo sát bổ sung tùy chọn và tùy chỉnh nâng cao
*(Ánh xạ trực tiếp: US-08 Tiêu chí 8.2-8.5, US-09 Tiêu chí 9.3)*
- **Given** người dùng đang ở Personalized page
- **When** người dùng xem section khảo sát bổ sung (nếu còn thiếu tiêu chí) hoặc bấm CTA tại section Snapshot (khi đã đủ 3/3 tiêu chí)
- **Then** người dùng có thể tùy chọn bỏ qua (skip) các câu hỏi bổ sung mà không bị chặn trải nghiệm, hoặc mở modal chỉnh sửa để cập nhật lại 3 tiêu chí và bổ sung thêm số năm kinh nghiệm, ngành nghề mong muốn
- **And** các thay đổi lập tức được ghi nhận vào Job Goal và cập nhật danh sách việc làm gợi ý tương ứng.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `personalize_job_recommendation-bdd.spec.js`.

---

## 4. Nghiệp vụ và Độ Phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Khách vãng lai tiếp cận, xác thực OTP, thiết lập 3 bước tiêu chí và khám phá việc làm gợi ý | **Đã phủ** | TC-095 (`tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js`) |
| Cập nhật thêm số năm kinh nghiệm, ngành nghề và điều hướng từ menu Việc làm | **Đã phủ** | TC-095 (`tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js`) |
| Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu | **Đã phủ** | TC-096 (`tests/e2e/desktop/personalize-sdt-da-ton-tai.spec.js`) |
| Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5 khu vực | **Đã phủ** | TC-097 (`tests/e2e/desktop/personalize-kiem-tra-bien-toi-da.spec.js`) |
| Bỏ qua Onboarding mini khi tài khoản đã có sẵn ít nhất 1 trong 3 tiêu chí (Bypass) | **Đã phủ** | TC-098 (`tests/e2e/desktop/personalize-bypass-onboarding-mini.spec.js`) |
| Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding Home (REQ-002) | **Đã phủ** | TC-099 (`tests/e2e/desktop/personalize-autofill-onboarding-home.spec.js`) |
| Số điện thoại chưa tồn tại chuyển hướng sang màn hình nhập OTP tạo mới | **Đã phủ** | TC-100 (`tests/e2e/desktop/personalize-so-dien-thoai-chua-ton-tai-otp.spec.js`) |
| Chọn chính xác 5 khu vực làm việc (BVA = 5 biên trên) | **Đã phủ** | TC-101 (`tests/e2e/desktop/personalize-chon-chinh-xac-5-khu-vuc.spec.js`) |
| Không chọn khu vực làm việc nào và bấm tiếp tục (BVA biên dưới - Negative) | **Đã phủ** | TC-102 (`tests/e2e/desktop/personalize-khong-chon-khu-vuc-negative.spec.js`) |
| Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case) | **Đã phủ** | TC-103 (`tests/e2e/desktop/personalize-bo-chon-va-chon-lai-khu-vuc.spec.js`) |
| Toast Home gợi ý khám phá (US-03) & CTA trang Search (US-04) | Đã quy hoạch | Kiểm tra điều kiện cuộn trang khuất header và tự ẩn khi card chạm viewport |
| Phân trang 30 tin & sắp xếp 3 tiêu chí trên Personalized Page (US-08, US-09) | Đã quy hoạch | Kiểm tra số lượng card mỗi trang và logic sort |
| Tiêu đề Dynamic Loop text & Chuyển bước không reload trang (US-12) | Đã quy hoạch | Kiểm tra hiệu ứng đổi 3 cụm text trong 5 giây và trạng thái chuyển bước |
| Kiểm tra SEO Metadata và Open Graph tags (US-13) | Đã quy hoạch | Kiểm tra thẻ title, description, keywords, canonical và og tags |

---

## 5. Quyết Định Nghiệp Vụ Đã Chốt (Confirmed Decisions)

1. **Phân nhánh số điện thoại đăng ký / đăng nhập (US-06):**
   - Nếu số điện thoại chưa tồn tại trên hệ thống: Chuyển hướng sang luồng nhập mã xác thực OTP tạo mới tài khoản.
   - Nếu số điện thoại đã tồn tại: Chuyển hướng sang màn hình nhập mật khẩu để đăng nhập.
   - *Đã chốt (Hà Đinh, 2026-10-03): Đúng.*

2. **Giới hạn khu vực lựa chọn tại Mini-Onboarding (US-12):**
   - Người dùng được phép chọn tối đa 5 khu vực làm việc cùng lúc (kể cả tỉnh thành phổ biến hoặc tìm kiếm trong nhóm "Khác").
   - *Đã chốt (Hà Đinh, 2026-10-03): 5.*

3. **Cơ chế lưu dữ liệu Mini-Onboarding (US-07 Tiêu chí 7.2):**
   - Lưu nháp ngay từng câu hỏi khi người dùng trả lời. Nếu đóng tab/thoát giữa chừng, lần sau quay lại hệ thống nhận diện đã có ≥1/3 dữ liệu và áp dụng US-08 thay vì bắt làm lại Mini-onboarding từ đầu.
   - *Đã chốt theo BA Requirement.*

4. **Hiển thị section tại Trang chủ (US-01, US-02):**
   - Cần tối thiểu 1 dữ liệu (behavior hoặc Job Goal) VÀ kết quả gợi ý trả về ≥3 jobs mới hiển thị khối 9 job cards. Dưới 3 jobs hoặc không có dữ liệu đều hiển thị bộ 4 banner tĩnh + CTA.
   - *Đã chốt theo BA Requirement.*

5. **Tiêu đề section Home theo nền tảng (US-02 Tiêu chí 2.5):**
   - Desktop: `Việc làm dành riêng cho {Tên user}`.
   - Mobile web: `Việc làm dành riêng cho bạn` (không chèn tên user để bảo đảm an toàn UI, tránh vỡ layout).
   - *Đã chốt theo BA Requirement.*
