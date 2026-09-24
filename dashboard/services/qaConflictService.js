// master-process-disable-size-check: QA Traceability Conflict resolution and arbitration service
'use strict';

/**
 * dashboard/services/qaConflictService.js
 *
 * Dịch vụ Hòa Giải Xung Đột Truy Vết (Traceability Conflict Resolution Service)
 * cho phân hệ QA Docs & Automation.
 *
 * Tính năng chính:
 * 1. Bóc tách và cấu trúc hóa siêu dữ liệu xung đột từ lỗi 'ac-lech-giua-tai-lieu-va-spec'.
 * 2. Đồng bộ 2 chiều (Bi-directional Sync):
 *    - sync_doc_to_spec: Cập nhật file Markdown (test-cases/*.md) theo Spec.
 *    - sync_spec_to_doc: Cập nhật file Playwright (.spec.js) theo Tài liệu.
 * 3. Trọng tài AI Copilot (AI Arbitrator): Phân tích code assertion và Given-When-Then
 *    để chẩn đoán bên nào đúng và đưa ra đề xuất có giải thích.
 * 4. Chuyển thành Quyết Định (Escalate to Decisions): Tự động ghi vào decisions.json.
 * 5. Tự động sao lưu an toàn (createBackup) trước mọi thay đổi.
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseEnvFile } = require('../routes/aiRoutes');
const { createBackup } = require('./resourceService');
const { resolveSafePath } = require('./qaFindingFixerService');

/**
 * Bóc tách chuỗi detail thành cấu trúc xung đột chuẩn
 * Ví dụ: "tests/e2e/desktop/admin-add-company.spec.js: TC-011 ghi AC-002 nhưng tài liệu khai AC-003"
 */
function parseConflictDetail(detailStr) {
  if (!detailStr || typeof detailStr !== 'string') return null;

  // Regex nhận diện cú pháp chuẩn của qaTrace (linh hoạt với nhiều định dạng TC)
  const m = detailStr.match(/^(.*?):\s*([A-Za-z0-9_.-]+)\s+ghi\s+([A-Za-z0-9_,-]+)\s+nhưng tài liệu khai\s+([A-Za-z0-9_,-]+)$/);
  if (!m) return null;

  const specFile = m[1].trim().replace(/\\/g, '/');
  const tcId = m[2].trim();
  const specAcs = m[3].trim().split(',').map((s) => s.trim());
  const docAcs = m[4].trim().split(',').map((s) => s.trim());

  return {
    specFile,
    tcId,
    specAcs,
    docAcs,
    specAc: specAcs[0] || '',
    docAc: docAcs[0] || '',
  };
}

/**
 * Tìm file tài liệu test-case tương ứng với mã TC (quét đệ quy toàn bộ thư mục con)
 */
function findDocFileForTc(root, tcId) {
  let testCasesDir = 'test-cases';
  try {
    const cfgPath = path.join(root, 'qa.config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.testCases) testCasesDir = cfg.testCases;
    }
  } catch (_) {}

  const absDir = path.join(root, testCasesDir);
  if (!fs.existsSync(absDir)) return null;

  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return null;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name.toLowerCase() !== 'readme.md' &&
        entry.name.toLowerCase() !== 'traceability.md'
      ) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(tcId)) {
            return path.relative(root, full).split(path.sep).join('/');
          }
        } catch (_) {}
      }
    }
    return null;
  };

  return walk(absDir);
}

/**
 * Lấy ngữ cảnh chi tiết của Test trong Spec và AC trong Tài liệu
 */
function getConflictContext(root, { specFile, tcId, docFile, specAc, docAc }) {
  const context = {
    specSnippet: '',
    specLine: null,
    docSnippet: '',
    docLine: null,
    docFile: docFile || findDocFileForTc(root, tcId),
  };

  // 1. Đọc code từ specFile
  const specSafe = resolveSafePath(root, specFile);
  if (specSafe && fs.existsSync(specSafe.absPath)) {
    try {
      const lines = fs.readFileSync(specSafe.absPath, 'utf8').split(/\r?\n/);
      const idx = lines.findIndex((l) => l.includes(tcId));
      if (idx !== -1) {
        context.specLine = idx + 1;
        const start = Math.max(0, idx - 2);
        const end = Math.min(lines.length, idx + 15);
        context.specSnippet = lines.slice(start, end).join('\n');
      }
    } catch (_) {}
  }

  // 2. Đọc từ docFile
  if (context.docFile) {
    const docSafe = resolveSafePath(root, context.docFile);
    if (docSafe && fs.existsSync(docSafe.absPath)) {
      try {
        const lines = fs.readFileSync(docSafe.absPath, 'utf8').split(/\r?\n/);
        const idx = lines.findIndex((l) => l.includes(tcId));
        if (idx !== -1) {
          context.docLine = idx + 1;
          context.docSnippet = lines[idx];
        }
      } catch (_) {}
    }
  }

  return context;
}

/**
 * Trọng tài AI chẩn đoán xung đột giữa Spec và Tài liệu
 */
async function arbitrateWithAi({ root, specFile, tcId, docFile, specAc, docAc, clientConfig }) {
  const context = getConflictContext(root, { specFile, tcId, docFile, specAc, docAc });

  const env = parseEnvFile(path.join(root, '.env'));
  const apiKey = (clientConfig && clientConfig.apiKey) || env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY;
  const provider = (clientConfig && clientConfig.provider) || env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
  const baseURL = (clientConfig && clientConfig.baseURL) || env.AI_BASE_URL || '';
  const model = (clientConfig && clientConfig.model) || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  if (!apiKey) {
    // Heuristic Fallback
    return {
      recommendation: 'sync_doc_to_spec',
      confidence: '85%',
      recommendedAc: specAc,
      reason: `Mã kiểm thử ${specFile} đang trực tiếp thực thi và kiểm định logic thực tế với mã ${specAc}. Khuyến nghị cập nhật tài liệu theo Spec để phản ánh đúng hiện trạng code.`,
      context,
      engine: 'heuristic',
    };
  }

  const systemPrompt = `Bạn là Principal QA Architect & Lead Business Analyst.
Nhiệm vụ của bạn là làm TRỌNG TÀI HÒA GIẢI XUNG ĐỘT TRUY VẾT (Traceability Mismatch):
Một kịch bản test Playwright (${tcId}) đang được gắn với ${specAc} trong mã nguồn, nhưng tài liệu đặc tả lại khai báo nó gắn với ${docAc}.

HÃY ĐỌC ĐOẠN CODE TEST THỰC TẾ và trả lời:
1. Đoạn code test thực tế đang kiểm tra tiêu chí nào (${specAc} hay ${docAc})?
2. Nên đồng bộ theo phía nào: "sync_doc_to_spec" (sửa tài liệu theo spec) hay "sync_spec_to_doc" (sửa spec theo tài liệu)?

TRẢ VỀ ĐỐI TƯỢNG JSON HỢP LỆ THUẦN TÚY:
{
  "recommendation": "sync_doc_to_spec" | "sync_spec_to_doc",
  "confidence": "90%",
  "recommendedAc": "${specAc}" | "${docAc}",
  "reason": "Giải thích chi tiết căn cứ kỹ thuật (1-2 câu)"
}`;

  const userPrompt = `THÔNG TIN XUNG ĐỘT:
- Test Case ID: ${tcId}
- Phía Spec: File ${specFile} (khai báo: ${specAc})
- Phía Tài Liệu: File ${context.docFile || 'test-cases'} (khai báo: ${docAc})

ĐOẠN MÃ TEST TRONG SPEC:
---
${context.specSnippet || '(Chưa đọc được code test)'}
---

DÒNG TRUY VẾT TRONG TÀI LIỆU:
---
${context.docSnippet || '(Chưa đọc được dòng tài liệu)'}
---

Hãy đưa ra phán quyết hòa giải chuẩn xác dạng JSON.`;

  let responseText = '';

  if (provider === 'gemini') {
    const targetModel = model || 'gemini-2.5-flash';
    const base = (baseURL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/+$/, '');
    const url = `${base}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  } else {
    const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const base = (baseURL || defaultBase).replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }
  }

  try {
    const cleanJson = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      recommendation: parsed.recommendation || 'sync_doc_to_spec',
      confidence: parsed.confidence || '90%',
      recommendedAc: parsed.recommendedAc || specAc,
      reason: parsed.reason || 'AI đã phân tích nội dung assertion trong mã kiểm thử.',
      context,
      engine: 'ai',
    };
  } catch (_) {
    return {
      recommendation: 'sync_doc_to_spec',
      confidence: '80%',
      recommendedAc: specAc,
      reason: `Đề xuất đồng bộ tài liệu theo Spec để phản ánh đúng mã kiểm thử đang chạy.`,
      context,
      engine: 'heuristic',
    };
  }
}

/**
 * Xử lý hòa giải xung đột (Thực thi thay đổi file an toàn)
 */
function resolveConflict(root = process.cwd(), { resolutionType, tcId, specFile, docFile, targetAc, specAc, docAc }) {
  if (!tcId) {
    throw Object.assign(new Error('Thiếu mã Test Case (tcId).'), { status: 400 });
  }

  // 1. ĐỒNG BỘ TÀI LIỆU THEO SPEC (sync_doc_to_spec)
  if (resolutionType === 'sync_doc_to_spec') {
    const actualDocFile = docFile || findDocFileForTc(root, tcId);
    if (!actualDocFile) {
      throw Object.assign(new Error(`Không tìm thấy file tài liệu nào trong test-cases/ chứa ${tcId}.`), { status: 404 });
    }

    const docSafe = resolveSafePath(root, actualDocFile);
    if (!docSafe || !fs.existsSync(docSafe.absPath)) {
      throw Object.assign(new Error(`File tài liệu ${actualDocFile} không tồn tại hoặc bị từ chối truy cập.`), { status: 404 });
    }

    const newAc = targetAc || specAc;
    if (!newAc) throw Object.assign(new Error('Thiếu mã AC mục tiêu cần đồng bộ.'), { status: 400 });

    const backup = createBackup(docSafe.relPath, docSafe.absPath, root);
    const content = fs.readFileSync(docSafe.absPath, 'utf8');
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    let modified = false;

    const newLines = lines.map((line) => {
      if (!line.includes(tcId)) return line;
      // 1. Nếu dòng chứa trực tiếp mã docAc thì thay thế chính xác từ đó
      if (docAc && line.includes(docAc)) {
        modified = true;
        return line.replace(new RegExp(`\\b${docAc}\\b`, 'g'), newAc);
      }
      // 2. Nếu là dòng bảng Markdown
      if (line.trim().startsWith('|')) {
        const parts = line.split('|');
        const tcIdx = parts.findIndex((p) => p.trim() === tcId);
        if (tcIdx > 1) {
          // Cột AC thường nằm ngay trước cột TC trong bảng Traceability
          parts[tcIdx - 1] = ` ${newAc} `;
          modified = true;
          return parts.join('|');
        }
      }
      return line;
    });

    if (!modified) {
      throw Object.assign(new Error(`Không tìm thấy dòng bảng chứa ${tcId} trong ${actualDocFile}.`), { status: 409 });
    }

    fs.writeFileSync(docSafe.absPath, newLines.join(eol), 'utf8');

    return {
      ok: true,
      resolutionType,
      targetFile: docSafe.relPath,
      tcId,
      newAc,
      backup,
      message: `Đã cập nhật ${docSafe.relPath}: ${tcId} chuyển sang ${newAc}.`,
    };
  }

  // 2. SỬA SPEC THEO TÀI LIỆU (sync_spec_to_doc)
  if (resolutionType === 'sync_spec_to_doc') {
    if (!specFile) {
      throw Object.assign(new Error('Thiếu đường dẫn file spec.'), { status: 400 });
    }

    const specSafe = resolveSafePath(root, specFile);
    if (!specSafe || !fs.existsSync(specSafe.absPath)) {
      throw Object.assign(new Error(`File spec ${specFile} không tồn tại hoặc bị từ chối truy cập.`), { status: 404 });
    }

    const newAc = targetAc || docAc;
    const oldAc = specAc;
    if (!newAc) throw Object.assign(new Error('Thiếu mã AC mục tiêu cần đồng bộ.'), { status: 400 });

    const backup = createBackup(specSafe.relPath, specSafe.absPath, root);
    const content = fs.readFileSync(specSafe.absPath, 'utf8');
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    let modified = false;

    const newLines = lines.map((line) => {
      if (!line.includes(tcId)) return line;
      let updatedLine = line;
      if (oldAc && updatedLine.includes(oldAc)) {
        updatedLine = updatedLine.replace(new RegExp(`\\b${oldAc}\\b`, 'gi'), newAc);
        modified = true;
      } else if (!updatedLine.includes(newAc)) {
        // Nếu không tìm thấy oldAc, thêm newAc vào cạnh tcId
        updatedLine = updatedLine.replace(new RegExp(`\\b${tcId}\\b`), `${tcId} - ${newAc}`);
        modified = true;
      }
      return updatedLine;
    });

    if (!modified) {
      throw Object.assign(new Error(`Không tìm thấy đoạn mã chứa ${tcId} trong ${specFile}.`), { status: 409 });
    }

    fs.writeFileSync(specSafe.absPath, newLines.join(eol), 'utf8');

    return {
      ok: true,
      resolutionType,
      targetFile: specSafe.relPath,
      tcId,
      newAc,
      backup,
      message: `Đã cập nhật ${specSafe.relPath}: ${tcId} chuyển sang ${newAc}.`,
    };
  }

  throw Object.assign(new Error(`Loại hòa giải không hợp lệ: ${resolutionType}`), { status: 400 });
}

/**
 * Đẩy xung đột thành một Quyết Định treo trong decisions.json
 */
function escalateConflictToDecision(root = process.cwd(), { tcId, specFile, specAcs, docFile, docAcs, reason }) {
  if (!tcId) {
    throw Object.assign(new Error('Thiếu mã Test Case (tcId).'), { status: 400 });
  }

  const decPath = path.join(root, 'decisions.json');
  let data = {
    version: 1,
    severityOrder: ['blocking', 'urgent'],
    decisions: [],
  };

  if (fs.existsSync(decPath)) {
    try {
      data = JSON.parse(fs.readFileSync(decPath, 'utf8').replace(/^﻿/, ''));
      if (!Array.isArray(data.decisions)) data.decisions = [];
    } catch (_) {}
  }

  // Kiểm tra nếu đã có quyết định pending cho TC này thì tái sử dụng, tránh tạo trùng lặp
  const existingPending = (data.decisions || []).find((d) =>
    d.status === 'pending' && ((d.title && d.title.includes(tcId)) || (d.context && d.context.includes(tcId)))
  );
  if (existingPending) {
    return {
      ok: true,
      decisionId: existingPending.id,
      decision: existingPending,
      message: `Quyết định ${existingPending.id} cho ${tcId} đã tồn tại trong sổ quyết định.`,
      isDuplicate: true,
    };
  }

  // Tạo ID tiếp theo D-01, D-02...
  let nextNum = 1;
  const existingNums = (data.decisions || [])
    .map((d) => {
      const m = String(d.id || '').match(/D-(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(Number.isFinite);

  if (existingNums.length > 0) {
    nextNum = Math.max(...existingNums) + 1;
  }
  const decisionId = `D-${String(nextNum).padStart(2, '0')}`;

  const specAcStr = Array.isArray(specAcs) ? specAcs.join(', ') : (specAcs || 'N/A');
  const docAcStr = Array.isArray(docAcs) ? docAcs.join(', ') : (docAcs || 'N/A');

  const newDecision = {
    id: decisionId,
    title: `Hòa giải xung đột truy vết ${tcId}: Spec (${specAcStr}) vs Tài liệu (${docAcStr})`,
    severity: 'urgent',
    context: `Xung đột tại ${tcId}: Kịch bản ${specFile || 'spec'} đang gắn thẻ ${specAcStr}, nhưng tài liệu ${docFile || 'test-cases'} lại khai báo ${docAcStr}. Cần Product Owner / Tech Lead xác nhận bên làm chuẩn.`,
    options: [
      {
        id: 'theo-spec',
        label: `Đồng bộ tài liệu theo Spec (${specAcStr})`,
        consequence: `Cập nhật lại cột AC của ${tcId} trong bảng Traceability Markdown.`,
      },
      {
        id: 'theo-doc',
        label: `Sửa mã kiểm thử theo Tài liệu (${docAcStr})`,
        consequence: `Sửa lại tag trong file ${specFile || 'spec'}.`,
      },
    ],
    recommended: 'theo-spec',
    recommendationReason: reason || 'Mã kiểm thử thường phản ánh đúng hành vi nghiệp vụ mới nhất mà ứng dụng đang hỗ trợ.',
    status: 'pending',
    answer: {
      optionId: null,
      note: 'Chờ PO / Tech Lead họp chốt phương án',
      confirmedBy: '',
      confirmedAt: '',
    },
  };

  if (fs.existsSync(decPath)) {
    createBackup('decisions.json', decPath, root);
  }
  data.decisions.push(newDecision);
  fs.writeFileSync(decPath, JSON.stringify(data, null, 2), 'utf8');

  return {
    ok: true,
    decisionId,
    decision: newDecision,
    message: `Đã tạo quyết định ${decisionId} thành công trong sổ quyết định.`,
  };
}

module.exports = {
  parseConflictDetail,
  findDocFileForTc,
  getConflictContext,
  arbitrateWithAi,
  resolveConflict,
  escalateConflictToDecision,
};
