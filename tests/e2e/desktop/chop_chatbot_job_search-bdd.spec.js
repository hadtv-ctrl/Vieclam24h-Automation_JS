const { test, expect } = require('../../../core/fixtures/baseTest');
const chatbotData = require('../../../data/chopChatbotData.json');
const { ChopChatbotPage } = require('../../../pages/desktop/ChopChatbotPage');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Người dùng tìm việc qua Chop AI chatbot @chatbot @desktop @e2e @REQ-007', () => {
  test.setTimeout(240000);

  test('TC-025 - AC-022 Người dùng tìm kiếm, lọc và xem việc làm qua Chop AI chatbot thành công', async ({
    page,
    workerUserData,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);

    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã khởi tạo tài khoản ứng viên từ API (${workerUserData.user?.phone || 'Test User'})`,
    });

    // ── Given ─────────────────────────────────────────────────────────
    await test.step('Given Tiền điều kiện: Người dùng mở trang tìm kiếm việc làm', async () => {
      await jobSearchPage.navigate();
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 10000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 8000,
      });
      await homePage.closeBlockingModalIfVisible();
      await jobSearchPage.closeGuestPromptModalIfVisible();
      await jobSearchPage.expectJobSearchPageVisible();
      await jobSearchPage.capture('precondition_job_search_page');
    });

    // ── When: Mở chatbot và tìm kiếm ─────────────────────────────────
    let chopChatbot;
    await test.step('When Người dùng mở Chop AI chatbot và đăng nhập tài khoản đã tạo từ API', async () => {
      const chatbotPopup = await jobSearchPage.openChopChatbot();
      chopChatbot = new ChopChatbotPage(chatbotPopup, 'chop_chatbot_job_search');
      await chopChatbot.loginIfVisible(workerUserData.user);
      await chopChatbot.dismissIntroIfVisible();
      await chopChatbot.capture('chatbot_logged_in');
    });

    await test.step('And Người dùng nhập từ khóa tìm kiếm việc làm vào ô chat', async () => {
      await chopChatbot.enterChatMessage(chatbotData.searchKeyword);
      await chopChatbot.capture('chat_keyword_input_entered');
      await chopChatbot.clickSendMessage();
      await chopChatbot.btnCityHCM.waitFor({ state: 'visible', timeout: 15000 });
      await chopChatbot.capture('chat_response_choose_city');
    });

    await test.step('And Người dùng chọn TP.HCM và mức lương khởi điểm', async () => {
      await chopChatbot.selectCityHCM();
      await chopChatbot.salaryOptions.first().waitFor({ state: 'visible', timeout: 15000 });
      await chopChatbot.capture('chat_city_selected_salary_options_visible');
      await chopChatbot.selectInitialSalaryAndSend();
    });

    // ── Then: Kết quả hiển thị ────────────────────────────────────────
    await test.step('Then Chatbot hiển thị số lượng công việc phù hợp', async () => {
      await chopChatbot.expectJobCountVisible();
      await expect(chopChatbot.jobCountBtn.last()).toBeVisible({ timeout: 25000 });
      await chopChatbot.capture('chat_job_count_button_visible');
    });

    await test.step('And Người dùng mở danh sách công việc gợi ý', async () => {
      await chopChatbot.viewJobResults();
      await chopChatbot.capture('job_drawer_opened');
    });

    // ── And: Lọc ngành nghề ───────────────────────────────────────────
    await test.step('And Người dùng lọc theo ngành nghề và xóa bộ lọc', async () => {
      await chopChatbot.openIndustryFilter();
      await chopChatbot.capture('modal_industry_filter_opened');
      await chopChatbot.selectIndustry(chatbotData.industryOption);
      await chopChatbot.confirmFilter();
      await chopChatbot.capture('industry_filter_applied');
      // Xóa bộ lọc ngành nghề
      await chopChatbot.openIndustryFilter();
      await chopChatbot.clearActiveFilter();
      await chopChatbot.capture('industry_filter_cleared');
    });

    // ── And: Lọc khu vực ──────────────────────────────────────────────
    await test.step('And Người dùng lọc theo khu vực (Q1, Q4, Q3) tại TP.HCM', async () => {
      await chopChatbot.openLocationFilter();
      await chopChatbot.selectLocationOption(`${chatbotData.locationFilter.city} `);
      for (const district of chatbotData.locationFilter.districts) {
        await chopChatbot.selectLocationOption(district);
      }
      await chopChatbot.capture('modal_location_districts_selected');
      await chopChatbot.applyLocationFilter();
    });

    await test.step('Then Bộ lọc khu vực hiển thị đúng quận đã chọn', async () => {
      await chopChatbot.expectLocationFilterDisplayed(chatbotData.expectedLocationDisplay);
      await chopChatbot.capture('location_filter_applied');
    });

    await test.step('And Người dùng xóa bộ lọc khu vực', async () => {
      await chopChatbot.clearLocationFilter();
      await chopChatbot.capture('location_filter_cleared');
    });

    // ── And: Lọc mức lương ────────────────────────────────────────────
    await test.step('And Người dùng lọc theo mức lương từ 15 triệu trở lên', async () => {
      await chopChatbot.openSalaryFilterAfterScroll();
      await chopChatbot.capture('modal_salary_filter_opened');
      await chopChatbot.selectSalaryOption(chatbotData.salaryHighOption);
      await chopChatbot.confirmFilter();
    });

    await test.step('Then Bộ lọc mức lương hiển thị đúng', async () => {
      await chopChatbot.expectSalaryFilterDisplayed(chatbotData.salaryHighOption);
      await chopChatbot.capture('salary_filter_applied');
    });

    await test.step('And Người dùng xóa bộ lọc mức lương', async () => {
      await chopChatbot.clearSalaryFilter();
      await chopChatbot.capture('salary_filter_cleared');
    });

    // ── And: Tìm kiếm theo kinh nghiệm qua chat ──────────────────────
    await test.step('And Người dùng nhập yêu cầu kinh nghiệm qua chatbot và xem kết quả', async () => {
      await chopChatbot.scrollToExperienceFilterBar();
      await chopChatbot.enterChatMessage(chatbotData.experienceKeyword);
      await chopChatbot.capture('chat_experience_input_entered');
      await chopChatbot.clickSendMessage();
      await chopChatbot.expectJobCountVisible();
      await chopChatbot.capture('chat_response_experience_job_count');
      await chopChatbot.viewJobResults();
      await chopChatbot.capture('drawer_experience_updated');
    });

    // ── And: Lọc kinh nghiệm ─────────────────────────────────────────
    await test.step('And Người dùng chỉnh bộ lọc kinh nghiệm từ 3 năm thành 2 năm', async () => {
      await chopChatbot.scrollToExperienceFilterBar();
      await chopChatbot.openExperienceFilter();
      await chopChatbot.selectExperienceOption(chatbotData.experienceFilterTo);
      await chopChatbot.capture('modal_experience_option_2_years_selected');
      await chopChatbot.confirmFilter();
    });

    await test.step('Then Bộ lọc kinh nghiệm hiển thị 2 năm', async () => {
      await chopChatbot.expectExperienceFilterDisplayed(chatbotData.experienceFilterTo);
      await chopChatbot.capture('experience_filter_applied');
    });

    // ── And: Xóa toàn bộ bộ lọc ──────────────────────────────────────
    await test.step('And Người dùng xóa toàn bộ bộ lọc và xem lại danh sách', async () => {
      await chopChatbot.scrollToExperienceFilterBar();
      await chopChatbot.clearAllFilters();
      await chopChatbot.capture('all_filters_cleared');
    });

    // ── And: Xem chi tiết công việc ───────────────────────────────────
    await test.step('And Người dùng xem chi tiết một công việc gợi ý và đóng modal', async () => {
      await chopChatbot.openFirstJobCard();
      await chopChatbot.capture('job_detail_modal_opened');
      await chopChatbot.closeJobDetailModal();
      await chopChatbot.capture('job_detail_modal_closed');
    });

    // ── Then: Kết thúc flow ───────────────────────────────────────────
    await test.step('Then Người dùng quay về trang chủ', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible({ timeout: 15000 });
      await homePage.capture('returned_to_homepage');
    });
  });
});
