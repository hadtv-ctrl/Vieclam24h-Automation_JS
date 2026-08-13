const { test, expect } = require('@playwright/test');
const { JobApplyPage } = require('../../pages/JobApplyPage');
const { HomePage } = require('../../pages/HomePage');
const { JobSearchPage } = require('../../pages/JobSearchPage');
const { PopupConsent } = require('../../pages/PopupConsent');
const applyData = require('../../data/applyJobData.json'); // Giả sử file này tồn tại
const { loginUserFromDataForPrecondition } = require('../../core/utils/authSetup');

test.describe('Feature: Ứng tuyển một việc làm @apply', () => {
  let page;
  let homePage;
  let jobApplyPage;
  let jobSearchPage;
  let popupConsent;
  let newPage; // Page của tab chi tiết việc làm

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    homePage = new HomePage(page);
    popupConsent = new PopupConsent(page);
  });

  test.afterAll(async () => {
    await page.close();
    if (newPage) await newPage.close();
  });

  test('Người dùng hoàn thành tạo profile và ứng tuyển thành công', async () => {
    test.setTimeout(180000); // Tăng timeout cho luồng dài

    await test.step('Given Tôi đang ở trang chủ sau khi đã đăng nhập', async () => {
      await loginUserFromDataForPrecondition(page);
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_homepage_loaded');
    });

    await test.step('When Tôi mở một việc làm chi tiết và bấm "Ứng tuyển ngay"', async () => {
      await homePage.openJobSearch();

      jobSearchPage = new JobSearchPage(page);
      const page1Promise = page.waitForEvent('popup');
      await jobSearchPage.clickFirstJob();

      newPage = await page1Promise;
      await newPage.waitForLoadState();
      jobApplyPage = new JobApplyPage(newPage);

      await jobApplyPage.startApply();
      await jobApplyPage.applyByProfile();
      await jobApplyPage.continueApply();
    });

    await test.step('And Tôi điền thông tin Giới thiệu bản thân', async () => {
      await jobApplyPage.clickAddIntroduction();
      await jobApplyPage.fillIntroduction(applyData.intro);
      await jobApplyPage.saveSection();
    });

    await test.step('And Tôi điền Kinh nghiệm làm việc', async () => {
      await jobApplyPage.clickAddExperience();
      await jobApplyPage.fillExperience(applyData.experience);
      await jobApplyPage.saveSection();
    });

    await test.step('And Tôi điền thông tin Học vấn', async () => {
      await jobApplyPage.clickAddEducation();
      await jobApplyPage.fillEducation(applyData.education);
      await jobApplyPage.saveSection();
    });

    await test.step('And Tôi thêm Kỹ năng', async () => {
      await jobApplyPage.clickAddSkill();
      await jobApplyPage.fillSkill(applyData.skill);
      await jobApplyPage.saveSection();
    });

    await test.step('And Tôi thêm Thành tựu và Chứng chỉ', async () => {
      await jobApplyPage.clickAddAchievement();
      await jobApplyPage.fillAchievement(applyData.achievement);
      await jobApplyPage.saveSection();
      await jobApplyPage.clickAddCertificate();
      await jobApplyPage.fillCertificate(applyData.certificate);
      await jobApplyPage.saveSection();
    });

    await test.step('And Tôi thêm Ngoại ngữ', async () => {
      await jobApplyPage.clickAddForeignLanguage();
      await jobApplyPage.fillForeignLanguage(applyData.language);
      await jobApplyPage.saveSection();
    });

    await test.step('Then Tôi xác nhận nộp hồ sơ và thấy thông báo thành công', async () => {
      await jobApplyPage.submitApplication();
      await jobApplyPage.confirmAndFinishApplication();
      await expect(jobApplyPage.msgSuccess).toBeVisible({ timeout: 15000 });
    });
  });
});
