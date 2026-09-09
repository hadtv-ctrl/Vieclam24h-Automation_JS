/**
 * Cleanup Registry Helper
 * Cung cấp hàng đợi tác vụ dọn dẹp dữ liệu (Teardown Tasks) fail-safe cho Playwright tests.
 * Các tác vụ đã đăng ký luôn được thực thi trong khối finally bất kể kịch bản PASS hay FAIL.
 */

class CleanupRegistry {
  constructor() {
    this.tasks = [];
  }

  /**
   * Đăng ký một hàm dọn dẹp (đồng bộ hoặc bất đồng bộ)
   * @param {() => Promise<void> | void} taskFn
   */
  register(taskFn) {
    if (typeof taskFn === 'function') {
      this.tasks.push(taskFn);
    }
  }

  /**
   * Thực thi toàn bộ tác vụ dọn dẹp theo thứ tự LIFO (tác vụ đăng ký sau dọn trước)
   * Bắt lỗi từng tác vụ riêng lẻ để không làm gián đoạn các tác vụ khác
   */
  async runAll() {
    const errors = [];
    while (this.tasks.length > 0) {
      const task = this.tasks.pop();
      try {
        await task();
      } catch (err) {
        errors.push(err);
        console.warn(`[CleanupRegistry Warning] Lỗi khi thực hiện dọn dẹp: ${err.message}`);
      }
    }
    return errors;
  }
}

/**
 * Fixture cleanupQueue dùng cho baseTest
 */
const cleanupQueueFixture = async ({}, use) => {
  const registry = new CleanupRegistry();
  /**
   * Hàm helper mà test spec có thể gọi trực tiếp:
   * cleanupQueue(async () => { await api.deleteUser(id); })
   */
  const registerFn = (taskFn) => registry.register(taskFn);
  registerFn.register = (taskFn) => registry.register(taskFn);
  registerFn.registry = registry;

  try {
    await use(registerFn);
  } finally {
    await registry.runAll();
  }
};

module.exports = {
  CleanupRegistry,
  cleanupQueueFixture,
};
