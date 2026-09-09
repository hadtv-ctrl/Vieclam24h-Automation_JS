/**
 * Custom Fixture: ephemeralUser
 * Tự động tạo user tạm cho kịch bản test và tự động dọn dẹp (xóa) sau khi test hoàn tất
 * Được tạo bởi Dashboard Fixtures Studio
 */

module.exports = {
  ephemeralUser: async ({ cleanupQueue }, use) => {
    // 1. Setup: Khởi tạo thông tin user tạm
    const tempUser = {
      id: `usr_${Date.now()}`,
      username: `test_user_${Date.now()}@example.com`,
      role: 'qa_tester',
      status: 'active',
      cleanedUp: false,
    };

    // 2. Đăng ký tác vụ teardown vào hàng đợi dọn dẹp fail-safe
    cleanupQueue.register(async () => {
      tempUser.status = 'deleted';
      tempUser.cleanedUp = true;
    }, `Tự động xóa User tạm ID: ${tempUser.id}`);

    // 3. Cung cấp cho test case sử dụng
    await use(tempUser);
  },
};