const { test } = require('../../../core/fixtures/mobileWebTest');
const aiProfileData = require('../../../data/aiProfileData.json');

test.describe('Mobile Feature: Dùng trợ lý AI để hoàn thiện hồ sơ trên Mobile Web @profile @ai @mobile @e2e', () => {
  test('Người dùng mobile viết lại giới thiệu và tạo mô tả kinh nghiệm bằng AI', async ({
    authenticatedUser,
    onboardingPopup,
    userProfilePage,
  }) => {
    test.slow();
    test.setTimeout(600000);

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và sẵn sàng tại trang Hồ sơ', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
        modalDetachedTimeout: 10000,
      });
      await userProfilePage.navigateToMyProfile();
      await userProfilePage.capture('precondition_mobile_my_profile_opened');
    });

    await test.step('When Người dùng mobile viết lại phần giới thiệu theo giọng chuyên nghiệp rồi thuyết phục', async () => {
      await userProfilePage.clickAddIntroduction();
      await userProfilePage.capture('mobile_introduction_popup_opened');
      await userProfilePage.rewriteIntroductionWithAi(
        aiProfileData.introduction.sourceText,
        aiProfileData.introduction.tones
      );
      await userProfilePage.saveIntroduction();
    });

    await test.step('And Người dùng mobile tạo mô tả kinh nghiệm bằng AI rồi viết lại thuyết phục', async () => {
      await userProfilePage.clickAddExperience();
      await userProfilePage.capture('mobile_experience_popup_opened');
      await userProfilePage.fillExperience({
        ...aiProfileData.experience,
        description: '',
      });
      await userProfilePage.capture('mobile_experience_form_filled');
      await userProfilePage.generateExperienceDescriptionWithAi(aiProfileData.experience.tones);
    });

    await test.step('Then Người dùng mobile lưu kinh nghiệm đã được AI tạo nội dung', async () => {
      await userProfilePage.saveExperience();
      await userProfilePage.capture('mobile_experience_saved_with_ai', true);
    });
  });
});
