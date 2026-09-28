const fs = require('fs');
const path = require('path');
const { generateRandomVNPhone, generateRandomEmail } = require('./commonUtils');
const { withLocalOverrides } = require('./localExtensions');

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
  console.warn(
    '[authSetup] ⚠️  STUB: createRegisteredUserForPrecondition() chưa được override.\n'
    + '  → Trả về dữ liệu user giả, KHÔNG gọi API/UI đăng ký thật.\n'
    + '  → Tạo file core/local/authSetup.local.js để cài đặt luồng đăng ký thật.\n'
    + '  → Xem hướng dẫn tại: core/local/README.md'
  );
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
  console.warn(
    '[authSetup] ⚠️  STUB: loginUserFromDataForPrecondition() chưa được override.\n'
    + '  → Không thực hiện đăng nhập, session vẫn ở trạng thái anonymous.\n'
    + '  → Tạo file core/local/authSetup.local.js để cài đặt luồng đăng nhập thật.'
  );
  const user = providedUser || (await createRegisteredUserForPrecondition());
  return user;
}

async function registerUserByPhoneForPrecondition(page) {
  return loginUserFromDataForPrecondition(page);
}

const baseExports = {
  loginUserFromDataForPrecondition,
  registerUserByPhoneForPrecondition,
  createRegisteredUserForPrecondition,
  createRuntimeUserData,
  removeRuntimeUserData,
};

/**
 * Các hàm trên chỉ là bản mặc định trung tính của Hub (không gọi API/UI thật).
 * Mỗi dự án tự hiện thực luồng đăng ký/đăng nhập của mình tại
 * `core/local/authSetup.local.js` và override đúng những hàm cần thiết:
 *
 *   module.exports = { loginUserFromDataForPrecondition, createRegisteredUserForPrecondition };
 *
 * `core/fixtures/baseTest.js` và `core/fixtures/mobileWebTest.js` (cũng do Hub sở hữu)
 * vẫn require('../utils/authSetup') như cũ — KHÔNG được sửa import trong core/,
 * vì chúng sẽ bị sync ghi đè. Chi tiết: core/utils/localExtensions.js
 */
module.exports = withLocalOverrides('authSetup.local.js', baseExports);
