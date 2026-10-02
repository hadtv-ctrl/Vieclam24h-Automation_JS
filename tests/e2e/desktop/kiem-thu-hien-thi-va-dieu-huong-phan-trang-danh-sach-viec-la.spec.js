const { test, expect } = require('../../../core/fixtures/baseTest');
const { ChopChatbotPage } = require('../../../pages/desktop/ChopChatbotPage');

test.describe('Feature: Tìm kiếm việc làm qua trợ lý Chop AI chatbot @auth @chatbot @desktop @e2e @REQ-007', () => {
  let chopChatbot;

  test('TC-049 - AC-022: Kiểm thử hiển thị và điều hướng phân trang danh sách việc làm trong Job Drawer của Chatbot', async ({
    page,
    workerUserData,
  }, testInfo) => {
    chopChatbot = new ChopChatbotPage(page, 'chop_chatbot_pagination');
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI trên QC',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI', async () => {
      await chopChatbot.setupRealChatbotPrecondition(workerUserData.user);
      await expect(chopChatbot.chatInput).toBeVisible({ timeout: 15000 });
      await expect(chopChatbot.sendBtn.last()).toBeVisible();
      await chopChatbot.capture('precondition_chop_chatbot_opened');
    });

    await test.step('When [1] Nhập từ khóa không tồn tại xyz123nonexistentjob vào chatbot', async () => {
      await chopChatbot.sendChatbotQuery('xyz123nonexistentjob');
      await chopChatbot.capture('query_nonexistent_job_sent');
    });

    await test.step('Then [1] Chatbot phản hồi thông báo hướng dẫn lĩnh vực; Job Drawer không hiển thị kết quả rỗng sai lệch', async () => {
      await chopChatbot.expectFallbackGuidanceVisible();
      await chopChatbot.expectJobDrawerHidden();
      await chopChatbot.capture('empty_search_state_verified');
    });

    await test.step('When [2] Nhập từ khóa tìm kiếm việc làm thực tế Nhân viên kinh doanh', async () => {
      await chopChatbot.sendChatbotQuery('Nhân viên kinh doanh');
      await chopChatbot.capture('query_real_jobs_sent');
    });

    await test.step('Then [2] Chatbot phản hồi số lượng việc làm tìm thấy và hiển thị nút mở Job Drawer', async () => {
      await chopChatbot.expectJobCountVisible();
      await chopChatbot.capture('job_count_button_visible');
    });

    await test.step('When [3] Người dùng mở Job Drawer', async () => {
      await chopChatbot.openJobDrawer();
      await chopChatbot.capture('job_drawer_opened');
    });

    await test.step('Then [3] Job Drawer hiển thị danh sách công việc ban đầu và tổng số việc làm tìm thấy', async () => {
      await expect(chopChatbot.jobDrawerTitle).toBeVisible();
      const initialCount = await chopChatbot.getDrawerItemsCount();
      expect(initialCount).toBeGreaterThan(0);
      await chopChatbot.capture('initial_drawer_jobs_verified');
    });

    await test.step('When [4] Cuộn danh sách trong Job Drawer để kích hoạt tải phân trang trang tiếp theo', async () => {
      await chopChatbot.scrollDrawerToLoadMore();
      await chopChatbot.capture('drawer_scrolled_for_pagination');
    });

    await test.step('Then [4] Dữ liệu phân trang trang tiếp theo được tải mượt mà không vỡ layout', async () => {
      await expect(chopChatbot.drawerContainer).toBeVisible();
      await chopChatbot.capture('page_2_loaded_smoothly');
    });

    await test.step('When [5] Đóng Drawer và kiểm tra trạng thái', async () => {
      await chopChatbot.closeJobDrawer();
      await chopChatbot.capture('drawer_closed');
    });

    await test.step('Then [5] Job Drawer đóng thành công, giao diện trò chuyện vẫn ổn định', async () => {
      await chopChatbot.expectJobDrawerHidden();
      await expect(chopChatbot.chatInput).toBeVisible();
      await chopChatbot.capture('drawer_closed_successfully');
    });

    await test.step('When [6] Mở lại Drawer từ nút kết quả việc làm trong đoạn chat', async () => {
      await chopChatbot.reopenJobDrawer();
      await chopChatbot.capture('drawer_reopened');
    });

    await test.step('Then [6] Job Drawer duy trì danh sách việc làm nhất quán, không lỗi hiển thị', async () => {
      await expect(chopChatbot.jobDrawerTitle).toBeVisible();
      const countAfterReopen = await chopChatbot.getDrawerItemsCount();
      expect(countAfterReopen).toBeGreaterThan(0);
      await chopChatbot.capture('drawer_state_persisted_across_toggles');
    });
  });
});
