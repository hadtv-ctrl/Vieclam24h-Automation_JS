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

  test('TC-SEARCH-CITY-001: Tìm kiếm việc làm lần lượt theo tỉnh thành và quận huyện trọng điểm', async ({
    page,
    pages,
  }, testInfo) => {
    test.slow();
    test.setTimeout(360000);

    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    // Danh sách các tỉnh thành trọng điểm kèm 1 quận/huyện đại diện
    const TARGET_LOCATIONS = [
      { city: 'Hà Nội', district: 'Cầu Giấy' },
      { city: 'TP.HCM', district: 'Quận 1' },
      { city: 'Đà Nẵng', district: 'Hải Châu' },
      { city: 'Bình Dương', district: 'Thủ Dầu Một' },
      { city: 'Hải Phòng', district: 'Ngô Quyền' },
      { city: 'Cần Thơ', district: 'Ninh Kiều' },
    ];

    testInfo.annotations.push({
      type: 'Description',
      description: `Kịch bản kiểm thử tìm kiếm việc làm tại khung search: lần lượt chọn tỉnh thành -> bấm Tìm kiếm, sau đó mở rộng mũi tên quận/huyện -> chọn 1 quận huyện tương ứng -> bấm Tìm kiếm cho các địa bàn trọng điểm (${TARGET_LOCATIONS.map(l => `${l.city} - ${l.district}`).join(', ')}).`,
    });

    let stepCount = 1;

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

    // ── When & And: Lần lượt chọn tỉnh thành -> Tìm kiếm, chọn quận huyện -> Tìm kiếm ──
    for (const loc of TARGET_LOCATIONS) {
      const safeCityKey = loc.city
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '_');

      const safeDistrictKey = loc.district
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '_');

      // 1. Chọn tỉnh thành -> Bấm Tìm kiếm
      await test.step(`When Người dùng chọn tỉnh thành "${loc.city}" và bấm Tìm kiếm`, async () => {
        stepCount++;
        const stepIndex = String(stepCount).padStart(2, '0');
        await jobSearchPage.openCityDropdown();
        await jobSearchPage.selectCityOption(loc.city);
        await jobSearchPage.clickSearch();
        await jobSearchPage.expectCityFilterApplied(loc.city);
        await jobSearchPage.capture(`${stepIndex}_city_${safeCityKey}_searched`);
      });

      // 2. Chọn tỉnh thành + chọn quận huyện qua mũi tên > -> Bấm Tìm kiếm
      await test.step(`And Người dùng mở rộng quận/huyện của "${loc.city}", chọn "${loc.district}" và bấm Tìm kiếm`, async () => {
        stepCount++;
        const stepIndex = String(stepCount).padStart(2, '0');
        await jobSearchPage.openCityDropdown();
        await jobSearchPage.selectCityOption(loc.city, loc.district);
        await jobSearchPage.clickSearch();
        await jobSearchPage.expectCityFilterApplied(loc.city, loc.district);
        await jobSearchPage.capture(`${stepIndex}_city_${safeCityKey}_district_${safeDistrictKey}_searched`);
      });
    }

    // ── Then: Xem chi tiết một công việc từ kết quả tìm kiếm ──────────
    await test.step('Then Người dùng chọn xem một tin tuyển dụng và mở trang chi tiết công việc thành công', async () => {
      stepCount++;
      const stepIndex = String(stepCount).padStart(2, '0');
      jobDetailPageTab = await jobSearchPage.clickJobByTitle();
      const jobDetailPage = new JobDetailPage(jobDetailPageTab, 'job_search_cities_regression');
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture(`${stepIndex}_job_detail_page_verified`);
    });
  });
});
