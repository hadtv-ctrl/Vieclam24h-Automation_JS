const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');

test.describe('Feature: Ứng tuyển việc làm @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;
  let newPage;

  test.afterEach(async () => {
    if (newPage) await newPage.close();
  });

  test('TC-036 - AC-008 Tải lên file CV sai định dạng hoặc quá dung lượng', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và đang ở trang chi tiết việc làm để ứng tuyển',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và sẵn sàng tại trang chủ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('When [1] Tôi mở một việc làm chi tiết và bấm "Ứng tuyển ngay"', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_click_first_job');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState();
      jobApplyPage = new JobApplyPage(newPage);

      await jobApplyPage.capture('after_job_detail_opened');
      await jobApplyPage.startApply({ otpCode: usersData[0]?.otp });
    });

    await test.step('And [1] Tôi chọn phương thức ứng tuyển bằng CV', async () => {
      await jobApplyPage.applyByCV();
      await jobApplyPage.capture('cv_method_selected');
    });

    await test.step('And [1] Tôi tải lên file sai định dạng hoặc không được hỗ trợ', async () => {
      const invalidPath = applyData.invalidCvPath || 'data/invalid_cv.txt';
      await jobApplyPage.uploadCV(invalidPath);
      await jobApplyPage.capture('invalid_cv_uploaded');
    });

    await test.step('Then [1] Hệ thống hiển thị thông báo lỗi định dạng hoặc chặn nộp hồ sơ', async () => {
      // Xác nhận thông báo lỗi xuất hiện hoặc modal chặn tiếp tục
      await expect(jobApplyPage.cvUploadError.or(jobApplyPage.applyModal)).toBeVisible();
      await jobApplyPage.capture('cv_format_error_checked');
    });
  });
});
