/**
 * Cleanup Registry Helper
 * Cung cấp hàng đợi tác vụ dọn dẹp dữ liệu (Teardown Tasks) fail-safe cho Playwright tests.
 * Các tác vụ đã đăng ký luôn được thực thi theo thứ tự LIFO trong khối finally.
 * Chính sách: Nếu test PASS nhưng dọn dẹp mandatory FAIL -> đánh dấu TeardownFailureError để chống leak data.
 */

class TeardownFailureError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'TeardownFailureError';
    this.cleanupErrors = errors;
  }
}

class CleanupRegistry {
  constructor() {
    this.tasks = [];
    this.isRunning = false;
  }

  /**
   * Đăng ký một hàm dọn dẹp với metadata tùy chọn
   * @param {() => Promise<void> | void} taskFn
   * @param {{ label?: string, resourceId?: string|number, timeoutMs?: number }} [options]
   */
  register(taskFn, options = {}) {
    if (typeof taskFn !== 'function') {
      throw new Error(`[CleanupRegistry] Tham số taskFn phải là một hàm (function). Nhận được: ${typeof taskFn}`);
    }
    const taskObj = {
      fn: taskFn,
      label: options.label || 'cleanup_task',
      resourceId: options.resourceId || null,
      timeoutMs: Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000,
    };
    this.tasks.push(taskObj);
    return taskObj;
  }

  /**
   * Thực thi toàn bộ tác vụ dọn dẹp theo thứ tự LIFO (tác vụ đăng ký sau dọn trước)
   * Chống re-entry, bảo đảm timeout và trả về danh sách errors
   * @returns {Promise<Array<Error>>}
   */
  async runAll() {
    if (this.isRunning) return [];
    this.isRunning = true;
    const errors = [];
    const totalCount = this.tasks.length;
    let passedCount = 0;

    try {
      while (this.tasks.length > 0) {
        const task = this.tasks.pop();
        let timer = null;
        try {
          const timeoutMs = task.timeoutMs || 10000;
          await Promise.race([
            Promise.resolve(task.fn()),
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                reject(new Error(`Tác vụ cleanup '${task.label}' bị timeout sau ${timeoutMs}ms`));
              }, timeoutMs);
              if (timer.unref) timer.unref();
            }),
          ]);
          passedCount++;
        } catch (err) {
          err.label = task.label;
          err.resourceId = task.resourceId;
          errors.push(err);
          console.warn(`[CleanupRegistry Warning] Lỗi khi thực hiện dọn dẹp: ${err.message}`);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
    } finally {
      this.isRunning = false;
    }

    this.lastSummary = {
      total: totalCount,
      passed: passedCount,
      failed: errors.length,
    };
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
   * cleanupQueue(async () => { await api.deleteUser(id); }, { label: 'Xóa user test', resourceId: id })
   */
  const registerFn = (taskFn, options) => registry.register(taskFn, options);
  registerFn.register = (taskFn, options) => registry.register(taskFn, options);
  registerFn.registry = registry;

  let testFailed = false;
  try {
    await use(registerFn);
  } catch (testErr) {
    testFailed = true;
    throw testErr;
  } finally {
    const errors = await registry.runAll();
    if (errors.length > 0) {
      const errorDetails = errors
        .map((e) => `[${e.label || 'cleanup_task'}${e.resourceId ? ` (ID: ${e.resourceId})` : ''}]: ${e.message}`)
        .join('; ');

      if (!testFailed) {
        // Test chính PASS nhưng cleanup FAIL -> đánh dấu test FAIL để tránh rò rỉ dữ liệu
        throw new TeardownFailureError(
          `[CleanupQueue Teardown Failure] Kịch bản chính thành công nhưng dọn dẹp thất bại (${errors.length} lỗi): ${errorDetails}`,
          errors
        );
      } else {
        // Test chính đã fail -> giữ nguyên lỗi test và log cảnh báo lỗi dọn dẹp bổ sung
        console.error(`[CleanupQueue Warning] Kịch bản đã fail và phát hiện thêm ${errors.length} lỗi dọn dẹp: ${errorDetails}`);
      }
    }
  }
};

module.exports = {
  CleanupRegistry,
  TeardownFailureError,
  cleanupQueueFixture,
};
