const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyNoCVPage } = require('../../../pages/desktop/JobApplyNoCVPage');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');

test.describe('Ứng tuyển không CV - Luồng biên và OTP @guest @no-auth @applyjob @desktop @e2e @REQ-004', () => {
  let jobPage;
  let jobApplyNoCVPage;
  let popupConsent;

  test.afterEach(async () => {
    if (jobPage) await jobPage.close().catch(() => null);
  });

  test('TC-045 - AC-012 AC-013: Ứng tuyển nhanh không cần CV và xác thực OTP', async ({
    page,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai), mở việc làm không cần CV trên môi trường QC',
    });

    const guestApplyData = {
      ...applyData.noCVApply.guestJob,
      phone: generateRandomVNPhone(),
    };

    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và truy cập trang chủ QC', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible({ timeout: 15000 });
      await homePage.capture('guest_homepage_opened');
    });

    await test.step('And Người dùng đóng các popup đang che nội dung', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
    });

    await test.step('When [1] Mở danh sách việc không cần CV và click vào việc làm đầu tiên', async () => {
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.clickNoCVJobLink();
      await expect(jobSearchPage.firstJobLink).toBeVisible({ timeout: 15000 });
      await jobSearchPage.capture('nocv_jobs_list_visible');

      jobPage = await jobSearchPage.clickFirstJob();
      await jobPage.waitForLoadState('domcontentloaded');
      jobApplyNoCVPage = new JobApplyNoCVPage(jobPage);
      popupConsent = new PopupConsent(jobPage);

      await jobApplyNoCVPage.waitForPageReady();
      await expect(jobApplyNoCVPage.btnApplyNoCV).toBeVisible({ timeout: 15000 });
      await jobApplyNoCVPage.capture('job_detail_opened');
    });

    await test.step('When [2] Mở form ứng tuyển nhanh không cần CV', async () => {
      await jobApplyNoCVPage.startGuestApplyNoCV();
      await expect(jobApplyNoCVPage.txtFullName).toBeVisible({ timeout: 15000 });
      await expect(jobApplyNoCVPage.txtPhone).toBeVisible();
      await jobApplyNoCVPage.capture('guest_nocv_form_opened');
    });

    await test.step('When [3] Điền thông tin ứng tuyển với SĐT mới', async () => {
      await jobApplyNoCVPage.fillGuestContact(guestApplyData);
      await jobApplyNoCVPage.fillMiniProfile(guestApplyData);
      await expect(jobApplyNoCVPage.txtPhone).toHaveValue(guestApplyData.phone);
      await jobApplyNoCVPage.capture('guest_nocv_profile_filled');
    });

    await test.step('When [4] Gửi hồ sơ và xác thực OTP trên QC', async () => {
      await jobApplyNoCVPage.submitGuestProfile(guestApplyData.phone);
      await jobApplyNoCVPage.verifyGuestPhoneOtp(usersData[0]?.otp || '1111');
      await popupConsent.agree();
      await jobApplyNoCVPage.capture('guest_nocv_application_submitted');
    });

    await test.step('Then [5] Kiểm tra hoàn tất nộp hồ sơ thành công', async () => {
      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2).catch(() => false);
      if (didBulkApply) {
        await jobApplyNoCVPage.capture('guest_nocv_bulk_apply_done');
      }

      await jobApplyNoCVPage.openAppliedJobs();
      await jobApplyNoCVPage.expectAppliedJobsVisible();
      await expect(jobApplyNoCVPage.appliedJobsList).toBeVisible({ timeout: 30000 });
      await jobApplyNoCVPage.capture('applied_jobs_list_visible');
    });
  });
});
