const { test } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyNoCVPage } = require('../../../pages/desktop/JobApplyNoCVPage');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');

test.describe('Feature: Guest ứng tuyển việc không cần CV bằng OTP @applyjob @desktop @e2e @REQ-004', () => {
  test('TC-015 - AC-013 Khách vãng lai ứng tuyển việc không cần CV và tạo tài khoản bằng OTP', async ({
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
      description: 'Chưa đăng nhập (Khách vãng lai ứng tuyển)',
    });

    let jobApplyNoCVPage;
    let popupConsent;
    const guestApplyData = {
      ...applyData.noCVApply.guestJob,
      phone: generateRandomVNPhone(),
    };
    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và truy cập trang chủ', async () => {
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
      await homePage.closeBlockingModalIfVisible();
      await homePage.clickNoCVJobLink();
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });
      await jobSearchPage.capture('nocv_jobs_list_visible', true);

      const jobPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = new JobApplyNoCVPage(jobPage);
      popupConsent = new PopupConsent(jobPage);
      await jobApplyNoCVPage.capture('job_detail_opened', true);
      await jobApplyNoCVPage.startGuestApplyNoCV();
      await jobApplyNoCVPage.capture('guest_nocv_form_opened');
    });

    await test.step('And Người dùng điền form Apply NoCV và nộp hồ sơ', async () => {
      await jobApplyNoCVPage.fillGuestContact(guestApplyData);
      await jobApplyNoCVPage.fillMiniProfile(guestApplyData);
      await jobApplyNoCVPage.capture('guest_nocv_profile_filled');
      await jobApplyNoCVPage.submitGuestProfile(guestApplyData.phone);
    });

    await test.step('And Người dùng nhập OTP để hoàn tất đăng ký đăng nhập', async () => {
      await jobApplyNoCVPage.verifyGuestPhoneOtp(usersData[0].otp);
      await popupConsent.agree();
      await jobApplyNoCVPage.capture('guest_nocv_application_submitted');
    });

    await test.step('Then Người dùng thực hiện Bulk Apply nhiều việc tương tự với thông tin Profile mini đã điền', async () => {
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
