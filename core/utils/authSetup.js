const fs = require('fs');
const path = require('path');
const { expect, request: playwrightRequest } = require('@playwright/test');
const { generateRandomVNPhone, generateRandomEmail } = require('./commonUtils');
const { RegistrationApiHelper } = require('./registrationApiHelper');
const { LoginPopup } = require('../../pages/desktop/LoginPopup');
const { HomePage } = require('../../pages/desktop/HomePage');
const { PopupConsent } = require('../../pages/desktop/PopupConsent');

function getRuntimeUserDirectory() {
  return path.join(__dirname, '../../test-results/runtime-users');
}

function buildRuntimeUserFileName(parallelIndex) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-worker-${parallelIndex}-pid-${process.pid}.json`;
}

async function createRuntimeUserData(parallelIndex) {
  const user = await createRegisteredUserForPrecondition();
  if (!user) {
    throw new Error(`Worker ${parallelIndex} could not create an isolated registered user`);
  }

  const runtimeDirectory = getRuntimeUserDirectory();
  const filePath = path.join(runtimeDirectory, buildRuntimeUserFileName(parallelIndex));
  await fs.promises.mkdir(runtimeDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(user, null, 2), {
    encoding: 'utf8',
    flag: 'wx',
  });

  const persistedUser = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  return { user: persistedUser, filePath };
}

async function removeRuntimeUserData(filePath) {
  if (!filePath) return;

  const runtimeDirectory = path.resolve(getRuntimeUserDirectory());
  const resolvedFilePath = path.resolve(filePath);
  if (path.dirname(resolvedFilePath) !== runtimeDirectory) {
    throw new Error(`Refusing to remove runtime user data outside ${runtimeDirectory}`);
  }

  try {
    await fs.promises.unlink(resolvedFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function createRegisteredUserForPrecondition() {
  const requestContext = await playwrightRequest.newContext();
  const apiHelper = new RegistrationApiHelper(requestContext);
  const payload = apiHelper.buildPayload(
    generateRandomEmail(),
    'Test@1234',
    generateRandomVNPhone(),
    'Hà JS'
  );

  try {
    const headers = apiHelper.buildHeaders();
    const { response, body } = await apiHelper.register(payload, headers);

    if (response.status() !== 200) {
      console.warn(`Register API returned ${response.status()}: ${JSON.stringify(body)}`);
      return null;
    }

    const savedUser = apiHelper.persistUserState(payload, body);

    if (savedUser.tokenAuth) {
      const authHeaders = apiHelper.buildHeaders({
        authorization: `Bearer ${savedUser.tokenAuth}`,
      });
      const { response: consentResponse, body: consentBody } = await apiHelper.acceptConsent(authHeaders);

      if (consentResponse.status() !== 200) {
        console.warn(`Accept consent API returned ${consentResponse.status()}: ${JSON.stringify(consentBody)}`);
      }
    }

    return savedUser;
  } catch (error) {
    console.warn('Registration API failed; using a persisted registered user:', error.message);
    return null;
  } finally {
    await requestContext.dispose();
  }
}

async function trustRuntimeEmailVerification(page) {
  const markEmailVerified = async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== '/seeker/fe/me') {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    if (!body) {
      await route.fulfill({ response });
      return;
    }

    if (body?.data?.token_email === 'no_verified') {
      body.data.token_email = 'verified';
    }

    await route.fulfill({ response, json: body });
  };

  await page.route('**/seeker/fe/me', markEmailVerified);
  await page.route('**/seeker/fe/me?*', markEmailVerified);
}

async function loginUserFromDataForPrecondition(page, providedUser = null, pageClasses = {}) {
  const LoginPopupClass = pageClasses.LoginPopupClass || LoginPopup;
  const HomePageClass = pageClasses.HomePageClass || HomePage;
  const PopupConsentClass = pageClasses.PopupConsentClass || PopupConsent;

  const loginPopup = new LoginPopupClass(page);
  const homePage = new HomePageClass(page);
  const popupConsent = new PopupConsentClass(page);

  const createdUser = providedUser || await createRegisteredUserForPrecondition();
  await homePage.navigate();
  await page.waitForLoadState('domcontentloaded');
  await homePage.closeAdsIfVisible();

  await loginPopup.clickLoginHeader();
  await expect(loginPopup.modalTitle).toBeVisible();

  const userProfile = createdUser || {};
  const email = userProfile.email || '';
  const phone = userProfile.phone || userProfile.username || '';

  if (!phone && !email) {
    throw new Error('No phone or email found in user data for login precondition');
  }

  if (phone) {
    await loginPopup.phoneInput.waitFor({ state: 'visible', timeout: 10000 });
    await loginPopup.fillPhone(phone);
    await expect(loginPopup.phoneInput).toHaveValue(phone);
  } else {
    await loginPopup.clickEmailLoginOption();
    await loginPopup.emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await loginPopup.fillEmail(email);
    await expect(loginPopup.emailInput).toHaveValue(email);
  }

  // Verify continue button is enabled before clicking
  await loginPopup.continueBtn.waitFor({ state: 'visible', timeout: 5000 });
  await expect(loginPopup.continueBtn).toBeEnabled();
  await loginPopup.clickContinueUntilOtpVisible({
    maxAttempts: 3,
    otpTimeout: 10000,
    loadingTimeout: 15000,
  });

  // Wait for OTP inputs to be visible
  await loginPopup.otpInputs.first().waitFor({ state: 'visible', timeout: 15000 });

  const otpCode = userProfile.otp || '1111';
  await loginPopup.fillOtpCode(otpCode);

  try {
    await popupConsent.agreeIfVisible();
  } catch (error) {
    // Bỏ qua nếu popup consent không xuất hiện
  }

  // Chờ modal đăng nhập biến mất để đảm bảo login hoàn tất
  try {
    await loginPopup.modalTitle.waitFor({ state: 'hidden', timeout: 60000 });
  } catch (error) {
    // Modal may already be hidden or navigation may have completed
    console.warn('Modal hide timeout, waiting for network idle...');
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
  }

  await trustRuntimeEmailVerification(page);

  return {
    email,
    phone,
    otp: otpCode,
    fullName: userProfile.fullName || '',
    password: userProfile.password || ''
  };
}

async function registerUserByPhoneForPrecondition(page) {
  return loginUserFromDataForPrecondition(page);
}

module.exports = {
  loginUserFromDataForPrecondition,
  registerUserByPhoneForPrecondition,
  createRegisteredUserForPrecondition,
  createRuntimeUserData,
  removeRuntimeUserData,
};
