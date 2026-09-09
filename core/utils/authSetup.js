const fs = require('fs');
const path = require('path');
const { generateRandomVNPhone, generateRandomEmail } = require('./commonUtils');

function getRuntimeUserDirectory() {
  return path.join(__dirname, '../../test-results/runtime-users');
}

function buildRuntimeUserFileName(parallelIndex) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-worker-${parallelIndex}-pid-${process.pid}.json`;
}

async function createRuntimeUserData(parallelIndex) {
  const user = await createRegisteredUserForPrecondition();
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
  return {
    email: generateRandomEmail(),
    phone: generateRandomVNPhone(),
    username: 'test_qa_user',
    password: 'Password@123',
    fullName: 'QA Studio User',
    tokenAuth: '',
  };
}

async function loginUserFromDataForPrecondition(page, providedUser = null) {
  const user = providedUser || (await createRegisteredUserForPrecondition());
  return user;
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
