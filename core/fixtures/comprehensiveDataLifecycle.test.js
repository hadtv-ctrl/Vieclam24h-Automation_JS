const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { CleanupRegistry, cleanupQueueFixture } = require('./cleanupRegistry');
const { loadCustomFixtures } = require('./custom');
const {
  scanAllFixtures,
  createCustomFixture,
  deleteCustomFixture,
} = require('../generator/objectRepository');

const ROOT = path.resolve(__dirname, '../..');
const TEMP_DATA_DIR = path.join(ROOT, 'data', 'temp_test_datasets');

test.describe('Phân Hệ Quản Lý Fixture & Dọn Dẹp Data Toàn Diện (Coverage Test Cases)', () => {
  test.before(() => {
    if (!fs.existsSync(TEMP_DATA_DIR)) {
      fs.mkdirSync(TEMP_DATA_DIR, { recursive: true });
    }
  });

  test.after(() => {
    // Dọn dẹp toàn bộ dữ liệu test tạm thời sau khi kết thúc quá trình test
    if (fs.existsSync(TEMP_DATA_DIR)) {
      fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
    }
  });

  test('Case 1: Vòng đời đơn lẻ - Khởi tạo dữ liệu và dọn dẹp an toàn', async () => {
    const registry = new CleanupRegistry();
    let cleaned = false;
    const testData = { id: 'usr_001', name: 'Nguyen Van A', role: 'Candidate' };

    registry.register(async () => {
      cleaned = true;
    });

    assert.strictEqual(cleaned, false);
    await registry.runAll();
    assert.strictEqual(cleaned, true);
  });

  test('Case 2: Cấu trúc phụ thuộc nhiều tầng (LIFO: Organization -> Project -> User -> File)', async () => {
    const registry = new CleanupRegistry();
    const executionOrder = [];

    // Tạo theo thứ tự: Org -> Project -> User -> File
    registry.register(async () => executionOrder.push('DELETE_ORG'));
    registry.register(async () => executionOrder.push('DELETE_PROJECT'));
    registry.register(async () => executionOrder.push('DELETE_USER'));
    registry.register(async () => executionOrder.push('DELETE_FILE'));

    await registry.runAll();

    // Phải dọn dẹp theo LIFO: File -> User -> Project -> Org
    assert.deepStrictEqual(executionOrder, [
      'DELETE_FILE',
      'DELETE_USER',
      'DELETE_PROJECT',
      'DELETE_ORG',
    ]);
  });

  test('Case 3: Cô lập lỗi - Tác vụ ở giữa ném lỗi 500 mạng nhưng các tác vụ còn lại vẫn dọn dẹp đầy đủ', async () => {
    const registry = new CleanupRegistry();
    const cleanedItems = [];

    registry.register(async () => cleanedItems.push('TASK_1_CLEANED'));
    registry.register(async () => {
      throw new Error('API 500 Network Timeout Error khi xóa User!');
    });
    registry.register(async () => cleanedItems.push('TASK_3_CLEANED'));

    const errors = await registry.runAll();

    // Lỗi được thu thập mà không làm gián đoạn
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /500 Network Timeout/);
    // Task 3 (chạy trước vì LIFO) và Task 1 vẫn được hoàn tất
    assert.deepStrictEqual(cleanedItems, ['TASK_3_CLEANED', 'TASK_1_CLEANED']);
  });

  test('Case 4: Hỗ trợ cả 2 cú pháp gọi hàm cleanupQueue(fn) và cleanupQueue.register(fn)', async () => {
    let resultDirect = false;
    let resultMethod = false;

    await cleanupQueueFixture({}, async (cleanupQueue) => {
      cleanupQueue(async () => {
        resultDirect = true;
      });
      cleanupQueue.register(async () => {
        resultMethod = true;
      });
    });

    assert.strictEqual(resultDirect, true);
    assert.strictEqual(resultMethod, true);
  });

  test('Case 5: Hàng đợi rỗng (Empty Queue) không gây lỗi ngoại lệ', async () => {
    const registry = new CleanupRegistry();
    const errors = await registry.runAll();
    assert.deepStrictEqual(errors, []);
  });

  test('Case 6: Xử lý dataset JSON phức tạp với nhiều kiểu dữ liệu (Data Precondition)', async () => {
    // Tạo file data test tạm thời
    const tempFilePath = path.join(TEMP_DATA_DIR, 'test_candidates.json');
    const mockCandidates = [
      { id: 101, email: 'candidate1@test.com', status: 'interviewing', score: 8.5 },
      { id: 102, email: 'candidate2@test.com', status: 'offered', score: 9.2 },
      { id: 103, email: 'candidate3@test.com', status: 'rejected', score: 6.0 },
    ];
    fs.writeFileSync(tempFilePath, JSON.stringify(mockCandidates, null, 2), 'utf8');

    const readData = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
    assert.strictEqual(readData.length, 3);
    assert.strictEqual(readData[1].score, 9.2);

    // Xóa file test tạm thời
    fs.unlinkSync(tempFilePath);
    assert.strictEqual(fs.existsSync(tempFilePath), false);
  });

  test('Case 7: Tạo, quét, nạp động và xóa Custom Fixtures qua API Generator', async () => {
    const fixtureName = 'tempOrderCleanupTest';

    // 1. Tạo custom fixture qua template API
    const result = createCustomFixture({
      name: fixtureName,
      template: 'cleanup_api',
      config: {
        description: 'Tự tạo đơn hàng và tự hủy sau test',
        deleteEndpoint: '/api/v1/orders/${id}',
        deleteMethod: 'DELETE',
      },
    }, ROOT);
    const createdFullPath = path.join(ROOT, result.relativePath);
    assert.strictEqual(result.success, true);
    assert.strictEqual(fs.existsSync(createdFullPath), true);

    // 2. Quét fixtures: Phải nhận diện được fixture mới này
    const scanned = scanAllFixtures(ROOT);
    const found = scanned.find((f) => f.name === fixtureName);
    assert.ok(found);
    assert.strictEqual(found.isCustom, true);
    assert.strictEqual(found.canDelete, true);

    // 3. Nạp động (Dynamic Loader)
    const customRegistry = loadCustomFixtures(path.join(ROOT, 'core', 'fixtures', 'custom'));
    assert.ok(typeof customRegistry[fixtureName] === 'function');

    // 4. Xóa fixture kiểm thử tạm thời để giữ hệ thống sạch sẽ
    const deleteResult = deleteCustomFixture(fixtureName, ROOT);
    assert.strictEqual(deleteResult.success, true);
    assert.strictEqual(fs.existsSync(createdFullPath), false);
  });

  test('Case 8: Chặn tạo fixture có lỗi cú pháp hoặc trùng tên hệ thống (Reserved Collision Guard)', () => {
    // Lỗi cú pháp
    assert.throws(() => {
      createCustomFixture({
        name: 'invalidSyntaxFixture',
        template: 'custom_code',
        rawCode: 'module.exports = { broken: async ( => { } };',
      }, ROOT);
    }, /Mã nguồn fixture có lỗi cú pháp/);

    // Trùng tên hệ thống
    assert.throws(() => {
      createCustomFixture({
        name: 'pages',
        template: 'cleanup_api',
        config: {},
      }, ROOT);
    }, /trùng với từ khóa hoặc Core Fixture/);

    assert.throws(() => {
      createCustomFixture({
        name: 'cleanupQueue',
        template: 'cleanup_api',
        config: {},
      }, ROOT);
    }, /trùng với từ khóa hoặc Core Fixture/);
  });
});
