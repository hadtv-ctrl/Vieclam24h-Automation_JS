'use strict';

/**
 * Lõi truy vết REQ -> AC -> TC -> spec. Hàm thuần, không I/O ngoài đọc file, không ghi gì.
 *
 * Phân công: chuẩn viết requirement/test case (template, quy tắc, ví dụ) thuộc repo
 * `hadinhkms/Support_doc_n_TestCase`. File này KHÔNG định nghĩa lại chuẩn đó — nó chỉ đọc
 * đúng những định danh mà chuẩn quy định và trả lời ba câu hỏi bằng máy:
 *
 *   1. Nghiệp vụ nào đã ghi nhận mà chưa có test case?      -> ac-khong-co-tc
 *   2. Test case nào đã viết mà chưa có script?             -> tc-chua-automation  (= ứng viên automation)
 *   3. Script nào đang chạy mà không truy về được nghiệp vụ? -> spec-khong-truy-vet
 *
 * Câu 3 là cái bắt "missing business": một spec không gắn `@REQ-xxx` nghĩa là hành vi nó
 * kiểm chứng không nằm trong tài liệu nào — hoặc tài liệu thiếu, hoặc spec thừa.
 *
 * Quy ước định danh (xem ai/shared/AI_PROMPTS.md mục 3):
 *   requirements/REQ-xxx-<slug>.md   chứa các `AC-yyy`
 *   test-cases/REQ-xxx-<slug>.md     chứa các `TC-zzz` kèm AC liên quan và priority
 *   tests/**\/*.spec.js               `test.describe('... @REQ-xxx')`
 *                                     `test('TC-zzz - AC-yyy <mô tả> @smoke')`
 */

const fs = require('fs');
const path = require('path');

const RE_REQ = /\bREQ-(\d{3})\b/g;
const RE_AC = /\bAC-(\d{3})\b/g;
const RE_TC = /\bTC-(\d{3})\b/g;
const RE_PRIORITY = /\bP([0-3])\b/;

// Cột "Automation" trong bảng traceability. Một TC khai KHÔNG automation là quyết định có chủ ý
// (kiểm tra thị giác, phụ thuộc bên thứ ba, chạy một lần rồi thôi) — cổng không được báo động mãi
// về nó, nếu không người ta sẽ quen với màu đỏ rồi bỏ qua cả cảnh báo thật.
const AUTOMATION_NO = new Set(['no', 'khong', 'không', 'manual', 'thu cong', 'thủ công', 'n/a']);
const AUTOMATION_CANDIDATE = new Set(['candidate', 'ung vien', 'ứng viên', 'planned', 'todo']);

// Bắt các chuỗi TRÔNG GIỐNG định danh nhưng sai quy ước: REQ-1, AC_012, tc-003, TC-0001.
// Một parser im lặng bỏ qua chúng còn tệ hơn không có parser: cổng sẽ báo "sạch" trong khi
// tài liệu thật ra không được đọc. Thà báo động nhầm còn hơn bỏ sót không ai biết.
const RE_NEAR_MISS = /\b(REQ|AC|TC)([-_ ]?)(\d{1,4})\b/gi;
const RE_EXACT = /^(REQ|AC|TC)-\d{3}$/;

function findMalformedIds(text) {
  const bad = new Set();
  for (const m of text.matchAll(RE_NEAR_MISS)) {
    if (!RE_EXACT.test(m[0])) bad.add(m[0]);
  }
  return [...bad];
}

function readAutomationColumn(line) {
  for (const cell of line.split('|').map((c) => c.trim().toLowerCase())) {
    if (AUTOMATION_NO.has(cell)) return 'no';
    if (AUTOMATION_CANDIDATE.has(cell)) return 'candidate';
    if (cell === 'yes' || cell === 'co' || cell === 'có') return 'yes';
  }
  return null;
}

const DEFAULT_DIRS = {
  requirements: 'requirements',
  testCases: 'test-cases',
  specs: 'tests',
};

/**
 * Nhãn tiếng Việt cho từng loại finding. Đặt ở lõi để CLI và dashboard dùng CHUNG một bản —
 * hai nơi tự đặt nhãn riêng thì sớm muộn cũng nói khác nhau về cùng một finding.
 */
const KIND_LABEL = {
  'ac-khong-co-tc': 'Nghiệp vụ chưa có test case',
  'tc-chua-automation': 'Test case chưa có script',
  'spec-khong-truy-vet': 'Spec không truy vết được về nghiệp vụ',
  'spec-vua-sua-khong-truy-vet': 'Spec vừa sửa nhưng không truy vết được',
  'sua-script-ma-khong-dong-tai-lieu': 'Sửa script mà tài liệu không đổi theo',
  'tai-lieu-khong-doc-duoc': 'Tài liệu công cụ KHÔNG đọc được (nguy cơ báo sạch giả)',
  'dinh-danh-sai-quy-uoc': 'Định danh sai quy ước',
  'req-thieu-ac': 'Requirement chưa có acceptance criterion',
  'test-khong-co-assertion': 'Test khai phủ AC nhưng không có assertion',
  'ac-lech-giua-tai-lieu-va-spec': 'Tài liệu và spec nói khác nhau',
  'tc-co-y-thu-cong': 'Test case cố ý giữ thủ công (không phải nợ)',
  'dinh-danh-khong-ton-tai': 'Tham chiếu tới định danh không tồn tại',
};

function listFiles(root, relativeDir, filter) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && filter(entry.name)) out.push(full);
    }
  };
  walk(absolute);
  return out.map((p) => path.relative(root, p).split(path.sep).join('/'));
}

function uniqueMatches(text, regex) {
  const found = new Set();
  for (const m of text.matchAll(regex)) found.add(m[0]);
  return [...found];
}

/** Bỏ khối code để không nhặt nhầm định danh nằm trong ví dụ code của tài liệu. */
function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function parseRequirements(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const requirements = new Map();

  const unreadable = [];
  const malformed = [];
  const withoutAc = [];

  for (const file of files) {
    const text = stripCodeBlocks(fs.readFileSync(path.join(root, file), 'utf8'));
    const bad = findMalformedIds(text);
    if (bad.length) malformed.push({ file, ids: bad });

    const reqIds = uniqueMatches(text, RE_REQ);
    if (!reqIds.length) {
      unreadable.push(file);
      continue;
    }
    const primary = reqIds[0];
    const acs = uniqueMatches(text, RE_AC);
    if (!acs.length) withoutAc.push({ file, req: primary });

    const existing = requirements.get(primary) || { id: primary, files: [], acs: [] };
    existing.files.push(file);
    existing.acs = [...new Set([...existing.acs, ...acs])];
    requirements.set(primary, existing);
  }
  return { files, requirements, unreadable, malformed, withoutAc };
}

function parseTestCases(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const testCases = new Map();
  const unreadable = [];
  const malformed = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const text = stripCodeBlocks(raw);
    const fileReq = uniqueMatches(text, RE_REQ)[0] || null;

    const bad = findMalformedIds(text);
    if (bad.length) malformed.push({ file, ids: bad });
    if (!uniqueMatches(text, RE_TC).length) unreadable.push(file);

    // Mỗi dòng chứa TC-xxx được coi là một khai báo test case; AC và priority lấy trên cùng dòng.
    for (const line of text.split(/\r?\n/)) {
      const tcIds = uniqueMatches(line, RE_TC);
      if (!tcIds.length) continue;
      const acOnLine = uniqueMatches(line, RE_AC);
      const priorityMatch = RE_PRIORITY.exec(line);
      for (const tc of tcIds) {
        // Một TC thường xuất hiện ở nhiều nơi: bảng traceability (có AC + priority),
        // automation plan, phần mô tả chi tiết. GỘP chứ không để bản gặp trước thắng —
        // nếu không, thứ tự đọc thư mục sẽ quyết định dữ liệu nào bị mất.
        const existing = testCases.get(tc) || {
          id: tc, req: null, acs: [], priority: null, automation: null, file, files: [], title: '',
        };
        existing.automation = existing.automation || readAutomationColumn(line);
        existing.req = existing.req || uniqueMatches(line, RE_REQ)[0] || fileReq;
        existing.acs = [...new Set([...existing.acs, ...acOnLine])];
        existing.priority = existing.priority || (priorityMatch ? `P${priorityMatch[1]}` : null);
        if (!existing.files.includes(file)) existing.files.push(file);
        // Ưu tiên giữ dòng có AC làm title, vì đó là dòng khai báo chính thức.
        if (!existing.title || (acOnLine.length && !RE_AC.test(existing.title))) {
          existing.title = line.trim().slice(0, 160);
          existing.file = file;
        }
        RE_AC.lastIndex = 0;
        testCases.set(tc, existing);
      }
    }
  }
  return { files, testCases, unreadable, malformed };
}

/**
 * Bóc khối chi tiết của từng test case: tiền điều kiện, tag, dữ liệu, và BẢNG BƯỚC.
 *
 * parseTestCases() ở trên cố tình đọc theo TỪNG DÒNG, vì nó chỉ cần đếm và truy vết — một
 * TC xuất hiện ở bảng traceability, ở automation plan và ở phần mô tả, cả ba đều phải gộp
 * lại. Cách đọc đó không bao giờ thấy được bảng `| Step | Action | Expected result |`.
 *
 * Hàm này giải quyết đúng phần còn thiếu đó, và giữ nguyên tắc: KHÔNG bịa. Tài liệu không
 * có bảng bước thì trả về mảng rỗng, để chỗ gọi nói thẳng là chưa đủ dữ liệu — thay vì sinh
 * ra một kịch bản trông có vẻ đầy đủ nhưng không dựa trên gì cả.
 */
const RE_TC_HEADING = /^(#{2,6})\s*(TC-\d{3})\s*[:：.\-—]?\s*(.*)$/;
const RE_META_BULLET = /^\s*[-*+]\s*\*{0,2}([A-Za-zÀ-ỹ][^:*]{0,40}?)\*{0,2}\s*:\s*(.+)$/;
const RE_TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const RE_TABLE_SEP = /^\s*\|[\s:|-]+\|\s*$/;

/** Bỏ dấu nhấn Markdown quanh một ô để văn bản đọc được như câu thường. */
function plain(value) {
  return String(value == null ? '' : value)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .trim();
}

const splitCells = (line) => line
  .replace(/^\s*\|/, '')
  .replace(/\|\s*$/, '')
  .split('|')
  .map((c) => c.trim());

/**
 * Nhận diện bảng bước bằng TÊN CỘT, không theo vị trí — tài liệu có thể thêm cột Note hay
 * Data mà thứ tự vẫn hợp lệ.
 * @returns {{action: number, expected: number, step: number}|null}
 */
function stepColumns(headerCells) {
  const norm = headerCells.map((c) => plain(c).toLowerCase());
  const find = (...names) => norm.findIndex((c) => names.some((n) => c.includes(n)));
  const action = find('action', 'hành động', 'thao tác');
  const expected = find('expected', 'kết quả', 'ket qua');
  if (action === -1 || expected === -1) return null;
  return { step: find('step', 'bước', 'buoc'), action, expected };
}

/**
 * @param {string} markdown Nội dung thô của một file test-case.
 * @returns {Map<string, {id: string, title: string, meta: Record<string,string>, steps: Array<{no: string, action: string, expected: string}>}>}
 */
function extractTestCaseDetails(markdown) {
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  const out = new Map();

  let current = null;
  let currentLevel = 0;
  let pendingCols = null;

  const close = () => { current = null; pendingCols = null; };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const heading = line.match(RE_TC_HEADING);
    if (heading) {
      current = { id: heading[2], title: plain(heading[3]), meta: {}, steps: [] };
      currentLevel = heading[1].length;
      pendingCols = null;
      // Test case xuất hiện hai lần trong cùng file (vd. cả ở bảng traceability) thì bản
      // có tiêu đề riêng thắng, vì đó mới là phần mô tả chi tiết.
      out.set(current.id, current);
      continue;
    }

    if (!current) continue;

    // Tiêu đề khác cùng cấp hoặc cao hơn => hết phần của test case này.
    const otherHeading = line.match(/^(#{1,6})\s+/);
    if (otherHeading && otherHeading[1].length <= currentLevel) { close(); continue; }

    const meta = line.match(RE_META_BULLET);
    if (meta) {
      current.meta[plain(meta[1]).toLowerCase()] = plain(meta[2]);
      continue;
    }

    if (RE_TABLE_SEP.test(line)) continue;

    const row = line.match(RE_TABLE_ROW);
    if (!row) continue;

    const cells = splitCells(line);
    if (!pendingCols) {
      pendingCols = stepColumns(cells);
      continue; // dòng này là header, không phải bước
    }
    const action = plain(cells[pendingCols.action]);
    const expected = plain(cells[pendingCols.expected]);
    if (!action && !expected) continue;
    current.steps.push({
      no: pendingCols.step >= 0 ? plain(cells[pendingCols.step]) : String(current.steps.length + 1),
      action,
      expected,
    });
  }

  return out;
}

function parseSpecs(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.spec.js') || n.endsWith('.spec.ts'));
  const specs = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const describeTitles = [...text.matchAll(/\btest\.describe\s*\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2]);

    // Cắt từng khối test để soi được THÂN hàm, không chỉ title: một test tuyên bố phủ AC-001
    // nhưng bên trong không có assertion nào thì nó không kiểm chứng gì cả.
    const testMatches = [...text.matchAll(/(?<!\.)\btest\s*\(\s*(['"`])([\s\S]*?)\1/g)];
    const blocks = testMatches.map((m, i) => {
      const start = m.index;
      const end = i + 1 < testMatches.length ? testMatches[i + 1].index : text.length;
      const body = text.slice(start, end);
      return {
        title: m[2],
        tcs: uniqueMatches(m[2], RE_TC),
        acs: uniqueMatches(m[2], RE_AC),
        hasAssertion: /\bexpect\s*\(|\bassert[.(]/.test(body),
      };
    });

    const testTitles = blocks.map((b) => b.title);
    const reqs = [...new Set(describeTitles.concat(testTitles).flatMap((t) => uniqueMatches(t, RE_REQ)))];
    const tcs = [...new Set(blocks.flatMap((b) => b.tcs))];
    const acs = [...new Set(blocks.flatMap((b) => b.acs))];

    specs.push({ file, reqs, tcs, acs, blocks, testCount: blocks.length });
  }
  return { files, specs };
}

/**
 * @param {{root?: string, dirs?: object}} options
 * @returns báo cáo truy vết đầy đủ, không ném lỗi khi tài liệu chưa tồn tại.
 */
function buildTraceReport({ root = process.cwd(), dirs = {} } = {}) {
  const d = { ...DEFAULT_DIRS, ...dirs };

  const hasRequirements = fs.existsSync(path.join(root, d.requirements));
  const hasTestCases = fs.existsSync(path.join(root, d.testCases));

  const reqParse = parseRequirements(root, d.requirements);
  const tcParse = parseTestCases(root, d.testCases);
  const { requirements } = reqParse;
  const { testCases } = tcParse;
  const { specs } = parseSpecs(root, d.specs);

  const allAcs = new Set();
  for (const req of requirements.values()) req.acs.forEach((ac) => allAcs.add(ac));

  const acsCoveredByTc = new Set();
  for (const tc of testCases.values()) tc.acs.forEach((ac) => acsCoveredByTc.add(ac));

  const tcsInSpecs = new Set();
  const reqsInSpecs = new Set();
  for (const s of specs) {
    s.tcs.forEach((tc) => tcsInSpecs.add(tc));
    s.reqs.forEach((r) => reqsInSpecs.add(r));
  }

  const findings = [];

  // 0. LINT TÀI LIỆU — phải chạy trước mọi kiểm tra khác.
  //    Một parser im lặng bỏ qua file nó không hiểu sẽ báo "sạch" một cách dối trá.
  //    Ở đây nó buộc phải tự thú.
  for (const file of [...reqParse.unreadable, ...tcParse.unreadable]) {
    findings.push({
      kind: 'tai-lieu-khong-doc-duoc',
      severity: 'major',
      id: file,
      detail: `${file}: không tìm thấy định danh nào đúng quy ước — công cụ KHÔNG đọc được file này`,
    });
  }
  for (const { file, ids } of [...reqParse.malformed, ...tcParse.malformed]) {
    findings.push({
      kind: 'dinh-danh-sai-quy-uoc',
      severity: 'major',
      id: file,
      detail: `${file}: ${ids.slice(0, 6).join(', ')} gần giống định danh nhưng sai quy ước (đúng: REQ-001, AC-001, TC-001)`,
    });
  }
  for (const { file, req } of reqParse.withoutAc) {
    findings.push({
      kind: 'req-thieu-ac',
      severity: 'major',
      id: req,
      detail: `${file}: ${req} không có acceptance criterion nào — nghiệp vụ chưa được chốt thành điều kiện kiểm được`,
    });
  }

  // 1. Nghiệp vụ đã ghi nhận nhưng chưa ai thiết kế test case.
  for (const ac of [...allAcs].sort()) {
    if (!acsCoveredByTc.has(ac)) {
      const owner = [...requirements.values()].find((r) => r.acs.includes(ac));
      findings.push({
        kind: 'ac-khong-co-tc',
        severity: 'major',
        id: ac,
        detail: `${ac} (thuộc ${owner ? owner.id : '?'}) chưa có test case nào trong ${d.testCases}/`,
      });
    }
  }

  // 2. Test case đã viết nhưng chưa có script -> ứng viên automation.
  //    Trừ TC đã khai rõ là cố ý không automation: ghi ở mức info, không tính là nợ.
  const candidates = [];
  for (const tc of [...testCases.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (tcsInSpecs.has(tc.id)) continue;

    if (tc.automation === 'no') {
      findings.push({
        kind: 'tc-co-y-thu-cong',
        severity: 'info',
        id: tc.id,
        detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} khai rõ không automation — giữ nguyên, không tính là nợ`,
      });
      continue;
    }

    candidates.push(tc);
    findings.push({
      kind: 'tc-chua-automation',
      severity: tc.priority === 'P0' || tc.priority === 'P1' ? 'major' : 'minor',
      id: tc.id,
      detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} chưa có spec nào tham chiếu tới`,
    });
  }

  // 3. Spec đang chạy mà không truy về được nghiệp vụ nào -> nguy cơ missing business.
  for (const s of specs) {
    if (s.reqs.length === 0) {
      findings.push({
        kind: 'spec-khong-truy-vet',
        severity: hasRequirements ? 'major' : 'info',
        id: s.file,
        detail: `${s.file}: test.describe thiếu tag @REQ-xxx`,
      });
    }
  }

  // 4. Spec trỏ tới định danh không tồn tại trong tài liệu.
  for (const s of specs) {
    for (const r of s.reqs) {
      if (!requirements.has(r)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasRequirements ? 'major' : 'info',
          id: r,
          detail: `${s.file} tham chiếu ${r} nhưng ${d.requirements}/ không có requirement này`,
        });
      }
    }
    for (const tc of s.tcs) {
      if (!testCases.has(tc)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasTestCases ? 'major' : 'info',
          id: tc,
          detail: `${s.file} tham chiếu ${tc} nhưng ${d.testCases}/ không có test case này`,
        });
      }
    }
  }

  // 5. Spec tuyên bố phủ AC nào đó nhưng bên trong không có assertion -> không kiểm chứng gì cả.
  for (const s2 of specs) {
    for (const b of s2.blocks) {
      if (!b.tcs.length && !b.acs.length) continue;
      if (b.hasAssertion) continue;
      findings.push({
        kind: 'test-khong-co-assertion',
        severity: 'major',
        id: `${s2.file}::${b.tcs.join(',') || b.acs.join(',')}`,
        detail: `${s2.file}: "${b.title.slice(0, 70)}" khai phủ ${b.tcs.concat(b.acs).join(', ')} nhưng không có assertion nào`,
      });
    }
  }

  // 6. Spec và tài liệu nói khác nhau về việc TC đó phủ AC nào.
  for (const s2 of specs) {
    for (const b of s2.blocks) {
      for (const tc of b.tcs) {
        const doc = testCases.get(tc);
        if (!doc || !doc.acs.length || !b.acs.length) continue;
        const lech = b.acs.filter((ac) => !doc.acs.includes(ac));
        if (lech.length) {
          findings.push({
            kind: 'ac-lech-giua-tai-lieu-va-spec',
            severity: 'major',
            id: tc,
            detail: `${s2.file}: ${tc} ghi ${b.acs.join(',')} nhưng tài liệu khai ${doc.acs.join(',')}`,
          });
        }
      }
    }
  }

  const bootstrap = !hasRequirements && !hasTestCases;

  return {
    root,
    dirs: d,
    hasRequirements,
    hasTestCases,
    bootstrap,
    counts: {
      requirements: requirements.size,
      acceptanceCriteria: allAcs.size,
      testCases: testCases.size,
      specs: specs.length,
      specsWithoutTrace: specs.filter((s) => s.reqs.length === 0).length,
    },
    requirements: [...requirements.values()],
    testCases: [...testCases.values()],
    specs,
    candidates,
    findings,
  };
}

/**
 * Soi một tập thay đổi (từ git) để bắt việc viết script mà KHÔNG ghi nhận nghiệp vụ.
 *
 * Không cưỡng chế được hành vi "phải ghi tài liệu" — nhưng bắt được hậu quả của nó ngay tại
 * commit, thay vì để lộ ra nhiều tháng sau. Hàm thuần: nhận sẵn danh sách file đã đổi.
 *
 * @param {object} report kết quả buildTraceReport
 * @param {string[]} changedFiles đường dẫn tương đối, dùng dấu /
 */
function assessChangeSet(report, changedFiles) {
  const d = report.dirs;
  const isSpec = (f) => f.startsWith(`${d.specs}/`) && /\.spec\.(js|ts)$/.test(f);
  const isDoc = (f) => f.startsWith(`${d.requirements}/`) || f.startsWith(`${d.testCases}/`);

  const changedSpecs = changedFiles.filter(isSpec);
  const changedDocs = changedFiles.filter(isDoc);
  const findings = [];

  for (const file of changedSpecs) {
    const spec = report.specs.find((s) => s.file === file);
    if (!spec) continue; // file đã bị xoá
    if (spec.reqs.length === 0) {
      findings.push({
        kind: 'spec-vua-sua-khong-truy-vet',
        severity: 'major',
        id: file,
        detail: `${file} vừa thay đổi nhưng không gắn @REQ-xxx — nghiệp vụ nó kiểm chứng không nằm trong tài liệu nào`,
      });
    }
  }

  if (changedSpecs.length > 0 && changedDocs.length === 0) {
    findings.push({
      kind: 'sua-script-ma-khong-dong-tai-lieu',
      severity: 'minor',
      id: `${changedSpecs.length} spec`,
      detail: `${changedSpecs.length} spec thay đổi mà không file nào trong ${d.requirements}/ hay ${d.testCases}/ đổi theo`
        + ' — nếu có phát hiện nghiệp vụ mới thì phải ghi lại (AI_PROMPTS.md mục 3.5a)',
    });
  }

  return { changedSpecs, changedDocs, findings };
}

/** Ứng viên automation đã xếp hạng: P0 trước, rồi theo ID. */
function rankAutomationCandidates(report, limit = 7) {
  const weight = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...report.candidates]
    .sort((a, b) => (weight[a.priority] ?? 9) - (weight[b.priority] ?? 9) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

module.exports = {
  DEFAULT_DIRS,
  KIND_LABEL,
  buildTraceReport,
  assessChangeSet,
  rankAutomationCandidates,
  parseRequirements,
  parseTestCases,
  extractTestCaseDetails,
  parseSpecs,
  stripCodeBlocks,
};
