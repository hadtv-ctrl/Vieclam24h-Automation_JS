/**
 * dashboard/services/qaService.test.js
 * Unit test cho qaService. Không dựng HTTP server — chỉ gọi hàm thuần trên thư mục tạm.
 *
 * Chạy tay: node --test dashboard/services/qaService.test.js
 * Lưu ý: `npm test` của repo này chạy Playwright, KHÔNG nhặt file *.test.js kiểu node:test.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getTrace, getCandidates, getDecisions, saveDecisionAnswer, readQaConfig, isAnswered,
} = require('./qaService');

// scripts/lib/sync-manifest.js là công cụ vận hành RIÊNG CỦA HUB nên nằm trong excludes,
// trong khi file test này thì được sync. Soft-require để bài test mô phỏng sync tự bỏ qua
// khi chạy ở vệ tinh, thay vì ném MODULE_NOT_FOUND.
let syncManifest = null;
try {
  // eslint-disable-next-line global-require
  syncManifest = require('../../scripts/lib/sync-manifest');
} catch (_) { /* Chỉ tồn tại ở Hub */ }

const REQ_DOC = `# REQ-001 Đăng nhập

- AC-001: Given hợp lệ, Then vào được.
- AC-002: Given sai mật khẩu, Then báo lỗi chung.
`;

const TC_DOC = `# Test Cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | x | P0 |
| REQ-001 | AC-002 | TC-002 | Candidate | - | P1 |
`;

const SPEC = `const { test, expect } = require('x');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 ok @smoke', async () => { expect(1).toBe(1); });
});
`;

function makeRepo(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-service-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

const FULL = {
  'requirements/REQ-001.md': REQ_DOC,
  'test-cases/REQ-001.md': TC_DOC,
  'tests/e2e/login.spec.js': SPEC,
};

test('repo trống trả bootstrap, không ném lỗi', () => {
  withRepo({}, (root) => {
    const r = getTrace(root);
    assert.equal(r.available, true);
    assert.equal(r.bootstrap, true);
    assert.equal(r.counts.requirements, 0);
    assert.deepEqual(r.requirements, []);
  });
});

test('trace tính đúng số đếm và gắn nhãn tiếng Việt cho mọi finding', () => {
  withRepo(FULL, (root) => {
    const r = getTrace(root);
    assert.equal(r.bootstrap, false);
    assert.equal(r.counts.requirements, 1);
    assert.equal(r.counts.acceptanceCriteria, 2);
    assert.equal(r.counts.testCases, 2);
    assert.equal(r.requirements[0].tcCount, 2);
    for (const f of [...r.findings.major, ...r.findings.minor, ...r.findings.info]) {
      assert.ok(f.label, `finding ${f.kind} thiếu nhãn`);
      assert.notEqual(f.label, f.kind, `finding ${f.kind} chưa được dịch`);
    }
  });
});

test('"đã automation" đếm theo TC xuất hiện trong spec, KHÔNG theo cột automation của tài liệu', () => {
  // TC-002 khai "Candidate" nhưng không spec nào tham chiếu -> chưa automation.
  // Nếu đảo lại: TC khai "Yes" mà không có spec thì vẫn phải là ứng viên.
  withRepo({
    ...FULL,
    'test-cases/REQ-001.md': TC_DOC.replace('| Candidate | - | P1 |', '| Yes | - | P1 |'),
  }, (root) => {
    const r = getTrace(root);
    assert.equal(r.automatedCount, 1, 'chỉ TC-001 thực sự có trong spec');
    const c = getCandidates(root);
    assert.deepEqual(c.candidates.map((x) => x.id), ['TC-002'], 'khai Yes mà không có spec vẫn là nợ');
  });
});

test('ứng viên được xếp P0 trước và tôn trọng limit', () => {
  withRepo({
    'requirements/REQ-001.md': REQ_DOC,
    'test-cases/REQ-001.md': `${TC_DOC}| REQ-001 | AC-001 | TC-003 | Candidate | - | P0 |\n`,
    'tests/e2e/login.spec.js': SPEC,
  }, (root) => {
    const all = getCandidates(root, 10);
    assert.deepEqual(all.candidates.map((x) => x.id), ['TC-003', 'TC-002']);
    assert.equal(getCandidates(root, 1).candidates.length, 1);
    assert.equal(getCandidates(root, 1).total, 2, 'total là tổng thật, không phải số sau khi cắt');
  });
});

test('đọc thư mục spec theo config riêng của repo, không hard-code', () => {
  withRepo({
    ...FULL,
    'core/config/dashboardConfig.json': JSON.stringify({
      environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com' } },
      runtime: { defaultEnvironment: 'qc' },
      qa: { specs: 'tests/e2e' },
    }),
  }, (root) => {
    const cfg = readQaConfig(root);
    assert.equal(cfg.dirs.specs, 'tests/e2e');
    assert.equal(getTrace(root).dirs.specs, 'tests/e2e');
  });
});

test('config trỏ sai thư mục spec phải bật cờ cảnh báo, không im lặng báo sạch', () => {
  withRepo({
    ...FULL,
    'core/config/dashboardConfig.json': JSON.stringify({
      environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com' } },
      runtime: { defaultEnvironment: 'qc' },
      qa: { specs: 'khong-ton-tai' },
    }),
  }, (root) => {
    const r = getTrace(root);
    assert.equal(r.counts.specs, 0);
    assert.equal(r.specsDirEmpty, true, 'phải cảnh báo, vì 0 spec trông y hệt "đã sạch"');
  });
});

test('config hỏng không làm chết mục QA', () => {
  withRepo({ ...FULL, 'core/config/dashboardConfig.json': '{ khong phai json' }, (root) => {
    const r = getTrace(root);
    assert.equal(r.available, true);
    assert.equal(r.dirs.specs, 'tests');
  });
});

test('thiếu decisions.json là trạng thái rỗng, không phải lỗi', () => {
  withRepo(FULL, (root) => {
    const d = getDecisions(root);
    assert.equal(d.exists, false);
    assert.deepEqual(d.decisions, []);
  });
});

const DECISIONS = {
  version: 7,
  severityOrder: ['blocking'],
  decisions: [{
    id: 'D-01',
    title: 'Chọn một',
    severity: 'blocking',
    options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    recommended: 'a',
    status: 'pending',
    answer: { optionId: null, note: 'gợi ý điền', confirmedBy: '', confirmedAt: '' },
  }],
};

test('ghi answer chỉ đụng đúng quyết định đó, phần còn lại của file nguyên vẹn', () => {
  withRepo({ ...FULL, 'decisions.json': `${JSON.stringify(DECISIONS, null, 2)}\n` }, (root) => {
    const res = saveDecisionAnswer(root, { id: 'D-01', optionId: 'a', note: 'chốt', confirmedBy: 'Hà' });
    assert.equal(res.decision.answered, true);
    assert.equal(res.decision.status, 'answered');
    assert.ok(res.backup, 'phải sao lưu trước khi ghi');

    const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'decisions.json'), 'utf8'));
    assert.equal(onDisk.version, 7);
    assert.deepEqual(onDisk.severityOrder, ['blocking']);
    assert.equal(onDisk.decisions[0].title, 'Chọn một');
    assert.equal(onDisk.decisions[0].recommended, 'a');
    assert.equal(onDisk.decisions[0].answer.confirmedBy, 'Hà');
  });
});

test('chọn phương án mà không ký tên thì vẫn là chưa trả lời', () => {
  withRepo({ ...FULL, 'decisions.json': `${JSON.stringify(DECISIONS, null, 2)}\n` }, (root) => {
    const res = saveDecisionAnswer(root, { id: 'D-01', optionId: 'b', confirmedBy: '  ' });
    assert.equal(res.decision.answered, false);
    assert.equal(res.decision.status, 'pending');
    assert.equal(res.decision.answer.confirmedAt, '');
  });
});

test('từ chối phương án lạ và mã quyết định lạ', () => {
  withRepo({ ...FULL, 'decisions.json': `${JSON.stringify(DECISIONS, null, 2)}\n` }, (root) => {
    assert.throws(() => saveDecisionAnswer(root, { id: 'D-01', optionId: 'z', confirmedBy: 'Hà' }), /không thuộc/);
    assert.throws(() => saveDecisionAnswer(root, { id: 'D-99', optionId: 'a', confirmedBy: 'Hà' }), /D-99/);
    assert.throws(() => saveDecisionAnswer(root, { optionId: 'a' }), /Thiếu mã/);
  });
});

test('isAnswered đòi CẢ optionId lẫn người ký', () => {
  assert.equal(isAnswered({ answer: { optionId: 'a', confirmedBy: 'Hà' } }), true);
  assert.equal(isAnswered({ answer: { optionId: 'a', confirmedBy: '' } }), false);
  assert.equal(isAnswered({ answer: { optionId: null, confirmedBy: 'Hà' } }), false);
  assert.equal(isAnswered({}), false);
});

test('mục QA không ghi gì vào requirements/ và test-cases/', () => {
  withRepo({ ...FULL, 'decisions.json': `${JSON.stringify(DECISIONS, null, 2)}\n` }, (root) => {
    const snap = () => ['requirements', 'test-cases'].flatMap((d) => fs.readdirSync(path.join(root, d))
      .map((f) => `${d}/${f}:${fs.readFileSync(path.join(root, d, f), 'utf8').length}`)).sort();
    const before = snap();
    getTrace(root);
    getCandidates(root);
    saveDecisionAnswer(root, { id: 'D-01', optionId: 'a', confirmedBy: 'Hà' });
    assert.deepEqual(snap(), before);
  });
});

test('cấu hình riêng trong core/config/dashboardConfig.json sống sót qua một lượt sync mô phỏng', {
  skip: syncManifest ? false : 'scripts/lib/sync-manifest.js chỉ tồn tại ở Hub (nằm trong excludes)',
}, () => {
  withRepo({
    ...FULL,
    'core/config/dashboardConfig.json': JSON.stringify({
      environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com' } },
      runtime: { defaultEnvironment: 'qc' },
      qa: { specs: 'tests/e2e' },
    }, null, 2),
  }, (root) => {
    const { MODULES_TO_SYNC, resolveExcludes, isExcluded } = syncManifest;
    const coreModule = MODULES_TO_SYNC.find((m) => m.src === 'core');
    const excludes = resolveExcludes(root, coreModule);
    const target = path.join(root, 'core', 'config', 'dashboardConfig.json');

    assert.equal(isExcluded(target, excludes), true, 'config riêng phải nằm ngoài vùng Hub ghi đè');

    const before = fs.readFileSync(target, 'utf8');
    // Mô phỏng sync: chỉ ghi những đường dẫn KHÔNG bị loại trừ.
    if (!isExcluded(target, excludes)) fs.writeFileSync(target, '{"ghi de boi hub":true}', 'utf8');
    assert.equal(fs.readFileSync(target, 'utf8'), before);
    assert.equal(getTrace(root).dirs.specs, 'tests/e2e');
  });
});
