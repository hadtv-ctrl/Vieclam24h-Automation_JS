const { test } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Guest ứng tuyển việc không cần CV bằng OTP @applyjob @e2e', () => {
  test('Guest đăng nhập bằng OTP khi ứng tuyển việc không cần CV thành công', async ({
    onboardingPopup,
    homePage,
    jobSearchPage,
    createJobApplyNoCVPage,
    createPopupConsent,
  }) => {
    test.slow();
    test.setTimeout(600000);

    let jobApplyNoCVPage;
    let popupConsent;
    const guestApplyData = {
      ...applyData.noCVApply.guestJob,
      phone: generateRandomVNPhone(),
    };
    await test.step('Given Người dùng chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('guest_homepage_opened');
    });

    await test.step('And Người dùng đóng các popup đang che nội dung', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await homePage.closeAdsIfVisible();
      await homePage.closeBlockingModalIfVisible();
    });

    await test.step('When Người dùng mở chi tiết một việc không cần CV', async () => {
      await homePage.clickNoCVJobLink();
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });
      await jobSearchPage.capture('nocv_jobs_list_visible', true);

      const jobPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = createJobApplyNoCVPage(jobPage);
      popupConsent = createPopupConsent(jobPage);
      await jobApplyNoCVPage.capture('job_detail_opened', true);
      await jobApplyNoCVPage.startGuestApplyNoCV();
      await jobApplyNoCVPage.capture('guest_nocv_form_opened');
    });

    await test.step('And Người dùng điền form Apply NoCV và nộp hồ sơ', async () => {
      await jobApplyNoCVPage.fillGuestContact(guestApplyData);
      await jobApplyNoCVPage.fillMiniProfile(guestApplyData);
      await jobApplyNoCVPage.capture('guest_nocv_profile_filled');
      await jobApplyNoCVPage.submitGuestProfile();
    });

    await test.step('And Người dùng nhập OTP để hoàn tất đăng ký đăng nhập', async () => {
      await jobApplyNoCVPage.verifyGuestPhoneOtp(usersData[0].otp);
      await popupConsent.agree();
      await jobApplyNoCVPage.capture('guest_nocv_application_submitted');
    });

    await test.step('Then Người dùng ứng tuyển nhiều việc tương tự  với thông tin Profile mini đã điền', async () => {
      const didBulkApply = await jobApplyNoCVPage.bulkApply(applyData.noCVApply.job2);
      if (didBulkApply) {
        await jobApplyNoCVPage.capture('guest_nocv_bulk_apply_done');
      }
    });
    await test.step('Then Việc làm hiển thị trong danh sách đã ứng tuyển', async () => {
      await jobApplyNoCVPage.openAppliedJobs();
      await jobApplyNoCVPage.expectAppliedJobsVisible();
      await jobApplyNoCVPage.capture('applied_jobs_list_visible', true);
    });
  });
});
