const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { expect } = require('@playwright/test');
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

async function executeRegisterApiSpec() {
  const repoRoot = path.resolve(__dirname, '../..');
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    'playwright',
    'test',
    'tests/api/register_api.spec.js',
    '--reporter=line',
    '--trace=off',
    '--output=test-results/register-api-precondition',
    '--grep=POST /seeker/fe/register'
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env },
      shell: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`register_api.spec.js exited with code ${code}`));
      }
    });
  });
}

async function loginUserFromDataForPrecondition(page) {
  const loginPopup = new LoginPopup(page);
  const homePage = new HomePage(page);
  const popupConsent = new PopupConsent(page);

  await executeRegisterApiSpec();
  await homePage.navigate();
  await page.waitForLoadState('domcontentloaded');
  await homePage.closeAdsIfVisible();

  await loginPopup.clickLoginHeader();
  await expect(loginPopup.modalTitle).toBeVisible();

  const userProfile = loadUserData()[0] || {};
  const phone = userProfile.phone || userProfile.username || '';
  if (!phone) {
    throw new Error('No phone found in data/users.json for login precondition');
  }

  await loginPopup.fillPhone(phone);
  await loginPopup.clickContinue();

  await loginPopup.waitForOtpVisible();
  const otpCode = userProfile.otp || '1111';
  await loginPopup.fillOtpCode(otpCode);

  try {
    await popupConsent.agreeIfVisible();
  } catch (error) {
    // Bỏ qua nếu popup consent không xuất hiện
  }

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

module.exports = { loginUserFromDataForPrecondition, registerUserByPhoneForPrecondition, saveGeneratedUser };
