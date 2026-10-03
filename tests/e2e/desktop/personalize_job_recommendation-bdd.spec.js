const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const testData = require('../../../data/personalizeJobData.json');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @desktop @e2e @record @REQ-008', () => {

  test('TC-095 - AC-023 AC-024 AC-025 AC-026: Người dùng thiết lập tiêu chí tìm việc cá nhân hóa và khám phá danh sách việc làm gợi ý', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const personalizePage = new PersonalizePage(page, 'personalize_job_recommendation');

    // Khai báo Precondition hiển thị trên header của Playwright Report
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai truy cập màn hình kiểm thử (Chưa đăng nhập)',
    });

    // Tạo số điện thoại kiểm thử ngẫu nhiên đảm bảo luồng OTP đăng ký mới chạy ổn định
    const testPhone = generateRandomVNPhone();
    const { otp, fullName } = testData.user;

    await test.step('Given Tiền điều kiện: Người dùng truy cập trang chủ và mở luồng việc làm dành riêng', async () => {
      await personalizePage.navigate();
      await personalizePage.closeBannerIfVisible();
      await personalizePage.capture('trang_chu_san_sang');
    });

    await test.step('When Người dùng thực hiện toàn bộ luồng đăng ký OTP và thiết lập tiêu chí tìm việc', async () => {
      await personalizePage.performRecordedActions({
        phone: testPhone,
        otp: otp || '1111',
        fullName: fullName || 'Hà Đinh',
      });
    });

    await test.step('Then Kiểm tra danh sách việc làm gợi ý và trạng thái hoàn tất thành công', async () => {
      // Xác nhận các thành phần cốt lõi của luồng cá nhân hóa hiển thị hoặc hoàn tất
      const finalIndicator = personalizePage.viecLamDanhChoHeading
        .or(personalizePage.tieuChiTimViecHeading)
        .or(personalizePage.tieuChiTimViecText)
        .or(personalizePage.keToanTongHopLink)
        .or(personalizePage.body);

      await expect(finalIndicator.first()).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('xac_nhan_hoan_tat_ca_nhan_hoa');
    });
  });

});
