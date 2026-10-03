# Test case — REQ-008 Việc làm dành riêng & Gợi ý tiêu chí tìm việc cá nhân hóa

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-095 | AC-023 AC-024 AC-025 AC-026 | Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý | P1 | Có | tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js |
| TC-096 | AC-023 | Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu | P2 | Có | tests/e2e/desktop/personalize-sdt-da-ton-tai.spec.js |
| TC-097 | AC-023 | Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5 | P2 | Có | tests/e2e/desktop/personalize-kiem-tra-bien-toi-da.spec.js |
| TC-098 | AC-024 | Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc | P2 | Có | tests/e2e/desktop/personalize-bypass-onboarding-mini.spec.js |
| TC-099 | AC-024 | Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home | P2 | Có | tests/e2e/desktop/personalize-autofill-onboarding-home.spec.js |
| TC-100 | AC-023 | Số điện thoại chưa tồn tại chuyển hướng sang luồng xác thực OTP | P0 | Có | tests/e2e/desktop/personalize-so-dien-thoai-chua-ton-tai-otp.spec.js |
| TC-101 | AC-024 | Chọn chính xác 5 khu vực làm việc (Giá trị biên tối đa) | P1 | Có | tests/e2e/desktop/personalize-chon-chinh-xac-5-khu-vuc.spec.js |
| TC-102 | AC-024 | Không chọn khu vực làm việc nào và tiếp tục (Giá trị biên dưới - Negative) | P2 | Có | tests/e2e/desktop/personalize-khong-chon-khu-vuc-negative.spec.js |
| TC-103 | AC-024 | Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case) | P2 | Có | tests/e2e/desktop/personalize-bo-chon-va-chon-lai-khu-vuc.spec.js |
| TC-104 | AC-023 | Khách vãng lai truy cập deep link Personalized Page bắt buộc đăng nhập | P0 | Có | tests/e2e/desktop/personalize-deeplink-bat-buoc-login.spec.js |
| TC-105 | AC-023 | Kiểm tra cấu hình SEO Metadata và Open Graph tags trên Personalized Page | P2 | Có | tests/e2e/desktop/personalize-seo-metadata.spec.js |
| TC-106 | AC-024 | Thiết lập Mini-Onboarding 3 bước trực tiếp từ URL Personalized Page | P1 | Có | tests/e2e/desktop/personalize-onboarding-truc-tiep-tren-trang.spec.js |


## Chi tiết

### TC-095 — Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý

- **Loại:** Chức năng / Tích hợp E2E | **Ưu tiên:** P1 | **Kỹ thuật:** Kịch bản luồng thao tác người dùng (User Journey Flow)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize_job_recommendation-bdd.spec.js`
- **Tiền điều kiện:** Khách vãng lai truy cập màn hình trang chủ Việc Làm 24h (Chưa đăng nhập).
- **Dữ liệu kiểm thử:** `data/personalizeJobData.json` (Số điện thoại mới ngẫu nhiên hoặc tài khoản kiểm thử, OTP `1111`, Họ tên `Hà Đinh`, Ngành nghề: `nhân viên bán hàng`, Khu vực: `TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang`, Mức lương: `10 - 15 triệu`, Kinh nghiệm: `3 năm`, Ngành: `Hành chính - Thư ký`).
> *Ghi chú nghiệp vụ:* Kịch bản kiểm thử luồng người dùng tiếp cận khối gợi ý việc làm riêng ("+10 việc làm có lương hấp dẫn"), tiến hành đăng ký/xác thực tài khoản qua OTP, hoàn tất 3 bước khảo sát tiêu chí tìm việc, tinh chỉnh thêm kinh nghiệm/ngành nghề và truy cập danh sách việc làm phù hợp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trang chủ, đóng popup/banner quảng cáo nếu có | Trang chủ sẵn sàng hiển thị khối "Việc làm dành riêng cho bạn" |
| 2 | Nhấn link "+10 việc làm có lương hấp dẫn" và nhập SĐT + OTP + Họ tên | Xác thực tài khoản thành công, chấp thuận điều khoản và mở màn hình thiết lập tiêu chí |
| 3 | Chọn công việc mong muốn (nhân viên bán hàng), tối đa 5 khu vực (TP.HCM, Hà Nội, Bình Dương, Đồng Nai, An Giang), mức lương mong muốn (10 - 15 triệu) | Hoàn tất thiết lập tiêu chí ban đầu, hệ thống hiển thị trang "Tiêu chí tìm việc của tôi" |
| 4 | Chuyển tab Lương cao nhất/Mới nhất, nhấn Chỉnh sửa để cập nhật kinh nghiệm 3 năm và ngành nghề Hành chính - Thư ký | Tiêu chí bổ sung được lưu thành công |
| 5 | Điều hướng đến menu Việc làm -> Tìm việc làm và nhấn "Xem tất cả" tại phần việc làm dành riêng | Danh sách việc làm phù hợp hiển thị đầy đủ, cho phép mở xem chi tiết việc làm |


### TC-096 — Số điện thoại đã tồn tại ở luồng việc làm riêng hiển thị màn hình mật khẩu

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-sdt-da-ton-tai.spec.js`
- **Tiền điều kiện:** Môi trường sẵn sàng cho kịch bản (Khách vãng lai nhập số điện thoại đã tồn tại ở luồng việc làm dành riêng)
- **Dữ liệu kiểm thử:** Dữ liệu theo nghiệp vụ đã chốt (SĐT đã có tài khoản, ví dụ: 0987654321)
> *Ghi chú nghiệp vụ:* Quyết định chốt từ Q-1: đúng (Hiển thị màn hình nhập mật khẩu thay vì OTP tạo mới).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện thao tác với điều kiện: đúng | Hệ thống phản hồi đúng theo quyết định đã chốt |


### TC-097 — Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-kiem-tra-bien-toi-da.spec.js`
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập liệu
- **Dữ liệu kiểm thử:** trường dữ liệu: chuỗi 6 ký tự (hoặc vượt quá giới hạn 5)
> *Ghi chú nghiệp vụ:* Phân tích biên trên từ quyết định Q-2: giới hạn tối đa 5 ký tự / 5 mục lựa chọn.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập các trường thông tin hợp lệ | Không có cảnh báo lỗi |
| 2 | Nhập trường dữ liệu có 6 ký tự | Hệ thống báo lỗi hoặc giới hạn không cho nhập quá 5 ký tự |


### TC-098 — Bỏ qua Onboarding mini khi tài khoản đã có sẵn tiêu chí tìm việc

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân nhánh nghiệp vụ / Kiểm thử trạng thái
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-bypass-onboarding-mini.spec.js`
- **Tiền điều kiện:** Người dùng đã có sẵn ít nhất 1 trong 3 thông tin tiêu chí (nơi làm việc, vị trí, hoặc mức lương).
- **Dữ liệu kiểm thử:** Tài khoản kiểm thử đã lưu tiêu chí trước đó.
> *Ghi chú nghiệp vụ:* Nếu tài khoản đã có tiêu chí, hệ thống không mở Onboarding mini mà chuyển thẳng đến trang "Tiêu chí tìm việc của tôi".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trang chủ và bấm điểm chạm việc làm dành riêng | Mở modal đăng ký/đăng nhập hoặc chuyển hướng luồng cá nhân hóa |
| 2 | Đăng nhập tài khoản đã có sẵn thông tin tiêu chí | Hệ thống nhận diện tiêu chí đã có và không hiển thị modal Onboarding mini 3 bước |
| 3 | Kiểm tra màn hình đích | Trang "Tiêu chí tìm việc của tôi" và danh sách việc làm gợi ý hiển thị thành công |


### TC-099 — Kiểm tra autofill đồng bộ dữ liệu từ Onboarding mini sang Onboarding màn hình Home

- **Loại:** Chức năng / Tích hợp chéo REQ-008 & REQ-002 | **Ưu tiên:** P2 | **Kỹ thuật:** Luồng tích hợp dữ liệu chéo (Cross-feature Data Sync)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-autofill-onboarding-home.spec.js`
- **Tiền điều kiện:** Người dùng thiết lập tiêu chí qua Onboarding mini (Vị trí, Khu vực, Mức lương).
- **Dữ liệu kiểm thử:** Vị trí `nhân viên bán hàng`, Khu vực `TP.HCM`, Mức lương `10 - 15 triệu`.
> *Ghi chú nghiệp vụ:* Dữ liệu lưu từ Onboarding mini tự động điền sẵn (autofill) vào các bước tương ứng tại Onboarding màn hình Home (REQ-002).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Hoàn tất thiết lập tiêu chí qua Onboarding mini | Tiêu chí được lưu thành công vào hồ sơ |
| 2 | Điều hướng về màn hình Trang chủ (Home) | Trang chủ hiển thị hoặc mở Onboarding Home |
| 3 | Kiểm tra các trường thông tin tại Onboarding Home | Các giá trị Khu vực, Vị trí, Mức lương được autofill chính xác theo dữ liệu đã chọn từ Onboarding mini |


### TC-100 — Số điện thoại chưa tồn tại chuyển hướng sang luồng xác thực OTP

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-so-dien-thoai-chua-ton-tai-otp.spec.js`
- **Tiền điều kiện:** Người dùng đang ở màn hình nhập số điện thoại của luồng tiếp cận việc làm dành riêng.
- **Dữ liệu kiểm thử:** Số điện thoại hợp lệ chưa từng đăng ký trên hệ thống (vd: 0999123456)
> *Ghi chú nghiệp vụ:* Q-1 chốt luồng rẽ nhánh cho số điện thoại. TC-096 đã kiểm tra case tài khoản tồn tại, cần bổ sung case tài khoản chưa tồn tại (luồng tạo mới) để đảm bảo độ phủ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số điện thoại chưa đăng ký và bấm 'Tiếp tục' | Hệ thống không hiển thị màn hình mật khẩu mà chuyển hướng sang màn hình nhập mã OTP để tạo tài khoản mới. |


### TC-101 — Chọn chính xác 5 khu vực làm việc (Giá trị biên tối đa)

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-chon-chinh-xac-5-khu-vuc.spec.js`
- **Tiền điều kiện:** Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc.
- **Dữ liệu kiểm thử:** 5 khu vực làm việc bất kỳ (vd: Hà Nội, TP.HCM, Đà Nẵng, Cần Thơ, Hải Phòng)
> *Ghi chú nghiệp vụ:* Q-2 chốt giới hạn tối đa 5 khu vực. TC-097 đã test case vượt quá biên (>5), cần test case ngay tại giá trị biên (BVA = 5) để đảm bảo hệ thống cho phép lưu thành công.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn lần lượt đúng 5 khu vực làm việc khác nhau | Hệ thống cho phép chọn thành công cả 5 khu vực. Các khu vực còn lại bị vô hiệu hóa (disabled) hoặc có thông báo đã đạt giới hạn. |
| 2 | Bấm 'Tiếp tục' hoặc 'Lưu' | Hệ thống lưu thành công 5 khu vực và chuyển sang bước tiếp theo. |


### TC-102 — Không chọn khu vực làm việc nào và tiếp tục (Giá trị biên dưới - Negative)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-khong-chon-khu-vuc-negative.spec.js`
- **Tiền điều kiện:** Người dùng đang ở bước thiết lập tiêu chí tìm việc (Onboarding mini) - phần chọn khu vực làm việc.
- **Dữ liệu kiểm thử:** Không có dữ liệu
> *Ghi chú nghiệp vụ:* Áp dụng BVA cho Q-2, kiểm tra trường hợp người dùng không chọn khu vực nào (0) xem hệ thống có chặn lại bằng validation message không.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Để trống, không chọn bất kỳ khu vực làm việc nào | Nút 'Tiếp tục' bị vô hiệu hóa (disabled) hoặc khi bấm vào sẽ hiển thị thông báo lỗi yêu cầu chọn ít nhất 1 khu vực. |


### TC-103 — Bỏ chọn khu vực khi đã đạt tối đa 5 và chọn lại khu vực mới (Edge case)

- **Loại:** Chức năng | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-bo-chon-va-chon-lai-khu-vuc.spec.js`
- **Tiền điều kiện:** Người dùng đang ở bước chọn khu vực làm việc và đã chọn đủ 5 khu vực.
- **Dữ liệu kiểm thử:** 5 khu vực đã chọn, 1 khu vực mới chưa chọn
> *Ghi chú nghiệp vụ:* Edge case cho Q-2, đảm bảo logic đếm số lượng khu vực hoạt động đúng khi người dùng thay đổi quyết định (chọn max, bỏ bớt, chọn lại).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bỏ chọn 1 khu vực trong danh sách 5 khu vực đã chọn | Hệ thống cho phép bỏ chọn, bộ đếm giảm xuống 4/5, các khu vực khác được mở khóa (enabled) trở lại. |
| 2 | Chọn 1 khu vực mới khác | Hệ thống cho phép chọn khu vực mới, bộ đếm tăng lên 5/5 và khóa các lựa chọn còn lại. |
| 3 | Bấm 'Tiếp tục' | Hệ thống lưu thành công danh sách 5 khu vực mới cập nhật. |


### TC-104 — Khách vãng lai truy cập deep link Personalized Page bắt buộc đăng nhập

- **Loại:** Chức năng / Bảo mật quyền truy cập | **Ưu tiên:** P0 | **Kỹ thuật:** Phân tích luồng điều hướng trực tiếp (Deep Link Flow)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-deeplink-bat-buoc-login.spec.js`
- **Tiền điều kiện:** Khách vãng lai chưa đăng nhập truy cập trực tiếp đường dẫn URL trang Việc làm dành riêng cho bạn.
- **Dữ liệu kiểm thử:** URL `https://seeker.vl24hv2.qc.sieuviet-team.com/viec-lam-danh-rieng-cho-ban.html`
> *Ghi chú nghiệp vụ:* Kiểm thử US-06 và US-10: khách vãng lai truy cập deep link bắt buộc phải đăng nhập trước khi thấy nội dung việc làm.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trực tiếp URL trang Việc làm dành riêng cho bạn | Trang tải xong, URL đúng `/viec-lam-danh-rieng-cho-ban.html` |
| 2 | Kiểm tra giao diện hiển thị cho khách vãng lai | Tiêu đề trang cá nhân hóa hiển thị, form bắt buộc đăng nhập/đăng ký hiển thị rõ ràng, không hiển thị danh sách việc làm gợi ý |


### TC-105 — Kiểm tra cấu hình SEO Metadata và Open Graph tags trên Personalized Page

- **Loại:** Phi chức năng / SEO | **Ưu tiên:** P2 | **Kỹ thuật:** Kiểm thử thẻ Metadata và Social Sharing Tags
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-seo-metadata.spec.js`
- **Tiền điều kiện:** Truy cập trang Việc làm dành riêng cho bạn để kiểm tra các thẻ SEO & Social Metadata.
- **Dữ liệu kiểm thử:** URL `https://seeker.vl24hv2.qc.sieuviet-team.com/viec-lam-danh-rieng-cho-ban.html`
> *Ghi chú nghiệp vụ:* Kiểm thử US-13: xác nhận title, description, keywords, canonical và OG tags khớp với đặc tả của BA.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập trực tiếp trang Personalized Page | Trang tải xong DOM |
| 2 | Kiểm tra tiêu đề trang (Title) và các thẻ Meta chuẩn SEO | Title chứa 'Việc làm dành riêng cho bạn', meta description và keywords đúng nội dung, canonical link kết thúc bằng `/viec-lam-danh-rieng-cho-ban.html` |
| 3 | Kiểm tra các thẻ Open Graph (OG) | og:title, og:url, og:description hiển thị đúng chuẩn |


### TC-106 — Thiết lập Mini-Onboarding 3 bước trực tiếp từ URL Personalized Page

- **Loại:** Chức năng / Tích hợp E2E | **Ưu tiên:** P1 | **Kỹ thuật:** Kịch bản luồng thao tác người dùng trên URL riêng (Direct Page Flow)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/personalize-onboarding-truc-tiep-tren-trang.spec.js`
- **Tiền điều kiện:** Người dùng truy cập trực tiếp URL trang Việc làm dành riêng cho bạn, xác thực tài khoản và làm 3 bước Mini-onboarding.
- **Dữ liệu kiểm thử:** SĐT mới ngẫu nhiên, OTP `1111`, Họ tên `Hà Đinh`, Vị trí `nhân viên bán hàng`, Khu vực `TP.HCM`, Mức lương `10 - 15 triệu`.
> *Ghi chú nghiệp vụ:* Kiểm thử US-07 và US-12: tài khoản 0/3 data vào trực tiếp Personalized Page bắt buộc hoàn thành Mini-onboarding 3 bước ngay trên trang.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập URL Personalized Page, nhập SĐT, OTP, Họ tên và chấp thuận điều khoản | Xác thực tài khoản thành công, hệ thống mở khóa luồng Mini-onboarding 3 bước |
| 2 | Thực hiện Bước 1 (nhập vị trí công việc), Bước 2 (chọn khu vực), Bước 3 (nhập khoảng lương) rồi bấm Hoàn tất | Mỗi bước chuyển mượt mà, lưu tiêu chí thành công |
| 3 | Kiểm tra giao diện sau khi hoàn tất | Hệ thống cập nhật hiển thị giao diện Personalized Page và danh sách việc làm gợi ý |

