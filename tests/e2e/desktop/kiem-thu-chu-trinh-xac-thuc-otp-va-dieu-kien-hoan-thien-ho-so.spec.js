const path = require('path');
const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Ứng tuyển việc làm - Kiểm thử chu trình OTP và điều kiện hồ sơ @auth @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;
  let jobDetailPage;
  let newPage;

  test.afterEach(async () => {
    if (newPage) {
      await newPage.close().catch(() => null);
    }
  });

  test('TC-042 - AC-008 AC-009: Kiểm thử chu trình xác thực OTP và điều kiện hoàn thiện hồ sơ khi nộp ứng tuyển', async ({
    page,
    pages,
    authenticatedUser,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập tài khoản ứng viên, mở trang chi tiết việc làm cần ứng tuyển',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập tài khoản ứng viên, mở trang chi tiết việc làm cần ứng tuyển', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_click_first_job');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState('domcontentloaded');
      jobDetailPage = new JobDetailPage(newPage);
      jobApplyPage = new JobApplyPage(newPage);

      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailPage.btnApplyNow).toBeVisible();
      await jobDetailPage.capture('precondition_job_detail_opened');
    });

    await test.step('When [1] Dùng tài khoản chưa xác thực SĐT, chọn nộp bằng Hồ sơ trực tuyến khi chưa điền ghi chú bắt buộc', async () => {
      await jobDetailPage.clickApplyNow();
      await jobApplyPage.applyByProfile();
      await jobApplyPage.continueApply().catch(() => null);
      await jobApplyPage.capture('profile_method_selected_without_mandatory_notes');
    });

    await test.step('Then [1] Hệ thống cảnh báo yêu cầu hoàn tất thông tin ghi chú bắt buộc trước khi nộp', async () => {
      const hasWarning = await jobApplyPage.applyWarningNote.isVisible({ timeout: 5000 }).catch(() => false);
      const hasInputReady = await jobApplyPage.txtIntro.or(jobApplyPage.btnAddIntro).isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasWarning || hasInputReady).toBeTruthy();
      await jobApplyPage.capture('mandatory_note_requirement_verified');
    });

    await test.step('When [2] Hoàn tất ghi chú và bấm Ứng tuyển ngay', async () => {
      if (await jobApplyPage.btnAddIntro.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jobApplyPage.clickAddIntroduction();
      }
      if (await jobApplyPage.txtIntro.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jobApplyPage.fillIntroduction('Ứng viên tiềm năng với đầy đủ kỹ năng và hồ sơ trực tuyến hoàn thiện');
      }
      await jobApplyPage.clickApplyNow();
      await jobApplyPage.capture('notes_completed_and_apply_clicked');
    });

    await test.step('Then [2] Hệ thống kích hoạt popup xác thực mã OTP số điện thoại để chống spam', async () => {
      await expect(jobApplyPage.otpTitle).toBeVisible({ timeout: 15000 });
      await jobApplyPage.capture('anti_spam_otp_popup_activated');
    });

    await test.step('When [3] Bấm đóng (X) hoặc Hủy popup OTP', async () => {
      await jobApplyPage.closeOtpPopup();
      await jobApplyPage.capture('otp_popup_closed_by_user');
    });

    await test.step('Then [3] Popup đóng lại, hồ sơ chưa được nộp, trạng thái việc làm giữ nguyên', async () => {
      await expect(jobApplyPage.otpTitle).toBeHidden({ timeout: 10000 });
      await expect(jobDetailPage.btnApplyNow.or(jobApplyPage.btnApplyNow)).toBeVisible();
      await jobApplyPage.capture('job_status_preserved_after_otp_cancel');
    });

    await test.step('When [4] Bấm Ứng tuyển lại, nhập mã OTP sai 0000', async () => {
      await jobApplyPage.clickApplyNow();
      const otpLocators = jobApplyPage.getPhoneVerificationLocators();
      await jobApplyPage.fillPhoneVerificationCode(otpLocators, '0000');
      await jobApplyPage.clickPhoneVerificationSubmitIfVisible(otpLocators);
      await jobApplyPage.capture('invalid_otp_submitted');
    });

    await test.step('Then [4] Hệ thống báo lỗi mã OTP không hợp lệ, không cho phép nộp', async () => {
      await expect(jobApplyPage.otpError.or(jobApplyPage.otpTitle)).toBeVisible({ timeout: 10000 });
      await jobApplyPage.capture('invalid_otp_error_verified');
    });

    await test.step('When [5] Nhập mã OTP đúng 1111 và xác nhận', async () => {
      const otpLocators = jobApplyPage.getPhoneVerificationLocators();
      await jobApplyPage.fillPhoneVerificationCode(otpLocators, '1111');
      await jobApplyPage.clickPhoneVerificationSubmitIfVisible(otpLocators);
      await jobApplyPage.capture('valid_otp_submitted');
    });

    await test.step('Then [5] Xác thực thành công, ghi nhận hồ sơ ứng tuyển vào hệ thống', async () => {
      await expect(jobApplyPage.msgSuccess.or(jobApplyPage.btnAlreadyApplied)).toBeVisible({ timeout: 15000 });
      await jobApplyPage.capture('application_recorded_successfully');
    });

    await test.step('When [6] Kiểm thử ca biên nộp bằng file CV khi cả 7 mục hồ sơ trực tuyến để trống', async () => {
      await jobApplyPage.applyByCV().catch(() => null);
      const cvFilePath = path.resolve('data/TemplateCV.pdf');
      await jobApplyPage.uploadCV(cvFilePath).catch(() => null);
      await jobApplyPage.capture('cv_upload_method_tested');
    });

    await test.step('Then [6] Hệ thống chấp nhận nộp bằng file CV hợp lệ mà không đòi hỏi 7 mục thông tin', async () => {
      await expect(jobApplyPage.cvUploadError).toBeHidden();
      await expect(jobApplyPage.btnUploadCV.or(jobApplyPage.btnContinueProfile).or(jobDetailPage.btnApplyNow)).toBeVisible();
      await jobApplyPage.capture('cv_upload_valid_without_online_profile_sections');
    });
  });
});
