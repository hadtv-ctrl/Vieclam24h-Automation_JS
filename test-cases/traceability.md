# Ma trận truy vết REQ đến AC đến TC đến spec

Bảng tổng hợp toàn bộ chuỗi truy vết của dự án. Dựng ngược từ automation đang chạy, xem
`../requirements/README.md` để hiểu ý nghĩa các trạng thái.

Sinh lại bằng máy:

    node scripts/qa-trace.js

## Tổng quan

| Requirement | Chủ đề | Số AC | Số TC | Số spec |
|---|---|---|---|---|
| REQ-001 | Đăng ký tài khoản người tìm việc | 4 | 6 | 5 |
| REQ-002 | Onboarding tiêu chí tìm việc | 3 | 2 | 2 |
| REQ-003 | Ứng tuyển bằng CV hoặc hồ sơ trực tuyến | 4 | 4 | 4 |
| REQ-004 | Ứng tuyển việc không cần CV | 3 | 4 | 4 |
| REQ-005 | Quản lý hồ sơ cá nhân | 5 | 6 | 6 |
| REQ-006 | Trợ lý AI hoàn thiện hồ sơ | 2 | 2 | 2 |

Ghi chú: REQ-001 có 6 test case trên 5 file spec vì file spec API chứa hai test case.
AC-011 thuộc REQ-003 nhưng cũng được phủ bởi các test case của REQ-004, vì danh sách việc làm đã
ứng tuyển là điểm neo chung của cả hai luồng.

## Ma trận đầy đủ

| Test case | REQ | AC | Nền tảng | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|---|
| TC-001 | REQ-001 | AC-001 | Desktop | P0 | Có | tests/e2e/desktop/register_by_email-bdd.spec.js |
| TC-002 | REQ-001 | AC-001 | Mobile web | P0 | Có | tests/e2e/mobile-web/register_by_email-bdd.mobile.spec.js |
| TC-003 | REQ-001 | AC-002 | Desktop | P0 | Có | tests/e2e/desktop/register_by_phone-bdd.spec.js |
| TC-004 | REQ-001 | AC-002 | Mobile web | P0 | Có | tests/e2e/mobile-web/register_by_phone-bdd.mobile.spec.js |
| TC-005 | REQ-001 | AC-003 | API | P1 | Có | tests/api/register_api.spec.js |
| TC-006 | REQ-001 | AC-004 | API | P2 | Có | tests/api/register_api.spec.js |
| TC-007 | REQ-002 | AC-005 AC-006 AC-007 | Desktop | P1 | Có | tests/e2e/desktop/onboarding-bdd.spec.js |
| TC-008 | REQ-002 | AC-005 AC-006 AC-007 | Mobile web | P1 | Có | tests/e2e/mobile-web/onboarding-bdd.mobile.spec.js |
| TC-009 | REQ-003 | AC-008 AC-010 AC-011 | Desktop | P0 | Có | tests/e2e/desktop/apply_job_with_CV_flow-bdd.spec.js |
| TC-010 | REQ-003 | AC-008 AC-010 AC-011 | Mobile web | P0 | Có | tests/e2e/mobile-web/apply_job_with_CV_flow-bdd.mobile.spec.js |
| TC-011 | REQ-003 | AC-009 AC-010 AC-011 | Desktop | P1 | Có | tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js |
| TC-012 | REQ-003 | AC-009 AC-010 AC-011 | Mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_with_profile_flow-bdd.mobile.spec.js |
| TC-013 | REQ-004 | AC-012 AC-014 AC-011 | Desktop | P1 | Có | tests/e2e/desktop/apply_job_noCV_flow.spec.js |
| TC-014 | REQ-004 | AC-012 AC-014 AC-011 | Mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js |
| TC-015 | REQ-004 | AC-013 AC-014 AC-011 | Desktop | P0 | Có | tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js |
| TC-016 | REQ-004 | AC-013 AC-014 AC-011 | Mobile web | P0 | Có | tests/e2e/mobile-web/guest_apply_job_noCV_with_otp.mobile.spec.js |
| TC-017 | REQ-005 | AC-015 AC-016 AC-017 AC-019 | Desktop | P1 | Có | tests/e2e/desktop/complete_profile_setup-bdd.spec.js |
| TC-018 | REQ-005 | AC-015 AC-016 AC-017 AC-019 | Mobile web | P1 | Có | tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js |
| TC-019 | REQ-005 | AC-018 | Desktop | P2 | Có | tests/e2e/desktop/setting_user_profile-bdd.spec.js |
| TC-020 | REQ-005 | AC-018 | Mobile web | P2 | Có | tests/e2e/mobile-web/setting_user_profile-bdd.mobile.spec.js |
| TC-021 | REQ-005 | AC-019 | Desktop | P1 | Có | tests/e2e/desktop/upload_cv_profile-bdd.spec.js |
| TC-022 | REQ-005 | AC-019 | Mobile web | P1 | Có | tests/e2e/mobile-web/upload_cv_profile-bdd.mobile.spec.js |
| TC-023 | REQ-006 | AC-020 AC-021 | Desktop | P2 | Có | tests/e2e/desktop/profile_ai_writing-bdd.spec.js |
| TC-024 | REQ-006 | AC-020 AC-021 | Mobile web | P2 | Có | tests/e2e/mobile-web/profile_ai_writing-bdd.mobile.spec.js |

## Chất lượng bằng chứng của từng test case

Độ phủ trên giấy không bằng độ phủ thật. Bảng này ghi mức bằng chứng mà mỗi test case thực sự cung
cấp, đọc từ chính spec.

| Mức | Nghĩa | Test case |
|---|---|---|
| Mạnh | Có assertion ngay trong spec chứng minh kết quả nghiệp vụ | TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-011, TC-012 |
| Trung bình | Có chờ hoặc assertion nhưng chỉ ở điều kiện đầu vào, hoặc việc kiểm chứng nằm trong Page Object | TC-001, TC-002, TC-009, TC-010, TC-013, TC-014, TC-015, TC-016, TC-021, TC-022 |
| Yếu | Không có assertion nào trong spec; chỉ chứng minh luồng chạy không văng lỗi | TC-017, TC-018, TC-019, TC-020, TC-023, TC-024 |

### Quan hệ với cảnh báo của công cụ

Lệnh kiểm tra báo 12 finding loại "Test khai phủ AC nhưng không có assertion", cho các test case
TC-013 đến TC-024. Con số đó khác bảng trên vì hai thước đo khác nhau, và cả hai đều đúng:

- **Công cụ** đo một thứ kiểm được bằng máy: trong thân hàm test có lời gọi assertion nào không.
  TC-001, TC-002, TC-009, TC-010 có, nên không bị báo.
- **Bảng trên** đo thứ công cụ không thấy được: assertion đó có chứng minh **kết quả nghiệp vụ**
  không. TC-001 chỉ kiểm nút Đăng ký hiển thị trước khi bấm; TC-009 chỉ kiểm logo trang chủ ở bước
  điều kiện đầu. Cả hai đều không chứng minh việc đăng ký hay ứng tuyển thành công.

Ngược lại, TC-013 đến TC-016, TC-021 và TC-022 bị công cụ báo nhưng vẫn xếp Trung bình, vì phần kiểm
chứng có tồn tại — nó nằm trong Page Object nên công cụ không nhìn thấy. Đây là hạn chế đã biết của
cách đo, không phải lỗi của công cụ: assertion giấu trong Page Object thì không audit được từ tài liệu.

Việc cần làm, theo thứ tự: đưa assertion kết quả lên tầng spec cho sáu test case mức Yếu, rồi cho
bốn test case Trung bình chỉ có assertion ở điều kiện đầu.

## Cảnh báo: 11 test case mobile hiện KHÔNG chạy được

Cột Automation ghi "Co" nghĩa là **có file spec tồn tại**, không có nghĩa là spec đó chạy được.
Tại thời điểm dựng tài liệu này, toàn bộ spec trong thư mục mobile web không nạp được:

    npx playwright test --list
    Test has unknown parameter "homePage".
    Test has unknown parameter "onboardingPopup".
    Test has unknown parameter "jobSearchPage".
    Test has unknown parameter "userProfilePage".
    Test has unknown parameter "createJobApplyPage".
    Test has unknown parameter "createJobApplyNoCVPage".
    Total: 0 tests in 0 files

Nguyên nhân: các spec mobile nhận những fixture trên qua tham số, nhưng fixture mobile web chỉ cung
cấp một đối tượng gom chung các page object cùng fixture xác thực, không khai báo từng page object
thành fixture riêng như spec mong đợi.

Hệ quả cần nhớ khi đọc tài liệu này:

| Nhóm | Số test case | Trạng thái thật |
|---|---|---|
| Desktop | 11 | Nạp được, liệt kê được |
| API | 2 | Nạp được, liệt kê được |
| Mobile web | 11 | **Không nạp được**, chưa bao giờ chạy ở trạng thái hiện tại |

Các test case bị ảnh hưởng: TC-002, TC-004, TC-008, TC-010, TC-012, TC-014, TC-016, TC-018, TC-020,
TC-022, TC-024.

Vì một lỗi nạp file làm hỏng cả lượt liệt kê, lệnh chạy toàn bộ cũng trả về 0 test. Phải chỉ định
project desktop hoặc API thì mới chạy được. Đây là việc cần sửa trước khi tin vào bất kỳ con số độ
phủ nào trong tài liệu này.

## Nghiệp vụ chưa có test case

Toàn bộ 21 acceptance criterion đã ghi nhận đều có ít nhất một test case. Điều đó **không** có nghĩa
là nghiệp vụ đã được phủ đủ: các nhánh negative, giá trị biên và ràng buộc quyền chưa từng được viết
thành acceptance criterion, nên chúng không xuất hiện ở đây. Danh sách những nhánh đó nằm ở mục
"Nghiệp vụ CHƯA được automation phủ" trong từng file requirement, và phần "Ứng viên automation"
trong từng file test case.

Thứ tự ưu tiên bổ sung, tổng hợp từ sáu requirement:

| Thứ tự | Việc cần làm | Requirement |
|---|---|---|
| 1 | Khách vãng lai ứng tuyển bằng số điện thoại đã có tài khoản | REQ-004 |
| 2 | Đọc lại hồ sơ để đối chiếu dữ liệu đã lưu | REQ-005 |
| 3 | Nhánh nhập sai OTP ở cả đăng ký lẫn ứng tuyển | REQ-001, REQ-004 |
| 4 | Ứng tuyển lại việc làm đã nộp | REQ-003 |
| 5 | Nhập sai mã xác minh khi bật cho phép tìm kiếm hồ sơ | REQ-005 |
| 6 | Đăng ký bằng email đã tồn tại | REQ-001 |
| 7 | So sánh nội dung trước và sau khi AI viết lại | REQ-006 |
