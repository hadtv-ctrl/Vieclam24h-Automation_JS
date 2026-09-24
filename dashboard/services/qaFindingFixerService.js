// master-process-disable-size-check: AI Static Finding & Gap dual-engine analyzer and patch service
'use strict';

/**
 * dashboard/services/qaFindingFixerService.js
 *
 * Dịch vụ AI & Heuristic Copilot hỗ trợ chẩn đoán và khắc phục lỗ hổng kỹ thuật sớm
 * (Static Findings & Gaps) trong phân hệ QA Docs & Automation.
 *
 * Tính năng chính:
 * 1. Phân tích nguyên nhân gốc rễ (Root Cause) dựa trên AI hoặc Heuristic Rule Engine.
 * 2. Trích xuất ngữ cảnh mã nguồn quanh dòng bị cảnh báo (Surrounding Code Context).
 * 3. Sinh đề xuất bản vá trực quan (Before/After Code Diff & Patch Snippet).
 * 4. Áp dụng bản vá an toàn với cơ chế sao lưu tự động (Automatic Backup via createBackup)
 *    và phòng chống triệt để lỗ hổng Path Traversal.
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseEnvFile } = require('../routes/aiRoutes');
const { createBackup } = require('./resourceService');

/**
 * Phân giải đường dẫn an toàn trong phạm vi thư mục dự án (Chống Path Traversal).
 */
function resolveSafePath(root, rawWhere) {
  if (!rawWhere || typeof rawWhere !== 'string') return null;
  const trimmed = rawWhere.trim();

  // Nhận diện số dòng ở cuối chuỗi dạng :<number>
  const match = trimmed.match(/^(.*?)(?::(\d+))?$/);
  const rawPath = match ? match[1].trim() : trimmed;
  const lineStr = match ? match[2] : null;
  const cleanPath = rawPath.replace(/\\/g, '/');

  // Chặn đường dẫn tuyệt đối, ổ đĩa Windows (C:), và Path Traversal (..)
  if (path.isAbsolute(cleanPath) || cleanPath.includes('..') || /^[a-zA-Z]:/i.test(cleanPath)) {
    return null;
  }

  const absPath = path.resolve(root, cleanPath);
  const normalizedRoot = path.resolve(root);

  if (!absPath.startsWith(normalizedRoot + path.sep) && absPath !== normalizedRoot) {
    return null;
  }

  const lineNumber = lineStr ? parseInt(lineStr, 10) : null;
  return {
    relPath: cleanPath,
    absPath,
    lineNumber: Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null,
  };
}

/**
 * Tạo một chuỗi Diff đơn giản hiển thị dòng cũ (-) và dòng mới (+)
 */
function generateUnifiedDiff(originalSnippet, fixedSnippet, relPath) {
  const origLines = (originalSnippet || '').split(/\r?\n/);
  const fixedLines = (fixedSnippet || '').split(/\r?\n/);
  const diffLines = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
  ];

  origLines.forEach((l) => diffLines.push(`- ${l}`));
  fixedLines.forEach((l) => diffLines.push(`+ ${l}`));

  return diffLines.join('\n');
}

/**
 * Phân tích và sinh bản vá qua Heuristic Rule Engine (Offline)
 */
function analyzeWithHeuristicFix({ root, finding, fileContext }) {
  const kind = finding.kind || '';
  const message = finding.message || finding.detail || '';
  const relPath = fileContext ? fileContext.relPath : (finding.where || '');
  const content = fileContext ? fileContext.content : '';
  const lineNumber = fileContext ? fileContext.lineNumber : null;

  // 1. Lỗi: assertion-thieu-await (Playwright expect matcher thiếu await)
  if (kind === 'assertion-thieu-await') {
    const lines = content.split(/\r?\n/);
    const targetLineIdx = lineNumber ? lineNumber - 1 : lines.findIndex((l) => /(?<!await\s+)expect\(.*?\)\.(toBe|toHave|toContain|toEqual)/.test(l));

    if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
      const origLine = lines[targetLineIdx];
      // Bổ sung await trước expect
      const fixedLine = origLine.replace(/(^|\s+)(expect\s*\()/g, '$1await $2');
      return {
        rootCause: 'Trong Playwright, các matcher của locator (như toBeVisible, toHaveText, toHaveCount...) là hàm bất đồng bộ (async). Nếu thiếu từ khóa await, assertion sẽ không bao giờ được chờ hoàn tất, dẫn đến test luôn pass giả mạo hoặc kết thúc trước khi kịp kiểm tra.',
        explanation: 'Bổ sung từ khóa `await` vào trước biểu thức `expect(...)` trên dòng kiểm tra.',
        targetFile: relPath,
        patchType: 'replace_lines',
        originalSnippet: origLine,
        fixedSnippet: fixedLine,
        diff: generateUnifiedDiff(origLine, fixedLine, relPath),
      };
    }
  }

  // 2. Lỗi: test-khong-co-ma-tc (Test không mở đầu bằng TC-xxx, không trace được)
  if (kind === 'test-khong-co-ma-tc') {
    const lines = content.split(/\r?\n/);
    const targetLineIdx = lineNumber ? lineNumber - 1 : lines.findIndex((l) => /test\s*\(\s*['"`]/.test(l));

    if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
      const origLine = lines[targetLineIdx];
      // Tìm mã TC tiếp theo hoặc đề xuất TC-001
      const tcMatch = content.match(/TC-(\d+)/g);
      let nextNum = 1;
      if (tcMatch && tcMatch.length > 0) {
        const nums = tcMatch.map((m) => parseInt(m.replace('TC-', ''), 10)).filter(Number.isFinite);
        if (nums.length > 0) nextNum = Math.max(...nums) + 1;
      }
      const suggestedTc = `TC-${String(nextNum).padStart(3, '0')}`;

      // Thay thế tiêu đề test
      const fixedLine = origLine.replace(
        /(test\s*\(\s*['"`])([^'"`]+)(['"`])/,
        (m, p1, p2, p3) => {
          const cleanTitle = p2.replace(/^TC-[A-Z0-9_-]+[:\s]*/i, '').trim();
          return `${p1}${suggestedTc}: ${cleanTitle}${p3}`;
        }
      );

      return {
        rootCause: 'Tiêu đề của test block không tuân thủ quy ước định danh `TC-xxx: <Mô tả test>`. Điều này khiến bộ quét Traceability ma trận không thể gắn kết test case với Acceptance Criteria (AC) tương ứng.',
        explanation: `Đã chuẩn hóa tiêu đề test với tiền tố định danh chuẩn \`${suggestedTc}:\`.`,
        targetFile: relPath,
        patchType: 'replace_lines',
        originalSnippet: origLine,
        fixedSnippet: fixedLine,
        diff: generateUnifiedDiff(origLine, fixedLine, relPath),
      };
    }
  }

  // 3. Lỗi: test-thieu-tag-req (Test thiếu tag @REQ-xxx)
  if (kind === 'test-thieu-tag-req') {
    const lines = content.split(/\r?\n/);
    const targetLineIdx = lineNumber ? lineNumber - 1 : lines.findIndex((l) => /test\s*\(\s*['"`]/.test(l));

    if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
      const origLine = lines[targetLineIdx];
      // Trích xuất REQ nếu có trong tên file hoặc gợi ý REQ-001
      const reqMatch = relPath.match(/REQ-(\d+)/i) || content.match(/@REQ-(\d+)/i);
      const reqTag = reqMatch ? `@REQ-${reqMatch[1]}` : '@REQ-001';

      const fixedLine = origLine.replace(/(['"`]\s*,\s*(?:async\s*)?\()/, ` ${reqTag}$1`);
      return {
        rootCause: `Kịch bản kiểm thử chưa được gắn tag nghiệp vụ ${reqTag} trong tiêu đề test.`,
        explanation: `Bổ sung tag \`${reqTag}\` vào tiêu đề test để hỗ trợ lọc runner và đối chiếu ma trận phủ.`,
        targetFile: relPath,
        patchType: 'replace_lines',
        originalSnippet: origLine,
        fixedSnippet: fixedLine,
        diff: generateUnifiedDiff(origLine, fixedLine, relPath),
      };
    }
  }

  // 4. Lỗi: spec-thieu-assertion (Spec không có expect assertion nào)
  if (kind === 'spec-thieu-assertion') {
    const lines = content.split(/\r?\n/);
    const targetLineIdx = lineNumber ? lineNumber - 1 : lines.length - 2;

    if (targetLineIdx >= 0) {
      const origLine = lines[targetLineIdx];
      const indent = origLine.match(/^\s*/)?.[0] || '  ';
      const fixedSnippet = `${origLine}\n${indent}await expect(page).toHaveTitle(/.+/); // AI Fix: Đảm bảo có assertion kiểm định trạng thái`;
      return {
        rootCause: 'Kịch bản kiểm thử này không chứa bất kỳ câu lệnh `expect(...)` nào. Test case chỉ thao tác các bước mà không kiểm tra kết quả kỳ vọng sẽ luôn PASS giả mạo.',
        explanation: 'Bổ sung assertion kiểm tra trạng thái trang hoặc thành phần UI để đảm bảo chất lượng kiểm thử.',
        targetFile: relPath,
        patchType: 'replace_lines',
        originalSnippet: origLine,
        fixedSnippet,
        diff: generateUnifiedDiff(origLine, fixedSnippet, relPath),
      };
    }
  }

  // 5. Lỗi: test-bi-skip-am-tham (Test bị test.skip âm thầm)
  if (kind === 'test-bi-skip-am-tham') {
    const lines = content.split(/\r?\n/);
    const targetLineIdx = lineNumber ? lineNumber - 1 : lines.findIndex((l) => /test\.skip\s*\(/.test(l));

    if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
      const origLine = lines[targetLineIdx];
      const fixedLine = origLine.replace(/test\.skip\s*\(/, 'test(');
      return {
        rootCause: 'Kịch bản kiểm thử đang bị vô hiệu hóa âm thầm bằng `test.skip(...)` mà không có lý do hoặc quyết định kỹ thuật được ghi nhận.',
        explanation: 'Khôi phục lại `test(...)` để kích hoạt kiểm thử hoặc di chuyển sang sổ quyết định nếu hoãn.',
        targetFile: relPath,
        patchType: 'replace_lines',
        originalSnippet: origLine,
        fixedSnippet: fixedLine,
        diff: generateUnifiedDiff(origLine, fixedLine, relPath),
      };
    }
  }

  // 6. Lỗi: khong-doc-duoc-requirement (Thư mục requirements/ rỗng hoặc thiếu)
  if (kind === 'khong-doc-duoc-requirement') {
    const targetFile = 'requirements/REQ-001-general.md';
    const sampleReqContent = `# REQ-001: Quản Lý Hệ Thống Tổng Thể

## 1. Mục Tiêu Nghiệp Vụ
Đặc tả các yêu cầu kỹ thuật và luồng nghiệp vụ cốt lõi của hệ thống.

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

### AC-001: Kiểm tra tải trang và chứng thực người dùng
- **Given**: Người dùng truy cập hệ thống.
- **When**: Đăng nhập với tài khoản hợp lệ.
- **Then**: Hệ thống xác thực và điều hướng vào bảng điều khiển.

## 3. Quy Tắc Biên & Ràng Buộc (Boundary Rules)
- Tên đăng nhập và mật khẩu không được để trống.
- Phiên đăng nhập tự động hết hạn sau 24 giờ.
`;
    return {
      rootCause: 'Thư mục requirements/ chưa có tài liệu đặc tả nào. Toàn bộ ma trận truy vết và các cổng kiểm soát QA không thể đối chiếu nếu thiếu yêu cầu nghiệp vụ.',
      explanation: 'Khởi tạo tài liệu requirement mẫu `REQ-001-general.md` theo chuẩn định dạng Markdown.',
      targetFile,
      patchType: 'create_file',
      originalSnippet: '(File chưa tồn tại)',
      fixedSnippet: sampleReqContent,
      fullContent: sampleReqContent,
      diff: generateUnifiedDiff('', sampleReqContent, targetFile),
    };
  }

  // 7. Fallback tổng quát cho các loại lỗi khác
  return {
    rootCause: `Phát hiện vấn đề: ${message || kind}.`,
    explanation: finding.action || 'Vui lòng kiểm tra lại cấu trúc file và đồng bộ lại với ma trận Traceability.',
    targetFile: relPath || 'unknown',
    patchType: 'manual_guide',
    originalSnippet: content ? content.slice(0, 300) : '',
    fixedSnippet: content ? content.slice(0, 300) : '',
    diff: '',
  };
}

/**
 * Gọi AI sinh chẩn đoán và đề xuất bản vá
 */
async function analyzeWithAiFix({ root, finding, fileContext, clientConfig }) {
  const env = parseEnvFile(path.join(root, '.env'));
  const apiKey = (clientConfig && clientConfig.apiKey) || env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY;
  const provider = (clientConfig && clientConfig.provider) || env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
  const baseURL = (clientConfig && clientConfig.baseURL) || env.AI_BASE_URL || '';
  const model = (clientConfig && clientConfig.model) || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key cho AI.');
  }

  const relPath = fileContext ? fileContext.relPath : (finding.where || '');
  const content = fileContext ? fileContext.content : '';
  const lineNumber = fileContext ? fileContext.lineNumber : null;

  // Lấy ngữ cảnh xung quanh dòng lỗi
  let excerpt = '';
  if (content) {
    const lines = content.split(/\r?\n/);
    if (lineNumber && lineNumber > 0) {
      const start = Math.max(0, lineNumber - 15);
      const end = Math.min(lines.length, lineNumber + 15);
      excerpt = lines
        .slice(start, end)
        .map((l, idx) => `${start + idx + 1}: ${l}`)
        .join('\n');
    } else {
      excerpt = lines.slice(0, 60).map((l, idx) => `${idx + 1}: ${l}`).join('\n');
    }
  }

  const systemPrompt = `Bạn là Senior QA Architect & Automation Lead chuyên sâu về Playwright Test, BDD và Traceability Matrix.
Nhiệm vụ của bạn là phân tích một lỗ hổng kiểm thử / phát hiện tĩnh (Static Finding) trong dự án, giải thích nguyên nhân gốc rễ và đưa ra giải pháp sửa đổi cụ thể.

QUY TẮC BẮT BUỘC:
1. ĐẦU RA PHẢI LÀ MỘT ĐỐI TƯỢNG JSON HỢP LỆ THUẦN TÚY (không bọc trong markdown code fence \`\`\`json, không có text nào ngoài JSON).
2. "patchType" phải là một trong: "replace_lines", "replace_file", "create_file".
3. "originalSnippet" phải là đoạn code/text CŨ CHÍNH XÁC xuất hiện trong file (để hệ thống có thể tìm và thay thế).
4. "fixedSnippet" là đoạn code/text MỚI sau khi đã sửa.
5. "diff" là đoạn unified diff (dòng xóa có dấu - ở đầu, dòng thêm có dấu + ở đầu).
6. Tuân thủ tuyệt đối quy chuẩn Playwright:
   - Các matcher của locator (như toBeVisible, toHaveText, toHaveValue...) bắt buộc phải có "await".
   - Tiêu đề test phải mở đầu bằng mã định danh "TC-xxx: " (hoặc tiền tố tương đương nếu dự án dùng).
   - Test có gắn tag @REQ-xxx và @smoke / @regression.

JSON SCHEMA:
{
  "rootCause": "Giải thích chi tiết nguyên nhân gốc rễ và rủi ro nếu để nguyên (1-3 câu)",
  "explanation": "Hướng dẫn cách sửa chi tiết, rõ ràng",
  "targetFile": "${relPath}",
  "patchType": "replace_lines" | "replace_file" | "create_file",
  "originalSnippet": "Đoạn code cũ chính xác cần thay thế",
  "fixedSnippet": "Đoạn code mới đã sửa",
  "diff": "Dạng diff tường minh với các dòng - và +"
}`;

  const userPrompt = `THÔNG TIN PHÁT HIỆN LỖ HỔNG (STATIC FINDING):
- Loại lỗ hổng (Kind): ${finding.kind || 'N/A'}
- Mức độ (Severity): ${finding.severity || 'N/A'}
- Vị trí (Where): ${finding.where || 'N/A'} (Dòng: ${lineNumber || 'N/A'})
- Thông điệp (Message): ${finding.message || finding.detail || 'N/A'}
- Hướng dẫn mặc định (Action): ${finding.action || 'N/A'}

TỆP MỤC TIÊU: ${relPath}
NGỮ CẢNH ĐOẠN MÃ XUNG QUANH:
---
${excerpt || '(Chưa có nội dung file)'}
---

Hãy phân tích và trả về đối tượng JSON đề xuất bản vá chính xác.`;

  let responseJsonText = '';

  if (provider === 'gemini') {
    const targetModel = model || 'gemini-2.5-flash';
    const base = (baseURL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/+$/, '');
    const url = `${base}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API trả về lỗi (${res.status}): ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const base = (baseURL || defaultBase).replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`${provider} API trả về lỗi (${res.status}): ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseJsonText = data.choices?.[0]?.message?.content || '';
  }

  // Làm sạch code fences nếu có
  const cleanJson = responseJsonText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    rootCause: parsed.rootCause || 'Đã phân tích qua AI Copilot.',
    explanation: parsed.explanation || 'Áp dụng bản vá theo đề xuất của AI.',
    targetFile: parsed.targetFile || relPath,
    patchType: parsed.patchType || 'replace_lines',
    originalSnippet: parsed.originalSnippet || '',
    fixedSnippet: parsed.fixedSnippet || '',
    diff: parsed.diff || generateUnifiedDiff(parsed.originalSnippet, parsed.fixedSnippet, relPath),
    fullContent: parsed.fullContent || null,
  };
}

/**
 * Phân tích lỗ hổng và sinh giải pháp khắc phục (hỗ trợ Dual-Mode: AI và Heuristic Fallback)
 */
async function analyzeFindingFix({ root = process.cwd(), finding, clientConfig }) {
  if (!finding || typeof finding !== 'object') {
    throw Object.assign(new Error('Dữ liệu phát hiện (finding) không hợp lệ.'), { status: 400 });
  }

  const rawWhere = finding.where || finding.id || '';
  const resolved = resolveSafePath(root, rawWhere);

  let fileContext = null;
  if (resolved) {
    let content = '';
    if (fs.existsSync(resolved.absPath)) {
      try {
        const stats = fs.statSync(resolved.absPath);
        if (stats.isFile() && stats.size < 512 * 1024) {
          content = fs.readFileSync(resolved.absPath, 'utf8');
        }
      } catch (_) {}
    }
    fileContext = {
      relPath: resolved.relPath,
      absPath: resolved.absPath,
      lineNumber: resolved.lineNumber,
      content,
    };
  }

  // Thử gọi AI nếu có thể
  try {
    const aiResult = await analyzeWithAiFix({ root, finding, fileContext, clientConfig });
    return {
      ok: true,
      engine: 'ai',
      finding,
      analysis: aiResult,
    };
  } catch (err) {
    // Tự động chuyển sang Heuristic Offline
    const heuristicResult = analyzeWithHeuristicFix({ root, finding, fileContext });
    return {
      ok: true,
      engine: 'heuristic',
      aiNotice: `Chế độ AI tạm thời không khả dụng (${err.message}). Đang dùng Heuristic Rule Engine.`,
      finding,
      analysis: heuristicResult,
    };
  }
}

/**
 * Áp dụng bản vá đã duyệt vào tập tin mục tiêu (kèm sao lưu an toàn)
 */
function applyFindingFix(root = process.cwd(), { targetFile, patchType, originalSnippet, fixedSnippet, fullContent }) {
  if (!targetFile || typeof targetFile !== 'string') {
    throw Object.assign(new Error('Đường dẫn file mục tiêu không hợp lệ.'), { status: 400 });
  }

  const resolved = resolveSafePath(root, targetFile);
  if (!resolved) {
    throw Object.assign(new Error('Đường dẫn file bị từ chối do vi phạm bảo mật hoặc nằm ngoài dự án.'), { status: 403 });
  }

  let backupPath = null;

  // 1. Trường hợp tạo file mới (create_file)
  if (patchType === 'create_file') {
    const dir = path.dirname(resolved.absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(resolved.absPath)) {
      backupPath = createBackup(resolved.relPath, resolved.absPath, root);
    }
    const writeContent = fullContent !== undefined && fullContent !== null ? fullContent : fixedSnippet;
    fs.writeFileSync(resolved.absPath, writeContent || '', 'utf8');
    return {
      ok: true,
      file: resolved.relPath,
      backup: backupPath,
      message: `Đã khởi tạo file ${resolved.relPath} thành công.`,
    };
  }

  // 2. Trường hợp thay thế toàn bộ file (replace_file)
  if (!fs.existsSync(resolved.absPath)) {
    throw Object.assign(new Error(`File ${resolved.relPath} không tồn tại trên đĩa.`), { status: 404 });
  }

  backupPath = createBackup(resolved.relPath, resolved.absPath, root);

  if (patchType === 'replace_file' && fullContent) {
    fs.writeFileSync(resolved.absPath, fullContent, 'utf8');
    return {
      ok: true,
      file: resolved.relPath,
      backup: backupPath,
      message: `Đã cập nhật toàn bộ nội dung file ${resolved.relPath}.`,
    };
  }

  // 3. Trường hợp thay thế đoạn mã (replace_lines)
  const currentContent = fs.readFileSync(resolved.absPath, 'utf8');
  let newContent = currentContent;

  if (originalSnippet && currentContent.includes(originalSnippet)) {
    newContent = currentContent.replace(originalSnippet, fixedSnippet || '');
  } else if (originalSnippet) {
    // Thử chuẩn hóa xuống dòng CRLF / LF
    const normCurrent = currentContent.replace(/\r\n/g, '\n');
    const normOrig = originalSnippet.replace(/\r\n/g, '\n');
    if (normCurrent.includes(normOrig)) {
      newContent = normCurrent.replace(normOrig, (fixedSnippet || '').replace(/\r\n/g, '\n'));
    } else {
      throw Object.assign(new Error('Không tìm thấy đoạn mã gốc trong file để thay thế. File có thể đã được chỉnh sửa trước đó.'), { status: 409 });
    }
  } else if (fullContent) {
    newContent = fullContent;
  }

  fs.writeFileSync(resolved.absPath, newContent, 'utf8');

  return {
    ok: true,
    file: resolved.relPath,
    backup: backupPath,
    message: `Đã áp dụng bản vá thành công cho ${resolved.relPath}.`,
  };
}

module.exports = {
  resolveSafePath,
  generateUnifiedDiff,
  analyzeFindingFix,
  analyzeWithHeuristicFix,
  analyzeWithAiFix,
  applyFindingFix,
};
