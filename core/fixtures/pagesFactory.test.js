const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const {
  createPageContainer,
  resolvePageClassName,
  findPageClassFile,
  resolveProjectRoot,
  RESERVED_PROPERTIES,
} = require('./pagesFactory');

test('T01 & Alias normalization: sample, samplePage, SamplePage, jobDetail, job_detail', () => {
  assert.equal(resolvePageClassName('sample'), 'SamplePage');
  assert.equal(resolvePageClassName('samplePage'), 'SamplePage');
  assert.equal(resolvePageClassName('SamplePage'), 'SamplePage');
  assert.equal(resolvePageClassName('jobDetail'), 'JobDetailPage');
  assert.equal(resolvePageClassName('job_detail'), 'JobDetailPage');
  assert.equal(resolvePageClassName('user-profile'), 'UserProfilePage');
});

test('T09: Introspection properties (then, toJSON, inspect, Symbol, etc.) return undefined without throw', () => {
  const dummyPage = { id: 'mockPage' };
  const pages = createPageContainer(dummyPage, { platform: 'desktop' });

  // Promise resolution probe
  assert.equal(pages.then, undefined);
  assert.equal(pages.toJSON, undefined);
  assert.equal(pages.inspect, undefined);
  assert.equal(pages[Symbol.toStringTag], undefined);
  assert.equal(pages[Symbol.iterator], undefined);
  assert.equal(pages.constructor, undefined);
  assert.equal(pages.__proto__, undefined);

  // Promise.resolve on pages does not reject or throw
  return Promise.resolve(pages).then((resolved) => {
    assert.equal(typeof resolved, 'object');
  });
});

test('T10: Path traversal or invalid characters are strictly rejected', () => {
  const dummyPage = { id: 'mockPage' };
  const pages = createPageContainer(dummyPage, { platform: 'desktop' });

  assert.throws(() => pages['../evil'], /traversal/);
  assert.throws(() => pages['sub/folder'], /traversal/);
  assert.throws(() => pages['..\\evil'], /traversal/);
});

function createMockPage(extra = {}) {
  return {
    locator: () => ({ first: () => ({}) }),
    getByRole: () => ({ first: () => ({}) }),
    url: () => 'https://example.com',
    ...extra,
  };
}

test('T01 & T08: Lazy loading, per-test cache and constructor(page, featureName)', () => {
  const dummyPage = createMockPage();
  const featureName = 'sample_feature';
  const pages = createPageContainer(dummyPage, {
    platform: 'desktop',
    featureName,
  });

  // Truy cập bằng 2 alias khác nhau phải trả về CÙNG 1 instance đã cache
  const instance1 = pages.sample;
  const instance2 = pages.samplePage;
  const instance3 = pages.SamplePage;

  assert.ok(instance1);
  assert.equal(instance1, instance2);
  assert.equal(instance1, instance3);
  assert.equal(instance1.featureName, featureName);
  assert.equal(instance1.page, dummyPage);
});

test('T02: Hai container khác nhau không chia sẻ cache instance', () => {
  const pageA = createMockPage({ id: 'pageA' });
  const pageB = createMockPage({ id: 'pageB' });

  const containerA = createPageContainer(pageA, { platform: 'desktop', featureName: 'featA' });
  const containerB = createPageContainer(pageB, { platform: 'desktop', featureName: 'featB' });

  const instA = containerA.sample;
  const instB = containerB.sample;

  assert.notEqual(instA, instB);
  assert.equal(instA.page, pageA);
  assert.equal(instB.page, pageB);
  assert.equal(instA.featureName, 'featA');
  assert.equal(instB.featureName, 'featB');
});

test('T03 & T04: Mobile resolution và phát hiện Ambiguity', () => {
  const tempRoot = path.join(process.cwd(), '.tmp', 'test_pages_factory');
  const mobileWebDir = path.join(tempRoot, 'pages', 'mobile-web');
  const mobileLegacyDir = path.join(tempRoot, 'pages', 'mobile');

  fs.mkdirSync(mobileWebDir, { recursive: true });
  fs.mkdirSync(mobileLegacyDir, { recursive: true });

  // Tạo class ở cả 2 thư mục để test Ambiguity
  const dummyCode = `class ConflictPage { constructor(page, f) { this.page = page; this.f = f; } }\nmodule.exports = { ConflictPage };\n`;
  fs.writeFileSync(path.join(mobileWebDir, 'ConflictPage.js'), dummyCode, 'utf8');
  fs.writeFileSync(path.join(mobileLegacyDir, 'ConflictPage.js'), dummyCode, 'utf8');

  const container = createPageContainer({}, { platform: 'mobile-web', rootDir: tempRoot });

  assert.throws(
    () => container.conflict,
    /Ambiguity.*ConflictPage/
  );

  // Cleanup
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('T05: Custom rootDir không tồn tại báo lỗi rõ ràng', () => {
  assert.throws(
    () => createPageContainer({}, { rootDir: 'D:/non_existent_folder_abc_xyz' }),
    /không tồn tại/
  );
});

test('Overload adapter tương thích ngược (page, isMobile, rootDir)', () => {
  const dummyPage = createMockPage();
  const container = createPageContainer(dummyPage, false, process.cwd());
  assert.ok(container.sample);
});

test('F07: Nested directory discovery in pages/desktop/account/NestedPage.js', () => {
  const tempRoot = path.join(process.cwd(), '.tmp', 'test_nested_pages');
  const nestedDir = path.join(tempRoot, 'pages', 'desktop', 'account');
  fs.mkdirSync(nestedDir, { recursive: true });

  const dummyCode = `class NestedAccountPage { constructor(page, f) { this.page = page; this.f = f; } }\nmodule.exports = { NestedAccountPage };\n`;
  fs.writeFileSync(path.join(nestedDir, 'NestedAccountPage.js'), dummyCode, 'utf8');

  try {
    const container = createPageContainer({}, { platform: 'desktop', rootDir: tempRoot });
    assert.ok(container.nestedAccount);
    assert.ok(container.nestedAccountPage);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('F08 & F09: Strict export matching and canonical path cache identity', () => {
  const tempRoot = path.join(process.cwd(), '.tmp', 'test_export_matching');
  const desktopDir = path.join(tempRoot, 'pages', 'desktop');
  fs.mkdirSync(desktopDir, { recursive: true });

  // 1. Mismatched export (F09)
  const wrongCode = `class UnrelatedClass {}\nmodule.exports = { Unrelated: UnrelatedClass };\n`;
  fs.writeFileSync(path.join(desktopDir, 'WrongExportPage.js'), wrongCode, 'utf8');

  const container = createPageContainer({}, { platform: 'desktop', rootDir: tempRoot });
  assert.throws(
    () => container.wrongExport,
    /không export Class 'WrongExportPage'/
  );

  // 2. Canonical cache identity with different casing aliases (F08)
  const validCode = `class MultiAliasPage { constructor(page, f) { this.page = page; this.f = f; } }\nmodule.exports = { MultiAliasPage };\n`;
  fs.writeFileSync(path.join(desktopDir, 'MultiAliasPage.js'), validCode, 'utf8');

  const inst1 = container.multiAlias;
  const inst2 = container.multiAliasPage;
  const inst3 = container.MultiAliasPage;

  assert.ok(inst1);
  assert.equal(inst1, inst2);
  assert.equal(inst1, inst3);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('F10: Biến môi trường QA_PROJECT_ROOT không tồn tại phải throw rõ ràng', () => {
  const originalEnv = process.env.QA_PROJECT_ROOT;
  process.env.QA_PROJECT_ROOT = 'D:/invalid_nonexistent_qa_project_root_123';
  try {
    assert.throws(
      () => createPageContainer({}, {}),
      /QA_PROJECT_ROOT.*không tồn tại/
    );
  } finally {
    if (originalEnv !== undefined) {
      process.env.QA_PROJECT_ROOT = originalEnv;
    } else {
      delete process.env.QA_PROJECT_ROOT;
    }
  }
});

test('F02: Sibling directory prefix breakout bị chặn bằng path.relative', () => {
  const tempBase = path.join(process.cwd(), '.tmp', 'test_f02_isolation');
  const projectRoot = path.join(tempBase, 'project');
  const siblingEscape = path.join(tempBase, 'project-escape');

  fs.mkdirSync(path.join(projectRoot, 'pages', 'desktop'), { recursive: true });
  fs.mkdirSync(siblingEscape, { recursive: true });

  const outsideFile = path.join(siblingEscape, 'OutsidePage.js');
  fs.writeFileSync(outsideFile, `class OutsidePage {}\nmodule.exports = { OutsidePage };\n`, 'utf8');

  // Thử tạo một symlink/junction trong project/pages/desktop trỏ sang sibling-escape
  const linkPath = path.join(projectRoot, 'pages', 'desktop', 'OutsidePage.js');
  try {
    fs.linkSync(outsideFile, linkPath);
  } catch (_) {
    // Windows hardlink hoặc copy fallback
    try {
      fs.symlinkSync(outsideFile, linkPath, 'file');
    } catch (_) {}
  }

  // Nếu symlink tạo được, verify loader chặn containment
  if (fs.existsSync(linkPath)) {
    try {
      const realTarget = fs.realpathSync(linkPath);
      if (realTarget === fs.realpathSync(outsideFile)) {
        const container = createPageContainer({}, { platform: 'desktop', rootDir: projectRoot });
        assert.throws(
          () => container.outside,
          /phạm vi/
        );
      }
    } finally {
      try { fs.unlinkSync(linkPath); } catch (_) {}
    }
  }

  fs.rmSync(tempBase, { recursive: true, force: true });
});

test('10/10 Reflection & Enumerable: Object.keys(pages) returns available page aliases', () => {
  const dummyPage = createMockPage();
  const pages = createPageContainer(dummyPage, { platform: 'desktop' });

  const keys = Object.keys(pages);
  assert.ok(Array.isArray(keys));
  assert.ok(keys.includes('sample'));
  assert.ok(keys.includes('samplePage'));
  assert.ok(keys.includes('SamplePage'));

  // Kiểm tra toán tử in
  assert.equal('sample' in pages, true);
  assert.equal('samplePage' in pages, true);
  assert.equal('SamplePage' in pages, true);
  assert.equal('nonExistentPage' in pages, false);
});

