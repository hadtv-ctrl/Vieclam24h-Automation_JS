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
  const env = parseEnvFile(path.join(root, '.env'));
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

module.exports = {
  extractAcs,
  extractDecidedQuestions,
  findTestCaseFile,
  getNextTcId,
  inferWithHeuristic,
  inferWithAi,
  inferTestCases,
  appendTestCasesToDocument,
};
