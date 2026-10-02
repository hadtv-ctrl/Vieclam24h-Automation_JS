const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Tìm kiếm, lọc việc làm và xem chi tiết công việc @regression @desktop @e2e @search', () => {
  let jobDetailPageTab = null;

  test.afterEach(async () => {
    if (jobDetailPageTab && !jobDetailPageTab.isClosed()) {
      await jobDetailPageTab.close().catch((err) => {
        // Safe disposal logging if needed
      });
      jobDetailPageTab = null;
    }
  });

  test('TC-SEARCH-001: Tìm kiếm việc làm từ trang chủ, áp dụng bộ lọc và xem chi tiết tin tuyển dụng', async ({
    page,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    testInfo.annotations.push({
      type: 'Description',
      description: 'Kịch bản Regression kiểm tra luồng tìm kiếm theo danh mục Bán sỉ, lọc tỉnh thành TP.HCM, kinh nghiệm 1 năm, xóa lọc và xem chi tiết việc làm.',
    });

    // ── Given ─────────────────────────────────────────────────────────
    await test.step('Given Tiền điều kiện: Người dùng truy cập trang chủ và đóng các popup cản trở', async () => {
      await homePage.navigate();
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 10000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 8000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_homepage_ready');
    });

    // ── When: Chọn ngành nghề và lọc tiêu chí ─────────────────────────
    await test.step('When Người dùng chọn ngành nghề "Bán sỉ - Bán lẻ" để chuyển sang danh sách tìm kiếm', async () => {
      await homePage.selectJobCategory('Bán sỉ - Bán lẻ');
      await jobSearchPage.expectJobSearchPageVisible();
      await jobSearchPage.capture('job_search_list_visible');
    });

    await test.step('And Người dùng lọc việc làm theo tỉnh thành "TP.HCM"', async () => {
      await jobSearchPage.filterByCity('TP.HCM');
      await jobSearchPage.capture('city_filter_applied');
    });

    await test.step('And Người dùng lọc việc làm theo kinh nghiệm "1 năm"', async () => {
      await jobSearchPage.filterByExperience('1 năm');
      await jobSearchPage.capture('experience_filter_applied');
    });

    await test.step('And Người dùng kiểm tra chức năng xóa bộ lọc', async () => {
      await jobSearchPage.clearFilters();
      await jobSearchPage.capture('filters_reset');
    });

    // ── Then: Xem chi tiết công việc ──────────────────────────────────
    await test.step('Then Người dùng chọn xem một tin tuyển dụng và mở trang chi tiết công việc thành công', async () => {
      jobDetailPageTab = await jobSearchPage.clickJobByTitle();
      const jobDetailPage = new JobDetailPage(jobDetailPageTab, 'job_search_regression');

      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('job_detail_page_verified');
    });
  });
});
