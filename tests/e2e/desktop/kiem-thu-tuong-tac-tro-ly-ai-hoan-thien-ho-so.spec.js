const { test, expect } = require('../../../core/fixtures/baseTest');
const { UserProfilePage } = require('../../../pages/desktop/UserProfilePage');

test.describe('Feature: Trợ lý AI hoàn thiện nội dung hồ sơ @auth @profile @ai @desktop @e2e @REQ-006', () => {
  let userProfilePage;

  test('TC-048 - AC-020 AC-021: Kiểm thử tương tác trợ lý AI hoàn thiện hồ sơ', async ({
    page,
  }, testInfo) => {
    userProfilePage = new UserProfilePage(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập, đang ở trang chỉnh sửa Hồ sơ của tôi (mục Giới thiệu bản thân và Kinh nghiệm làm việc)',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập, đang ở trang chỉnh sửa Hồ sơ của tôi (mục Giới thiệu bản thân và Kinh nghiệm làm việc)', async () => {
      await userProfilePage.setupAiProfilePrecondition();
      await expect(userProfilePage.btnAiIntro).toBeVisible({ timeout: 15000 });
      await expect(userProfilePage.btnAiExp).toBeVisible();
      await userProfilePage.capture('precondition_ai_profile_editor_loaded');
    });

    await test.step('When [1] Mở form Giới thiệu bản thân, nhập đoạn văn gốc và kích hoạt AI viết lại lần lượt qua 3 giọng văn', async () => {
      await userProfilePage.openAiIntroModal();
      await userProfilePage.fillAiIntroSourceText('Tôi là chuyên viên kiểm thử phần mềm với 5 năm kinh nghiệm.');
      await userProfilePage.triggerAiRewrite();
      await userProfilePage.selectTonePro();
      await userProfilePage.selectTonePersuasive();
      await userProfilePage.selectToneConcise();
      await userProfilePage.capture('ai_three_tones_selected');
    });

    await test.step('Then [1] AI sinh gợi ý tương ứng với từng giọng văn đã chọn', async () => {
      await expect(userProfilePage.aiPreviewBox).toBeVisible();
      await expect(userProfilePage.aiActiveTone).toContainText('Ngắn gọn dễ đọc');
      await expect(userProfilePage.aiPreviewContent).toContainText('5 năm kinh nghiệm QA/Automation Test');
      await userProfilePage.capture('ai_preview_generated_per_tone');
    });

    await test.step('When [2] Tại bản xem trước AI vừa tạo, nhấn nút \'Hủy\' / \'Không sử dụng\'', async () => {
      await userProfilePage.cancelAiPreview();
      await userProfilePage.capture('ai_preview_cancelled');
    });

    await test.step('Then [2] Bản xem trước đóng lại, đoạn giới thiệu gốc của người dùng được giữ nguyên vẹn', async () => {
      await expect(userProfilePage.aiPreviewBox).toBeHidden({ timeout: 5000 });
      await expect(userProfilePage.txtAiIntroSource).toHaveValue('Tôi là chuyên viên kiểm thử phần mềm với 5 năm kinh nghiệm.');
      await userProfilePage.capture('original_intro_preserved_intact');
    });

    await test.step('When [3] Mở form Kinh nghiệm làm việc, nhập Chức danh và Công ty nhưng để trống phần mô tả, bấm \'Tạo mô tả bằng AI\'', async () => {
      await userProfilePage.openAiExpModal();
      await userProfilePage.fillAiExperienceHeader('Automation Test Lead', 'SieuViet Group');
      await expect(userProfilePage.txtAiExpDesc).toHaveValue('');
      await userProfilePage.triggerAiGenerateExp();
      await userProfilePage.saveAiExperience();
      await userProfilePage.capture('experience_generated_and_saved');
    });

    await test.step('Then [3] AI tự động sinh mô tả phù hợp, bấm \'Áp dụng\' lưu ngay vào hồ sơ', async () => {
      await expect(userProfilePage.expSavedContent).toContainText('Automation Test Lead tại SieuViet Group');
      await expect(userProfilePage.expSavedContent).toContainText('Xây dựng kịch bản kiểm thử tự động');
      await userProfilePage.capture('experience_ai_content_applied_to_profile');
    });

    await test.step('When [4] Mô phỏng tình huống API AI phản hồi mã lỗi 500 / Timeout', async () => {
      await userProfilePage.simulateAiServiceError();
      await userProfilePage.capture('simulated_ai_api_error_triggered');
    });

    await test.step('Then [4] Hệ thống đóng trạng thái loading và hiển thị popup thông báo lỗi dịch vụ tới người dùng', async () => {
      await expect(userProfilePage.aiLoadingSpinner).toBeHidden({ timeout: 5000 });
      await expect(userProfilePage.aiErrorModal).toBeVisible({ timeout: 5000 });
      await expect(userProfilePage.aiErrorMessage).toContainText('mã lỗi 500 / Timeout');
      await userProfilePage.capture('ai_service_error_popup_displayed');
    });
  });
});
