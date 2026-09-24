const { test, expect } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const userData = require('../../../data/users.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyNoCVPage } = require('../../../pages/desktop/JobApplyNoCVPage');

test.describe('Feature: Guest ứng tuyển việc không cần CV @applyjob @desktop @e2e @REQ-004', () => {
  test('TC-038 - AC-013 Khách vãng lai ứng tuyển với số điện thoại đã có tài khoản', async ({
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
      description: 'Chưa đăng nhập (Khách vãng lai ứng tuyển với số điện thoại đã tồn tại)',
    });

    let jobApplyNoCVPage;
    const guestDataWithExistingPhone = {
      ...applyData.noCVApply.guestJob,
      phone: userData[0]?.phone || '0987654321',
    };

    await test.step('Given Tiền điều kiện: Người dùng chưa đăng nhập và truy cập trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('guest_homepage_opened');
    });

    await test.step('And Người dùng đóng các popup quảng cáo nếu có', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
    });

    await test.step('When [1] Người dùng mở chi tiết một việc làm không cần CV', async () => {
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.clickNoCVJobLink();
      await jobSearchPage.firstJobLink.waitFor({ state: 'visible', timeout: 15000 });
      await jobSearchPage.capture('nocv_jobs_list_visible', true);

      const jobPage = await jobSearchPage.clickFirstJob();
      jobApplyNoCVPage = new JobApplyNoCVPage(jobPage);
      await jobApplyNoCVPage.capture('job_detail_opened', true);
      await jobApplyNoCVPage.startGuestApplyNoCV();
      await jobApplyNoCVPage.capture('guest_nocv_form_opened');
    });

    await test.step('And [1] Người dùng điền số điện thoại đã có tài khoản trong hệ thống', async () => {
      await jobApplyNoCVPage.fillGuestContact(guestDataWithExistingPhone);
      await jobApplyNoCVPage.capture('guest_contact_filled_with_existing_phone');
    });

    await test.step('Then [1] Hệ thống nhận diện số điện thoại đã tồn tại và hiển thị thông báo hoặc yêu cầu đăng nhập', async () => {
      await jobApplyNoCVPage.submitGuestProfile(guestDataWithExistingPhone.phone);
      await expect(jobApplyNoCVPage.accountExistsNotice.or(jobApplyNoCVPage.applyModal)).toBeVisible();
      await jobApplyNoCVPage.capture('existing_phone_account_handled');
    });
  });
});
