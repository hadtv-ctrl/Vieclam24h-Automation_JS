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

module.exports = {
  analyzerStatus,
  readQaConfig,
  getTrace,
  getCandidates,
  getDecisions,
  saveDecisionAnswer,
  isAnswered,
  FALLBACK_DIRS,
};
