// master-process-disable-size-check: Requirement QA Impact dual-engine analyzer and scaffold service
/**
 * dashboard/services/qaRequirementAnalyzerService.js
 * Dịch vụ phân tích Requirement từ văn bản thô (Raw text) theo 4 trụ cột nghiệp vụ QA:
 *  1. Đề xuất số lượng & chi tiết Test Cases (Positive, Negative, BVA, Edge, Security).
 *  2. Phân tích tác động Hệ thống (UI Surfaces, APIs, DB Schema, Workflows).
 *  3. Đánh giá ảnh hưởng & sửa đổi các Test Cases / Specs có sẵn trong repo.
 *  4. Bộ câu hỏi làm rõ Nghiệp vụ (PO/BA/Dev) & Bộ câu hỏi phản biện của Team QA (Regression, Backward compat).
 *
 * Hỗ trợ Dual-Engine: AI Semantic Engine (Gemini / OpenAI / DeepSeek) + Heuristic Offline Fallback.
 */

const fs = require('fs');
const path = require('path');
const { parseEnvFile } = require('../routes/aiRoutes');
const { createBackup } = require('./resourceService');

/**
 * Thu thập ngữ cảnh hiện có trong repo: test cases, specs, page objects.
 * Giúp AI đối chiếu chéo và phát hiện xung đột / test case cần sửa.
 */
function gatherRepoContext(root) {
  const context = {
    testCases: [],
    specs: [],
    requirements: [],
    pages: [],
  };

  // 1. Quét test-cases/
  const tcDirs = ['test-cases', 'testCases'];
  for (const d of tcDirs) {
    const absDir = path.join(root, d);
    if (fs.existsSync(absDir)) {
      try {
        const files = fs.readdirSync(absDir).filter((f) => f.endsWith('.md'));
        for (const file of files.slice(0, 15)) {
          const content = fs.readFileSync(path.join(absDir, file), 'utf8');
          const tcs = [];
          const lines = content.split(/\r?\n/);
          for (const line of lines) {
            const m = line.match(/^#{2,4}\s*(TC-\d{3,})\b[:\s\-—]*(.*)$/i);
            if (m) tcs.push(`${m[1]}: ${m[2].trim()}`);
          }
          context.testCases.push({
            file: path.posix.join(d, file),
            tcs: tcs.slice(0, 10),
          });
        }
      } catch (_) {}
      break;
    }
  }

  // 2. Quét tests/
  const testsDir = path.join(root, 'tests');
  if (fs.existsSync(testsDir)) {
    try {
      function scanDir(dir, rel = 'tests') {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const itemRel = path.posix.join(rel, item.name);
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            scanDir(fullPath, itemRel);
          } else if (item.isFile() && item.name.endsWith('.spec.js')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const describes = [];
              const tests = [];
              const dMatches = [...content.matchAll(/test\.describe(?:\.serial)?\s*\(\s*['"`](.*?)['"`]/g)];
              const tMatches = [...content.matchAll(/test\s*\(\s*['"`](.*?)['"`]/g)];
              for (const dm of dMatches.slice(0, 3)) describes.push(dm[1]);
              for (const tm of tMatches.slice(0, 8)) tests.push(tm[1]);
              context.specs.push({
                file: itemRel,
                describes,
                tests,
              });
            } catch (_) {}
          }
        }
      }
      scanDir(testsDir);
    } catch (_) {}
  }

  // 3. Quét requirements/
  const reqDirs = ['requirements'];
  for (const d of reqDirs) {
    const absDir = path.join(root, d);
    if (fs.existsSync(absDir)) {
      try {
        const files = fs.readdirSync(absDir).filter((f) => f.endsWith('.md'));
        for (const file of files.slice(0, 10)) {
          const content = fs.readFileSync(path.join(absDir, file), 'utf8');
          const titleMatch = content.match(/^#\s+(.*)$/m);
          context.requirements.push({
            file: path.posix.join(d, file),
            title: titleMatch ? titleMatch[1].trim() : file,
          });
        }
      } catch (_) {}
      break;
    }
  }

  // 4. Quét pages/
  const pagesDir = path.join(root, 'pages');
  if (fs.existsSync(pagesDir)) {
    try {
      const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.js') && f !== 'BasePage.js');
      context.pages = files.map((f) => path.basename(f, '.js')).slice(0, 20);
    } catch (_) {}
  }

  return context;
}

/**
 * Format repo context thành tóm tắt văn bản gọn gàng cho AI prompt
 */
function formatContextSummary(context) {
  const parts = [];

  if (context.requirements.length) {
    parts.push('DANH SÁCH REQUIREMENTS ĐANG CÓ:');
    for (const r of context.requirements) {
      parts.push(`- [${r.file}]: ${r.title}`);
    }
    parts.push('');
  }

  if (context.testCases.length) {
    parts.push('DANH SÁCH TEST CASES HIỆN TẠI (TRÍCH MẪU):');
    for (const t of context.testCases) {
      parts.push(`- ${t.file}:`);
      for (const tc of t.tcs) parts.push(`    * ${tc}`);
    }
    parts.push('');
  }

  if (context.specs.length) {
    parts.push('DANH SÁCH SPECS PLAYWRIGHT HIỆN TẠI:');
    for (const s of context.specs.slice(0, 15)) {
      parts.push(`- File: ${s.file}`);
      if (s.describes.length) parts.push(`    Suites: ${s.describes.join(' | ')}`);
      if (s.tests.length) parts.push(`    Tests: ${s.tests.slice(0, 5).join('; ')}`);
    }
    parts.push('');
  }

  if (context.pages.length) {
    parts.push(`DANH SÁCH PAGE OBJECTS HIỆN CÓ (${context.pages.length} pages): ${context.pages.join(', ')}`);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Phân tích bằng AI Semantic Engine
 */
async function analyzeWithAi({ rawText, repoContext, clientConfig, root }) {
  const env = parseEnvFile(path.join(root, '.env'));
  const apiKey = (clientConfig && clientConfig.apiKey) || env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY;
  const provider = (clientConfig && clientConfig.provider) || env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini');
  const baseURL = (clientConfig && clientConfig.baseURL) || env.AI_BASE_URL || '';
  const model = (clientConfig && clientConfig.model) || env.AI_MODEL || (provider === 'gemini' ? (env.DASHBOARD_GEMINI_MODEL || 'gemini-2.5-flash') : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key cho AI (Gemini, OpenAI, DeepSeek). Vui lòng cấu hình trong Cài đặt Dashboard hoặc sử dụng chế độ Quy chuẩn Heuristic Offline.');
  }

  const contextStr = formatContextSummary(repoContext);

  const systemPrompt = `Bạn là Senior QA Architect & Principal Test Consultant với hơn 15 năm kinh nghiệm trong kiểm thử phần mềm tự động (Playwright/BDD), phân tích yêu cầu nghiệp vụ (Business Analysis) và phòng vệ rủi ro hệ thống (QA Defense Strategy).

NHIỆM VỤ:
Phân tích kỹ lưỡng văn bản Yêu cầu / Change Request / Ticket được cung cấp, đối chiếu chéo với các kịch bản test và specs đang có trong repo, và xuất ra một báo cáo phân tích toàn diện 4 trụ cột nghiệp vụ.

CÁC NGUYÊN TẮC BẮT BUỘC:
1. ĐẦU RA PHẢI LÀ MỘT ĐỐI TƯỢNG JSON HỢP LỆ THUẦN TÚY (không markdown code fences, không giải thích bên ngoài JSON).
2. Phân tích chi tiết, thực tế, đúng trọng tâm kỹ thuật, không trả lời chung chung.
3. Trong mục "existingTestCasesImpact", hãy đối chiếu trực tiếp với danh sách specs/test cases trong repo được cung cấp để chỉ rõ test case/file nào có khả năng bị ảnh hưởng hoặc cần sửa.
4. Trong mục "qaTeamInquiries", hãy đóng vai QA Lead dày dạn kinh nghiệm đặt ra các câu hỏi phản biện sâu sắc về: Rủi ro hồi quy (Regression), Tương thích ngược (Backward compatibility với dữ liệu cũ/API cũ), Hiệu năng/Tải/Race condition, Dữ liệu test (Test Data Seeding), và Tác động đến Page Objects/Automation framework.
5. Trong mục "logicClarifications", hãy chỉ ra những chỗ mơ hồ, thiếu thông số kỹ thuật (Validation rules, Max/Min, Null/Empty, Timeout, Quyền hạn vai trò) mà QA cần PO/BA/Dev làm rõ trước khi nghiệm thu.

SCHEMA JSON YÊU CẦU:
{
  "summary": "Tóm tắt ngắn gọn yêu cầu (1-2 câu)",
  "testCaseEstimation": {
    "totalCount": 6,
    "breakdown": {
      "positive": 2,
      "negative": 2,
      "boundary": 1,
      "edge": 1,
      "security": 0
    },
    "testCases": [
      {
        "suggestedId": "TC-001",
        "title": "Tiêu đề test case ngắn gọn, rõ hành động và kết quả kỳ vọng",
        "type": "Positive" | "Negative" | "Boundary" | "Edge Case" | "Security",
        "priority": "P0" | "P1" | "P2" | "P3",
        "precondition": "Tiền điều kiện cụ thể (ví dụ: Tài khoản GV đã đăng nhập)",
        "testData": "Dữ liệu kiểm thử mẫu",
        "steps": [
          { "step": 1, "action": "Thao tác người dùng hoặc API", "expected": "Kết quả mong đợi chi tiết" }
        ]
      }
    ]
  },
  "systemImpact": {
    "riskLevel": "Cao" | "Trung bình" | "Thấp",
    "summary": "Đánh giá tổng quan mức độ tác động lên toàn hệ thống",
    "affectedSurfaces": [
      { "surface": "Tên màn hình / Cổng / Bề mặt", "impact": "Chi tiết tác động" }
    ],
    "apiEndpoints": [
      { "method": "POST", "endpoint": "/api/...", "impact": "Ảnh hưởng đến payload / validation" }
    ],
    "dataSchemaChanges": [
      { "field": "Tên trường hoặc bảng dữ liệu", "nature": "Mới / Sửa đổi / Bắt buộc", "impact": "Mô tả chi tiết" }
    ],
    "businessLogicChanges": [
      "Quy tắc nghiệp vụ 1 bị thay đổi...",
      "Quy tắc nghiệp vụ 2..."
    ]
  },
  "existingTestCasesImpact": [
    {
      "identifier": "Tên file spec hoặc TC-xxx trong repo",
      "currentBehavior": "Hành vi hiện tại mà test case đang kiểm tra",
      "requiredChange": "Cần sửa đổi locator, payload hay assertion gì để test không bị fail",
      "reason": "Nguyên nhân logic mới làm ảnh hưởng test case này",
      "severity": "Cao" | "Trung bình" | "Thấp"
    }
  ],
  "logicClarifications": [
    {
      "questionId": "Q-01",
      "topic": "Chủ đề (ví dụ: Validation / Phân quyền / Trạng thái hồ sơ cũ)",
      "question": "Câu hỏi cụ thể gửi PO/BA/Dev để làm rõ nghiệp vụ",
      "whyItMatters": "Hậu quả kỹ thuật hoặc rủi ro nếu không làm rõ câu hỏi này",
      "proposedDefault": "Đề xuất hành vi mặc định nếu PO chưa quyết định"
    }
  ],
  "qaTeamInquiries": [
    {
      "inquiryId": "QA-01",
      "category": "Hồi quy (Regression)" | "Tương thích ngược (Backward Compatibility)" | "Hiệu năng & Race Condition" | "Dữ liệu Test & Fixtures" | "Bảo trì Automation",
      "question": "Câu hỏi phản biện mang tính chất phòng thủ rủi ro của Team QA",
      "targetStakeholder": "Dev Lead" | "Product Owner" | "DevOps / Infra" | "System Architect",
      "rationale": "Căn cứ kỹ thuật và rủi ro nếu bỏ qua"
    }
  ]
}`;

  const userPrompt = `DƯỚI ĐÂY LÀ VĂN BẢN REQUIREMENT CẦN PHÂN TÍCH:
---
${rawText}
---

THÔNG TIN NGỮ CẢNH HỆ THỐNG HIỆN CÓ CỦA REPO:
---
${contextStr || '(Repo chưa có nhiều specs hoặc requirements mẫu)'}
---

Hãy phân tích toàn diện và trả về JSON theo đúng schema yêu cầu.`;

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
          maxOutputTokens: 4096,
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
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`${provider.toUpperCase()} API trả về lỗi (${res.status}): ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseJsonText = data.choices?.[0]?.message?.content || '';
  }

  // Parse JSON
  let cleaned = responseJsonText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      engine: 'ai',
      provider,
      model,
      ...parsed,
    };
  } catch (err) {
    throw new Error(`Phản hồi từ AI không đúng định dạng JSON: ${err.message}. Nội dung thô: ${cleaned.slice(0, 200)}...`);
  }
}

/**
 * Động cơ Heuristic Rule-Based (Offline / Zero-token)
 * Tự động trích xuất các quy tắc biên, trường bắt buộc, tác động và câu hỏi.
 */
function analyzeWithHeuristic({ rawText, repoContext }) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const textLower = rawText.toLowerCase();

  const testCases = [];
  let tcIdCounter = 1;
  const nextId = () => `TC-${String(tcIdCounter++).padStart(3, '0')}`;

  // 1. Phân tích Boundary Value Analysis (BVA) & Con số
  const rangeMatch = rawText.match(/(?:từ\s*)?(\d+)\s*(?:đến|-)\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);
  const maxMatch = rawText.match(/tối\s*đa\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);
  const minMatch = rawText.match(/tối\s*thiểu\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);

  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra giá trị hợp lệ trong khoảng chuẩn (${min} đến ${max})`,
      type: 'Positive',
      priority: 'P1',
      precondition: 'Người dùng ở màn hình nhập liệu',
      testData: `Số lượng/Độ dài: ${min}`,
      steps: [
        { step: 1, action: `Nhập giá trị hợp lệ (${min})`, expected: 'Hệ thống chấp nhận dữ liệu thành công' },
        { step: 2, action: 'Bấm Lưu / Submit', expected: 'Lưu thành công, không báo lỗi' },
      ],
    });
    if (min > 0) {
      testCases.push({
        suggestedId: nextId(),
        title: `Kiểm tra biên dưới: Thất bại khi dữ liệu < ${min} (vi phạm tối thiểu)`,
        type: 'Boundary',
        priority: 'P1',
        precondition: 'Người dùng ở màn hình nhập liệu',
        testData: `Số lượng/Độ dài: ${min - 1}`,
        steps: [
          { step: 1, action: `Nhập dữ liệu có độ dài/số lượng = ${min - 1}`, expected: `Hệ thống hiển thị cảnh báo yêu cầu tối thiểu ${min}` },
          { step: 2, action: 'Bấm Lưu', expected: 'Hệ thống chặn lưu thành công' },
        ],
      });
    }
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra biên trên: Chặn khi dữ liệu > ${max} (vượt quá giới hạn tối đa)`,
      type: 'Boundary',
      priority: 'P1',
      precondition: 'Người dùng ở màn hình nhập liệu',
      testData: `Số lượng/Độ dài: ${max + 1}`,
      steps: [
        { step: 1, action: `Nhập/chọn vượt quá giới hạn (${max + 1})`, expected: `Hệ thống chặn chọn hoặc báo lỗi tối đa ${max}` },
      ],
    });
  } else if (maxMatch) {
    const max = parseInt(maxMatch[1], 10);
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra lưu thành công khi đạt ngưỡng tối đa ${max}`,
      type: 'Positive',
      priority: 'P1',
      precondition: 'Màn hình có trường giới hạn tối đa',
      testData: `Đúng ${max} mục`,
      steps: [
        { step: 1, action: `Chọn/nhập đủ ${max} phần tử`, expected: `Hiển thị đủ ${max} phần tử, hệ thống cho phép lưu` },
      ],
    });
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra chặn phần tử thứ ${max + 1} vượt ngưỡng tối đa`,
      type: 'Boundary',
      priority: 'P1',
      precondition: 'Đã chọn đủ số lượng tối đa',
      testData: `Phần tử thứ ${max + 1}`,
      steps: [
        { step: 1, action: `Cố gắng chọn hoặc thêm phần tử thứ ${max + 1}`, expected: 'Hệ thống vô hiệu hóa nút thêm hoặc chặn chọn, thông báo đạt tối đa' },
      ],
    });
  }

  // 2. Phân tích trường bắt buộc (Mandatory)
  const isRequired = /bắt\s*buộc|chặn\s*lưu|không\s*được\s*để\s*trống/i.test(rawText);
  if (isRequired) {
    testCases.push({
      suggestedId: nextId(),
      title: 'Kiểm tra thất bại khi bỏ trống trường thông tin bắt buộc',
      type: 'Negative',
      priority: 'P0',
      precondition: 'Màn hình nhập thông tin',
      testData: 'Bỏ trống trường bắt buộc',
      steps: [
        { step: 1, action: 'Để trống trường bắt buộc và nhấn Lưu / Submit', expected: 'Hệ thống chặn lưu và hiển thị thông báo lỗi/toast validation' },
      ],
    });
  }

  // 3. Phân tích luồng tạo mới & chỉnh sửa
  testCases.push({
    suggestedId: nextId(),
    title: 'Kiểm tra luồng tạo mới thành công với đầy đủ dữ liệu hợp lệ',
    type: 'Positive',
    priority: 'P0',
    precondition: 'Tài khoản có quyền thao tác',
    testData: 'Dữ liệu hợp lệ chuẩn',
    steps: [
      { step: 1, action: 'Điền đầy đủ thông tin hợp lệ', expected: 'Không có lỗi validate' },
      { step: 2, action: 'Nhấn Lưu', expected: 'Dữ liệu được lưu và hiển thị đúng sau khi tải lại' },
    ],
  });

  testCases.push({
    suggestedId: nextId(),
    title: 'Kiểm tra cập nhật dữ liệu và kiểm tra tính toàn vẹn (Data Persistence)',
    type: 'Positive',
    priority: 'P1',
    precondition: 'Bản ghi đã tồn tại',
    testData: 'Giá trị cập nhật mới',
    steps: [
      { step: 1, action: 'Sửa giá trị trường dữ liệu và nhấn Lưu', expected: 'Hệ thống cập nhật thành công' },
      { step: 2, action: 'Reload lại trang / mở lại form', expected: 'Dữ liệu hiển thị đúng giá trị vừa cập nhật, không bị xoá trắng' },
    ],
  });

  // Tác động hệ thống
  const affectedSurfaces = [];
  if (/giáo\s*viên|instructor/i.test(textLower)) affectedSurfaces.push({ surface: 'Hồ sơ Giáo viên (Cổng GV / Sàn)', impact: 'Thay đổi form thông tin và luồng duyệt hồ sơ' });
  if (/khoá\s*học|khóa\s*học|course/i.test(textLower)) affectedSurfaces.push({ surface: 'Đăng tin / Quản lý Khóa học', impact: 'Ảnh hưởng luồng tạo và sửa tin đăng' });
  if (/admin/i.test(textLower)) affectedSurfaces.push({ surface: 'Admin Portal', impact: 'Bảng duyệt hồ sơ, xem chi tiết và đối chiếu revision' });
  if (!affectedSurfaces.length) affectedSurfaces.push({ surface: 'Giao diện chính (Web Studio)', impact: 'Bề mặt thao tác trực tiếp của tính năng' });

  // Tác động test cases có sẵn
  const existingTestCasesImpact = [];
  if (repoContext && repoContext.specs) {
    for (const spec of repoContext.specs) {
      if (/instructor|course|listing|profile/i.test(spec.file) && /giáo\s*viên|trung\s*tâm|hồ\s*sơ/i.test(textLower)) {
        existingTestCasesImpact.push({
          identifier: spec.file,
          currentBehavior: 'Đang thao tác tạo/sửa hồ sơ với các trường cũ',
          requiredChange: 'Cần bổ sung giá trị cho trường mới hoặc cập nhật locator để luồng E2E không bị chặn',
          reason: 'Do tính năng mới thêm trường bắt buộc hoặc thay đổi logic validate',
          severity: 'High',
        });
      }
    }
  }

  // Câu hỏi làm rõ logic
  const logicClarifications = [
    {
      questionId: 'Q-01',
      topic: 'Xử lý dữ liệu lịch sử (Legacy Data)',
      question: 'Đối với các bản ghi cũ đã tạo trước đây nhưng chưa có trường thông tin này, hệ thống sẽ xử lý thế nào khi người dùng sửa trường khác?',
      whyItMatters: 'Có thể gây lỗi chặn lưu bất ngờ cho người dùng cũ nếu trường này là bắt buộc',
      proposedDefault: 'Chặn lưu và nhắc người dùng bổ sung trước khi cập nhật các thông tin khác.',
    },
    {
      questionId: 'Q-02',
      topic: 'Quyền hạn và hiển thị ngoài công khai',
      question: 'Thông tin này có hiển thị ra trang công khai cho khách hàng cuối xem hay chỉ dành cho nội bộ/quản trị viên?',
      whyItMatters: 'Quyết định việc viết test kiểm tra rò rỉ dữ liệu hoặc kiểm tra UI trên các màn hình public.',
      proposedDefault: 'Chỉ hiển thị trong nội bộ và màn hình quản lý, không đưa ra trang công khai trừ khi có yêu cầu riêng.',
    },
    {
      questionId: 'Q-03',
      topic: 'Xác thực & Ràng buộc định dạng',
      question: 'Trường dữ liệu này có giới hạn độ dài ký tự đặc biệt, định dạng MST/Email/SĐT hay ký tự số không?',
      whyItMatters: 'Cần xác định để thiết lập các ca kiểm thử biên và validation chính xác.',
      proposedDefault: 'Áp dụng quy tắc chuẩn hóa văn bản UTF-8, loại bỏ khoảng trắng thừa đầu/cuối.',
    },
  ];

  // Câu hỏi phản biện Team QA
  const qaTeamInquiries = [
    {
      inquiryId: 'QA-01',
      category: 'Hồi quy (Regression)',
      question: 'Khi thêm trường bắt buộc mới, các luồng E2E phụ thuộc (ví dụ đăng tin, thanh toán, duyệt tài khoản) có bị văng lỗi do thiếu trường này không?',
      targetStakeholder: 'Dev Lead',
      rationale: 'Nguy cơ làm gãy hàng loạt kịch bản kiểm thử tự động hồi quy trên môi trường CI/CD.',
    },
    {
      inquiryId: 'QA-02',
      category: 'Tương thích ngược (Backward Compatibility)',
      question: 'Mobile App hoặc API Clients phiên bản cũ chưa cập nhật trường mới này có gọi được API lưu hồ sơ không?',
      targetStakeholder: 'System Architect',
      rationale: 'Tránh tình trạng người dùng app phiên bản cũ bị crash hoặc không submit được form.',
    },
    {
      inquiryId: 'QA-03',
      category: 'Dữ liệu Test & Fixtures',
      question: 'Bộ dữ liệu seed và factory account mẫu đã được cập nhật trường mới để phục vụ chạy test tự động chưa?',
      targetStakeholder: 'DevOps / QA Automation',
      rationale: 'Cần cập nhật các helper fixture để tránh tạo tài khoản rác không hợp lệ.',
    },
    {
      inquiryId: 'QA-04',
      category: 'Bảo trì Automation',
      question: 'Page Objects và Locators nào cần được đồng bộ lại nhãn (Label/Placeholder) để tương thích với thay đổi mới?',
      targetStakeholder: 'QA Lead',
      rationale: 'Đảm bảo locator không bị phụ thuộc vào nhãn text tĩnh có thể thay đổi.',
    },
  ];

  return {
    engine: 'heuristic',
    summary: lines[0] || 'Phân tích yêu cầu nghiệp vụ dựa trên quy chuẩn Heuristic & BVA',
    testCaseEstimation: {
      totalCount: testCases.length,
      breakdown: {
        positive: testCases.filter((t) => t.type === 'Positive').length,
        negative: testCases.filter((t) => t.type === 'Negative').length,
        boundary: testCases.filter((t) => t.type === 'Boundary').length,
        edge: testCases.filter((t) => t.type === 'Edge Case').length,
        security: 0,
      },
      testCases,
    },
    systemImpact: {
      riskLevel: isRequired ? 'Cao' : 'Trung bình',
      summary: `Yêu cầu bổ sung hoặc thay đổi logic nghiệp vụ${isRequired ? ' (có tính chất bắt buộc)' : ''}.`,
      affectedSurfaces,
      apiEndpoints: [
        { method: 'POST/PUT', endpoint: '/api/v1/...', impact: 'Cập nhật payload nhận thêm/sửa trường thông tin' },
      ],
      dataSchemaChanges: [
        { field: 'Dữ liệu mới', nature: isRequired ? 'Bắt buộc' : 'Tùy chọn', impact: 'Ảnh hưởng kiểm tra tính hợp lệ khi lưu bản ghi' },
      ],
      businessLogicChanges: [
        'Quy tắc validate dữ liệu đầu vào',
        'Cơ chế chặn lưu khi không thỏa mãn điều kiện tiên quyết',
      ],
    },
    existingTestCasesImpact,
    logicClarifications,
    qaTeamInquiries,
  };
}

/**
 * Hàm phân tích chính được gọi từ Routes
 */
async function analyzeRequirement({ root, rawText, mode = 'ai', clientConfig, scanExisting = true }) {
  if (!rawText || !rawText.trim()) {
    throw Object.assign(new Error('Vui lòng nhập hoặc dán nội dung requirement để phân tích.'), { status: 400 });
  }

  const repoContext = scanExisting ? gatherRepoContext(root) : { testCases: [], specs: [], requirements: [], pages: [] };

  if (mode === 'heuristic') {
    return analyzeWithHeuristic({ rawText, repoContext });
  }

  try {
    return await analyzeWithAi({ rawText, repoContext, clientConfig, root });
  } catch (err) {
    // Nếu gọi AI thất bại (do mạng, hết quota, hoặc chưa có key), fallback sang Heuristic có ghi chú
    const fallback = analyzeWithHeuristic({ rawText, repoContext });
    fallback.aiError = err.message;
    fallback.fallbackNotice = `Không thể kết nối mô hình AI (${err.message}). Hệ thống đã tự động chuyển sang chế độ phân tích Quy chuẩn Heuristic Offline.`;
    return fallback;
  }
}

/**
 * 1-Click Scaffold: Tạo file REQ và TC từ kết quả phân tích
 */
function scaffoldFromAnalysis(root, { reqId, title, domain = 'general', analysisResult }) {
  if (!analysisResult) {
    throw Object.assign(new Error('Thiếu dữ liệu kết quả phân tích.'), { status: 400 });
  }

  const cleanReqId = (reqId || 'REQ-001').toUpperCase().trim();
  const cleanTitle = (title || analysisResult.summary || 'Requirement Mới').trim();
  const safeSlug = cleanTitle.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'feature';

  const reqDir = path.join(root, 'requirements');
  const tcDir = path.join(root, 'test-cases');
  if (!fs.existsSync(reqDir)) fs.mkdirSync(reqDir, { recursive: true });
  if (!fs.existsSync(tcDir)) fs.mkdirSync(tcDir, { recursive: true });

  const reqFileName = `${cleanReqId}-${safeSlug}.md`;
  const tcFileName = `${cleanReqId}-${safeSlug}.md`;
  const reqFilePath = path.join(reqDir, reqFileName);
  const tcFilePath = path.join(tcDir, tcFileName);
  if (fs.existsSync(reqFilePath)) {
    createBackup(path.relative(root, reqFilePath), reqFilePath, root);
  }
  if (fs.existsSync(tcFilePath)) {
    createBackup(path.relative(root, tcFilePath), tcFilePath, root);
  }

  // Tạo nội dung Requirement Markdown
  const acList = [];
  const testCases = analysisResult.testCaseEstimation?.testCases || [];
  testCases.forEach((tc, idx) => {
    const acId = `AC-${String(idx + 1).padStart(3, '0')}`;
    acList.push(`### ${acId}: ${tc.title}\n\n**Given** ${tc.precondition || 'hệ thống sẵn sàng'}\n**When** thực hiện thao tác kiểm thử\n**Then** ${tc.steps?.[tc.steps.length - 1]?.expected || 'kết quả đáp ứng kỳ vọng'}.\n`);
  });

  const openQuestionsList = (analysisResult.logicClarifications || []).map((q, idx) => {
    return `${idx + 1}. [${q.topic}] ${q.question} — cần xác nhận với PO/BA.\n   *Ý nghĩa: ${q.whyItMatters}*\n   *Đề xuất mặc định: ${q.proposedDefault}*`;
  }).join('\n\n');

  const reqContent = `# ${cleanReqId}: ${cleanTitle}

## 1. Tổng quan & Mục tiêu
${analysisResult.summary || cleanTitle}

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)
${acList.join('\n') || 'Chưa có tiêu chí cụ thể.'}

## 3. Tác động hệ thống & Rủi ro
- **Mức độ rủi ro:** ${analysisResult.systemImpact?.riskLevel || 'Trung bình'}
- **Tóm tắt:** ${analysisResult.systemImpact?.summary || ''}
${(analysisResult.systemImpact?.affectedSurfaces || []).map((s) => `- **${s.surface}:** ${s.impact}`).join('\n')}

## 4. Open Questions (Cần làm rõ)
${openQuestionsList || 'Chưa có câu hỏi mở.'}
`;

  // Tạo nội dung Test Cases Markdown
  const tcBlocks = testCases.map((tc, idx) => {
    const acId = `AC-${String(idx + 1).padStart(3, '0')}`;
    const tcId = tc.suggestedId || `TC-${String(idx + 1).padStart(3, '0')}`;
    const stepsTable = (tc.steps || []).map((s) => `| ${s.step} | ${s.action} | ${s.expected} |`).join('\n');

    return `### ${tcId}: [${acId}] ${tc.title}

- **Loại kiểm thử:** ${tc.type || 'Functional'}
- **Độ ưu tiên:** ${tc.priority || 'P1'}
- **Trạng thái Automation:** candidate
- **Tiền điều kiện:** ${tc.precondition || 'Không có'}
- **Dữ liệu kiểm thử:** ${tc.testData || 'Mặc định'}

| Bước | Hành động | Kết quả mong đợi |
|:---|:---|:---|
${stepsTable || '| 1 | Thao tác kiểm tra | Đáp ứng kỳ vọng |'}
`;
  }).join('\n---\n\n');

  const tcContent = `# Test Cases cho ${cleanReqId}: ${cleanTitle}

${tcBlocks || 'Chưa có test case nào.'}
`;

  fs.writeFileSync(reqFilePath, reqContent, 'utf8');
  fs.writeFileSync(tcFilePath, tcContent, 'utf8');

  return {
    ok: true,
    reqId: cleanReqId,
    title: cleanTitle,
    files: [
      path.relative(root, reqFilePath).replace(/\\/g, '/'),
      path.relative(root, tcFilePath).replace(/\\/g, '/'),
    ],
  };
}

module.exports = {
  gatherRepoContext,
  formatContextSummary,
  analyzeRequirement,
  scaffoldFromAnalysis,
};
