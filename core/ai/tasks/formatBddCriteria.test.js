const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBddPrompts, runFormatBddCriteria, BDD_SCHEMA } = require('./formatBddCriteria');

test('TC-09: buildBddPrompts chua luat giu nguyen ma AC, schema va danh sach AC', async () => {
  const acs = [
    { id: 'AC-001', title: 'Đăng nhập thành công' },
    { id: 'AC-002', title: 'Đăng nhập sai quá 5 lần' }
  ];
  const requirementText = 'Đặc tả yêu cầu đăng nhập hệ thống.';

  const messages = buildBddPrompts({ requirementText, acs });

  assert.equal(Array.isArray(messages), true);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');

  const systemText = messages[0].content;
  const userText = messages[1].content;

  // Bắt buộc chứa quy tắc giữ nguyên mã AC (bảo vệ bất biến INV-3, D4)
  assert.match(systemText, /giữ nguyên mã AC/i);
  assert.match(systemText, /acId:\s*null/i);

  // User prompt phải chứa danh sách AC và nội dung yêu cầu
  assert.ok(userText.includes('AC-001'));
  assert.ok(userText.includes('AC-002'));
  assert.ok(userText.includes(requirementText));

  // Kiểm tra cấu trúc BDD_SCHEMA
  assert.equal(BDD_SCHEMA.type, 'object');
  assert.ok(BDD_SCHEMA.required.includes('scenarios'));
  assert.ok(BDD_SCHEMA.properties.scenarios.items.required.includes('given'));
  assert.ok(BDD_SCHEMA.properties.scenarios.items.required.includes('when'));
  assert.ok(BDD_SCHEMA.properties.scenarios.items.required.includes('then'));

  // Kiểm tra bảo vệ kích thước đầu vào (BR-19B-06)
  const emptyRes = await runFormatBddCriteria({ requirementText: '   ' });
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.code, 'EMPTY_TEXT');

  const longText = 'x'.repeat(8001);
  const longRes = await runFormatBddCriteria({ requirementText: longText });
  assert.equal(longRes.ok, false);
  assert.equal(longRes.code, 'TEXT_TOO_LONG');
});
