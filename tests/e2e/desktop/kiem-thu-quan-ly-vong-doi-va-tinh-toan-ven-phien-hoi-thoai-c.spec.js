const { test, expect } = require('../../../core/fixtures/baseTest');
const { ChopChatbotPage } = require('../../../pages/desktop/ChopChatbotPage');

test.describe('Feature: Quản lý vòng đời và phiên hội thoại Chop AI chatbot @auth @chatbot @desktop @e2e @REQ-007', () => {
  let chopChatbot;

  test('TC-050 - AC-022: Kiểm thử quản lý vòng đời và tính toàn vẹn phiên hội thoại Chatbot', async ({
    page,
    workerUserData,
  }, testInfo) => {
    chopChatbot = new ChopChatbotPage(page, 'chop_chatbot_session_lifecycle');
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI trên QC thực tế',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và đang mở cửa sổ Chatbot Chop AI', async () => {
      await chopChatbot.setupRealChatbotPrecondition(workerUserData.user);
      await expect(chopChatbot.chatInput).toBeVisible({ timeout: 15000 });
      await expect(chopChatbot.sendBtn.last()).toBeVisible();
      await chopChatbot.capture('precondition_chatbot_session_ready');
    });

    await test.step('When [1] Tạo phiên chat với mục tiêu \'Tìm việc Senior QA Automation\'', async () => {
      await chopChatbot.sendChatbotQuery('Tìm việc Senior QA Automation');
      await chopChatbot.capture('session_target_sent');
    });

    await test.step('Then [1] Dữ liệu phiên hội thoại được ghi nhận và hiển thị trong lịch sử chat', async () => {
      await chopChatbot.expectChatHistoryContains('Tìm việc Senior QA Automation');
      await chopChatbot.expectJobCountVisible();
      await chopChatbot.capture('session_stored_successfully');
    });

    await test.step('When [2] Tiếp tục tương tác gửi tin nhắn thứ hai trong cùng phiên làm việc', async () => {
      await chopChatbot.sendChatbotQuery('Mức lương mong muốn từ 20 triệu');
      await chopChatbot.capture('second_message_sent_same_session');
    });

    await test.step('Then [2] Ngữ cảnh hội thoại được duy trì liên tục và ghi nhận đầy đủ các lượt chat', async () => {
      await chopChatbot.expectChatHistoryContains('Mức lương mong muốn từ 20 triệu');
      await chopChatbot.capture('multi_turn_session_integrity_verified');
    });

    let tabB;
    await test.step('When [3] Mở ứng dụng trên Tab B của cùng trình duyệt', async () => {
      tabB = await chopChatbot.openSecondTabChatbot();
      await chopChatbot.capture('tab_b_opened');
    });

    await test.step('Then [3] Tab B khởi tạo giao diện trò chuyện an toàn, không xung đột với Tab A', async () => {
      await expect(tabB.chatInput).toBeVisible({ timeout: 15000 });
      await tabB.page.close();
      await chopChatbot.capture('tab_b_isolation_verified');
    });

    await test.step('When [4] Tải lại trang (Reload) Chatbot', async () => {
      await chopChatbot.reloadChatbot();
      await chopChatbot.capture('page_reloaded');
    });

    await test.step('Then [4] Hệ thống khởi tạo lại phiên làm việc mới sạch sẽ, sẵn sàng nhận yêu cầu mới', async () => {
      await expect(chopChatbot.chatInput).toBeVisible({ timeout: 15000 });
      await chopChatbot.expectGreetingVisible();
      await chopChatbot.capture('session_reset_on_reload_verified');
    });

    await test.step('When [5] Xóa Cookies & LocalStorage của trình duyệt và mở lại Chatbot', async () => {
      await chopChatbot.clearStorageAndCookies(workerUserData.user);
      await chopChatbot.capture('session_and_cookies_cleared');
    });

    await test.step('Then [5] Hệ thống khởi tạo phiên mới sạch sẽ, an toàn, không gây crash giao diện', async () => {
      await expect(chopChatbot.chatInput).toBeVisible({ timeout: 20000 });
      await expect(chopChatbot.sendBtn.last()).toBeVisible();
      await chopChatbot.expectGreetingVisible();
      await chopChatbot.capture('clean_new_session_no_crash');
    });
  });
});
