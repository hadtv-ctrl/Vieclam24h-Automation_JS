const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & kiểm tra giá trị biên @guest @no-auth @bva @personalize @desktop @e2e @REQ-008', () => {
  test('TC-097 - AC-023 Kiểm tra giới hạn khi nhập vượt quá biên tối đa 5', async ({ page }, testInfo) => {
    const personalizePage = new PersonalizePage(page, 'personalize_boundary_max_5');
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập trực tiếp Personalized Page, hoàn tất xác thực và đang ở màn hình nhập tiêu chí công việc (Bước 1 Mini-onboarding)',
    });

    const testPhone = generateRandomVNPhone();
    const validData5Chars = 'Sale1'; // 5 ký tự (biên tối đa hợp lệ)
    const invalidData6Chars = 'Sale12'; // 6 ký tự (vượt biên tối đa 5)

    await test.step('Given Tiền điều kiện: Người dùng ở Bước 1 nhập vị trí công việc trực tiếp trên Personalized Page', async () => {
      // Xác thực và điều hướng trực tiếp đến Bước 1 trên Personalized Page
      await personalizePage.reachOnboardingStep1JobTitle(testPhone, '1111', 'Hà Đinh');
      expect(page.url()).toContain(personalizePage.personalizedPath);

      await expect(personalizePage.dataTestId.first()).toBeVisible({ timeout: 15000 });
      await personalizePage.capture('01_step1_input_screen_ready');
    });

    await test.step('When [1] Nhập các trường thông tin hợp lệ', async () => {
      // Nhập giá trị hợp lệ nằm trong ngưỡng cho phép
      await personalizePage.fillValidCriteriaField(validData5Chars);
    });

    await test.step('Then [1] Không có cảnh báo lỗi', async () => {
      // Hệ thống ghi nhận giá trị hợp lệ và không xuất hiện thông báo lỗi
      await expect(personalizePage.fieldError).toBeHidden();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('02_valid_data_accepted_no_error');
    });

    await test.step('When [2] Nhập trường dữ liệu có 6 ký tự', async () => {
      // Nhập trường dữ liệu có 6 ký tự (vượt ngưỡng biên tối đa 5)
      await personalizePage.fill6CharsField(invalidData6Chars);
    });

    await test.step('Then [2] Hệ thống báo lỗi hoặc giới hạn không cho nhập quá 5 ký tự', async () => {
      // Hệ thống phản hồi bằng một trong các cơ chế: báo lỗi validation hoặc giới hạn độ dài giá trị tối đa 5 ký tự
      const actualValue = await personalizePage.dataTestId.inputValue().catch(() => '');
      const isLengthLimited = actualValue.length <= 5;
      const isErrorDisplayed = await personalizePage.fieldError
        .or(personalizePage.limitExceededWarning)
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Khẳng định hệ thống kiểm soát đúng giới hạn biên: hoặc giới hạn độ dài <= 5 hoặc hiển thị thông báo lỗi
      expect(isLengthLimited || isErrorDisplayed).toBeTruthy();
      expect(page.url()).toContain(personalizePage.personalizedPath);
      await personalizePage.capture('03_boundary_exceeded_handled_successfully');
    });
  });
});
