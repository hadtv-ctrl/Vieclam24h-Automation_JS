const { test } = require('../../../core/fixtures/baseTest');
const aiProfileData = require('../../../data/aiProfileData.json');

test.describe('Feature: Dùng trợ lý AI để hoàn thiện hồ sơ @profile @ai @e2e', () => {
  test('Người dùng viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI', async ({
    authenticatedUser,
    onboardingPopup,
    userProfilePage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    await test.step('Given Người dùng đã đăng nhập và đang ở trang Hồ sơ của tôi', async () => {
      // authenticatedUser fixture đã hoàn tất precondition đăng nhập.
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await userProfilePage.navigateToMyProfile();
    });

    await test.step('When Người dùng viết lại phần giới thiệu theo giọng chuyên nghiệp rồi thuyết phục', async () => {
      await userProfilePage.capture('profile_page_opened',true);
      await userProfilePage.clickAddIntroduction();
      await userProfilePage.capture('introduction_popup_opened');
      await userProfilePage.rewriteIntroductionWithAi(
        aiProfileData.introduction.sourceText,
        aiProfileData.introduction.tones
      );
      await userProfilePage.saveIntroduction();
    });

    await test.step('And Người dùng tạo mô tả kinh nghiệm bằng AI rồi viết lại thuyết phục và ngắn gọn', async () => {
      await userProfilePage.clickAddExperience();
      await userProfilePage.capture('experience_popup_opened');
      await userProfilePage.fillExperience({
        ...aiProfileData.experience,
        description: '',
      });
      await userProfilePage.capture('experience_form_filled');
      await userProfilePage.generateExperienceDescriptionWithAi(aiProfileData.experience.tones);
    });

    await test.step('Then Người dùng lưu kinh nghiệm đã được AI tạo nội dung', async () => {
      await userProfilePage.saveExperience();
    });
  });
});
