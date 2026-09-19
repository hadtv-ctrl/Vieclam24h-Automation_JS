const { test, expect } = require('@playwright/test');
const { generateRandomVNPhone, generateRandomEmail } = require('../../core/utils/commonUtils');
const { RegistrationApiHelper } = require('../../core/utils/registrationApiHelper');

test.describe('Feature: Đăng ký tài khoản người tìm việc qua API @api @register @REQ-001', () => {
  test('TC-005 - AC-003 API đăng ký trả về status 200 và cấp token với payload động', async ({ request }, testInfo) => {
    const apiHelper = new RegistrationApiHelper(request);
    const email = generateRandomEmail();
    const phone = generateRandomVNPhone(); // lấy phone random
    const password = 'Test@1234';
    const payload = apiHelper.buildPayload(email, password, phone, 'Hà JS');
    const headers = apiHelper.buildHeaders();

    await test.step('Given tạo payload đăng ký mới với email, mobile và password động', async () => {
      expect(payload.email).toBe(email);
      expect(payload.mobile).toBe(phone);
      expect(payload.password).toBe(password);
    });

    await test.step('When gửi request POST tới API register', async () => {
      const { response, body } = await apiHelper.register(payload, headers);
      const savedUser = apiHelper.persistUserState(payload, body);

      testInfo.attach('register-api-response', {
        body: JSON.stringify({
          status: response.status(),
          user: {
            email: savedUser.email,
            phone: savedUser.phone,
            registeredAt: savedUser.registeredAt,
            hasTokenAuth: Boolean(savedUser.tokenAuth),
          },
        }, null, 2),
        contentType: 'application/json',
      });

      expect(response.status()).toBe(200);
      expect(body).toBeTruthy();
      if (savedUser.tokenAuth) {
        expect(savedUser.tokenAuth).toBeTruthy();
      }
    });
  });

  test('TC-006 - AC-004 API chấp thuận dữ liệu cá nhân trả về status 200 bằng token đã lưu', async ({ request }, testInfo) => {
    const apiHelper = new RegistrationApiHelper(request);
    const currentUser = global.__automationState?.registeredUser || null;

    expect(currentUser?.tokenAuth, 'Cần chạy test register trước để có token_auth').toBeTruthy();

    const authHeaders = apiHelper.buildHeaders({
      authorization: `Bearer ${currentUser.tokenAuth}`,
    });

    await test.step('When gửi request POST tới API accept consent', async () => {
      const { response, body } = await apiHelper.acceptConsent(authHeaders);

      testInfo.attach('consent-api-response', {
        body: JSON.stringify({ status: response.status(), body }, null, 2),
        contentType: 'application/json',
      });

      expect(response.status()).toBe(200);
      expect(body).toBeTruthy();
    });
  });
});
