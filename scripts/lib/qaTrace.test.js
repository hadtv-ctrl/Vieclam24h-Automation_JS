const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildTraceReport, rankAutomationCandidates, stripCodeBlocks, assessChangeSet,
} = require('./qaTrace');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-trace-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const kinds = (report, kind) => report.findings.filter((f) => f.kind === kind).map((f) => f.id);
const majors = (report) => report.findings.filter((f) => f.severity === 'major');

const REQ_DOC = `# REQ-001 Đăng nhập

- AC-001: Given người dùng hợp lệ, When đăng nhập, Then vào được trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
`;

const TC_DOC = `# Test Cases: REQ-001

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | x | P0 |
| REQ-001 | AC-002 | TC-002 | Candidate | - | P1 |
`;

const SPEC_OK = `const { test } = require('../../core/fixtures/baseTest');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 vào được trang chủ @smoke', async () => { expect(1).toBe(1); });
});
`;

test('repo chưa có tài liệu: báo bootstrap, không dựng cờ major', () => {
  withRepo({ 'tests/e2e/a.spec.js': SPEC_OK }, (root) => {
    const r = buildTraceReport({ root });
    assert.equal(r.bootstrap, true);
    assert.equal(r.counts.specs, 1);
    assert.equal(majors(r).length, 0, 'chưa có tài liệu thì không thể coi là vi phạm');
  });
});

test('chuỗi đầy đủ REQ -> AC -> TC -> spec: không còn nợ mức major', () => {
  withRepo({
    'requirements/REQ-001-dang-nhap.md': REQ_DOC,
    'test-cases/REQ-001-dang-nhap.md': TC_DOC.replace('| Candidate | - | P1 |', '| Yes | x | P1 |'),
    'tests/e2e/login.spec.js': `const { test } = require('x');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 vào được trang chủ @smoke', async () => { expect(1).toBe(1); });
  test('TC-002 - AC-002 hiện lỗi chung @smoke', async () => { expect(1).toBe(1); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.equal(r.bootstrap, false);
    assert.deepEqual(kinds(r, 'ac-khong-co-tc'), []);
    assert.deepEqual(kinds(r, 'tc-chua-automation'), []);
    assert.equal(majors(r).length, 0);
  });
});

test('AC đã ghi nhận mà chưa ai thiết kế test case -> major', () => {
  withRepo({
    'requirements/REQ-001.md': `${REQ_DOC}- AC-003: Given khoá tài khoản, Then chặn đăng nhập.\n`,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'ac-khong-co-tc'), ['AC-003']);
    assert.ok(majors(r).some((f) => f.id === 'AC-003'));
  });
});

test('TC chưa có script trở thành ứng viên automation, P0/P1 là major', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'tc-chua-automation'), ['TC-002']);
    assert.deepEqual(r.candidates.map((c) => c.id), ['TC-002']);
    assert.equal(r.candidates[0].priority, 'P1');
    assert.equal(r.candidates[0].acs[0], 'AC-002');
    assert.ok(majors(r).some((f) => f.id === 'TC-002'));
  });
});

test('TC khai rõ không automation là quyết định có chủ ý, không tính là nợ', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC.replace('| Candidate | - | P1 |', '| No | - | P1 |'),
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'tc-co-y-thu-cong'), ['TC-002']);
    assert.deepEqual(kinds(r, 'tc-chua-automation'), []);
    assert.deepEqual(r.candidates, [], 'không đề xuất automation thứ đã chốt là thủ công');
    assert.equal(majors(r).length, 0);
  });
});

test('spec không gắn @REQ khi tài liệu đã tồn tại -> major (nguy cơ missing business)', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/orphan.spec.js': `const { test } = require('x');
test.describe('Không gắn gì cả', () => {
  test('làm một việc gì đó @smoke', async () => { expect(1).toBe(1); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.equal(kinds(r, 'spec-khong-truy-vet').length, 1);
    assert.ok(majors(r).some((f) => f.kind === 'spec-khong-truy-vet'));
  });
});

test('spec trỏ tới định danh không tồn tại trong tài liệu -> major', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/ghost.spec.js': `const { test } = require('x');
test.describe('Ma @REQ-404', () => {
  test('TC-404 - AC-001 không có thật @smoke', async () => { expect(1).toBe(1); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    const ids = kinds(r, 'dinh-danh-khong-ton-tai');
    assert.ok(ids.includes('REQ-404'));
    assert.ok(ids.includes('TC-404'));
  });
});

test('gộp dữ liệu TC từ nhiều file, không để file đọc trước ghi đè', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    // Tên file automation-plan sắp xếp TRƯỚC file chính -> trước đây nó thắng và nuốt mất AC/priority.
    'test-cases/REQ-001.automation-plan.md': '# Plan\n\n- TC-002 điểm 18/25, dự kiến sprint tới.\n',
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    const tc2 = r.testCases.find((t) => t.id === 'TC-002');
    assert.equal(tc2.priority, 'P1');
    assert.deepEqual(tc2.acs, ['AC-002']);
    assert.equal(tc2.files.length, 2);
  });
});

test('định danh nằm trong khối code của tài liệu không bị tính', () => {
  const text = 'Thật: AC-001\n```\nVí dụ: AC-999 TC-999\n```\nInline: `REQ-888`\n';
  const stripped = stripCodeBlocks(text);
  assert.ok(stripped.includes('AC-001'));
  assert.ok(!stripped.includes('AC-999'));
  assert.ok(!stripped.includes('REQ-888'));
});

test('xếp hạng ứng viên: P0 trước, và tôn trọng giới hạn', () => {
  const report = {
    candidates: [
      { id: 'TC-003', priority: 'P2', acs: [], file: 'f' },
      { id: 'TC-001', priority: 'P0', acs: [], file: 'f' },
      { id: 'TC-002', priority: 'P1', acs: [], file: 'f' },
      { id: 'TC-004', priority: null, acs: [], file: 'f' },
    ],
  };
  assert.deepEqual(rankAutomationCandidates(report).map((c) => c.id), ['TC-001', 'TC-002', 'TC-003', 'TC-004']);
  assert.equal(rankAutomationCandidates(report, 2).length, 2);
});

test('công cụ chỉ đọc: không tạo hay sửa file nào trong repo', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const snapshot = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile()).map((e) => path.join(e.parentPath || e.path, e.name)).sort();
    const before = snapshot(root);
    buildTraceReport({ root });
    assert.deepEqual(snapshot(root), before);
  });
});

// --- Khắc phục hạn chế 1: parser phải tự thú khi không đọc được tài liệu ---

test('file tài liệu không có định danh nào -> báo KHÔNG ĐỌC ĐƯỢC, không im lặng bỏ qua', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'requirements/ghi-chu-nghiep-vu.md': '# Luồng thanh toán\n\nMô tả dài nhưng quên đánh mã.\n',
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'tai-lieu-khong-doc-duoc'), ['requirements/ghi-chu-nghiep-vu.md']);
    assert.ok(majors(r).some((f) => f.kind === 'tai-lieu-khong-doc-duoc'));
  });
});

test('định danh gần đúng nhưng sai quy ước bị bắt, không bị bỏ qua âm thầm', () => {
  withRepo({
    'requirements/REQ-001.md': `${REQ_DOC}\n- REQ-1 và AC_007 và tc-003 và TC-0001 là sai quy ước.\n`,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    const f = r.findings.find((x) => x.kind === 'dinh-danh-sai-quy-uoc');
    assert.ok(f, 'phải báo định danh sai quy ước');
    for (const bad of ['REQ-1', 'AC_007', 'tc-003', 'TC-0001']) {
      assert.ok(f.detail.includes(bad), `thiếu ${bad}`);
    }
    assert.equal(f.severity, 'major');
  });
});

test('tài liệu đúng quy ước hoàn toàn thì không báo sai quy ước', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'dinh-danh-sai-quy-uoc'), []);
    assert.deepEqual(kinds(r, 'tai-lieu-khong-doc-duoc'), []);
  });
});

test('requirement không có acceptance criterion nào -> major', () => {
  withRepo({
    'requirements/REQ-002.md': '# REQ-002 Thanh toán\n\nMô tả nghiệp vụ nhưng chưa chốt điều kiện nào.\n',
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'req-thieu-ac'), ['REQ-002']);
  });
});

// --- Khắc phục hạn chế 2: kiểm được phần nội dung mà máy kiểm được ---

test('test khai phủ AC nhưng không có assertion -> major', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/rong.spec.js': `const { test } = require('x');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 chỉ click rồi thôi @smoke', async ({ page }) => {
    await page.goto('/');
  });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    const f = r.findings.find((x) => x.kind === 'test-khong-co-assertion');
    assert.ok(f, 'phải bắt được test không assertion');
    assert.equal(f.severity, 'major');
  });
});

test('test không khai TC/AC thì không bị đòi assertion (tránh kêu oan ở repo chưa truy vết)', () => {
  withRepo({
    'tests/e2e/cu.spec.js': `const { test } = require('x');
test.describe('Luồng cũ', () => {
  test('làm gì đó @smoke', async ({ page }) => { await page.goto('/'); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.deepEqual(kinds(r, 'test-khong-co-assertion'), []);
  });
});

test('spec và tài liệu nói khác nhau về AC mà TC đó phủ -> major', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/lech.spec.js': `const { test } = require('x');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-002 gán nhầm AC @smoke', async () => { expect(1).toBe(1); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    const f = r.findings.find((x) => x.kind === 'ac-lech-giua-tai-lieu-va-spec');
    assert.ok(f, 'phải bắt được lệch AC');
    assert.ok(f.detail.includes('AC-002'));
    assert.ok(f.detail.includes('AC-001'));
  });
});

// --- Khắc phục hạn chế 3: bắt việc viết script mà không ghi nhận nghiệp vụ, ngay tại lúc thay đổi ---

test('spec vừa sửa mà không gắn @REQ -> major', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/moi.spec.js': `const { test } = require('x');
test.describe('Luồng mới', () => {
  test('làm gì đó @smoke', async () => { expect(1).toBe(1); });
});
`,
  }, (root) => {
    const r = buildTraceReport({ root });
    const c = assessChangeSet(r, ['tests/e2e/moi.spec.js']);
    assert.deepEqual(c.findings.filter((f) => f.kind === 'spec-vua-sua-khong-truy-vet').map((f) => f.id),
      ['tests/e2e/moi.spec.js']);
  });
});

test('sửa spec mà không đụng tài liệu -> nhắc ở mức minor, không chặn', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    const c = assessChangeSet(r, ['tests/e2e/login.spec.js']);
    const f = c.findings.find((x) => x.kind === 'sua-script-ma-khong-dong-tai-lieu');
    assert.ok(f);
    assert.equal(f.severity, 'minor', 'sửa locator hỏng không nên bị chặn như lỗi nghiêm trọng');
  });
});

test('sửa spec kèm cập nhật tài liệu -> không nhắc gì', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    const c = assessChangeSet(r, ['tests/e2e/login.spec.js', 'test-cases/REQ-001.md']);
    assert.deepEqual(c.findings.filter((x) => x.kind === 'sua-script-ma-khong-dong-tai-lieu'), []);
  });
});

test('thay đổi không liên quan tới spec thì không sinh finding nào', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    const c = assessChangeSet(r, ['README.md', 'package.json']);
    assert.deepEqual(c.findings, []);
    assert.deepEqual(c.changedSpecs, []);
  });
});

test('spec đã bị xoá khỏi cây thư mục thì bỏ qua, không nổ', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': TC_DOC,
    'tests/e2e/login.spec.js': SPEC_OK,
  }, (root) => {
    const r = buildTraceReport({ root });
    assert.doesNotThrow(() => assessChangeSet(r, ['tests/e2e/da-xoa.spec.js']));
  });
});
