const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Tìm kiếm, lọc việc làm và xem chi tiết công việc @guest @no-auth @regression @desktop @e2e @search @REQ-007', () => {
  let jobDetailPageTab = null;

  test.afterEach(async () => {
    if (jobDetailPageTab && !jobDetailPageTab.isClosed()) {
      await jobDetailPageTab.close().catch((err) => {
        // Safe disposal logging if needed
      });
      jobDetailPageTab = null;
    }
  });

  test('TC-094 - AC-022: Tìm kiếm việc làm từ trang chủ, áp dụng bộ lọc và xem chi tiết tin tuyển dụng', async ({
    page,
    pages,
  }, testInfo) => {
    test.slow();
    test.setTimeout(240000);

    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    testInfo.annotations.push({
      type: 'Description',
      description: 'Kịch bản Regression kiểm tra luồng tìm kiếm theo danh mục Bán sỉ, lọc tỉnh thành TP.HCM (bấm Tìm kiếm), kiểm tra tuần tự 8 bộ lọc ngang (Tuyển nhanh, Việc không cần CV, Kinh nghiệm, Mức lương, Cấp bậc, Trình độ, Loại công việc, Giới tính) với tự động cập nhật danh sách và bấm Xóa lọc sau mỗi lần, cuối cùng xem chi tiết việc làm.',
    });

    // ── Given ─────────────────────────────────────────────────────────
    await test.step('Given Tiền điều kiện: Người dùng truy cập trang chủ và đóng các popup cản trở', async () => {
      // Đăng ký auto-handler để tự động dập tắt popup "Khoan đã, chưa đăng nhập?" nếu xuất hiện sau 30s
      await homePage.registerGuestPopupAutoHandlers();

      // Thao tác 1: Điều hướng tới trang chủ và dọn sạch tất cả các popup, banner quảng cáo cản trở
      await homePage.navigate();
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 10000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 8000,
      });
      await homePage.closeAllPopupsIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible({ timeout: 15000 });

      // Chụp đúng 1 ảnh duy nhất sau khi đã đóng sạch tất cả popup và trang chủ sẵn sàng
      await homePage.capture('01_homepage_ready_popups_closed');
    });

    // ── When: Chọn ngành nghề và lọc tiêu chí ─────────────────────────
    await test.step('When Người dùng chọn ngành nghề "Bán sỉ - Bán lẻ" để chuyển sang danh sách tìm kiếm', async () => {
      // Thao tác 2: Bấm chọn danh mục Bán sỉ - Bán lẻ và chuyển sang danh sách tìm kiếm việc làm
      await homePage.selectJobCategory('Bán sỉ - Bán lẻ');
      await jobSearchPage.expectJobSearchPageVisible();
      await expect(page).toHaveURL(/tim-kiem-viec-lam/i);
      await jobSearchPage.capture('02_category_ban_si_ban_le_selected');
    });

    await test.step('And Người dùng chọn tỉnh thành "TP.HCM" và bấm Tìm kiếm để cập nhật danh sách việc làm', async () => {
      // Thao tác 3: Mở dropdown tỉnh thành, chọn TP.HCM và bấm nút Tìm kiếm để làm mới danh sách việc làm
      await jobSearchPage.openCityDropdown();
      await jobSearchPage.selectCityOption('TP.HCM');
      await jobSearchPage.clickSearch();
      await jobSearchPage.expectCityFilterApplied('TP.HCM');
      await jobSearchPage.capture('03_filtered_by_city_hcm');
    });

    // ── Bộ lọc thanh công cụ ngang: Tuyển nhanh, Việc không cần CV, Kinh nghiệm, Mức lương, Cấp bậc, Trình độ, Loại công việc, Giới tính ──
    await test.step('And Người dùng áp dụng bộ lọc "Tuyển nhanh", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 4: Chọn Tuyển nhanh, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByTuyenNhanh();
      await jobSearchPage.capture('04_filter_tuyen_nhanh_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc "Việc không cần CV", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 5: Chọn Việc không cần CV, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByViecKhongCanCv();
      await jobSearchPage.capture('05_filter_viec_khong_can_cv_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc kinh nghiệm "1 năm", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 6: Chọn kinh nghiệm 1 năm, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByExperience('1 năm');
      await jobSearchPage.capture('06_filter_kinh_nghiem_1_nam_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc mức lương "10 - 15 triệu", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 7: Chọn mức lương 10 - 15 triệu, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterBySalary('10 - 15 triệu');
      await jobSearchPage.capture('07_filter_muc_luong_10_15_trieu_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc cấp bậc "Nhân viên", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 8: Chọn cấp bậc Nhân viên, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByJobLevel('Nhân viên');
      await jobSearchPage.capture('08_filter_cap_bac_nhan_vien_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc trình độ "Đại học", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 9: Chọn trình độ Đại học, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByEducation('Đại học');
      await jobSearchPage.capture('09_filter_trinh_do_dai_hoc_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc loại công việc "Toàn thời gian cố định", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 10: Chọn loại công việc Toàn thời gian cố định, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByJobType('Toàn thời gian cố định');
      await jobSearchPage.capture('10_filter_loai_cong_viec_toan_thoi_gian_applied');
      await jobSearchPage.clearFilters();
    });

    await test.step('And Người dùng áp dụng bộ lọc giới tính "Nam", kiểm tra danh sách thay đổi và xóa lọc', async () => {
      // Thao tác 11: Chọn giới tính Nam, chụp ảnh khi danh sách cập nhật tự động và bấm Xóa lọc
      await jobSearchPage.filterByGender('Nam');
      await jobSearchPage.capture('11_filter_gioi_tinh_nam_applied');
      await jobSearchPage.clearFilters();
    });

    // ── Then: Xem chi tiết công việc ──────────────────────────────────
    await test.step('Then Người dùng chọn xem một tin tuyển dụng và mở trang chi tiết công việc thành công', async () => {
      // Thao tác 12: Bấm vào một tin tuyển dụng và xác nhận trang chi tiết tải đầy đủ
      jobDetailPageTab = await jobSearchPage.clickJobByTitle();
      const jobDetailPage = new JobDetailPage(jobDetailPageTab, 'job_search_regression');
      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailPage.jobTitleHeading).toBeVisible({ timeout: 15000 });
      await jobDetailPage.capture('12_job_detail_page_verified');
    });
  });
});
