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
      throw new Error(`Register API returned ${response.status()}: ${JSON.stringify(body)}`);
    }

    const savedUser = apiHelper.persistUserState(payload, body, { writeFile: false });

    if (savedUser.tokenAuth) {
      const authHeaders = apiHelper.buildHeaders({
        authorization: `Bearer ${savedUser.tokenAuth}`,
      });
      const { response: consentResponse, body: consentBody } = await apiHelper.acceptConsent(authHeaders);

      if (consentResponse.status() !== 200) {
        throw new Error(`Accept consent API returned ${consentResponse.status()}: ${JSON.stringify(consentBody)}`);
      }
    }

    return savedUser;
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
  const phone = userProfile.phone || userProfile.username || '';
  if (!phone) {
    throw new Error('No phone found in data/users.json for login precondition');
  }

  await loginPopup.fillPhone(phone);
  await loginPopup.clickContinue();

  // Sử dụng hàm chờ loading động từ BasePage để tối ưu hơn
  await loginPopup.waitForGlobalLoadingHidden();

  await loginPopup.waitForOtpVisible();
  const otpCode = userProfile.otp || '1111';
  await loginPopup.fillOtpCode(otpCode);

  try {
    await popupConsent.agreeIfVisible();
  } catch (error) {
    // Bỏ qua nếu popup consent không xuất hiện
  }

  // Chờ modal đăng nhập biến mất để đảm bảo login hoàn tất
  await loginPopup.modalTitle.waitFor({ state: 'hidden', timeout: 30000 });


  return {
    phone,
    otp: otpCode,
    email: userProfile.email || '',
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
