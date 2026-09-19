/**
 * dashboard/services/serverStateService.test.js
 * Chạy tay: node --test dashboard/services/serverStateService.test.js
 *
 * Dựng repo git thật trong thư mục tạm rồi hỏi chính git xem file có bị bỏ qua chưa —
 * đọc nội dung .gitignore bằng mắt không chứng minh được git hiểu đúng ý.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  STATE_FILE_NAME, stateFilePath, ensureStateFileIgnored, isStateFileTracked, untrackCommand,
} = require('./serverStateService');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** Hỏi git: file này có đang bị bỏ qua không? Đây mới là câu trả lời có thẩm quyền. */
function gitIgnoresIt(root) {
  try {
    git(root, ['check-ignore', '-q', STATE_FILE_NAME]);
    return true;
  } catch (_) {
    return false;
  }
}

function makeRepo(gitignore) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'server-state-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  if (gitignore !== undefined) fs.writeFileSync(path.join(root, '.gitignore'), gitignore, 'utf8');
  return root;
}

const withRepo = (gitignore, fn) => {
  const root = makeRepo(gitignore);
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

const NL = String.fromCharCode(10);

test('repo chưa bỏ qua thì được bổ sung, và git thật sự bỏ qua sau đó', () => {
  withRepo(`node_modules/${NL}*.log${NL}`, (root) => {
    assert.equal(gitIgnoresIt(root), false, 'tiền đề: ban đầu chưa bị bỏ qua');

    const touched = ensureStateFileIgnored(root);
    assert.ok(touched, 'phải báo đã sửa .gitignore');
    assert.equal(gitIgnoresIt(root), true, 'git phải bỏ qua file sau khi bổ sung');

    // Tạo artifact như server thật rồi soi: nó không được hiện ra trong git status.
    fs.writeFileSync(stateFilePath(root), '{"port":4180}', 'utf8');
    assert.equal(git(root, ['status', '--porcelain']).includes(STATE_FILE_NAME), false);
  });
});

test('chỉ THÊM dòng, không đụng tới nội dung sẵn có', () => {
  const before = `node_modules/${NL}dist/${NL}!dist/keep.txt${NL}`;
  withRepo(before, (root) => {
    ensureStateFileIgnored(root);
    const after = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    assert.ok(after.startsWith(before), '.gitignore của dự án phải còn nguyên ở đầu file');
    assert.ok(after.includes(`/${STATE_FILE_NAME}`));
  });
});

test('gọi nhiều lần không nhân bản dòng', () => {
  withRepo(`node_modules/${NL}`, (root) => {
    assert.ok(ensureStateFileIgnored(root), 'lần đầu phải sửa');
    assert.equal(ensureStateFileIgnored(root), null, 'lần hai không được sửa nữa');
    assert.equal(ensureStateFileIgnored(root), null);

    const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/);
    const hits = lines.filter((l) => l.trim() === `/${STATE_FILE_NAME}`);
    assert.equal(hits.length, 1);
  });
});

test('nhận ra mục đã có, kể cả viết không có dấu gạch chéo đầu', () => {
  for (const form of [STATE_FILE_NAME, `/${STATE_FILE_NAME}`, `  ${STATE_FILE_NAME}  `]) {
    withRepo(`node_modules/${NL}${form}${NL}`, (root) => {
      assert.equal(ensureStateFileIgnored(root), null, `đã có dạng "${form}" mà vẫn thêm lại`);
    });
  }
});

test('repo chưa có .gitignore thì tạo mới', () => {
  withRepo(undefined, (root) => {
    assert.equal(fs.existsSync(path.join(root, '.gitignore')), false, 'tiền đề: chưa có file');
    assert.ok(ensureStateFileIgnored(root));
    assert.equal(gitIgnoresIt(root), true);
  });
});

test('.gitignore không kết thúc bằng xuống dòng vẫn được nối đúng', () => {
  withRepo('node_modules/', (root) => {
    ensureStateFileIgnored(root);
    const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/);
    assert.equal(lines[0], 'node_modules/', 'dòng cuối cũ không được bị dính vào dòng mới');
    assert.ok(lines.includes(`/${STATE_FILE_NAME}`));
    assert.equal(gitIgnoresIt(root), true);
  });
});

test('không phải repo git thì không tạo ra file rác', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  try {
    assert.equal(ensureStateFileIgnored(dir), null);
    assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('không ghi được cũng không ném lỗi — đây là tiện ích, không phải điều kiện chạy', () => {
  assert.equal(ensureStateFileIgnored(''), null);
  assert.equal(ensureStateFileIgnored(null), null);
  assert.equal(ensureStateFileIgnored(path.join(os.tmpdir(), 'khong-ton-tai-' + STATE_FILE_NAME)), null);
});

test('stateFilePath luôn bám theo root được truyền vào, không suy ra từ __dirname', () => {
  const a = path.join(os.tmpdir(), 'repo-a');
  const b = path.join(os.tmpdir(), 'repo-b');
  assert.equal(stateFilePath(a), path.join(a, STATE_FILE_NAME));
  assert.notEqual(stateFilePath(a), stateFilePath(b));
});

test('file đã lỡ commit thì báo đúng là git đang theo dõi', () => {
  withRepo('node_modules/' + NL, (root) => {
    assert.equal(isStateFileTracked(root), false, 'tiền đề: chưa theo dõi');

    fs.writeFileSync(stateFilePath(root), '{"port":4180}', 'utf8');
    git(root, ['add', '-f', STATE_FILE_NAME]);
    git(root, ['commit', '-q', '-m', 'lỡ commit artifact']);

    assert.equal(isStateFileTracked(root), true);

    // Đây mới là điểm mấu chốt: thêm .gitignore KHÔNG cứu được file đã vào index.
    ensureStateFileIgnored(root);
    fs.writeFileSync(stateFilePath(root), '{"port":9999}', 'utf8');
    assert.ok(
      git(root, ['status', '--porcelain']).includes(STATE_FILE_NAME),
      'file đã theo dõi vẫn hiện ra dù đã có .gitignore — đúng như dự đoán',
    );

    // Chạy đúng câu lệnh được in ra thì phải dứt điểm.
    git(root, untrackCommand().split(' ').slice(1));
    assert.equal(isStateFileTracked(root), false);
    git(root, ['commit', '-q', '-m', 'untrack']);
    fs.writeFileSync(stateFilePath(root), '{"port":4181}', 'utf8');
    assert.equal(git(root, ['status', '--porcelain']).includes(STATE_FILE_NAME), false);
  });
});

test('không phải repo git thì isStateFileTracked trả false, không ném lỗi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  try {
    assert.equal(isStateFileTracked(dir), false);
    assert.equal(isStateFileTracked(''), false);
    assert.equal(isStateFileTracked(null), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('câu lệnh gỡ luôn nhắc đúng tên file, không chép tay', () => {
  assert.equal(untrackCommand(), `git rm --cached ${STATE_FILE_NAME}`);
});
