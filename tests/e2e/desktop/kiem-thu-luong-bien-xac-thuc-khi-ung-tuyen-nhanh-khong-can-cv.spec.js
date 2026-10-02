const { test, expect } = require('../../../core/fixtures/baseTest');
const { JobApplyNoCVPage } = require('../../../pages/desktop/JobApplyNoCVPage');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');

test.describe('Feature: Ứng tuyển không cần CV - Kiểm thử luồng biên và xác thực @guest @no-auth @applyjob @desktop @e2e @REQ-004', () => {
  let jobApplyNoCVPage;
  let popupConsent;

  test('TC-045 - AC-012 AC-013: Kiểm thử luồng biên & xác thực khi ứng tuyển nhanh không cần CV', async ({
    page,
  }, testInfo) => {
    jobApplyNoCVPage = new JobApplyNoCVPage(page);
    popupConsent = new PopupConsent(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng mở bài đăng tuyển dụng hỗ trợ nộp nhanh không cần CV (hồ sơ rút gọn)',
    });

    await test.step('Given Tiền điều kiện: Người dùng mở bài đăng tuyển dụng hỗ trợ nộp nhanh không cần CV (hồ sơ rút gọn)', async () => {
      await jobApplyNoCVPage.setupNoCVApplyPrecondition();
      await expect(jobApplyNoCVPage.btnApplyNoCV).toBeVisible({ timeout: 15000 });
      await jobApplyNoCVPage.capture('precondition_nocv_job_opened');
    });

    await test.step('When [1] Mở form nộp hồ sơ rút gọn, để trống các trường bắt buộc (Email, Kinh nghiệm) và bấm nộp', async () => {
      await jobApplyNoCVPage.openApplyForm();
      await expect(jobApplyNoCVPage.applyModal).toBeVisible();
      await jobApplyNoCVPage.submitApply();
      await jobApplyNoCVPage.capture('submitted_with_empty_mandatory_fields');
    });

    await test.step('Then [1] Hệ thống hiển thị thông báo lỗi validation bắt buộc nhập, chặn gửi hồ sơ', async () => {
      await expect(jobApplyNoCVPage.validationError).toBeVisible({ timeout: 5000 });
      await expect(jobApplyNoCVPage.applyModal).toBeVisible();
      await jobApplyNoCVPage.capture('mandatory_validation_error_displayed');
    });

    await test.step('When [2] Thành viên đã login nhưng chưa xác thực SĐT điền đủ thông tin và gửi nộp', async () => {
      await jobApplyNoCVPage.fillContactInfo('Nguyễn Văn Test', '0912345678', 'test_user@example.com', 'Có kinh nghiệm bán hàng');
      await jobApplyNoCVPage.submitApply();
      await jobApplyNoCVPage.capture('unverified_phone_form_submitted');
    });

    await test.step('Then [2] Hệ thống phát hiện SĐT chưa xác thực và kích hoạt popup yêu cầu nhập mã OTP', async () => {
      await expect(jobApplyNoCVPage.otpModal).toBeVisible({ timeout: 10000 });
      await expect(jobApplyNoCVPage.otpTitle).toBeVisible();
      await jobApplyNoCVPage.capture('otp_modal_triggered_for_unverified_phone');
    });

    await test.step('When [3] Khách vãng lai nhập SĐT đã tồn tại nhưng cố tình nhập sai mã OTP 0000', async () => {
      await jobApplyNoCVPage.fillOtp('0000');
      await jobApplyNoCVPage.submitOtp();
      await jobApplyNoCVPage.capture('invalid_otp_submitted');
    });

    await test.step('Then [3] Hệ thống báo lỗi mã OTP không hợp lệ, không tự động đăng nhập và không gửi đơn', async () => {
      await expect(jobApplyNoCVPage.otpError).toBeVisible({ timeout: 5000 });
      await expect(jobApplyNoCVPage.otpModal).toBeVisible();
      await jobApplyNoCVPage.capture('invalid_otp_error_verified');
    });

    await test.step('When [4] Khách vãng lai nhập SĐT mới, nhập đúng OTP nhưng bấm \'Từ chối\' popup Consent Form', async () => {
      await jobApplyNoCVPage.fillOtp('1111');
      await jobApplyNoCVPage.submitOtp();
      await expect(popupConsent.popupTitle).toBeVisible({ timeout: 10000 });
      await popupConsent.reject();
      await jobApplyNoCVPage.capture('consent_rejected_by_user');
    });

    await test.step('Then [4] Hệ thống dừng nộp đơn và thông báo yêu cầu đồng ý điều khoản dữ liệu để tiếp tục', async () => {
      await expect(popupConsent.consentWarning).toBeVisible({ timeout: 5000 });
      await expect(popupConsent.popupTitle).toBeVisible();
      await jobApplyNoCVPage.capture('consent_warning_displayed');
    });

    await test.step('When [5] Đồng ý Consent Form', async () => {
      await popupConsent.agree();
      await jobApplyNoCVPage.capture('consent_agreed_by_user');
    });

    await test.step('Then [5] Hoàn tất tạo tài khoản ngầm và nộp đơn ứng tuyển thành công', async () => {
      await expect(jobApplyNoCVPage.msgSuccess).toBeVisible({ timeout: 10000 });
      await expect(jobApplyNoCVPage.btnDone).toBeVisible();
      await jobApplyNoCVPage.capture('application_completed_successfully');
    });
  });
});
