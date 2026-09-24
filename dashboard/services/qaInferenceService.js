// master-process-disable-size-check: Legacy service module, queued for modular decomposition
/**
 * dashboard/services/qaInferenceService.js
 * Tự động rà soát câu hỏi đã chốt (Open Questions) và suy luận đề xuất Test Cases còn thiếu.
 * Hỗ trợ 2 chế độ:
 *  - Heuristic Engine (Mặc định, offline, zero-token, bắt các quy tắc biên BVA, định dạng, rẽ nhánh)
 *  - AI Semantic Engine (Tùy chọn khi có API Key: Gemini, OpenAI, DeepSeek)
 */

const fs = require('fs');
const path = require('path');
const { createBackup } = require('./resourceService');
const { parseEnvFile } = require('../routes/aiRoutes');

const RE_REQ = /\bREQ-(\d{3})\b/;
const RE_AC = /\bAC-(\d{3})\b/g;
const RE_TC = /\bTC-(\d{3})\b/g;

/**
 * Trích xuất danh sách Acceptance Criteria từ văn bản Requirement
 */
function extractAcs(markdown) {
  const acs = [];
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#{2,4}\s*(AC-\d{3})\b[:\s\-—]*(.*)$/i);
    if (m) {
      acs.push({ id: m[1].toUpperCase(), title: m[2].trim() });
    }
  }
  if (!acs.length) {
    for (const line of lines) {
      const allMatches = line.matchAll(RE_AC);
      for (const match of allMatches) {
        const id = match[0].toUpperCase();
        if (!acs.some((a) => a.id === id)) {
          acs.push({ id, title: line.trim().slice(0, 100) });
        }
      }
    }
  }
  return acs;
}

/**
 * Trích xuất các câu hỏi đã chốt trong mục Open Questions
 */
function extractDecidedQuestions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const qSectionIdx = lines.findIndex((l) => /^#{1,6}\s+open\s+questions\b/i.test(l));
  if (qSectionIdx === -1) return [];

  const decided = [];
  for (let i = qSectionIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,4}\s+/.test(line)) break; // Ra khỏi section open questions

    const isNumbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const isBullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (!isNumbered && !isBullet) continue;

    const rawText = (isNumbered ? isNumbered[2] : isBullet[1]).trim();
    if (/\*\*Đã chốt\b/i.test(rawText)) {
      const splitDecided = rawText.split(/\*\*Đã chốt[^*]*\*\*:?\s*/i);
      const questionPart = splitDecided[0].replace(/\s*[—–-]\s*c[ầa]n\s+[^—–-]*?x[áa]c\s+nh[ậa]n\s*$/i, '').trim();
      const decisionPart = (splitDecided[1] || '').trim();

      decided.push({
        id: isNumbered ? `Q-${isNumbered[1]}` : `Q-${decided.length + 1}`,
        raw: rawText,
        question: questionPart,
        decision: decisionPart,
      });
    }
  }
  return decided;
}

/**
 * Tìm file test-cases tương ứng với REQ-xxx
 */
function findTestCaseFile(root, reqId) {
  const dirsToTry = ['test-cases', 'testCases'];
  for (const d of dirsToTry) {
    const absDir = path.join(root, d);
    if (fs.existsSync(absDir)) {
      const files = fs.readdirSync(absDir);
      const match = files.find((f) => f.toUpperCase().includes(reqId.toUpperCase()) && f.endsWith('.md'));
      if (match) {
        return {
          relPath: path.posix.join(d, match),
          absPath: path.join(absDir, match),
          exists: true,
        };
      }
      return {
        relPath: path.posix.join(d, `${reqId}.md`),
        absPath: path.join(absDir, `${reqId}.md`),
        exists: false,
      };
    }
  }
  return {
    relPath: path.posix.join('test-cases', `${reqId}.md`),
    absPath: path.join(root, 'test-cases', `${reqId}.md`),
    exists: false,
  };
}

/**
 * Lấy mã TC kế tiếp không trùng lặp
 */
function getNextTcId(existingIds, offset = 0) {
  let max = 0;
  for (const id of existingIds) {
    const m = id.match(/TC-(\d{3,})/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > max) max = val;
    }
  }
  return `TC-${String(max + 1 + offset).padStart(3, '0')}`;
}

/**
 * Động cơ Heuristic: Phân tích cú pháp quy chuẩn BVA & Phân vùng tương đương
 */
function inferWithHeuristic({ reqId, decidedQuestions, existingTcIds, existingTcTitles, acs }) {
  const results = [];
  const assignedTcIds = new Set(existingTcIds);

  const allocateId = () => {
    let offset = 0;
    while (true) {
      const candidate = getNextTcId(assignedTcIds, offset);
      if (!assignedTcIds.has(candidate)) {
        assignedTcIds.add(candidate);
        return candidate;
      }
      offset += 1;
    }
  };

  const defaultAcId = acs.length ? acs[0].id : 'AC-001';

  for (const item of decidedQuestions) {
    const text = `${item.question} ${item.decision}`;

    // 1. Phân tích khoảng số / độ dài (Boundary Value Analysis)
    // Ví dụ: "8-32 ký tự", "từ 8 đến 32 ký tự", "tối thiểu 8 ký tự", "tối đa 32 ký tự"
    const rangeMatch = text.match(/(?:từ\s*)?(\d+)\s*(?:đến|-)\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);
    const minMatch = text.match(/tối\s*thiểu\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);
    const maxMatch = text.match(/tối\s*đa\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);

    let min = null;
    let max = null;
    if (rangeMatch) {
      min = parseInt(rangeMatch[1], 10);
      max = parseInt(rangeMatch[2], 10);
    } else {
      if (minMatch) min = parseInt(minMatch[1], 10);
      if (maxMatch) max = parseInt(maxMatch[1], 10);
    }

    // Nhận diện tên trường dữ liệu (mật khẩu, họ tên, email, sđt...)
    let fieldName = 'trường dữ liệu';
    if (/mật\s*khẩu|password/i.test(text)) fieldName = 'mật khẩu';
    else if (/họ\s*tên|name/i.test(text)) fieldName = 'họ tên';
    else if (/số\s*điện\s*thoại|phone|sđt/i.test(text)) fieldName = 'số điện thoại';
    else if (/email/i.test(text)) fieldName = 'email';

    if (min !== null && min > 0) {
      // Test case biên dưới (Negative: min - 1)
      const belowTitle = `Kiểm tra thất bại khi ${fieldName} có ${min - 1} ký tự (dưới biên tối thiểu ${min})`;
      if (!existingTcTitles.some((t) => t.includes(`${min - 1} ký tự`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: belowTitle,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Phân tích biên dưới từ quyết định ${item.id}: yêu cầu tối thiểu ${min} ký tự.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi ${min - 1} ký tự`,
          steps: [
            { step: 1, action: `Nhập các trường thông tin hợp lệ khác`, expected: `Không có lỗi trên các trường hợp lệ` },
            { step: 2, action: `Nhập ${fieldName} có đúng ${min - 1} ký tự`, expected: `Hệ thống hiển thị thông báo lỗi yêu cầu tối thiểu ${min} ký tự` },
            { step: 3, action: `Thử bấm xác nhận / submit`, expected: `Hệ thống chặn gửi form thành công` },
          ],
        });
      }
    }

    if (max !== null && max > 0) {
      // Test case biên trên (Negative: max + 1)
      const aboveTitle = `Kiểm tra thất bại khi ${fieldName} có ${max + 1} ký tự (vượt biên tối đa ${max})`;
      if (!existingTcTitles.some((t) => t.includes(`${max + 1} ký tự`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: aboveTitle,
          priority: 'P2',
          automation: 'candidate',
          rationale: `Phân tích biên trên từ quyết định ${item.id}: giới hạn tối đa ${max} ký tự.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi ${max + 1} ký tự`,
          steps: [
            { step: 1, action: `Nhập các trường thông tin hợp lệ`, expected: `Không có cảnh báo lỗi` },
            { step: 2, action: `Nhập ${fieldName} có ${max + 1} ký tự`, expected: `Hệ thống báo lỗi hoặc giới hạn không cho nhập quá ${max} ký tự` },
          ],
        });
      }

      // Test case hợp lệ tại biên (Positive: min và max)
      if (min !== null && !existingTcTitles.some((t) => t.includes(`đúng ${min} và ${max}`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Xác nhận thành công khi ${fieldName} đạt đúng biên ${min} và ${max} ký tự`,
          priority: 'P2',
          automation: 'candidate',
          rationale: `Kiểm tra biên hợp lệ (Valid Boundary) theo quyết định ${item.id}.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi đúng ${min} ký tự và chuỗi đúng ${max} ký tự`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} có độ dài đúng ${min} ký tự và hoàn tất form`, expected: `Hệ thống chấp nhận thông tin hợp lệ` },
            { step: 2, action: `Thử lại với ${fieldName} có độ dài đúng ${max} ký tự`, expected: `Hệ thống chấp nhận thông tin hợp lệ` },
          ],
        });
      }
    }

    // 2. Phân tích điều kiện định dạng (Chữ và Số, ký tự đặc biệt)
    if (/(?:chữ\s*cái|chữ).*và.*(?:chữ\s*)?số/i.test(text) || /ít\s*nhất\s*1\s*chữ/i.test(text)) {
      // Negative 1: Chỉ toàn chữ không có số
      if (!existingTcTitles.some((t) => t.includes('chỉ chứa chữ') || t.includes('thiếu số'))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Kiểm tra thất bại khi ${fieldName} chỉ chứa chữ cái (thiếu chữ số)`,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Quy tắc độ phức tạp từ ${item.id}: bắt buộc chứa cả chữ và số.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: 'Abcdefgh'`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} chỉ gồm chữ cái hợp lệ nhưng không có số`, expected: `Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ số` },
          ],
        });
      }

      // Negative 2: Chỉ toàn số không có chữ
      if (!existingTcTitles.some((t) => t.includes('chỉ chứa số') || t.includes('thiếu chữ'))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Kiểm tra thất bại khi ${fieldName} chỉ chứa chữ số (thiếu chữ cái)`,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Quy tắc độ phức tạp từ ${item.id}: bắt buộc chứa cả chữ và số.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: '12345678'`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} chỉ gồm chữ số nhưng không có chữ cái`, expected: `Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ cái` },
          ],
        });
      }
    }

    // 3. Phân tích điều kiện rẽ nhánh / Tùy chọn (Optionality / Branching)
    if (/không\s*bắt\s*buộc/i.test(text) || /tùy\s*chọn/i.test(text) || /optional/i.test(text)) {
      let optField = 'trường tùy chọn';
      if (/số\s*điện\s*thoại|phone|sđt/i.test(text)) optField = 'số điện thoại';
      else if (/email/i.test(text)) optField = 'email';

      const optTitle = `Xác nhận thành công khi bỏ trống ${optField} (trường tùy chọn theo quyết định)`;
      if (!existingTcTitles.some((t) => t.includes(`bỏ trống ${optField}`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: optTitle,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Kiểm thử luồng rẽ nhánh từ quyết định ${item.id}: ${optField} không bắt buộc.`,
          precondition: 'Người dùng đang ở màn hình đăng ký / nhập liệu',
          testData: `Bỏ trống trường ${optField}`,
          steps: [
            { step: 1, action: `Nhập đầy đủ các trường thông tin bắt buộc khác`, expected: `Các trường bắt buộc hợp lệ` },
            { step: 2, action: `Để trống trường ${optField} và bấm gửi form`, expected: `Hệ thống xử lý thành công, không báo lỗi thiếu ${optField}` },
          ],
        });
      }
    }

    // 4. Nếu câu hỏi không bắt được các rule cụ thể trên, sinh 1 kịch bản xác nhận tổng quát cho quyết định đó
    if (results.length === 0 && item.decision) {
      results.push({
        suggestedId: allocateId(),
        acId: defaultAcId,
        title: `Kiểm thử hành vi theo quyết định: ${item.question.slice(0, 70)}`,
        priority: 'P2',
        automation: 'candidate',
        rationale: `Quyết định chốt từ ${item.id}: ${item.decision}`,
        precondition: 'Môi trường sẵn sàng cho kịch bản',
        testData: 'Dữ liệu theo nghiệp vụ đã chốt',
        steps: [
          { step: 1, action: `Thực hiện thao tác với điều kiện: ${item.decision.slice(0, 100)}`, expected: `Hệ thống phản hồi đúng theo quyết định đã chốt` },
        ],
      });
    }
  }

  return results;
}

/**
 * Động cơ AI: Gửi toàn văn ngữ cảnh cho LLM (Gemini / OpenAI / DeepSeek)
 */
async function inferWithAi({ reqId, reqContent, decidedQuestions, existingTcIds, existingTcTitles, acs, clientConfig, root }) {
  const env = parseEnvFile(path.join(root || process.cwd(), '.env'));
  const apiKey = (clientConfig && clientConfig.apiKey) || env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY;
  const provider = (clientConfig && clientConfig.provider) || env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
  const baseURL = (clientConfig && clientConfig.baseURL) || env.AI_BASE_URL || '';
  const model = (clientConfig && clientConfig.model) || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key cho AI. Vui lòng cấu hình API Key trong mục Cài đặt AI của Dashboard hoặc file .env');
  }

  const nextTcId = getNextTcId(existingTcIds);
  const acListStr = acs.map((a) => `- ${a.id}: ${a.title}`).join('\n') || '- AC-001: Yêu cầu chung';
  const existingTcStr = existingTcTitles.map((t) => `- ${t}`).join('\n') || '(Chưa có test case nào)';
  const decidedStr = decidedQuestions.map((q) => `[${q.id}] Câu hỏi: ${q.question}\n=> Đã chốt: ${q.decision}`).join('\n\n');

  const systemPrompt = `Bạn là Senior QA Automation Lead với hơn 10 năm kinh nghiệm trong kiểm thử phần mềm, Boundary Value Analysis (BVA), và Test Matrix Traceability.
Nhiệm vụ: Phân tích các câu hỏi vừa được chốt (Đã chốt) của Requirement ${reqId}, đối chiếu với các Acceptance Criteria (AC) và Test Cases (TC) đã có, từ đó suy luận và đề xuất các Test Case MỚI còn thiếu (ưu tiên các ca biên BVA, Negative tests, luồng rẽ nhánh, edge cases).

RÀNG BUỘC NGHIÊM NGẶT:
1. TUYỆT ĐỐI KHÔNG lặp lại các Test Case đã có trong danh sách.
2. Bắt đầu đánh số mã Test Case tiếp theo từ "${nextTcId}".
3. Gán đúng mã AC liên quan (từ danh sách AC đã có).
4. Độ ưu tiên phải là một trong: P0, P1, P2, P3. Trường "automation" luôn là "candidate".
5. Đầu ra PHẢI là một chuỗi JSON hợp lệ thuần túy, KHÔNG chứa chữ giải thích bên ngoài JSON. Schema yêu cầu:
{
  "testCases": [
    {
      "suggestedId": "TC-xxx",
      "acId": "AC-xxx",
      "title": "Tiêu đề ca kiểm thử rõ ràng, súc tích",
      "priority": "P1",
      "automation": "candidate",
      "rationale": "Lý do sinh test case từ quyết định chốt",
      "precondition": "Tiền điều kiện cụ thể",
      "testData": "Dữ liệu kiểm thử mẫu",
      "steps": [
        { "step": 1, "action": "Hành động thao tác", "expected": "Kết quả mong đợi chi tiết" }
      ]
    }
  ]
}`;

  const userPrompt = `DƯỚI ĐÂY LÀ THÔNG TIN NGHIỆP VỤ CẦN PHÂN TÍCH:

=== 1. DANH SÁCH CÂU HỎI VỪA CHỐT (QUYẾT ĐỊNH MỚI) ===
${decidedStr}

=== 2. DANH SÁCH ACCEPTANCE CRITERIA ĐÃ CÓ ===
${acListStr}

=== 3. DANH SÁCH TEST CASE HIỆN TẠI (ĐỂ TRÁNH TRÙNG LẶP) ===
${existingTcStr}

Hãy đề xuất các Test Case còn thiếu dựa trên các quyết định mới trên. Trả về đúng JSON schema quy định.`;

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
          temperature: 0.2,
          maxOutputTokens: 2048,
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
    // OpenAI / DeepSeek / Custom
    const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const base = (baseURL || defaultBase).replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`${provider.toUpperCase()} API trả về lỗi (${res.status}): ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseJsonText = data.choices?.[0]?.message?.content || '';
  }

  // Bóc tách JSON an toàn
  const cleaned = responseJsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`AI trả về định dạng không phải JSON hợp lệ: ${cleaned.slice(0, 200)}`);
    }
  }

  const list = Array.isArray(parsed.testCases) ? parsed.testCases : [];
  return list.map((tc, idx) => ({
    suggestedId: tc.suggestedId || getNextTcId(existingTcIds, idx),
    acId: tc.acId || (acs[0] && acs[0].id) || 'AC-001',
    title: String(tc.title || '').trim(),
    priority: ['P0', 'P1', 'P2', 'P3'].includes(tc.priority) ? tc.priority : 'P2',
    automation: 'candidate',
    rationale: String(tc.rationale || ''),
    precondition: String(tc.precondition || 'Môi trường sẵn sàng'),
    testData: String(tc.testData || ''),
    steps: Array.isArray(tc.steps) ? tc.steps : [
      { step: 1, action: 'Thực hiện thao tác kiểm thử', expected: 'Kết quả như mong đợi' },
    ],
  }));
}

/**
 * Hàm điều phối chính: Đọc tài liệu REQ và phân tích suy luận Test Cases
 */
async function inferTestCases({ root, reqPath, mode = 'heuristic', clientConfig = null }) {
  const absReqPath = path.resolve(root, reqPath);
  if (!fs.existsSync(absReqPath)) {
    throw Object.assign(new Error(`Tài liệu requirement "${reqPath}" không tồn tại.`), { status: 404 });
  }

  const reqContent = fs.readFileSync(absReqPath, 'utf8');
  const reqMatch = reqContent.match(RE_REQ);
  const reqId = reqMatch ? reqMatch[0].toUpperCase() : 'REQ-001';

  const decidedQuestions = extractDecidedQuestions(reqContent);
  if (!decidedQuestions.length) {
    return {
      success: true,
      reqId,
      mode,
      count: 0,
      items: [],
      message: 'Không tìm thấy câu hỏi nào đã chốt (**Đã chốt:**) trong mục Open Questions của tài liệu này.',
    };
  }

  const acs = extractAcs(reqContent);
  const tcFile = findTestCaseFile(root, reqId);

  const existingTcIds = [];
  const existingTcTitles = [];

  if (tcFile.exists) {
    const tcContent = fs.readFileSync(tcFile.absPath, 'utf8');
    for (const match of tcContent.matchAll(RE_TC)) {
      existingTcIds.push(match[0].toUpperCase());
    }
    const lines = tcContent.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('TC-')) {
        existingTcTitles.push(line.trim());
      }
    }
  }

  let items = [];
  if (mode === 'ai') {
    items = await inferWithAi({
      reqId,
      reqContent,
      decidedQuestions,
      existingTcIds,
      existingTcTitles,
      acs,
      clientConfig,
      root,
    });
  } else {
    items = inferWithHeuristic({
      reqId,
      decidedQuestions,
      existingTcIds,
      existingTcTitles,
      acs,
    });
  }

  return {
    success: true,
    reqId,
    mode,
    tcPath: tcFile.relPath,
    tcExists: tcFile.exists,
    decidedQuestionsCount: decidedQuestions.length,
    count: items.length,
    items,
  };
}

/**
 * Ghi an toàn các Test Cases mới vào file test-cases/REQ-xxx.md
 */
function appendTestCasesToDocument(root, { reqId, tcPath, testCases = [] }) {
  if (!Array.isArray(testCases) || !testCases.length) {
    throw Object.assign(new Error('Danh sách test cases cần thêm không được rỗng.'), { status: 400 });
  }

  const cleanReqId = String(reqId || '').toUpperCase();
  const tcFileInfo = tcPath ? { absPath: path.resolve(root, tcPath), relPath: tcPath, exists: fs.existsSync(path.resolve(root, tcPath)) } : findTestCaseFile(root, cleanReqId);

  let currentContent = '';
  if (tcFileInfo.exists) {
    currentContent = fs.readFileSync(tcFileInfo.absPath, 'utf8');
    createBackup(tcFileInfo.relPath, tcFileInfo.absPath, root);
  } else {
    // Nếu file test-cases chưa từng có, dựng khung chuẩn
    fs.mkdirSync(path.dirname(tcFileInfo.absPath), { recursive: true });
    currentContent = `# Test Cases: ${cleanReqId}\n\nRequirement: \`requirements/${cleanReqId}.md\`\n\n## Bảng truy vết\n\n| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |\n|---|---|---|---|---|---|\n\n## Test cases\n\n`;
  }

  let lines = currentContent.split(/\r?\n/);

  // 1. Tìm vị trí bảng Traceability
  let tableHeaderIdx = lines.findIndex((l) => /\|\s*(?:Test\s*case|Requirement)\s*\|/i.test(l));
  let isTableStyle1 = true; // | Test case | AC | Mô tả | Ưu tiên | Automation | Spec |

  if (tableHeaderIdx !== -1) {
    if (/\|\s*Requirement\s*\|/i.test(lines[tableHeaderIdx])) {
      isTableStyle1 = false; // | Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
    }

    // Tìm dòng cuối cùng của bảng
    let tableEndIdx = tableHeaderIdx + 1;
    if (lines[tableEndIdx] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[tableEndIdx])) {
      tableEndIdx += 1;
    }
    while (tableEndIdx < lines.length && /^\s*\|.*\|\s*$/.test(lines[tableEndIdx])) {
      tableEndIdx += 1;
    }

    // Tạo các dòng mới cho bảng
    const newTableRows = testCases.map((tc) => {
      const p = tc.priority || 'P2';
      const ac = tc.acId || '-';
      const title = (tc.title || '').replace(/\|/g, '-').trim();
      if (isTableStyle1) {
        return `| ${tc.suggestedId} | ${ac} | ${title} | ${p} | candidate | - |`;
      }
      return `| ${cleanReqId} | ${ac} | ${tc.suggestedId} | candidate | - | ${p} |`;
    });

    lines.splice(tableEndIdx, 0, ...newTableRows);
  }

  // 2. Thêm các khối chi tiết Test Case vào cuối file
  const detailBlocks = testCases.map((tc) => {
    const stepsTable = (tc.steps && tc.steps.length)
      ? tc.steps.map((s, idx) => `| ${s.step || idx + 1} | ${(s.action || '').replace(/\|/g, '-')} | ${(s.expected || '').replace(/\|/g, '-')} |`).join('\n')
      : `| 1 | Thực hiện kiểm thử ${tc.title} | Phản hồi đúng nghiệp vụ |`;

    return `\n### ${tc.suggestedId} — ${tc.title}\n\n` +
      `- **Loại:** Chức năng | **Ưu tiên:** ${tc.priority || 'P2'} | **Kỹ thuật:** Phân tích giá trị biên / Quyết định chốt\n` +
      `- **Automation:** Candidate\n` +
      `- **Tiền điều kiện:** ${tc.precondition || 'Môi trường sẵn sàng'}\n` +
      `- **Dữ liệu kiểm thử:** ${tc.testData || 'Mặc định'}\n` +
      (tc.rationale ? `> *Ghi chú nghiệp vụ:* ${tc.rationale}\n\n` : '\n') +
      `| Bước | Thao tác | Kết quả mong đợi |\n` +
      `|---|---|---|\n` +
      `${stepsTable}\n`;
  });

  lines.push(...detailBlocks);

  const updatedContent = lines.join('\n');
  fs.writeFileSync(tcFileInfo.absPath, updatedContent, 'utf8');

  return {
    success: true,
    reqId: cleanReqId,
    tcPath: tcFileInfo.relPath,
    addedCount: testCases.length,
    message: `Đã thêm thành công ${testCases.length} test case vào ${tcFileInfo.relPath}.`,
  };
}

/**
 * Tạo slug chuẩn tiếng Việt không dấu
 */
function slugify(text) {
  return String(text || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'feature';
}

/**
 * Nhận diện nội dung dán vào có phải là Playwright test script hay không
 */
function detectIsTestScript(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\btest\s*\(/,
    /\btest\.describe\s*\(/,
    /\btest\.(?:skip|fixme|only)\s*\(/,
    /\bexpect\s*\(/,
    /\bpage\.(?:goto|fill|click|locator|waitForSelector|waitForURL)\b/,
    /from\s+['"][^'"]*playwright[^'"]*['"]/,
    /require\(['"][^'"]*baseTest['"]\)/,
    /async\s*\(\s*\{[^}]*page[^}]*\}\s*\)/,
  ];
  let matches = 0;
  for (const p of patterns) {
    if (p.test(text)) matches += 1;
  }
  return matches >= 2 || (matches >= 1 && (/\btest\s*\(/.test(text) || /\btest\.describe\s*\(/.test(text)));
}

/**
 * Suy luận domain từ văn bản
 */
function inferDomainFromText(text, existingDomains = []) {
  const lower = String(text || '').toLowerCase();
  for (const d of existingDomains) {
    if (d && lower.includes(d.toLowerCase())) return d.toLowerCase();
  }
  if (/login|sign.?in|đăng nhập|register|sign.?up|đăng ký|auth|password|mật khẩu|otp/i.test(lower)) return 'auth';
  if (/job|tin tuyển dụng|việc làm|tuyển dụng|apply|ứng tuyển|hồ sơ/i.test(lower)) return 'job';
  if (/profile|user|tài khoản|thông tin cá nhân|cài đặt/i.test(lower)) return 'profile';
  if (/employer|nhà tuyển dụng|ntd|doanh nghiệp/i.test(lower)) return 'employer';
  return existingDomains[0] || 'general';
}

/**
 * Bóc tách các khối test(...) từ mã nguồn JavaScript / TypeScript bằng thuật toán đếm ngoặc nhọn
 */
function parseTestBlocksFromScript(content) {
  const blocks = [];
  const regex = /test(?:\.(?:skip|fixme|only))?\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTitle = match[1];
    const startIndex = match.index;
    const arrowIndex = content.indexOf('=>', startIndex);
    if (arrowIndex === -1) continue;
    const openBrace = content.indexOf('{', arrowIndex);
    if (openBrace === -1) continue;
    let depth = 1;
    let i = openBrace + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth += 1;
      else if (content[i] === '}') depth -= 1;
      i += 1;
    }
    const body = content.slice(openBrace + 1, i - 1);
    blocks.push({ rawTitle, body: body.trim() });
  }
  return blocks;
}

/**
 * Heuristic Parser cho Playwright Test Script thô
 */
function extractHeuristicFromTestScript(rawContent, reqId, domain) {
  // 1. Trích xuất Title từ test.describe
  const describeMatch = rawContent.match(/test\.describe\(\s*['"`]([^'"`]+)['"`]/i);
  let title = 'Tính năng ' + reqId;
  if (describeMatch) {
    title = describeMatch[1]
      .replace(/^Feature:\s*/i, '')
      .replace(/@\S+/g, '')
      .replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '')
      .trim();
  }

  // 2. Bóc tách danh sách test cases
  const blocks = parseTestBlocksFromScript(rawContent);
  if (!describeMatch && blocks.length > 0) {
    title = blocks[0].rawTitle
      .replace(/TC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/AC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/@\S+/g, '')
      .trim();
  }

  const slug = slugify(title);
  const acMap = new Map();
  const testCases = [];

  blocks.forEach((block, idx) => {
    const num = idx + 1;
    const tcIdMatch = block.rawTitle.match(/\bTC-(\d{3})\b/i);
    const acIdMatch = block.rawTitle.match(/\bAC-(\d{3})\b/i);

    const tcId = tcIdMatch ? tcIdMatch[0].toUpperCase() : `TC-${String(num).padStart(3, '0')}`;
    const acId = acIdMatch ? acIdMatch[0].toUpperCase() : `AC-${String(Math.min(num, 10)).padStart(3, '0')}`;

    const cleanTitle = block.rawTitle
      .replace(/\bTC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/\bAC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/@\S+/g, '')
      .trim() || `Kiểm thử kịch bản ${num}`;

    if (!acMap.has(acId)) {
      acMap.set(acId, {
        id: acId,
        title: cleanTitle,
        given: 'Người dùng truy cập vào hệ thống và mở giao diện tính năng ' + title,
        when: 'Thực hiện thao tác: ' + cleanTitle,
        then: 'Hệ thống thực hiện xử lý hợp lệ và trả về kết quả mong đợi',
      });
    }

    const priority = /lỗi|sai|boundary|biên|invalid|fail|thiếu/i.test(cleanTitle) ? 'P2' : 'P1';

    // Bóc tách steps nếu có test.step
    const stepMatches = [...block.body.matchAll(/test\.step\(\s*['"`]([^'"`]+)['"`]/g)];
    const steps = stepMatches.length > 0
      ? stepMatches.map((m, sIdx) => ({
        step: sIdx + 1,
        action: m[1].replace(/^(?:Given|When|Then|Bước\s*\d+:?)\s*/i, '').trim(),
        expected: 'Hệ thống thực hiện thành công bước kiểm thử',
      }))
      : [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Trang hiển thị đầy đủ giao diện' },
        { step: 2, action: `Thực hiện kịch bản: ${cleanTitle}`, expected: 'Khớp kết quả mong đợi theo nghiệp vụ' },
      ];

    testCases.push({
      id: tcId,
      acId,
      title: cleanTitle,
      priority,
      automation: 'Yes',
      precondition: 'Môi trường sẵn sàng, dữ liệu kiểm thử đã được chuẩn bị',
      body: block.body,
      steps,
    });
  });

  const acs = Array.from(acMap.values());
  if (acs.length === 0) {
    acs.push({
      id: 'AC-001',
      title: title,
      given: 'Người dùng truy cập vào chức năng ' + title,
      when: 'Thực hiện các thao tác kiểm thử chính',
      then: 'Hệ thống xử lý chính xác và phản hồi kết quả hợp lệ',
    });
    testCases.push({
      id: 'TC-001',
      acId: 'AC-001',
      title: title,
      priority: 'P1',
      automation: 'Yes',
      precondition: 'Môi trường sẵn sàng',
      body: rawContent,
      steps: [
        { step: 1, action: 'Thực hiện kịch bản kiểm thử', expected: 'Các assertions thành công' },
      ],
    });
  }

  return {
    title,
    slug,
    domain: domain || 'general',
    businessGoal: `Mô tả mục tiêu nghiệp vụ của tính năng ${title} (được suy luận từ automation test script).`,
    acs,
    testCases,
  };
}

/**
 * Heuristic Parser cho nội dung văn bản Spec / User Story / Requirement thô
 */
function extractHeuristicFromSpecText(rawContent, reqId, domain) {
  const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Trích xuất Title
  let title = '';
  for (const line of lines) {
    const titleMatch = line.match(/^(?:#+\s*|Tính năng\s*[:\-—]\s*|Feature\s*[:\-—]\s*|Tên tính năng\s*[:\-—]\s*)(.*)$/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '').trim();
      break;
    }
  }
  if (!title && lines.length > 0) {
    title = lines[0].replace(/^#+\s*/, '').replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '').trim();
  }
  if (!title) title = `Tính năng ${reqId}`;

  const slug = slugify(title);

  // 2. Trích xuất Acceptance Criteria
  const acs = [];
  const acRegex = /(?:AC-?(\d+)|Tiêu chí (\d+)|Criterion (\d+))\s*[:\-—]?\s*(.*)/i;

  for (const line of lines) {
    const m = line.match(acRegex);
    if (m) {
      const acNum = m[1] || m[2] || m[3];
      const acId = `AC-${String(acNum).padStart(3, '0')}`;
      const acDesc = (m[4] || '').trim();
      if (!acs.some((a) => a.id === acId)) {
        acs.push({
          id: acId,
          title: acDesc || `Tiêu chí ${acNum}`,
          given: `Người dùng truy cập vào chức năng ${title}`,
          when: `Thực hiện thao tác: ${acDesc || acId}`,
          then: 'Hệ thống xử lý hợp lệ và phản hồi đúng quy chuẩn',
        });
      }
    }
  }

  // Nếu không có mã AC-xxx, trích xuất từ các gạch đầu dòng bullet
  if (acs.length === 0) {
    const bulletLines = lines.filter((l) => /^[-*+]\s+/.test(l) || /^\d+[.)]\s+/.test(l));
    const targetBullets = bulletLines.length > 0 ? bulletLines.slice(0, 6) : lines.slice(1, 4);

    targetBullets.forEach((bullet, idx) => {
      const acId = `AC-${String(idx + 1).padStart(3, '0')}`;
      const cleanBullet = bullet.replace(/^[-*+\d.)\s]+/, '').trim();
      acs.push({
        id: acId,
        title: cleanBullet.slice(0, 90) || `Tiêu chí chấp nhận ${idx + 1}`,
        given: `Người dùng đã đăng nhập hoặc truy cập tính năng ${title}`,
        when: `Thực hiện kiểm thử: ${cleanBullet}`,
        then: 'Hệ thống phản hồi chính xác và cập nhật dữ liệu tương ứng',
      });
    });
  }

  if (acs.length === 0) {
    acs.push({
      id: 'AC-001',
      title: `Quy tắc xử lý chính của ${title}`,
      given: `Hệ thống sẵn sàng`,
      when: `Người dùng thực hiện thao tác trên giao diện`,
      then: `Xử lý thành công và hiển thị thông báo hợp lệ`,
    });
  }

  // 3. Sinh các Test Cases tương ứng với ACs
  const testCases = [];
  acs.forEach((ac, idx) => {
    const p1Num = String(idx * 2 + 1).padStart(3, '0');
    const p2Num = String(idx * 2 + 2).padStart(3, '0');

    testCases.push({
      id: `TC-${p1Num}`,
      acId: ac.id,
      title: `Kiểm tra thành công theo ${ac.id}: ${ac.title}`,
      priority: 'P1',
      automation: 'Candidate',
      precondition: ac.given || 'Môi trường sẵn sàng',
      steps: [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Giao diện hiển thị đầy đủ' },
        { step: 2, action: `Thực hiện thao tác: ${ac.when || ac.title}`, expected: ac.then || 'Thao tác thành công' },
      ],
    });

    testCases.push({
      id: `TC-${p2Num}`,
      acId: ac.id,
      title: `Kiểm tra thất bại / xử lý biên cho ${ac.id}`,
      priority: 'P2',
      automation: 'Candidate',
      precondition: ac.given || 'Môi trường sẵn sàng',
      steps: [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Giao diện hiển thị đầy đủ' },
        { step: 2, action: 'Nhập dữ liệu không hợp lệ hoặc vượt biên', expected: 'Hiển thị thông báo lỗi rõ ràng' },
      ],
    });
  });

  return {
    title,
    slug,
    domain: domain || 'general',
    businessGoal: `Mô tả mục tiêu nghiệp vụ cho ${title}. Đảm bảo các quy trình vận hành chính xác và thân thiện với người dùng.`,
    acs,
    testCases,
  };
}

/**
 * Trích xuất qua AI Semantic Engine (Gemini / OpenAI / DeepSeek)
 */
async function extractWithAi(root, rawContent, inputType, reqId, domain, payload = {}) {
  const env = parseEnvFile(path.join(root || process.cwd(), '.env'));
  const apiKey = env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY || '';
  if (!apiKey) return null;

  const provider = (payload.provider || env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini')).toLowerCase();
  const baseURL = payload.baseURL || env.AI_BASE_URL || '';
  const model = payload.model || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  const systemPrompt = `Bạn là Senior QA Lead & Playwright Automation Architect.
Nhiệm vụ của bạn là phân tích nội dung do người dùng cung cấp (có thể là văn bản nghiệp vụ Spec/Requirement hoặc mã nguồn Playwright test script) để trích xuất thành cấu trúc tài liệu truy vết QA chuẩn 100%.

BẮT BUỘC trả về DUY NHẤT 1 chuỗi JSON hợp lệ (không kèm markdown \`\`\`json hay ghi chú bên ngoài), định dạng đúng schema sau:
{
  "title": "Tên tính năng ngắn gọn, chuẩn nghiệp vụ (Ví dụ: Đổi mật khẩu tài khoản)",
  "slug": "slug-dinh-danh-khong-dau (Ví dụ: doi-mat-khau)",
  "domain": "${domain || 'auth'}",
  "businessGoal": "Mục tiêu nghiệp vụ chính của tính năng",
  "acs": [
    {
      "id": "AC-001",
      "title": "Tên tiêu chí chấp nhận",
      "given": "Tiền điều kiện Given",
      "when": "Thao tác người dùng When",
      "then": "Kết quả mong đợi Then"
    }
  ],
  "rules": [
    {
      "field": "Tên trường / Quy tắc",
      "valid": "Giá trị hợp lệ",
      "invalid": "Giá trị không hợp lệ",
      "boundary": "Giá trị biên",
      "expected": "Kết quả xử lý",
      "tcId": "TC-001"
    }
  ],
  "testCases": [
    {
      "id": "TC-001",
      "acId": "AC-001",
      "title": "Tên kịch bản kiểm thử chi tiết",
      "priority": "P1",
      "automation": "Yes",
      "precondition": "Tiền điều kiện",
      "steps": [
        { "step": 1, "action": "Thao tác bước 1", "expected": "Kết quả kỳ vọng bước 1" }
      ]
    }
  ],
  "specCode": "// Mã test Playwright hoàn chỉnh tương thích CommonJS hoặc ES module"
}`;

  const userPrompt = `Dữ liệu đầu vào (${inputType === 'test_script' ? 'Mã test script Playwright' : 'Văn bản Spec / User story thô'}):\n\n${rawContent.slice(0, 8000)}\n\nMã REQ ID dự kiến: ${reqId}\nDomain đề xuất: ${domain}`;

  let responseJsonText = '';

  if (provider === 'gemini') {
    const base = (baseURL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const url = `${base}/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3072,
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error (${res.status}): ${errData.error?.message || res.statusText}`);
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
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`${provider.toUpperCase()} API error (${res.status}): ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseJsonText = data.choices?.[0]?.message?.content || '';
  }

  const cleaned = responseJsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  }

  if (parsed && parsed.title && Array.isArray(parsed.acs) && parsed.acs.length > 0) {
    return parsed;
  }
  return null;
}

/**
 * Tổng hợp nội dung hoàn chỉnh cho 3 file: REQ markdown, TC markdown và Spec Playwright
 */
function synthesizeScaffoldContents(root, params) {
  const {
    reqId,
    domain,
    title,
    slug,
    businessGoal,
    acs,
    rules = [],
    testCases = [],
    rawScriptBody = null,
    specCode = null,
  } = params;

  // 1. Xác định đường dẫn tương đối
  const reqRelPath = `requirements/${reqId}-${slug}.md`;
  const tcRelPath = `test-cases/${reqId}-${slug}.md`;

  const desktopDir = path.join(root, 'tests', 'e2e', 'desktop');
  const domainDir = path.join(root, 'tests', domain);
  let specRelPath = '';
  if (fs.existsSync(desktopDir)) {
    specRelPath = `tests/e2e/desktop/${slug}-bdd.spec.js`;
  } else if (fs.existsSync(domainDir)) {
    specRelPath = `tests/${domain}/${slug}.spec.js`;
  } else {
    specRelPath = `tests/e2e/desktop/${slug}-bdd.spec.js`;
  }

  // 2. Sinh nội dung Requirement (REQ)
  const acBlocks = acs.map((ac) => (
    `### ${ac.id}: ${ac.title}\n\n` +
    `**Given** ${ac.given || 'Tiền điều kiện sẵn sàng'}\n` +
    `**When** ${ac.when || 'Người dùng thực hiện thao tác nghiệp vụ'}\n` +
    `**Then** ${ac.then || 'Hệ thống xử lý chính xác và trả về kết quả mong đợi'}\n`
  ));

  const ruleRows = rules.length > 0
    ? rules.map((r, idx) => `| ${r.field || `Rule ${idx + 1}`} | ${r.valid || 'Hợp lệ'} | ${r.invalid || 'Không hợp lệ'} | ${r.boundary || 'Biên'} | ${r.expected || 'Xử lý đúng'} | ${r.tcId || `TC-00${idx + 1}`} |`)
    : acs.map((ac, idx) => `| Quy tắc cho ${ac.id} | Dữ liệu hợp lệ | Dữ liệu sai định dạng | Biên chuẩn | Xử lý đúng theo ${ac.id} | TC-${String(idx + 1).padStart(3, '0')} |`);

  const reqContent = `---
id: ${reqId}
title: ${title}
status: Draft
version: 1.0
risk: Medium
owner: QA Team
slug: ${slug}
test_cases: ${tcRelPath}
---

# ${reqId}: ${title}

- Status: Draft
- Owner: QA Team
- Version: 1.0
- Risk: Medium
- Related pages/modules: \`/${slug}\`
- Source: Scaffold Wizard (Smart Extraction)

## Business goal

${businessGoal || `Mô tả mục tiêu nghiệp vụ cho ${title}.`}

## Acceptance criteria

${acBlocks.join('\n')}
## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
${ruleRows.join('\n')}

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| Nghiệp vụ chính của ${title} | Phân tích yêu cầu và kịch bản automation | High | Confirmed |

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | ${new Date().toISOString().slice(0, 10)} | Khởi tạo tài liệu từ Scaffold Wizard | - | - |
`;

  // 3. Sinh nội dung Test Cases (TC)
  const traceRows = testCases.map((tc) => (
    `| ${reqId} | ${tc.acId || 'AC-001'} | ${tc.id} | ${tc.automation || 'Candidate'} | \`${specRelPath}\` | ${tc.priority || 'P1'} |`
  ));

  const tcBlocks = testCases.map((tc) => {
    const stepsTable = (tc.steps && tc.steps.length)
      ? tc.steps.map((s, idx) => `| ${s.step || idx + 1} | ${(s.action || '').replace(/\|/g, '-')} | ${(s.expected || '').replace(/\|/g, '-')} |`).join('\n')
      : `| 1 | Truy cập màn hình tính năng | Trang hiển thị đầy đủ |\n| 2 | Thực hiện thao tác kiểm thử: ${tc.title} | Phản hồi đúng theo ${tc.acId || 'AC-001'} |`;

    return `### ${tc.id}: ${tc.title}\n\n` +
      `- Type: Functional | Priority: ${tc.priority || 'P1'} | Technique: Equivalence Partitioning\n` +
      `- Automation: ${tc.automation || 'Candidate'} | Tags: \`@${domain} @${(tc.priority || 'p1').toLowerCase()}\`\n` +
      `- Preconditions: ${tc.precondition || 'Môi trường sẵn sàng'}\n\n` +
      `| Step | Action | Expected result |\n` +
      `|---|---|---|\n` +
      `${stepsTable}\n`;
  });

  const tcContent = `# Test Cases: ${reqId} ${title}

Requirement: \`${reqRelPath}\` (v1.0)

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
${traceRows.join('\n')}

> Lưu ý: Cập nhật Priority thật (P0/P1) và chuyển Automation thành Yes khi hoàn thiện test.

## Case không automation

| Test case | Lý do | Cách bù đắp |
|---|---|---|

## Test cases

${tcBlocks.join('\n')}
`;

  // 4. Sinh nội dung Spec Playwright
  let finalSpecContent = '';
  if (specCode && specCode.includes('test(')) {
    finalSpecContent = specCode;
  } else {
    // Xác định import fixture phù hợp với repo
    const absSpec = path.join(root, specRelPath);
    const baseTestAbs = path.join(root, 'core', 'fixtures', 'baseTest.js');
    let fixtureImport = '@playwright/test';

    if (fs.existsSync(baseTestAbs)) {
      let rel = path.relative(path.dirname(absSpec), baseTestAbs).replace(/\\/g, '/').replace(/\.js$/, '');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      fixtureImport = rel;
    }

    const testSpecBlocks = testCases.map((tc) => {
      const tcBody = tc.body
        ? tc.body.split('\n').map((line) => `    ${line}`).join('\n')
        : `    await test.step('Given Tiền điều kiện: Truy cập tính năng', async () => {\n` +
          `      expect(page).toBeDefined();\n` +
          `    });\n\n` +
          `    await test.step('When Thao tác: ${tc.title.replace(/'/g, "\\'")}', async () => {\n` +
          `      // Thêm mã automation thao tác ở đây\n` +
          `    });\n\n` +
          `    await test.step('Then Kỳ vọng: Kết quả chính xác', async () => {\n` +
          `      expect(true).toBe(true);\n` +
          `    });`;

      return `  test('${tc.id} - ${tc.acId || 'AC-001'} ${tc.title.replace(/'/g, "\\'")}', async ({ page }, testInfo) => {\n` +
        `    testInfo.annotations.push({\n` +
        `      type: 'Precondition',\n` +
        `      description: '${(tc.precondition || 'Môi trường sẵn sàng').replace(/'/g, "\\'")}',\n` +
        `    });\n\n` +
        `${tcBody}\n` +
        `  });`;
    });

    finalSpecContent = `const { test, expect } = require('${fixtureImport}');\n\n` +
      `/**\n` +
      ` * ${reqId} - ${title}\n` +
      ` * Requirement : ${reqRelPath}\n` +
      ` */\n` +
      `test.describe('${reqId} - ${title} @${reqId} @${domain}', () => {\n` +
      `${testSpecBlocks.join('\n\n')}\n` +
      `});\n`;
  }

  return {
    reqId,
    domain,
    title,
    slug,
    acs,
    testCases,
    reqRelPath,
    tcRelPath,
    specRelPath,
    reqContent,
    tcContent,
    specContent: finalSpecContent,
  };
}

/**
 * Trích xuất cấu trúc Scaffold từ nội dung thô (Spec Text hoặc Test Script).
 */
async function extractScaffoldFromRaw(root, payload = {}) {
  const rawContent = String(payload.rawContent || '').trim();
  if (!rawContent) {
    throw Object.assign(new Error('Nội dung thô (Spec hoặc Test Script) không được để trống.'), { status: 400 });
  }

  const isTestScript = detectIsTestScript(rawContent);
  const inputType = isTestScript ? 'test_script' : 'spec_text';

  // Lấy nextReqId và danh sách domain từ qaService nếu có
  let nextReqId = 'REQ-001';
  let existingDomains = ['auth', 'job', 'account', 'general'];
  try {
    const { getScaffoldMeta } = require('./qaService');
    const meta = getScaffoldMeta(root);
    if (meta.nextReqId) nextReqId = meta.nextReqId;
    if (Array.isArray(meta.existingDomains) && meta.existingDomains.length) existingDomains = meta.existingDomains;
  } catch (_) {}

  // Gợi ý hoặc nhận REQ ID & Domain
  const textReqMatch = rawContent.match(/\bREQ-(\d{3})\b/i);
  const reqId = (payload.reqId && /^REQ-\d{3}$/i.test(payload.reqId.trim()))
    ? payload.reqId.trim().toUpperCase()
    : (textReqMatch ? textReqMatch[0].toUpperCase() : nextReqId);

  const domain = (payload.domain && String(payload.domain).trim())
    ? String(payload.domain).trim().toLowerCase()
    : inferDomainFromText(rawContent, existingDomains);

  // Thử AI Semantic Engine nếu không bị vô hiệu hóa
  let aiResult = null;
  if (payload.useAi !== false) {
    try {
      aiResult = await extractWithAi(root, rawContent, inputType, reqId, domain, payload);
    } catch (err) {
      // Graceful fallback
    }
  }

  // Heuristic Engine
  const parsed = aiResult || (isTestScript
    ? extractHeuristicFromTestScript(rawContent, reqId, domain)
    : extractHeuristicFromSpecText(rawContent, reqId, domain));

  // Tổng hợp 3 file contents hoàn chỉnh
  const synthesized = synthesizeScaffoldContents(root, {
    reqId,
    domain: parsed.domain || domain,
    title: parsed.title || `Tính năng ${reqId}`,
    slug: parsed.slug || slugify(parsed.title || `feature-${reqId}`),
    businessGoal: parsed.businessGoal || `Mục tiêu nghiệp vụ cho ${parsed.title || reqId}`,
    acs: parsed.acs && parsed.acs.length ? parsed.acs : [{ id: 'AC-001', title: 'Tiêu chí chính', given: 'Tiền điều kiện', when: 'Thao tác', then: 'Kết quả mong đợi' }],
    rules: parsed.rules || [],
    testCases: parsed.testCases && parsed.testCases.length ? parsed.testCases : [],
    rawScriptBody: isTestScript ? rawContent : null,
    specCode: parsed.specCode || null,
  });

  return {
    success: true,
    engine: aiResult ? 'ai' : 'heuristic',
    inputType,
    preview: {
      reqId: synthesized.reqId,
      title: synthesized.title,
      slug: synthesized.slug,
      domain: synthesized.domain,
      acCount: synthesized.acs.length,
      acs: synthesized.acs,
      tcCount: synthesized.testCases.length,
      testCases: synthesized.testCases,
      files: [
        synthesized.reqRelPath,
        synthesized.tcRelPath,
        synthesized.specRelPath,
      ],
    },
    generated: {
      reqRelPath: synthesized.reqRelPath,
      reqContent: synthesized.reqContent,
      tcRelPath: synthesized.tcRelPath,
      tcContent: synthesized.tcContent,
      specRelPath: synthesized.specRelPath,
      specContent: synthesized.specContent,
    },
  };
}

module.exports = {
  extractAcs,
  extractDecidedQuestions,
  findTestCaseFile,
  getNextTcId,
  inferWithHeuristic,
  inferWithAi,
  inferTestCases,
  appendTestCasesToDocument,
  slugify,
  detectIsTestScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
  extractScaffoldFromRaw,
  synthesizeScaffoldContents,
};
