const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Tìm kiếm việc làm theo từng tỉnh thành trọng điểm @regression @desktop @e2e @search @cities', () => {
  let jobDetailPageTab = null;

  test.afterEach(async () => {
    if (jobDetailPageTab && !jobDetailPageTab.isClosed()) {
      await jobDetailPageTab.close().catch(() => null);
      jobDetailPageTab = null;
    }
  });

  test('TC-SEARCH-CITY-001: Tìm kiếm việc làm lần lượt theo các tỉnh thành trọng điểm Bắc - Trung - Nam', async ({
    page,
    pages,
  }, testInfo) => {
    test.slow();
    test.setTimeout(240000);

    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    // Danh sách các tỉnh thành trọng điểm đại diện 3 miền Bắc - Trung - Nam
    const TARGET_CITIES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Bình Dương', 'Hải Phòng', 'Cần Thơ'];

    testInfo.annotations.push({
      type: 'Description',
      description: `Kịch bản kiểm thử tìm kiếm việc làm chọn từng tỉnh thành trong danh sách trọng điểm (${TARGET_CITIES.join(', ')}). Sau mỗi lần chọn tỉnh thành, script bấm Tìm kiếm, xác minh danh sách việc làm và tiêu đề cập nhật theo tỉnh thành, sau đó chụp ảnh bằng chứng.`,
    });

    // ── Given: Tiền điều kiện ─────────────────────────────────────────
    await test.step('Given Tiền điều kiện: Người dùng truy cập trang chủ và điều hướng đến trang tìm kiếm việc làm', async () => {
      // Đăng ký auto-handler để tự động dập tắt popup "Khoan đã, chưa đăng nhập?" nếu xuất hiện
      await homePage.registerGuestPopupAutoHandlers();

      // Truy cập trang chủ và dọn sạch các popup cản trở
      await homePage.navigate();
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 10000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 8000,
      });
      await homePage.closeAllPopupsIfVisible();

      // Chuyển sang trang tìm kiếm việc làm
      await jobSearchPage.open();
      await jobSearchPage.closeAllPopupsIfVisible();
      await jobSearchPage.expectJobSearchPageVisible();
      await jobSearchPage.capture('01_job_search_page_ready');
    });

    // ── When: Lần lượt chọn từng tỉnh thành và bấm Tìm kiếm ───────────
    for (let i = 0; i < TARGET_CITIES.length; i++) {
      const cityName = TARGET_CITIES[i];
      const stepIndex = String(i + 2).padStart(2, '0');
      const safeCityKey = cityName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '_');

      await test.step(`When Người dùng chọn tỉnh thành "${cityName}" và bấm Tìm kiếm`, async () => {
        // Mở dropdown tỉnh thành, chọn tỉnh/thành phố và bấm Tìm kiếm
        await jobSearchPage.openCityDropdown();
        await jobSearchPage.selectCityOption(cityName);
        await jobSearchPage.clickSearch();

        // Xác nhận bộ lọc đã áp dụng đúng tỉnh thành và danh sách việc làm đã cập nhật
        await jobSearchPage.expectCityFilterApplied(cityName);

        // Chụp ảnh bằng chứng sau khi danh sách việc làm của tỉnh thành đã hiển thị
        await jobSearchPage.capture(`${stepIndex}_city_${safeCityKey}_searched`);
      });
    }

    // ── Then: Xem chi tiết một công việc từ kết quả tìm kiếm ──────────
    await test.step('Then Người dùng chọn xem một tin tuyển dụng và mở trang chi tiết công việc thành công', async () => {
      jobDetailPageTab = await jobSearchPage.clickJobByTitle();
      const jobDetailPage = new JobDetailPage(jobDetailPageTab, 'job_search_cities_regression');
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('08_job_detail_page_verified');
    });
  });
});
