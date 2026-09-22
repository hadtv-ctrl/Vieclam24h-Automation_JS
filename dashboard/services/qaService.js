// master-process-disable-size-check: Legacy module, queued for modular decomposition
/**
 * dashboard/services/qaService.js
 * QA Docs & Automation: đọc ma trận truy vết REQ -> AC -> TC -> spec và sổ quyết định.
 *
 * Không biết gì về req/res. Nhận `root` làm tham số, trả dữ liệu hoặc throw Error.
 *
 * Hai ràng buộc quan trọng của repo này:
 *  1. File này được sync xuống satellite, nhưng `scripts/lib/qaTrace.js` có thể CHƯA tới nơi.
 *     Vì vậy analyzer được nạp mềm: thiếu thì degrade, không làm sập chuỗi route.
 *  2. `requirements/` và `test-cases/` là business của từng dự án và nằm trong
 *     FORBIDDEN_SYNC_MODULES — service này CHỈ ĐỌC hai thư mục đó. Thứ duy nhất được ghi
 *     là decisions.json ở gốc repo.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeDashboardConfig, DEFAULT_CONFIG } = require('../../core/config/dashboardConfig');
const { createBackup } = require('./resourceService');

// Nạp mềm: satellite chưa sync analyzer thì mục QA vẫn mở được và nói rõ vì sao trống.
let analyzer = null;
let analyzerError = null;
try {
  // eslint-disable-next-line global-require
  analyzer = require('../../scripts/lib/qaTrace');
} catch (error) {
  analyzerError = error.message;
}

let draftBuilder = null;
try {
  // eslint-disable-next-line global-require
  draftBuilder = require('../../scripts/lib/bddDraft');
} catch (_) { /* vệ tinh chưa sync kịp thì mục QA vẫn mở được */ }

const MAX_DRAFT_TEST_CASES = 20;

const FALLBACK_DIRS = { requirements: 'requirements', testCases: 'test-cases', specs: 'tests' };
const FALLBACK_DECISIONS_FILE = 'decisions.json';
const MAX_DECISIONS_BYTES = 1_048_576;

function analyzerStatus() {
  if (analyzer && typeof analyzer.buildTraceReport === 'function') return { available: true, error: null };
  return {
    available: false,
    error: analyzerError
      ? `Analyzer chưa được sync xuống repo này (scripts/lib/qaTrace.js): ${analyzerError}`
      : 'Analyzer chưa được sync xuống repo này (scripts/lib/qaTrace.js).',
  };
}

/**
 * Đọc cấu hình QA của CHÍNH repo đang mở, không phải của Hub.
 * dashboardConfig.json nằm trong excludes của sync nên mỗi repo tự giữ giá trị riêng.
 */
function readQaConfig(root) {
  const configPath = path.join(root, 'core', 'config', 'dashboardConfig.json');
  let raw = {};
  try {
    if (fs.existsSync(configPath)) raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    raw = {};
  }
  const declaresQa = Boolean(raw && typeof raw.qa === 'object' && raw.qa && Object.keys(raw.qa).length);
  try {
    const qa = normalizeDashboardConfig(raw).qa || {};
    return {
      dirs: {
        requirements: qa.requirements || FALLBACK_DIRS.requirements,
        testCases: qa.testCases || FALLBACK_DIRS.testCases,
        specs: qa.specs || FALLBACK_DIRS.specs,
      },
      decisionsFile: qa.decisionsFile || FALLBACK_DECISIONS_FILE,
      configPath: fs.existsSync(configPath) ? 'core/config/dashboardConfig.json' : null,
      // Sync có thể giao dashboard/ mà giữ lại core/ (khi repo này còn code riêng trong core/).
      // Khi đó normalizeDashboardConfig bản cũ không biết khóa `qa` và âm thầm bỏ nó đi: cấu hình
      // nằm sờng sờng trong file nhưng không có tác dụng. Đọc sai thư mục cho ra "0 vấn đề"
      // trông y hệt "đã sạch", nên phải nói ra thay vì lặng lẽ dùng mặc định.
      staleCore: declaresQa && !Object.keys(qa).length,
    };
  } catch (_) {
    // Config hỏng không được làm chết mục QA — dùng mặc định và vẫn chạy.
    const base = DEFAULT_CONFIG.qa || {};
    return {
      dirs: { ...FALLBACK_DIRS },
      decisionsFile: base.decisionsFile || FALLBACK_DECISIONS_FILE,
      configPath: null,
      staleCore: false,
    };
  }
}

function labelFor(kind) {
  const labels = (analyzer && analyzer.KIND_LABEL) || {};
  return labels[kind] || kind;
}

/**
 * Báo cáo rút gọn đủ cho 3 bảng của UI. Không trả `specs[].blocks` vì UI không dùng tới
 * và nó là phần nặng nhất của report.
 */
function getTrace(root) {
  const status = analyzerStatus();
  const { dirs, decisionsFile, configPath, staleCore } = readQaConfig(root);
  if (!status.available) {
    return { analyzer: status, dirs, configPath, decisionsFile, staleCore, available: false };
  }

  const report = analyzer.buildTraceReport({ root, dirs });
  const bySeverity = { major: [], minor: [], info: [] };
  for (const f of report.findings) {
    const bucket = bySeverity[f.severity] || bySeverity.info;
    bucket.push({ kind: f.kind, label: labelFor(f.kind), severity: f.severity, id: f.id, detail: f.detail });
  }

  const tcByReq = new Map();
  for (const tc of report.testCases) {
    if (!tc.req) continue;
    tcByReq.set(tc.req, (tcByReq.get(tc.req) || 0) + 1);
  }
  // "Đã automation" = TC id thực sự xuất hiện trong spec, KHÔNG phải cột automation của tài liệu.
  const tcInSpecs = new Set(report.specs.flatMap((s) => s.tcs));

  return {
    available: true,
    analyzer: status,
    dirs: report.dirs,
    configPath,
    decisionsFile,
    bootstrap: report.bootstrap,
    hasRequirements: report.hasRequirements,
    hasTestCases: report.hasTestCases,
    counts: report.counts,
    majorCount: bySeverity.major.length,
    automatedCount: tcInSpecs.size,
    // Cảnh báo im lặng nguy hiểm nhất: trỏ sai thư mục spec thì mọi thứ trông như sạch.
    specsDirEmpty: report.counts.specs === 0,
    staleCore,
    requirements: report.requirements.map((r) => ({
      id: r.id,
      acCount: r.acs.length,
      acs: r.acs,
      tcCount: tcByReq.get(r.id) || 0,
      files: r.files,
    })),
    findings: bySeverity,
  };
}

/** Giới hạn đọc một tài liệu. Tài liệu nghiệp vụ dài hơn mức này gần như chắc chắn là
 *  file sinh tự động hoặc bị dán nhầm, và kéo cả MB vào trình duyệt chỉ làm treo UI. */
const MAX_DOCUMENT_BYTES = 512 * 1024;

/**
 * Liệt kê các tài liệu ĐỌC ĐƯỢC của repo này.
 *
 * Danh sách do chính analyzer quét ra, và nó cũng là DANH SÁCH TRẮNG cho readDocument().
 * Nhờ vậy không cần tự viết luật chống path traversal: đường dẫn nào không nằm trong danh
 * sách thì bị từ chối, bất kể nó trông thế nào. Tự kiểm `..` bằng tay là cách mà mọi lỗ
 * traversal đều bắt đầu.
 */
function listDocuments(root) {
  const status = analyzerStatus();
  const { dirs } = readQaConfig(root);
  if (!status.available) return { available: false, analyzer: status, dirs, documents: [] };

  const seen = new Map();
  const add = (relPath, kind) => {
    if (!relPath || seen.has(relPath)) return;
    seen.set(relPath, { path: relPath, kind, name: path.basename(relPath), ids: [] });
  };

  let reqParse = { files: [], requirements: new Map() };
  let tcParse = { files: [], testCases: new Map() };
  try { reqParse = analyzer.parseRequirements(root, dirs.requirements); } catch (_) { /* thư mục không có */ }
  try { tcParse = analyzer.parseTestCases(root, dirs.testCases); } catch (_) { /* thư mục không có */ }

  for (const f of reqParse.files || []) add(f, 'requirement');
  for (const f of tcParse.files || []) add(f, 'test-case');

  // Gắn mã REQ/TC vào từng file để danh sách bên trái đọc được mà không cần mở file.
  for (const req of (reqParse.requirements || new Map()).values()) {
    for (const f of req.files || []) {
      const entry = seen.get(f);
      if (entry && !entry.ids.includes(req.id)) entry.ids.push(req.id);
    }
  }
  for (const tc of (tcParse.testCases || new Map()).values()) {
    const entry = seen.get(tc.file);
    if (entry && !entry.ids.includes(tc.id)) entry.ids.push(tc.id);
  }

  const documents = [...seen.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path),
  );
  return { available: true, analyzer: status, dirs, documents };
}

/**
 * Đọc nội dung THÔ của một tài liệu. Không diễn giải, không sửa, không bao giờ ghi.
 * Việc dựng Markdown thành DOM do phía trình duyệt làm, bằng createElement — tuyệt đối
 * không dùng innerHTML, vì nội dung này do dự án viết và có thể chứa HTML.
 */
function readDocument(root, relPath) {
  const wanted = String(relPath || '').split('\\').join('/').trim();
  if (!wanted) throw Object.assign(new Error('Thiếu đường dẫn tài liệu.'), { status: 400 });

  const { documents, available, analyzer: status } = listDocuments(root);
  if (!available) throw Object.assign(new Error(status.error), { status: 503 });

  const entry = documents.find((d) => d.path === wanted);
  if (!entry) {
    throw Object.assign(
      new Error(`Không có tài liệu "${wanted}" trong danh sách đọc được của repo này.`),
      { status: 404 },
    );
  }

  const absPath = path.join(root, entry.path);
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch (_) {
    throw Object.assign(new Error(`Không đọc được ${entry.path}.`), { status: 404 });
  }
  if (stat.size > MAX_DOCUMENT_BYTES) {
    throw Object.assign(
      new Error(`Tài liệu lớn hơn giới hạn ${Math.round(MAX_DOCUMENT_BYTES / 1024)} KB.`),
      { status: 413 },
    );
  }

  return {
    path: entry.path,
    kind: entry.kind,
    name: entry.name,
    ids: entry.ids,
    bytes: stat.size,
    content: fs.readFileSync(absPath, 'utf8'),
  };
}

/**
 * Ghi lại một tài liệu REQUIREMENT.
 *
 * Đây là ngoại lệ DUY NHẤT của quy tắc "mục QA chỉ đọc requirements/". Ngoại lệ được thu
 * hẹp hết mức có thể:
 *  - chỉ file đã nằm trong danh sách trắng của listDocuments();
 *  - chỉ `kind === 'requirement'`. test-cases/ vẫn tuyệt đối chỉ đọc: nó là đầu ra của
 *    quy trình viết test, sửa tay ở đây sẽ lệch khỏi nguồn sinh ra nó;
 *  - luôn sao lưu trước khi ghi;
 *  - khoá lạc quan theo số byte: nếu file đã đổi trên đĩa kể từ lúc mở, từ chối ghi thay
 *    vì lặng lẽ đè mất thay đổi của người khác (hoặc của AI agent đang chạy).
 */
function saveDocument(root, payload = {}) {
  const wanted = String(payload.path || '').split('\\').join('/').trim();
  if (!wanted) throw Object.assign(new Error('Thiếu đường dẫn tài liệu.'), { status: 400 });

  if (typeof payload.content !== 'string') {
    throw Object.assign(new Error('Thiếu nội dung tài liệu.'), { status: 400 });
  }

  const { documents, available, analyzer: status } = listDocuments(root);
  if (!available) throw Object.assign(new Error(status.error), { status: 503 });

  const entry = documents.find((d) => d.path === wanted);
  if (!entry) {
    throw Object.assign(
      new Error(`Không có tài liệu "${wanted}" trong danh sách đọc được của repo này.`),
      { status: 404 },
    );
  }
  if (entry.kind !== 'requirement') {
    throw Object.assign(
      new Error('Chỉ sửa được tài liệu requirement. Thư mục test-cases/ là chỉ đọc.'),
      { status: 403 },
    );
  }

  const content = payload.content;
  if (Buffer.byteLength(content, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw Object.assign(
      new Error(`Nội dung lớn hơn giới hạn ${Math.round(MAX_DOCUMENT_BYTES / 1024)} KB.`),
      { status: 413 },
    );
  }
  if (!content.trim()) {
    throw Object.assign(new Error('Không ghi đè tài liệu bằng nội dung rỗng.'), { status: 400 });
  }

  const absPath = path.join(root, entry.path);
  const current = fs.readFileSync(absPath, 'utf8');

  if (payload.expectedBytes !== undefined && payload.expectedBytes !== null) {
    const actual = Buffer.byteLength(current, 'utf8');
    if (Number(payload.expectedBytes) !== actual) {
      throw Object.assign(
        new Error('Tài liệu đã thay đổi trên đĩa kể từ lúc bạn mở. Hãy làm mới rồi sửa lại.'),
        { status: 409 },
      );
    }
  }

  if (current === content) {
    return { path: entry.path, changed: false, backup: null, bytes: Buffer.byteLength(content, 'utf8') };
  }

  const backup = createBackup(entry.path, absPath, root);
  fs.writeFileSync(absPath, content, 'utf8');

  return {
    path: entry.path,
    changed: true,
    backup,
    bytes: Buffer.byteLength(content, 'utf8'),
  };
}

/**
 * Bản thảo BDD cho một hoặc nhiều test case.
 *
 * CHỈ ĐỌC và KHÔNG LƯU. Bản thảo được dựng lại mỗi lần gọi từ tài liệu hiện tại, vì hệ
 * thống còn đang phát triển: test case sẽ đổi, và một bản sao lưu ở đâu đó sẽ lặng lẽ lệch
 * khỏi nguồn. Muốn giữ thì người dùng tự chép ra, có ý thức về thời điểm.
 */
function getBddDraft(root, ids = []) {
  const status = analyzerStatus();
  const { dirs } = readQaConfig(root);
  if (!status.available) {
    throw Object.assign(new Error(status.error), { status: 503 });
  }
  if (!draftBuilder || typeof analyzer.extractTestCaseDetails !== 'function') {
    throw Object.assign(
      new Error('Chưa có bộ sinh bản thảo BDD trong repo này (scripts/lib/bddDraft.js). '
        + 'Chạy một lượt sync từ Hub.'),
      { status: 503 },
    );
  }

  const wanted = [...new Set(
    (Array.isArray(ids) ? ids : String(ids || '').split(','))
      .map((s) => String(s || '').trim().toUpperCase())
      .filter((s) => /^TC-\d{3}$/.test(s)),
  )];
  if (!wanted.length) {
    throw Object.assign(
      new Error('Chưa chọn test case nào (cần mã dạng TC-001).'),
      { status: 400 },
    );
  }
  if (wanted.length > MAX_DRAFT_TEST_CASES) {
    throw Object.assign(
      new Error(`Chọn tối đa ${MAX_DRAFT_TEST_CASES} test case một lần.`),
      { status: 400 },
    );
  }

  const report = analyzer.buildTraceReport({ root, dirs });
  const byId = new Map(report.testCases.map((tc) => [tc.id, tc]));

  // Gom chi tiết từ mọi file test-case: một TC có thể nằm ở file bất kỳ.
  const details = new Map();
  let tcParse = { files: [] };
  try { tcParse = analyzer.parseTestCases(root, dirs.testCases); } catch (_) { /* chưa có thư mục */ }
  for (const file of tcParse.files || []) {
    try {
      const raw = fs.readFileSync(path.join(root, file), 'utf8');
      for (const [id, detail] of analyzer.extractTestCaseDetails(raw)) {
        // File nào có bảng bước thì thắng — bản chỉ có tiêu đề không mang thêm thông tin.
        const existing = details.get(id);
        if (!existing || (!existing.steps.length && detail.steps.length)) details.set(id, detail);
      }
    } catch (_) { /* file không đọc được thì bỏ qua, đã có cảnh báo ở nơi khác */ }
  }

  const drafts = [];
  const missing = [];
  for (const id of wanted) {
    const candidate = byId.get(id);
    const detail = details.get(id);
    if (!candidate && !detail) { missing.push(id); continue; }
    drafts.push(draftBuilder.buildBddDraft({ candidate: candidate || { id }, detail: detail || null, dirs }));
  }

  if (!drafts.length) {
    throw Object.assign(
      new Error(`Không tìm thấy test case nào trong tài liệu: ${missing.join(', ')}.`),
      { status: 404 },
    );
  }

  const text = draftBuilder.buildBddDraftDocument(drafts, {
    source: `${dirs.testCases}/ của repo này`,
  });

  return {
    available: true,
    dirs,
    ids: drafts.map((d) => d.id),
    missing,
    warnings: drafts.flatMap((d) => d.warnings),
    stepCounts: Object.fromEntries(drafts.map((d) => [d.id, d.stepCount])),
    text,
  };
}

function getCandidates(root, limit = 7) {
  const status = analyzerStatus();
  const { dirs } = readQaConfig(root);
  if (!status.available) return { available: false, analyzer: status, candidates: [], dirs };

  const report = analyzer.buildTraceReport({ root, dirs });
  const ranked = analyzer.rankAutomationCandidates(report, Number.isFinite(limit) ? limit : 7);
  return {
    available: true,
    analyzer: status,
    dirs: report.dirs,
    total: report.candidates.length,
    candidates: ranked.map((c) => ({
      id: c.id,
      req: c.req || null,
      acs: c.acs || [],
      priority: c.priority || null,
      automation: c.automation || null,
      file: c.file,
    })),
  };
}

function decisionsPath(root) {
  const { decisionsFile } = readQaConfig(root);
  return { relPath: decisionsFile, absPath: path.join(root, decisionsFile) };
}

/** Một quyết định coi là đã trả lời CHỈ KHI có optionId VÀ có người ký tên. */
function isAnswered(decision) {
  const a = (decision && decision.answer) || {};
  return Boolean(a.optionId && String(a.confirmedBy || '').trim());
}

function getDecisions(root) {
  const { relPath, absPath } = decisionsPath(root);
  // Thiếu file là trạng thái rỗng bình thường, không phải lỗi.
  if (!fs.existsSync(absPath)) {
    return { exists: false, file: relPath, decisions: [], severityOrder: [], answeredCount: 0 };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(absPath, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    throw new Error(`${relPath} không phải JSON hợp lệ: ${error.message}`);
  }
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  return {
    exists: true,
    file: relPath,
    severityOrder: Array.isArray(data.severityOrder) ? data.severityOrder : [],
    answeredCount: decisions.filter(isAnswered).length,
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      severity: d.severity || null,
      blocks: d.blocks || null,
      context: d.context || '',
      options: Array.isArray(d.options) ? d.options : [],
      recommended: d.recommended || null,
      recommendationReason: d.recommendationReason || '',
      status: d.status || 'pending',
      answer: {
        optionId: (d.answer && d.answer.optionId) || null,
        note: (d.answer && d.answer.note) || '',
        confirmedBy: (d.answer && d.answer.confirmedBy) || '',
        confirmedAt: (d.answer && d.answer.confirmedAt) || '',
      },
      answered: isAnswered(d),
    })),
  };
}

/**
 * Ghi ngược DUY NHẤT phần `answer` (và `status` suy ra từ nó) của một quyết định.
 * Mọi field khác của file được giữ nguyên từng byte ngữ nghĩa.
 */
function saveDecisionAnswer(root, payload = {}) {
  const id = String(payload.id || '').trim();
  if (!id) throw Object.assign(new Error('Thiếu mã quyết định.'), { status: 400 });

  const { relPath, absPath } = decisionsPath(root);
  if (!fs.existsSync(absPath)) {
    throw Object.assign(new Error(`Không tìm thấy ${relPath} trong repo này.`), { status: 404 });
  }

  const source = fs.readFileSync(absPath, 'utf8');
  if (Buffer.byteLength(source, 'utf8') > MAX_DECISIONS_BYTES) {
    throw Object.assign(new Error('Nội dung lớn hơn giới hạn 1 MB.'), { status: 413 });
  }

  let data;
  try {
    data = JSON.parse(source.replace(/^﻿/, ''));
  } catch (error) {
    throw Object.assign(new Error(`${relPath} không phải JSON hợp lệ: ${error.message}`), { status: 400 });
  }

  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const target = decisions.find((d) => d && d.id === id);
  if (!target) throw Object.assign(new Error(`Không có quyết định nào mang mã "${id}".`), { status: 404 });

  const optionId = payload.optionId === null || payload.optionId === undefined
    ? null
    : String(payload.optionId).trim() || null;
  if (optionId && !(target.options || []).some((o) => o.id === optionId)) {
    throw Object.assign(new Error(`Phương án "${optionId}" không thuộc quyết định ${id}.`), { status: 400 });
  }

  const confirmedBy = String(payload.confirmedBy || '').trim().slice(0, 120);
  const note = String(payload.note || '').slice(0, 2000);

  target.answer = {
    optionId,
    note,
    confirmedBy,
    confirmedAt: optionId && confirmedBy ? new Date().toISOString() : '',
  };
  target.status = isAnswered(target) ? 'answered' : 'pending';

  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DECISIONS_BYTES) {
    throw Object.assign(new Error('Nội dung lớn hơn giới hạn 1 MB.'), { status: 413 });
  }
  JSON.parse(serialized); // chốt chặn cuối: không bao giờ ghi JSON hỏng

  const backup = createBackup(relPath, absPath, root);
  fs.writeFileSync(absPath, serialized, 'utf8');

  return { backup, decision: { id: target.id, status: target.status, answer: target.answer, answered: isAnswered(target) } };
}

/**
 * Lấy báo cáo tổng quan QA chuẩn JSON 1.0.0 (Coverage, System Health, Boundary, Decisions, Findings).
 * Hỗ trợ Soft Fallback: nếu vệ tinh chưa có tools/qa, tự động tổng hợp từ getTrace(root),
 * không để sập route HTTP.
 */
function getQaSummary(root) {
  // 1. Thử gọi trực tiếp in-process
  try {
    const commandsPath = path.join(root, 'tools', 'qa', 'lib', 'commands.js');
    const fallbackCommandsPath = path.join(__dirname, '..', '..', 'tools', 'qa', 'lib', 'commands.js');
    const targetModule = fs.existsSync(commandsPath)
      ? commandsPath
      : (fs.existsSync(fallbackCommandsPath) ? fallbackCommandsPath : null);

    if (targetModule) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const qaCommands = require(targetModule);
      if (typeof qaCommands.summary === 'function') {
        return qaCommands.summary(root, { json: true });
      }
    }
  } catch (_) {
    // Nếu in-process lỗi, thử chạy qua subprocess
    try {
      const qaCliPath = path.join(root, 'tools', 'qa', 'index.js');
      const fallbackCliPath = path.join(__dirname, '..', '..', 'tools', 'qa', 'index.js');
      const cliTarget = fs.existsSync(qaCliPath)
        ? qaCliPath
        : (fs.existsSync(fallbackCliPath) ? fallbackCliPath : null);

      if (cliTarget) {
        const out = execFileSync('node', [cliTarget, 'summary', '--json'], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 15000,
        });
        return JSON.parse(out);
      }
    } catch (__) {
      // Tiếp tục fallback bên dưới
    }
  }

  // 2. Soft Fallback: vệ tinh chưa có tools/qa -> nạp dữ liệu từ getTrace(root)
  try {
    const trace = getTrace(root);
    const reqCount = trace.counts?.requirements || 0;
    const acCount = trace.counts?.acceptanceCriteria || 0;
    const tcCount = trace.counts?.testCases || 0;
    const autoCount = trace.automatedCount || 0;
    const majorCount = trace.majorCount || 0;
    const covPct = acCount > 0 ? Number(((autoCount / acCount) * 100).toFixed(1)) : 0;

    const allFindings = [
      ...(trace.findings?.major || []),
      ...(trace.findings?.minor || []),
      ...(trace.findings?.info || []),
    ];

    return {
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      systemHealth: majorCount > 0 ? 'WARNING' : 'HEALTHY',
      metrics: {
        requirements: reqCount,
        acceptanceCriteria: acCount,
        coveredAcCount: autoCount,
        coveragePercent: covPct,
        testCases: tcCount,
        automatedTests: autoCount,
        wipTests: 0,
        candidateTests: 0,
      },
      health: {
        status: majorCount > 0 ? 'WARNING' : 'HEALTHY',
        blockers: 0,
        majors: majorCount,
        minors: 0,
        totalFindings: allFindings.length,
      },
      boundary: {
        status: 'ALIGNED',
        shipCount: 0,
        seedCount: 0,
        ownCount: 0,
        problems: [],
      },
      decisions: {
        total: 0,
        pending: 0,
        blocking: 0,
      },
      findings: allFindings,
      fallback: true,
      fallbackMessage: 'Hiển thị dữ liệu từ parser nội bộ (chưa có tools/qa).',
    };
  } catch (err) {
    return {
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      systemHealth: 'WARNING',
      metrics: {
        requirements: 0,
        acceptanceCriteria: 0,
        coveredAcCount: 0,
        coveragePercent: 0,
        testCases: 0,
        automatedTests: 0,
        wipTests: 0,
        candidateTests: 0,
      },
      health: {
        status: 'WARNING',
        blockers: 0,
        majors: 0,
        minors: 0,
        totalFindings: 0,
      },
      boundary: {
        status: 'MISSING',
        shipCount: 0,
        seedCount: 0,
        ownCount: 0,
        problems: [],
      },
      decisions: {
        total: 0,
        pending: 0,
        blocking: 0,
      },
      findings: [],
      fallback: true,
      fallbackMessage: `Không thể đọc thông tin QA: ${err.message}`,
    };
  }
}

/**
 * Chạy tính năng Auto-Fix tự động chuẩn hóa liên kết và đăng ký candidate.
 * Hỗ trợ { dryRun: true } để xem trước mà không ghi file.
 */
function runQaFix(root, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const fixerPath = path.join(root, 'tools', 'qa', 'lib', 'fixer.js');
  const fallbackFixerPath = path.join(__dirname, '..', '..', 'tools', 'qa', 'lib', 'fixer.js');
  const targetModule = fs.existsSync(fixerPath)
    ? fixerPath
    : (fs.existsSync(fallbackFixerPath) ? fallbackFixerPath : null);

  if (!targetModule) {
    throw Object.assign(
      new Error('Chưa có bộ công cụ tools/qa/lib/fixer.js trong repo này hoặc Hub.'),
      { status: 501 },
    );
  }

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { fixTraceability } = require(targetModule);
  const { dirs } = readQaConfig(root);
  const projectDir = dirs.specs ? (dirs.specs.startsWith('playwright/') ? 'playwright' : '.') : 'playwright';

  const res = fixTraceability(root, {
    dryRun,
    testCasesDir: dirs.testCases || 'test-cases',
    projectDir,
    reqId: options.reqId || null,
  });

  if (!res.ok && res.error) {
    return {
      ok: false,
      dryRun,
      message: res.error,
      reconciledLinks: 0,
      registeredCandidates: 0,
      updatedFiles: 0,
      changes: [],
    };
  }

  const changes = res.changes || [];
  const reconciledLinks = changes.filter((c) => c.kind === 'chuan-hoa-duong-dan-spec').length;
  const registeredCandidates = changes.filter((c) => c.kind === 'them-test-case-chua-khai-bao').length;

  return {
    ok: true,
    dryRun,
    message: dryRun
      ? (changes.length > 0
        ? `Xem trước: phát hiện ${changes.length} mục cần chuẩn hóa (${reconciledLinks} đường dẫn spec, ${registeredCandidates} candidate mới).`
        : 'Xem trước: Tất cả liên kết đã chuẩn hóa, không có thay đổi nào.')
      : (changes.length > 0
        ? `Đã chuẩn hóa thành công ${changes.length} mục trên ${res.modifiedFilesCount || 0} file (${reconciledLinks} đường dẫn spec, ${registeredCandidates} candidate mới).`
        : 'Tất cả liên kết đã ở trạng thái chuẩn, không có tệp nào cần cập nhật.'),
    reconciledLinks,
    registeredCandidates,
    updatedFiles: res.modifiedFilesCount || 0,
    changes,
  };
}

/**
 * Lấy metadata phục vụ Scaffold Wizard (Mã REQ tiếp theo và danh mục Domain hiện có).
 */
function getScaffoldMeta(root) {
  const scaffoldPath = path.join(root, 'tools', 'scaffold', 'index.js');
  const fallbackScaffoldPath = path.join(__dirname, '..', '..', 'tools', 'scaffold', 'index.js');
  const targetModule = fs.existsSync(scaffoldPath)
    ? scaffoldPath
    : (fs.existsSync(fallbackScaffoldPath) ? fallbackScaffoldPath : null);

  const { dirs } = readQaConfig(root);
  const reqDir = path.resolve(root, dirs.requirements || 'requirements');
  const projectDir = path.resolve(root, dirs.specs && dirs.specs.startsWith('playwright/') ? 'playwright' : '.');

  if (targetModule) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const scaffold = require(targetModule);
    const nextReqId = scaffold.suggestNextReqId(reqDir);
    const existingDomains = scaffold.listExistingDomains(projectDir);
    return { nextReqId, existingDomains };
  }

  // Fallback nếu thiếu tools/scaffold
  let nextReqId = 'REQ-001';
  try {
    if (fs.existsSync(reqDir)) {
      const files = fs.readdirSync(reqDir).filter((f) => f.endsWith('.md'));
      const ids = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(reqDir, file), 'utf8');
          const m = content.match(/^id:\s*REQ-(\d+)/im);
          if (m) ids.push(parseInt(m[1], 10));
        } catch (_) {}
      }
      if (ids.length > 0) nextReqId = `REQ-${String(Math.max(...ids) + 1).padStart(3, '0')}`;
    }
  } catch (_) {}

  return { nextReqId, existingDomains: ['auth'] };
}

/**
 * Tạo bộ kịch bản và truy vết (REQ, TC, Spec) hoặc suy luận ngược từ file spec (inferFromSpec).
 */
function generateScaffold(root, payload = {}) {
  const scaffoldPath = path.join(root, 'tools', 'scaffold', 'index.js');
  const fallbackScaffoldPath = path.join(__dirname, '..', '..', 'tools', 'scaffold', 'index.js');
  const targetModule = fs.existsSync(scaffoldPath)
    ? scaffoldPath
    : (fs.existsSync(fallbackScaffoldPath) ? fallbackScaffoldPath : null);

  if (!targetModule) {
    throw Object.assign(new Error('Chưa có bộ công cụ tools/scaffold trong repo này hoặc Hub.'), { status: 501 });
  }

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const scaffold = require(targetModule);

  if (payload.inferFromSpecPath) {
    const specFile = String(payload.inferFromSpecPath).trim();
    if (!specFile) throw Object.assign(new Error('Thiếu đường dẫn spec để suy luận ngược.'), { status: 400 });
    const res = scaffold.inferFromSpec({
      root,
      specFile,
      force: Boolean(payload.force),
    });
    return {
      ok: true,
      mode: 'infer',
      message: `Đã suy luận thành công bộ tài liệu từ spec "${path.basename(specFile)}".`,
      reqId: res.req,
      title: res.title,
      created: [
        res.reqFile ? path.relative(root, res.reqFile).replace(/\\/g, '/') : '',
        res.tcFile ? path.relative(root, res.tcFile).replace(/\\/g, '/') : '',
      ].filter(Boolean),
    };
  }

  const reqId = String(payload.reqId || '').trim().toUpperCase();
  if (!reqId || !/^REQ-\d{3}$/.test(reqId)) {
    throw Object.assign(new Error(`Mã Requirement không hợp lệ: "${reqId}" (yêu cầu định dạng REQ-001).`), { status: 400 });
  }
  const title = String(payload.title || '').trim();
  if (!title) {
    throw Object.assign(new Error('Tiêu đề tính năng không được để trống.'), { status: 400 });
  }

  const domain = String(payload.domain || '').trim().toLowerCase() || 'general';
  const acCount = Math.max(1, parseInt(payload.acCount, 10) || 2);

  const res = scaffold.generateScaffold({
    root,
    reqId,
    title,
    domain,
    acCount,
    force: Boolean(payload.force),
  });

  return {
    ok: true,
    mode: 'scaffold',
    message: `Đã khởi tạo thành công 3 file cho ${reqId} (${title}).`,
    created: res.created || [],
  };
}

module.exports = {
  analyzerStatus,
  readQaConfig,
  getTrace,
  getCandidates,
  listDocuments,
  readDocument,
  saveDocument,
  getBddDraft,
  MAX_DRAFT_TEST_CASES,
  MAX_DOCUMENT_BYTES,
  getDecisions,
  saveDecisionAnswer,
  isAnswered,
  FALLBACK_DIRS,
  getQaSummary,
  runQaFix,
  getScaffoldMeta,
  generateScaffold,
};
