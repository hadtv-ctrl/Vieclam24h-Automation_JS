/**
 * @title Fixture Tu Tuy Chon
 * @description Custom Fixture testFixture
 * @category Dọn dẹp & Teardown
 */
const testFixture = async ({ request }, use, testInfo) => {
  // Dữ liệu ngữ cảnh khởi tạo trước test (Setup)
  const context = {
    id: null,
    targetUrl: '/api/users/:id',
    payload: null,
  };

  try {
    // Bàn giao context cho kịch bản test thực thi
    await use(context);
  } finally {
    // Tự động dọn dẹp sau khi test kết thúc (Teardown fail-safe)
    await testInfo.attach('teardown_log', {
      body: `Bắt đầu dọn dẹp qua API: ${context.targetUrl}`,
      contentType: 'text/plain'
    });
    try {
      if (context.id) {
        const deleteEndpoint = context.targetUrl.replace(/:id/g, context.id);
        const res = await request.delete(deleteEndpoint, {
          headers: {}
        });
        if (res && typeof res.ok === 'function' && !res.ok()) {
          throw new Error(`API teardown thất bại với mã lỗi HTTP ${res.status()}`);
        }
        console.log(`[Teardown ${'testFixture'}] Đã xóa thành công resource ID: ${context.id}`);
      }
    } catch (err) {
      console.warn(`[Teardown ${'testFixture'} Warning] Không thể xóa resource: ${err.message}`);
      throw err;
    }
  }
};

module.exports = { testFixture };
