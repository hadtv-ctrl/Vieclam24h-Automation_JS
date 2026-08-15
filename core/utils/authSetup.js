const fs = require('fs');
const path = require('path');
const { expect, request: playwrightRequest } = require('@playwright/test');
const { generateRandomVNPhone, generateRandomEmail } = require('./commonUtils');
const { RegistrationApiHelper } = require('./registrationApiHelper');
const { LoginPopup } = require('../../pages/LoginPopup');
const { HomePage } = require('../../pages/HomePage');
const { PopupConsent } = require('../../pages/PopupConsent');

function loadUserData() {
  const usersFilePath = path.join(__dirname, '../../data/users.json');
  try {
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    return Array.isArray(usersData) ? usersData : [];
  } catch (error) {
    console.error('Error reading users.json:', error);
    return [];
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
      // Return a mock user object if API fails, to allow test to continue
      return {
        email: payload.email,
        phone: payload.mobile,
        tokenAuth: null,
        password: payload.password,
        fullName: payload.name
      };
    }

    const savedUser = apiHelper.persistUserState(payload, body, { writeFile: false });

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
    console.warn('Registration API failed, using fallback user:', error.message);
    // Return a mock user to allow test to continue
    return {
      email: payload.email,
      phone: payload.mobile,
      tokenAuth: null,
      password: payload.password,
      fullName: payload.name,
      otp: '1111'
    };
  } finally {
    await requestContext.dispose();
  }
}

async function loginUserFromDataForPrecondition(page) {
  const loginPopup = new LoginPopup(page);
  const homePage = new HomePage(page);
  const popupConsent = new PopupConsent(page);

  const createdUser = await createRegisteredUserForPrecondition();
  await homePage.navigate();
  await page.waitForLoadState('domcontentloaded');
  await homePage.closeAdsIfVisible();

  await loginPopup.clickLoginHeader();
  await expect(loginPopup.modalTitle).toBeVisible();

  const userProfile = createdUser || loadUserData()[0] || {};
  const email = userProfile.email || '';
  const phone = userProfile.phone || userProfile.username || '';
  
  if (!email) {
    throw new Error('No email found in user data for email login precondition');
  }

  // Click email login option
  await loginPopup.clickEmailLoginOption();
  
  // Wait for email input to be visible after clicking email login option
  await loginPopup.emailInput.waitFor({ state: 'visible', timeout: 10000 });
  
  // Fill email
  await loginPopup.fillEmail(email);
  
  // Small delay to ensure email input is processed
  await page.waitForTimeout(500);
  
  // Verify continue button is enabled before clicking
  await loginPopup.continueBtn.waitFor({ state: 'visible', timeout: 5000 });
  await loginPopup.clickContinue();

  // Wait for loading to complete after clicking continue
  await page.waitForTimeout(1000);
  await loginPopup.waitForGlobalLoadingHidden(15000);

  // Wait for OTP form to appear (either via modal title or OTP input)
  try {
    // First try to wait for OTP modal title
    await loginPopup.otpModalTitle.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // If modal title not visible, wait for OTP inputs directly
    await page.waitForTimeout(500);
  }
  
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

function saveGeneratedUser(createdUser) {
  if (!createdUser) return;
  const usersFilePath = path.join(__dirname, '../../data/users.json');
  let usersData = [];
  try {
    usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  } catch (e) {
    console.error('Error reading users.json:', e);
  }

  if (usersData.length > 0) {
    usersData[0].phone = createdUser.phone;
    usersData[0].email = createdUser.email;
    usersData[0].username = createdUser.phone;
    if (createdUser.password) usersData[0].password = createdUser.password;
    if (createdUser.fullName) usersData[0].fullName = createdUser.fullName;
  } else {
    usersData.push({
      username: createdUser.phone,
      password: createdUser.password || 'Test@1234',
      fullName: createdUser.fullName || 'Automation Tester',
      phone: createdUser.phone,
      email: createdUser.email
    });
  }
  fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2), 'utf8');
}

module.exports = {
  loginUserFromDataForPrecondition,
  registerUserByPhoneForPrecondition,
  saveGeneratedUser,
  createRegisteredUserForPrecondition,
};
