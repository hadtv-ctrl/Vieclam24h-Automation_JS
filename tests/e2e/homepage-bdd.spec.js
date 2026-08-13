const { test, expect } = require('@playwright/test');
const { HomePage } = require('../../pages/HomePage');

test.describe('Feature: Kiểm tra thông tin màn hình chính (Homepage) @smoke', () => {

  test('Kiểm tra các thành phần trên trang chủ', async ({ page }) => { // Removed screenshotHelper from here
    test.setTimeout(120000); // Removed screenshotHelper from here
    const homePage = new HomePage(page); // Removed screenshotHelper from here

    await test.step('Given Tôi truy cập vào trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
    });

    await test.step('And Tôi tắt popup/modal nếu có', async () => {
      await homePage.closeAdsIfVisible();
    });

    await test.step('Then Tôi phải thấy tiêu đề trang chứa "Tìm việc làm nhanh, tuyển dụng hiệu quả tại Việc Làm 24h"', async () => {
      await expect(page).toHaveTitle(/Tìm việc làm nhanh.*Việc Làm 24h/i);
    });

    await test.step('And Tôi phải thấy logo của trang web', async () => {
      await expect(homePage.logo).toBeVisible();
    });

    await test.step('And Tôi phải thấy khu vực "Người tìm việc - Đăng ký/Đăng nhập"', async () => {
      const loginBtn = await homePage.expectLoginAreaVisible();
      await expect(loginBtn).toContainText('Người tìm việc');
      await expect(loginBtn).toContainText('Đăng ký/Đăng nhập');
    });

    await test.step('And Tôi phải thấy menu dành cho "Nhà Tuyển Dụng"', async () => {
      const employerLink = await homePage.expectEmployerSectionVisible();
      await expect(employerLink).toContainText('Dành cho');
      await expect(employerLink).toContainText('Nhà Tuyển Dụng');
    });

    await test.step('And Tôi phải thấy khu vực "Việc làm tuyển gấp"', async () => {
      const urgentJobsSection = await homePage.expectUrgentJobsSectionVisible();
      await expect(urgentJobsSection).toBeVisible();
    });

    await test.step('And Tôi phải thấy khu vực "Việc đi làm ngay"', async () => {
      const immediateJobsSection = await homePage.expectImmediateJobsSectionVisible();
      await expect(immediateJobsSection).toBeVisible();
    });

    await test.step('And Tôi cuộn trang để load nội dung bên dưới và chụp lại full màn hình', async () => {
      await homePage.capture('homepage-scrolled');
    });
  });
});
