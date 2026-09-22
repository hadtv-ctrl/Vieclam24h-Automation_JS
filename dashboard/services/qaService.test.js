'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  getQaSummary,
  runQaFix,
  getScaffoldMeta,
  generateScaffold,
  getRequirementImpact,
  deleteRequirement,
} = require('./qaService');
const { extractScaffoldFromRaw } = require('./qaInferenceService');

test('getQaSummary: trả về đúng JSON 1.0.0 với đầy đủ metrics, health, boundary, decisions, findings', () => {
  const summary = getQaSummary(process.cwd());
  assert.equal(summary.schemaVersion, '1.0.0');
  assert.ok(['HEALTHY', 'WARNING', 'CRITICAL'].includes(summary.systemHealth));
  assert.ok(summary.metrics && typeof summary.metrics === 'object');
  assert.equal(typeof summary.metrics.requirements, 'number');
  assert.equal(typeof summary.metrics.acceptanceCriteria, 'number');
  assert.equal(typeof summary.metrics.coveragePercent, 'number');
  assert.ok(summary.health && typeof summary.health === 'object');
  assert.ok(summary.boundary && typeof summary.boundary === 'object');
  assert.ok(['ALIGNED', 'DRIFTED', 'MISSING'].includes(summary.boundary.status));
  assert.ok(summary.decisions && typeof summary.decisions === 'object');
  assert.ok(Array.isArray(summary.findings));
});

test('runQaFix: hỗ trợ dryRun: true và trả về cấu trúc kết quả hợp lệ', () => {
  const result = runQaFix(process.cwd(), { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(typeof result.reconciledLinks, 'number');
  assert.equal(typeof result.registeredCandidates, 'number');
  assert.equal(typeof result.updatedFiles, 'number');
  assert.ok(Array.isArray(result.changes));
});

test('getScaffoldMeta: trả về nextReqId dạng REQ-xxx và danh sách domains hợp lệ', () => {
  const meta = getScaffoldMeta(process.cwd());
  assert.ok(/^REQ-\d{3}$/.test(meta.nextReqId));
  assert.ok(Array.isArray(meta.existingDomains));
  assert.ok(meta.existingDomains.length > 0);
});

test('generateScaffold: tạo thành công 3 file trong thư mục tạm', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'playwright', 'tests', 'auth'), { recursive: true });

    const result = generateScaffold(tempDir, {
      reqId: 'REQ-101',
      title: 'Xác thực OTP',
      domain: 'auth',
      acCount: 2,
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'scaffold');
    assert.equal(result.created.length, 3);
    assert.ok(fs.existsSync(path.join(tempDir, result.created[0])));
    assert.ok(fs.existsSync(path.join(tempDir, result.created[1])));
    assert.ok(fs.existsSync(path.join(tempDir, result.created[2])));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('getQaSummary: Soft Fallback an toàn khi thư mục không có tools/qa', () => {
  const emptyTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-fallback-'));
  try {
    const summary = getQaSummary(emptyTemp);
    assert.equal(summary.schemaVersion, '1.0.0');
    assert.ok(summary.metrics);
    assert.ok(Array.isArray(summary.findings));
  } finally {
    fs.rmSync(emptyTemp, { recursive: true, force: true });
  }
});

test('getRequirementImpact: tìm đúng các file liên đới của REQ', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests', 'auth'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'requirements', 'REQ-099-test.md'), 'id: REQ-099\n# Test REQ');
    fs.writeFileSync(path.join(tempDir, 'test-cases', 'REQ-099-test.md'), '# TC for REQ-099');
    fs.writeFileSync(path.join(tempDir, 'tests', 'auth', 'test.spec.ts'), "test.describe('REQ-099', { tag: '@REQ-099' });");

    const impact = getRequirementImpact(tempDir, 'REQ-099');
    assert.equal(impact.reqId, 'REQ-099');
    assert.equal(impact.hasFiles, true);
    assert.equal(impact.files.requirements.length, 1);
    assert.equal(impact.files.testCases.length, 1);
    assert.equal(impact.files.specs.length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('deleteRequirement: xóa an toàn và tạo backup vào .dashboard-backups', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delete-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests', 'auth'), { recursive: true });

    const reqPath = path.join(tempDir, 'requirements', 'REQ-099-test.md');
    const tcPath = path.join(tempDir, 'test-cases', 'REQ-099-test.md');
    const specPath = path.join(tempDir, 'tests', 'auth', 'test.spec.ts');

    fs.writeFileSync(reqPath, 'id: REQ-099\n# Test REQ');
    fs.writeFileSync(tcPath, '# TC for REQ-099');
    fs.writeFileSync(specPath, "test.describe('REQ-099', { tag: '@REQ-099' });");

    const result = deleteRequirement(tempDir, {
      reqId: 'REQ-099',
      deleteTestCase: true,
      deleteSpec: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.deleted.length, 2);
    assert.ok(!fs.existsSync(reqPath));
    assert.ok(!fs.existsSync(tcPath));
    assert.ok(fs.existsSync(specPath)); // Spec được giữ lại do deleteSpec: false
    assert.equal(result.backups.length, 2);
    assert.ok(fs.existsSync(path.join(tempDir, result.backups[0].backup)));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extractScaffoldFromRaw: trích xuất chính xác từ Playwright script thô và tạo 3 files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-script-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests', 'e2e', 'desktop'), { recursive: true });

    const rawScript = `
import { test, expect } from '@playwright/test';

test.describe('Đổi mật khẩu người dùng @account', () => {
  test('Đổi mật khẩu thành công với mật khẩu mới hợp lệ', async ({ page }) => {
    await page.goto('/change-password');
    await page.fill('#old-pass', 'Old123456');
    await page.fill('#new-pass', 'New123456');
    await page.click('button#submit');
    await expect(page.locator('.toast')).toContainText('Thành công');
  });

  test('Báo lỗi khi mật khẩu cũ không đúng', async ({ page }) => {
    await page.goto('/change-password');
    await page.fill('#old-pass', 'WrongOld');
    await page.fill('#new-pass', 'New123456');
    await page.click('button#submit');
    await expect(page.locator('.error')).toContainText('Mật khẩu cũ không đúng');
  });
});
    `;

    const extracted = await extractScaffoldFromRaw(tempDir, {
      rawContent: rawScript,
      reqId: 'REQ-050',
      domain: 'account',
      useAi: false, // test heuristic
    });

    assert.equal(extracted.success, true);
    assert.equal(extracted.inputType, 'test_script');
    assert.equal(extracted.preview.reqId, 'REQ-050');
    assert.ok(extracted.preview.title.includes('Đổi mật khẩu'));
    assert.equal(extracted.preview.tcCount, 2);
    assert.equal(extracted.preview.acCount, 2);
    assert.ok(extracted.generated.reqContent.includes('REQ-050'));
    assert.ok(extracted.generated.tcContent.includes('TC-001'));
    assert.ok(extracted.generated.specContent.includes('test.describe'));

    // Test ghi 3 files qua generateScaffold mode raw_create
    const created = generateScaffold(tempDir, {
      mode: 'raw_create',
      reqId: extracted.preview.reqId,
      title: extracted.preview.title,
      slug: extracted.preview.slug,
      customFiles: extracted.generated,
    });

    assert.equal(created.ok, true);
    assert.equal(created.created.length, 3);
    assert.ok(fs.existsSync(path.join(tempDir, created.created[0])));
    assert.ok(fs.existsSync(path.join(tempDir, created.created[1])));
    assert.ok(fs.existsSync(path.join(tempDir, created.created[2])));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extractScaffoldFromRaw: trích xuất chính xác từ văn bản Requirement nghiệp vụ thô', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-spec-test-'));
  try {
    const rawText = `
# Tính năng: Quên mật khẩu qua mã OTP Email

Mô tả: Cho phép người dùng lấy lại mật khẩu thông qua mã xác thực gửi về email.

Tiêu chí chấp nhận:
- AC-001: Nhập email hợp lệ, bấm gửi OTP thì hệ thống gửi mã 6 số về hòm thư.
- AC-002: Báo lỗi khi email chưa đăng ký trên hệ thống.
- AC-003: Báo lỗi khi nhập sai mã OTP quá 5 lần.
    `;

    const extracted = await extractScaffoldFromRaw(tempDir, {
      rawContent: rawText,
      reqId: 'REQ-051',
      domain: 'auth',
      useAi: false,
    });

    assert.equal(extracted.success, true);
    assert.equal(extracted.inputType, 'spec_text');
    assert.equal(extracted.preview.reqId, 'REQ-051');
    assert.ok(extracted.preview.title.includes('Quên mật khẩu'));
    assert.equal(extracted.preview.acCount, 3);
    assert.ok(extracted.preview.tcCount >= 3);
    assert.ok(extracted.generated.reqContent.includes('AC-001'));
    assert.ok(extracted.generated.tcContent.includes('## Traceability'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


