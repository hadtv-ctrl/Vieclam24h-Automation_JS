const { test } = require('../../../core/fixtures/mobileWebTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Mobile Feature: Guest ứng tuyển việc không cần CV bằng OTP trên Mobile Web @applyjob @mobile @e2e', () => {
  let newJobPage;

  test.afterEach(async () => {
    if (newJobPage && !newJobPage.isClosed()) {
      try {
        await newJobPage.close();
      } catch (_e) {
        // Page already closed or detached
      }
    }
  });

  test('Guest mobile đăng nhập bằng OTP khi ứng tuyển việc không cần CV thành công', async ({
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyNoCVPage,
    createPopupConsent,
  }, testInfo) => {
    test.slow();
    test.setTimeout(600000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập (Khách vãng lai mobile ứng tuyển)',
    });

    let jobApplyNoCVPage;
    let popupConsent;
    const guestApplyData = {
      ...applyData.noCVApply.guestJob,
      phone: generateRandomVNPhone(),
    };

    await test.step('Given Tiền điều kiện: Người dùng mobile chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('guest_mobile_homepage_opened');
    });

    await test.step('And Người dùng mobile đóng các popup đang che nội dung', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.closeAdsIfVisible();
      await homePage.closeBlockingModalIfVisible();
    });

    await test.step('When Người dùng mobile mở chi tiết một việc không cần CV', async () => {
      await homePage.clickNoCVJobLink();
      await jobSearchPage.expectJobsVisible();
      await jobSearchPage.capture('mobile_nocv_jobs_list_visible', true);

      newJobPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = createJobApplyNoCVPage(newJobPage);
      popupConsent = createPopupConsent(newJobPage);
      await jobApplyNoCVPage.capture('mobile_guest_job_detail_opened', true);
      await jobApplyNoCVPage.startGuestApplyNoCV();
      await jobApplyNoCVPage.capture('guest_mobile_nocv_form_opened');
    });

    await test.step('And Người dùng mobile điền form Apply NoCV và nộp hồ sơ', async () => {
      await jobApplyNoCVPage.fillGuestContact(guestApplyData);
      await jobApplyNoCVPage.fillMiniProfile(guestApplyData);
      await jobApplyNoCVPage.capture('guest_mobile_nocv_profile_filled');
      await jobApplyNoCVPage.submitGuestProfile();
    });

    await test.step('And Người dùng mobile nhập OTP để hoàn tất đăng ký đăng nhập', async () => {
      await jobApplyNoCVPage.verifyGuestPhoneOtp(usersData[0].otp);
      await popupConsent.agree();
      await jobApplyNoCVPage.capture('guest_mobile_nocv_application_submitted');
    });

    await test.step('Then Người dùng mobile thực hiện Bulk Apply nhiều việc tương tự', async () => {
      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2);
      if (didBulkApply) {
        await jobApplyNoCVPage.capture('guest_mobile_nocv_bulk_apply_done');
      }
    });

    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển trên mobile', async () => {
      await jobApplyNoCVPage.openAppliedJobs();
      await jobApplyNoCVPage.expectAppliedJobsVisible();
      await jobApplyNoCVPage.capture('mobile_guest_applied_jobs_list_visible', true);
    });
  });
});
